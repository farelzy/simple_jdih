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

  /**
   * Uji ini dulu mengharapkan 500, mengunci perilaku yang keliru: salah pilih
   * tahap itu salah pakai, bukan kerusakan server. Di produksi pesannya
   * tertelan tangkapGalat dan berubah jadi "Terjadi kesalahan di server",
   * sehingga admin tidak pernah tahu tahap mana yang ditolak.
   */
  it('tahap di luar daftar baku ditolak dengan alasan yang terbaca', async () => {
    const { nomor } = await buatPengajuan();
    const agen = await masuk();
    const r = await agen.post('/api/admin/riwayat')
      .send({ nomor, tanggal: '2026-07-22', tahap: 'NGAWUR', keterangan: '' })
      .expect(400);
    expect(r.body.galat).toMatch(/tidak dikenali/i);
    expect(r.body.galat).not.toMatch(/kesalahan di server/i);
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

  /**
   * Sandi pendek adalah salah pakai, bukan kerusakan server.
   *
   * Uji ini dulu mengharapkan 500 -- mengunci perilaku yang keliru: pesan
   * "Kata sandi minimal 8 karakter" tertelan tangkapGalat dan di produksi
   * berubah jadi "Terjadi kesalahan di server", sehingga admin tidak pernah
   * tahu apa yang salah.
   */
  it('menolak sandi yang terlalu pendek dengan alasan yang terbaca', async () => {
    const agen = await masuk();
    const r = await agen.post('/api/admin/admin')
      .send({ email: 'x@uji.local', nama: 'X', sandi: 'pendek' }).expect(400);
    expect(r.body.galat).toMatch(/8 karakter/);
    expect(r.body.galat).not.toMatch(/kesalahan di server/i);
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

  it('kode OPD kembar ditolak dengan pesan yang jelas, bukan 500 buta', async () => {
    const agen = await masuk();
    await agen.post('/api/admin/opd')
      .send({ kode: 'UJIBENTROK', nama_resmi: 'Dinas Pertama', nama_singkat: 'DP' })
      .expect(200);

    const r = await agen.post('/api/admin/opd')
      .send({ kode: 'UJIBENTROK', nama_resmi: 'Dinas Kedua', nama_singkat: 'DK' })
      .expect(409);
    expect(r.body.galat).toMatch(/Dinas Pertama/);
    expect(r.body.galat).not.toMatch(/kesalahan di server/i);
  });

  it('email admin kembar ditolak dengan pesan yang jelas, bukan 500 buta', async () => {
    const agen = await masuk();
    await agen.post('/api/admin/admin')
      .send({ email: 'dobel@uji.local', nama: 'Pertama', sandi: 'sandi-rahasia-123' })
      .expect(200);

    const r = await agen.post('/api/admin/admin')
      .send({ email: 'dobel@uji.local', nama: 'Kedua', sandi: 'sandi-rahasia-456' })
      .expect(409);
    expect(r.body.galat).toMatch(/dobel@uji\.local/);
    expect(r.body.galat).not.toMatch(/kesalahan di server/i);
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

/**
 * Mengelola riwayat, bukan sekadar menambahnya.
 *
 * Sampai rel enam stasiun muncul di kartu monitoring, dashboard hanya bisa
 * menambah baris riwayat. Akibatnya satu baris yang tahapnya salah pilih --
 * LAINNYA padahal isinya pra harmonisasi -- tidak bisa dibetulkan sama sekali,
 * dan relnya ikut salah selamanya. Di data sungguhan ada 7 dari 37 kartu yang
 * terkunci begitu.
 */
describe('mengelola riwayat', () => {
  async function buatRiwayat(
    nomor: string, agen: ReturnType<typeof request.agent>,
    tahap = 'LAINNYA', tanggal = '2026-07-22'
  ) {
    await agen.post('/api/admin/riwayat')
      .send({ nomor, tanggal, tahap, keterangan: 'Pra harmonisasi di Kanwil' })
      .expect(200);
    const p = await pengajuanCariNomor(nomor);
    const daftar = await riwayatUntuk(p!.id);
    return daftar[daftar.length - 1]!;
  }

  it('rute kelola riwayat ikut menolak permintaan tanpa sesi', async () => {
    await request(app).get('/api/admin/riwayat/BRB-2026-0001').expect(401);
    await request(app).patch('/api/admin/riwayat/1').send({}).expect(401);
    await request(app).delete('/api/admin/riwayat/1').expect(401);
  });

  it('mengirim seluruh riwayat satu pengajuan berikut posisi relnya', async () => {
    const { nomor } = await buatPengajuan();
    const agen = await masuk();
    await buatRiwayat(nomor, agen, 'BERKAS_MASUK');
    await buatRiwayat(nomor, agen, 'PRA_HARMONISASI', '2026-07-25');

    const r = await agen.get(`/api/admin/riwayat/${nomor}`).expect(200);
    expect(r.body.nomor).toBe(nomor);
    expect(r.body.status).toBe('PROSES');
    expect(r.body.riwayat).toHaveLength(2);
    expect(r.body.tahap_indeks).toBe(3);
    expect(r.body.tahap_total).toBe(6);
    // Tiap baris membawa nomor stasiunnya sendiri, supaya dashboard bisa
    // menandai baris mana yang sebenarnya tidak menggerakkan rel.
    expect(r.body.riwayat[0].stasiun).toBe(1);
    expect(r.body.riwayat[1].stasiun).toBe(3);
    expect(r.body.riwayat[0].id).toBeGreaterThan(0);
  });

  it('baris di luar rel dikirim dengan stasiun null', async () => {
    const { nomor } = await buatPengajuan();
    const agen = await masuk();
    await buatRiwayat(nomor, agen, 'LAINNYA');

    const r = await agen.get(`/api/admin/riwayat/${nomor}`).expect(200);
    expect(r.body.riwayat[0].stasiun).toBeNull();
    expect(r.body.tahap_indeks).toBe(0);
  });

  it('nomor yang tidak ada dijawab 404, bukan daftar kosong', async () => {
    const agen = await masuk();
    await agen.get('/api/admin/riwayat/BRB-2026-9999').expect(404);
  });

  /** Inilah yang ditanyakan Bagian Hukum: cara memindahkan titik di rel. */
  it('mengubah tahap satu baris menggerakkan rel', async () => {
    const { nomor } = await buatPengajuan();
    const agen = await masuk();
    const baris = await buatRiwayat(nomor, agen, 'LAINNYA');

    await agen.patch(`/api/admin/riwayat/${baris.id}`)
      .send({ tanggal: '2026-07-22', tahap: 'PRA_HARMONISASI', keterangan: 'Pra harmonisasi di Kanwil' })
      .expect(200);

    const r = await agen.get(`/api/admin/riwayat/${nomor}`).expect(200);
    expect(r.body.riwayat[0].tahap).toBe('PRA_HARMONISASI');
    expect(r.body.tahap_indeks).toBe(3);

    // Halaman publik ikut berubah, karena itu yang dilihat OPD.
    const detail = await request(app).get(`/api/publik/detail/${nomor}`).expect(200);
    expect(detail.body.tahap_indeks).toBe(3);
  });

  it('mengubah tanggal dan keterangan sekaligus', async () => {
    const { nomor } = await buatPengajuan();
    const agen = await masuk();
    const baris = await buatRiwayat(nomor, agen, 'REVIU_HUKUM');

    await agen.patch(`/api/admin/riwayat/${baris.id}`)
      .send({ tanggal: '2026-08-01', tahap: 'REVIU_HUKUM', keterangan: 'Direviu ulang' })
      .expect(200);

    const r = await agen.get(`/api/admin/riwayat/${nomor}`).expect(200);
    expect(r.body.riwayat[0].tanggal).toBe('2026-08-01');
    expect(r.body.riwayat[0].keterangan).toBe('Direviu ulang');
  });

  it('tahap dan tanggal ngawur ditolak sebagai salah pakai, bukan galat server', async () => {
    const { nomor } = await buatPengajuan();
    const agen = await masuk();
    const baris = await buatRiwayat(nomor, agen, 'REVIU_HUKUM');

    const a = await agen.patch(`/api/admin/riwayat/${baris.id}`)
      .send({ tanggal: '2026-08-01', tahap: 'NGAWUR', keterangan: '' }).expect(400);
    expect(a.body.galat).toMatch(/tidak dikenali/i);
    expect(a.body.galat).not.toMatch(/kesalahan di server/i);

    const b = await agen.patch(`/api/admin/riwayat/${baris.id}`)
      .send({ tanggal: '01-08-2026', tahap: 'REVIU_HUKUM', keterangan: '' }).expect(400);
    expect(b.body.galat).toMatch(/tanggal/i);

    // Ditolak berarti tidak tersentuh sama sekali.
    const r = await agen.get(`/api/admin/riwayat/${nomor}`).expect(200);
    expect(r.body.riwayat[0].tahap).toBe('REVIU_HUKUM');
    expect(r.body.riwayat[0].tanggal).toBe('2026-07-22');
  });

  it('mengubah baris yang tidak ada dijawab 404', async () => {
    const agen = await masuk();
    await agen.patch('/api/admin/riwayat/999999')
      .send({ tanggal: '2026-08-01', tahap: 'REVIU_HUKUM', keterangan: '' }).expect(404);
  });

  it('menghapus baris memundurkan rel ke stasiun terjauh yang tersisa', async () => {
    const { nomor } = await buatPengajuan();
    const agen = await masuk();
    await buatRiwayat(nomor, agen, 'BERKAS_MASUK');
    const salah = await buatRiwayat(nomor, agen, 'RAPAT_HARMONISASI', '2026-07-25');

    await agen.delete(`/api/admin/riwayat/${salah.id}`).expect(200);

    const r = await agen.get(`/api/admin/riwayat/${nomor}`).expect(200);
    expect(r.body.riwayat).toHaveLength(1);
    expect(r.body.tahap_indeks).toBe(1);
  });

  it('menghapus baris yang tidak ada dijawab 404', async () => {
    const agen = await masuk();
    await agen.delete('/api/admin/riwayat/999999').expect(404);
  });

  it('ubah dan hapus tercatat di log audit berikut tahap sebelumnya', async () => {
    const { nomor } = await buatPengajuan();
    const agen = await masuk();
    const baris = await buatRiwayat(nomor, agen, 'LAINNYA');

    await agen.patch(`/api/admin/riwayat/${baris.id}`)
      .send({ tanggal: '2026-07-22', tahap: 'PRA_HARMONISASI', keterangan: '' }).expect(200);
    await agen.delete(`/api/admin/riwayat/${baris.id}`).expect(200);

    const log = await agen.get('/api/admin/log?jumlah=20').expect(200);
    const ubah = log.body.find((b: { aksi: string }) => b.aksi === 'UBAH_RIWAYAT');
    const hapus = log.body.find((b: { aksi: string }) => b.aksi === 'HAPUS_RIWAYAT');

    expect(ubah).toBeDefined();
    expect(ubah.aktor).toBe(EMAIL);
    // Tanpa tahap lama di rincian, log tidak bisa menjawab "dulu isinya apa".
    expect(ubah.rincian).toMatch(/LAINNYA/);
    expect(ubah.rincian).toMatch(/PRA_HARMONISASI/);
    expect(hapus).toBeDefined();
    expect(hapus.rincian).toMatch(/PRA_HARMONISASI/);
  });
});

describe('bekal dashboard untuk formulir riwayat', () => {
  it('mengirim daftar stasiun dan pemetaan tahap ke stasiun', async () => {
    const agen = await masuk();
    const r = await agen.get('/api/admin/data').expect(200);

    expect(r.body.stasiun.map((s: { kunci: string }) => s.kunci)).toEqual([
      'BERKAS_MASUK', 'REVIU_HUKUM', 'PRA_HARMONISASI',
      'FASILITASI', 'RAPAT_HARMONISASI', 'SELESAI_HARMONISASI'
    ]);
    expect(r.body.tahapStasiun.PRA_HARMONISASI).toBe(3);
    expect(r.body.tahapStasiun.LAINNYA).toBeNull();
  });

  /**
   * Antrean sengaja hanya memuat PROSES. Tapi berkas yang paling butuh
   * dibetulkan relnya justru yang sudah SELESAI atau DIKEMBALIKAN, dan
   * sebelumnya keduanya sama sekali tidak bisa disentuh dari dashboard.
   */
  it('mengirim seluruh pengajuan, bukan hanya yang berstatus PROSES', async () => {
    const { nomor } = await buatPengajuan('Sudah selesai');
    const agen = await masuk();
    await agen.post('/api/admin/status').send({ nomor, status: 'SELESAI', alasan: '' }).expect(200);

    const r = await agen.get('/api/admin/data').expect(200);
    expect(r.body.antrean).toHaveLength(0);
    expect(r.body.daftar.map((p: { nomor: string }) => p.nomor)).toContain(nomor);
    expect(r.body.daftar[0].status).toBe('SELESAI');
  });
});

/**
 * Rel ikut dikirim di daftar antrean, bukan hanya di halaman publik.
 *
 * Dua sebabnya. Pertama, dashboard perlu menggambar rel yang sama persis
 * dengan yang dilihat OPD, supaya Bagian Hukum tahu apa yang sedang dibaca
 * orang luar. Kedua, tombol "Ubah tahap" perlu tahu posisi sekarang untuk
 * memilihkan pilihan awal dan untuk memperingatkan kalau tahap yang dipilih
 * lebih awal daripada yang sudah tercapai -- rel memakai stasiun terjauh, jadi
 * pilihan mundur tidak akan menggerakkan apa pun.
 */
describe('posisi rel di daftar dashboard', () => {
  it('tiap baris antrean membawa posisi rel dan kejadian terakhirnya', async () => {
    const { nomor } = await buatPengajuan();
    const agen = await masuk();
    await agen.post('/api/admin/riwayat')
      .send({ nomor, tanggal: '2026-07-22', tahap: 'PRA_HARMONISASI', keterangan: 'Di Kanwil' })
      .expect(200);

    const r = await agen.get('/api/admin/data').expect(200);
    const baris = r.body.antrean.find((p: { nomor: string }) => p.nomor === nomor);
    expect(baris.tahap_indeks).toBe(3);
    expect(baris.tahap_total).toBe(6);
    expect(baris.terakhir).toBe('Di Kanwil');
  });

  it('pengajuan tanpa riwayat berada di stasiun nol, bukan tanpa kolom', async () => {
    await buatPengajuan();
    const agen = await masuk();
    const r = await agen.get('/api/admin/data').expect(200);
    expect(r.body.antrean[0].tahap_indeks).toBe(0);
    expect(r.body.antrean[0].terakhir).toBe('');
  });

  it('status SELESAI memenuhi rel di daftar, sama seperti di halaman publik', async () => {
    const { nomor } = await buatPengajuan();
    const agen = await masuk();
    await agen.post('/api/admin/status').send({ nomor, status: 'SELESAI', alasan: '' }).expect(200);

    const r = await agen.get('/api/admin/data').expect(200);
    const baris = r.body.daftar.find((p: { nomor: string }) => p.nomor === nomor);
    expect(baris.tahap_indeks).toBe(6);
  });
});
