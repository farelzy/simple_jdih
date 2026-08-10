/**
 * routes/admin.ts - dashboard Bagian Hukum.
 *
 * Seluruh rute di berkas ini dijaga wajibAdmin. Tidak ada satu pun yang boleh
 * dibuka tanpa sesi -- termasuk yang hanya membaca, karena antrean dan log
 * memuat email pemohon dan jejak siapa mengubah apa.
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { wajibAdmin, bacaSesi } from '../middleware/auth.js';
import { GalatKlien } from '../middleware/galat.js';
import {
  pengajuanSemua, pengajuanCariNomor, pengajuanUbahStatus
} from '../repo/pengajuan.js';
import { riwayatTambah } from '../repo/riwayat.js';
import {
  adminDaftar, adminBuat, adminNonaktifkan, adminHitungAktif,
  adminCari, adminGantiSandi
} from '../repo/admin.js';
import { opdSemua, opdTambah, opdNonaktifkan, opdUbahKode } from '../repo/opd.js';
import { pengaturanSemua, pengaturanSetel, BATAS_MAKS_MB } from '../repo/pengaturan.js';
import { logTerakhir, logCatat } from '../repo/log.js';
import { rekapPerStatus, rekapPerOpd, rekapPerBulan, rataLamaProsesHari, cariMandek } from '../pure/rekap.js';
import { TAHAP_RIWAYAT, STATUS_PENGAJUAN } from '../pure/skema.js';
import { migrasiPeriksa, migrasiJalankan } from '../services/migrasi.js';

export const ruteAdmin = Router();

/** Alasan pengembalian yang berulang di data nyata, jadi pilihan cepat. */
const ALASAN_KEMBALI = [
  'Draf belum memuat komentar dasar hukum di setiap pasal',
  'Belum disertakan hasil konsultasi',
  'Draf yang diinput belum sesuai ketentuan'
];

ruteAdmin.use(wajibAdmin);

