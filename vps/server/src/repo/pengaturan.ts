/**
 * repo/pengaturan.ts - batas ukuran, sakelar keterbukaan, teks pengumuman.
 *
 * Semuanya di database, bukan di kode, supaya Bagian Hukum bisa mengubahnya
 * tanpa deploy ulang.
 */

import { kueri, jalankan } from '../db.js';

/** Batas yang tidak boleh dilampaui berapa pun isi pengaturannya. Jalur unggah
 *  memang tidak sanggup melayani lebih dari ini, dan memaksakannya hanya
 *  membuat pemohon menunggu lama lalu gagal di tengah. */
export const BATAS_MAKS_MB = 30;

export async function pengaturanSemua(): Promise<Record<string, string>> {
  const baris = await kueri<{ kunci: string; nilai: string }>(
    `SELECT kunci, nilai FROM pengaturan`
  );
  const peta: Record<string, string> = {};
  for (const b of baris) peta[b.kunci] = b.nilai ?? '';
  return peta;
}

export async function pengaturanSetel(kunci: string, nilai: string): Promise<void> {
  const k = String(kunci ?? '').trim();
  if (!k) throw new Error('Kunci pengaturan kosong.');

  if (k.startsWith('batas_')) {
    const angka = Number(nilai);
    if (!Number.isFinite(angka) || angka <= 0) {
      throw new Error('Batas ukuran harus berupa angka lebih dari 0.');
    }
    if (angka > BATAS_MAKS_MB) {
      throw new Error(`Batas ukuran maksimal ${BATAS_MAKS_MB} MB.`);
    }
  }

  if (k.startsWith('publik_')) {
    const v = String(nilai ?? '').trim().toUpperCase();
    if (v !== 'TRUE' && v !== 'FALSE') {
      throw new Error('Sakelar hanya menerima TRUE atau FALSE.');
    }
  }

  await jalankan(
    `INSERT INTO pengaturan (kunci, nilai) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`,
    [k, String(nilai ?? '')]
  );
}

export function pengaturanBenar(peta: Record<string, string>, kunci: string): boolean {
  const nilai = String(peta?.[kunci] ?? '').trim().toUpperCase();
  return nilai === 'TRUE' || nilai === 'YA' || nilai === '1';
}
