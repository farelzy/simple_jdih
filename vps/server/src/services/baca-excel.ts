/**
 * services/baca-excel.ts - membaca berkas Excel jadi baris teks.
 *
 * Jalur kedua untuk migrasi, di samping membaca spreadsheet lewat tautan.
 * Diperlukan karena tidak semua spreadsheet boleh dibuka lewat tautan: pada
 * sebagian instansi, membuka akses "siapa saja yang punya link" bukan
 * keputusan yang bisa diambil orang yang sedang memasang sistem ini. Mengunduh
 * berkasnya lalu mengunggahnya di sini tidak menuntut izin apa pun.
 *
 * Bagian yang paling mudah salah ada di nilaiSel. Sel Excel bukan teks: ia
 * bisa berupa tanggal, rumus, teks berformat, atau tautan -- dan tiap bentuk
 * itu punya cara sendiri untuk berubah jadi "[object Object]" kalau
 * dipaksakan lewat String().
 */

import ExcelJS from 'exceljs';
import type { Readable } from 'node:stream';
import { uraiCsv } from '../pure/csv.js';

/** Batas ukuran unggahan. Spreadsheet pengajuan nyata berukuran puluhan KB. */
export const MAKS_BITA = 15 * 1024 * 1024;

export class GalatExcel extends Error {
  constructor(pesan: string) {
    super(pesan);
    this.name = 'GalatExcel';
  }
}

/**
 * Satu sel jadi teks.
 *
 * Tanggal dibaca dengan penunjuk UTC, bukan waktu lokal. ExcelJS menyimpan
 * tanggal Excel sebagai tengah malam UTC; membacanya dengan getDate() di
 * server yang zonanya di belakang UTC menggeser tanggalnya mundur sehari, dan
 * seluruh lini masa hasil migrasi ikut meleset satu hari.
 *
 * Sel tautan mengembalikan alamatnya, bukan teks tampilannya. Kolom berkas di
 * spreadsheet lama berisi tautan Drive; yang perlu tersimpan adalah alamatnya.
 */
export function nilaiSel(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return '';

  if (nilai instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${nilai.getUTCFullYear()}-${p(nilai.getUTCMonth() + 1)}-${p(nilai.getUTCDate())} `
      + `${p(nilai.getUTCHours())}:${p(nilai.getUTCMinutes())}:${p(nilai.getUTCSeconds())}`;
  }

  if (typeof nilai === 'object') {
    const o = nilai as Record<string, unknown>;

    // Sel tautan: { text, hyperlink }
    if (typeof o.hyperlink === 'string') return o.hyperlink;

    // Teks berformat: { richText: [{ text }, ...] }
    if (Array.isArray(o.richText)) {
      return o.richText.map((b) => String((b as { text?: unknown }).text ?? '')).join('');
    }

    // Rumus: { formula, result }. Yang berguna hasilnya, bukan rumusnya.
    if ('result' in o) return nilaiSel(o.result);

    // Sel galat: { error: '#REF!' }. Dibiarkan terbaca apa adanya supaya
    // manusia yang memeriksanya tahu ada yang rusak di berkas asalnya.
    if (typeof o.error === 'string') return o.error;

    if ('text' in o) return String(o.text ?? '');

    return '';
  }

  return String(nilai);
}

/** Buang baris kosong di awal dan akhir; yang di tengah dibiarkan. */
function rapikan(baris: string[][]): string[][] {
  const kosong = (b: string[]) => b.every((s) => s.trim() === '');
  let awal = 0;
  let akhir = baris.length;
  while (awal < akhir && kosong(baris[awal] as string[])) awal++;
  while (akhir > awal && kosong(baris[akhir - 1] as string[])) akhir--;
  return baris.slice(awal, akhir);
}

/**
 * Berkas Excel jadi larik baris.
 *
 * Berkas .csv yang terlanjur diunggah ke sini tetap dilayani. Berkas Excel
 * adalah arsip zip dan selalu diawali 'PK'; yang bukan itu diperlakukan
 * sebagai teks CSV. Menolaknya hanya akan membuat orang bolak-balik mengubah
 * format untuk sesuatu yang sebenarnya sudah bisa dibaca.
 */
export async function excelKeBaris(isi: Buffer): Promise<string[][]> {
  if (isi.length === 0) throw new GalatExcel('Berkas kosong.');

  const zip = isi[0] === 0x50 && isi[1] === 0x4b;   // 'PK'
  if (!zip) return rapikan(uraiCsv(isi.toString('utf8')));

  const buku = new ExcelJS.Workbook();
  try {
    await buku.xlsx.load(isi as unknown as Parameters<typeof buku.xlsx.load>[0]);
  } catch {
    throw new GalatExcel(
      'Berkas tidak bisa dibaca sebagai Excel. Pastikan formatnya .xlsx '
      + '(bukan .xls lama), atau unduh spreadsheet-nya sebagai CSV lalu unggah itu.'
    );
  }

  const lembar = buku.worksheets[0];
  if (!lembar) throw new GalatExcel('Berkas Excel tidak punya lembar apa pun.');

  const jumlahKolom = lembar.columnCount;
  const baris: string[][] = [];

  // eachRow melewati baris kosong, dan itu menggeser nomor baris. Yang dipakai
  // di sini penelusuran berurut supaya baris kosong di tengah tetap terjaga
  // posisinya -- lini masa bertingkat di kolom 16 bergantung pada urutan baris.
  for (let r = 1; r <= lembar.rowCount; r++) {
    const b = lembar.getRow(r);
    const isiBaris: string[] = [];
    for (let k = 1; k <= jumlahKolom; k++) isiBaris.push(nilaiSel(b.getCell(k).value));
    baris.push(isiBaris);
  }

  return rapikan(baris);
}

/**
 * Baca badan permintaan mentah sampai batas ukuran.
 *
 * Ditolak begitu batasnya terlampaui, tanpa menunggu seluruh berkas terkirim.
 * Menampung dulu baru memeriksa berarti berkas 500 MB sempat memenuhi memori
 * proses -- dan pada VPS 1 GB, systemd akan membunuh layanannya lebih dulu.
 */
export async function bacaBadanBiner(aliran: Readable, maks = MAKS_BITA): Promise<Buffer> {
  const potongan: Buffer[] = [];
  let total = 0;

  for await (const p of aliran) {
    total += (p as Buffer).length;
    if (total > maks) {
      throw new GalatExcel(
        `Berkas melebihi batas ${Math.round(maks / 1024 / 1024)} MB.`
      );
    }
    potongan.push(p as Buffer);
  }
  return Buffer.concat(potongan);
}
