import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { buatApp } from '../index.js';
import { pool, kueri, siapkanSkema } from '../db.js';
import { adminBuat, adminHitungAktif } from '../repo/admin.js';
import { pengajuanBuat, pengajuanCariNomor } from '../repo/pengajuan.js';
import { riwayatUntuk } from '../repo/riwayat.js';
import { _resetPembatas } from '../middleware/rate-limit.js';

const app = buatApp();
const SANDI = 'sandi-admin-panjang';
const EMAIL = 'bos@uji.local';

async function masuk() {
  const agen = request.agent(app);
  await agen.post('/api/auth/masuk').send({ email: EMAIL, sandi: SANDI }).expect(200);
  return agen;
}

async function buatPengajuan(judul = 'Uji Dashboard') {
  return pengajuanBuat({
    opd_id: null, opd_teks: 'BPKAD', jenis_peraturan: 'Bupati',
    judul, nama_pemohon: 'Uji', wa_pemohon: '082299989690', email_pemohon: 'p@uji.local'
  });
}

beforeAll(async () => { await siapkanSkema(); });

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  _resetPembatas();
  await kueri(`DELETE FROM pengajuan`);
  await kueri(`DELETE FROM admin`);
  await kueri(`DELETE FROM opd WHERE kode LIKE 'UJI%'`);
  await adminBuat(EMAIL, 'Bos', SANDI);
});

afterAll(async () => {
  await kueri(`DELETE FROM pengajuan`);
  await kueri(`DELETE FROM admin`);
  await kueri(`DELETE FROM opd WHERE kode LIKE 'UJI%'`);
  await pool.end();
});

describe('penjagaan', () => {
  it('seluruh rute admin menolak permintaan tanpa sesi', async () => {
    await request(app).get('/api/admin/data').expect(401);
    await request(app).get('/api/admin/log').expect(401);
    await request(app).post('/api/admin/riwayat').send({}).expect(401);
    await request(app).post('/api/admin/status').send({}).expect(401);
    await request(app).post('/api/admin/opd').send({}).expect(401);
    await request(app).post('/api/admin/admin').send({}).expect(401);
    await request(app).post('/api/admin/pengaturan').send({}).expect(401);
    await request(app).post('/api/admin/migrasi').send({}).expect(401);
  });
});

describe('GET /api/admin/data', () => {
  it('mengirim antrean, rekap, pengaturan, dan daftar admin', async () => {
    await buatPengajuan();
    const agen = await masuk();
    const r = await agen.get('/api/admin/data').expect(200);

    expect(r.body.emailSaya).toBe(EMAIL);
    expect(r.body.antrean).toHaveLength(1);
    expect(r.body.rekap.status.TOTAL).toBe(1);
    expect(r.body.pengaturan.batas_lampiran).toBe('30');
    expect(r.body.admin.some((a: { email: string }) => a.email === EMAIL)).toBe(true);
    expect(r.body.tahap).toContain('REVIU_HUKUM');
  });

  it('daftar admin tidak pernah memuat hash sandi', async () => {
    const agen = await masuk();
    const r = await agen.get('/api/admin/data').expect(200);
    for (const a of r.body.admin) expect(a).not.toHaveProperty('password_hash');
    expect(JSON.stringify(r.body)).not.toContain('$2a$');
  });

  it('antrean hanya memuat PROSES, terlama tidak bergerak di atas', async () => {
    const lama = await buatPengajuan('Paling lama');
    await buatPengajuan('Paling baru');
    await kueri(`UPDATE pengajuan SET diperbarui_pada = '2020-01-01 00:00:00' WHERE id = ?`, [lama.id]);

    const agen = await masuk();
    const r = await agen.get('/api/admin/data').expect(200);
    expect(r.body.antrean[0].judul).toBe('Paling lama');
    expect(r.body.antrean[0].mandek).toBe(true);
    expect(r.body.antrean[1].mandek).toBe(false);
  });
});

