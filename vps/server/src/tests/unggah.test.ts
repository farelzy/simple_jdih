import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { readdir } from 'node:fs/promises';
import { buatApp } from '../index.js';
import { pool, kueri, siapkanSkema } from '../db.js';
import { _resetPembatas } from '../middleware/rate-limit.js';
import { _resetDraf } from '../routes/unggah.js';
import { DIR_BERKAS } from '../services/simpanan.js';
import { pengajuanCariNomor } from '../repo/pengajuan.js';
import { berkasUntuk } from '../repo/berkas.js';
import { riwayatUntuk } from '../repo/riwayat.js';

const app = buatApp();

async function buatDraf(): Promise<string> {
  const r = await request(app).post('/api/unggah/draf').expect(200);
  return r.body.draf as string;
}

function unggah(draf: string, kolom: string, nama: string, isi: Buffer | string) {
  return request(app).post('/api/unggah/berkas')
    .set('x-draf', draf)
    .set('x-kolom', kolom)
    .set('x-nama', encodeURIComponent(nama))
    .set('Content-Type', 'application/octet-stream')
    .send(isi as never);
}

/** Isian teks lengkap untuk Perbup; berkasnya diunggah terpisah. */
const DASAR = {
  jenis_peraturan: 'Bupati',
  kode_opd: 'BPKAD',
  judul: 'Raperbup tentang Percontohan',
  nama_pemohon: 'Mayasari',
  wa_pemohon: '0822-9998-9690'
};

async function drafLengkapPerbup(): Promise<string> {
  const draf = await buatDraf();
  await unggah(draf, 'surat_permohonan', 'surat.pdf', 'isi').expect(200);
  await unggah(draf, 'keterangan_na', 'na.pdf', 'isi').expect(200);
  await unggah(draf, 'rancangan', 'draf.docx', 'isi').expect(200);
  await unggah(draf, 'paraf', 'paraf.pdf', 'isi').expect(200);
  await unggah(draf, 'dasar_hukum', 'dasar.pdf', 'isi').expect(200);
  return draf;
}

beforeAll(async () => { await siapkanSkema(); });

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  _resetPembatas();
  _resetDraf();
  await kueri(`DELETE FROM pengajuan`);
});

afterAll(async () => {
  await kueri(`DELETE FROM pengajuan`);
  await pool.end();
});

