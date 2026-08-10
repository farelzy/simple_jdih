/**
 * services/simpanan.ts - penyimpanan berkas di disk VPS.
 *
 * Bytes dialirkan langsung dari permintaan HTTP ke berkas di disk, tanpa pernah
 * ditahan utuh di memori. Ini bukan optimasi: proses dibatasi MemoryMax=200M dan
 * berbagi 842 MB dengan tiga aplikasi lain, jadi menampung berkas 30 MB di
 * memori akan membuat systemd membunuh prosesnya di tengah unggahan.
 *
 * Nama berkas di disk sengaja acak, bukan nama asli dari pemohon. Nama asli
 * disimpan di database dan dipakai hanya saat berkas diunduh. Menulis nama
 * kiriman langsung ke disk membuka jalur penulisan di luar folder tujuan
 * lewat '../' dan sejenisnya.
 */

import { createWriteStream } from 'node:fs';
import { mkdir, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomBytes } from 'node:crypto';
import type { Readable } from 'node:stream';

export const DIR_BERKAS = process.env.DIR_BERKAS ?? '/opt/simpel/berkas';

export class GalatUkuran extends Error {
  constructor(public readonly batasByte: number) {
    super(`Berkas melebihi batas ${Math.round(batasByte / 1024 / 1024)} MB.`);
    this.name = 'GalatUkuran';
  }
}

/** Nama acak dengan ekstensi asli dipertahankan agar mudah dikenali di disk. */
export function namaDiDisk(namaAsli: string): string {
  const ekst = path.extname(String(namaAsli ?? '')).slice(0, 12).replace(/[^A-Za-z0-9.]/g, '');
  return `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}${ekst}`;
}

/** Jalur penuh sebuah berkas, dijaga agar tidak pernah keluar dari DIR_BERKAS. */
export function jalurPenuh(nama: string): string {
  const bersih = path.basename(String(nama ?? ''));
  const penuh = path.join(DIR_BERKAS, bersih);
  if (!penuh.startsWith(path.resolve(DIR_BERKAS) + path.sep) &&
      path.resolve(penuh) !== path.resolve(DIR_BERKAS, bersih)) {
    throw new Error('Jalur berkas tidak sah.');
  }
  return penuh;
}

/**
 * Alirkan aliran masuk ke berkas baru di disk.
 *
 * Berhenti dan menghapus berkas separuh jalan begitu melewati batas. Memeriksa
 * ukuran hanya di akhir berarti disk sudah terlanjur terisi oleh berkas yang
 * memang akan ditolak.
 */
export async function simpanAliran(
  aliran: Readable, namaAsli: string, batasByte: number
): Promise<{ nama: string; ukuran: number }> {
  await mkdir(DIR_BERKAS, { recursive: true });

  const nama = namaDiDisk(namaAsli);
  const tujuan = jalurPenuh(nama);
  let ukuran = 0;
  let lewatBatas = false;

  aliran.on('data', (potong: Buffer) => {
    ukuran += potong.length;
    if (ukuran > batasByte && !lewatBatas) {
      lewatBatas = true;
      aliran.destroy(new GalatUkuran(batasByte));
    }
  });

  try {
    await pipeline(aliran, createWriteStream(tujuan));
  } catch (galat) {
    await unlink(tujuan).catch(() => { /* mungkin belum sempat terbuat */ });
    throw galat;
  }

  if (ukuran === 0) {
    await unlink(tujuan).catch(() => {});
    throw new Error('Berkas kosong.');
  }

  return { nama, ukuran };
}

export async function hapusBerkas(nama: string): Promise<void> {
  await unlink(jalurPenuh(nama)).catch(() => { /* sudah hilang, tidak apa-apa */ });
}

export async function adaBerkas(nama: string): Promise<boolean> {
  try {
    return (await stat(jalurPenuh(nama))).isFile();
  } catch {
    return false;
  }
}
