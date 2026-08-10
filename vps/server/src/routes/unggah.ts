/**
 * routes/unggah.ts - unggah berkas ke disk dan penyajiannya kembali.
 *
 * Berkas diunggah satu per satu ke draf yang hidup di memori selama pengisian
 * form, lalu baru dikaitkan ke pengajuan saat form dikirim. Draf yang tidak
 * pernah dikirim akan kedaluwarsa dan berkasnya dibersihkan, sehingga form yang
 * ditinggalkan di tengah jalan tidak meninggalkan sampah selamanya.
 */

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { GalatKlien } from '../middleware/galat.js';
import { batasUnggah } from '../middleware/rate-limit.js';
import { pengaturanSemua } from '../repo/pengaturan.js';
import { berkasUntuk } from '../repo/berkas.js';
import { validasiBerkas, ATURAN_BERKAS, ekstensiDari } from '../pure/validasi.js';
import { pengaturanBenar } from '../repo/pengaturan.js';
import { bacaSesi } from '../middleware/auth.js';
import { simpanAliran, hapusBerkas, jalurPenuh, adaBerkas, GalatUkuran } from '../services/simpanan.js';

const UMUR_DRAF_MS = 6 * 60 * 60 * 1000;   // 6 jam, cukup untuk satu sesi pengisian

export interface BerkasDraf {
  kolom: string;
  namaAsli: string;
  namaDisk: string;
  ukuran: number;
  mime: string;
}

interface Draf {
  dibuat: number;
  ip: string;
  berkas: BerkasDraf[];
}

const draf = new Map<string, Draf>();

/** Buang draf yang ditinggalkan beserta berkasnya. */
setInterval(() => {
  const batas = Date.now() - UMUR_DRAF_MS;
  for (const [id, d] of draf) {
    if (d.dibuat < batas) {
      for (const b of d.berkas) void hapusBerkas(b.namaDisk);
      draf.delete(id);
    }
  }
}, 30 * 60 * 1000).unref();

export function drafBaca(id: string): Draf {
  const d = draf.get(String(id ?? ''));
  if (!d) {
    throw new GalatKlien(
      'Draf pengajuan sudah kedaluwarsa. Muat ulang halaman lalu isi kembali.', 410
    );
  }
  return d;
}

export function drafHapus(id: string): void {
  draf.delete(String(id ?? ''));
}

/** Hanya untuk uji. */
export function _resetDraf(): void {
  draf.clear();
}

export const ruteUnggah = Router();

ruteUnggah.post('/draf', batasUnggah, (req, res) => {
  // Satu IP tidak boleh menumpuk draf tanpa batas; tiap draf memegang berkas
  // di disk sampai kedaluwarsa.
  let milikIp = 0;
  for (const d of draf.values()) if (d.ip === req.ip) milikIp++;
  if (milikIp >= 5) {
    res.status(429).json({ galat: 'Terlalu banyak draf terbuka. Selesaikan atau tunggu beberapa jam.' });
    return;
  }

  const id = randomUUID();
  draf.set(id, { dibuat: Date.now(), ip: req.ip ?? '', berkas: [] });
  res.json({ draf: id });
});

/**
 * Unggah satu berkas. Badan permintaan adalah bytes mentah; nama asli, kolom,
 * dan id draf dikirim lewat header supaya tidak perlu mengurai multipart.
 */
