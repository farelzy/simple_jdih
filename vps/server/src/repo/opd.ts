/**
 * repo/opd.ts - daftar OPD baku.
 *
 * OPD dipilih dari daftar ini di form pengajuan, tidak diketik bebas. Inilah
 * yang menghentikan lima ejaan untuk satu instansi (`BPKAD`, `BPKAD `,
 * `BPKAD KAB. BREBES`, `BPKAD BREBES`, `BPKAD KABUPATEN BREBES`) berkembang
 * jadi delapan.
 */

import { kueri, satu, jalankan } from '../db.js';
import { normalisasiHeader } from '../murni/skema.js';

export interface Opd {
  id: number;
  kode: string;
  nama_resmi: string;
  nama_singkat: string;
  aktif: number;
}

export async function opdSemua(): Promise<Opd[]> {
  return kueri<Opd>(
    `SELECT id, kode, nama_resmi, nama_singkat, aktif FROM opd WHERE aktif = 1 ORDER BY nama_resmi`
  );
}

export async function opdTambah(kode: string, namaResmi: string, namaSingkat = ''): Promise<number> {
  const k = String(kode ?? '').trim().toUpperCase();
  const n = String(namaResmi ?? '').trim();
  if (!k || !n) throw new Error('Kode OPD dan nama resmi wajib diisi.');
  const hasil = await jalankan(
    `INSERT INTO opd (kode, nama_resmi, nama_singkat, aktif) VALUES (?,?,?,1)`,
    [k, n, String(namaSingkat ?? '').trim()]
  );
  return hasil.insertId;
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
