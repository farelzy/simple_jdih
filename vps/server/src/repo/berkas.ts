/**
 * repo/berkas.ts - berkas pengajuan.
 *
 * Tabel tersendiri, bukan tautan yang digabung koma dalam satu sel seperti di
 * spreadsheet lama. Ukuran, jenis, dan id Drive tiap berkas tercatat rapi,
 * sehingga bisa diperiksa dan dibersihkan satu per satu.
 */

import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { kueri, jalankan } from '../db.js';

export interface Berkas {
  id: number;
  pengajuan_id: number;
  kolom: string;
  nama: string;
  ukuran: number;
  mime: string;
  drive_file_id: string;
  url: string;
  diunggah_pada: string;
}

export type BerkasBaru = Omit<Berkas, 'id' | 'pengajuan_id' | 'diunggah_pada'>;

const KOLOM = `id, pengajuan_id, kolom, nama, ukuran, mime, drive_file_id, url, diunggah_pada`;

export async function berkasTambah(
  pengajuanId: number, b: BerkasBaru, conn?: PoolConnection
): Promise<void> {
  const sql = `INSERT INTO berkas
                 (pengajuan_id, kolom, nama, ukuran, mime, drive_file_id, url, diunggah_pada)
               VALUES (?,?,?,?,?,?,?, NOW())`;
  const nilai = [pengajuanId, b.kolom, b.nama, b.ukuran, b.mime, b.drive_file_id, b.url];
  if (conn) await conn.query<ResultSetHeader>(sql, nilai);
  else await jalankan(sql, nilai);
}

export async function berkasUntuk(pengajuanId: number): Promise<Berkas[]> {
  const daftar = await kueri<Berkas>(
    `SELECT ${KOLOM} FROM berkas WHERE pengajuan_id = ? ORDER BY id ASC`, [pengajuanId]
  );
  return daftar.map((b) => ({ ...b, ukuran: Number(b.ukuran) }));
}