ruteUnggah.post('/berkas', batasUnggah, async (req, res, next) => {
  let namaDisk = '';
  try {
    const idDraf = String(req.header('x-draf') ?? '');
    const kolom = String(req.header('x-kolom') ?? '');
    const namaAsli = decodeURIComponent(String(req.header('x-nama') ?? ''));

    const d = drafBaca(idDraf);
    const aturan = ATURAN_BERKAS[kolom];
    if (!aturan) throw new GalatKlien('Kolom berkas tidak dikenali.', 400);

    const pengaturan = await pengaturanSemua();

    // Jenis diperiksa sebelum satu byte pun ditulis ke disk.
    const ekst = ekstensiDari(namaAsli);
    if (!aturan.ekstensi.includes(ekst)) {
      throw new GalatKlien(
        `Jenis berkas ${ekst ? '.' + ekst : 'tanpa ekstensi'} tidak diterima. ` +
        `Yang diterima: ${aturan.ekstensi.join(', ')}.`, 400
      );
    }

    const maks = Object.keys(ATURAN_BERKAS).length;
    if (d.berkas.length >= maks * 5) throw new GalatKlien('Terlalu banyak berkas dalam satu draf.', 400);

    const batasMb = Number(pengaturan[aturan.kunciBatas]) || 5;
    const batasByte = batasMb * 1024 * 1024;

    // Ditolak dari Content-Length sebelum satu byte pun dibaca.
    //
    // Memutus aliran di tengah jalan memang menghentikan penulisan, tapi klien
    // menerimanya sebagai ECONNRESET -- pemohon melihat "sambungan terputus",
    // bukan "melebihi batas 5 MB", lalu mencoba lagi dan gagal lagi tanpa tahu
    // sebabnya. Penolakan di sini memberi pesan yang bisa ditindaklanjuti.
    const panjang = Number(req.header('content-length') ?? 0);
    if (panjang > batasByte) {
      throw new GalatKlien(`Ukuran berkas melebihi batas ${batasMb} MB.`, 400);
    }

    // Penjaga aliran tetap dipasang sebagai lapis kedua: Content-Length datang
    // dari klien dan bisa berbohong.
    const hasil = await simpanAliran(req, namaAsli, batasByte);
    namaDisk = hasil.nama;

    // Diperiksa ulang setelah berkas benar-benar ada di disk. Ukuran yang
    // diklaim browser tidak bisa dipercaya.
    const periksa = validasiBerkas(
      { kolom, nama: namaAsli, ukuran: hasil.ukuran }, pengaturan
    );
    if (!periksa.sah) {
      await hapusBerkas(namaDisk);
      throw new GalatKlien(periksa.pesan, 400);
    }

    const berapaDiKolom = d.berkas.filter((b) => b.kolom === kolom).length;
    const maksBerkas = aturan.kunciMaksBerkas
      ? Number(pengaturan[aturan.kunciMaksBerkas]) || 5
      : 1;
    if (berapaDiKolom >= maksBerkas) {
      await hapusBerkas(namaDisk);
      throw new GalatKlien(`Kolom ini maksimal ${maksBerkas} berkas.`, 400);
    }

    d.berkas.push({
      kolom, namaAsli, namaDisk,
      ukuran: hasil.ukuran,
      mime: String(req.header('content-type') ?? 'application/octet-stream')
    });

    res.json({ namaDisk, nama: namaAsli, ukuran: hasil.ukuran, kolom });
  } catch (galat) {
    if (namaDisk) await hapusBerkas(namaDisk).catch(() => {});
    if (galat instanceof GalatUkuran) {
      next(new GalatKlien(galat.message, 400));
      return;
    }
    next(galat);
  }
});

ruteUnggah.delete('/berkas', batasUnggah, async (req, res, next) => {
  try {
    const idDraf = String(req.header('x-draf') ?? '');
    const namaDisk = String(req.header('x-berkas') ?? '');
    const d = drafBaca(idDraf);

    const i = d.berkas.findIndex((b) => b.namaDisk === namaDisk);
    if (i >= 0) {
      await hapusBerkas(namaDisk);
      d.berkas.splice(i, 1);
    }
    res.json({ sukses: true });
  } catch (e) { next(e); }
});

/**
 * Sajikan berkas yang tersimpan di disk.
 *
 * Sakelar keterbukaan ditegakkan di sini juga, bukan hanya di halaman detail --
 * kalau tidak, menyembunyikan tautan di halaman tidak ada artinya karena
 * alamatnya bisa ditebak.
 */
ruteUnggah.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new GalatKlien('Berkas tidak ditemukan.', 404);

    const { satu } = await import('../db.js');
    const b = await satu<{
      nama: string; sumber: string; jalur: string; mime: string; pengajuan_id: number;
    }>(`SELECT nama, sumber, jalur, mime, pengajuan_id FROM berkas WHERE id = ?`, [id]);

    if (!b) throw new GalatKlien('Berkas tidak ditemukan.', 404);
    if (b.sumber === 'tautan') { res.redirect(b.jalur); return; }

    const pengaturan = await pengaturanSemua();
    const admin = bacaSesi(req) !== null;
    if (!admin && !pengaturanBenar(pengaturan, 'publik_tampilkan_berkas')) {
      throw new GalatKlien('Berkas ini hanya bisa dibuka oleh Bagian Hukum.', 403);
    }

    if (!(await adaBerkas(b.jalur))) {
      throw new GalatKlien('Berkas tidak ada lagi di penyimpanan.', 404);
    }

    res.setHeader('Content-Type', b.mime || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(b.nama)}`
    );
    createReadStream(jalurPenuh(b.jalur)).pipe(res);
  } catch (e) { next(e); }
});

/** Dipakai uji dan pengiriman form. */
export { berkasUntuk };
