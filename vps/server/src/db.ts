/**
 * db.ts - pool MariaDB dan helper transaksi.
 *
 * Semua SQL di aplikasi ini lewat sini. connectionLimit sengaja kecil: VPS
 * hanya punya 842 MB dan dibagi dengan tiga aplikasi lain, sementara beban
 * nyata sistem ini sekitar 10 pengajuan per bulan.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql, {
  type PoolConnection, type RowDataPacket, type ResultSetHeader
} from 'mysql2/promise';
import { bacaKonfig } from './konfig.js';

const konfig = bacaKonfig(process.env);
const DIR = path.dirname(fileURLToPath(import.meta.url));

export const pool = mysql.createPool({
  host: konfig.db.host,
  port: konfig.db.port,
  user: konfig.db.user,
  password: konfig.db.password,
  database: konfig.db.database,
  waitForConnections: true,
  connectionLimit: 5,
  charset: 'utf8mb4_general_ci',
  timezone: '+07:00',
  // Dimatikan demi keamanan: satu titik koma yang lolos ke query tidak boleh
  // bisa menjalankan pernyataan kedua.
  multipleStatements: false,
  dateStrings: true
});

export async function kueri<T>(sql: string, nilai: unknown[] = []): Promise<T[]> {
  const [baris] = await pool.query<RowDataPacket[]>(sql, nilai);
  return baris as T[];
}

export async function satu<T>(sql: string, nilai: unknown[] = []): Promise<T | null> {
  const baris = await kueri<T>(sql, nilai);
  return baris.length ? (baris[0] as T) : null;
}

export async function jalankan(sql: string, nilai: unknown[] = []): Promise<ResultSetHeader> {
  const [hasil] = await pool.query<ResultSetHeader>(sql, nilai);
  return hasil;
}

/**
 * Jalankan fn di dalam transaksi. Commit bila selesai, rollback bila melempar.
 * Koneksi selalu dikembalikan ke pool, termasuk saat galat -- kalau tidak,
 * lima kegagalan berturut-turut akan menghabiskan seluruh pool.
 */
export async function transaksi<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const hasil = await fn(conn);
    await conn.commit();
    return hasil;
  } catch (galat) {
    try { await conn.rollback(); } catch { /* koneksi mungkin sudah putus */ }
    throw galat;
  } finally {
    conn.release();
  }
}

/** Buang baris komentar penuh supaya tidak ikut terkirim sebagai pernyataan. */
function buangKomentar(sql: string): string {
  return sql
    .split(/\r?\n/)
    .filter((baris) => !baris.trim().startsWith('--'))
    .join('\n');
}

/**
 * Jalankan seluruh berkas sql/*.sql berurut menurut nama.
 *
 * Setiap berkas ditulis idempoten (CREATE TABLE IF NOT EXISTS / INSERT IGNORE),
 * jadi aman dipanggil tiap kali server naik dan tidak perlu alat migrasi
 * terpisah untuk skema sesederhana ini.
 */
export async function siapkanSkema(): Promise<void> {
  const dirSql = path.join(DIR, '..', 'sql');
  const berkas = (await readdir(dirSql)).filter((n) => n.endsWith('.sql')).sort();

  for (const nama of berkas) {
    const isi = buangKomentar(await readFile(path.join(dirSql, nama), 'utf8'));
    // multipleStatements dimatikan, jadi dipecah manual per titik koma di
    // akhir baris -- satu-satunya tempat titik koma muncul di berkas ini.
    const pernyataan = isi
      .split(/;\s*$/m)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const p of pernyataan) await pool.query(p);
  }
}
