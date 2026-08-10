import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool, kueri, siapkanSkema } from '../db.js';
import {
  pengajuanBuat, pengajuanSemua, pengajuanCariNomor, pengajuanUbahStatus
} from '../repo/pengajuan.js';
import { riwayatTambah, riwayatUntuk, riwayatTerakhirPerPengajuan } from '../repo/riwayat.js';
import { berkasTambah, berkasUntuk } from '../repo/berkas.js';
import { opdTambah, opdSemua, opdCocokkan } from '../repo/opd.js';
import { pengaturanSemua, pengaturanSetel, pengaturanBenar } from '../repo/pengaturan.js';

const CONTOH = {
  opd_id: null,
  opd_teks: 'BPKAD',
  jenis_peraturan: 'Bupati' as const,
  judul: 'Uji Pengajuan',
  nama_pemohon: 'Uji',
  wa_pemohon: '082299989690',
  email_pemohon: 'uji@uji.local'
};

beforeAll(async () => { await siapkanSkema(); });
beforeEach(async () => { await kueri(`DELETE FROM pengajuan`); });
afterAll(async () => {
  await kueri(`DELETE FROM pengajuan`);
  await kueri(`DELETE FROM opd WHERE kode LIKE 'UJI%'`);
  await pool.end();
});

describe('penomoran pengajuan', () => {
  it('nomor pertama tahun ini berakhiran 0001', async () => {
    const { nomor } = await pengajuanBuat(CONTOH);
    expect(nomor).toMatch(/^BRB-\d{4}-0001$/);
  });

  it('nomor berikutnya berurut', async () => {
    await pengajuanBuat(CONTOH);
    const { nomor } = await pengajuanBuat(CONTOH);
    expect(nomor).toMatch(/^BRB-\d{4}-0002$/);
  });

  /**
   * Uji paling berarti di berkas ini.
   *
   * Di versi Apps Script, dua pengiriman pada detik yang sama bisa membaca
   * nomor terakhir yang sama, mendapat nomor kembar, dan salah satunya menimpa
   * baris yang lain -- kehilangan berkas pengajuan.
   *
   * Uji ini sudah menangkap dua cacat nyata saat ditulis: deadlock InnoDB
   * karena gap lock dari SELECT ... FOR UPDATE, lalu nomor kembar karena kunci
   * sempat dilepas sebelum commit sehingga transaksi berikutnya membaca nomor
   * terakhir yang belum kelihatan.
   */
  // Batas waktu dinaikkan bukan karena kodenya lambat: uji ini berjalan lewat
  // terowongan SSH ke MariaDB di VPS, dan 20 penyisipan berurutan berarti
  // sekitar 120 perjalanan bolak-balik jaringan.
  it('20 pengiriman berbarengan menghasilkan 20 nomor berbeda dan berurut', { timeout: 90_000 }, async () => {
    const hasil = await Promise.all(
      Array.from({ length: 20 }, () => pengajuanBuat(CONTOH))
    );
    const nomor = hasil.map((h) => h.nomor);
    expect(new Set(nomor).size).toBe(20);

    const urut = [...nomor].sort();
    expect(urut[0]).toMatch(/0001$/);
    expect(urut[19]).toMatch(/0020$/);
    expect(await pengajuanSemua()).toHaveLength(20);
  });
});

