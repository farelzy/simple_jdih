import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool, kueri, satu, siapkanSkema } from '../db.js';
import { migrasiJalankan, migrasiPeriksa, tanggalDariTimestamp, normalisasiBanding } from '../services/migrasi.js';
import { pengajuanSemua, pengajuanCariNomor } from '../repo/pengajuan.js';
import { riwayatUntuk } from '../repo/riwayat.js';
import { berkasUntuk } from '../repo/berkas.js';
import { opdTambah } from '../repo/opd.js';

/** Baris contoh meniru bentuk asli, termasuk lini masa bertingkat dalam satu sel. */
const CSV = [
  '"Timestamp","Nama OPD Pemohon","Jenis Rancangan Peraturan","Judul Raperda/Raperbup",' +
  '"Surat Permohonan Rancangan Perda/Perbup","Keterangan/Penjelasan Rancangan Perbup atau NA Perda",' +
  '"Rancangan Perda/Perbup","Lampiran Raperda/Raperbup","Paraf Koordinasi",' +
  '"Dasar Hukum Penyusunan Raperda/Raperbup","SK Tim Penyusunan RAPERDA",' +
  '"Berita Acara Rapat PANSUS AKHIR","Hasil Konsultasi","Nama Pemohon",' +
  '"Nomor WhatsApp Pemohon","Tanggal dan Detail Proses","Keterangan","Status"',

  // Sengaja OPD yang TIDAK ada di 003-opd-brebes.sql, supaya uji "OPD tidak
  // dikenali dilaporkan" benar-benar menguji jalur itu. Sebelumnya baris ini
  // memakai 'Bapperida', yang belakangan masuk daftar baku -- sejak itu ia
  // justru dikenali dan ujinya berhenti menguji apa pun.
  '"02/05/2026 10:00:00","Dinas Antah Berantah","Daerah","Raperda tentang Retribusi",' +
  '"https://drive.google.com/file/d/aaa/view","","","","","","","","","Budi",' +
  '"0812-3456-7890","- 2 Mei 2026 Berkas masuk ke sistem","","PROSES"',

  '"29/04/2026 09:15:00","BPKAD KABUPATEN BREBES","Bupati","Raperbup tentang Percontohan",' +
  '"https://drive.google.com/file/d/bbb/view","","","","","","","","","Mayasari",' +
  '"0822-9998-9690","- 22 Juli 2026 Berkas masuk ke sistem\n- 23 Juli 2026 Berkas sedang direviu Bagian Hukum",' +
  '"Catatan uji","SELESAI"'
].join('\n');

const OPSI = { sumber: 'tidak-dipakai', isiCsv: CSV, ujiCoba: false };

beforeAll(async () => {
  await siapkanSkema();
  await kueri(`DELETE FROM opd WHERE kode = 'BPKAD'`);
  await opdTambah('BPKAD', 'Badan Pengelolaan Keuangan dan Aset Daerah', 'BPKAD');
});
beforeEach(async () => { await kueri(`DELETE FROM pengajuan`); });
afterAll(async () => {
  await kueri(`DELETE FROM pengajuan`);
  await kueri(`DELETE FROM opd WHERE kode = 'BPKAD'`);
  await pool.end();
});

describe('bantuan migrasi', () => {
  it('tanggalDariTimestamp menerima bentuk lokal dan ISO', () => {
    expect(tanggalDariTimestamp('30/04/2026 09:15:00')).toBe('2026-04-30');
    expect(tanggalDariTimestamp('2026-04-30 09:15:00')).toBe('2026-04-30');
    expect(tanggalDariTimestamp('bukan tanggal')).toBe('');
  });

  it('normalisasiBanding merapatkan spasi dan membuang baris kosong', () => {
    expect(normalisasiBanding('  a  b \n\n c ')).toBe('a b\nc');
  });
});

describe('migrasiPeriksa', () => {
  it('mengenali spreadsheet pengajuan dan menghitung barisnya', async () => {
    const h = await migrasiPeriksa(OPSI);
    expect(h.sah).toBe(true);
    expect(h.jenis).toBe('FORM');
    expect(h.jumlahBaris).toBe(2);
  });

  it('menolak header asing dengan menyebut kolom yang hilang', async () => {
    const h = await migrasiPeriksa({ sumber: 'x', isiCsv: 'Nama Barang,Jumlah\na,1', ujiCoba: true });
    expect(h.sah).toBe(false);
    expect(h.pesan).toMatch(/tidak dikenali/i);
  });
});

