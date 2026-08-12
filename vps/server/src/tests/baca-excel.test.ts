import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { buatApp } from '../index.js';
import { pool, kueri, siapkanSkema } from '../db.js';
import { _resetPembatas } from '../middleware/rate-limit.js';
import { adminBuat } from '../repo/admin.js';
import { pengajuanCariNomor } from '../repo/pengajuan.js';
import { riwayatUntuk } from '../repo/riwayat.js';
import { excelKeBaris, nilaiSel, bacaBadanBiner, GalatExcel } from '../services/baca-excel.js';

const app = buatApp();
const EMAIL = 'bos@uji.local';
const SANDI = 'sandi-uji-panjang';

const JUDUL = [
  'Timestamp', 'Nama OPD Pemohon', 'Jenis Rancangan Peraturan', 'Judul Raperda/Raperbup',
  'Surat Permohonan Rancangan Perda/Perbup',
  'Keterangan/Penjelasan Rancangan Perbup atau NA Perda',
  'Rancangan Perda/Perbup', 'Lampiran Raperda/Raperbup', 'Paraf Koordinasi',
  'Dasar Hukum Penyusunan Raperda/Raperbup', 'SK Tim Penyusunan RAPERDA',
  'Berita Acara Rapat PANSUS AKHIR', 'Hasil Konsultasi', 'Nama Pemohon',
  'Nomor WhatsApp Pemohon', 'Tanggal dan Detail Proses', 'Keterangan', 'Status'
];

/** Susun .xlsx di memori, berisi judul lalu baris yang diberikan. */
async function buatXlsx(baris: unknown[][]): Promise<Buffer> {
  const buku = new ExcelJS.Workbook();
  const lembar = buku.addWorksheet('Form Responses 1');
  lembar.addRow(JUDUL);
  for (const b of baris) lembar.addRow(b);
  return Buffer.from(await buku.xlsx.writeBuffer());
}

