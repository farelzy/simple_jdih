/**
 * repo/log.ts - jejak audit.
 *
 * Kegagalan menulis log tidak boleh membatalkan pekerjaan yang sedang berjalan.
 * Kehilangan satu baris catatan jauh lebih ringan daripada kehilangan
 * pengajuan.
 */

import { kueri, jalankan } from '../db.js';

export interface BarisLog {
  waktu: string;
  aktor: string;
  aksi: string;
  pengajuan_id: number | null;
  rincian: string;
}

export async function logCatat(x: {
  aktor?: string; aksi: string; pengajuanId?: number | null; rincian?: string; ip?: string;
}): Promise<void> {
  try {
    await jalankan(
      `INSERT INTO log (waktu, aktor, aksi, pengajuan_id, rincian, ip)
       VALUES (NOW(), ?, ?, ?, ?, ?)`,
      [x.aktor ?? '', x.aksi, x.pengajuanId ?? null, x.rincian ?? '', x.ip ?? '']
    );
  } catch (galat) {
    console.error('[log] gagal mencatat:', (galat as Error).message);
  }
}

export async function logTerakhir(jumlah: number): Promise<BarisLog[]> {
  const n = Math.min(Math.max(Number(jumlah) || 100, 1), 500);
  return kueri<BarisLog>(
    `SELECT waktu, aktor, aksi, pengajuan_id, rincian
       FROM log ORDER BY id DESC LIMIT ${n}`
  );
}
