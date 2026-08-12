import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { gunzipSync } from 'node:zlib';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { buatApp } from '../index.js';
import { pool, kueri, siapkanSkema } from '../db.js';
import { _resetPembatas } from '../middleware/rate-limit.js';
import { adminBuat } from '../repo/admin.js';
import { pengajuanBuat } from '../repo/pengajuan.js';
import { berkasTambah } from '../repo/berkas.js';
import { susunTar } from '../pure/tar.js';
import { dumpSql, buatCadanganPenuh } from '../services/cadangan-penuh.js';
import { DIR_BERKAS } from '../services/simpanan.js';

const app = buatApp();
const EMAIL = 'bos@uji.local';
const SANDI = 'sandi-uji-panjang';

const CONTOH = {
  opd_id: null, opd_teks: 'BPKAD', jenis_peraturan: 'Bupati' as const,
  judul: 'Raperbup tentang Percontohan', nama_pemohon: 'Mayasari',
  wa_pemohon: '082299989690', email_pemohon: 'maya@uji.local'
};

/** Bongkar tar jadi peta nama -> isi. Cukup untuk memeriksa hasil susunTar. */
function bongkarTar(tar: Buffer): Map<string, Buffer> {
  const hasil = new Map<string, Buffer>();
  let p = 0;
  while (p + 512 <= tar.length) {
    const kepala = tar.subarray(p, p + 512);
    const nama = kepala.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    if (!nama) break;                                   // dua blok nol = akhir arsip
    const ukuran = parseInt(kepala.subarray(124, 136).toString('utf8').replace(/\0.*$/, ''), 8);
    p += 512;
    hasil.set(nama, tar.subarray(p, p + ukuran));
    p += Math.ceil(ukuran / 512) * 512;
  }
  return hasil;
}

async function masuk() {
  const agen = request.agent(app);
  await agen.post('/api/auth/masuk').send({ email: EMAIL, sandi: SANDI }).expect(200);
  return agen;
}

beforeAll(async () => { await siapkanSkema(); });
beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  _resetPembatas();
  await kueri(`DELETE FROM pengajuan`);
  await kueri(`DELETE FROM admin`);
  await adminBuat(EMAIL, 'Bos', SANDI);
});
afterAll(async () => {
  await kueri(`DELETE FROM pengajuan`);
  await kueri(`DELETE FROM admin`);
  await pool.end();
});

describe('susunTar', () => {
  it('satu berkas bisa dibongkar kembali utuh', () => {
    const tar = susunTar([{ nama: 'halo.txt', isi: Buffer.from('isi berkas') }]);
    expect(bongkarTar(tar).get('halo.txt')?.toString()).toBe('isi berkas');
  });

  it('beberapa berkas berukuran ganjil tetap terbaca satu per satu', () => {
    // Ukuran yang bukan kelipatan 512 adalah tempat bantalan blok paling mudah
    // salah hitung; kalau meleset, berkas berikutnya ikut bergeser.
    const entri = [
      { nama: 'a.txt', isi: Buffer.from('x'.repeat(1)) },
      { nama: 'b.txt', isi: Buffer.from('y'.repeat(511)) },
      { nama: 'c.txt', isi: Buffer.from('z'.repeat(513)) },
      { nama: 'd.txt', isi: Buffer.from('w'.repeat(1024)) }
    ];
    const isi = bongkarTar(susunTar(entri));
    for (const e of entri) expect(isi.get(e.nama)).toEqual(e.isi);
  });

  it('panjang arsip selalu kelipatan 512', () => {
    const tar = susunTar([{ nama: 'a', isi: Buffer.from('123') }]);
    expect(tar.length % 512).toBe(0);
  });

  /** Tanpa dua blok nol di akhir, sebagian pembaca tar melaporkan berkasnya
   *  terpotong walau isinya sudah lengkap. */
  it('diakhiri dua blok nol', () => {
    const tar = susunTar([{ nama: 'a', isi: Buffer.from('1') }]);
    expect(tar.subarray(tar.length - 1024)).toEqual(Buffer.alloc(1024));
  });

  /**
   * Checksum dihitung dengan kolomnya sendiri dianggap berisi spasi. Kalau
   * salah, tar sistem menolak arsipnya dengan "checksum error" -- dan itu baru
   * ketahuan saat seseorang benar-benar memulihkan cadangan.
   */
  it('checksum kepala cocok dengan isinya', () => {
    const tar = susunTar([{ nama: 'a.txt', isi: Buffer.from('halo') }]);
    const kepala = Buffer.from(tar.subarray(0, 512));
    const tertulis = parseInt(kepala.subarray(148, 156).toString('utf8').trim().replace(/\0/g, ''), 8);

    kepala.write('        ', 148, 8, 'utf8');
    let jumlah = 0;
    for (const b of kepala) jumlah += b;
    expect(tertulis).toBe(jumlah);
  });

  it('nama yang terlalu panjang ditolak, bukan dipotong diam-diam', () => {
    expect(() => susunTar([{ nama: 'x'.repeat(120), isi: Buffer.alloc(0) }]))
      .toThrow(/terlalu panjang/i);
  });

  it('berkas kosong tetap punya entri sendiri', () => {
    expect(bongkarTar(susunTar([{ nama: 'kosong', isi: Buffer.alloc(0) }])).has('kosong')).toBe(true);
  });
});

