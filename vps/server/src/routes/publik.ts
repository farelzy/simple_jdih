/**
 * routes/publik.ts - monitoring dan detail, terbuka tanpa akun.
 *
 * Kedua sakelar keterbukaan diterapkan DI SERVER, bukan disaring di browser.
 * Menyaring di browser berarti datanya tetap terkirim dan bisa dibaca siapa pun
 * yang membuka panel jaringan.
 */

import { Router } from 'express';
import { pengajuanSemua, pengajuanCariNomor } from '../repo/pengajuan.js';
import { riwayatUntuk, riwayatTerakhirPerPengajuan } from '../repo/riwayat.js';
import { berkasUntuk } from '../repo/berkas.js';
import { pengaturanSemua, pengaturanBenar } from '../repo/pengaturan.js';
import { opdSemua, opdCariKode, normalisasiKode } from '../repo/opd.js';
import { logCatat } from '../repo/log.js';
import { batasKodeOpd } from '../middleware/rate-limit.js';
import { rekapPerStatus } from '../pure/rekap.js';
import { formatWa, samarkanWa } from '../pure/validasi.js';
import { TAHAP_RIWAYAT, STATUS_PENGAJUAN } from '../pure/skema.js';
import { bacaSesi } from '../middleware/auth.js';

export const rutePublik = Router();

function tanggalSaja(nilai: unknown): string {
  return String(nilai ?? '').slice(0, 10);
}

rutePublik.get('/konteks', async (_req, res, next) => {
  try {
    const pengaturan = await pengaturanSemua();
    const opd = await opdSemua();
    res.json({
      pengumuman: pengaturan.pengumuman ?? '',
      // `kode` sengaja dibuang di sini. Ia kunci masuk form pengajuan; kalau
      // ikut terkirim, seluruh kode terbaca siapa pun yang membuka rute ini
      // di peramban dan gerbangnya jadi hiasan.
      opd: opd.map((o) => ({ id: o.id, nama_resmi: o.nama_resmi, nama_singkat: o.nama_singkat })),
      tahap: TAHAP_RIWAYAT,
      status: STATUS_PENGAJUAN
    });
  } catch (e) { next(e); }
});

/**
 * Periksa kode OPD sebelum pemohon boleh mengisi form.
 *
 * Jawaban sukses hanya menyebut nama OPD-nya, supaya pemohon bisa memastikan
 * kodenya benar-benar milik instansinya. Jawaban gagal tidak pernah memberi
 * petunjuk soal kode yang benar.
 */
rutePublik.post('/opd/verifikasi', batasKodeOpd, async (req, res, next) => {
  try {
    const kode = normalisasiKode((req.body ?? {}).kode);
    const opd = kode ? await opdCariKode(kode) : null;

    if (!opd) {
      // Dicatat supaya Bagian Hukum bisa melihat kalau ada yang menebak-nebak.
      await logCatat({ aksi: 'KODE_OPD_SALAH', rincian: kode.slice(0, 32), ip: req.ip ?? '' });
      res.status(404).json({
        sah: false,
        galat: 'Kode OPD tidak dikenali. Hubungi Bagian Hukum Setda Kabupaten Brebes '
          + 'untuk menanyakan kode OPD Anda atau mendaftarkan OPD baru.'
      });
      return;
    }

    res.json({ sah: true, opd: { id: opd.id, nama_resmi: opd.nama_resmi, nama_singkat: opd.nama_singkat } });
  } catch (e) { next(e); }
});

rutePublik.get('/monitoring', async (req, res, next) => {
  try {
    const pengaturan = await pengaturanSemua();
    const admin = bacaSesi(req) !== null;
    const bolehWa = admin || pengaturanBenar(pengaturan, 'publik_tampilkan_wa');

    const semua = await pengajuanSemua();
    const terakhir = await riwayatTerakhirPerPengajuan();

    const daftar = semua.map((p) => {
      const t = terakhir.get(p.id);
      return {
        nomor: p.nomor,
        judul: p.judul,
        opd: p.opd_teks,
        jenis_peraturan: p.jenis_peraturan,
        status: p.status,
        keterangan: p.keterangan,
        masuk: tanggalSaja(p.dibuat_pada),
        diperbarui: tanggalSaja(p.diperbarui_pada),
        nama_pemohon: p.nama_pemohon,
        wa_pemohon: bolehWa ? formatWa(p.wa_pemohon) : samarkanWa(p.wa_pemohon),
        // email_pemohon sengaja TIDAK ikut: tidak ada alasan alamat surel
        // pemohon tersebar di halaman yang terbuka untuk umum.
        terakhir: t ? { tanggal: tanggalSaja(t.tanggal), tahap: t.tahap, keterangan: t.keterangan } : null
      };
    });

    const tahun = [...new Set(daftar.map((d) => d.masuk.slice(0, 4)).filter(Boolean))]
      .sort().reverse();

    res.json({ hitungan: rekapPerStatus(daftar), tahun, daftar });
  } catch (e) { next(e); }
});

rutePublik.get('/detail/:nomor', async (req, res, next) => {
  try {
    const p = await pengajuanCariNomor(String(req.params.nomor));
    if (!p) {
      res.status(404).json({ galat: 'Pengajuan tidak ditemukan.' });
      return;
    }

    const pengaturan = await pengaturanSemua();
    const admin = bacaSesi(req) !== null;
    const bolehBerkas = admin || pengaturanBenar(pengaturan, 'publik_tampilkan_berkas');
    const bolehWa = admin || pengaturanBenar(pengaturan, 'publik_tampilkan_wa');

    const riwayat = (await riwayatUntuk(p.id)).map((r) => ({
      tanggal: tanggalSaja(r.tanggal),
      tahap: r.tahap,
      keterangan: r.keterangan
    }));

    const berkas = bolehBerkas
      ? (await berkasUntuk(p.id)).map((b) => ({
          kolom: b.kolom, nama: b.nama, ukuran: b.ukuran,
          url: b.sumber === 'tautan' ? b.jalur : `/api/unggah/${b.id}`
        }))
      : [];

    res.json({
      ada: true,
      pengajuan: {
        nomor: p.nomor,
        judul: p.judul,
        opd: p.opd_teks,
        jenis_peraturan: p.jenis_peraturan,
        status: p.status,
        keterangan: p.keterangan,
        masuk: tanggalSaja(p.dibuat_pada),
        diperbarui: tanggalSaja(p.diperbarui_pada),
        nama_pemohon: p.nama_pemohon,
        wa_pemohon: bolehWa ? formatWa(p.wa_pemohon) : samarkanWa(p.wa_pemohon)
      },
      riwayat,
      berkas,
      boleh: { berkas: bolehBerkas, wa: bolehWa }
    });
  } catch (e) { next(e); }
});
