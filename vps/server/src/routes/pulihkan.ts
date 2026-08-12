/**
 * routes/pulihkan.ts - memulihkan sistem dari satu arsip cadangan penuh.
 *
 * Dipasang di /api/setup dan /api/admin, sama seperti rute unggah Excel:
 * pemulihan dipakai saat memasang di server baru maupun saat mengembalikan
 * keadaan di server yang sudah jalan.
 *
 * Keduanya dijaga wajibAdmin. Di server yang benar-benar kosong, admin
 * sementara dibuat lebih dulu lewat token penyiapan; begitu pemulihan selesai,
 * akun itu ikut tergantikan oleh akun dari cadangan.
 */

import { Router, type Request } from 'express';
import { wajibAdmin, bacaSesi } from '../middleware/auth.js';
import { GalatKlien } from '../middleware/galat.js';
import { bacaBadanBiner, GalatExcel } from '../services/baca-excel.js';
import { periksaArsip, pulihkanDariArsip, GalatPulihkan } from '../services/pulihkan.js';
import { logCatat } from '../repo/log.js';

/** Arsip memuat berkas unggahan, jadi batasnya jauh di atas batas Excel. */
const MAKS_ARSIP = 200 * 1024 * 1024;

async function badanArsip(req: Request): Promise<Buffer> {
  try {
    return await bacaBadanBiner(req, MAKS_ARSIP);
  } catch (galat) {
    if (galat instanceof GalatExcel) throw new GalatKlien(galat.message);
    throw galat;
  }
}

export function rutePulihkan(): Router {
  const r = Router();

  /** Baca arsip dan laporkan isinya, tanpa menyentuh apa pun. */
  r.post('/pulihkan/periksa', wajibAdmin, async (req, res, next) => {
    try {
      res.json(periksaArsip(await badanArsip(req)));
    } catch (e) { next(e); }
  });

  /**
   * Jalankan pemulihan. MENGHAPUS seluruh isi database lalu menggantinya.
   *
   * Dicatat ke log sebelum dan sesudah: baris "mulai" adalah satu-satunya
   * jejak yang tersisa kalau pemulihan gagal di tengah, dan justru saat itulah
   * jejaknya paling dibutuhkan.
   */
  r.post('/pulihkan', wajibAdmin, async (req, res, next) => {
    const aktor = bacaSesi(req)?.email ?? '';
    try {
      const isi = await badanArsip(req);
      await logCatat({ aktor, aksi: 'PULIHKAN_MULAI', rincian: `${isi.length} bita` });

      const hasil = await pulihkanDariArsip(isi);

      // Log ditulis SETELAH pemulihan, jadi baris ini masuk ke database yang
      // baru -- bukan ke database yang sudah tergantikan.
      await logCatat({
        aktor,
        aksi: 'PULIHKAN_SELESAI',
        rincian: `${hasil.pernyataanDijalankan} pernyataan, ${hasil.berkasDipulihkan} berkas`
      });
      res.json(hasil);
    } catch (galat) {
      if (galat instanceof GalatPulihkan) { next(new GalatKlien(galat.message)); return; }
      next(galat);
    }
  });

  return r;
}
