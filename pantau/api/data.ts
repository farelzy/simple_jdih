/**
 * api/data.ts - satu-satunya bagian sistem ini yang menyentuh jaringan.
 *
 * Menarik spreadsheet lewat endpoint ekspor CSV milik Google, menguraikannya,
 * lalu mengirimkannya sebagai JSON. Tidak ada basis data, tidak ada server yang
 * harus dirawat -- fungsi ini hidup hanya selama satu permintaan.
 *
 * SATU fungsi untuk seluruh situs, bukan satu per halaman. Datanya cuma
 * puluhan baris; memecahnya jadi beberapa endpoint hanya menambah tarikan ke
 * Google tanpa mengurangi apa pun yang dikirim.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { uraiCsv, urlEksporCsv } from '../src/pure/csv';
import { susunDariBaris } from '../src/pure/sheet';

/**
 * Berapa lama jawaban boleh dipakai ulang sebelum ditarik lagi.
 *
 * Tiga puluh detik, setengah dari jeda penyegaran klien (45 detik), supaya
 * tarikan berkala itu hampir selalu menemui simpanan yang sudah lewat
 * tenggang dan benar-benar membawa yang terbaru -- bukan mengambil salinan
 * yang usianya nyaris sama.
 *
 * Endpoint ekspor Google adalah layanan seadanya, bukan API dengan jaminan.
 * Tanpa tenggang ini, setiap pengunjung jadi satu tarikan -- dan kalau tautan
 * situs tersebar di grup OPD lalu dibuka serempak, situs ikut selambat Google
 * dan berisiko dibatasi olehnya.
 *
 * `stale-while-revalidate` yang membuatnya enak dipakai: pengunjung tidak
 * pernah menunggu Google. Mereka langsung menerima salinan terakhir sementara
 * Vercel menyegarkannya di belakang layar -- termasuk saat Google sedang
 * bermasalah, sampai lima menit.
 */
const TENGGANG_DETIK = 30;
const BASI_DETIK = 300;

function konfig(): { id: string; gid: string } {
  const id = process.env.SHEET_ID ?? '';
  if (!id) throw new Error('SHEET_ID belum disetel di environment Vercel.');
  return { id, gid: process.env.SHEET_GID ?? '0' };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ galat: 'Hanya GET.' });
    return;
  }

  try {
    const { id, gid } = konfig();
    const jawab = await fetch(urlEksporCsv(id, gid), { redirect: 'follow' });

    if (!jawab.ok) {
      throw new Error(
        `Spreadsheet tidak bisa dibaca (HTTP ${jawab.status}). Pastikan aksesnya `
        + 'disetel "Siapa saja yang memiliki link" minimal sebagai Pelihat.'
      );
    }

    const teks = await jawab.text();
    // Google menjawab halaman login dengan status 200, jadi kode status saja
    // tidak cukup untuk tahu bahwa yang datang memang data.
    if (teks.trimStart().startsWith('<')) {
      throw new Error(
        'Google mengembalikan halaman login, bukan data. Spreadsheet masih '
        + 'tertutup — buka aksesnya lewat tautan.'
      );
    }

    const data = susunDariBaris(uraiCsv(teks));

    res.setHeader(
      'Cache-Control',
      `public, s-maxage=${TENGGANG_DETIK}, stale-while-revalidate=${BASI_DETIK}`
    );
    res.status(200).json({ ...data, ditarik: new Date().toISOString() });
  } catch (galat) {
    // Tanpa ini, kegagalan sesaat di pihak Google tersimpan di tepi Vercel
    // selama satu menit dan situs ikut kosong padahal sudah pulih.
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ galat: (galat as Error).message });
  }
}
