import { describe, it, expect } from 'vitest';
import {
  ekstensiDari, normalisasiWa, formatWa, samarkanWa,
  validasiBerkas, validasiPengajuan
} from '../../murni/validasi.js';

/** Nilai bawaan yang sama dengan sql/002-seed.sql. */
const PENGATURAN: Record<string, string> = {
  batas_surat_permohonan: '5',
  batas_keterangan_na: '5',
  batas_rancangan: '10',
  batas_lampiran: '30',
  batas_paraf: '5',
  batas_dasar_hukum: '5',
  batas_sk_tim: '5',
  batas_ba_pansus: '5',
  batas_hasil_konsultasi: '30',
  maks_berkas_ba_pansus: '5'
};

function dataPerbup(ubah: Record<string, unknown> = {}) {
  return {
    jenis_peraturan: 'Bupati',
    opd: 'BPKAD',
    judul: 'Rancangan Peraturan Bupati tentang Percontohan',
    nama_pemohon: 'Mayasari',
    wa_pemohon: '082299989690',
    berkas: {
      surat_permohonan: [{ nama: 'a.pdf', ukuran: 1000 }],
      keterangan_na: [{ nama: 'b.pdf', ukuran: 1000 }],
      rancangan: [{ nama: 'c.docx', ukuran: 1000 }],
      paraf: [{ nama: 'd.pdf', ukuran: 1000 }],
      dasar_hukum: [{ nama: 'e.pdf', ukuran: 1000 }]
    } as Record<string, { nama: string; ukuran: number }[]>,
    ...ubah
  };
}

describe('normalisasiWa', () => {
  it('menerima berbagai bentuk penulisan', () => {
    expect(normalisasiWa('082299989690')).toBe('082299989690');
    expect(normalisasiWa('0822-9998-9690')).toBe('082299989690');
    expect(normalisasiWa('+62 822 9998 9690')).toBe('082299989690');
    expect(normalisasiWa('62822 9998 9690')).toBe('082299989690');
  });

  it('menolak yang tidak menyerupai nomor seluler Indonesia', () => {
    expect(normalisasiWa('8229998969')).toBeNull();
    expect(normalisasiWa('08122')).toBeNull();
    expect(normalisasiWa('0812345678901234')).toBeNull();
    expect(normalisasiWa('bukan nomor')).toBeNull();
    expect(normalisasiWa('')).toBeNull();
    expect(normalisasiWa(null)).toBeNull();
  });
});

describe('formatWa dan samarkanWa', () => {
  it('mengikuti contoh desain', () => {
    expect(formatWa('082299989690')).toBe('0822-9998-9690');
    expect(samarkanWa('082299989690')).toBe('0822****9690');
    expect(samarkanWa('')).toBe('');
  });
});

describe('ekstensiDari', () => {
  it('membaca ekstensi tanpa peduli huruf besar kecil', () => {
    expect(ekstensiDari('Surat.PDF')).toBe('pdf');
    expect(ekstensiDari('draf.raperda.docx')).toBe('docx');
    expect(ekstensiDari('tanpaekstensi')).toBe('');
  });
});

describe('validasiBerkas', () => {
  it('menolak jenis berkas yang tidak diizinkan per kolom', () => {
    expect(validasiBerkas({ kolom: 'surat_permohonan', nama: 's.pdf', ukuran: 1000 }, PENGATURAN).sah).toBe(true);
    expect(validasiBerkas({ kolom: 'surat_permohonan', nama: 's.docx', ukuran: 1000 }, PENGATURAN).sah).toBe(false);
    // Rancangan harus bisa disunting Bagian Hukum, jadi PDF ditolak.
    expect(validasiBerkas({ kolom: 'rancangan', nama: 'r.pdf', ukuran: 1000 }, PENGATURAN).sah).toBe(false);
    expect(validasiBerkas({ kolom: 'rancangan', nama: 'r.docx', ukuran: 1000 }, PENGATURAN).sah).toBe(true);
    expect(validasiBerkas({ kolom: 'paraf', nama: 'p.jpg', ukuran: 1000 }, PENGATURAN).sah).toBe(true);
    expect(validasiBerkas({ kolom: 'lampiran', nama: 'l.zip', ukuran: 1000 }, PENGATURAN).sah).toBe(true);
  });

  it('menolak berkas melebihi batas dan menyebut batasnya', () => {
    const limaMb = 5 * 1024 * 1024;
    expect(validasiBerkas({ kolom: 'surat_permohonan', nama: 's.pdf', ukuran: limaMb }, PENGATURAN).sah).toBe(true);
    const hasil = validasiBerkas({ kolom: 'surat_permohonan', nama: 's.pdf', ukuran: limaMb + 1 }, PENGATURAN);
    expect(hasil.sah).toBe(false);
    expect(hasil.pesan).toMatch(/5 MB/);
  });

  it('menerima lampiran sampai 30 MB', () => {
    expect(validasiBerkas({ kolom: 'lampiran', nama: 'l.zip', ukuran: 30 * 1024 * 1024 }, PENGATURAN).sah).toBe(true);
    expect(validasiBerkas({ kolom: 'lampiran', nama: 'l.zip', ukuran: 31 * 1024 * 1024 }, PENGATURAN).sah).toBe(false);
  });

  it('menghormati batas yang diubah lewat pengaturan', () => {
    const p = { ...PENGATURAN, batas_surat_permohonan: '20' };
    expect(validasiBerkas({ kolom: 'surat_permohonan', nama: 's.pdf', ukuran: 10 * 1024 * 1024 }, p).sah).toBe(true);
  });

  it('menolak berkas kosong dan kolom tak dikenal', () => {
    expect(validasiBerkas({ kolom: 'surat_permohonan', nama: 's.pdf', ukuran: 0 }, PENGATURAN).sah).toBe(false);
    expect(validasiBerkas({ kolom: 'entah', nama: 's.pdf', ukuran: 100 }, PENGATURAN).sah).toBe(false);
  });
});