describe('dumpSql', () => {
  it('memuat struktur dan data seluruh tabel', async () => {
    await pengajuanBuat(CONTOH);
    const sql = await dumpSql();

    for (const t of ['opd', 'admin', 'pengaturan', 'pengajuan', 'riwayat', 'berkas', 'log']) {
      expect(sql).toContain(`CREATE TABLE \`${t}\``);
      expect(sql).toContain(`DROP TABLE IF EXISTS \`${t}\``);
    }
    expect(sql).toContain('Raperbup tentang Percontohan');
  });

  /**
   * DROP TABLE ada supaya pemulihan ke database yang sudah berisi tidak
   * menggabungkan data lama dengan data cadangan diam-diam -- cara paling
   * halus untuk merusak data saat pindah server.
   */
  it('mematikan pemeriksaan kunci asing lalu menyalakannya lagi', async () => {
    const sql = await dumpSql();
    expect(sql).toContain('SET FOREIGN_KEY_CHECKS = 0;');
    expect(sql.trimEnd().endsWith('SET FOREIGN_KEY_CHECKS = 1;')).toBe(true);
  });

  it('petik tunggal di dalam data tidak merusak pernyataan', async () => {
    await pengajuanBuat({ ...CONTOH, judul: "Raperbup 'Uji' \\ Petik" });
    const sql = await dumpSql();
    expect(sql).toContain('\\\'Uji\\\'');
  });

  it('tabel kosong tidak menghasilkan INSERT tanpa nilai', async () => {
    await kueri(`DELETE FROM pengajuan`);
    const sql = await dumpSql();
    expect(sql).not.toMatch(/INSERT INTO `pengajuan` \([^)]*\) VALUES\s*;/);
  });
});

describe('cadangan penuh', () => {
  it('berisi petunjuk, dump, dan salinan Excel', async () => {
    const hasil = await buatCadanganPenuh();
    const isi = bongkarTar(gunzipSync(hasil.isi));

    expect([...isi.keys()]).toEqual(
      expect.arrayContaining(['PEMULIHAN.txt', 'basis-data.sql', 'pengajuan.xlsx'])
    );
    expect(hasil.nama).toMatch(/^simpel-penuh-\d{4}-\d{2}-\d{2}\.tar\.gz$/);
  });

  it('membawa berkas unggahan yang ada di disk', async () => {
    await mkdir(DIR_BERKAS, { recursive: true });
    const nama = 'uji-cadangan-penuh.pdf';
    await writeFile(path.join(DIR_BERKAS, nama), 'isi pdf palsu');

    try {
      const hasil = await buatCadanganPenuh();
      const isi = bongkarTar(gunzipSync(hasil.isi));
      expect(isi.get(`berkas/${nama}`)?.toString()).toBe('isi pdf palsu');
      expect(hasil.jumlahBerkas).toBeGreaterThan(0);
    } finally {
      await rm(path.join(DIR_BERKAS, nama), { force: true });
    }
  });

  /** Isinya memuat hash sandi dan seluruh kode OPD; peringatannya harus ada di
   *  berkas itu sendiri, bukan cuma di layar yang sudah lama ditutup. */
  it('petunjuk menyebut bahwa isinya rahasia', async () => {
    const isi = bongkarTar(gunzipSync((await buatCadanganPenuh()).isi));
    const teks = isi.get('PEMULIHAN.txt')!.toString('utf8');
    expect(teks).toMatch(/PERINGATAN/);
    expect(teks).toMatch(/kode OPD/i);
    expect(teks).toMatch(/mysql -u simpel -p simpel < basis-data\.sql/);
  });

  it('berkas bersumber tautan tidak dianggap ikut tersalin', async () => {
    const p = await pengajuanBuat(CONTOH);
    await berkasTambah(p.id, {
      kolom: 'surat_permohonan', nama: 'surat.pdf', ukuran: 0, mime: '',
      sumber: 'tautan', jalur: 'https://drive.google.com/file/d/x/view'
    });
    const teks = bongkarTar(gunzipSync((await buatCadanganPenuh()).isi))
      .get('PEMULIHAN.txt')!.toString('utf8');
    expect(teks).toMatch(/YANG TIDAK IKUT/);
  });

  it('rute menolak tanpa sesi admin', async () => {
    await request(app).get('/api/admin/cadangan-penuh').expect(401);
  });

  it('rute mengirim arsip gzip yang bisa dibuka', async () => {
    const agen = await masuk();
    const r = await agen.get('/api/admin/cadangan-penuh')
      .buffer(true)
      .parse((res, cb) => {
        const potongan: Buffer[] = [];
        res.on('data', (p: Buffer) => potongan.push(p));
        res.on('end', () => cb(null, Buffer.concat(potongan)));
      })
      .expect(200);

    expect(r.headers['content-disposition']).toMatch(/simpel-penuh-.*\.tar\.gz/);
    expect(bongkarTar(gunzipSync(r.body as Buffer)).has('basis-data.sql')).toBe(true);
  });
});
