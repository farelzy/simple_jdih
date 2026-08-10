/**
 * routes/setup.ts - penyiapan awal lewat halaman depan.
 *
 * Halaman penyiapan ada di URL publik, jadi harus dijaga. Tanpa pagar, siapa
 * pun yang menemukannya sebelum Bagian Hukum sempat menyiapkan bisa mengangkat
 * dirinya sendiri jadi admin lalu memegang seluruh sistem.
 *
 * Pagarnya token acak yang dicetak server ke log saat pertama hidup. Yang bisa
 * membacanya hanya orang yang punya akses SSH ke VPS -- dan itu memang orang
 * yang berhak menyiapkan. Token hangus begitu admin pertama terbentuk.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { adminBuat, adminHitungAktif, adminCari } from '../repo/admin.js';
import { buatToken, pasangCookie, wajibAdmin } from '../middleware/auth.js';
import { batasMasuk } from '../middleware/rate-limit.js';
import { migrasiPeriksa, migrasiJalankan } from '../services/migrasi.js';
import { logCatat } from '../repo/log.js';
import { GalatKlien } from '../middleware/galat.js';
import { bacaSesi } from '../middleware/auth.js';

let tokenPenyiapan = '';

/**
 * Terbitkan token penyiapan bila sistem belum punya admin sama sekali.
 * Dipanggil sekali saat server naik.
 */
export async function siapkanTokenPenyiapan(): Promise<void> {
  if ((await adminHitungAktif()) > 0) {
    tokenPenyiapan = '';
    return;
  }
  tokenPenyiapan = randomBytes(24).toString('base64url');
  console.log(
    '\n' + '='.repeat(64) + '\n' +
    'SISTEM BELUM DISIAPKAN\n' +
    'Buka halaman /setup lalu masukkan token berikut:\n\n' +
    `    ${tokenPenyiapan}\n\n` +
    'Token ini hangus begitu admin pertama dibuat.\n' +
    '='.repeat(64) + '\n'
  );
}

/** Hanya untuk uji. Token asli tidak pernah dikirim lewat API. */
export function _tokenSaatIni(): string {
  return tokenPenyiapan;
}

/** Bandingkan tanpa membocorkan panjang kecocokan lewat selisih waktu. */
function tokenCocok(diberikan: string): boolean {
  if (!tokenPenyiapan) return false;
  const a = Buffer.from(String(diberikan ?? ''));
  const b = Buffer.from(tokenPenyiapan);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const ruteSetup = Router();

ruteSetup.get('/status', async (_req, res, next) => {
  try {
    res.json({ perluSetup: (await adminHitungAktif()) === 0 });
  } catch (e) { next(e); }
});

/**
 * Buat admin pertama. Hanya bisa dipanggil selama sistem belum punya admin,
 * dan hanya dengan token yang benar.
 */
ruteSetup.post('/admin', batasMasuk, async (req, res, next) => {
  try {
    if ((await adminHitungAktif()) > 0) {
      throw new GalatKlien('Sistem sudah disiapkan. Masuk lewat halaman /masuk.', 409);
    }

    const { token, email, nama, sandi } = (req.body ?? {}) as Record<string, string>;
    if (!tokenCocok(token ?? '')) {
      await logCatat({ aksi: 'SETUP_TOKEN_SALAH', rincian: '', ip: req.ip ?? '' });
      throw new GalatKlien('Token penyiapan salah. Baca ulang dari log server.', 401);
    }

    await adminBuat(String(email ?? ''), String(nama ?? ''), String(sandi ?? ''));
    const admin = await adminCari(String(email ?? ''));
    if (!admin) throw new Error('Admin gagal dibuat.');

    // Token hangus: satu-satunya jendela penyiapan sudah terpakai.
    tokenPenyiapan = '';

    pasangCookie(res, buatToken(admin));
    await logCatat({ aktor: admin.email, aksi: 'SETUP_ADMIN_PERTAMA', rincian: '', ip: req.ip ?? '' });
    res.json({ sukses: true, email: admin.email, nama: admin.nama });
  } catch (e) { next(e); }
});

/** Periksa spreadsheet tanpa menulis apa pun. */
ruteSetup.post('/periksa-sheet', wajibAdmin, async (req, res, next) => {
  try {
    const { sumber, isiCsv } = (req.body ?? {}) as Record<string, string>;
    res.json(await migrasiPeriksa({ sumber: sumber ?? '', isiCsv, ujiCoba: true }));
  } catch (e) { next(e); }
});

/** Jalankan migrasi. `ujiCoba` melaporkan tanpa menulis apa pun. */
ruteSetup.post('/migrasi', wajibAdmin, async (req, res, next) => {
  try {
    const { sumber, isiCsv, ujiCoba } = (req.body ?? {}) as Record<string, unknown>;
    const laporan = await migrasiJalankan({
      sumber: String(sumber ?? ''),
      isiCsv: typeof isiCsv === 'string' ? isiCsv : undefined,
      ujiCoba: ujiCoba !== false,
      aktor: bacaSesi(req)?.email ?? 'admin'
    });
    res.json(laporan);
  } catch (e) { next(e); }
});
