/**
 * rekap.ts - hitungan, rata-rata lama proses, dan penulisan CSV. Fungsi murni.
 *
 * Semua fungsi menerima array objek pengajuan yang sudah dinormalkan oleh
 * lapisan repo. Tidak ada yang menyentuh database dari sini.
 */

const SATU_HARI_MS = 24 * 60 * 60 * 1000;

export interface HitunganStatus {
  TOTAL: number;
  PROSES: number;
  SELESAI: number;
  DIKEMBALIKAN: number;
}

function statusBaku(nilai: unknown): string {
  return String(nilai ?? '').trim().toUpperCase();
}

export function rekapPerStatus(daftar: readonly { status?: string }[]): HitunganStatus {
  const hasil: HitunganStatus = { TOTAL: 0, PROSES: 0, SELESAI: 0, DIKEMBALIKAN: 0 };
  for (const baris of daftar ?? []) {
    hasil.TOTAL++;
    const s = statusBaku(baris?.status);
    if (s === 'PROSES' || s === 'SELESAI' || s === 'DIKEMBALIKAN') hasil[s]++;
  }
  return hasil;
}

/** @returns terbanyak dulu, lalu abjad */
export function rekapPerOpd(daftar: readonly { opd?: string }[]): { opd: string; jumlah: number }[] {
  const hitung = new Map<string, number>();
  for (const baris of daftar ?? []) {
    const opd = String(baris?.opd ?? '').trim() || '(tidak diisi)';
    hitung.set(opd, (hitung.get(opd) ?? 0) + 1);
  }
  return [...hitung.entries()]
    .map(([opd, jumlah]) => ({ opd, jumlah }))
    .sort((a, b) => (b.jumlah !== a.jumlah ? b.jumlah - a.jumlah : a.opd.localeCompare(b.opd, 'en')));
}

/** @returns bulan 'YYYY-MM', urut menaik */
export function rekapPerBulan(daftar: readonly { masuk?: string }[]): { bulan: string; jumlah: number }[] {
  const hitung = new Map<string, number>();
  for (const baris of daftar ?? []) {
    const cocok = /^(\d{4})-(\d{2})/.exec(String(baris?.masuk ?? ''));
    if (!cocok) continue;
    const bulan = `${cocok[1]}-${cocok[2]}`;
    hitung.set(bulan, (hitung.get(bulan) ?? 0) + 1);
  }
  return [...hitung.keys()].sort().map((bulan) => ({ bulan, jumlah: hitung.get(bulan) as number }));
}

/** @returns milidetik UTC tengah malam, null bila bukan ISO */
function uraiIso(iso: unknown): number | null {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? '').trim());
  if (!cocok) return null;
  return Date.UTC(
    parseInt(cocok[1] as string, 10),
    parseInt(cocok[2] as string, 10) - 1,
    parseInt(cocok[3] as string, 10)
  );
}

export function selisihHari(isoAwal: unknown, isoAkhir: unknown): number | null {
  const a = uraiIso(isoAwal);
  const b = uraiIso(isoAkhir);
  if (a === null || b === null) return null;
  return Math.round((b - a) / SATU_HARI_MS);
}

/**
 * Rata-rata lama proses, hanya dari pengajuan berstatus SELESAI.
 *
 * Memasukkan yang masih PROSES akan membuat angkanya turun terus seiring waktu
 * dan tidak berarti apa-apa.
 * @returns hari, satu angka di belakang koma; null bila belum ada yang selesai
 */
export function rataLamaProsesHari(
  daftar: readonly { status?: string; masuk?: string; diperbarui?: string }[]
): number | null {
  let jumlah = 0;
  let banyak = 0;
  for (const baris of daftar ?? []) {
    if (statusBaku(baris?.status) !== 'SELESAI') continue;
    const hari = selisihHari(baris.masuk, baris.diperbarui);
    if (hari === null) continue;
    jumlah += hari;
    banyak++;
  }
  if (!banyak) return null;
  return Math.round((jumlah / banyak) * 10) / 10;
}

/**
 * Pengajuan PROSES yang tidak bergerak melewati ambang hari.
 * Inilah yang paling sering terlewat dalam sistem manual.
 */
export function cariMandek(
  daftar: readonly { id: string; status?: string; diperbarui?: string }[],
  ambangHari: number,
  isoHariIni: string
): string[] {
  const ambang = Number(ambangHari) || 7;
  const hasil: string[] = [];
  for (const baris of daftar ?? []) {
    if (statusBaku(baris?.status) !== 'PROSES') continue;
    const diam = selisihHari(baris.diperbarui, isoHariIni);
    if (diam !== null && diam > ambang) hasil.push(baris.id);
  }
  return hasil;
}

/** Loloskan satu sel CSV sesuai RFC 4180. */
function selCsv(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return '';
  const teks = String(nilai);
  if (/[",\r\n]/.test(teks)) return '"' + teks.replace(/"/g, '""') + '"';
  return teks;
}

export function keCsv(
  daftar: readonly Record<string, unknown>[],
  kolom: readonly { kunci: string; judul: string }[]
): string {
  const baris = [kolom.map((k) => selCsv(k.judul)).join(',')];
  for (const isi of daftar ?? []) {
    baris.push(kolom.map((k) => selCsv(isi[k.kunci])).join(','));
  }
  return baris.join('\r\n');
}
