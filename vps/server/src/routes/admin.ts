/**
 * routes/admin.ts - dashboard Bagian Hukum.
 *
 * Seluruh rute di berkas ini dijaga wajibAdmin. Tidak ada satu pun yang boleh
 * dibuka tanpa sesi -- termasuk yang hanya membaca, karena antrean dan log
 * memuat email pemohon dan jejak siapa mengubah apa.
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { ruteExcel } from './excel.js';
import { rutePulihkan } from './pulihkan.js';
import { wajibAdmin, bacaSesi } from '../middleware/auth.js';
import { GalatKlien } from '../middleware/galat.js';
import {
  pengajuanSemua, pengajuanCariNomor, pengajuanUbahStatus, pengajuanSentuh
} from '../repo/pengajuan.js';
import {
  riwayatTambah, riwayatUntuk, riwayatCari, riwayatUbah, riwayatHapus,
  riwayatRingkasPerPengajuan
} from '../repo/riwayat.js';
import {
  adminDaftar, adminBuat, adminNonaktifkan, adminHitungAktif,
  adminCari, adminGantiSandi
} from '../repo/admin.js';
import { opdSemua, opdTambah, opdNonaktifkan, opdUbahKode } from '../repo/opd.js';
import { pengaturanSemua, pengaturanSetel, BATAS_MAKS_MB } from '../repo/pengaturan.js';
import { logTerakhir, logCatat } from '../repo/log.js';
import { rekapPerStatus, rekapPerOpd, rekapPerBulan, rataLamaProsesHari, cariMandek } from '../pure/rekap.js';
import { TAHAP_RIWAYAT, STATUS_PENGAJUAN } from '../pure/skema.js';
import {
  STASIUN, JUMLAH_STASIUN, stasiunTahap, stasiunTercapai, relDenganStatus, petaStasiun
} from '../pure/tahap.js';
import { migrasiPeriksa, migrasiJalankan } from '../services/migrasi.js';
import { buatBukuKerja } from '../services/ekspor.js';
import {
  cadanganDaftar, cadanganJalankan, jalurCadangan, tanggalJakarta, SIMPAN_HARI
} from '../services/cadangan.js';
import { buatCadanganPenuh } from '../services/cadangan-penuh.js';
import { existsSync } from 'node:fs';

export const ruteAdmin = Router();

// Migrasi lewat unggahan berkas Excel. Isinya sama di wizard penyiapan dan
// dashboard, jadi ditulis sekali di routes/excel.ts.
ruteAdmin.use(ruteExcel());
ruteAdmin.use(rutePulihkan());

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
    // Satu kueri untuk seluruh riwayat, sama seperti yang dipakai halaman
    // monitoring publik. Dashboard menggambar rel yang sama persis dengan yang
    // dilihat OPD, dan tombol "Ubah tahap" memakai posisi ini untuk memilihkan
    // pilihan awal serta memperingatkan pilihan yang tidak akan menggerakkan
    // apa pun.
    const ringkas = await riwayatRingkasPerPengajuan();
    const semua = (await pengajuanSemua()).map((p) => ({
      nomor: p.nomor,
      id: p.nomor,                       // cariMandek memakai kunci `id`
      judul: p.judul,
      opd: p.opd_teks,
      status: p.status,
      jenis_peraturan: p.jenis_peraturan,
      keterangan: p.keterangan,
      masuk: tanggalSaja(p.dibuat_pada),
      diperbarui: tanggalSaja(p.diperbarui_pada),
      terakhir: ringkas.get(p.id)?.terakhir?.keterangan ?? '',
      tahap_indeks: relDenganStatus(p.status, ringkas.get(p.id)?.tercapai ?? 0),
      tahap_total: JUMLAH_STASIUN
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
      // Antrean sengaja hanya PROSES, karena itulah pekerjaan yang menunggu.
      // Tapi berkas yang paling butuh dibetulkan relnya justru yang sudah
      // SELESAI atau DIKEMBALIKAN, dan tanpa daftar penuh keduanya tidak bisa
      // disentuh sama sekali dari dashboard.
      daftar: semua,
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
      // Formulir riwayat memakai dua hal ini untuk memisahkan tahap yang
      // menggerakkan rel dari yang tidak. Sebelumnya seluruh tahap tampil
      // sebagai satu daftar rata, dan LAINNYA -- yang tidak ada di rel --
      // terlihat sama sahnya dengan Pra Harmonisasi.
      stasiun: STASIUN,
      tahapStasiun: petaStasiun(TAHAP_RIWAYAT),
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

/**
 * Seluruh riwayat satu pengajuan, berikut posisi relnya.
 *
 * Dipakai panel "Kelola riwayat" di dashboard. Yang membedakannya dari
 * `/api/publik/detail/:nomor` adalah `id` tiap baris -- tanpa itu tidak ada
 * yang bisa ditunjuk untuk diubah atau dihapus -- dan `stasiun` per baris,
 * yang membuat baris di luar rel bisa ditandai apa adanya.
 */
