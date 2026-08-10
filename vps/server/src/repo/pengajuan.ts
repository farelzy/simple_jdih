/**
 * repo/pengajuan.ts - baca/tulis tabel pengajuan.
 *
 * Nomor pengajuan diterbitkan di dalam transaksi dengan penguncian baris, dan
 * dijaga constraint UNIQUE pada kolom `nomor`. Di versi Apps Script ini dijaga
 * LockService buatan sendiri; sekarang database yang menjaminnya.
 */

import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool, kueri, satu, jalankan } from '../db.js';
import { nomorBerikutnya } from '../pure/penomoran.js';
import { STATUS_PENGAJUAN, type Status } from '../pure/skema.js';

export interface Pengajuan {
  id: number;
  nomor: string;
  opd_id: number | null;
  opd_teks: string;
  jenis_peraturan: 'Daerah' | 'Bupati';
  judul: string;
  nama_pemohon: string;
  wa_pemohon: string;
  email_pemohon: string;
  status: Status;
  keterangan: string;
  dibuat_pada: string;
  diperbarui_pada: string;
  diperbarui_oleh: string;
}

export interface PengajuanBaru {
  opd_id: number | null;
  opd_teks: string;
  jenis_peraturan: 'Daerah' | 'Bupati';
  judul: string;
  nama_pemohon: string;
  wa_pemohon: string;
  email_pemohon: string;
}

const KOLOM = `id, nomor, opd_id, opd_teks, jenis_peraturan, judul, nama_pemohon,
               wa_pemohon, email_pemohon, status, keterangan,
               dibuat_pada, diperbarui_pada, diperbarui_oleh`;

/**
 * Tahun menurut zona Asia/Jakarta, dihitung eksplisit supaya tidak bergantung
 * pada zona waktu proses Node yang bisa berbeda antara komputer dan server.
 */
function tahunSekarang(): number {
  return Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric'
  }).format(new Date()));
}

/** Nama kunci penasihat MariaDB untuk menyerialkan penerbitan nomor. */
const KUNCI_NOMOR = 'simpel_nomor_pengajuan';
const TUNGGU_KUNCI_DETIK = 10;

/**
 * Sisipkan baris dengan nomor berikutnya.
 * Pemanggil wajib sudah memegang kunci penerbitan nomor.
 */
async function terbitkanDi(
  conn: PoolConnection, data: PengajuanBaru
): Promise<{ id: number; nomor: string }> {
  const tahun = tahunSekarang();
  const [baris] = await conn.query<RowDataPacket[]>(
    `SELECT nomor FROM pengajuan WHERE nomor LIKE ? ORDER BY nomor DESC LIMIT 1`,
    [`BRB-${tahun}-%`]
  );
  const terakhir = baris.length ? String(baris[0]!.nomor) : null;
  const nomor = nomorBerikutnya(tahun, terakhir);

  const [hasil] = await conn.query<ResultSetHeader>(
    `INSERT INTO pengajuan
      (nomor, opd_id, opd_teks, jenis_peraturan, judul, nama_pemohon, wa_pemohon,
       email_pemohon, status, keterangan, dibuat_pada, diperbarui_pada, diperbarui_oleh)
     VALUES (?,?,?,?,?,?,?,?, 'PROSES', '', NOW(), NOW(), ?)`,
    [nomor, data.opd_id, data.opd_teks, data.jenis_peraturan, data.judul,
     data.nama_pemohon, data.wa_pemohon, data.email_pemohon, data.email_pemohon]
  );
  return { id: hasil.insertId, nomor };
}

/**
 * Terbitkan nomor lalu sisipkan barisnya.
 *
 * Penerbitan diserialkan dengan GET_LOCK, bukan SELECT ... FOR UPDATE. Versi
 * FOR UPDATE sempat ditulis dan terbukti salah: kueri
 * `WHERE nomor LIKE ? ORDER BY nomor DESC LIMIT 1 FOR UPDATE` mengambil gap
 * lock pada indeks, dan dua puluh transaksi berbarengan mengambilnya dengan
 * urutan berbeda sehingga InnoDB melaporkan deadlock.
 *
 * Kunci penasihat menyerialkan hanya bagian penerbitan nomor, tidak menyentuh
 * penguncian baris sama sekali, dan tabel `pengajuan` tetap jadi satu-satunya
 * sumber kebenaran nomor. Constraint UNIQUE pada kolom `nomor` jadi jaring
 * pengaman terakhir bila kunci ini pun lolos.
 */