function hariIni(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function tanggalSaja(nilai: unknown): string {
  return String(nilai ?? '').slice(0, 10);
}

ruteAdmin.get('/data', async (req, res, next) => {
  try {
    const pengaturan = await pengaturanSemua();
    const semua = (await pengajuanSemua()).map((p) => ({
      nomor: p.nomor,
      id: p.nomor,                       // cariMandek memakai kunci `id`
      judul: p.judul,
      opd: p.opd_teks,
      status: p.status,
      jenis_peraturan: p.jenis_peraturan,
      keterangan: p.keterangan,
      masuk: tanggalSaja(p.dibuat_pada),
      diperbarui: tanggalSaja(p.diperbarui_pada)
    }));

    const ambang = Number(pengaturan.ambang_mandek_hari) || 7;
    const mandek = new Set(cariMandek(semua, ambang, hariIni()));

    // Antrean: hanya PROSES, yang paling lama tidak diperbarui di atas. Inilah
    // yang paling sering terlewat dalam sistem manual.
    const antrean = semua
      .filter((p) => p.status === 'PROSES')
      .sort((a, b) => (a.diperbarui < b.diperbarui ? -1 : 1))
      .map((p) => ({ ...p, mandek: mandek.has(p.nomor) }));

    res.json({
      emailSaya: bacaSesi(req)?.email ?? '',
      antrean,
      rekap: {
        status: rekapPerStatus(semua),
        opd: rekapPerOpd(semua),
        bulan: rekapPerBulan(semua),
        rataHari: rataLamaProsesHari(semua)
      },
      pengaturan,
      batasMaksMb: BATAS_MAKS_MB,
      opd: await opdSemua(),
      admin: await adminDaftar(),
      alasanKembali: ALASAN_KEMBALI,
      tahap: TAHAP_RIWAYAT,
      status: STATUS_PENGAJUAN
    });
  } catch (e) { next(e); }
});

ruteAdmin.post('/riwayat', async (req, res, next) => {
  try {
    const { nomor, tanggal, tahap, keterangan } = (req.body ?? {}) as Record<string, string>;
    const p = await pengajuanCariNomor(String(nomor ?? ''));
    if (!p) throw new GalatKlien('Pengajuan tidak ditemukan.', 404);

    const email = bacaSesi(req)?.email ?? '';
    await riwayatTambah(p.id, {
      tanggal: String(tanggal ?? ''),
      tahap: String(tahap ?? ''),
      keterangan: String(keterangan ?? '')
    }, email);
    await logCatat({ aktor: email, aksi: 'TAMBAH_RIWAYAT', pengajuanId: p.id, rincian: `${tahap} ${tanggal}` });
    res.json({ sukses: true });
  } catch (e) { next(e); }
});

ruteAdmin.post('/status', async (req, res, next) => {
  try {
    const { nomor, status, alasan } = (req.body ?? {}) as Record<string, string>;
    const email = bacaSesi(req)?.email ?? '';
    await pengajuanUbahStatus(
      String(nomor ?? ''), status as never, String(alasan ?? ''), email
    );
    const p = await pengajuanCariNomor(String(nomor ?? ''));
    await logCatat({
      aktor: email, aksi: 'UBAH_STATUS', pengajuanId: p?.id ?? null,
      rincian: `${status}${alasan ? ' - ' + alasan : ''}`
    });
    res.json({ sukses: true });
  } catch (e) { next(e); }
});

ruteAdmin.get('/log', async (req, res, next) => {
  try {
    res.json(await logTerakhir(Number(req.query.jumlah ?? 100)));
  } catch (e) { next(e); }
});

/* ---------- OPD ---------- */

ruteAdmin.post('/opd', async (req, res, next) => {
  try {
    const { kode, nama_resmi, nama_singkat } = (req.body ?? {}) as Record<string, string>;
    await opdTambah(String(kode ?? ''), String(nama_resmi ?? ''), String(nama_singkat ?? ''));
    await logCatat({ aktor: bacaSesi(req)?.email ?? '', aksi: 'TAMBAH_OPD', rincian: `${kode} - ${nama_resmi}` });
    res.json({ sukses: true });
  } catch (e) { next(e); }
});

/**
 * Ganti kode sebuah OPD.
 *
 * Kode lama langsung berhenti berlaku begitu ini jalan, jadi inilah tombol
 * yang dipakai kalau kode terlanjur tersebar ke luar OPD-nya.
 */
ruteAdmin.put('/opd/:id/kode', async (req, res, next) => {
  try {
    const { kode } = (req.body ?? {}) as Record<string, string>;
    await opdUbahKode(Number(req.params.id), String(kode ?? ''));
    // Kodenya sendiri tidak ikut dicatat: log audit bisa dibaca semua admin,
    // dan menuliskannya di sana sama saja membocorkannya lagi.
    await logCatat({
      aktor: bacaSesi(req)?.email ?? '',
      aksi: 'GANTI_KODE_OPD',
      rincian: `OPD #${req.params.id}`
    });
    res.json({ sukses: true });
  } catch (e) { next(e); }
});

ruteAdmin.delete('/opd/:id', async (req, res, next) => {
  try {
    await opdNonaktifkan(Number(req.params.id));
    await logCatat({ aktor: bacaSesi(req)?.email ?? '', aksi: 'HAPUS_OPD', rincian: String(req.params.id) });
    res.json({ sukses: true });
  } catch (e) { next(e); }
});

/* ---------- Admin ---------- */

ruteAdmin.post('/admin', async (req, res, next) => {
  try {
    const { email, nama, sandi } = (req.body ?? {}) as Record<string, string>;
    await adminBuat(String(email ?? ''), String(nama ?? ''), String(sandi ?? ''));
    await logCatat({ aktor: bacaSesi(req)?.email ?? '', aksi: 'TAMBAH_ADMIN', rincian: String(email) });
    res.json({ sukses: true });
  } catch (e) { next(e); }
});

ruteAdmin.delete('/admin/:id', async (req, res, next) => {
  try {
    const sesi = bacaSesi(req);
    const id = Number(req.params.id);

    if (sesi?.id === id) {
      throw new GalatKlien('Tidak bisa menghapus akun sendiri.', 400);
    }
    // Tanpa penjagaan ini, satu klik bisa membuat sistem tidak punya admin sama
    // sekali dan tidak ada jalan masuk untuk membetulkannya lewat aplikasi.
    if ((await adminHitungAktif()) <= 1) {
      throw new GalatKlien('Ini admin terakhir. Tambahkan admin lain sebelum menghapusnya.', 400);
    }

    await adminNonaktifkan(id);
    await logCatat({ aktor: sesi?.email ?? '', aksi: 'HAPUS_ADMIN', rincian: String(id) });
    res.json({ sukses: true });
  } catch (e) { next(e); }
});

ruteAdmin.post('/ganti-sandi', async (req, res, next) => {
  try {
    const { sandiLama, sandiBaru } = (req.body ?? {}) as Record<string, string>;
    const sesi = bacaSesi(req);
    const admin = sesi ? await adminCari(sesi.email) : null;
    if (!admin) throw new GalatKlien('Sesi tidak sah.', 401);

    if (!(await bcrypt.compare(String(sandiLama ?? ''), admin.password_hash))) {
      throw new GalatKlien('Kata sandi lama salah.', 401);
    }
    await adminGantiSandi(admin.id, String(sandiBaru ?? ''));
    await logCatat({ aktor: admin.email, aksi: 'GANTI_SANDI', rincian: '' });
    res.json({ sukses: true });
  } catch (e) { next(e); }
});

/* ---------- Pengaturan ---------- */

ruteAdmin.post('/pengaturan', async (req, res, next) => {
  try {
    const { kunci, nilai } = (req.body ?? {}) as Record<string, string>;
    await pengaturanSetel(String(kunci ?? ''), String(nilai ?? ''));
    await logCatat({
      aktor: bacaSesi(req)?.email ?? '', aksi: 'UBAH_PENGATURAN',
      rincian: `${kunci} = ${nilai}`
    });
    res.json({ sukses: true });
  } catch (e) { next(e); }
});

/* ---------- Migrasi ---------- */

ruteAdmin.post('/periksa-sheet', async (req, res, next) => {
  try {
    const { sumber, isiCsv } = (req.body ?? {}) as Record<string, string>;
    res.json(await migrasiPeriksa({ sumber: sumber ?? '', isiCsv, ujiCoba: true }));
  } catch (e) { next(e); }
});

ruteAdmin.post('/migrasi', async (req, res, next) => {
  try {
    const { sumber, isiCsv, ujiCoba } = (req.body ?? {}) as Record<string, unknown>;
    res.json(await migrasiJalankan({
      sumber: String(sumber ?? ''),
      isiCsv: typeof isiCsv === 'string' ? isiCsv : undefined,
      ujiCoba: ujiCoba !== false,
      aktor: bacaSesi(req)?.email ?? 'admin'
    }));
  } catch (e) { next(e); }
});