describe('unggah berkas', () => {
  it('menolak jenis berkas yang tidak diizinkan sebelum menulis ke disk', async () => {
    const draf = await buatDraf();
    const r = await unggah(draf, 'surat_permohonan', 'surat.docx', 'isi').expect(400);
    expect(r.body.galat).toMatch(/pdf/i);
  });

  it('Rancangan menolak PDF karena harus bisa disunting Bagian Hukum', async () => {
    const draf = await buatDraf();
    await unggah(draf, 'rancangan', 'draf.pdf', 'isi').expect(400);
    await unggah(draf, 'rancangan', 'draf.docx', 'isi').expect(200);
  });

  it('menolak kolom yang tidak dikenali', async () => {
    const draf = await buatDraf();
    await unggah(draf, 'entah', 'x.pdf', 'isi').expect(400);
  });

  it('menolak draf yang tidak dikenal', async () => {
    const r = await unggah('karangan', 'paraf', 'p.pdf', 'isi').expect(410);
    expect(r.body.galat).toMatch(/kedaluwarsa/i);
  });

  /**
   * Server menolak berkas kebesaran sebelum satu byte pun ditulis ke disk.
   *
   * Klien bisa menerimanya sebagai sambungan terputus, bukan sebagai jawaban
   * 400 -- itu wajar: server membalas sebelum badan permintaan selesai terkirim
   * lalu menutup koneksi. Karena itu yang diuji di sini adalah akibat yang
   * benar-benar penting: tidak ada berkas tertinggal di disk.
   *
   * Pesan yang bisa dibaca pemohon datang dari pemeriksaan di browser, yang
   * menolak sebelum mengirim sama sekali.
   */
  it('tidak meninggalkan berkas di disk saat unggahan kebesaran ditolak', async () => {
    const draf = await buatDraf();
    const sebelum = (await readdir(DIR_BERKAS).catch(() => [])).length;

    // Batas surat_permohonan 5 MB; kirim 6 MB.
    await unggah(draf, 'surat_permohonan', 'besar.pdf', Buffer.alloc(6 * 1024 * 1024, 1))
      .catch(() => { /* sambungan diputus server: memang begitu */ });

    const sesudah = (await readdir(DIR_BERKAS).catch(() => [])).length;
    expect(sesudah).toBe(sebelum);

    // Draf tetap bersih, jadi pemohon bisa langsung mencoba berkas lain.
    const r = await unggah(draf, 'surat_permohonan', 'kecil.pdf', Buffer.alloc(1024, 1)).expect(200);
    expect(r.body.ukuran).toBe(1024);
  });

  it('menerima berkas dalam batas dan mencatat ukurannya', async () => {
    const draf = await buatDraf();
    const r = await unggah(draf, 'paraf', 'paraf.pdf', Buffer.alloc(1024, 7)).expect(200);
    expect(r.body.ukuran).toBe(1024);
    expect(r.body.nama).toBe('paraf.pdf');
    expect(r.body.namaDisk).not.toBe('paraf.pdf');   // nama di disk harus acak
  });

  it('nama berkas dari pemohon tidak pernah dipakai sebagai nama di disk', async () => {
    const draf = await buatDraf();
    const r = await unggah(draf, 'paraf', '../../etc/passwd.pdf', 'isi').expect(200);
    expect(r.body.namaDisk).not.toContain('..');
    expect(r.body.namaDisk).not.toContain('/');
  });

  it('kolom satu berkas menolak berkas kedua', async () => {
    const draf = await buatDraf();
    await unggah(draf, 'paraf', 'a.pdf', 'isi').expect(200);
    const r = await unggah(draf, 'paraf', 'b.pdf', 'isi').expect(400);
    expect(r.body.galat).toMatch(/maksimal 1/i);
  });

  it('BA PANSUS menerima sampai lima berkas', async () => {
    const draf = await buatDraf();
    for (let i = 1; i <= 5; i++) await unggah(draf, 'ba_pansus', `ba${i}.pdf`, 'isi').expect(200);
    await unggah(draf, 'ba_pansus', 'ba6.pdf', 'isi').expect(400);
  });

  it('berkas bisa dibatalkan sebelum dikirim', async () => {
    const draf = await buatDraf();
    const r = await unggah(draf, 'paraf', 'p.pdf', 'isi').expect(200);
    await request(app).delete('/api/unggah/berkas')
      .set('x-draf', draf).set('x-berkas', r.body.namaDisk).expect(200);
    // Kolomnya kosong lagi, jadi berkas baru diterima.
    await unggah(draf, 'paraf', 'p2.pdf', 'isi').expect(200);
  });
});

/**
 * Gerbang kode OPD.
 *
 * Kode diperiksa dua kali: sekali di rute verifikasi supaya form bisa memandu
 * pemohon, sekali lagi saat pengiriman. Yang kedua itu yang benar-benar
 * menjaga -- yang pertama cuma mengatur tampilan dan bisa dilewati siapa pun
 * yang memanggil rute kirim langsung.
 */