describe('riwayat dan status', () => {
  it('menambah riwayat lalu terlihat di halaman detail publik', async () => {
    const { nomor } = await buatPengajuan();
    const agen = await masuk();
    await agen.post('/api/admin/riwayat')
      .send({ nomor, tanggal: '2026-07-22', tahap: 'REVIU_HUKUM', keterangan: 'Sedang direviu' })
      .expect(200);

    const p = await pengajuanCariNomor(nomor);
    expect(await riwayatUntuk(p!.id)).toHaveLength(1);

    const detail = await request(app).get(`/api/publik/detail/${nomor}`).expect(200);
    expect(detail.body.riwayat[0].keterangan).toBe('Sedang direviu');
  });

  it('tahap di luar daftar baku ditolak', async () => {
    const { nomor } = await buatPengajuan();
    const agen = await masuk();
    await agen.post('/api/admin/riwayat')
      .send({ nomor, tanggal: '2026-07-22', tahap: 'NGAWUR', keterangan: '' })
      .expect(500);
  });

  it('DIKEMBALIKAN tanpa alasan ditolak', async () => {
    const { nomor } = await buatPengajuan();
    const agen = await masuk();
    await agen.post('/api/admin/status').send({ nomor, status: 'DIKEMBALIKAN', alasan: '' }).expect(500);
    expect((await pengajuanCariNomor(nomor))!.status).toBe('PROSES');
  });

  it('DIKEMBALIKAN dengan alasan tersimpan dan terbaca publik', async () => {
    const { nomor } = await buatPengajuan();
    const agen = await masuk();
    await agen.post('/api/admin/status')
      .send({ nomor, status: 'DIKEMBALIKAN', alasan: 'Belum ada hasil konsultasi' }).expect(200);

    const detail = await request(app).get(`/api/publik/detail/${nomor}`).expect(200);
    expect(detail.body.pengajuan.status).toBe('DIKEMBALIKAN');
    expect(detail.body.pengajuan.keterangan).toBe('Belum ada hasil konsultasi');
  });
});

describe('kelola admin', () => {
  it('menambah admin baru', async () => {
    const agen = await masuk();
    await agen.post('/api/admin/admin')
      .send({ email: 'kedua@uji.local', nama: 'Kedua', sandi: 'sandi-kedua-panjang' })
      .expect(200);
    expect(await adminHitungAktif()).toBe(2);
  });

  it('menolak sandi yang terlalu pendek', async () => {
    const agen = await masuk();
    await agen.post('/api/admin/admin')
      .send({ email: 'x@uji.local', nama: 'X', sandi: 'pendek' }).expect(500);
  });

  /**
   * Dua penjagaan yang mencegah sistem terkunci dari dirinya sendiri.
   */
  it('tidak bisa menghapus akun sendiri', async () => {
    const agen = await masuk();
    const data = await agen.get('/api/admin/data').expect(200);
    const saya = data.body.admin.find((a: { email: string }) => a.email === EMAIL);
    const r = await agen.delete(`/api/admin/admin/${saya.id}`).expect(400);
    expect(r.body.galat).toMatch(/sendiri/i);
  });

  /**
   * Admin terakhir selalu diri sendiri, jadi penjagaan "akun sendiri" yang
   * lebih dulu menangkapnya. Penjagaan "admin terakhir" baru terpakai pada
   * jalur yang lebih licik: dua admin sama-sama masuk, saling menghapus.
   */
  it('menghapus admin terakhir tertangkap penjagaan akun sendiri', async () => {
    const agen = await masuk();
    const data = await agen.get('/api/admin/data').expect(200);
    const saya = data.body.admin.find((a: { email: string }) => a.email === EMAIL);
    const r = await agen.delete(`/api/admin/admin/${saya.id}`).expect(400);
    expect(r.body.galat).toMatch(/sendiri/i);
    expect(await adminHitungAktif()).toBe(1);
  });

  /**
   * Token berumur 12 jam. Tanpa pemeriksaan keaktifan tiap permintaan, admin
   * yang baru dicabut masih bisa bertindak sepanjang sisa umur tokennya --
   * termasuk mencabut admin yang mencabutnya, sehingga sistem berakhir tanpa
   * admin sama sekali.
   */
  it('admin yang sudah dicabut langsung kehilangan akses meski cookienya masih ada', async () => {
    const agenSatu = await masuk();
    await agenSatu.post('/api/admin/admin')
      .send({ email: 'kedua@uji.local', nama: 'Kedua', sandi: 'sandi-kedua-panjang' }).expect(200);

    // Admin kedua masuk dan menyimpan cookienya.
    const agenDua = request.agent(app);
    await agenDua.post('/api/auth/masuk')
      .send({ email: 'kedua@uji.local', sandi: 'sandi-kedua-panjang' }).expect(200);
    await agenDua.get('/api/admin/data').expect(200);

    // Admin pertama mencabut akses admin kedua.
    const data = await agenSatu.get('/api/admin/data').expect(200);
    const kedua = data.body.admin.find((a: { email: string }) => a.email === 'kedua@uji.local');
    await agenSatu.delete(`/api/admin/admin/${kedua.id}`).expect(200);

    // Cookie admin kedua masih ada, tapi sudah tidak berlaku.
    const r = await agenDua.get('/api/admin/data').expect(401);
    expect(r.body.galat).toMatch(/dicabut/i);
    expect(await adminHitungAktif()).toBe(1);
  });

  it('ganti sandi menolak sandi lama yang salah', async () => {
    const agen = await masuk();
    const r = await agen.post('/api/admin/ganti-sandi')
      .send({ sandiLama: 'salah-sekali', sandiBaru: 'sandi-baru-panjang' }).expect(401);
    expect(r.body.galat).toMatch(/lama salah/i);
  });

  it('ganti sandi membuat sandi lama tidak berlaku lagi', async () => {
    const agen = await masuk();
    await agen.post('/api/admin/ganti-sandi')
      .send({ sandiLama: SANDI, sandiBaru: 'sandi-baru-panjang' }).expect(200);

    await request(app).post('/api/auth/masuk').send({ email: EMAIL, sandi: SANDI }).expect(401);
    await request(app).post('/api/auth/masuk')
      .send({ email: EMAIL, sandi: 'sandi-baru-panjang' }).expect(200);
  });
});

