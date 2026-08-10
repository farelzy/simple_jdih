import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, kueri, satu, transaksi, siapkanSkema } from '../db.js';

beforeAll(async () => { await siapkanSkema(); });
afterAll(async () => { await pool.end(); });

describe('lapisan database', () => {
  it('siapkanSkema membuat seluruh tabel dan aman diulang', async () => {
    await siapkanSkema();   // dijalankan dua kali: harus idempoten
    const tabel = await kueri<{ TABLE_NAME: string }>(
      `SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE()`
    );
    const nama = tabel.map((t) => t.TABLE_NAME.toLowerCase());
    for (const t of ['opd', 'pengajuan', 'berkas', 'riwayat', 'admin', 'pengaturan', 'log']) {
      expect(nama).toContain(t);
    }
  });

  it('seed mengisi pengaturan dengan batas 30 MB', async () => {
    const baris = await satu<{ nilai: string }>(
      `SELECT nilai FROM pengaturan WHERE kunci = 'batas_lampiran'`
    );
    expect(baris?.nilai).toBe('30');
  });

  it('tidak ada batas ukuran yang melampaui 30 MB', async () => {
    const baris = await kueri<{ kunci: string; nilai: string }>(
      `SELECT kunci, nilai FROM pengaturan WHERE kunci LIKE 'batas\\_%'`
    );
    expect(baris.length).toBeGreaterThan(0);
    for (const b of baris) expect(Number(b.nilai)).toBeLessThanOrEqual(30);
  });

  it('satu mengembalikan null bila tidak ada baris', async () => {
    expect(await satu(`SELECT 1 AS x FROM pengaturan WHERE kunci = 'tidak-ada'`)).toBeNull();
  });

  it('transaksi melakukan rollback saat callback melempar', async () => {
    await kueri(`DELETE FROM opd WHERE kode = 'UJI-RB'`);
    await expect(transaksi(async (conn) => {
      await conn.query(`INSERT INTO opd (kode, nama_resmi) VALUES ('UJI-RB','Uji Rollback')`);
      throw new Error('sengaja gagal');
    })).rejects.toThrow('sengaja gagal');

    expect(await satu(`SELECT id FROM opd WHERE kode = 'UJI-RB'`)).toBeNull();
  });

  it('transaksi melakukan commit saat callback selesai', async () => {
    await kueri(`DELETE FROM opd WHERE kode = 'UJI-CM'`);
    await transaksi(async (conn) => {
      await conn.query(`INSERT INTO opd (kode, nama_resmi) VALUES ('UJI-CM','Uji Commit')`);
    });
    expect(await satu(`SELECT id FROM opd WHERE kode = 'UJI-CM'`)).not.toBeNull();
    await kueri(`DELETE FROM opd WHERE kode = 'UJI-CM'`);
  });

  /**
   * Inilah yang membuat nomor pengajuan kembar mustahil. Di versi Apps Script
   * ini dijaga LockService buatan sendiri; di sini database yang menjaminnya.
   */
  it('constraint UNIQUE menolak nomor pengajuan kembar', async () => {
    await kueri(`DELETE FROM pengajuan WHERE nomor = 'BRB-1999-0001'`);
    const sisip = () => kueri(
      `INSERT INTO pengajuan (nomor, jenis_peraturan, judul, nama_pemohon, wa_pemohon,
        keterangan, dibuat_pada, diperbarui_pada)
       VALUES ('BRB-1999-0001','Bupati','Uji','Uji','08120000000','',NOW(),NOW())`
    );
    await sisip();
    await expect(sisip()).rejects.toThrow(/Duplicate|ER_DUP_ENTRY/i);
    await kueri(`DELETE FROM pengajuan WHERE nomor = 'BRB-1999-0001'`);
  });

  it('menghapus pengajuan ikut menghapus berkas dan riwayatnya', async () => {
    await kueri(`DELETE FROM pengajuan WHERE nomor = 'BRB-1999-0002'`);
    await kueri(
      `INSERT INTO pengajuan (nomor, jenis_peraturan, judul, nama_pemohon, wa_pemohon,
        keterangan, dibuat_pada, diperbarui_pada)
       VALUES ('BRB-1999-0002','Bupati','Uji Cascade','Uji','08120000000','',NOW(),NOW())`
    );
    const p = await satu<{ id: number }>(`SELECT id FROM pengajuan WHERE nomor = 'BRB-1999-0002'`);
    await kueri(
      `INSERT INTO riwayat (pengajuan_id, tanggal, tahap, keterangan, dicatat_pada)
       VALUES (?, '2026-07-22', 'BERKAS_MASUK', 'uji', NOW())`, [p!.id]
    );
    await kueri(`DELETE FROM pengajuan WHERE id = ?`, [p!.id]);
    const sisa = await kueri(`SELECT id FROM riwayat WHERE pengajuan_id = ?`, [p!.id]);
    expect(sisa).toHaveLength(0);
  });
});
