/**
 * lib/data.ts - satu tarikan data untuk seluruh situs.
 *
 * Monitoring dan Detail membaca kumpulan yang sama. Menyimpan janjinya di
 * tingkat modul membuat perpindahan halaman terasa seketika dan tidak menarik
 * ulang ke Vercel -- yang pada gilirannya tidak menarik ulang ke Google.
 */
import type { DataPantau } from '../pure/sheet';

export type { DataPantau, PengajuanPantau, BerkasPantau, KejadianPantau } from '../pure/sheet';

export interface DataSitus extends DataPantau {
  /** Kapan Vercel terakhir menarik dari spreadsheet. */
  ditarik: string;
}

let tersimpan: Promise<DataSitus> | null = null;

export function muatData(): Promise<DataSitus> {
  tersimpan ??= ambil();
  return tersimpan;
}

/** Buang simpanan lalu tarik lagi; dipakai tombol segarkan. */
export function segarkan(): Promise<DataSitus> {
  tersimpan = ambil();
  return tersimpan;
}

async function ambil(): Promise<DataSitus> {
  const jawab = await fetch('/api/data', { headers: { accept: 'application/json' } });
  const isi = (await jawab.json().catch(() => ({}))) as Partial<DataSitus> & { galat?: string };

  if (!jawab.ok) {
    // Simpanan dikosongkan supaya percobaan berikutnya benar-benar menarik
    // ulang, bukan mengembalikan janji yang sudah gagal.
    tersimpan = null;
    throw new Error(isi.galat ?? `Gagal memuat data (HTTP ${jawab.status}).`);
  }
  return isi as DataSitus;
}