export async function pengajuanBuat(
  data: PengajuanBaru, connLuar?: PoolConnection
): Promise<{ id: number; nomor: string }> {
  // Pemanggil yang membawa koneksinya sendiri sudah berada di dalam transaksi
  // dan bertanggung jawab atas penguncian -- dipakai migrasi, yang menyisipkan
  // 29 baris berurutan dalam satu transaksi.
  if (connLuar) return terbitkanDi(connLuar, data);

  const conn = await pool.getConnection();
  try {
    const [kunci] = await conn.query<RowDataPacket[]>(
      `SELECT GET_LOCK(?, ?) AS didapat`, [KUNCI_NOMOR, TUNGGU_KUNCI_DETIK]
    );
    if (Number(kunci[0]?.didapat) !== 1) {
      throw new Error('Sistem sedang sibuk menerbitkan nomor pengajuan. Coba lagi sebentar.');
    }

    try {
      await conn.beginTransaction();
      const hasil = await terbitkanDi(conn, data);
      await conn.commit();
      return hasil;
    } catch (galat) {
      try { await conn.rollback(); } catch { /* koneksi mungkin sudah putus */ }
      throw galat;
    } finally {
      // Kunci dilepas SETELAH commit, bukan di dalam transaksi.
      //
      // Versi sebelumnya melepasnya sebelum commit, dan itu salah: transaksi
      // berikutnya mengambil kunci lalu membaca nomor terakhir yang belum
      // kelihatan karena masih uncommitted, sehingga mendapat nomor yang sama.
      // Constraint UNIQUE yang menangkapnya sebagai "Duplicate entry".
      await conn.query(`SELECT RELEASE_LOCK(?)`, [KUNCI_NOMOR]);
    }
  } finally {
    conn.release();
  }
}

export async function pengajuanSemua(): Promise<Pengajuan[]> {
  return kueri<Pengajuan>(`SELECT ${KOLOM} FROM pengajuan ORDER BY dibuat_pada DESC, id DESC`);
}

export async function pengajuanCariNomor(nomor: string): Promise<Pengajuan | null> {
  return satu<Pengajuan>(`SELECT ${KOLOM} FROM pengajuan WHERE nomor = ?`,
    [String(nomor ?? '').trim().toUpperCase()]);
}

export async function pengajuanCariId(id: number): Promise<Pengajuan | null> {
  return satu<Pengajuan>(`SELECT ${KOLOM} FROM pengajuan WHERE id = ?`, [id]);
}

export async function pengajuanUbahStatus(
  nomor: string, status: Status, alasan: string, oleh: string
): Promise<void> {
  if (!STATUS_PENGAJUAN.includes(status)) throw new Error('Status tidak dikenali.');
  const bersih = String(alasan ?? '').trim();
  if (status === 'DIKEMBALIKAN' && !bersih) {
    throw new Error('Alasan wajib diisi saat mengembalikan pengajuan.');
  }

  const hasil = await jalankan(
    `UPDATE pengajuan
        SET status = ?,
            keterangan = CASE WHEN ? <> '' THEN ? ELSE keterangan END,
            diperbarui_pada = NOW(),
            diperbarui_oleh = ?
      WHERE nomor = ?`,
    [status, bersih, bersih, oleh, String(nomor ?? '').trim().toUpperCase()]
  );
  if (hasil.affectedRows === 0) throw new Error(`Pengajuan ${nomor} tidak ditemukan.`);
}

/** Perbarui jejak waktu supaya antrean admin mengurutkan dengan benar. */
export async function pengajuanSentuh(id: number, oleh: string): Promise<void> {
  await jalankan(
    `UPDATE pengajuan SET diperbarui_pada = NOW(), diperbarui_oleh = ? WHERE id = ?`,
    [oleh, id]
  );
}
