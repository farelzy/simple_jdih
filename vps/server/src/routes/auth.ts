import { Router } from 'express';
import { adminPeriksaSandi } from '../repo/admin.js';
import { buatToken, pasangCookie, hapusCookie, bacaSesi, wajibAdmin } from '../middleware/auth.js';
import { batasMasuk } from '../middleware/rate-limit.js';
import { logCatat } from '../repo/log.js';

export const ruteAuth = Router();

ruteAuth.post('/masuk', batasMasuk, async (req, res, next) => {
  try {
    const { email, sandi } = (req.body ?? {}) as { email?: string; sandi?: string };
    const admin = await adminPeriksaSandi(String(email ?? ''), String(sandi ?? ''));
    if (!admin) {
      // Pesan sengaja tidak menyebut mana yang salah, email atau sandinya --
      // membedakannya memberi tahu penebak bahwa email itu terdaftar.
      res.status(401).json({ galat: 'Email atau kata sandi salah.' });
      return;
    }
    pasangCookie(res, buatToken(admin));
    await logCatat({ aktor: admin.email, aksi: 'MASUK', rincian: '', ip: req.ip ?? '' });
    res.json({ email: admin.email, nama: admin.nama });
  } catch (e) { next(e); }
});

ruteAuth.post('/keluar', (_req, res) => {
  hapusCookie(res);
  res.json({ sukses: true });
});

ruteAuth.get('/saya', wajibAdmin, (req, res) => {
  res.json({ sesi: bacaSesi(req) });
});
