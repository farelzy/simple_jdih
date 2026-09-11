/**
 * lib/data.ts - satu simpanan data untuk seluruh situs, plus penyegaran berkala.
 *
 * Spreadsheet tidak bisa mendorong pemberitahuan ke situs, jadi "realtime" di
 * sini berarti menarik berkala dengan tahu diri:
 *
 *   - hanya saat tab terlihat. Tab yang tertinggal terbuka semalaman tidak
 *     menghabiskan kuota Vercel maupun menarik Google 900 kali
 *   - langsung menarik saat pengunjung kembali ke tab, kalau simpanannya sudah
 *     lewat tenggang. Inilah yang membuat perpindahan tab terasa seketika
 *   - satu tarikan dipakai bersama semua halaman; berpindah ke detail tidak
 *     menyentuh jaringan sama sekali
 *
 * Data lama TIDAK dibuang saat penyegaran gagal. Kegagalan sesaat di pihak
 * Google seharusnya tidak mengosongkan halaman yang sudah terisi benar.
 */
import { useEffect, useState } from 'react';
import type { DataPantau } from '../pure/sheet';

export type { DataPantau, PengajuanPantau, BerkasPantau, KejadianPantau } from '../pure/sheet';

export interface DataSitus extends DataPantau {
  /** Kapan Vercel terakhir menarik dari spreadsheet. */
  ditarik: string;
}

export interface Keadaan {
  data: DataSitus | null;
  galat: string;
  /** Penyegaran sedang berjalan sementara data lama masih ditampilkan. */
  menyegarkan: boolean;
}

/** Jarak antar tarikan saat tab terlihat. */
const JEDA_MS = 45_000;

let keadaan: Keadaan = { data: null, galat: '', menyegarkan: false };
let terakhirDitarik = 0;
let sedangJalan: Promise<void> | null = null;
const pendengar = new Set<(k: Keadaan) => void>();

function siarkan(ubah: Partial<Keadaan>): void {
  keadaan = { ...keadaan, ...ubah };
  for (const f of pendengar) f(keadaan);
}

async function tarik(): Promise<void> {
  // Dua halaman yang dipasang berbarengan tidak boleh jadi dua tarikan.
  if (sedangJalan) return sedangJalan;

  siarkan({ menyegarkan: true });
  sedangJalan = (async () => {
    try {
      const jawab = await fetch('/api/data', { headers: { accept: 'application/json' } });
      const isi = (await jawab.json().catch(() => ({}))) as Partial<DataSitus> & { galat?: string };

      if (!jawab.ok) throw new Error(isi.galat ?? `Gagal memuat data (HTTP ${jawab.status}).`);

      terakhirDitarik = Date.now();
      siarkan({ data: isi as DataSitus, galat: '', menyegarkan: false });
    } catch (e) {
      // Data lama dipertahankan; galatnya hanya ditandai.
      siarkan({ galat: (e as Error).message, menyegarkan: false });
    } finally {
      sedangJalan = null;
    }
  })();

  return sedangJalan;
}

export function segarkanSekarang(): void {
  void tarik();
}

/** Sudah lewat tenggang sejak tarikan terakhir yang berhasil? */
function sudahBasi(): boolean {
  return Date.now() - terakhirDitarik >= JEDA_MS;
}

let pemakai = 0;
let jam: ReturnType<typeof setInterval> | null = null;

function saatTerlihat(): void {
  if (document.visibilityState === 'visible' && sudahBasi()) void tarik();
}

function mulaiJam(): void {
  if (jam !== null) return;
  jam = setInterval(() => {
    // Tab tersembunyi dilewati; pemeriksaan saat kembali terlihat yang
    // mengejar ketinggalannya.
    if (document.visibilityState === 'visible') void tarik();
  }, JEDA_MS);
  document.addEventListener('visibilitychange', saatTerlihat);
}

function hentikanJam(): void {
  if (jam !== null) { clearInterval(jam); jam = null; }
  document.removeEventListener('visibilitychange', saatTerlihat);
}

/**
 * Data situs, ikut tersegarkan sendiri selama ada halaman yang memakainya.
 */
export function usePantau(): Keadaan {
  const [lokal, setLokal] = useState<Keadaan>(keadaan);

  useEffect(() => {
    pendengar.add(setLokal);
    pemakai++;
    mulaiJam();

    if (!keadaan.data && !sedangJalan) void tarik();
    else if (sudahBasi()) void tarik();

    return () => {
      pendengar.delete(setLokal);
      pemakai--;
      // Jam dimatikan saat tidak ada lagi halaman yang memakainya, supaya ia
      // tidak menarik untuk halaman yang sudah tidak ada.
      if (pemakai === 0) hentikanJam();
    };
  }, []);

  return lokal;
}
