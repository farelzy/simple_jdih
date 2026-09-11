/**
 * tahap.ts - posisi sebuah pengajuan di rel enam stasiun. Fungsi murni.
 *
 * Rel ini yang digambar di kaki tiap kartu monitoring, supaya pertanyaan
 * "sudah sampai mana" terjawab tanpa membuka halaman detail.
 *
 * Relnya sengaja lurus enam stasiun, padahal harmonisasi (Kanwil Kemenkum) dan
 * fasilitasi (Biro Hukum Provinsi) sebenarnya dua jalur yang sering berjalan
 * bersamaan. Penyederhanaan ini keputusan sadar demi kartu yang terbaca sekali
 * lihat; yang menjaga tampilan tetap jujur adalah label di bawah rel, yang
 * menyebut kejadian terakhir apa adanya, bukan nama stasiun.
 */

export interface Stasiun {
  kunci: string;
  label: string;
}

export const STASIUN: readonly Stasiun[] = [
  { kunci: 'BERKAS_MASUK',        label: 'Masuk' },
  { kunci: 'REVIU_HUKUM',         label: 'Reviu' },
  { kunci: 'PRA_HARMONISASI',     label: 'Pra Harmonisasi' },
  { kunci: 'FASILITASI',          label: 'Fasilitasi' },
  { kunci: 'RAPAT_HARMONISASI',   label: 'Rapat' },
  { kunci: 'SELESAI_HARMONISASI', label: 'Selesai' }
];

export const JUMLAH_STASIUN = STASIUN.length;

/**
 * Tahap yang bukan stasiun sendiri, tapi menandakan sebuah stasiun sudah
 * terlewati. PENETAPAN ada di sini karena berkas yang sudah ditetapkan pasti
 * sudah melewati harmonisasi; tanpa padanan ini relnya justru terlihat belum
 * tuntas pada berkas yang paling tuntas.
 */
const PADANAN: Readonly<Record<string, number>> = {
  HASIL_FASILITASI: 4,
  PENETAPAN: 6
};

/** @returns nomor stasiun 1..6, atau null bila tahap ini tidak ada di rel */
export function stasiunTahap(tahap: unknown): number | null {
  if (typeof tahap !== 'string') return null;
  const kunci = tahap.trim().toUpperCase();
  if (!kunci) return null;

  const urut = STASIUN.findIndex((s) => s.kunci === kunci);
  if (urut >= 0) return urut + 1;

  return PADANAN[kunci] ?? null;
}

/**
 * Stasiun terjauh yang pernah dicapai, bukan tahap yang terakhir dicatat.
 *
 * Bedanya menentukan: LAINNYA adalah tahap terbanyak di data sungguhan, dan
 * ia tidak ada di rel. Kalau posisi diambil dari catatan terakhir, hampir
 * semua kartu jatuh ke rel kosong padahal berkasnya jelas sudah berjalan.
 *
 * @returns 0 bila belum ada satu pun riwayat yang menyentuh rel
 */
export function stasiunTercapai(daftarTahap: readonly unknown[]): number {
  let tertinggi = 0;
  for (const tahap of daftarTahap ?? []) {
    const urut = stasiunTahap(tahap);
    if (urut !== null && urut > tertinggi) tertinggi = urut;
  }
  return tertinggi;
}

/**
 * Posisi rel setelah status pengajuan diperhitungkan.
 *
 * Status pengajuan lebih berwenang daripada penandaan riwayat: ia disetel sadar
 * oleh Bagian Hukum saat berkas dinyatakan selesai, sementara tahap riwayat
 * sering tertinggal. Di data sungguhan, 6 dari 14 pengajuan SELESAI berhenti di
 * stasiun 5 karena tidak ada baris bertanda SELESAI_HARMONISASI. Tanpa aturan
 * ini, satu kartu memasang lencana SELESAI sambil menulis "Tahap 5 dari 6".
 *
 * DIKEMBALIKAN sengaja tidak diperlakukan khusus: berkas bisa dikembalikan dari
 * stasiun mana pun, dan memundurkan relnya justru menghapus jejak sudah sejauh
 * apa ia sempat berjalan.
 */
export function relDenganStatus(status: unknown, tercapai: number): number {
  const bersih = Math.min(Math.max(0, Math.floor(tercapai || 0)), JUMLAH_STASIUN);
  if (String(status ?? '').trim().toUpperCase() === 'SELESAI') return JUMLAH_STASIUN;
  return bersih;
}

/**
 * Pemetaan tahap ke stasiun untuk dikirim ke dashboard.
 *
 * Formulir riwayat perlu memisahkan tahap yang menggerakkan rel dari yang
 * tidak, supaya Bagian Hukum berhenti memilih LAINNYA sambil mengira relnya
 * ikut maju -- itulah sebab 7 dari 37 kartu relnya kosong padahal berkasnya
 * jelas sudah berjalan. Petanya dihitung di sini, bukan ditulis ulang di
 * peramban, karena aturan tahap hanya boleh hidup di satu berkas.
 *
 * @returns tahap -> nomor stasiun, atau null bila tahap itu di luar rel
 */
export function petaStasiun(daftarTahap: readonly string[]): Record<string, number | null> {
  const peta: Record<string, number | null> = {};
  for (const tahap of daftarTahap ?? []) peta[tahap] = stasiunTahap(tahap);
  return peta;
}
