/**
 * pure/baris-ekspor.ts - menyusun baris ekspor berbentuk spreadsheet lama.
 *
 * Susunan kolomnya sengaja sama persis dengan spreadsheet Google yang selama
 * ini dipakai Bagian Hukum: 18 kolom form, lalu 5 kolom tambahan di kanannya.
 * Dengan begitu berkas hasil ekspor bisa langsung dibuka, dibaca, atau
 * ditempel oleh orang yang sudah terbiasa dengan bentuk lamanya -- dan kalau
 * suatu saat sistem ini ditinggalkan, datanya tidak terkurung di dalamnya.
 *
 * Fungsi murni tanpa I/O, jadi bentuk barisnya bisa diuji tanpa MariaDB.
 */

import { KOLOM_FORM, KOLOM_TAMBAHAN } from './skema.js';
import { susunKolomProses } from './parser-riwayat.js';

/** Judul kolom, berurutan, siap jadi baris pertama lembar. */
export const JUDUL_EKSPOR: readonly string[] = [
  ...KOLOM_FORM.map((k) => k.judul),
  ...KOLOM_TAMBAHAN.map((k) => k.judul)
];

export interface BerkasEkspor {
  kolom: string;
  sumber: 'lokal' | 'tautan';
  jalur: string;
  id: number;
}

export interface PengajuanEkspor {
  nomor: string;
  opd_teks: string;
  kode_opd: string;
  jenis_peraturan: string;
  judul: string;
  nama_pemohon: string;
  wa_pemohon: string;
  email_pemohon: string;
  status: string;
  keterangan: string;
  dibuat_pada: string;
  diperbarui_pada: string;
  diperbarui_oleh: string;
  riwayat: readonly { tanggal: string; keterangan: string }[];
  berkas: readonly BerkasEkspor[];
}

/**
 * Timestamp berbentuk `02/05/2026 10:00:00`, sama dengan yang ditulis Google
 * Form. Migrasi menerima bentuk ini maupun ISO, jadi hasil ekspor bisa
 * dimigrasikan balik ke sistem lain tanpa penyesuaian.
 */
export function formatTimestamp(nilai: unknown): string {
  const teks = String(nilai ?? '').trim();
  if (!teks) return '';
  const d = new Date(teks.includes('T') ? teks : teks.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return teks;

  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Alamat sebuah berkas.
 *
 * Berkas hasil migrasi menyimpan tautan Drive apa adanya dan dipakai langsung.
 * Berkas yang diunggah ke VPS hanya punya jalur internal, jadi ia disusun jadi
 * URL unduhan. `asal` diisi supaya URL-nya lengkap dan tetap bisa diklik dari
 * dalam Excel; tanpa itu yang tersimpan cuma jalur relatif yang tidak berguna
 * di luar peramban.
 */
export function alamatBerkas(b: BerkasEkspor, asal = ''): string {
  if (b.sumber === 'tautan') return b.jalur;
  return `${asal.replace(/\/+$/, '')}/api/unggah/${b.id}`;
}

/**
 * Satu baris ekspor, berurutan sesuai JUDUL_EKSPOR.
 *
 * Satu kolom berkas bisa memuat lebih dari satu berkas (mis. Lampiran).
 * Semuanya digabung dengan baris baru, bukan koma: koma muncul di dalam nama
 * berkas dan membuat isinya ambigu saat dibaca kembali.
 */
export function barisEkspor(p: PengajuanEkspor, asal = ''): (string | number)[] {
  const berkasPerKolom = new Map<string, string[]>();
  for (const b of p.berkas ?? []) {
    const daftar = berkasPerKolom.get(b.kolom) ?? [];
    daftar.push(alamatBerkas(b, asal));
    berkasPerKolom.set(b.kolom, daftar);
  }

  const nilai: Record<string, string> = {
    timestamp: formatTimestamp(p.dibuat_pada),
    opd: p.opd_teks ?? '',
    jenis_peraturan: p.jenis_peraturan ?? '',
    judul: p.judul ?? '',
    nama_pemohon: p.nama_pemohon ?? '',
    wa_pemohon: p.wa_pemohon ?? '',
    proses: susunKolomProses(p.riwayat ?? []),
    keterangan: p.keterangan ?? '',
    status: p.status ?? '',

    id: p.nomor ?? '',
    email_pemohon: p.email_pemohon ?? '',
    kode_opd: p.kode_opd ?? '',
    diperbarui_pada: formatTimestamp(p.diperbarui_pada),
    diperbarui_oleh: p.diperbarui_oleh ?? ''
  };

  return [...KOLOM_FORM, ...KOLOM_TAMBAHAN].map((k) => {
    if (k.kunci in nilai) return nilai[k.kunci] ?? '';
    // Sisanya kolom berkas. Yang kosong tetap ditulis sebagai sel kosong
    // supaya jumlah kolom tiap baris selalu sama.
    return (berkasPerKolom.get(k.kunci) ?? []).join('\n');
  });
}
