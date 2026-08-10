import { describe, it, expect } from 'vitest';
import {
  JUDUL_EKSPOR, barisEkspor, formatTimestamp, alamatBerkas, type PengajuanEkspor
} from '../../pure/baris-ekspor.js';

const CONTOH: PengajuanEkspor = {
  nomor: 'BRB-2026-0001',
  opd_teks: 'BPKAD',
  kode_opd: 'BPKAD',
  jenis_peraturan: 'Bupati',
  judul: 'Raperbup tentang Percontohan',
  nama_pemohon: 'Mayasari',
  wa_pemohon: '082299989690',
  email_pemohon: 'maya@brebeskab.go.id',
  status: 'PROSES',
  keterangan: 'Catatan uji',
  dibuat_pada: '2026-05-02 10:00:00',
  diperbarui_pada: '2026-05-03 11:30:00',
  diperbarui_oleh: 'admin@simpel',
  riwayat: [
    { tanggal: '2026-05-02', keterangan: 'Berkas masuk ke sistem' },
    { tanggal: '2026-05-03', keterangan: 'Berkas sedang direviu Bagian Hukum' }
  ],
  berkas: [
    { id: 7, kolom: 'surat_permohonan', sumber: 'lokal', jalur: 'abc.pdf' },
    { id: 8, kolom: 'lampiran', sumber: 'lokal', jalur: 'def.pdf' },
    { id: 9, kolom: 'lampiran', sumber: 'tautan', jalur: 'https://drive.google.com/file/d/x/view' }
  ]
};

/** Posisi kolom menurut judulnya, supaya uji tidak bergantung indeks hafalan. */
function di(judul: string, baris: (string | number)[]): string {
  const i = JUDUL_EKSPOR.indexOf(judul);
  if (i < 0) throw new Error(`Kolom '${judul}' tidak ada di JUDUL_EKSPOR`);
  return String(baris[i] ?? '');
}

describe('formatTimestamp', () => {
  it('memakai bentuk yang sama dengan Google Form', () => {
    expect(formatTimestamp('2026-05-02 10:00:00')).toBe('02/05/2026 10:00:00');
  });

  it('kosong tetap kosong, bukan "Invalid Date"', () => {
    expect(formatTimestamp('')).toBe('');
    expect(formatTimestamp(null)).toBe('');
  });

  /** Lebih baik menyerahkan teks aslinya daripada menulis "Invalid Date"
   *  ke sel yang akan dibaca manusia. */
  it('nilai yang tidak terbaca dikembalikan apa adanya', () => {
    expect(formatTimestamp('bukan tanggal')).toBe('bukan tanggal');
  });
});

describe('alamatBerkas', () => {
  it('tautan hasil migrasi dipakai apa adanya', () => {
    expect(alamatBerkas({ id: 1, kolom: 'x', sumber: 'tautan', jalur: 'https://drive/x' }, 'https://s'))
      .toBe('https://drive/x');
  });

  it('berkas di VPS jadi URL unduhan yang lengkap', () => {
    expect(alamatBerkas({ id: 5, kolom: 'x', sumber: 'lokal', jalur: 'acak.pdf' },
      'https://simple.jdih.example/')).toBe('https://simple.jdih.example/api/unggah/5');
  });

  /** Jalur di disk adalah nama acak internal; ia tidak boleh bocor ke lembar
   *  yang dibagikan. */
  it('nama berkas di disk tidak pernah muncul', () => {
    expect(alamatBerkas({ id: 5, kolom: 'x', sumber: 'lokal', jalur: 'rahasia-acak.pdf' }))
      .not.toContain('rahasia-acak');
  });
});

describe('barisEkspor', () => {
  const baris = barisEkspor(CONTOH, 'https://simple.jdih.example');

  it('jumlah selnya sama dengan jumlah judul kolom', () => {
    expect(baris).toHaveLength(JUDUL_EKSPOR.length);
  });

  it('susunan kolomnya sama dengan spreadsheet lama', () => {
    expect(JUDUL_EKSPOR[0]).toBe('Timestamp');
    expect(JUDUL_EKSPOR[1]).toBe('Nama OPD Pemohon');
    expect(JUDUL_EKSPOR[15]).toBe('Tanggal dan Detail Proses');
    expect(JUDUL_EKSPOR[17]).toBe('Status');
  });

  it('mengisi kolom teks dari pengajuan', () => {
    expect(di('Timestamp', baris)).toBe('02/05/2026 10:00:00');
    expect(di('Nama OPD Pemohon', baris)).toBe('BPKAD');
    expect(di('Judul Raperda/Raperbup', baris)).toBe('Raperbup tentang Percontohan');
    expect(di('Status', baris)).toBe('PROSES');
    expect(di('ID', baris)).toBe('BRB-2026-0001');
    expect(di('Kode OPD', baris)).toBe('BPKAD');
  });

  /**
   * Kolom 16 harus berbentuk sama dengan yang selama ini diketik manual,
   * supaya hasil ekspor bisa dibaca balik oleh migrasi tanpa penyesuaian.
   */
  it('menyusun ulang kolom proses dari riwayat terstruktur', () => {
    expect(di('Tanggal dan Detail Proses', baris)).toBe(
      '- 2 Mei 2026 Berkas masuk ke sistem\n- 3 Mei 2026 Berkas sedang direviu Bagian Hukum'
    );
  });

  it('beberapa berkas dalam satu kolom dipisah baris baru, bukan koma', () => {
    const lampiran = di('Lampiran Raperda/Raperbup', baris);
    expect(lampiran.split('\n')).toHaveLength(2);
    expect(lampiran).toContain('https://simple.jdih.example/api/unggah/8');
    expect(lampiran).toContain('https://drive.google.com/file/d/x/view');
  });

  it('kolom berkas yang kosong tetap ditulis sebagai sel kosong', () => {
    expect(di('SK Tim Penyusunan RAPERDA', baris)).toBe('');
    expect(baris.filter((s) => s === undefined)).toHaveLength(0);
  });

  it('pengajuan tanpa riwayat dan berkas tetap menghasilkan baris utuh', () => {
    const kosong = barisEkspor({ ...CONTOH, riwayat: [], berkas: [] });
    expect(kosong).toHaveLength(JUDUL_EKSPOR.length);
    expect(di('Tanggal dan Detail Proses', kosong)).toBe('');
  });
});