describe('status dan riwayat', () => {
  it('DIKEMBALIKAN tanpa alasan ditolak', async () => {
    const { nomor } = await pengajuanBuat(CONTOH);
    await expect(pengajuanUbahStatus(nomor, 'DIKEMBALIKAN', '', 'a@uji.local'))
      .rejects.toThrow(/alasan/i);
  });

  it('DIKEMBALIKAN dengan alasan tersimpan ke keterangan', async () => {
    const { nomor } = await pengajuanBuat(CONTOH);
    await pengajuanUbahStatus(nomor, 'DIKEMBALIKAN', 'Belum ada hasil konsultasi', 'a@uji.local');
    const p = await pengajuanCariNomor(nomor);
    expect(p!.status).toBe('DIKEMBALIKAN');
    expect(p!.keterangan).toBe('Belum ada hasil konsultasi');
  });

  it('status di luar daftar baku ditolak', async () => {
    const { nomor } = await pengajuanBuat(CONTOH);
    await expect(pengajuanUbahStatus(nomor, 'ENTAH' as never, '', 'a@uji.local')).rejects.toThrow();
  });

  it('mengubah status memperbarui jejak siapa dan kapan', async () => {
    const { nomor } = await pengajuanBuat(CONTOH);
    await pengajuanUbahStatus(nomor, 'SELESAI', '', 'admin@uji.local');
    const p = await pengajuanCariNomor(nomor);
    expect(p!.status).toBe('SELESAI');
    expect(p!.diperbarui_oleh).toBe('admin@uji.local');
  });

  it('riwayat terurut menurut tanggal lalu urutan tulis', async () => {
    const { id } = await pengajuanBuat(CONTOH);
    await riwayatTambah(id, { tanggal: '2026-07-23', tahap: 'REVIU_HUKUM', keterangan: 'B' }, 'a@uji.local');
    await riwayatTambah(id, { tanggal: '2026-07-22', tahap: 'BERKAS_MASUK', keterangan: 'A' }, 'a@uji.local');
    const r = await riwayatUntuk(id);
    expect(r.map((x) => x.keterangan)).toEqual(['A', 'B']);
  });

  it('tahap di luar daftar baku ditolak', async () => {
    const { id } = await pengajuanBuat(CONTOH);
    await expect(riwayatTambah(id, { tanggal: '2026-07-22', tahap: 'NGAWUR', keterangan: '' }, 'a@uji.local'))
      .rejects.toThrow(/tahap/i);
  });

  it('tanggal riwayat harus berbentuk YYYY-MM-DD', async () => {
    const { id } = await pengajuanBuat(CONTOH);
    await expect(riwayatTambah(id, { tanggal: '22 Juli 2026', tahap: 'BERKAS_MASUK', keterangan: '' }, 'a@uji.local'))
      .rejects.toThrow();
  });

  it('riwayatTerakhirPerPengajuan mengambil kejadian paling akhir', async () => {
    const { id } = await pengajuanBuat(CONTOH);
    await riwayatTambah(id, { tanggal: '2026-07-22', tahap: 'BERKAS_MASUK', keterangan: 'awal' }, 'a@uji.local');
    await riwayatTambah(id, { tanggal: '2026-07-25', tahap: 'FASILITASI', keterangan: 'akhir' }, 'a@uji.local');
    const peta = await riwayatTerakhirPerPengajuan();
    expect(peta.get(id)?.keterangan).toBe('akhir');
  });
});

describe('berkas', () => {
  it('menyimpan dan membaca kembali berkas satu pengajuan', async () => {
    const { id } = await pengajuanBuat(CONTOH);
    await berkasTambah(id, {
      kolom: 'surat_permohonan', nama: 'surat.pdf', ukuran: 2048,
      mime: 'application/pdf', sumber: 'lokal', jalur: 'surat-abc.pdf'
    });
    const daftar = await berkasUntuk(id);
    expect(daftar).toHaveLength(1);
    expect(daftar[0]!.nama).toBe('surat.pdf');
    expect(daftar[0]!.ukuran).toBe(2048);
  });
});

describe('opd', () => {
  it('menambah dan mencocokkan OPD lewat kode maupun awalan nama', async () => {
    await kueri(`DELETE FROM opd WHERE kode = 'UJIBPKAD'`);
    await opdTambah('UJIBPKAD', 'Badan Pengelolaan Keuangan dan Aset Daerah', 'BPKAD');
    const semua = await opdSemua();
    expect(semua.some((o) => o.kode === 'UJIBPKAD')).toBe(true);

    // Lima ejaan BPKAD di data nyata harus mengarah ke satu OPD yang sama.
    expect(await opdCocokkan('UJIBPKAD')).not.toBeNull();
    expect(await opdCocokkan('Badan Pengelolaan Keuangan dan Aset Daerah')).not.toBeNull();
    expect(await opdCocokkan('OPD YANG TIDAK ADA')).toBeNull();
  });
});

describe('pengaturan', () => {
  it('membaca seluruh pengaturan sebagai peta', async () => {
    const p = await pengaturanSemua();
    expect(p.batas_lampiran).toBe('30');
  });

  it('menulis lalu membaca kembali nilai yang berubah', async () => {
    await pengaturanSetel('pengumuman', 'Uji pengumuman');
    expect((await pengaturanSemua()).pengumuman).toBe('Uji pengumuman');
    await pengaturanSetel('pengumuman', '');
  });

  it('pengaturanBenar mengenali berbagai penulisan nilai benar', async () => {
    expect(pengaturanBenar({ x: 'TRUE' }, 'x')).toBe(true);
    expect(pengaturanBenar({ x: 'true' }, 'x')).toBe(true);
    expect(pengaturanBenar({ x: 'FALSE' }, 'x')).toBe(false);
    expect(pengaturanBenar({}, 'x')).toBe(false);
  });
});
