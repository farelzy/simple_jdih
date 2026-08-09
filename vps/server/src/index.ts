/**
 * index.ts - bootstrap Express.
 *
 * Server hanya mendengar di 127.0.0.1: Caddy yang menghadap internet, jadi port
 * aplikasi tidak perlu terbuka ke luar sama sekali.
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import { bacaKonfig } from './konfig.js';
import { siapkanSkema, pool } from './db.js';
import { rutePublik } from './rute/publik.js';
import { ruteAuth } from './rute/auth.js';
import { ruteSetup, siapkanTokenPenyiapan } from './rute/setup.js';
import { ruteAdmin } from './rute/admin.js';
import { tangkapGalat } from './tengah/galat.js';

export function buatApp() {
  const app = express();

  // Caddy yang di depan; tanpa ini req.ip selalu 127.0.0.1 dan pembatas laju
  // akan memperlakukan seluruh internet sebagai satu pengunjung.
  app.set('trust proxy', 1);

  // Badan permintaan selalu kecil: bytes berkas tidak pernah lewat sini,
  // browser mengirimnya langsung ke Drive.
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  app.get('/api/sehat', (_req, res) => { res.json({ status: 'ok' }); });
  app.use('/api/publik', rutePublik);
  app.use('/api/auth', ruteAuth);
  app.use('/api/setup', ruteSetup);
  app.use('/api/admin', ruteAdmin);

  app.use(tangkapGalat);
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const konfig = bacaKonfig(process.env);
  await siapkanSkema();
  await siapkanTokenPenyiapan();

  const server = buatApp().listen(konfig.port, '127.0.0.1', () => {
    console.log(`SIMPEL siap di 127.0.0.1:${konfig.port}`);
  });

  // systemd mengirim SIGTERM saat restart; tutup koneksi database dengan rapi
  // supaya tidak meninggalkan sesi menggantung di MariaDB.
  for (const sinyal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(sinyal, () => {
      console.log(`${sinyal} diterima, menutup...`);
      server.close(() => {
        void pool.end().then(() => process.exit(0));
      });
    });
  }
}