describe('migrasiJalankan', () => {
  it('memberi nomor berurut menurut timestamp terlama, bukan urutan baris', async () => {
    await migrasiJalankan(OPSI);
    // Baris 29 April ada di urutan KEDUA di CSV, tapi harus dapat 0001.
    const pertama = await pengajuanCariNomor('BRB-2026-0001');
    expect(pertama?.judul).toBe('Raperbup tentang Percontohan');
    const kedua = await pengajuanCariNomor('BRB-2026-0002');
    expect(kedua?.judul).toBe('Raperda tentang Retribusi');
  });

  it('memecah kolom 16 jadi baris riwayat terstruktur', async () => {
    await migrasiJalankan(OPSI);
    const p = await pengajuanCariNomor('BRB-2026-0001');
    const r = await riwayatUntuk(p!.id);
    expect(r).toHaveLength(2);
    expect(r[0]!.tahap).toBe('BERKAS_MASUK');
    expect(r[1]!.tahap).toBe('REVIU_HUKUM');
  });

  it('perbandingan bolak-balik kolom 16 bersih', async () => {
    const l = await migrasiJalankan(OPSI);
    expect(l.selisihKolom16).toEqual([]);
  });

  it('menyalin tautan berkas apa adanya sebagai sumber tautan', async () => {
    await migrasiJalankan(OPSI);
    const p = await pengajuanCariNomor('BRB-2026-0001');
    const b = await berkasUntuk(p!.id);
    expect(b).toHaveLength(1);
    expect(b[0]!.sumber).toBe('tautan');
    expect(b[0]!.jalur).toBe('https://drive.google.com/file/d/bbb/view');
  });

  it('memetakan BPKAD KABUPATEN BREBES ke OPD BPKAD lewat awalan', async () => {
    await migrasiJalankan(OPSI);
    const p = await pengajuanCariNomor('BRB-2026-0001');
    expect(p!.opd_id).not.toBeNull();
  });

  it('OPD yang tidak dikenali dilaporkan, bukan ditebak diam-diam', async () => {
    const l = await migrasiJalankan(OPSI);
    expect(l.opdPerluPeriksa).toContain('Dinas Antah Berantah');

    // Dan yang dikenali tidak ikut dilaporkan, supaya daftarnya tetap berguna.
    expect(l.opdPerluPeriksa).not.toContain('BPKAD KABUPATEN BREBES');
  });

  it('mempertahankan status dan keterangan dari spreadsheet', async () => {
    await migrasiJalankan(OPSI);
    const p = await pengajuanCariNomor('BRB-2026-0001');
    expect(p!.status).toBe('SELESAI');
    expect(p!.keterangan).toBe('Catatan uji');
  });

  it('mode uji-coba melaporkan tanpa menulis apa pun', async () => {
    const l = await migrasiJalankan({ ...OPSI, ujiCoba: true });
    expect(l.barisDibaca).toBe(2);
    expect(l.barisDisisipkan).toBe(2);
    expect(l.riwayatTerurai).toBe(3);
    expect(await pengajuanSemua()).toHaveLength(0);
  });

  it('idempoten: dijalankan dua kali tidak menggandakan data', async () => {
    await migrasiJalankan(OPSI);
    const l2 = await migrasiJalankan(OPSI);
    expect(l2.barisDisisipkan).toBe(0);
    expect(l2.dilewati).toHaveLength(2);
    expect(await pengajuanSemua()).toHaveLength(2);
  });

  it('baris yang polanya tidak terbaca tetap masuk sebagai LAINNYA', async () => {
    const csv = CSV.replace(
      '- 2 Mei 2026 Berkas masuk ke sistem',
      'menunggu konfirmasi pimpinan'
    );
    const l = await migrasiJalankan({ ...OPSI, isiCsv: csv });
    expect(l.riwayatLainnya).toBeGreaterThan(0);
    const p = await pengajuanCariNomor('BRB-2026-0002');
    const r = await riwayatUntuk(p!.id);
    expect(r[0]!.tahap).toBe('LAINNYA');
    expect(r[0]!.keterangan).toBe('menunggu konfirmasi pimpinan');
  });

  it('kegagalan di tengah tidak meninggalkan data separuh jalan', async () => {
    // Judul melebihi batas kolom membuat penyisipan gagal di baris kedua.
    const csv = CSV.replace('Raperda tentang Retribusi', 'x'.repeat(70000));
    await expect(migrasiJalankan({ ...OPSI, isiCsv: csv })).rejects.toThrow();
    expect(await pengajuanSemua()).toHaveLength(0);
  });
});
