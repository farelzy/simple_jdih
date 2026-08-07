import { describe, it, expect } from 'vitest';
import { uraiCsv, urlEksporCsv } from '../../murni/csv.js';

describe('uraiCsv', () => {
  it('mengurai baris sederhana', () => {
    expect(uraiCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('menghormati sel berkutip yang memuat koma', () => {
    expect(uraiCsv('a,"b,c",d')).toEqual([['a', 'b,c', 'd']]);
  });

  it('menerjemahkan kutip ganda jadi satu kutip', () => {
    expect(uraiCsv('a,"Raperbup ""Percontohan"", Tahap I",c'))
      .toEqual([['a', 'Raperbup "Percontohan", Tahap I', 'c']]);
  });

  /**
   * Ini yang paling penting untuk migrasi: kolom 'Tanggal dan Detail Proses'
   * berisi lini masa bertingkat dengan baris baru di dalam SATU sel.
   */
  it('menghormati baris baru di dalam sel', () => {
    const csv = 'nomor,proses\n1,"- 22 Juli 2026 Berkas masuk\n- 23 Juli 2026 Direviu"\n2,kosong';
    const hasil = uraiCsv(csv);
    expect(hasil).toHaveLength(3);
    expect(hasil[1]![1]).toBe('- 22 Juli 2026 Berkas masuk\n- 23 Juli 2026 Direviu');
    expect(hasil[2]![0]).toBe('2');
  });

  it('menerima CRLF', () => {
    expect(uraiCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('membuang BOM di awal berkas', () => {
    expect(uraiCsv('﻿a,b')).toEqual([['a', 'b']]);
  });

  it('membuang baris yang seluruh selnya kosong', () => {
    expect(uraiCsv('a,b\n\n,\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('mempertahankan sel kosong di tengah baris', () => {
    expect(uraiCsv('a,,c')).toEqual([['a', '', 'c']]);
  });

  it('menangani isi kosong', () => {
    expect(uraiCsv('')).toEqual([]);
    expect(uraiCsv('   ')).toEqual([]);
  });
});

describe('urlEksporCsv', () => {
  const ID = '1pZo71Xc4gcpfmsbyP38hycP7ftUHIT3E0J7bGjjL3UM';

  it('menerima ID mentah', () => {
    expect(urlEksporCsv(ID)).toBe(
      `https://docs.google.com/spreadsheets/d/${ID}/gviz/tq?tqx=out:csv`
    );
  });

  it('mengambil ID dan gid dari tautan lengkap', () => {
    expect(urlEksporCsv(`https://docs.google.com/spreadsheets/d/${ID}/edit?gid=2123794245#gid=2123794245`))
      .toBe(`https://docs.google.com/spreadsheets/d/${ID}/gviz/tq?tqx=out:csv&gid=2123794245`);
  });

  it('gid yang disebut mengalahkan gid dari tautan', () => {
    expect(urlEksporCsv(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=111`, '999'))
      .toContain('gid=999');
  });

  it('menolak tautan yang tidak dikenali dengan pesan yang bisa ditindaklanjuti', () => {
    expect(() => urlEksporCsv('https://contoh.com/bukan-spreadsheet')).toThrow(/address bar/);
    expect(() => urlEksporCsv('')).toThrow(/kosong/);
  });
});
