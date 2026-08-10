/**
 * middleware/galat.ts - penangan galat terakhir.
 *
 * Pesan galat internal tidak pernah dikirim apa adanya ke klien di produksi:
 * pesan MariaDB bisa memuat nama tabel dan potongan query, dan itu memberi
 * peta gratis kepada siapa pun yang sedang menebak-nebak.
 */

import type { Request, Response, NextFunction } from 'express';

export class GalatKlien extends Error {
  constructor(pesan: string, public readonly kode = 400) {
    super(pesan);
    this.name = 'GalatKlien';
  }
}

export function tangkapGalat(
  galat: Error, _req: Request, res: Response, _next: NextFunction
): void {
  if (galat instanceof GalatKlien) {
    res.status(galat.kode).json({ galat: galat.message });
    return;
  }

  console.error('[galat]', galat.message);
  const pesan = process.env.NODE_ENV === 'production'
    ? 'Terjadi kesalahan di server. Coba lagi beberapa saat.'
    : galat.message;
  res.status(500).json({ galat: pesan });
}
