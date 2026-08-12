import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { gzipSync } from 'node:zlib';
import { readdir, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { buatApp } from '../index.js';
import { pool, kueri, siapkanSkema } from '../db.js';
import { _resetPembatas } from '../middleware/rate-limit.js';
import { adminBuat, adminCari } from '../repo/admin.js';
import { pengajuanBuat, pengajuanCariNomor } from '../repo/pengajuan.js';
import { susunTar, bacaTar } from '../pure/tar.js';
import { buatCadanganPenuh } from '../services/cadangan-penuh.js';
import { periksaArsip, pulihkanDariArsip, bongkarArsip } from '../services/pulihkan.js';
import { DIR_BERKAS } from '../services/simpanan.js';
import { DIR_CADANGAN } from '../services/cadangan.js';

const app = buatApp();
const EMAIL = 'bos@uji.local';
const SANDI = 'sandi-uji-panjang';

const CONTOH = {
  opd_id: null, opd_teks: 'BPKAD', jenis_peraturan: 'Bupati' as const,
  judul: 'Raperbup tentang Percontohan', nama_pemohon: 'Mayasari',
  wa_pemohon: '082299989690', email_pemohon: 'maya@uji.local'
};

async function masuk() {
  const agen = request.agent(app);
  await agen.post('/api/auth/masuk').send({ email: EMAIL, sandi: SANDI }).expect(200);
  return agen;
}

async function buangCadanganUji() {
  try {
    for (const n of await readdir(DIR_CADANGAN)) {
      if (n.startsWith('sebelum-pulih-')) await rm(path.join(DIR_CADANGAN, n), { force: true });
    }
  } catch { /* folder belum ada */ }
}

beforeAll(async () => { await siapkanSkema(); });
beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  _resetPembatas();
  await kueri(`DELETE FROM pengajuan`);
  await kueri(`DELETE FROM admin`);
  await adminBuat(EMAIL, 'Bos', SANDI);
  await buangCadanganUji();
});
afterAll(async () => {
  await kueri(`DELETE FROM pengajuan`);
  await kueri(`DELETE FROM admin`);
  await buangCadanganUji();
  await pool.end();
});

describe('bacaTar', () => {
  it('membaca kembali apa yang ditulis susunTar', () => {
    const entri = [
      { nama: 'a.txt', isi: Buffer.from('satu') },
      { nama: 'berkas/b.pdf', isi: Buffer.from('x'.repeat(700)) }
    ];
    const hasil = bacaTar(susunTar(entri));
    expect(hasil.map((e) => e.nama)).toEqual(['a.txt', 'berkas/b.pdf']);
    expect(hasil[1]!.isi).toEqual(entri[1]!.isi);
  });

  /**
   * Arsip pemulihan diunggah manusia dan belum tentu buatan sistem ini.
   * '../../etc/cron.d/x' di dalam tar adalah cara klasik menulis ke mana pun
   * lewat fitur "pulihkan cadangan".
   */
  it('menolak nama yang hendak keluar dari folder tujuan', () => {
    for (const jahat of ['../../etc/passwd', '/etc/passwd', 'berkas/../../x', 'a\\b']) {
      expect(() => bacaTar(susunTar([{ nama: jahat, isi: Buffer.from('x') }])))
        .toThrow(/tidak sah/i);
    }
  });

  it('arsip terpotong dilaporkan, bukan menghasilkan isi separuh', () => {
    const utuh = susunTar([{ nama: 'a.txt', isi: Buffer.from('y'.repeat(1000)) }]);
    expect(() => bacaTar(utuh.subarray(0, 700))).toThrow(/terpotong/i);
  });

  it('berhenti di blok nol, tidak membaca sampah sesudahnya', () => {
    const tar = Buffer.concat([
      susunTar([{ nama: 'a.txt', isi: Buffer.from('satu') }]),
      Buffer.from('sampah'.repeat(200))
    ]);
    expect(bacaTar(tar).map((e) => e.nama)).toEqual(['a.txt']);
  });
});

