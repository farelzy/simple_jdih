import { describe, it, expect } from 'vitest';
import {
  uraiTanggalIndonesia, formatTanggalIndonesia, tebakTahap,
  uraiKolomProses, susunKolomProses
} from '../../murni/parser-riwayat.js';

// Contoh diambil dari pola nyata kolom 16 spreadsheet PROGRES PENGAJUAN.
const NYATA = [
  '- 22 Juli 2026 Berkas masuk ke sistem',
  '- 23 Juli 2026 Berkas sedang direviu Bagian Hukum',
  '- 23 Juli 2026 Berkas sudah terinput ke sistem pra harmonisasi (Kemenkum Kanwil Jateng)',
  '- 25 Juli 2026 Rapat zoom harmonisasi bersama Kanwil Kemenkum Jateng',
  '- 28 Juli 2026 Surat selesai harmonisasi sudah terbit',
  '- 29 Juli 2026 Berkas diajukan fasilitasi ke Biro Hukum Provinsi Jateng',
  '- 30 Juli 2026 Hasil fasilitasi sudah terbit'
].join('\n');

describe('uraiTanggalIndonesia', () => {
  it('membaca tanggal di awal teks dan mengembalikan sisanya', () => {
    expect(uraiTanggalIndonesia('23 Juli 2026 Berkas sedang direviu', 2026))
      .toEqual({ iso: '2026-07-23', sisa: 'Berkas sedang direviu' });
    expect(uraiTanggalIndonesia('1 Januari 2025 Awal', 2026))
      .toEqual({ iso: '2025-01-01', sisa: 'Awal' });
  });

  it('menerima nama bulan dengan ejaan berbeda', () => {
    expect(uraiTanggalIndonesia('5 agustus 2026 x', 2026)?.iso).toBe('2026-08-05');
    expect(uraiTanggalIndonesia('5 AGUSTUS 2026 x', 2026)?.iso).toBe('2026-08-05');
    expect(uraiTanggalIndonesia('5 Agt 2026 x', 2026)?.iso).toBe('2026-08-05');
    expect(uraiTanggalIndonesia('5 Des 2026 x', 2026)?.iso).toBe('2026-12-05');
    expect(uraiTanggalIndonesia('5 Nopember 2026 x', 2026)?.iso).toBe('2026-11-05');
  });

  it('memakai tahun bawaan bila tahun tidak ditulis', () => {
    expect(uraiTanggalIndonesia('23 Juli Berkas direviu', 2026))
      .toEqual({ iso: '2026-07-23', sisa: 'Berkas direviu' });
  });

  it('menolak teks tanpa tanggal di awal atau tanggal mustahil', () => {
    expect(uraiTanggalIndonesia('Berkas sedang direviu', 2026)).toBeNull();
    expect(uraiTanggalIndonesia('', 2026)).toBeNull();
    expect(uraiTanggalIndonesia('32 Juli 2026 x', 2026)).toBeNull();
    expect(uraiTanggalIndonesia('30 Februari 2026 x', 2026)).toBeNull();
    expect(uraiTanggalIndonesia('5 Entah 2026 x', 2026)).toBeNull();
  });
});

describe('formatTanggalIndonesia', () => {
  it('mengembalikan bentuk yang dibaca manusia', () => {
    expect(formatTanggalIndonesia('2026-07-23')).toBe('23 Juli 2026');
    expect(formatTanggalIndonesia('2026-01-01')).toBe('1 Januari 2026');
    expect(formatTanggalIndonesia('')).toBe('');
    expect(formatTanggalIndonesia('bukan tanggal')).toBe('');
  });
});

describe('tebakTahap', () => {
  it('mengenali seluruh tahap dari kata kunci nyata', () => {
    expect(tebakTahap('Berkas masuk ke sistem')).toBe('BERKAS_MASUK');
    expect(tebakTahap('Berkas sedang direviu Bagian Hukum')).toBe('REVIU_HUKUM');
    expect(tebakTahap('Berkas sudah terinput ke sistem pra harmonisasi (Kemenkum Kanwil Jateng)')).toBe('PRA_HARMONISASI');
    expect(tebakTahap('Berkas sudah terinput ke sistem praharmonisasi')).toBe('PRA_HARMONISASI');
    expect(tebakTahap('Rapat zoom harmonisasi bersama Kanwil')).toBe('RAPAT_HARMONISASI');
    expect(tebakTahap('Surat selesai harmonisasi sudah terbit')).toBe('SELESAI_HARMONISASI');
    expect(tebakTahap('Berkas diajukan fasilitasi ke Biro Hukum Provinsi Jateng')).toBe('FASILITASI');
    expect(tebakTahap('Hasil fasilitasi sudah terbit')).toBe('HASIL_FASILITASI');
    expect(tebakTahap('Berkas dikembalikan ke OPD')).toBe('DIKEMBALIKAN');
    expect(tebakTahap('Menunggu perbaikan dari OPD')).toBe('PERBAIKAN');
    expect(tebakTahap('Perbup sudah ditetapkan')).toBe('PENETAPAN');
    expect(tebakTahap('Sesuatu yang tidak dikenali sama sekali')).toBe('LAINNYA');
    expect(tebakTahap('')).toBe('LAINNYA');
  });

  it('tidak tertukar antara pra harmonisasi dan harmonisasi biasa', () => {
    expect(tebakTahap('pra harmonisasi')).toBe('PRA_HARMONISASI');
    expect(tebakTahap('harmonisasi')).toBe('RAPAT_HARMONISASI');
    expect(tebakTahap('selesai harmonisasi')).toBe('SELESAI_HARMONISASI');
  });
});

