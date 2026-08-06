import { describe, it, expect } from 'vitest';
import { normalisasiHeader, judulKolom, cocokkanHeader } from '../../murni/skema.js';

const HEADER_FORM = [
  'Timestamp',
  'Nama OPD Pemohon',
  'Jenis Rancangan Peraturan',
  'Judul Raperda/Raperbup',
  'Surat Permohonan Rancangan Perda/Perbup',
  'Keterangan/Penjelasan Rancangan Perbup atau NA Perda',
  'Rancangan Perda/Perbup',
  'Lampiran Raperda/Raperbup',
  'Paraf Koordinasi',
  'Dasar Hukum Penyusunan Raperda/Raperbup',
  'SK Tim Penyusunan RAPERDA',
  'Berita Acara Rapat PANSUS AKHIR',
  'Hasil Konsultasi',
  'Nama Pemohon',
  'Nomor WhatsApp Pemohon',
  'Tanggal dan Detail Proses',
  'Keterangan',
  'Status'
];

describe('normalisasiHeader', () => {
  it('menyeragamkan spasi, huruf besar, dan tanda baca', () => {
    expect(normalisasiHeader('  Nama   OPD Pemohon ')).toBe('nama opd pemohon');
    expect(normalisasiHeader('Judul Raperda/Raperbup')).toBe('judul raperda raperbup');
    expect(normalisasiHeader('SK Tim Penyusunan RAPERDA')).toBe('sk tim penyusunan raperda');
    expect(normalisasiHeader(null)).toBe('');
    expect(normalisasiHeader(undefined)).toBe('');
  });
});

describe('judulKolom', () => {
  it('mengembalikan judul resmi untuk kunci', () => {
    expect(judulKolom('opd')).toBe('Nama OPD Pemohon');
    expect(judulKolom('id')).toBe('ID');
    expect(judulKolom('entah')).toBe('');
  });
});

describe('cocokkanHeader', () => {
  it('mengenali baris kosong sebagai spreadsheet kosong', () => {
    expect(cocokkanHeader([]).jenis).toBe('KOSONG');
    expect(cocokkanHeader(['', '  ', '']).jenis).toBe('KOSONG');
  });

  /**
   * Header ini disalin persis dari spreadsheet PERMOHONAN RAPERDA/RAPERBUP pada
   * 4 Agustus 2026. Dua kolomnya berbeda dari dokumen desain, dan perbedaan itu
   * sempat membuat penyiapan menolak spreadsheet aslinya mentah-mentah.
   */
  it('mengenali header spreadsheet Linktree yang sungguhan', () => {
    const hasil = cocokkanHeader(HEADER_FORM);
    expect(hasil.jenis).toBe('FORM');
    expect(hasil.hilang).toEqual([]);
    expect(hasil.asing).toEqual([]);
    expect(hasil.peta.timestamp).toBe(0);
    expect(hasil.peta.opd).toBe(1);
    expect(hasil.peta.jenis_peraturan).toBe(2);
    expect(hasil.peta.judul).toBe(3);
    expect(hasil.peta.keterangan_na).toBe(5);
    expect(hasil.peta.dasar_hukum).toBe(9);
    expect(hasil.peta.sk_tim).toBe(10);
    expect(hasil.peta.status).toBe(17);
  });

  it('mengabaikan kolom kosong sisa rekap manual di sebelah kanan', () => {
    const hasil = cocokkanHeader([...HEADER_FORM, '', '', '', '']);
    expect(hasil.jenis).toBe('FORM');
    expect(hasil.asing).toEqual([]);
  });

  it('tetap menerima ejaan versi dokumen desain lewat alias', () => {
    const varian = [...HEADER_FORM];
    varian[5] = 'Keterangan/Penjelasan Raperbup atau NA Perda';
    varian[9] = 'Dasar Hukum Penyusunan';
    const hasil = cocokkanHeader(varian);
    expect(hasil.jenis).toBe('FORM');
    expect(hasil.hilang).toEqual([]);
  });

  it('mengenali spreadsheet yang sudah pernah dipasang SIMPEL', () => {
    const hasil = cocokkanHeader(
      [...HEADER_FORM, 'ID', 'Email Pemohon', 'Kode OPD', 'Diperbarui Pada', 'Diperbarui Oleh']
    );
    expect(hasil.jenis).toBe('SIMPEL');
    expect(hasil.peta.id).toBe(18);
    expect(hasil.peta.email_pemohon).toBe(19);
    expect(hasil.peta.diperbarui_oleh).toBe(22);
  });

  it('mencocokkan meski ejaan sedikit berbeda', () => {
    const varian = [...HEADER_FORM];
    varian[1] = 'NAMA OPD PEMOHON';
    varian[3] = 'Judul Raperda / Raperbup';
    varian[14] = 'Nomor Whatsapp Pemohon';
    expect(cocokkanHeader(varian).hilang).toEqual([]);
  });

  it('menandai spreadsheet asing dan menyebut kolom yang hilang', () => {
    const hasil = cocokkanHeader(['Nama Barang', 'Jumlah', 'Harga Satuan']);
    expect(hasil.jenis).toBe('ASING');
    expect(hasil.hilang).toContain('judul');
    expect(hasil.asing).toEqual(['Nama Barang', 'Jumlah', 'Harga Satuan']);
  });

  it('menganggap ASING bila hanya sebagian kolom cocok', () => {
    // Memuat data dengan pemetaan tebak-tebakan lebih berbahaya daripada
    // menolak dan meminta manusia memeriksanya.
    expect(cocokkanHeader(['Timestamp', 'Nama Pemohon', 'Catatan', 'Total']).jenis).toBe('ASING');
  });
});