describe('kode OPD sebagai kunci masuk', () => {
  it('kode yang benar menyebut nama OPD-nya, tanpa membocorkan kode lain', async () => {
    const r = await request(app).post('/api/publik/opd/verifikasi')
      .send({ kode: 'BPKAD' }).expect(200);
    expect(r.body.sah).toBe(true);
    expect(r.body.opd.nama_resmi).toBe('BPKAD');
    expect(r.body.opd).not.toHaveProperty('kode');
  });

  it('spasi dan huruf kecil dimaafkan, karena kode disalin dari pesan', async () => {
    const r = await request(app).post('/api/publik/opd/verifikasi')
      .send({ kode: '  bpkad ' }).expect(200);
    expect(r.body.sah).toBe(true);
  });

  it('kode salah ditolak tanpa memberi petunjuk kode yang benar', async () => {
    const r = await request(app).post('/api/publik/opd/verifikasi')
      .send({ kode: 'BUKANKODE' }).expect(404);
    expect(r.body.sah).toBe(false);
    expect(r.body.galat).toMatch(/Bagian Hukum/i);
    expect(JSON.stringify(r.body)).not.toContain('BPKAD');
  });

  it('kode kosong ditolak', async () => {
    await request(app).post('/api/publik/opd/verifikasi').send({ kode: '   ' }).expect(404);
  });

  it('pengiriman dengan kode salah ditolak dan tidak menyimpan apa pun', async () => {
    const draf = await drafLengkapPerbup();
    const r = await request(app).post('/api/pengajuan/kirim')
      .send({ ...DASAR, kode_opd: 'BUKANKODE', draf }).expect(400);

    expect(r.body.galat.some((g: { kolom: string }) => g.kolom === 'kode_opd')).toBe(true);
    expect(await kueri(`SELECT id FROM pengajuan`)).toHaveLength(0);
  });

  it('pengiriman tanpa kode sama sekali ditolak', async () => {
    const draf = await drafLengkapPerbup();
    const { kode_opd: _abaikan, ...tanpaKode } = DASAR;
    const r = await request(app).post('/api/pengajuan/kirim')
      .send({ ...tanpaKode, draf }).expect(400);
    expect(r.body.galat.some((g: { kolom: string }) => g.kolom === 'kode_opd')).toBe(true);
  });

  /**
   * Menonaktifkan OPD lewat dashboard harus sekaligus mencabut kemampuannya
   * mengirim, tanpa langkah kedua yang bisa terlupakan.
   */
  it('kode OPD nonaktif berhenti berlaku', async () => {
    await kueri(
      `INSERT INTO opd (kode, nama_resmi, nama_singkat, aktif) VALUES ('UJIMATI','Dinas Uji Mati','DUM',0)
       ON DUPLICATE KEY UPDATE aktif = 0`
    );
    await request(app).post('/api/publik/opd/verifikasi').send({ kode: 'UJIMATI' }).expect(404);

    const draf = await drafLengkapPerbup();
    await request(app).post('/api/pengajuan/kirim')
      .send({ ...DASAR, kode_opd: 'UJIMATI', draf }).expect(400);
  });

  /**
   * Nama OPD yang tersimpan diambil dari baris OPD, bukan dari kiriman browser.
   * Inilah yang menutup jalan masuk lima ejaan untuk satu instansi.
   */
  it('nama OPD yang tersimpan berasal dari daftar, bukan dari kiriman browser', async () => {
    const draf = await drafLengkapPerbup();
    const r = await request(app).post('/api/pengajuan/kirim')
      .send({ ...DASAR, opd: 'BPKAD KAB. BREBES (karangan)', draf }).expect(200);

    const p = await pengajuanCariNomor(r.body.nomor);
    expect(p!.opd_teks).toBe('BPKAD');
    expect(p!.opd_id).not.toBeNull();
  });
});

