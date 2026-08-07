/**
 * tengah/rate-limit.ts - pembatas laju berbasis memori proses.
 *
 * Form pengajuan terbuka ke internet tanpa akun, jadi tanpa pembatas ini satu
 * skrip iseng bisa membanjiri Drive Bagian Hukum sampai kuota 15 GB habis.
 *
 * Disimpan di memori, bukan database: pada satu proses tunggal ini sudah cukup,
 * dan menulis satu baris ke MariaDB untuk tiap permintaan justru menambah beban
 * yang hendak dicegah.
 */

import type { Request, Response, NextFunction } from 'express';

interface Jendela {
  hitungan: number;
  mulai: number;
}

function buatPembatas(nama: string, maks: number, jendelaMs: number) {
  const catatan = new Map<string, Jendela>();

  // Bersihkan jejak lama supaya peta tidak tumbuh selamanya.
  setInterval(() => {
    const sekarang = Date.now();
    for (const [kunci, j] of catatan) {
      if (sekarang - j.mulai > jendelaMs) catatan.delete(kunci);
    }
  }, jendelaMs).unref();

  return function pembatas(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip ?? 'tanpa-ip';
    const sekarang = Date.now();
    const j = catatan.get(ip);

    if (!j || sekarang - j.mulai > jendelaMs) {
      catatan.set(ip, { hitungan: 1, mulai: sekarang });
      next();
      return;
    }

    j.hitungan++;
    if (j.hitungan > maks) {
      const sisaDetik = Math.ceil((jendelaMs - (sekarang - j.mulai)) / 1000);
      res.setHeader('Retry-After', String(sisaDetik));
      res.status(429).json({
        galat: `Terlalu banyak permintaan. Coba lagi dalam ${Math.ceil(sisaDetik / 60)} menit.`
      });
      console.warn(`[rate-limit] ${nama} menolak ${ip} (${j.hitungan}/${maks})`);
      return;
    }
    next();
  };
}

const MENIT = 60_000;
const JAM = 60 * MENIT;

/** Pengajuan baru: 5 per jam per IP. */
export const batasKirim = buatPembatas('kirim', 5, JAM);

/** Percobaan masuk: 10 per 15 menit per IP, memperlambat tebak sandi. */
export const batasMasuk = buatPembatas('masuk', 10, 15 * MENIT);

/** Permintaan unggah: 60 per jam per IP, cukup untuk 9 kolom berkas. */
export const batasUnggah = buatPembatas('unggah', 60, JAM);
