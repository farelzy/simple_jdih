/**
 * repo/riwayat.ts - lini masa terstruktur.
 *
 * Menggantikan kolom 16 yang selama ini diketik tangan sebagai teks bebas.
 * Bentuk terstruktur inilah yang membuat pertanyaan seperti "berapa berkas yang
 * sedang menunggu fasilitasi Biro Hukum Jateng" bisa dijawab seketika.
 */

import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { kueri, jalankan } from '../db.js';
import { TAHAP_RIWAYAT } from '../murni/skema.js';
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

export async function riwayatTambah(
  pengajuanId: number, isi: RiwayatBaru, oleh: string, conn?: PoolConnection
): Promise<void> {
  if (!(TAHAP_RIWAYAT as readonly string[]).includes(isi.tahap)) {
    throw new Error(`Tahap "${isi.tahap}" tidak dikenali.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isi.tanggal ?? ''))) {
    throw new Error('Tanggal harus berbentuk YYYY-MM-DD.');
  }

  const sql = `INSERT INTO riwayat (pengajuan_id, tanggal, tahap, keterangan, dicatat_oleh, dicatat_pada)
               VALUES (?,?,?,?,?, NOW())`;
  const nilai = [pengajuanId, isi.tanggal, isi.tahap, isi.keterangan ?? '', oleh];

  if (conn) await conn.query<ResultSetHeader>(sql, nilai);
  else await jalankan(sql, nilai);

  if (!conn) await pengajuanSentuh(pengajuanId, oleh);
}

/** @returns pengajuan_id -> kejadian terakhir, untuk daftar monitoring */
export async function riwayatTerakhirPerPengajuan(): Promise<Map<number, Riwayat>> {
  const semua = await kueri<Riwayat>(
    `SELECT ${KOLOM} FROM riwayat ORDER BY pengajuan_id ASC, tanggal ASC, id ASC`
  );
  const peta = new Map<number, Riwayat>();
  for (const r of semua) peta.set(r.pengajuan_id, r);   // yang terakhir menang
  return peta;
}