describe('uraiKolomProses', () => {
  it('memecah lini masa nyata jadi baris terstruktur', () => {
    const hasil = uraiKolomProses(NYATA, 2026);
    expect(hasil).toHaveLength(7);
    expect({ tanggal: hasil[0]!.tanggal, tahap: hasil[0]!.tahap, keterangan: hasil[0]!.keterangan })
      .toEqual({ tanggal: '2026-07-22', tahap: 'BERKAS_MASUK', keterangan: 'Berkas masuk ke sistem' });
    expect(hasil[2]!.tahap).toBe('PRA_HARMONISASI');
    expect(hasil[4]!.tahap).toBe('SELESAI_HARMONISASI');
    expect(hasil[6]!.tahap).toBe('HASIL_FASILITASI');
  });

  it('menerima entri tanpa tanda hubung', () => {
    const hasil = uraiKolomProses('22 Juli 2026 Berkas masuk\n23 Juli 2026 Direviu Bagian Hukum', 2026);
    expect(hasil).toHaveLength(2);
    expect(hasil[0]!.tanggal).toBe('2026-07-22');
    expect(hasil[1]!.tahap).toBe('REVIU_HUKUM');
  });

  it('menerima berbagai penanda butir', () => {
    const hasil = uraiKolomProses('* 22 Juli 2026 Berkas masuk\n1. 23 Juli 2026 Direviu\n• 24 Juli 2026 Fasilitasi', 2026);
    expect(hasil).toHaveLength(3);
    expect(hasil[2]!.tanggal).toBe('2026-07-24');
  });

  it('memecah dua kejadian yang ditulis dalam satu baris', () => {
    const hasil = uraiKolomProses(
      '- 22 Juli 2026 Berkas masuk ke sistem - 23 Juli 2026 Berkas sedang direviu Bagian Hukum', 2026
    );
    expect(hasil).toHaveLength(2);
    expect(hasil[0]!.keterangan).toBe('Berkas masuk ke sistem');
    expect(hasil[1]!.tanggal).toBe('2026-07-23');
    expect(hasil[1]!.keterangan).toBe('Berkas sedang direviu Bagian Hukum');
  });

  it('memakai tahun bawaan untuk tanggal tanpa tahun', () => {
    expect(uraiKolomProses('- 22 Juli Berkas masuk', 2025)[0]!.tanggal).toBe('2025-07-22');
  });

  it('baris yang polanya tidak terbaca tetap dipindahkan utuh sebagai LAINNYA', () => {
    const hasil = uraiKolomProses('- 22 Juli 2026 Berkas masuk\nmenunggu konfirmasi dari pimpinan', 2026);
    expect(hasil).toHaveLength(2);
    expect(hasil[1]!.tanggal).toBe('');
    expect(hasil[1]!.tahap).toBe('LAINNYA');
    expect(hasil[1]!.keterangan).toBe('menunggu konfirmasi dari pimpinan');
    expect(hasil[1]!.mentah).toBe('menunggu konfirmasi dari pimpinan');
  });

  it('tidak membuang kalimat apa pun', () => {
    const teks = NYATA + '\ncatatan bebas tanpa tanggal\n\n- 31 Juli 2026 Selesai';
    const hasil = uraiKolomProses(teks, 2026);
    const gabungan = hasil.map((b) => b.keterangan).join(' ');
    expect(gabungan).toContain('catatan bebas tanpa tanggal');
    expect(gabungan).toContain('Rapat zoom harmonisasi bersama Kanwil Kemenkum Jateng');
    expect(hasil).toHaveLength(9);
  });

  it('mengembalikan array kosong untuk isi kosong', () => {
    expect(uraiKolomProses('', 2026)).toEqual([]);
    expect(uraiKolomProses(null, 2026)).toEqual([]);
    expect(uraiKolomProses('   \n\n  ', 2026)).toEqual([]);
  });
});

describe('susunKolomProses', () => {
  it('menghasilkan bentuk yang sama dengan tulisan tangan Bagian Hukum', () => {
    expect(susunKolomProses([
      { tanggal: '2026-07-22', keterangan: 'Berkas masuk ke sistem' },
      { tanggal: '2026-07-23', keterangan: 'Berkas sedang direviu Bagian Hukum' }
    ])).toBe('- 22 Juli 2026 Berkas masuk ke sistem\n- 23 Juli 2026 Berkas sedang direviu Bagian Hukum');
  });

  it('menulis baris tanpa tanggal tanpa memaksakan tanggal palsu', () => {
    expect(susunKolomProses([{ tanggal: '', keterangan: 'catatan bebas' }])).toBe('- catatan bebas');
    expect(susunKolomProses([])).toBe('');
  });
});

/**
 * Uji paling penting di berkas ini. Kalau urai lalu susun ulang menghasilkan
 * teks berbeda, ada informasi riwayat yang berubah bentuk saat migrasi -- dan
 * riwayat itulah yang paling dicari OPD saat membuka monitoring.
 */
describe('perjalanan bolak-balik', () => {
  it('urai lalu susun ulang mengembalikan teks yang sama persis', () => {
    expect(susunKolomProses(uraiKolomProses(NYATA, 2026))).toBe(NYATA);
  });
});
