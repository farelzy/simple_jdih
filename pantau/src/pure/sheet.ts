/**
 * pure/sheet.ts - mengubah isi spreadsheet jadi data siap tampil.
 *
 * Inilah pengganti seluruh lapisan basis data pada versi VPS. Sumber
 * kebenarannya sekarang spreadsheet yang diisi Google Form dan disunting
 * Bagian Hukum langsung; berkas ini yang membacanya jadi bentuk yang sama
 * dengan yang dulu dikirim API, supaya halaman React-nya tidak perlu diubah.
 *
 * Fungsi murni tanpa I/O: seluruh pengambilan data ada di api/data.ts. Dengan
 * begitu bentuk keluarannya bisa diuji tanpa menyentuh jaringan sama sekali.
 *
 * Nomor WhatsApp dan email pemohon SENGAJA tidak pernah ikut keluar dari sini.
 * Menyaringnya di tempat data disusun, bukan di halaman yang menampilkannya,
 * membuat kebocoran tidak mungkin terjadi karena lupa menyaring di satu
 * halaman baru.
 */

import { cocokkanHeader } from './skema.js';
import { uraiKolomProses } from './parser-riwayat.js';
import { rekapPerStatus } from './rekap.js';

/** Kolom berkas beserta nama yang ditampilkan ke pembaca. */
const KOLOM_BERKAS: readonly { kunci: string; nama: string }[] = [
  { kunci: 'surat_permohonan', nama: 'Surat Permohonan' },
  { kunci: 'keterangan_na',    nama: 'Keterangan / Naskah Akademik' },
  { kunci: 'rancangan',        nama: 'Rancangan Perda/Perbup' },
  { kunci: 'lampiran',         nama: 'Lampiran' },
  { kunci: 'paraf',            nama: 'Paraf Koordinasi' },
  { kunci: 'dasar_hukum',      nama: 'Dasar Hukum' },
  { kunci: 'sk_tim',           nama: 'SK Tim Penyusunan' },
  { kunci: 'ba_pansus',        nama: 'Berita Acara PANSUS' },
  { kunci: 'hasil_konsultasi', nama: 'Hasil Konsultasi' }
];

export interface BerkasPantau {
  kolom: string;
  nama: string;
  url: string;
}

export interface KejadianPantau {
  tanggal: string;
  keterangan: string;
}

export interface PengajuanPantau {
  nomor: string;
  judul: string;
  opd: string;
  jenis_peraturan: string;
  status: string;
  keterangan: string;
  masuk: string;
  diperbarui: string;
  nama_pemohon: string;
  terakhir: KejadianPantau | null;
  riwayat: KejadianPantau[];
  berkas: BerkasPantau[];
}

export interface DataPantau {
  hitungan: { TOTAL: number; PROSES: number; SELESAI: number; DIKEMBALIKAN: number };
  tahun: string[];
  daftar: PengajuanPantau[];
}

/**
 * '31/08/2026 16:05:18' atau '2026-08-31 ...' -> '2026-08-31'.
 * Google Form menulis bentuk pertama; ekspor Excel kadang bentuk kedua.
 */
export function tanggalDariTimestamp(teks: unknown): string {
  const isi = String(teks ?? '').trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(isi);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const lokal = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(isi);
  if (lokal) {
    return `${lokal[3]}-${String(lokal[2]).padStart(2, '0')}-${String(lokal[1]).padStart(2, '0')}`;
  }
  return '';
}

/**
 * Pecah satu sel berkas jadi beberapa tautan.
 *
 * Google Form memisahkan unggahan berganda dengan koma-spasi, sementara
 * tempelan manual biasanya memakai baris baru. Keduanya diterima; yang dipakai
 * sebagai pemisah hanya yang berada di luar sebuah URL, jadi tautan Drive yang
 * memuat koma di dalam parameternya tidak ikut terbelah.
 */