function barisContoh(judul = 'Raperbup tentang Percontohan'): unknown[] {
  return [
    '02/05/2026 10:00:00', 'BPKAD', 'Bupati', judul,
    'https://drive.google.com/file/d/aaa/view', '', '', '', '', '', '', '', '',
    'Mayasari', '0822-9998-9690',
    '- 2 Mei 2026 Berkas masuk ke sistem\n- 3 Mei 2026 Berkas sedang direviu Bagian Hukum',
    '', 'PROSES'
  ];
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

describe('nilaiSel', () => {
  it('teks dan angka jadi teks apa adanya', () => {
    expect(nilaiSel('BPKAD')).toBe('BPKAD');
    expect(nilaiSel(42)).toBe('42');
    expect(nilaiSel(null)).toBe('');
    expect(nilaiSel(undefined)).toBe('');
  });

  /**
   * ExcelJS menyimpan tanggal Excel sebagai tengah malam UTC. Membacanya
   * dengan getDate() di server yang zonanya di belakang UTC menggeser
   * tanggalnya mundur sehari, dan seluruh lini masa hasil migrasi ikut meleset.
   */
  it('tanggal dibaca dengan penunjuk UTC, tidak bergeser sehari', () => {
    expect(nilaiSel(new Date('2026-05-02T00:00:00Z'))).toBe('2026-05-02 00:00:00');
    expect(nilaiSel(new Date('2026-05-02T10:30:15Z'))).toBe('2026-05-02 10:30:15');
  });

  /** Kolom berkas di spreadsheet lama berisi tautan Drive; yang perlu
   *  tersimpan alamatnya, bukan teks tampilannya. */
  it('sel tautan mengembalikan alamat, bukan teks tampilan', () => {
    expect(nilaiSel({ text: 'Lihat berkas', hyperlink: 'https://drive.google.com/x' }))
      .toBe('https://drive.google.com/x');
  });

  it('teks berformat digabung jadi satu', () => {
    expect(nilaiSel({ richText: [{ text: 'Rapat ' }, { text: 'PANSUS' }] })).toBe('Rapat PANSUS');
  });

  it('rumus memakai hasilnya, bukan rumusnya', () => {
    expect(nilaiSel({ formula: 'A1&B1', result: 'BPKAD Brebes' })).toBe('BPKAD Brebes');
  });

  /** Dibiarkan terbaca supaya manusia yang memeriksa tahu ada yang rusak di
   *  berkas asalnya, bukan disembunyikan jadi sel kosong. */
  it('sel galat tetap terbaca', () => {
    expect(nilaiSel({ error: '#REF!' })).toBe('#REF!');
  });

  it('tidak pernah menghasilkan "[object Object]"', () => {
    for (const aneh of [{}, { a: 1 }, { richText: [] }, { hyperlink: undefined }]) {
      expect(nilaiSel(aneh)).not.toContain('[object');
    }
  });
});

describe('excelKeBaris', () => {
  it('membaca judul dan baris data dari .xlsx', async () => {
    const baris = await excelKeBaris(await buatXlsx([barisContoh()]));
    expect(baris).toHaveLength(2);
    expect(baris[0]).toEqual(JUDUL);
    expect(baris[1]![1]).toBe('BPKAD');
    expect(baris[1]![3]).toBe('Raperbup tentang Percontohan');
  });

  /** Lini masa bertingkat tinggal dalam satu sel, dipisah baris baru. Kalau
   *  baris barunya hilang, seluruh riwayat tergabung jadi satu kejadian. */
  it('baris baru di dalam satu sel tetap utuh', async () => {
    const baris = await excelKeBaris(await buatXlsx([barisContoh()]));
    expect(baris[1]![15]!.split('\n')).toHaveLength(2);
  });

  it('baris kosong di awal dan akhir dibuang', async () => {
    const buku = new ExcelJS.Workbook();
    const lembar = buku.addWorksheet('L');
    lembar.addRow([]);
    lembar.addRow(JUDUL);
    lembar.addRow(barisContoh());
    lembar.addRow([]);
    const baris = await excelKeBaris(Buffer.from(await buku.xlsx.writeBuffer()));
    expect(baris).toHaveLength(2);
    expect(baris[0]![0]).toBe('Timestamp');
  });

  /** Orang akan mengunggah CSV ke kolom bertuliskan "Excel". Menolaknya hanya
   *  membuat mereka bolak-balik mengubah format tanpa alasan. */
  it('berkas CSV tetap dilayani', async () => {
    const csv = `"${JUDUL.join('","')}"\n"02/05/2026 10:00:00","BPKAD","Bupati","Judul Uji"`
      + ',"","","","","","","","","","Maya","0822-9998-9690","","","PROSES"';
    const baris = await excelKeBaris(Buffer.from(csv, 'utf8'));
    expect(baris[0]).toEqual(JUDUL);
    expect(baris[1]![3]).toBe('Judul Uji');
  });

  it('berkas kosong ditolak dengan alasan yang terbaca', async () => {
    await expect(excelKeBaris(Buffer.alloc(0))).rejects.toThrow(GalatExcel);
  });

  it('zip yang bukan Excel ditolak, bukan meledak', async () => {
    const palsu = Buffer.concat([Buffer.from('PK'), Buffer.alloc(200)]);
    await expect(excelKeBaris(palsu)).rejects.toThrow(/tidak bisa dibaca sebagai Excel/i);
  });
});

describe('bacaBadanBiner', () => {
  it('menyatukan potongan jadi satu buffer', async () => {
    const isi = await bacaBadanBiner(Readable.from([Buffer.from('ab'), Buffer.from('cd')]));
    expect(isi.toString()).toBe('abcd');
  });

  /**
   * Ditolak begitu batas terlampaui, bukan setelah semuanya tertampung.
   * Menampung dulu berarti berkas 500 MB sempat memenuhi memori proses, dan
   * pada VPS 1 GB systemd membunuh layanannya lebih dulu.
   */
  it('berhenti begitu batas terlampaui', async () => {
    const besar = Readable.from([Buffer.alloc(100), Buffer.alloc(100)]);
    await expect(bacaBadanBiner(besar, 150)).rejects.toThrow(/melebihi batas/i);
  });
});

describe('rute unggah Excel', () => {
  for (const awalan of ['/api/setup', '/api/admin']) {
    describe(awalan, () => {
      it('menolak tanpa sesi admin', async () => {
        await request(app).post(`${awalan}/excel/periksa`)
          .set('Content-Type', 'application/octet-stream')
          .send(await buatXlsx([barisContoh()]) as never)
          .expect(401);
      });

      it('memeriksa berkas dan melaporkan jumlah barisnya', async () => {
        const agen = await masuk();
        const r = await agen.post(`${awalan}/excel/periksa`)
          .set('Content-Type', 'application/octet-stream')
          .send(await buatXlsx([barisContoh(), barisContoh('Raperbup Kedua')]) as never)
          .expect(200);

        expect(r.body.sah).toBe(true);
        expect(r.body.jenis).toBe('FORM');
        expect(r.body.jumlahBaris).toBe(2);
      });

      it('header asing ditolak, tidak ditebak-tebak', async () => {
        const agen = await masuk();
        const buku = new ExcelJS.Workbook();
        buku.addWorksheet('L').addRow(['Nama', 'Alamat', 'Umur']);
        const r = await agen.post(`${awalan}/excel/periksa`)
          .set('Content-Type', 'application/octet-stream')
          .send(Buffer.from(await buku.xlsx.writeBuffer()) as never)
          .expect(200);

        expect(r.body.sah).toBe(false);
        expect(r.body.pesan).toMatch(/tidak dikenali/i);
      });

      /** Menulis sungguhan harus diminta tegas. Kalau parameternya hilang atau
       *  salah eja, yang terjadi uji coba -- bukan penulisan. */
      it('tanpa ujiCoba=0 tidak menulis apa pun', async () => {
        const agen = await masuk();
        const r = await agen.post(`${awalan}/excel/migrasi`)
          .set('Content-Type', 'application/octet-stream')
          .send(await buatXlsx([barisContoh()]) as never)
          .expect(200);

        expect(r.body.ujiCoba).toBe(true);
        expect(await kueri(`SELECT id FROM pengajuan`)).toHaveLength(0);
      });

      it('ujiCoba=0 menulis pengajuan berikut riwayatnya', async () => {
        const agen = await masuk();
        const r = await agen.post(`${awalan}/excel/migrasi?ujiCoba=0`)
          .set('Content-Type', 'application/octet-stream')
          .send(await buatXlsx([barisContoh()]) as never)
          .expect(200);

        expect(r.body.ujiCoba).toBe(false);
        expect(r.body.barisDisisipkan).toBe(1);

        const p = await pengajuanCariNomor('BRB-2026-0001');
        expect(p!.judul).toBe('Raperbup tentang Percontohan');
        expect(p!.wa_pemohon).toBe('082299989690');

        const riwayat = await riwayatUntuk(p!.id);
        expect(riwayat).toHaveLength(2);
        expect(riwayat[0]!.keterangan).toBe('Berkas masuk ke sistem');
      });

      it('berkas rusak dijawab pesan yang terbaca, bukan 500', async () => {
        const agen = await masuk();
        const r = await agen.post(`${awalan}/excel/periksa`)
          .set('Content-Type', 'application/octet-stream')
          .send(Buffer.concat([Buffer.from('PK'), Buffer.alloc(50)]) as never)
          .expect(400);
        expect(r.body.galat).toMatch(/Excel/i);
        expect(r.body.galat).not.toMatch(/kesalahan di server/i);
      });
    });
  }
});