describe('POST /api/pengajuan/kirim', () => {
  it('menolak Perda tanpa SK Tim dan BA PANSUS', async () => {
    const draf = await drafLengkapPerbup();
    const r = await request(app).post('/api/pengajuan/kirim')
      .send({ ...DASAR, jenis_peraturan: 'Daerah', draf }).expect(400);
    const kolom = r.body.galat.map((g: { kolom: string }) => g.kolom);
    expect(kolom).toContain('sk_tim');
    expect(kolom).toContain('ba_pansus');
  });

  it('menolak Perbup yang menyertakan SK Tim', async () => {
    const draf = await drafLengkapPerbup();
    await unggah(draf, 'sk_tim', 'sk.pdf', 'isi').expect(200);
    const r = await request(app).post('/api/pengajuan/kirim').send({ ...DASAR, draf }).expect(400);
    expect(r.body.galat.some((g: { kolom: string }) => g.kolom === 'sk_tim')).toBe(true);
  });

  it('menolak berkas wajib yang belum diunggah', async () => {
    const draf = await buatDraf();
    const r = await request(app).post('/api/pengajuan/kirim').send({ ...DASAR, draf }).expect(400);
    expect(r.body.galat.length).toBeGreaterThan(0);
  });

  it('menolak nomor WhatsApp yang tidak sah', async () => {
    const draf = await drafLengkapPerbup();
    const r = await request(app).post('/api/pengajuan/kirim')
      .send({ ...DASAR, wa_pemohon: '123', draf }).expect(400);
    expect(r.body.galat.some((g: { kolom: string }) => g.kolom === 'wa_pemohon')).toBe(true);
  });

  /**
   * Kiriman browser tidak boleh menentukan berkas apa yang dianggap ada.
   */
  it('mengabaikan daftar berkas karangan dari browser', async () => {
    const draf = await buatDraf();
    const r = await request(app).post('/api/pengajuan/kirim')
      .send({
        ...DASAR, draf,
        berkas: { surat_permohonan: [{ nama: 'palsu.pdf', ukuran: 1 }] }
      })
      .expect(400);
    expect(JSON.stringify(r.body)).not.toContain('palsu.pdf');
  });

  it('honeypot dijawab seolah berhasil tapi tidak menyimpan apa pun', async () => {
    const draf = await drafLengkapPerbup();
    const r = await request(app).post('/api/pengajuan/kirim')
      .send({ ...DASAR, draf, situs_web: 'https://spam.example' }).expect(200);
    expect(r.body.sukses).toBe(true);
    expect(await pengajuanCariNomor(r.body.nomor)).toBeNull();
  });

  it('pengajuan sah tersimpan lengkap dengan berkas dan riwayat pertama', async () => {
    const draf = await drafLengkapPerbup();
    const r = await request(app).post('/api/pengajuan/kirim').send({ ...DASAR, draf }).expect(200);

    expect(r.body.sukses).toBe(true);
    expect(r.body.nomor).toMatch(/^BRB-\d{4}-\d{4}$/);

    const p = await pengajuanCariNomor(r.body.nomor);
    expect(p!.judul).toBe(DASAR.judul);
    expect(p!.wa_pemohon).toBe('082299989690');   // dinormalkan

    const berkas = await berkasUntuk(p!.id);
    expect(berkas).toHaveLength(5);
    expect(berkas.every((b) => b.sumber === 'lokal')).toBe(true);

    const riwayat = await riwayatUntuk(p!.id);
    expect(riwayat).toHaveLength(1);
    expect(riwayat[0]!.tahap).toBe('BERKAS_MASUK');
  });

  it('draf tidak bisa dipakai dua kali', async () => {
    const draf = await drafLengkapPerbup();
    await request(app).post('/api/pengajuan/kirim').send({ ...DASAR, draf }).expect(200);
    await request(app).post('/api/pengajuan/kirim').send({ ...DASAR, draf }).expect(410);
  });

  it('pengajuan baru langsung terlihat di monitoring publik', async () => {
    const draf = await drafLengkapPerbup();
    const r = await request(app).post('/api/pengajuan/kirim').send({ ...DASAR, draf }).expect(200);

    const m = await request(app).get('/api/publik/monitoring').expect(200);
    expect(m.body.hitungan.TOTAL).toBe(1);
    expect(m.body.daftar[0].nomor).toBe(r.body.nomor);
  });
});

describe('GET /api/unggah/:id', () => {
  it('menyajikan berkas dengan nama asli pemohon', async () => {
    const draf = await drafLengkapPerbup();
    const kirim = await request(app).post('/api/pengajuan/kirim').send({ ...DASAR, draf }).expect(200);
    const p = await pengajuanCariNomor(kirim.body.nomor);
    const berkas = await berkasUntuk(p!.id);
    const surat = berkas.find((b) => b.kolom === 'surat_permohonan')!;

    const r = await request(app).get(`/api/unggah/${surat.id}`).expect(200);
    expect(r.headers['content-disposition']).toContain('surat.pdf');
  });

  it('berkas yang tidak ada dijawab 404', async () => {
    await request(app).get('/api/unggah/999999').expect(404);
  });
});
