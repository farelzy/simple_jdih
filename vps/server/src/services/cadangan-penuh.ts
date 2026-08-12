/**
 * services/cadangan-penuh.ts - cadangan untuk pindah server.
 *
 * Berbeda maksud dengan cadangan harian. Yang harian berisi data yang bisa
 * dibaca manusia di Excel; yang ini berisi segalanya yang dibutuhkan untuk
 * menghidupkan sistem yang sama persis di mesin lain: isi seluruh tabel,
 * berkas yang diunggah OPD, dan petunjuk pemulihannya.
 *
 * Dump SQL disusun sendiri, bukan memanggil mysqldump. Alasannya bukan gaya:
 * mysqldump belum tentu terpasang di mesin yang menjalankan ini, dan
 * memanggilnya berarti menaruh kata sandi database di baris perintah -- yang
 * terbaca siapa pun yang menjalankan `ps` pada detik itu.
 */

import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pool, kueri } from '../db.js';
import { susunTar, type EntriTar } from '../pure/tar.js';
import { DIR_BERKAS } from './simpanan.js';
import { buatBukuKerja } from './ekspor.js';
import { tanggalJakarta } from './cadangan.js';

/**
 * Urutan tabel mengikuti ketergantungan kunci asing: yang dirujuk lebih dulu.
 * Pemulihan tetap mematikan pemeriksaan kunci asing, tapi urutan yang benar
 * membuat dump-nya juga bisa dipakai sepotong-sepotong.
 */
const TABEL = ['opd', 'admin', 'pengaturan', 'pengajuan', 'riwayat', 'berkas', 'log'] as const;

function bariskan(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return 'NULL';
  if (nilai instanceof Date) return pool.escape(nilai) as string;
  if (Buffer.isBuffer(nilai)) return `X'${nilai.toString('hex')}'`;
  return pool.escape(nilai) as string;
}

/** Berapa baris digabung dalam satu INSERT. Menahan panjang pernyataan. */
const PER_SISIP = 200;

/**
 * Seluruh isi database sebagai satu berkas .sql yang bisa dijalankan ulang.
 *
 * DROP TABLE disertakan supaya pemulihan ke database yang sudah berisi tidak
 * menggabungkan data lama dengan data cadangan diam-diam -- salah satu cara
 * paling halus untuk merusak data saat pindah server.
 */
export async function dumpSql(): Promise<string> {
  const bagian: string[] = [
    '-- Cadangan basis data SIMPEL Hukum Brebes',
    `-- Dibuat: ${new Date().toISOString()}`,
    '--',
    '-- Pulihkan dengan:  mysql -u <pengguna> -p <nama_database> < basis-data.sql',
    '',
    'SET NAMES utf8mb4;',
    'SET FOREIGN_KEY_CHECKS = 0;',
    ''
  ];

  for (const tabel of TABEL) {
    const buatan = await kueri<Record<string, string>>(`SHOW CREATE TABLE \`${tabel}\``);
    const ddl = buatan[0]?.['Create Table'];
    if (!ddl) continue;

    bagian.push(`-- ---------- ${tabel} ----------`);
    bagian.push(`DROP TABLE IF EXISTS \`${tabel}\`;`);
    bagian.push(`${ddl};`);
    bagian.push('');

    const baris = await kueri<Record<string, unknown>>(`SELECT * FROM \`${tabel}\``);
    if (baris.length === 0) { bagian.push(''); continue; }

    const kolom = Object.keys(baris[0] as object);
    const daftarKolom = kolom.map((k) => `\`${k}\``).join(', ');

    for (let i = 0; i < baris.length; i += PER_SISIP) {
      const nilai = baris.slice(i, i + PER_SISIP)
        .map((b) => `(${kolom.map((k) => bariskan(b[k])).join(', ')})`)
        .join(',\n  ');
      bagian.push(`INSERT INTO \`${tabel}\` (${daftarKolom}) VALUES\n  ${nilai};`);
    }
    bagian.push('');
  }

  bagian.push('SET FOREIGN_KEY_CHECKS = 1;', '');
  return bagian.join('\n');
}

/** Berkas unggahan OPD yang ada di disk, siap dimasukkan ke arsip. */
async function berkasUnggahan(): Promise<EntriTar[]> {
  let isi: string[];
  try {
    isi = await readdir(DIR_BERKAS);
  } catch {
    return [];   // folder belum pernah dibuat: memang belum ada unggahan
  }

  const entri: EntriTar[] = [];
  for (const nama of isi) {
    const jalur = path.join(DIR_BERKAS, nama);
    try {
      const s = await stat(jalur);
      if (!s.isFile()) continue;
      entri.push({ nama: `berkas/${nama}`, isi: await readFile(jalur) });
    } catch { /* terhapus di sela-sela pembacaan; abaikan */ }
  }
  return entri;
}