describe('periksaArsip', () => {
  it('mengenali cadangan penuh yang sah', async () => {
    const arsip = await buatCadanganPenuh();
    const h = periksaArsip(arsip.isi);
    expect(h.sah).toBe(true);
    expect(h.tabel).toEqual(expect.arrayContaining(['opd', 'pengajuan', 'riwayat', 'berkas']));
  });

  it('tar polos tanpa gzip juga diterima', async () => {
    const entri = bacaTar(
      (await import('node:zlib')).gunzipSync((await buatCadanganPenuh()).isi)
    );
    expect(periksaArsip(susunTar(entri)).sah).toBe(true);
  });

  it('arsip tanpa basis-data.sql ditolak dengan alasan yang jelas', () => {
    const h = periksaArsip(gzipSync(susunTar([{ nama: 'lain.txt', isi: Buffer.from('x') }])));
    expect(h.sah).toBe(false);
    expect(h.pesan).toMatch(/basis-data\.sql/);
  });

  it('berkas sembarang ditolak, bukan meledak', () => {
    expect(periksaArsip(Buffer.from('ini bukan arsip')).sah).toBe(false);
    expect(periksaArsip(Buffer.alloc(0)).sah).toBe(false);
  });

  it('gzip rusak dilaporkan sebagai gzip rusak', () => {
    const rusak = Buffer.concat([Buffer.from([0x1f, 0x8b]), Buffer.alloc(50)]);
    expect(periksaArsip(rusak).pesan).toMatch(/gzip/i);
  });
});

describe('pulihkanDariArsip', () => {
  it('mengembalikan data yang sudah terhapus', async () => {
    const p = await pengajuanBuat(CONTOH);
    const arsip = await buatCadanganPenuh();

    await kueri(`DELETE FROM pengajuan`);
    expect(await pengajuanCariNomor(p.nomor)).toBeNull();

    const hasil = await pulihkanDariArsip(arsip.isi);
    expect(hasil.pernyataanDijalankan).toBeGreaterThan(0);
    expect((await pengajuanCariNomor(p.nomor))!.judul).toBe(CONTOH.judul);
  });

  /**
   * Pemulihan ke database yang sudah berisi tidak boleh menggabungkan data
   * lama dengan data cadangan diam-diam -- cara paling halus untuk merusak
   * data saat pindah server.
   */
  it('mengganti, bukan menggabung', async () => {
    await pengajuanBuat({ ...CONTOH, judul: 'Ada di cadangan' });
    const arsip = await buatCadanganPenuh();

    await pengajuanBuat({ ...CONTOH, judul: 'Masuk setelah cadangan dibuat' });
    expect(await kueri(`SELECT id FROM pengajuan`)).toHaveLength(2);

    await pulihkanDariArsip(arsip.isi);
    const sisa = await kueri<{ judul: string }>(`SELECT judul FROM pengajuan`);
    expect(sisa).toHaveLength(1);
    expect(sisa[0]!.judul).toBe('Ada di cadangan');
  });

  /** Akun admin ikut dipulihkan; itulah yang membuat pemulihan di server baru
   *  bisa dilanjutkan dengan kata sandi lama. */
  it('akun admin dari cadangan bisa dipakai masuk lagi', async () => {
    await adminBuat('lama@uji.local', 'Admin Lama', 'sandi-lama-panjang');
    const arsip = await buatCadanganPenuh();

    await kueri(`DELETE FROM admin`);
    await adminBuat('baru@uji.local', 'Admin Baru', 'sandi-baru-panjang');

    await pulihkanDariArsip(arsip.isi);
    expect(await adminCari('lama@uji.local')).not.toBeNull();
    expect(await adminCari('baru@uji.local')).toBeNull();
  });

  /** Kalau pemulihan sampai merusak data, inilah satu-satunya jalan pulang. */
  it('menyalin keadaan sekarang sebelum menimpa', async () => {
    await pengajuanBuat({ ...CONTOH, judul: 'Akan tertimpa' });
    const arsip = await buatCadanganPenuh();
    await kueri(`DELETE FROM pengajuan`);

    const hasil = await pulihkanDariArsip(arsip.isi);
    expect(hasil.cadanganSebelumnya).toMatch(/^sebelum-pulih-/);
    expect(await readdir(DIR_CADANGAN)).toContain(hasil.cadanganSebelumnya);
  });

  it('berkas unggahan ikut kembali ke disk', async () => {
    const nama = 'uji-pulih-berkas.pdf';
    const arsip = gzipSync(susunTar([
      { nama: 'basis-data.sql', isi: Buffer.from(bacaDumpKosong()) },
      { nama: `berkas/${nama}`, isi: Buffer.from('isi pdf dipulihkan') }
    ]));

    try {
      const hasil = await pulihkanDariArsip(arsip);
      expect(hasil.berkasDipulihkan).toBe(1);
      expect(await readFile(path.join(DIR_BERKAS, nama), 'utf8')).toBe('isi pdf dipulihkan');
    } finally {
      await rm(path.join(DIR_BERKAS, nama), { force: true });
    }
  });

  it('arsip tidak sah ditolak tanpa menyentuh data', async () => {
    const p = await pengajuanBuat(CONTOH);
    await expect(pulihkanDariArsip(Buffer.from('bukan arsip'))).rejects.toThrow();
    expect(await pengajuanCariNomor(p.nomor)).not.toBeNull();
  });
});

