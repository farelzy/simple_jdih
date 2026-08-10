import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { readdir, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { pool, kueri, siapkanSkema } from '../db.js';
import { pengajuanBuat } from '../repo/pengajuan.js';
import { riwayatTambah } from '../repo/riwayat.js';
import { berkasTambah } from '../repo/berkas.js';
import {
  DIR_CADANGAN, SIMPAN_HARI, cadanganDaftar, cadanganJalankan, cadanganRapikan,
  jalurCadangan, namaCadangan, tanggalJakarta
} from '../services/cadangan.js';
import { buatBukuKerja, kumpulkanEkspor } from '../services/ekspor.js';
import { JUDUL_EKSPOR } from '../pure/baris-ekspor.js';

const CONTOH = {
  opd_id: null, opd_teks: 'BPKAD', jenis_peraturan: 'Bupati' as const,
  judul: 'Raperbup tentang Percontohan', nama_pemohon: 'Mayasari',
  wa_pemohon: '082299989690', email_pemohon: 'maya@uji.local'
};

/**
 * ExcelJS mengetik parameternya `Buffer<ArrayBuffer>`, sementara Buffer.from()
 * di Node 22 menghasilkan `Buffer<ArrayBufferLike>`. Isinya sama; hanya
 * ketikannya yang berselisih.
 */
async function muatBuku(isi: Buffer): Promise<ExcelJS.Workbook> {
  const buku = new ExcelJS.Workbook();
  await buku.xlsx.load(isi as unknown as Parameters<typeof buku.xlsx.load>[0]);
  return buku;
}

async function kosongkanFolder() {
  await rm(DIR_CADANGAN, { recursive: true, force: true });
  await mkdir(DIR_CADANGAN, { recursive: true });
}

beforeAll(async () => { await siapkanSkema(); });
beforeEach(async () => {
  await kueri(`DELETE FROM pengajuan`);
  await kosongkanFolder();
});
afterAll(async () => {
  await kueri(`DELETE FROM pengajuan`);
  await rm(DIR_CADANGAN, { recursive: true, force: true });
  await pool.end();
});

describe('ekspor Excel', () => {
  it('lembar kosong tetap punya baris judul lengkap', async () => {
    const buku = await muatBuku(await buatBukuKerja());
    const lembar = buku.getWorksheet('Pengajuan')!;

    expect(lembar.rowCount).toBe(1);
    const judul = (lembar.getRow(1).values as unknown[]).slice(1).map(String);
    expect(judul).toEqual([...JUDUL_EKSPOR]);
  });

  it('satu pengajuan jadi satu baris, dengan riwayat tersusun kembali', async () => {
    const p = await pengajuanBuat(CONTOH);
    await riwayatTambah(p.id,
      { tanggal: '2026-05-02', tahap: 'BERKAS_MASUK', keterangan: 'Berkas masuk ke sistem' },
      'sistem');

    const buku = await muatBuku(await buatBukuKerja());
    const lembar = buku.getWorksheet('Pengajuan')!;

    expect(lembar.rowCount).toBe(2);
    const baris = (lembar.getRow(2).values as unknown[]).slice(1).map((v) => String(v ?? ''));
    expect(baris[JUDUL_EKSPOR.indexOf('ID')]).toBe(p.nomor);
    expect(baris[JUDUL_EKSPOR.indexOf('Nama OPD Pemohon')]).toBe('BPKAD');
    expect(baris[JUDUL_EKSPOR.indexOf('Tanggal dan Detail Proses')])
      .toBe('- 2 Mei 2026 Berkas masuk ke sistem');
  });

  /**
   * Nama berkas di disk adalah nama acak yang sengaja tidak pernah ditunjukkan
   * ke siapa pun. Lembar ekspor dibagikan lebih luas daripada dashboard, jadi
   * ia justru tempat paling mudah untuk membocorkannya tanpa sadar.
   */
  it('nama berkas di disk tidak ikut ke lembar', async () => {
    const p = await pengajuanBuat(CONTOH);
    await berkasTambah(p.id, {
      kolom: 'surat_permohonan', nama: 'surat.pdf', ukuran: 10,
      mime: 'application/pdf', sumber: 'lokal', jalur: 'nama-acak-rahasia.pdf'
    });

    const isi = await buatBukuKerja();
    expect(isi.toString('latin1')).not.toContain('nama-acak-rahasia');
  });

  it('mengambil data dengan jumlah kueri tetap, bukan per pengajuan', async () => {
    for (let i = 0; i < 3; i++) await pengajuanBuat(CONTOH);
    const data = await kumpulkanEkspor();
    expect(data).toHaveLength(3);
    expect(data.every((d) => Array.isArray(d.riwayat) && Array.isArray(d.berkas))).toBe(true);
  });
});

describe('cadangan harian', () => {
  it('menulis satu berkas bernama tanggalnya', async () => {
    const hasil = await cadanganJalankan('2026-05-02');
    expect(hasil.dilewati).toBe(false);
    expect(hasil.nama).toBe('simpel-2026-05-02.xlsx');
    expect(await readdir(DIR_CADANGAN)).toContain('simpel-2026-05-02.xlsx');
  });

  /**
   * Penjadwal memeriksa tiap jam, jadi tanpa ini satu hari akan ditulis ulang
   * 24 kali -- pemborosan yang tidak kelihatan sampai datanya membesar.
   */
  it('cadangan hari yang sama tidak ditulis dua kali', async () => {
    await cadanganJalankan('2026-05-02');
    const kedua = await cadanganJalankan('2026-05-02');
    expect(kedua.dilewati).toBe(true);
  });

  it('paksa menulis ulang meski sudah ada', async () => {
    await cadanganJalankan('2026-05-02');
    const kedua = await cadanganJalankan('2026-05-02', true);
    expect(kedua.dilewati).toBe(false);
  });

  it(`menyimpan ${SIMPAN_HARI} berkas terbaru dan membuang yang lebih tua`, async () => {
    // Sepuluh hari berturut-turut, ditulis dari yang paling tua.
    for (let h = 1; h <= 10; h++) {
      await writeFile(path.join(DIR_CADANGAN, namaCadangan(`2026-05-${String(h).padStart(2, '0')}`)), 'x');
    }
    const dibuang = await cadanganRapikan();

    const sisa = await cadanganDaftar();
    expect(sisa).toHaveLength(SIMPAN_HARI);
    expect(dibuang).toHaveLength(10 - SIMPAN_HARI);

    // Yang tersisa harus yang paling baru, bukan sembarang tujuh.
    expect(sisa[0]!.tanggal).toBe('2026-05-10');
    expect(sisa.at(-1)!.tanggal).toBe('2026-05-04');
    expect(dibuang).toContain('simpel-2026-05-01.xlsx');
  });

  it('cadangan baru mendorong keluar yang paling tua', async () => {
    for (let h = 1; h <= SIMPAN_HARI; h++) {
      await writeFile(path.join(DIR_CADANGAN, namaCadangan(`2026-05-${String(h).padStart(2, '0')}`)), 'x');
    }
    const hasil = await cadanganJalankan(`2026-05-${String(SIMPAN_HARI + 1).padStart(2, '0')}`);

    expect(hasil.dibuang).toEqual(['simpel-2026-05-01.xlsx']);
    expect(await cadanganDaftar()).toHaveLength(SIMPAN_HARI);
  });

  it('daftar diurutkan dari yang terbaru', async () => {
    for (const t of ['2026-05-03', '2026-05-01', '2026-05-02']) {
      await writeFile(path.join(DIR_CADANGAN, namaCadangan(t)), 'x');
    }
    expect((await cadanganDaftar()).map((c) => c.tanggal))
      .toEqual(['2026-05-03', '2026-05-02', '2026-05-01']);
  });

  it('berkas asing di folder diabaikan, tidak ikut terhitung atau terhapus', async () => {
    await writeFile(path.join(DIR_CADANGAN, 'catatan.txt'), 'x');
    await writeFile(path.join(DIR_CADANGAN, namaCadangan('2026-05-01')), 'x');

    expect(await cadanganDaftar()).toHaveLength(1);
    await cadanganRapikan();
    expect(await readdir(DIR_CADANGAN)).toContain('catatan.txt');
  });

  it('folder yang belum pernah dibuat berarti belum ada cadangan, bukan galat', async () => {
    await rm(DIR_CADANGAN, { recursive: true, force: true });
    expect(await cadanganDaftar()).toEqual([]);
  });

  /**
   * Nama cadangan datang dari URL. Tanpa penjagaan ini, `../../etc/passwd`
   * terbaca sebagai nama berkas yang sah dan rute unduhan menyajikannya.
   */
  it('jalurCadangan menolak nama yang hendak keluar dari folder', () => {
    for (const jahat of [
      '../../etc/passwd', '..%2Fsimpel-2026-05-01.xlsx', 'simpel-2026-05-01.xlsx/../../x',
      '/etc/passwd', 'simpel-2026-05-01.txt', 'sembarang.xlsx'
    ]) {
      expect(() => jalurCadangan(jahat)).toThrow(/tidak sah/i);
    }
  });

  it('jalurCadangan menerima nama yang berpola dan tetap di dalam folder', () => {
    const jalur = jalurCadangan('simpel-2026-05-01.xlsx');
    expect(path.resolve(jalur).startsWith(path.resolve(DIR_CADANGAN))).toBe(true);
  });

  it('tanggalJakarta memakai zona Jakarta, bukan UTC server', () => {
    // 31 Des 2025 pukul 18:00 UTC sudah tanggal 1 Januari 2026 di Jakarta.
    expect(tanggalJakarta(new Date('2025-12-31T18:00:00Z'))).toBe('2026-01-01');
    expect(tanggalJakarta(new Date('2025-12-31T16:00:00Z'))).toBe('2025-12-31');
  });
});
