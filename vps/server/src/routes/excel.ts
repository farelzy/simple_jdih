/**
 * routes/excel.ts - migrasi dari berkas Excel yang diunggah.
 *
 * Dipasang dua kali, di /api/setup dan /api/admin, karena migrasi bisa
 * dijalankan dari wizard penyiapan maupun dari dashboard. Isinya sama persis,
 * jadi ditulis sekali di sini.
 *
 * Berkasnya dikirim sebagai bytes mentah di badan permintaan, bukan multipart —
 * mengikuti cara rute unggah berkas pengajuan, supaya tidak ada pengurai
 * multipart yang perlu dipelihara hanya untuk satu kolom.
 *
 * Berkasnya dikirim DUA kali: sekali untuk memeriksa, sekali untuk menjalankan.
 * Alternatifnya menyimpan hasil uraian di memori server dengan token, dan itu
 * berarti keadaan yang harus dibersihkan, dibatasi per IP, dan diuji
 * kedaluwarsanya. Berkasnya sendiri berukuran puluhan KB dan sudah ada di
 * komputer yang mengunggah; mengirimnya lagi jauh lebih murah daripada
 * memelihara keadaan itu.
 */

import { Router, type Request } from 'express';
import { wajibAdmin, bacaSesi } from '../middleware/auth.js';
import { GalatKlien } from '../middleware/galat.js';
import { excelKeBaris, bacaBadanBiner, GalatExcel } from '../services/baca-excel.js';
import { migrasiPeriksa, migrasiJalankan } from '../services/migrasi.js';

async function barisDariBadan(req: Request): Promise<string[][]> {
  try {
    return await excelKeBaris(await bacaBadanBiner(req));
  } catch (galat) {
    if (galat instanceof GalatExcel) throw new GalatKlien(galat.message);
    throw galat;
  }
}

export function ruteExcel(): Router {
  const r = Router();

  /** Baca berkas dan laporkan apa yang akan terjadi, tanpa menulis apa pun. */
  r.post('/excel/periksa', wajibAdmin, async (req, res, next) => {
    try {
      const baris = await barisDariBadan(req);
      res.json(await migrasiPeriksa({ sumber: '', baris, ujiCoba: true }));
    } catch (e) { next(e); }
  });

  /** Jalankan migrasi dari berkas. `?ujiCoba=0` menulis sungguhan. */
  r.post('/excel/migrasi', wajibAdmin, async (req, res, next) => {
    try {
      const baris = await barisDariBadan(req);
      res.json(await migrasiJalankan({
        sumber: '',
        baris,
        // Menulis sungguhan harus diminta secara tegas. Kalau parameternya
        // hilang atau salah eja, yang terjadi uji coba -- bukan penulisan.
        ujiCoba: String(req.query.ujiCoba ?? '1') !== '0',
        aktor: bacaSesi(req)?.email ?? 'admin'
      }));
    } catch (e) { next(e); }
  });

  return r;
}