ruteAdmin.get('/riwayat/:nomor', async (req, res, next) => {
  try {
    const p = await pengajuanCariNomor(String(req.params.nomor ?? ''));
    if (!p) throw new GalatKlien('Pengajuan tidak ditemukan.', 404);

    const riwayat = await riwayatUntuk(p.id);
    res.json({
      nomor: p.nomor,
      judul: p.judul,
      status: p.status,
      riwayat: riwayat.map((r) => ({
        id: r.id,
        tanggal: tanggalSaja(r.tanggal),
        tahap: r.tahap,
        keterangan: r.keterangan,
        dicatat_oleh: r.dicatat_oleh,
        stasiun: stasiunTahap(r.tahap)
      })),
      tahap_indeks: relDenganStatus(p.status, stasiunTercapai(riwayat.map((r) => r.tahap))),
      tahap_total: JUMLAH_STASIUN
    });
  } catch (e) { next(e); }
});

ruteAdmin.patch('/riwayat/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const lama = Number.isFinite(id) ? await riwayatCari(id) : null;
    if (!lama) throw new GalatKlien('Baris riwayat tidak ditemukan.', 404);

    const { tanggal, tahap, keterangan } = (req.body ?? {}) as Record<string, string>;
    const email = bacaSesi(req)?.email ?? '';
    await riwayatUbah(id, {
      tanggal: String(tanggal ?? ''),
      tahap: String(tahap ?? ''),
      keterangan: String(keterangan ?? '')
    }, email);
    await pengajuanSentuh(lama.pengajuan_id, email);

    // Tahap lama ikut dicatat: tanpa itu log tidak bisa menjawab pertanyaan
    // yang paling sering muncul setelah sebuah koreksi, yaitu dulu isinya apa.
    await logCatat({
      aktor: email, aksi: 'UBAH_RIWAYAT', pengajuanId: lama.pengajuan_id,
      rincian: `${lama.tahap} ${tanggalSaja(lama.tanggal)} -> ${tahap} ${tanggal}`
    });
    res.json({ sukses: true });
  } catch (e) { next(e); }
});

ruteAdmin.delete('/riwayat/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const lama = Number.isFinite(id) ? await riwayatCari(id) : null;
    if (!lama) throw new GalatKlien('Baris riwayat tidak ditemukan.', 404);

    const email = bacaSesi(req)?.email ?? '';
    await riwayatHapus(id);
    await pengajuanSentuh(lama.pengajuan_id, email);
    await logCatat({
      aktor: email, aksi: 'HAPUS_RIWAYAT', pengajuanId: lama.pengajuan_id,
      rincian: `${lama.tahap} ${tanggalSaja(lama.tanggal)} ${lama.keterangan}`.trim()
    });
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

/* ---------- Ekspor dan cadangan ---------- */

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Unduh seluruh pengajuan sebagai Excel, disusun sekarang juga.
 *
 * Susunan kolomnya sama persis dengan spreadsheet Google yang lama, supaya
 * hasilnya bisa langsung dipakai orang yang sudah terbiasa dengan bentuk itu.
 */
ruteAdmin.get('/ekspor', async (req, res, next) => {
  try {
    const isi = await buatBukuKerja();
    await logCatat({ aktor: bacaSesi(req)?.email ?? '', aksi: 'EKSPOR_EXCEL', rincian: '' });
    res.setHeader('Content-Type', MIME_XLSX);
    res.setHeader('Content-Disposition',
      `attachment; filename="simpel-${tanggalJakarta()}.xlsx"`);
    res.send(isi);
  } catch (e) { next(e); }
});

ruteAdmin.get('/cadangan', async (_req, res, next) => {
  try {
    res.json({ simpanHari: SIMPAN_HARI, daftar: await cadanganDaftar() });
  } catch (e) { next(e); }
});

/** Buat cadangan hari ini sekarang juga, menimpa yang sudah ada. */
ruteAdmin.post('/cadangan', async (req, res, next) => {
  try {
    const hasil = await cadanganJalankan(tanggalJakarta(), true);
    await logCatat({
      aktor: bacaSesi(req)?.email ?? '', aksi: 'CADANGAN_MANUAL', rincian: hasil.nama
    });
    res.json(hasil);
  } catch (e) { next(e); }
});

ruteAdmin.get('/cadangan/:nama', async (req, res, next) => {
  try {
    // jalurCadangan menolak nama yang tidak berpola, jadi '../' tidak pernah
    // sampai ke sendFile.
    let jalur: string;
    try {
      jalur = jalurCadangan(String(req.params.nama));
    } catch {
      throw new GalatKlien('Nama cadangan tidak sah.', 400);
    }
    if (!existsSync(jalur)) throw new GalatKlien('Cadangan tidak ditemukan.', 404);

    res.setHeader('Content-Type', MIME_XLSX);
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.nama}"`);
    res.sendFile(jalur);
  } catch (e) { next(e); }
});

/**
 * Cadangan penuh untuk pindah server: basis data, berkas unggahan, dan
 * petunjuk pemulihan dalam satu arsip.
 *
 * Sengaja tidak disimpan di disk seperti cadangan harian. Isinya memuat hash
 * kata sandi admin dan seluruh kode OPD; menaruhnya sebagai berkas yang
 * menetap di server justru menambah satu tempat lagi yang harus dijaga.
 */
ruteAdmin.get('/cadangan-penuh', async (req, res, next) => {
  try {
    const hasil = await buatCadanganPenuh();
    await logCatat({
      aktor: bacaSesi(req)?.email ?? '',
      aksi: 'CADANGAN_PENUH',
      rincian: `${hasil.nama} (${hasil.jumlahBerkas} berkas unggahan)`
    });
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${hasil.nama}"`);
    res.send(hasil.isi);
  } catch (e) { next(e); }
});
