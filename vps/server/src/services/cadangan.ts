/**
 * services/cadangan.ts - cadangan harian berbentuk Excel, disimpan 7 hari.
 *
 * Satu berkas per hari, dinamai menurut tanggalnya. Begitu jumlahnya lewat
 * tujuh, yang paling tua dihapus -- jadi ruang yang terpakai punya batas atas
 * yang jelas, hal yang penting di VPS 1 GB.
 *
 * Penjadwalnya sengaja bukan cron sistem melainkan pemeriksaan berkala di
 * dalam proses: ia menanyakan "apakah cadangan hari ini sudah ada?", bukan
 * "apakah sekarang tepat pukul 2 pagi". Bedanya terasa saat layanan sempat
 * mati atau dijalankan ulang saat penerapan -- cara ini tetap mengejar
 * ketinggalan, sedangkan pemicu berbasis jam akan melewatkan harinya diam-diam.
 */

import { mkdir, readdir, writeFile, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { buatBukuKerja } from './ekspor.js';

export const DIR_CADANGAN = process.env.DIR_CADANGAN ?? '/opt/simpel/cadangan';

/** Berapa hari cadangan disimpan sebelum yang tertua dibuang. */
export const SIMPAN_HARI = Number(process.env.CADANGAN_SIMPAN_HARI ?? 7);

const POLA_NAMA = /^simpel-(\d{4}-\d{2}-\d{2})\.xlsx$/;

/** Tanggal hari ini menurut waktu Jakarta, bukan waktu UTC server. */
export function tanggalJakarta(sekarang = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(sekarang);
}

export function namaCadangan(tanggal: string): string {
  return `simpel-${tanggal}.xlsx`;
}

export interface InfoCadangan {
  nama: string;
  tanggal: string;
  ukuran: number;
}

/** Daftar cadangan yang ada, terbaru lebih dulu. */
export async function cadanganDaftar(): Promise<InfoCadangan[]> {
  let isi: string[];
  try {
    isi = await readdir(DIR_CADANGAN);
  } catch {
    return [];   // folder belum pernah dibuat: belum ada cadangan, bukan galat
  }

  const hasil: InfoCadangan[] = [];
  for (const nama of isi) {
    const cocok = POLA_NAMA.exec(nama);
    if (!cocok) continue;
    try {
      const s = await stat(path.join(DIR_CADANGAN, nama));
      hasil.push({ nama, tanggal: cocok[1] as string, ukuran: s.size });
    } catch { /* terhapus di sela-sela pembacaan; abaikan saja */ }
  }
  // Nama berformat YYYY-MM-DD, jadi urutan teks sama dengan urutan waktu.
  return hasil.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

/**
 * Jalur penuh sebuah cadangan, dijaga agar tidak pernah keluar dari folder.
 *
 * Nama datang dari URL, jadi tanpa penjagaan ini `../../etc/passwd` akan
 * terbaca sebagai nama berkas yang sah.
 */
export function jalurCadangan(nama: string): string {
  if (!POLA_NAMA.test(nama)) throw new Error('Nama cadangan tidak sah.');
  return path.join(DIR_CADANGAN, nama);
}

/** Buang cadangan terlama sampai tersisa SIMPAN_HARI berkas. */
export async function cadanganRapikan(): Promise<string[]> {
  const ada = await cadanganDaftar();
  const dibuang = ada.slice(Math.max(SIMPAN_HARI, 1));
  for (const c of dibuang) {
    try { await unlink(path.join(DIR_CADANGAN, c.nama)); } catch { /* sudah hilang */ }
  }
  return dibuang.map((c) => c.nama);
}

export interface HasilCadangan {
  nama: string;
  ukuran: number;
  dilewati: boolean;
  dibuang: string[];
}

/**
 * Buat cadangan untuk satu tanggal, lalu rapikan yang lama.
 *
 * @param paksa tulis ulang meski cadangan hari itu sudah ada
 */
export async function cadanganJalankan(
  tanggal = tanggalJakarta(), paksa = false
): Promise<HasilCadangan> {
  await mkdir(DIR_CADANGAN, { recursive: true });

  const nama = namaCadangan(tanggal);
  const jalur = path.join(DIR_CADANGAN, nama);

  if (!paksa) {
    try {
      const s = await stat(jalur);
      return { nama, ukuran: s.size, dilewati: true, dibuang: [] };
    } catch { /* belum ada: lanjut membuat */ }
  }

  const isi = await buatBukuKerja();
  await writeFile(jalur, isi);
  const dibuang = await cadanganRapikan();

  return { nama, ukuran: isi.length, dilewati: false, dibuang };
}

const JAM = 60 * 60 * 1000;

/**
 * Nyalakan penjadwal cadangan harian.
 *
 * Diperiksa tiap jam. Sekali sehari yang benar-benar menulis berkas; sisanya
 * hanya memastikan berkas hari ini ada, dan itu murah -- satu panggilan stat.
 *
 * @returns fungsi untuk menghentikannya, dipakai uji
 */
export function jadwalkanCadangan(selangMs = JAM): () => void {
  let sedangJalan = false;

  const periksa = async () => {
    // Cadangan yang menumpuk akan saling menimpa dan memakan memori dua kali
    // lipat. Pada VPS 1 GB itu cukup untuk membuat systemd membunuh prosesnya.
    if (sedangJalan) return;
    sedangJalan = true;
    try {
      const hasil = await cadanganJalankan();
      if (!hasil.dilewati) {
        console.log(`[cadangan] ${hasil.nama} ditulis (${hasil.ukuran} bita)`
          + (hasil.dibuang.length ? `, dibuang: ${hasil.dibuang.join(', ')}` : ''));
      }
    } catch (galat) {
      // Kegagalan cadangan tidak boleh menjatuhkan layanan: pengajuan yang
      // masuk hari ini lebih penting daripada berkas cadangannya.
      console.error('[cadangan] gagal:', (galat as Error).message);
    } finally {
      sedangJalan = false;
    }
  };

  void periksa();
  const jam = setInterval(() => void periksa(), selangMs);
  jam.unref();   // jangan menahan proses tetap hidup saat hendak berhenti
  return () => clearInterval(jam);
}