describe('pengaturan', () => {
  it('batas ukuran di atas 30 MB ditolak', async () => {
    const agen = await masuk();
    await agen.post('/api/admin/pengaturan').send({ kunci: 'batas_lampiran', nilai: '100' }).expect(500);
  });

  it('sakelar keterbukaan hanya menerima TRUE atau FALSE', async () => {
    const agen = await masuk();
    await agen.post('/api/admin/pengaturan')
      .send({ kunci: 'publik_tampilkan_wa', nilai: 'mungkin' }).expect(500);
  });

  it('mematikan sakelar WA langsung terasa di halaman publik', async () => {
    await buatPengajuan();
    const agen = await masuk();
    await agen.post('/api/admin/pengaturan')
      .send({ kunci: 'publik_tampilkan_wa', nilai: 'FALSE' }).expect(200);

    const r = await request(app).get('/api/publik/monitoring').expect(200);
    expect(r.body.daftar[0].wa_pemohon).toBe('0822****9690');

    await agen.post('/api/admin/pengaturan')
      .send({ kunci: 'publik_tampilkan_wa', nilai: 'TRUE' }).expect(200);
  });
});

describe('OPD dan log', () => {
  it('menambah OPD lalu muncul di konteks publik', async () => {
    const agen = await masuk();
    await agen.post('/api/admin/opd')
      .send({ kode: 'UJIDPU', nama_resmi: 'Dinas Pekerjaan Umum', nama_singkat: 'DPU' })
      .expect(200);

    const r = await request(app).get('/api/publik/konteks').expect(200);
    expect(r.body.opd.some((o: { nama_resmi: string }) => o.nama_resmi === 'Dinas Pekerjaan Umum'))
      .toBe(true);
  });

  /**
   * Kode OPD adalah kunci masuk form pengajuan. Kalau ia ikut terkirim di rute
   * yang terbuka untuk umum, seluruh kode terbaca siapa pun yang membuka rute
   * itu di peramban -- gerbangnya jadi hiasan.
   */
  it('konteks publik tidak pernah menyebut kode OPD', async () => {
    const agen = await masuk();
    await agen.post('/api/admin/opd')
      .send({ kode: 'UJIRAHASIA', nama_resmi: 'Dinas Uji Rahasia', nama_singkat: 'DUR' })
      .expect(200);

    const r = await request(app).get('/api/publik/konteks').expect(200);
    expect(JSON.stringify(r.body)).not.toContain('UJIRAHASIA');
    for (const o of r.body.opd as Record<string, unknown>[]) {
      expect(o).not.toHaveProperty('kode');
    }
  });

  it('log mencatat siapa mengubah apa', async () => {
    const { nomor } = await buatPengajuan();
    const agen = await masuk();
    await agen.post('/api/admin/status').send({ nomor, status: 'SELESAI', alasan: '' }).expect(200);

    const r = await agen.get('/api/admin/log?jumlah=20').expect(200);
    const baris = r.body.find((b: { aksi: string }) => b.aksi === 'UBAH_STATUS');
    expect(baris).toBeDefined();
    expect(baris.aktor).toBe(EMAIL);
  });
});
