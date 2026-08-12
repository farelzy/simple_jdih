/**
 * services/pulihkan.ts - memulihkan sistem dari satu arsip cadangan penuh.
 *
 * Inilah pasangan dari cadangan-penuh.ts, dan operasi paling berbahaya di
 * seluruh sistem: ia MENGHAPUS seluruh isi database lalu menggantinya. Karena
 * itu urutannya dijaga ketat:
 *
 *   1. arsip dibongkar dan diperiksa lengkap-tidaknya SEBELUM apa pun disentuh
 *   2. keadaan sekarang disalin lebih dulu ke folder cadangan
 *   3. baru database ditimpa, lalu berkas ditulis
 *
 * Langkah 1 dan 2 ada karena kegagalan di tengah pemulihan adalah keadaan
 * terburuk yang mungkin: data lama sudah hilang, data baru belum masuk.
 */

import { gunzipSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../db.js';
import { bacaTar, type EntriTar } from '../pure/tar.js';
import { pisahPernyataanSql } from '../pure/sql.js';
import { DIR_BERKAS } from './simpanan.js';
import { DIR_CADANGAN } from './cadangan.js';
import { buatCadanganPenuh } from './cadangan-penuh.js';

export class GalatPulihkan extends Error {
  constructor(pesan: string) {
    super(pesan);
    this.name = 'GalatPulihkan';
  }
}

export interface HasilPulihkan {
  pernyataanDijalankan: number;
  berkasDipulihkan: number;
  tabel: string[];
  cadanganSebelumnya: string;
}

/** Nama entri wajib di dalam arsip. */
const BERKAS_DUMP = 'basis-data.sql';

/**
 * Bongkar arsip, gzip maupun tar polos.
 *
 * Keduanya diterima karena orang akan mengekstrak sebagian lalu memampatkan
 * ulang, dan menolak salah satunya hanya membuat pemulihan gagal untuk alasan
 * yang tidak ada hubungannya dengan datanya.
 */
export function bongkarArsip(isi: Buffer): EntriTar[] {
  if (isi.length === 0) throw new GalatPulihkan('Berkas cadangan kosong.');

  let tar = isi;
  if (isi[0] === 0x1f && isi[1] === 0x8b) {          // penanda gzip
    try {
      tar = gunzipSync(isi);
    } catch {
      throw new GalatPulihkan('Berkas gzip rusak dan tidak bisa dibuka.');
    }
  }

  try {
    return bacaTar(tar);
  } catch (galat) {
    throw new GalatPulihkan((galat as Error).message);
  }
}

/** Pernyataan dump yang siap dijalankan, dari arsip yang sudah dibongkar. */
function ambilDump(entri: readonly EntriTar[]): string {
  const dump = entri.find((e) => e.nama === BERKAS_DUMP);
  if (!dump) {
    throw new GalatPulihkan(
      `Arsip tidak memuat ${BERKAS_DUMP}, jadi ini bukan cadangan penuh SIMPEL. `
      + 'Pastikan yang diunggah berkas hasil tombol "Unduh cadangan penuh".'
    );
  }
  const teks = dump.isi.toString('utf8');
  if (!/CREATE TABLE/i.test(teks)) {
    throw new GalatPulihkan(`${BERKAS_DUMP} tidak memuat struktur tabel; arsipnya tidak utuh.`);
  }
  return teks;
}

/**
 * Pulihkan seluruh sistem dari isi arsip.
 *
 * @param isi bytes arsip .tar.gz hasil tombol "Unduh cadangan penuh"
 */
export async function pulihkanDariArsip(isi: Buffer): Promise<HasilPulihkan> {
  // --- 1. Periksa dulu, jangan sentuh apa pun ---
  const entri = bongkarArsip(isi);
  const dump = ambilDump(entri);
  const pernyataan = pisahPernyataanSql(dump);
  if (pernyataan.length === 0) {
    throw new GalatPulihkan(`${BERKAS_DUMP} tidak berisi pernyataan apa pun.`);
  }

  const berkas = entri.filter((e) => e.nama.startsWith('berkas/') && e.nama !== 'berkas/');
  const tabel = [...new Set(
    [...dump.matchAll(/CREATE TABLE `([^`]+)`/gi)].map((m) => m[1] as string)
  )];

  // --- 2. Salin keadaan sekarang, supaya masih ada jalan pulang ---
  let cadanganSebelumnya = '';
  try {
    const sebelum = await buatCadanganPenuh();
    await mkdir(DIR_CADANGAN, { recursive: true });
    // Namanya sengaja di luar pola cadangan harian, supaya tidak ikut terbuang
    // saat rotasi tujuh hari. Ini justru berkas yang paling ingin disimpan.
    cadanganSebelumnya = `sebelum-pulih-${sebelum.nama.replace(/^simpel-penuh-/, '')}`;
    await writeFile(path.join(DIR_CADANGAN, cadanganSebelumnya), sebelum.isi);
  } catch (galat) {
    throw new GalatPulihkan(
      'Gagal menyalin keadaan sekarang sebelum memulihkan, jadi pemulihan dibatalkan '
      + 'daripada menghapus data tanpa jalan kembali. Alasan: ' + (galat as Error).message
    );
  }

  // --- 3. Timpa database ---
  const conn = await pool.getConnection();
  let dijalankan = 0;
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const p of pernyataan) {
      // SET FOREIGN_KEY_CHECKS di dalam dump dilewati: yang mengatur urutannya
      // blok ini, dan menyalakannya kembali di tengah membuat DROP TABLE
      // berikutnya gagal karena tabel lain masih merujuknya.
      if (/^SET\s+FOREIGN_KEY_CHECKS/i.test(p)) continue;
      if (/^SET\s+NAMES/i.test(p)) continue;
      await conn.query(p);
      dijalankan++;
    }
  } catch (galat) {
    throw new GalatPulihkan(
      `Pemulihan gagal pada pernyataan ke-${dijalankan + 1}: ${(galat as Error).message}. `
      + `Keadaan sebelumnya tersimpan sebagai ${cadanganSebelumnya} di folder cadangan.`
    );
  } finally {
    try { await conn.query('SET FOREIGN_KEY_CHECKS = 1'); } catch { /* sambungan sudah tutup */ }
    conn.release();
  }

  // --- 4. Kembalikan berkas unggahan ---
  //
  // Setelah database, bukan sebelumnya: berkas tanpa baris di tabel `berkas`
  // hanyalah sampah di disk, sedangkan baris tanpa berkas membuat halaman
  // detail menunjuk berkas yang belum ada. Yang kedua lebih membingungkan.
  let ditulis = 0;
  if (berkas.length) {
    await mkdir(DIR_BERKAS, { recursive: true });
    for (const b of berkas) {
      const nama = path.basename(b.nama);
      if (!nama || nama === '.' || nama === '..') continue;
      await writeFile(path.join(DIR_BERKAS, nama), b.isi);
      ditulis++;
    }
  }

  return {
    pernyataanDijalankan: dijalankan,
    berkasDipulihkan: ditulis,
    tabel,
    cadanganSebelumnya
  };
}

/**
 * Periksa arsip tanpa menyentuh apa pun.
 *
 * Dipakai tombol "Periksa" supaya orang tahu apa yang akan terjadi sebelum
 * menekan tombol yang menghapus seluruh data.
 */
export function periksaArsip(isi: Buffer): {
  sah: boolean;
  pesan: string;
  tabel?: string[];
  jumlahBerkas?: number;
  dibuat?: string;
} {
  try {
    const entri = bongkarArsip(isi);
    const dump = ambilDump(entri);
    const tabel = [...new Set(
      [...dump.matchAll(/CREATE TABLE `([^`]+)`/gi)].map((m) => m[1] as string)
    )];
    const jumlahBerkas = entri.filter((e) => e.nama.startsWith('berkas/')).length;
    const dibuat = /^-- Dibuat: (.+)$/m.exec(dump)?.[1] ?? '';

    return {
      sah: true,
      tabel,
      jumlahBerkas,
      dibuat,
      pesan: `Cadangan sah: ${tabel.length} tabel dan ${jumlahBerkas} berkas unggahan.`
    };
  } catch (galat) {
    return { sah: false, pesan: (galat as Error).message };
  }
}
