import { describe, it, expect } from 'vitest';
import { uraiNomor, nomorBerikutnya, nomorTerbesar } from '../../pure/penomoran.js';

describe('uraiNomor', () => {
  it('membaca bagian-bagian nomor yang sah', () => {
    expect(uraiNomor('BRB-2026-0029')).toEqual({ prefiks: 'BRB', tahun: 2026, urut: 29 });
    expect(uraiNomor('  brb-2026-0001  ')).toEqual({ prefiks: 'BRB', tahun: 2026, urut: 1 });
  });

  it('menolak bentuk yang tidak sesuai', () => {
    expect(uraiNomor('')).toBeNull();
    expect(uraiNomor(null)).toBeNull();
    expect(uraiNomor('BRB-2026')).toBeNull();
    expect(uraiNomor('BRB/2026/0029')).toBeNull();
    expect(uraiNomor('BRB-2026-29')).toBeNull();
  });
});

describe('nomorBerikutnya', () => {
  it('melanjutkan urutan di tahun yang sama', () => {
    expect(nomorBerikutnya(2026, 'BRB-2026-0029')).toBe('BRB-2026-0030');
    expect(nomorBerikutnya(2026, 'BRB-2026-0009')).toBe('BRB-2026-0010');
    expect(nomorBerikutnya(2026, 'BRB-2026-0999')).toBe('BRB-2026-1000');
  });

  it('mengulang dari 0001 saat tahun berganti', () => {
    expect(nomorBerikutnya(2027, 'BRB-2026-0029')).toBe('BRB-2027-0001');
  });

  it('mulai dari 0001 bila belum ada nomor sama sekali', () => {
    expect(nomorBerikutnya(2026, '')).toBe('BRB-2026-0001');
    expect(nomorBerikutnya(2026, null)).toBe('BRB-2026-0001');
    expect(nomorBerikutnya(2026, 'rusak')).toBe('BRB-2026-0001');
  });

  it('urutan panjang tidak pernah menghasilkan nomor kembar', () => {
    const terlihat = new Set<string>();
    let terakhir = '';
    for (let i = 0; i < 500; i++) {
      terakhir = nomorBerikutnya(2026, terakhir);
      expect(terlihat.has(terakhir)).toBe(false);
      terlihat.add(terakhir);
    }
    expect(terakhir).toBe('BRB-2026-0500');
  });
});

describe('nomorTerbesar', () => {
  it('memilih urut tertinggi pada tahun tertinggi', () => {
    expect(nomorTerbesar(['BRB-2026-0003', 'BRB-2026-0029', 'BRB-2026-0007'])).toBe('BRB-2026-0029');
    expect(nomorTerbesar(['BRB-2027-0001', 'BRB-2026-0029'])).toBe('BRB-2027-0001');
  });

  it('mengembalikan kosong bila tidak ada yang sah', () => {
    expect(nomorTerbesar([])).toBe('');
    expect(nomorTerbesar(['', 'rusak', null])).toBe('');
  });
});
