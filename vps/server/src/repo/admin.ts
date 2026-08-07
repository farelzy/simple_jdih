/**
 * repo/admin.ts - akun Bagian Hukum.
 *
 * Hanya admin yang punya akun. OPD mengirim pengajuan dan memantau tanpa masuk,
 * jadi tidak ada 30 akun OPD yang perlu dikelola dan tidak ada reset sandi
 * massal.
 */

import bcrypt from 'bcryptjs';
import { kueri, satu, jalankan } from '../db.js';

export interface Admin {
  id: number;
  email: string;
  nama: string;
  password_hash: string;
  aktif: number;
}
export type AdminPublik = Omit<Admin, 'password_hash'>;

const PUTARAN = 10;
const PANJANG_SANDI_MIN = 8;

/** Hash palsu berbentuk sah, dipakai supaya lama jawaban tidak membocorkan
 *  email mana yang terdaftar. */
const HASH_UMPAN = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

function bakukanEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

export async function adminCari(email: string): Promise<Admin | null> {
  return satu<Admin>(
    `SELECT id, email, nama, password_hash, aktif FROM admin WHERE email = ? AND aktif = 1`,
    [bakukanEmail(email)]
  );
}

export async function adminBuat(email: string, nama: string, sandi: string): Promise<number> {
  const bersih = bakukanEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(bersih)) throw new Error('Alamat email tidak sah.');
  if (String(sandi ?? '').length < PANJANG_SANDI_MIN) {
    throw new Error(`Kata sandi minimal ${PANJANG_SANDI_MIN} karakter.`);
  }
  const hash = await bcrypt.hash(sandi, PUTARAN);
  const hasil = await jalankan(
    `INSERT INTO admin (email, nama, password_hash, aktif, dibuat_pada)
     VALUES (?, ?, ?, 1, NOW())`,
    [bersih, nama ?? '', hash]
  );
  return hasil.insertId;
}

export async function adminDaftar(): Promise<AdminPublik[]> {
  // password_hash sengaja tidak ikut SELECT: hash tidak punya alasan
  // meninggalkan lapisan ini, sekalipun cuma menuju dashboard.
  return kueri<AdminPublik>(
    `SELECT id, email, nama, aktif FROM admin WHERE aktif = 1 ORDER BY email`
  );
}

export async function adminNonaktifkan(id: number): Promise<void> {
  await jalankan(`UPDATE admin SET aktif = 0 WHERE id = ?`, [id]);
}

export async function adminGantiSandi(id: number, sandiBaru: string): Promise<void> {
  if (String(sandiBaru ?? '').length < PANJANG_SANDI_MIN) {
    throw new Error(`Kata sandi minimal ${PANJANG_SANDI_MIN} karakter.`);
  }
  await jalankan(`UPDATE admin SET password_hash = ? WHERE id = ?`,
    [await bcrypt.hash(sandiBaru, PUTARAN), id]);
}

export async function adminHitungAktif(): Promise<number> {
  const b = await satu<{ n: number }>(`SELECT COUNT(*) AS n FROM admin WHERE aktif = 1`);
  return Number(b?.n ?? 0);
}

/**
 * @returns baris admin bila sandinya cocok, null bila tidak.
 *
 * bcrypt.compare tetap dijalankan terhadap hash umpan saat admin tidak
 * ditemukan, supaya email yang terdaftar tidak bisa ditebak dari selisih waktu
 * jawaban.
 */
export async function adminPeriksaSandi(email: string, sandi: string): Promise<Admin | null> {
  const a = await adminCari(email);
  const cocok = await bcrypt.compare(String(sandi ?? ''), a?.password_hash ?? HASH_UMPAN);
  return a && cocok ? a : null;
}
