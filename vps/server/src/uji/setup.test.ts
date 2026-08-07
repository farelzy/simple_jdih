import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { buatApp } from '../index.js';
import { pool, kueri, siapkanSkema } from '../db.js';
import { siapkanTokenPenyiapan, _tokenSaatIni } from '../rute/setup.js';
import { _resetPembatas } from '../tengah/rate-limit.js';
import { adminHitungAktif } from '../repo/admin.js';

const app = buatApp();

beforeAll(async () => { await siapkanSkema(); });

beforeEach(async () => {
  await kueri(`DELETE FROM admin`);
  await kueri(`DELETE FROM pengajuan`);
  vi.spyOn(console, 'log').mockImplementation(() => {});   // token tidak perlu membanjiri keluaran uji
  _resetPembatas();
  await siapkanTokenPenyiapan();
});

afterAll(async () => {
  await kueri(`DELETE FROM admin`);
  await kueri(`DELETE FROM pengajuan`);
  await pool.end();
});

const ADMIN = { email: 'hukum@uji.local', nama: 'Bagian Hukum', sandi: 'sandi-yang-cukup-panjang' };

describe('GET /api/setup/status', () => {
  it('melaporkan perlu setup saat belum ada admin', async () => {
    const r = await request(app).get('/api/setup/status').expect(200);
    expect(r.body.perluSetup).toBe(true);
  });
});

describe('POST /api/setup/admin', () => {
  it('menolak tanpa token', async () => {
    const r = await request(app).post('/api/setup/admin').send(ADMIN).expect(401);
    expect(r.body.galat).toMatch(/token/i);
    expect(await adminHitungAktif()).toBe(0);
  });

  it('menolak token yang salah', async () => {
    const r = await request(app).post('/api/setup/admin')
      .send({ ...ADMIN, token: 'karangan-belaka' }).expect(401);
    expect(r.body.galat).toMatch(/token/i);
    expect(await adminHitungAktif()).toBe(0);
  });

  it('membuat admin pertama dengan token yang benar dan langsung memasang sesi', async () => {
    const r = await request(app).post('/api/setup/admin')
      .send({ ...ADMIN, token: _tokenSaatIni() }).expect(200);
    expect(r.body.sukses).toBe(true);
    expect(r.body.email).toBe(ADMIN.email);
    expect(r.headers['set-cookie']?.[0]).toMatch(/simpel_sesi=/);
    expect(await adminHitungAktif()).toBe(1);
  });

  it('menolak sandi yang terlalu pendek', async () => {
    const r = await request(app).post('/api/setup/admin')
      .send({ ...ADMIN, sandi: 'pendek', token: _tokenSaatIni() }).expect(500);
    expect(await adminHitungAktif()).toBe(0);
    expect(r.body.galat).toBeDefined();
  });

  /**
   * Token adalah satu-satunya pagar halaman penyiapan, dan halaman itu ada di
   * URL publik. Kalau ia masih berlaku setelah dipakai, siapa pun yang pernah
   * melihatnya bisa membuat admin kedua kapan saja.
   */
  it('token hangus setelah dipakai sekali', async () => {
    const token = _tokenSaatIni();
    await request(app).post('/api/setup/admin').send({ ...ADMIN, token }).expect(200);
    expect(_tokenSaatIni()).toBe('');

    const r = await request(app).post('/api/setup/admin')
      .send({ ...ADMIN, email: 'kedua@uji.local', token }).expect(409);
    expect(r.body.galat).toMatch(/sudah disiapkan/i);
    expect(await adminHitungAktif()).toBe(1);
  });

  it('tidak menerbitkan token bila sistem sudah punya admin', async () => {
    await request(app).post('/api/setup/admin')
      .send({ ...ADMIN, token: _tokenSaatIni() }).expect(200);
    await siapkanTokenPenyiapan();
    expect(_tokenSaatIni()).toBe('');
  });

  it('status berubah jadi tidak perlu setup setelah admin ada', async () => {
    await request(app).post('/api/setup/admin')
      .send({ ...ADMIN, token: _tokenSaatIni() }).expect(200);
    const r = await request(app).get('/api/setup/status').expect(200);
    expect(r.body.perluSetup).toBe(false);
  });
});

describe('migrasi lewat penyiapan', () => {
  const CSV = [
    '"Timestamp","Nama OPD Pemohon","Jenis Rancangan Peraturan","Judul Raperda/Raperbup",' +
    '"Surat Permohonan Rancangan Perda/Perbup","Keterangan/Penjelasan Rancangan Perbup atau NA Perda",' +
    '"Rancangan Perda/Perbup","Lampiran Raperda/Raperbup","Paraf Koordinasi",' +
    '"Dasar Hukum Penyusunan Raperda/Raperbup","SK Tim Penyusunan RAPERDA",' +
    '"Berita Acara Rapat PANSUS AKHIR","Hasil Konsultasi","Nama Pemohon",' +
    '"Nomor WhatsApp Pemohon","Tanggal dan Detail Proses","Keterangan","Status"',
    '"29/04/2026 09:15:00","BPKAD","Bupati","Raperbup Uji","","","","","","","","","","Maya",' +
    '"0822-9998-9690","- 22 Juli 2026 Berkas masuk ke sistem","","PROSES"'
  ].join('\n');

  async function masuk() {
    const agen = request.agent(app);
    await agen.post('/api/setup/admin').send({ ...ADMIN, token: _tokenSaatIni() }).expect(200);
    return agen;
  }

  it('menolak periksa dan migrasi tanpa sesi admin', async () => {
    await request(app).post('/api/setup/periksa-sheet').send({ sumber: 'x' }).expect(401);
    await request(app).post('/api/setup/migrasi').send({ sumber: 'x' }).expect(401);
  });

  it('memeriksa CSV dan melaporkan jumlah barisnya', async () => {
    const agen = await masuk();
    const r = await agen.post('/api/setup/periksa-sheet').send({ sumber: 'x', isiCsv: CSV }).expect(200);
    expect(r.body.sah).toBe(true);
    expect(r.body.jumlahBaris).toBe(1);
  });

  it('mode uji-coba melaporkan tanpa menulis', async () => {
    const agen = await masuk();
    const r = await agen.post('/api/setup/migrasi')
      .send({ sumber: 'x', isiCsv: CSV, ujiCoba: true }).expect(200);
    expect(r.body.barisDisisipkan).toBe(1);
    const sisa = await kueri(`SELECT id FROM pengajuan`);
    expect(sisa).toHaveLength(0);
  });

  it('migrasi sungguhan menyimpan pengajuan beserta riwayatnya', async () => {
    const agen = await masuk();
    const r = await agen.post('/api/setup/migrasi')
      .send({ sumber: 'x', isiCsv: CSV, ujiCoba: false }).expect(200);
    expect(r.body.barisDisisipkan).toBe(1);
    expect(r.body.selisihKolom16).toEqual([]);

    const monitoring = await request(app).get('/api/publik/monitoring').expect(200);
    expect(monitoring.body.hitungan.TOTAL).toBe(1);
    expect(monitoring.body.daftar[0].judul).toBe('Raperbup Uji');
  });
});
