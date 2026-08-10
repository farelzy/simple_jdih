/**
 * middleware/auth.ts - sesi admin lewat JWT di cookie httpOnly.
 *
 * Cookie dipilih daripada header Authorization supaya token tidak pernah
 * tersentuh JavaScript di browser: satu celah XSS jadi tidak otomatis berarti
 * sesi admin ikut dicuri.
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { bacaKonfig } from '../konfig.js';

const konfig = bacaKonfig(process.env);
const NAMA_COOKIE = 'simpel_sesi';
const UMUR_JAM = 12;

export interface Sesi {
  id: number;
  email: string;
}

export function buatToken(admin: { id: number; email: string }): string {
  return jwt.sign({ id: admin.id, email: admin.email }, konfig.jwtSecret, {
    expiresIn: `${UMUR_JAM}h`
  });
}

export function periksaToken(token: string): Sesi | null {
  try {
    const isi = jwt.verify(token, konfig.jwtSecret) as jwt.JwtPayload;
    if (typeof isi.id !== 'number' || typeof isi.email !== 'string') return null;
    return { id: isi.id, email: isi.email };
  } catch {
    return null;
  }
}

export function pasangCookie(res: Response, token: string): void {
  res.cookie(NAMA_COOKIE, token, {
    httpOnly: true,                            // tidak terbaca JavaScript
    sameSite: 'strict',                        // tidak ikut terkirim dari situs lain
    secure: konfig.nodeEnv === 'production',   // hanya lewat HTTPS
    maxAge: UMUR_JAM * 60 * 60 * 1000,
    path: '/'
  });
}

export function hapusCookie(res: Response): void {
  res.clearCookie(NAMA_COOKIE, { path: '/' });
}

export function bacaSesi(req: Request): Sesi | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const token = cookies?.[NAMA_COOKIE];
  return token ? periksaToken(token) : null;
}

/**
 * Middleware: hentikan permintaan yang bukan dari admin aktif.
 *
 * Token yang sah saja tidak cukup. Token berumur 12 jam, jadi admin yang baru
 * dicabut aksesnya akan tetap bisa bertindak selama sisa umur token itu kalau
 * yang diperiksa hanya tanda tangannya. Karena itu keaktifannya dicek ke
 * database tiap permintaan -- pada segelintir akun dan lalu lintas sekecil ini,
 * satu kueri tambahan jauh lebih murah daripada lubang selama 12 jam.
 */
export async function wajibAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sesi = bacaSesi(req);
  if (!sesi) {
    res.status(401).json({ galat: 'Halaman ini hanya untuk Bagian Hukum.' });
    return;
  }

  try {
    const { adminCari } = await import('../repo/admin.js');
    const admin = await adminCari(sesi.email);   // hanya mengembalikan yang aktif
    if (!admin || admin.id !== sesi.id) {
      hapusCookie(res);
      res.status(401).json({ galat: 'Akses Anda sudah dicabut. Silakan masuk kembali.' });
      return;
    }
  } catch (galat) {
    next(galat);
    return;
  }

  (req as Request & { sesi?: Sesi }).sesi = sesi;
  next();
}
