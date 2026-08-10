/**
 * repo/opd.ts - daftar OPD baku.
 *
 * Nama OPD pada pengajuan diambil dari baris di sini, tidak pernah diketik
 * pemohon. Inilah yang menghentikan lima ejaan untuk satu instansi (`BPKAD`,
 * `BPKAD `, `BPKAD KAB. BREBES`, `BPKAD BREBES`, `BPKAD KABUPATEN BREBES`)
 * berkembang jadi delapan.
 *
 * `kode` merangkap dua peran: pengenal pendek bagi Bagian Hukum, sekaligus
 * kunci masuk form pengajuan. Karena itu ia tidak pernah ikut dalam jawaban
 * rute publik -- lihat routes/publik.ts.
 */

import { kueri, satu, jalankan } from '../db.js';
import { normalisasiHeader } from '../pure/skema.js';

export interface Opd {
  id: number;
  kode: string;
  nama_resmi: string;
  nama_singkat: string;
  aktif: number;
}

/**
 * Bentuk baku sebuah kode OPD.
 *
 * Kode diketik manusia dari catatan atau pesan WhatsApp, jadi spasi nyasar dan
 * huruf kecil harus dianggap sama. Yang TIDAK dilonggarkan: karakter lain.
 * `BPKAD-1` dan `BPKAD1` tetap dua kode berbeda.
 */
export function normalisasiKode(kode: unknown): string {
  return String(kode ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export async function opdSemua(): Promise<Opd[]> {
  return kueri<Opd>(
    `SELECT id, kode, nama_resmi, nama_singkat, aktif FROM opd WHERE aktif = 1 ORDER BY nama_resmi`
  );
}

/**
 * Cari OPD dari kodenya. Inilah gerbang form pengajuan.
 *
 * Hanya OPD aktif yang cocok: menonaktifkan OPD lewat dashboard sekaligus
 * mencabut kemampuannya mengirim pengajuan baru, tanpa langkah kedua yang
 * bisa terlupakan.
 */
export async function opdCariKode(kode: unknown): Promise<Opd | null> {
  const k = normalisasiKode(kode);
  if (!k) return null;
  return satu<Opd>(
    `SELECT id, kode, nama_resmi, nama_singkat, aktif FROM opd WHERE kode = ? AND aktif = 1`,
    [k]
  );
}

export async function opdTambah(kode: string, namaResmi: string, namaSingkat = ''): Promise<number> {
  const k = normalisasiKode(kode);
  const n = String(namaResmi ?? '').trim();
  if (!k || !n) throw new Error('Kode OPD dan nama resmi wajib diisi.');
  const hasil = await jalankan(
    `INSERT INTO opd (kode, nama_resmi, nama_singkat, aktif) VALUES (?,?,?,1)`,
    [k, n, String(namaSingkat ?? '').trim()]
  );
  return hasil.insertId;
}

/**
 * Ganti kode sebuah OPD.
 *
 * Dipakai saat kode bocor -- mengganti kode langsung memutus siapa pun yang
 * terlanjur memegangnya, tanpa menyentuh pengajuan yang sudah masuk.
 */
export async function opdUbahKode(id: number, kode: string): Promise<void> {
  const k = normalisasiKode(kode);
  if (!k) throw new Error('Kode OPD tidak boleh kosong.');
  if (k.length > 32) throw new Error('Kode OPD paling panjang 32 karakter.');
  const hasil = await jalankan(`UPDATE opd SET kode = ? WHERE id = ?`, [k, Number(id)]);
  if (hasil.affectedRows === 0) throw new Error('OPD tidak ditemukan.');
}

export async function opdNonaktifkan(id: number): Promise<void> {
  await jalankan(`UPDATE opd SET aktif = 0 WHERE id = ?`, [id]);
}

/**
 * Cocokkan nama OPD yang diketik bebas ke baris daftar baku.
 *
 * Dipakai migrasi untuk memetakan lima ejaan BPKAD ke satu OPD. Pencocokan
 * bertingkat: persis dulu, baru awalan. Yang tidak ketemu dikembalikan null
 * supaya dilaporkan ke manusia, bukan ditebak diam-diam.
 */
export async function opdCocokkan(nama: string): Promise<number | null> {
  const cari = normalisasiHeader(nama);
  if (!cari) return null;

  const semua = await opdSemua();

  for (const o of semua) {
    for (const kandidat of [o.kode, o.nama_resmi, o.nama_singkat]) {
      if (kandidat && normalisasiHeader(kandidat) === cari) return o.id;
    }
  }

  // 'bpkad kabupaten brebes' harus mengarah ke OPD berkode 'BPKAD'.
  for (const o of semua) {
    for (const kandidat of [o.kode, o.nama_singkat, o.nama_resmi]) {
      const k = normalisasiHeader(kandidat);
      if (k && cari.startsWith(k)) return o.id;
    }
  }

  return null;
}

export async function opdCariId(id: number): Promise<Opd | null> {
  return satu<Opd>(`SELECT id, kode, nama_resmi, nama_singkat, aktif FROM opd WHERE id = ?`, [id]);
}
