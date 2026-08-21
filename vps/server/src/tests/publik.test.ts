import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buatApp } from '../index.js';
import { pool, kueri, siapkanSkema } from '../db.js';
import { pengajuanBuat } from '../repo/pengajuan.js';
import { riwayatTambah } from '../repo/riwayat.js';
import { pengaturanSetel } from '../repo/pengaturan.js';

const app = buatApp();
let nomorUji = '';

beforeAll(async () => {
  await siapkanSkema();
  await kueri(`DELETE FROM pengajuan`);
  const { id, nomor } = await pengajuanBuat({
    opd_id: null, opd_teks: 'BPKAD', jenis_peraturan: 'Bupati',
    judul: 'Raperbup Percontohan', nama_pemohon: 'Mayasari',
    wa_pemohon: '082299989690', email_pemohon: 'rahasia@uji.local'
  });
  nomorUji = nomor;
  await riwayatTambah(id, {
    tanggal: '2026-07-22', tahap: 'BERKAS_MASUK', keterangan: 'Berkas masuk ke sistem'
  }, 'sistem');
});

afterAll(async () => {
  await kueri(`DELETE FROM pengajuan`);
  await pool.end();
});

describe('GET /api/sehat', () => {
  it('menjawab ok tanpa perlu masuk', async () => {
    const r = await request(app).get('/api/sehat').expect(200);
    expect(r.body.status).toBe('ok');
  });
});

describe('GET /api/publik/monitoring', () => {
  it('mengembalikan hitungan dan daftar tanpa perlu masuk', async () => {
    const r = await request(app).get('/api/publik/monitoring').expect(200);
    expect(r.body.hitungan.TOTAL).toBe(1);
    expect(r.body.hitungan.PROSES).toBe(1);
    expect(r.body.daftar[0].judul).toBe('Raperbup Percontohan');
    expect(r.body.daftar[0].terakhir.keterangan).toBe('Berkas masuk ke sistem');
  });

  it('menampilkan nomor WA lengkap saat sakelar menyala', async () => {
    const r = await request(app).get('/api/publik/monitoring').expect(200);
    expect(r.body.daftar[0].wa_pemohon).toBe('0822-9998-9690');
  });

  it('menyamarkan nomor WA saat sakelar dimatikan', async () => {
    await pengaturanSetel('publik_tampilkan_wa', 'FALSE');
    const r = await request(app).get('/api/publik/monitoring').expect(200);
    expect(r.body.daftar[0].wa_pemohon).toBe('0822****9690');
    await pengaturanSetel('publik_tampilkan_wa', 'TRUE');
  });

  /**
   * Halaman ini terbuka untuk umum. Alamat surel pemohon tidak punya alasan
   * ikut terkirim ke sana, apa pun setelan sakelarnya.
   */
  it('tidak pernah mengirim email pemohon ke publik', async () => {
    const r = await request(app).get('/api/publik/monitoring').expect(200);
    expect(JSON.stringify(r.body)).not.toContain('rahasia@uji.local');
  });

  /**
   * Posisi rel dikirim dari server, bukan disimpulkan peramban dari `terakhir`:
   * peramban hanya menerima kejadian terakhir, sementara posisi rel butuh
   * seluruh riwayat. Logika pemetaannya sendiri diuji di pure/tahap.test.ts;
   * di sini yang diperiksa cuma sambungannya sampai ke jawaban rute.
   */
  it('mengirim posisi rel tahap untuk kartu monitoring', async () => {
    const r = await request(app).get('/api/publik/monitoring').expect(200);
    expect(r.body.daftar[0].tahap_indeks).toBe(1);
    expect(r.body.daftar[0].tahap_total).toBe(6);
  });
});

describe('GET /api/publik/detail/:nomor', () => {
  /**
   * Rel yang sama dipakai di halaman detail. Posisinya tetap dihitung server
   * supaya pemetaan tahap ke stasiun hanya hidup di satu tempat, bukan
   * disalin ulang ke peramban.
   */
  it('mengirim posisi rel tahap yang sama seperti di monitoring', async () => {
    const r = await request(app).get(`/api/publik/detail/${nomorUji}`).expect(200);
    expect(r.body.tahap_indeks).toBe(1);
    expect(r.body.tahap_total).toBe(6);
  });

  it('mengembalikan pengajuan beserta riwayatnya', async () => {
    const r = await request(app).get(`/api/publik/detail/${nomorUji}`).expect(200);
    expect(r.body.ada).toBe(true);
    expect(r.body.pengajuan.nomor).toBe(nomorUji);
    expect(r.body.riwayat).toHaveLength(1);
    expect(r.body.riwayat[0].tanggal).toBe('2026-07-22');
  });

  it('menyembunyikan berkas saat sakelar dimatikan', async () => {
    await pengaturanSetel('publik_tampilkan_berkas', 'FALSE');
    const r = await request(app).get(`/api/publik/detail/${nomorUji}`).expect(200);
    expect(r.body.boleh.berkas).toBe(false);
    expect(r.body.berkas).toEqual([]);
    await pengaturanSetel('publik_tampilkan_berkas', 'TRUE');
  });

  it('nomor yang tidak ada dijawab 404 dengan pesan, bukan halaman kosong', async () => {
    const r = await request(app).get('/api/publik/detail/BRB-1900-9999').expect(404);
    expect(r.body.galat).toMatch(/tidak ditemukan/i);
  });

  it('tidak pernah mengirim email pemohon di halaman detail', async () => {
    const r = await request(app).get(`/api/publik/detail/${nomorUji}`).expect(200);
    expect(JSON.stringify(r.body)).not.toContain('rahasia@uji.local');
  });
});

describe('GET /api/publik/konteks', () => {
  it('mengirim daftar tahap dan status baku', async () => {
    const r = await request(app).get('/api/publik/konteks').expect(200);
    expect(r.body.tahap).toContain('REVIU_HUKUM');
    expect(r.body.status).toEqual(['PROSES', 'SELESAI', 'DIKEMBALIKAN']);
  });
});

describe('penjagaan admin', () => {
  it('rute admin ditolak tanpa sesi', async () => {
    const r = await request(app).get('/api/auth/saya').expect(401);
    expect(r.body.galat).toMatch(/Bagian Hukum/i);
  });

  it('masuk dengan kredensial salah ditolak tanpa membocorkan bedanya', async () => {
    const r = await request(app).post('/api/auth/masuk')
      .send({ email: 'tidak-ada@uji.local', sandi: 'salah' }).expect(401);
    expect(r.body.galat).toBe('Email atau kata sandi salah.');
  });
});
