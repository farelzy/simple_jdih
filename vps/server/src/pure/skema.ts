/**
 * skema.ts - definisi kolom dan pencocokan header spreadsheet lama.
 *
 * Fungsi murni tanpa I/O. Dipakai migrasi awal untuk mengenali struktur
 * spreadsheet PERMOHONAN RAPERDA/RAPERBUP sebelum datanya dipindahkan ke
 * MariaDB.
 *
 * Judul kolom di sini disalin dari spreadsheet yang sungguhan, bukan dari
 * dokumen desain -- keduanya berbeda di dua kolom, dan perbedaan itu sempat
 * membuat pencocokan menolak spreadsheet aslinya mentah-mentah. Ejaan versi
 * dokumen desain tetap diterima lewat `alias`.
 */

export type JenisKolom = 'waktu' | 'teks' | 'pilihan' | 'berkas' | 'wa';

export interface KolomForm {
  readonly kunci: string;
  readonly judul: string;
  readonly jenis: JenisKolom;
  readonly wajib?: boolean;
  readonly hanyaPerda?: boolean;
  readonly alias?: readonly string[];
}

export const KOLOM_FORM: readonly KolomForm[] = [
  { kunci: 'timestamp',        judul: 'Timestamp',                               jenis: 'waktu' },
  { kunci: 'opd',              judul: 'Nama OPD Pemohon',                        jenis: 'teks',    wajib: true },
  { kunci: 'jenis_peraturan',  judul: 'Jenis Rancangan Peraturan',               jenis: 'pilihan', wajib: true },
  { kunci: 'judul',            judul: 'Judul Raperda/Raperbup',                  jenis: 'teks',    wajib: true },
  { kunci: 'surat_permohonan', judul: 'Surat Permohonan Rancangan Perda/Perbup', jenis: 'berkas',  wajib: true },
  { kunci: 'keterangan_na',    judul: 'Keterangan/Penjelasan Rancangan Perbup atau NA Perda',
    jenis: 'berkas', wajib: true, alias: ['Keterangan/Penjelasan Raperbup atau NA Perda'] },
  { kunci: 'rancangan',        judul: 'Rancangan Perda/Perbup',                  jenis: 'berkas',  wajib: true },
  { kunci: 'lampiran',         judul: 'Lampiran Raperda/Raperbup',               jenis: 'berkas' },
  { kunci: 'paraf',            judul: 'Paraf Koordinasi',                        jenis: 'berkas',  wajib: true },
  { kunci: 'dasar_hukum',      judul: 'Dasar Hukum Penyusunan Raperda/Raperbup',
    jenis: 'berkas', wajib: true, alias: ['Dasar Hukum Penyusunan'] },
  { kunci: 'sk_tim',           judul: 'SK Tim Penyusunan RAPERDA',               jenis: 'berkas',  hanyaPerda: true },
  { kunci: 'ba_pansus',        judul: 'Berita Acara Rapat PANSUS AKHIR',         jenis: 'berkas',  hanyaPerda: true },
  { kunci: 'hasil_konsultasi', judul: 'Hasil Konsultasi',                        jenis: 'berkas' },
  { kunci: 'nama_pemohon',     judul: 'Nama Pemohon',                            jenis: 'teks',    wajib: true },
  { kunci: 'wa_pemohon',       judul: 'Nomor WhatsApp Pemohon',                  jenis: 'wa',      wajib: true },
  { kunci: 'proses',           judul: 'Tanggal dan Detail Proses',               jenis: 'teks' },
  { kunci: 'keterangan',       judul: 'Keterangan',                              jenis: 'teks' },
  { kunci: 'status',           judul: 'Status',                                  jenis: 'pilihan' }
];

/** Lima kolom yang ditambahkan versi Apps Script di sebelah kanan. */
export const KOLOM_TAMBAHAN: readonly { kunci: string; judul: string }[] = [
  { kunci: 'id',              judul: 'ID' },
  { kunci: 'email_pemohon',   judul: 'Email Pemohon' },
  { kunci: 'kode_opd',        judul: 'Kode OPD' },
  { kunci: 'diperbarui_pada', judul: 'Diperbarui Pada' },
  { kunci: 'diperbarui_oleh', judul: 'Diperbarui Oleh' }
];