function petunjukPemulihan(jumlahBerkas: number, tanggal: string): string {
  return [
    'CADANGAN PENUH SIMPEL HUKUM BREBES',
    `Dibuat: ${tanggal}`,
    '',
    'PERINGATAN',
    '  Berkas ini memuat hash kata sandi admin dan seluruh kode OPD.',
    '  Kode OPD adalah kunci masuk form pengajuan. Simpan seperti Anda',
    '  menyimpan kata sandi: jangan diunggah ke tempat yang bisa dibaca umum.',
    '',
    'ISI',
    '  basis-data.sql   seluruh tabel, berikut struktur dan datanya',
    `  berkas/          ${jumlahBerkas} berkas yang diunggah OPD`,
    '  pengajuan.xlsx   salinan yang bisa dibaca manusia, untuk berjaga-jaga',
    '',
    'MEMULIHKAN KE SERVER BARU',
    '  1. Pasang Node 22 dan MariaDB, lalu salin kode SIMPEL ke /opt/simpel.',
    '',
    '  2. Buat database dan penggunanya:',
    "       CREATE DATABASE simpel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "       CREATE USER 'simpel'@'localhost' IDENTIFIED BY '<sandi baru>';",
    "       GRANT ALL ON simpel.* TO 'simpel'@'localhost';",
    '',
    '  3. Pulihkan datanya:',
    '       mysql -u simpel -p simpel < basis-data.sql',
    '',
    '  4. Kembalikan berkas unggahan:',
    '       cp -a berkas/. /opt/simpel/berkas/',
    '',
    '  5. Susun .env baru dari .env.contoh. Yang WAJIB dibawa dari server lama:',
    '       JWT_SECRET   -- kalau berubah, semua sesi admin terputus (tidak fatal)',
    '     Yang harus disesuaikan: DB_PASSWORD, BASE_URL, DIR_BERKAS, DIR_CADANGAN.',
    '',
    '  6. Jalankan layanannya. Skema dibuat sendiri saat pertama hidup, jadi',
    '     langkah 3 boleh dijalankan sebelum maupun sesudahnya.',
    '',
    'YANG TIDAK IKUT',
    '  Berkas yang di kolomnya bersumber "tautan" tidak ada di sini -- itu',
    '  tautan Google Drive milik spreadsheet lama, dan berkasnya tetap tinggal',
    '  di Drive. Yang tersalin hanya berkas yang diunggah lewat SIMPEL.',
    ''
  ].join('\n');
}

export interface HasilCadanganPenuh {
  nama: string;
  isi: Buffer;
  jumlahBerkas: number;
}

/**
 * Satu arsip .tar.gz berisi database, berkas unggahan, dan petunjuk pemulihan.
 *
 * Disusun di memori. Untuk data sebesar ini (basis data ratusan KB, berkas
 * puluhan MB) itu masih jauh di bawah batas memori layanan; kalau suatu saat
 * unggahan tumbuh sampai ratusan MB, bagian inilah yang harus diubah jadi
 * aliran.
 */
export async function buatCadanganPenuh(): Promise<HasilCadanganPenuh> {
  const tanggal = tanggalJakarta();
  const waktu = Math.floor(Date.now() / 1000);

  const berkas = await berkasUnggahan();
  const entri: EntriTar[] = [
    { nama: 'PEMULIHAN.txt', isi: Buffer.from(petunjukPemulihan(berkas.length, tanggal), 'utf8') },
    { nama: 'basis-data.sql', isi: Buffer.from(await dumpSql(), 'utf8') },
    { nama: 'pengajuan.xlsx', isi: await buatBukuKerja() },
    ...berkas
  ].map((e) => ({ ...e, waktu }));

  const tar = susunTar(entri, waktu);

  const potongan: Buffer[] = [];
  await pipeline(
    Readable.from(tar),
    createGzip(),
    async function* (aliran) { for await (const p of aliran) potongan.push(p as Buffer); }
  );

  return {
    nama: `simpel-penuh-${tanggal}.tar.gz`,
    isi: Buffer.concat(potongan),
    jumlahBerkas: berkas.length
  };
}
