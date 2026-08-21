/**
 * repo/riwayat.ts - lini masa terstruktur.
 *
 * Menggantikan kolom 16 yang selama ini diketik tangan sebagai teks bebas.
 * Bentuk terstruktur inilah yang membuat pertanyaan seperti "berapa berkas yang
 * sedang menunggu fasilitasi Biro Hukum Jateng" bisa dijawab seketika.
 */

import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { kueri, jalankan } from '../db.js';
// Lihat catatan yang sama di repo/admin.ts: salah pilih tahap itu salah pakai,
// bukan kerusakan server. Tanpa GalatKlien, penolakannya tertelan tangkapGalat
// dan admin hanya melihat "Terjadi kesalahan di server".
import { GalatKlien } from '../middleware/galat.js';
import { TAHAP_RIWAYAT } from '../pure/skema.js';
import { stasiunTercapai } from '../pure/tahap.js';
import { pengajuanSentuh } from './pengajuan.js';

export interface Riwayat {
  id: number;
  pengajuan_id: number;
  tanggal: string;
  tahap: string;
  keterangan: string;
  dicatat_oleh: string;
  dicatat_pada: string;
}

export interface RiwayatBaru {
  tanggal: string;
  tahap: string;
  keterangan: string;
}

const KOLOM = `id, pengajuan_id, tanggal, tahap, keterangan, dicatat_oleh, dicatat_pada`;

export async function riwayatUntuk(pengajuanId: number): Promise<Riwayat[]> {
  return kueri<Riwayat>(
    `SELECT ${KOLOM} FROM riwayat WHERE pengajuan_id = ? ORDER BY tanggal ASC, id ASC`,
    [pengajuanId]
  );
}

/** Dipakai bersama oleh tambah dan ubah, supaya keduanya tidak bisa berbeda. */
function periksaIsi(isi: RiwayatBaru): void {
  if (!(TAHAP_RIWAYAT as readonly string[]).includes(isi.tahap)) {
    throw new GalatKlien(`Tahap "${isi.tahap}" tidak dikenali.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isi.tanggal ?? ''))) {
    throw new GalatKlien('Tanggal harus berbentuk YYYY-MM-DD.');
  }
}

export async function riwayatTambah(
  pengajuanId: number, isi: RiwayatBaru, oleh: string, conn?: PoolConnection
): Promise<void> {
  periksaIsi(isi);

  const sql = `INSERT INTO riwayat (pengajuan_id, tanggal, tahap, keterangan, dicatat_oleh, dicatat_pada)
               VALUES (?,?,?,?,?, NOW())`;
  const nilai = [pengajuanId, isi.tanggal, isi.tahap, isi.keterangan ?? '', oleh];

  if (conn) await conn.query<ResultSetHeader>(sql, nilai);
  else await jalankan(sql, nilai);

  if (!conn) await pengajuanSentuh(pengajuanId, oleh);
}

/** @returns satu baris riwayat, atau null bila id-nya tidak ada */
export async function riwayatCari(id: number): Promise<Riwayat | null> {
  const baris = await kueri<Riwayat>(`SELECT ${KOLOM} FROM riwayat WHERE id = ?`, [id]);
  return baris[0] ?? null;
}

/**
 * Membetulkan satu baris yang sudah tercatat.
 *
 * Sebelum ada ini, baris yang tahapnya salah pilih tidak bisa diapa-apakan:
 * rel di kartu monitoring ikut salah selamanya, dan satu-satunya jalan adalah
 * menambah baris baru yang justru menumpuk cerita yang sama dua kali.
 *
 * `dicatat_oleh` dan `dicatat_pada` sengaja ikut diperbarui: yang bertanggung
 * jawab atas isi sebuah baris adalah orang yang terakhir menuliskannya. Jejak
 * siapa yang menulis versi sebelumnya tidak hilang, ia tersimpan di log audit
 * berikut tahap lamanya.
 */
export async function riwayatUbah(id: number, isi: RiwayatBaru, oleh: string): Promise<void> {
  periksaIsi(isi);

  await jalankan(
    `UPDATE riwayat SET tanggal = ?, tahap = ?, keterangan = ?, dicatat_oleh = ?, dicatat_pada = NOW()
     WHERE id = ?`,
    [isi.tanggal, isi.tahap, isi.keterangan ?? '', oleh, id]
  );
}

export async function riwayatHapus(id: number): Promise<void> {
  await jalankan(`DELETE FROM riwayat WHERE id = ?`, [id]);
}

export interface RingkasRiwayat {
  /** kejadian paling akhir, untuk baris "Terakhir:" di kartu */
  terakhir: Riwayat;
  /** stasiun terjauh yang pernah dicapai, 0 sampai JUMLAH_STASIUN */
  tercapai: number;
}

/**
 * @returns pengajuan_id -> kejadian terakhir berikut posisi relnya
 *
 * Keduanya dihitung dari satu kueri yang sama. Kejadian terakhir dan stasiun
 * terjauh sering berbeda: tahap LAINNYA adalah yang terbanyak di data
 * sungguhan dan ia tidak ada di rel, jadi kejadian terakhir tidak bisa dipakai
 * sebagai posisi.
 */
export async function riwayatRingkasPerPengajuan(): Promise<Map<number, RingkasRiwayat>> {
  const semua = await kueri<Riwayat>(
    `SELECT ${KOLOM} FROM riwayat ORDER BY pengajuan_id ASC, tanggal ASC, id ASC`
  );

  const kumpul = new Map<number, { terakhir: Riwayat; tahap: string[] }>();
  for (const r of semua) {
    const ada = kumpul.get(r.pengajuan_id);
    if (ada) {
      ada.terakhir = r;                 // yang terakhir menang
      ada.tahap.push(r.tahap);
    } else {
      kumpul.set(r.pengajuan_id, { terakhir: r, tahap: [r.tahap] });
    }
  }

  const peta = new Map<number, RingkasRiwayat>();
  for (const [id, isi] of kumpul) {
    peta.set(id, { terakhir: isi.terakhir, tercapai: stasiunTercapai(isi.tahap) });
  }
  return peta;
}

/** @returns pengajuan_id -> kejadian terakhir, untuk daftar monitoring */
export async function riwayatTerakhirPerPengajuan(): Promise<Map<number, Riwayat>> {
  const ringkas = await riwayatRingkasPerPengajuan();
  const peta = new Map<number, Riwayat>();
  for (const [id, isi] of ringkas) peta.set(id, isi.terakhir);
  return peta;
}
