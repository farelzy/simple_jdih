import { describe, it, expect } from 'vitest';
import {
  rekapPerStatus, rekapPerOpd, rekapPerBulan,
  selisihHari, rataLamaProsesHari, cariMandek, keCsv
} from '../../pure/rekap.js';

const CONTOH = [
  { id: 'BRB-2026-0001', opd: 'BPKAD', status: 'SELESAI', masuk: '2026-04-29', diperbarui: '2026-05-20' },
  { id: 'BRB-2026-0002', opd: 'BPKAD', status: 'PROSES', masuk: '2026-05-02', diperbarui: '2026-07-25' },
  { id: 'BRB-2026-0003', opd: 'Bapperida', status: 'PROSES', masuk: '2026-06-10', diperbarui: '2026-07-01' },
  { id: 'BRB-2026-0004', opd: 'DP3KB', status: 'DIKEMBALIKAN', masuk: '2026-06-15', diperbarui: '2026-06-20' },
  { id: 'BRB-2026-0005', opd: 'BPKAD', status: 'SELESAI', masuk: '2026-07-01', diperbarui: '2026-07-11' }
];

describe('rekapPerStatus', () => {
  it('menghitung total dan tiap status', () => {
    expect(rekapPerStatus(CONTOH)).toEqual({ TOTAL: 5, PROSES: 2, SELESAI: 2, DIKEMBALIKAN: 1 });
  });

  it('mengembalikan nol untuk daftar kosong', () => {
    expect(rekapPerStatus([])).toEqual({ TOTAL: 0, PROSES: 0, SELESAI: 0, DIKEMBALIKAN: 0 });
  });

  it('mengabaikan huruf besar kecil dan spasi status', () => {
    const hasil = rekapPerStatus([{ status: ' proses ' }, { status: 'Selesai' }, { status: '' }]);
    expect(hasil.PROSES).toBe(1);
    expect(hasil.SELESAI).toBe(1);
    expect(hasil.TOTAL).toBe(3);
  });
});

describe('rekapPerOpd', () => {
  it('mengurutkan dari terbanyak lalu abjad', () => {
    expect(rekapPerOpd(CONTOH)).toEqual([
      { opd: 'BPKAD', jumlah: 3 },
      { opd: 'Bapperida', jumlah: 1 },
      { opd: 'DP3KB', jumlah: 1 }
    ]);
  });

  it('mengelompokkan yang kosong sebagai (tidak diisi)', () => {
    expect(rekapPerOpd([{ opd: '' }, { opd: '  ' }])).toEqual([{ opd: '(tidak diisi)', jumlah: 2 }]);
  });
});

describe('rekapPerBulan', () => {
  it('mengelompokkan menurut bulan masuk secara menaik', () => {
    expect(rekapPerBulan(CONTOH)).toEqual([
      { bulan: '2026-04', jumlah: 1 },
      { bulan: '2026-05', jumlah: 1 },
      { bulan: '2026-06', jumlah: 2 },
      { bulan: '2026-07', jumlah: 1 }
    ]);
  });
});

describe('selisihHari', () => {
  it('menghitung jarak antar tanggal ISO', () => {
    expect(selisihHari('2026-07-01', '2026-07-11')).toBe(10);
    expect(selisihHari('2026-07-11', '2026-07-11')).toBe(0);
    expect(selisihHari('2026-04-29', '2026-05-20')).toBe(21);
  });

  it('mengembalikan null untuk tanggal yang tidak terbaca', () => {
    expect(selisihHari('', '2026-05-20')).toBeNull();
    expect(selisihHari('bukan', 'tanggal')).toBeNull();
  });
});

describe('rataLamaProsesHari', () => {
  it('hanya menghitung yang sudah SELESAI', () => {
    // 2026-04-29 -> 2026-05-20 = 21 hari; 2026-07-01 -> 2026-07-11 = 10 hari
    expect(rataLamaProsesHari(CONTOH)).toBe(15.5);
  });

  it('mengembalikan null bila belum ada yang selesai', () => {
    // Memasukkan yang masih PROSES membuat angkanya turun terus seiring waktu
    // dan tidak berarti apa-apa.
    expect(rataLamaProsesHari([{ status: 'PROSES', masuk: '2026-01-01', diperbarui: '2026-02-01' }])).toBeNull();
    expect(rataLamaProsesHari([])).toBeNull();
  });
});

describe('cariMandek', () => {
  it('menandai PROSES yang tidak bergerak melewati ambang', () => {
    // 0002 diperbarui 25 Juli (5 hari, aman), 0003 diperbarui 1 Juli (29 hari, mandek)
    expect(cariMandek(CONTOH, 7, '2026-07-30')).toEqual(['BRB-2026-0003']);
  });

  it('tidak menandai yang sudah SELESAI atau DIKEMBALIKAN', () => {
    expect(cariMandek([
      { id: 'X', status: 'SELESAI', diperbarui: '2020-01-01' },
      { id: 'Y', status: 'DIKEMBALIKAN', diperbarui: '2020-01-01' }
    ], 7, '2026-07-30')).toEqual([]);
  });
});

describe('keCsv', () => {
  it('menulis header dan baris dengan pelolosan tanda kutip', () => {
    expect(keCsv(
      [{ id: 'BRB-2026-0001', judul: 'Raperbup "Percontohan", Tahap I' }],
      [{ kunci: 'id', judul: 'ID' }, { kunci: 'judul', judul: 'Judul' }]
    )).toBe('ID,Judul\r\nBRB-2026-0001,"Raperbup ""Percontohan"", Tahap I"');
  });

  it('membungkus nilai bergaris baru dan menangani nilai kosong', () => {
    expect(keCsv(
      [{ a: 'baris satu\nbaris dua', b: null }],
      [{ kunci: 'a', judul: 'A' }, { kunci: 'b', judul: 'B' }]
    )).toBe('A,B\r\n"baris satu\nbaris dua",');
  });
});