/** Dump paling sederhana yang tetap sah: satu tabel apa adanya. */
function bacaDumpKosong(): string {
  return [
    '-- Dibuat: 2026-08-12T00:00:00.000Z',
    'DROP TABLE IF EXISTS `uji_pulih`;',
    'CREATE TABLE `uji_pulih` (`id` INT NOT NULL) ENGINE=InnoDB;',
    ''
  ].join('\n');
}

describe('rute pulihkan', () => {
  for (const awalan of ['/api/setup', '/api/admin']) {
    it(`${awalan} menolak tanpa sesi admin`, async () => {
      await request(app).post(`${awalan}/pulihkan`)
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from('x') as never)
        .expect(401);
    });

    it(`${awalan} memeriksa arsip tanpa mengubah apa pun`, async () => {
      const p = await pengajuanBuat(CONTOH);
      const arsip = await buatCadanganPenuh();
      const agen = await masuk();

      const r = await agen.post(`${awalan}/pulihkan/periksa`)
        .set('Content-Type', 'application/octet-stream')
        .send(arsip.isi as never)
        .expect(200);

      expect(r.body.sah).toBe(true);
      expect(r.body.tabel).toContain('pengajuan');
      expect(await pengajuanCariNomor(p.nomor)).not.toBeNull();
    });

    it(`${awalan} memulihkan dan melaporkan hasilnya`, async () => {
      const p = await pengajuanBuat(CONTOH);
      const arsip = await buatCadanganPenuh();
      await kueri(`DELETE FROM pengajuan`);

      const agen = await masuk();
      const r = await agen.post(`${awalan}/pulihkan`)
        .set('Content-Type', 'application/octet-stream')
        .send(arsip.isi as never)
        .expect(200);

      expect(r.body.pernyataanDijalankan).toBeGreaterThan(0);
      expect(await pengajuanCariNomor(p.nomor)).not.toBeNull();
    });

    it(`${awalan} arsip rusak dijawab pesan terbaca, bukan 500`, async () => {
      const agen = await masuk();
      const r = await agen.post(`${awalan}/pulihkan`)
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from('bukan arsip sama sekali') as never)
        .expect(400);
      expect(r.body.galat).not.toMatch(/kesalahan di server/i);
    });
  }
});

describe('bongkarArsip', () => {
  it('menerima gzip maupun tar polos', async () => {
    const tar = susunTar([{ nama: 'a.txt', isi: Buffer.from('halo') }]);
    expect(bongkarArsip(tar)[0]!.nama).toBe('a.txt');
    expect(bongkarArsip(gzipSync(tar))[0]!.nama).toBe('a.txt');
  });
});
