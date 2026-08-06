/**
 * validasi.ts - aturan wajib, ukuran, dan jenis berkas. Fungsi murni.
 *
 * Batas ukuran tidak ditulis di sini; yang ditulis hanya nama kunci
 * pengaturannya. Nilainya dibaca dari tabel `pengaturan` dan diteruskan sebagai
 * argumen, supaya Bagian Hukum bisa mengubah batas tanpa deploy ulang.
 */

import { KOLOM_FORM, judulKolom } from './skema.js';

export interface AturanBerkas {
  readonly kunciBatas: string;
  readonly ekstensi: readonly string[];
  readonly kunciMaksBerkas?: string;
}

export const ATURAN_BERKAS: Record<string, AturanBerkas> = {
  surat_permohonan: { kunciBatas: 'batas_surat_permohonan', ekstensi: ['pdf'] },
  keterangan_na:    { kunciBatas: 'batas_keterangan_na',    ekstensi: ['pdf', 'doc', 'docx'] },
  // Harus bisa disunting dan dikomentari per pasal oleh Bagian Hukum, jadi PDF ditolak.
  rancangan:        { kunciBatas: 'batas_rancangan',        ekstensi: ['doc', 'docx'] },
  lampiran:         { kunciBatas: 'batas_lampiran',         ekstensi: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar'] },
  paraf:            { kunciBatas: 'batas_paraf',            ekstensi: ['pdf', 'jpg', 'jpeg', 'png'] },
  dasar_hukum:      { kunciBatas: 'batas_dasar_hukum',      ekstensi: ['pdf', 'zip', 'rar'] },
  sk_tim:           { kunciBatas: 'batas_sk_tim',           ekstensi: ['pdf'] },
  ba_pansus:        { kunciBatas: 'batas_ba_pansus',        ekstensi: ['pdf'], kunciMaksBerkas: 'maks_berkas_ba_pansus' },
  hasil_konsultasi: { kunciBatas: 'batas_hasil_konsultasi', ekstensi: ['pdf', 'doc', 'docx', 'zip', 'rar'] }
};

const SATU_MB = 1024 * 1024;

export interface BerkasDiperiksa {
  kolom: string;
  nama: string;
  ukuran: number;
}

export interface HasilPeriksa {
  sah: boolean;
  pesan: string;
}

export interface GalatKolom {
  kolom: string;
  pesan: string;
}

export interface DataPengajuan {
  jenis_peraturan?: string;
  opd?: string;
  judul?: string;
  nama_pemohon?: string;
  wa_pemohon?: string;
  berkas?: Record<string, { nama: string; ukuran: number }[]>;
}

export function ekstensiDari(nama: unknown): string {
  const teks = String(nama ?? '');
  const titik = teks.lastIndexOf('.');
  if (titik < 0 || titik === teks.length - 1) return '';
  return teks.slice(titik + 1).toLowerCase();
}

/**
 * Seragamkan nomor WhatsApp jadi bentuk 08xxxxxxxxx.
 * Menerima 0822..., +62822..., 62822..., dengan spasi atau tanda hubung.
 * @returns null bila tidak menyerupai nomor seluler Indonesia
 */
export function normalisasiWa(teks: unknown): string | null {
  if (teks === null || teks === undefined) return null;
  let angka = String(teks).replace(/[^0-9+]/g, '');
  if (angka.startsWith('+62')) angka = '0' + angka.slice(3);
  else if (angka.startsWith('62') && angka.length > 10) angka = '0' + angka.slice(2);
  angka = angka.replace(/[^0-9]/g, '');
  if (!angka.startsWith('08')) return null;
  if (angka.length < 10 || angka.length > 14) return null;
  return angka;
}

/** '082299989690' -> '0822-9998-9690' supaya salah ketik terlihat mata. */
export function formatWa(nomor: unknown): string {
  const angka = String(nomor ?? '');
  if (angka.length < 9) return angka;
  return `${angka.slice(0, 4)}-${angka.slice(4, 8)}-${angka.slice(8)}`;
}

/** '082299989690' -> '0822****9690' untuk pengunjung bukan admin. */
export function samarkanWa(nomor: unknown): string {
  const angka = String(nomor ?? '');
  if (!angka) return '';
  if (angka.length <= 8) return angka.slice(0, 2) + '****';
  return `${angka.slice(0, 4)}****${angka.slice(-4)}`;
}

export function validasiBerkas(
  berkas: BerkasDiperiksa,
  pengaturan: Record<string, string>
): HasilPeriksa {
  const aturan = ATURAN_BERKAS[berkas?.kolom];
  if (!aturan) return { sah: false, pesan: 'Kolom berkas tidak dikenali.' };

  const ukuran = Number(berkas.ukuran) || 0;
  if (ukuran <= 0) return { sah: false, pesan: 'Berkas kosong atau ukurannya tidak terbaca.' };

  const ekst = ekstensiDari(berkas.nama);
  if (!aturan.ekstensi.includes(ekst)) {
    return {
      sah: false,
      pesan: `Jenis berkas ${ekst ? '.' + ekst : 'tanpa ekstensi'} tidak diterima. ` +
             `Yang diterima: ${aturan.ekstensi.join(', ')}.`
    };
  }

  let batasMb = Number(pengaturan?.[aturan.kunciBatas]);
  if (!batasMb || batasMb <= 0) batasMb = 5;
  if (ukuran > batasMb * SATU_MB) {
    return { sah: false, pesan: `Ukuran berkas melebihi batas ${batasMb} MB.` };
  }

  return { sah: true, pesan: '' };
}

/**
 * Periksa satu pengajuan utuh.
 *
 * Kolom bersyarat ditegakkan di sini: memilih Daerah menjadikan SK Tim dan
 * Berita Acara PANSUS wajib, memilih Bupati membuat keduanya tidak berlaku.
 * Di form lama keduanya cuma keterangan tertulis yang boleh diabaikan, dan
 * pengajuan Perda tanpa lampiran itu tetap bisa terkirim.
 */
export function validasiPengajuan(
  data: DataPengajuan,
  pengaturan: Record<string, string>
): { sah: boolean; galat: GalatKolom[] } {
  const galat: GalatKolom[] = [];
  const berkas = data?.berkas ?? {};

  const jenis = String(data?.jenis_peraturan ?? '').trim();
  if (jenis !== 'Daerah' && jenis !== 'Bupati') {
    galat.push({ kolom: 'jenis_peraturan', pesan: 'Pilih Peraturan Daerah atau Peraturan Bupati.' });
  }
  const perda = jenis === 'Daerah';

  for (const kunci of ['opd', 'judul', 'nama_pemohon'] as const) {
    if (String(data?.[kunci] ?? '').trim() === '') {
      galat.push({ kolom: kunci, pesan: `${judulKolom(kunci)} wajib diisi.` });
    }
  }

  if (normalisasiWa(data?.wa_pemohon) === null) {
    galat.push({ kolom: 'wa_pemohon', pesan: 'Nomor WhatsApp tidak sah. Contoh: 0822-9998-9690.' });
  }

  for (const kol of KOLOM_FORM) {
    if (kol.jenis !== 'berkas') continue;

    const daftar = berkas[kol.kunci] ?? [];
    const wajib = kol.hanyaPerda ? perda : !!kol.wajib;

    if (wajib && daftar.length === 0) {
      galat.push({ kolom: kol.kunci, pesan: `${kol.judul} wajib dilampirkan.` });
      continue;
    }
    if (kol.hanyaPerda && !perda && daftar.length > 0) {
      galat.push({
        kolom: kol.kunci,
        pesan: `${kol.judul} hanya berlaku untuk Rancangan Peraturan Daerah.`
      });
      continue;
    }

    const aturan = ATURAN_BERKAS[kol.kunci];
    if (aturan?.kunciMaksBerkas) {
      const maks = Number(pengaturan?.[aturan.kunciMaksBerkas]) || 5;
      if (daftar.length > maks) {
        galat.push({ kolom: kol.kunci, pesan: `${kol.judul} maksimal ${maks} berkas.` });
      }
    }

    for (const b of daftar) {
      const periksa = validasiBerkas({ kolom: kol.kunci, nama: b.nama, ukuran: b.ukuran }, pengaturan);
      if (!periksa.sah) galat.push({ kolom: kol.kunci, pesan: `${b.nama}: ${periksa.pesan}` });
    }
  }

  return { sah: galat.length === 0, galat };
}
