/**
 * services/ekspor.ts - menyusun berkas Excel berisi seluruh pengajuan.
 *
 * Dipakai dua arah: tombol unduh di dashboard, dan cadangan harian.
 *
 * Datanya diambil dengan tiga kueri, bukan satu kueri per pengajuan. Pada VPS
 * 1 GB yang menjalankan cadangan tiap hari, 3 kueri jauh lebih murah daripada
 * 1 + 2N -- dan bedanya makin terasa seiring pengajuan bertambah.
 */

import ExcelJS from 'exceljs';
import { kueri } from '../db.js';
import { JUDUL_EKSPOR, barisEkspor, type PengajuanEkspor, type BerkasEkspor }
  from '../pure/baris-ekspor.js';

interface BarisPengajuan {
  id: number; nomor: string; opd_teks: string; kode_opd: string | null;
  jenis_peraturan: string; judul: string; nama_pemohon: string; wa_pemohon: string;
  email_pemohon: string; status: string; keterangan: string;
  dibuat_pada: string; diperbarui_pada: string; diperbarui_oleh: string;
}

/** Semua pengajuan lengkap dengan riwayat dan berkasnya, siap jadi baris. */
export async function kumpulkanEkspor(): Promise<PengajuanEkspor[]> {
  const pengajuan = await kueri<BarisPengajuan>(
    `SELECT p.id, p.nomor, p.opd_teks, o.kode AS kode_opd, p.jenis_peraturan, p.judul,
            p.nama_pemohon, p.wa_pemohon, p.email_pemohon, p.status, p.keterangan,
            p.dibuat_pada, p.diperbarui_pada, p.diperbarui_oleh
       FROM pengajuan p
       LEFT JOIN opd o ON o.id = p.opd_id
      ORDER BY p.nomor ASC`
  );
  if (pengajuan.length === 0) return [];

  const riwayat = await kueri<{ pengajuan_id: number; tanggal: string; keterangan: string }>(
    `SELECT pengajuan_id, tanggal, keterangan FROM riwayat ORDER BY tanggal ASC, id ASC`
  );
  const berkas = await kueri<BerkasEkspor & { pengajuan_id: number }>(
    `SELECT id, pengajuan_id, kolom, sumber, jalur FROM berkas ORDER BY id ASC`
  );

  const riwayatPer = new Map<number, { tanggal: string; keterangan: string }[]>();
  for (const r of riwayat) {
    const daftar = riwayatPer.get(r.pengajuan_id) ?? [];
    daftar.push({ tanggal: String(r.tanggal ?? '').slice(0, 10), keterangan: r.keterangan });
    riwayatPer.set(r.pengajuan_id, daftar);
  }

  const berkasPer = new Map<number, BerkasEkspor[]>();
  for (const b of berkas) {
    const daftar = berkasPer.get(b.pengajuan_id) ?? [];
    daftar.push({ id: b.id, kolom: b.kolom, sumber: b.sumber, jalur: b.jalur });
    berkasPer.set(b.pengajuan_id, daftar);
  }

  return pengajuan.map((p) => ({
    ...p,
    kode_opd: p.kode_opd ?? '',
    dibuat_pada: String(p.dibuat_pada ?? ''),
    diperbarui_pada: String(p.diperbarui_pada ?? ''),
    riwayat: riwayatPer.get(p.id) ?? [],
    berkas: berkasPer.get(p.id) ?? []
  }));
}

/** Alamat situs, untuk menyusun URL berkas yang bisa diklik dari dalam Excel. */
export function asalSitus(): string {
  return (process.env.BASE_URL ?? '').replace(/\/+$/, '');
}

/**
 * @returns berkas .xlsx berisi seluruh pengajuan
 *
 * Ditulis ke buffer, bukan langsung ke aliran jawaban HTTP: ukurannya perlu
 * diketahui lebih dulu supaya cadangan harian bisa ditulis ke disk dan
 * diunduh dari rute yang sama tanpa dua jalur kode.
 */
export async function buatBukuKerja(): Promise<Buffer> {
  const data = await kumpulkanEkspor();
  const asal = asalSitus();

  const buku = new ExcelJS.Workbook();
  buku.creator = 'SIMPEL Hukum Brebes';
  buku.created = new Date();

  const lembar = buku.addWorksheet('Pengajuan', {
    views: [{ state: 'frozen', ySplit: 1 }]   // judul kolom ikut tergulir
  });

  lembar.addRow([...JUDUL_EKSPOR]);
  const kepala = lembar.getRow(1);
  kepala.font = { bold: true };
  kepala.alignment = { vertical: 'middle', wrapText: true };
  kepala.height = 32;

  for (const p of data) lembar.addRow(barisEkspor(p, asal));

  // Lebar kolom disetel dari isinya, dibatasi 60 supaya kolom judul yang
  // panjang tidak membuat lembar mustahil dibaca.
  lembar.columns.forEach((kolom, i) => {
    let lebar = String(JUDUL_EKSPOR[i] ?? '').length;
    kolom.eachCell?.({ includeEmpty: false }, (sel) => {
      for (const potong of String(sel.value ?? '').split('\n')) {
        lebar = Math.max(lebar, potong.length);
      }
    });
    kolom.width = Math.min(Math.max(lebar + 2, 12), 60);
    kolom.alignment = { vertical: 'top', wrapText: true };
  });

  lembar.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: JUDUL_EKSPOR.length }
  };

  return Buffer.from(await buku.xlsx.writeBuffer());
}