describe('validasiPengajuan', () => {
  it('pengajuan Perbup yang lengkap dinyatakan sah', () => {
    const hasil = validasiPengajuan(dataPerbup(), PENGATURAN);
    expect(hasil.galat).toEqual([]);
    expect(hasil.sah).toBe(true);
  });

  it('Perbup tidak diwajibkan melampirkan SK Tim atau BA PANSUS', () => {
    const kolom = validasiPengajuan(dataPerbup(), PENGATURAN).galat.map((g) => g.kolom);
    expect(kolom).not.toContain('sk_tim');
    expect(kolom).not.toContain('ba_pansus');
  });

  it('Perda mewajibkan SK Tim dan BA PANSUS', () => {
    const hasil = validasiPengajuan(dataPerbup({ jenis_peraturan: 'Daerah' }), PENGATURAN);
    expect(hasil.sah).toBe(false);
    const kolom = hasil.galat.map((g) => g.kolom);
    expect(kolom).toContain('sk_tim');
    expect(kolom).toContain('ba_pansus');
  });

  it('Perda dengan SK Tim dan BA PANSUS dinyatakan sah', () => {
    const data = dataPerbup({ jenis_peraturan: 'Daerah' });
    data.berkas.sk_tim = [{ nama: 'sk.pdf', ukuran: 1000 }];
    data.berkas.ba_pansus = [{ nama: 'ba.pdf', ukuran: 1000 }];
    expect(validasiPengajuan(data, PENGATURAN).galat).toEqual([]);
  });

  it('Perbup yang menyertakan SK Tim ditolak karena kolom itu tidak berlaku', () => {
    const data = dataPerbup();
    data.berkas.sk_tim = [{ nama: 'sk.pdf', ukuran: 1000 }];
    expect(validasiPengajuan(data, PENGATURAN).galat.some((g) => g.kolom === 'sk_tim')).toBe(true);
  });

  it('kolom teks wajib yang kosong ditolak dengan pesan per kolom', () => {
    const kolom = validasiPengajuan(
      dataPerbup({ judul: '   ', nama_pemohon: '' }), PENGATURAN
    ).galat.map((g) => g.kolom);
    expect(kolom).toContain('judul');
    expect(kolom).toContain('nama_pemohon');
  });

  it('jenis peraturan di luar Daerah/Bupati ditolak', () => {
    const hasil = validasiPengajuan(dataPerbup({ jenis_peraturan: 'Menteri' }), PENGATURAN);
    expect(hasil.galat.some((g) => g.kolom === 'jenis_peraturan')).toBe(true);
  });

  it('nomor WhatsApp tidak sah ditolak', () => {
    const hasil = validasiPengajuan(dataPerbup({ wa_pemohon: '123' }), PENGATURAN);
    expect(hasil.galat.some((g) => g.kolom === 'wa_pemohon')).toBe(true);
  });

  it('BA PANSUS dibatasi lima berkas', () => {
    const data = dataPerbup({ jenis_peraturan: 'Daerah' });
    data.berkas.sk_tim = [{ nama: 'sk.pdf', ukuran: 1000 }];
    data.berkas.ba_pansus = [1, 2, 3, 4, 5, 6].map((n) => ({ nama: `ba${n}.pdf`, ukuran: 1000 }));
    expect(validasiPengajuan(data, PENGATURAN).galat.some(
      (g) => g.kolom === 'ba_pansus' && /5/.test(g.pesan)
    )).toBe(true);
  });
});
