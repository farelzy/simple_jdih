import { describe, it, expect, afterAll } from 'vitest';
import { Readable } from 'node:stream';
import { readdir, rm } from 'node:fs/promises';
import { simpanAliran, hapusBerkas, namaDiDisk, jalurPenuh, adaBerkas, DIR_BERKAS, GalatUkuran } from '../services/simpanan.js';

afterAll(async () => { await rm(DIR_BERKAS, { recursive: true, force: true }); });

function aliran(...potongan: Buffer[]): Readable {
  return Readable.from(potongan);
}

describe('namaDiDisk', () => {
  it('tidak pernah memakai nama kiriman apa adanya', () => {
    const n = namaDiDisk('laporan rahasia.pdf');
    expect(n).not.toContain('laporan');
    expect(n).toMatch(/\.pdf$/);      // ekstensi dipertahankan agar mudah dikenali
  });

  it('membuang jalur dari nama yang mencoba keluar folder', () => {
    const n = namaDiDisk('../../etc/passwd');
    expect(n).not.toContain('..');
    expect(n).not.toContain('/');
  });

  it('menghasilkan nama berbeda tiap kali', () => {
    const set = new Set(Array.from({ length: 50 }, () => namaDiDisk('a.pdf')));
    expect(set.size).toBe(50);
  });
});

describe('jalurPenuh', () => {
  it('menolak jalur yang mencoba keluar dari folder berkas', () => {
    // path.basename sudah membuang komponen jalur, jadi hasilnya tetap di dalam.
    expect(jalurPenuh('../../rahasia.txt')).toContain(DIR_BERKAS.replace(/\//g, require('node:path').sep));
    expect(jalurPenuh('biasa.pdf')).toContain('biasa.pdf');
  });
});

describe('simpanAliran', () => {
  it('menulis berkas dan melaporkan ukurannya', async () => {
    const isi = Buffer.alloc(2048, 3);
    const h = await simpanAliran(aliran(isi), 'uji.pdf', 10 * 1024);
    expect(h.ukuran).toBe(2048);
    expect(await adaBerkas(h.nama)).toBe(true);
    await hapusBerkas(h.nama);
  });

  /**
   * Penjaga ini tetap dibutuhkan meski rute sudah memeriksa Content-Length:
   * header itu datang dari klien dan bisa berbohong. Tanpa penjaga, satu
   * permintaan bisa menghabiskan disk VPS yang dipakai bersama tiga aplikasi.
   */
  it('berhenti di tengah saat melewati batas dan tidak meninggalkan berkas', async () => {
    const sebelum = (await readdir(DIR_BERKAS).catch(() => [])).length;

    const besar = Buffer.alloc(4096, 1);
    await expect(
      simpanAliran(aliran(besar, besar, besar), 'besar.pdf', 5000)
    ).rejects.toThrow(GalatUkuran);

    const sesudah = (await readdir(DIR_BERKAS).catch(() => [])).length;
    expect(sesudah).toBe(sebelum);
  });

  it('menolak berkas kosong tanpa meninggalkan jejak', async () => {
    const sebelum = (await readdir(DIR_BERKAS).catch(() => [])).length;
    await expect(simpanAliran(aliran(Buffer.alloc(0)), 'kosong.pdf', 5000)).rejects.toThrow(/kosong/i);
    expect((await readdir(DIR_BERKAS).catch(() => [])).length).toBe(sebelum);
  });

  it('menghapus berkas yang sudah tidak dipakai', async () => {
    const h = await simpanAliran(aliran(Buffer.alloc(100, 9)), 'buang.pdf', 5000);
    expect(await adaBerkas(h.nama)).toBe(true);
    await hapusBerkas(h.nama);
    expect(await adaBerkas(h.nama)).toBe(false);
  });

  it('menghapus berkas yang sudah hilang tidak melempar', async () => {
    await expect(hapusBerkas('tidak-pernah-ada.pdf')).resolves.toBeUndefined();
  });
});