export const TAHAP_RIWAYAT = [
  'BERKAS_MASUK', 'REVIU_HUKUM', 'PRA_HARMONISASI', 'RAPAT_HARMONISASI',
  'SELESAI_HARMONISASI', 'FASILITASI', 'HASIL_FASILITASI', 'DIKEMBALIKAN',
  'PERBAIKAN', 'PENETAPAN', 'LAINNYA'
] as const;
export type Tahap = (typeof TAHAP_RIWAYAT)[number];

export const STATUS_PENGAJUAN = ['PROSES', 'SELESAI', 'DIKEMBALIKAN'] as const;
export type Status = (typeof STATUS_PENGAJUAN)[number];

export type JenisSpreadsheet = 'KOSONG' | 'SIMPEL' | 'FORM' | 'ASING';

export interface HasilCocok {
  jenis: JenisSpreadsheet;
  peta: Record<string, number>;
  dikenali: number;
  hilang: string[];
  asing: string[];
}

/**
 * Seragamkan satu judul kolom supaya perbedaan ejaan tidak menghalangi
 * pencocokan: huruf kecil semua, tanda baca jadi spasi, spasi ganda dirapatkan.
 * Inilah yang membuat 'Judul Raperda / Raperbup' cocok dengan
 * 'Judul Raperda/Raperbup'.
 */
export function normalisasiHeader(teks: unknown): string {
  if (teks === null || teks === undefined) return '';
  return String(teks)
    .toLowerCase()
    .replace(/[/\\\-_.,:;()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function judulKolom(kunci: string): string {
  const semua = [...KOLOM_FORM, ...KOLOM_TAMBAHAN];
  return semua.find((k) => k.kunci === kunci)?.judul ?? '';
}

/**
 * Periksa baris header sebuah sheet dan simpulkan jenisnya.
 *
 *   KOSONG - tidak ada judul kolom sama sekali
 *   SIMPEL - kolom form lengkap dan kelima kolom tambahan sudah ada
 *   FORM   - kolom form lengkap, belum pernah dipasang SIMPEL
 *   ASING  - ada isinya tapi tidak cocok
 */
export function cocokkanHeader(barisHeader: readonly unknown[]): HasilCocok {
  const header = (barisHeader ?? []).map(normalisasiHeader);
  if (!header.some((h) => h !== '')) {
    return { jenis: 'KOSONG', peta: {}, dikenali: 0, hilang: [], asing: [] };
  }

  const semua = [...KOLOM_FORM, ...KOLOM_TAMBAHAN];
  const peta: Record<string, number> = {};
  const terpakai = new Set<number>();

  for (const kol of semua) {
    // Judul resmi plus ejaan lain yang beredar. Satu kolom yang tidak cocok
    // membuat seluruh spreadsheet dinilai ASING.
    const alias = 'alias' in kol && kol.alias ? kol.alias : [];
    const target = [kol.judul, ...alias].map(normalisasiHeader);
    for (let j = 0; j < header.length; j++) {
      if (terpakai.has(j)) continue;
      if (target.includes(header[j] ?? '')) {
        peta[kol.kunci] = j;
        terpakai.add(j);
        break;
      }
    }
  }

  const hilang = KOLOM_FORM.filter((k) => peta[k.kunci] === undefined).map((k) => k.kunci);

  const asing: string[] = [];
  for (let m = 0; m < barisHeader.length; m++) {
    if (!terpakai.has(m) && normalisasiHeader(barisHeader[m]) !== '') {
      asing.push(String(barisHeader[m]));
    }
  }

  // Seluruh kolom form harus ada. Memuat data dengan pemetaan tebak-tebakan
  // lebih berbahaya daripada menolak dan meminta manusia memeriksanya.
  if (hilang.length > 0) {
    return { jenis: 'ASING', peta, dikenali: Object.keys(peta).length, hilang, asing };
  }

  const punyaTambahan = KOLOM_TAMBAHAN.every((kol) => peta[kol.kunci] !== undefined);
  return {
    jenis: punyaTambahan ? 'SIMPEL' : 'FORM',
    peta,
    dikenali: Object.keys(peta).length,
    hilang: [],
    asing
  };
}