export function pecahTautan(sel: unknown): string[] {
  return String(sel ?? '')
    .split(/[\n\r]+|,\s+(?=https?:\/\/)/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
}

/** Status yang dikenali; selain itu dianggap PROSES supaya tidak hilang dari daftar. */
function bakukanStatus(nilai: unknown): string {
  const s = String(nilai ?? '').trim().toUpperCase();
  return s === 'SELESAI' || s === 'DIKEMBALIKAN' ? s : 'PROSES';
}

/**
 * Nomor pengajuan.
 *
 * Kolom ID dipakai kalau terisi. Yang kosong diberi nomor turunan dari tahun
 * dan urutan barisnya -- bukan dibiarkan kosong, karena nomor itulah yang jadi
 * alamat halaman detail dan kunci pencarian. Diberi akhiran `-B` (baris) supaya
 * jelas bahwa ia dibangkitkan, bukan nomor resmi yang pernah diberikan.
 */
function nomorBaris(id: unknown, masuk: string, urut: number): string {
  const asli = String(id ?? '').trim();
  if (asli) return asli;
  const tahun = masuk.slice(0, 4) || String(new Date().getFullYear());
  return `BRB-${tahun}-B${String(urut).padStart(4, '0')}`;
}

/**
 * Susun seluruh data tampilan dari baris spreadsheet.
 *
 * @param baris hasil uraiCsv, baris pertama berisi judul kolom
 */
export function susunDariBaris(baris: readonly (readonly string[])[]): DataPantau {
  if (!baris.length) return { hitungan: rekapPerStatus([]), tahun: [], daftar: [] };

  const { peta } = cocokkanHeader(baris[0] as string[]);
  const sel = (r: readonly string[], kunci: string): string => {
    const i = peta[kunci];
    return i === undefined ? '' : String(r[i] ?? '').trim();
  };

  const daftar: PengajuanPantau[] = [];

  baris.slice(1).forEach((r, i) => {
    const judul = sel(r, 'judul');
    const stempel = sel(r, 'timestamp');
    // Baris yang tidak punya judul maupun stempel waktu adalah sisa baris
    // kosong di bawah data -- Sheets sering menyertakannya di ekspor CSV.
    if (!judul && !stempel) return;

    const masuk = tanggalDariTimestamp(stempel);
    const status = bakukanStatus(sel(r, 'status'));
    const tahun = Number(masuk.slice(0, 4)) || new Date().getFullYear();

    // Yang diambil hanya tanggal dan kalimatnya. Penebakan tahap dari kata-kata
    // sengaja tidak dipakai: statusnya sudah diisi manual di kolom Status, dan
    // dua penanda yang bisa berbeda pendapat lebih membingungkan daripada satu.
    const riwayat: KejadianPantau[] = uraiKolomProses(sel(r, 'proses'), tahun)
      .map((k) => ({ tanggal: k.tanggal, keterangan: k.keterangan }));

    const berkas: BerkasPantau[] = [];
    for (const kol of KOLOM_BERKAS) {
      const tautan = pecahTautan(sel(r, kol.kunci));
      tautan.forEach((url, n) => {
        berkas.push({
          kolom: kol.kunci,
          nama: tautan.length > 1 ? `${kol.nama} (${n + 1})` : kol.nama,
          url
        });
      });
    }

    const diperbaruiSel = tanggalDariTimestamp(sel(r, 'diperbarui_pada'));
    const tanggalRiwayat = riwayat.map((k) => k.tanggal).filter(Boolean).sort();

    daftar.push({
      nomor: nomorBaris(sel(r, 'id'), masuk, i + 1),
      judul,
      opd: sel(r, 'opd'),
      jenis_peraturan: sel(r, 'jenis_peraturan') || 'Bupati',
      status,
      keterangan: sel(r, 'keterangan'),
      masuk,
      // Kalau kolom "Diperbarui Pada" kosong -- dan di data nyata sebagian
      // besar memang kosong -- kejadian terakhir di lini masa jadi penggantinya.
      diperbarui: diperbaruiSel || tanggalRiwayat[tanggalRiwayat.length - 1] || masuk,
      nama_pemohon: sel(r, 'nama_pemohon'),
      terakhir: riwayat.length ? riwayat[riwayat.length - 1]! : null,
      riwayat,
      berkas
    });
  });

  // Terbaru di atas, sama seperti halaman monitoring versi VPS.
  daftar.sort((a, b) => (a.masuk < b.masuk ? 1 : a.masuk > b.masuk ? -1 : 0));

  const tahun = [...new Set(daftar.map((d) => d.masuk.slice(0, 4)).filter(Boolean))]
    .sort().reverse();

  return { hitungan: rekapPerStatus(daftar), tahun, daftar };
}
