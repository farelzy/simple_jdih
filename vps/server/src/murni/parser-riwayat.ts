/**
 * parser-riwayat.ts - mengubah kolom 'Tanggal dan Detail Proses' yang diketik
 * tangan menjadi baris terstruktur, dan menyusunnya kembali menjadi teks dengan
 * bentuk yang sama persis. Fungsi murni.
 *
 * Dua arah itu sengaja dibuat simetris. Tabel `riwayat` jadi sumber kebenaran,
 * tapi hasil export tetap memuat kolom yang bentuknya dikenali Bagian Hukum,
 * sehingga siapa pun yang terbiasa membaca spreadsheet tidak perlu berubah
 * kebiasaan.
 */

export const BULAN_INDONESIA = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
] as const;

/**
 * Ejaan alternatif yang muncul di data nyata dan di kebiasaan mengetik:
 * singkatan tiga huruf, 'Nopember' lama, 'Agt'.
 */
const ALIAS_BULAN: Record<string, number> = {
  jan: 1, januari: 1,
  feb: 2, februari: 2, pebruari: 2,
  mar: 3, maret: 3,
  apr: 4, april: 4,
  mei: 5,
  jun: 6, juni: 6,
  jul: 7, juli: 7,
  ags: 8, agt: 8, agu: 8, agustus: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10,
  nov: 11, nop: 11, november: 11, nopember: 11,
  des: 12, desember: 12
};

/** Penanda butir yang pernah dipakai: -, *, bullet, en dash, '1.' */
const POLA_BUTIR = /^\s*(?:[-*•–—]+|\d+[.)])\s*/;

/** Awal sebuah kejadian: tanggal, nama bulan, tahun opsional. */
const POLA_TANGGAL = /(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/;

export interface BarisRiwayat {
  tanggal: string;
  tahap: string;
  keterangan: string;
  mentah: string;
}

function bantalDua(angka: number): string {
  return String(angka).padStart(2, '0');
}

export function uraiTanggalIndonesia(
  teks: unknown, tahunBawaan: number
): { iso: string; sisa: string } | null {
  const isi = String(teks ?? '').trim();
  if (!isi) return null;

  const cocok = new RegExp('^' + POLA_TANGGAL.source).exec(isi);
  if (!cocok) return null;

  const hari = parseInt(cocok[1] as string, 10);
  const bulan = ALIAS_BULAN[(cocok[2] as string).toLowerCase()];
  if (!bulan) return null;
  if (hari < 1 || hari > 31) return null;

  const tahun = cocok[3] ? parseInt(cocok[3], 10) : Number(tahunBawaan);
  if (!tahun) return null;

  // Tanggal seperti 30 Februari tidak masuk akal; tolak daripada digeser diam-diam.
  const uji = new Date(tahun, bulan - 1, hari);
  if (uji.getMonth() !== bulan - 1 || uji.getDate() !== hari) return null;

  return {
    iso: `${tahun}-${bantalDua(bulan)}-${bantalDua(hari)}`,
    sisa: isi.slice(cocok[0].length).trim()
  };
}

/** '2026-07-23' -> '23 Juli 2026'; '' bila bukan tanggal ISO. */
export function formatTanggalIndonesia(iso: unknown): string {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim());
  if (!cocok) return '';
  const bulan = parseInt(cocok[2] as string, 10);
  if (bulan < 1 || bulan > 12) return '';
  return `${parseInt(cocok[3] as string, 10)} ${BULAN_INDONESIA[bulan - 1]} ${cocok[1]}`;
}

/**
 * Tebak tahap dari kata kunci. Urutan penting: yang lebih khusus diperiksa
 * lebih dulu, karena 'pra harmonisasi' dan 'selesai harmonisasi' keduanya
 * mengandung kata 'harmonisasi'.
 */
export function tebakTahap(keterangan: unknown): string {
  const t = String(keterangan ?? '').toLowerCase();
  if (!t) return 'LAINNYA';

  if (/hasil\s*fasilitasi|fasilitasi\s+(sudah\s+)?terbit/.test(t)) return 'HASIL_FASILITASI';
  if (/selesai\s*harmonisasi|surat\s+selesai/.test(t)) return 'SELESAI_HARMONISASI';
  if (/pra[\s-]*harmonisasi/.test(t)) return 'PRA_HARMONISASI';
  if (/(rapat|zoom|undangan)[^.]*harmonisasi|harmonisasi[^.]*(rapat|zoom)/.test(t)) return 'RAPAT_HARMONISASI';
  if (/fasilitasi/.test(t)) return 'FASILITASI';
  if (/dikembalikan|pengembalian|kembalikan/.test(t)) return 'DIKEMBALIKAN';
  if (/perbaikan|revisi|diperbaiki/.test(t)) return 'PERBAIKAN';
  if (/ditetapkan|penetapan|diundangkan|ditandatangani/.test(t)) return 'PENETAPAN';
  if (/reviu|review|diteliti|dikoreksi|dikaji/.test(t)) return 'REVIU_HUKUM';
  if (/berkas\s+masuk|masuk\s+ke\s+sistem|berkas\s+diterima/.test(t)) return 'BERKAS_MASUK';
  if (/harmonisasi/.test(t)) return 'RAPAT_HARMONISASI';
  return 'LAINNYA';
}

/**
 * Pecah satu baris yang mungkin memuat lebih dari satu kejadian.
 * Contoh: '22 Juli 2026 Berkas masuk - 23 Juli 2026 Berkas direviu'
 */
function pecahKejadian(baris: string): string[] {
  const isi = String(baris ?? '');
  const pola = new RegExp(POLA_TANGGAL.source, 'g');
  const posisi: number[] = [];
  let cocok: RegExpExecArray | null;
  while ((cocok = pola.exec(isi)) !== null) {
    posisi.push(cocok.index);
    if (pola.lastIndex === cocok.index) pola.lastIndex++;
  }
  if (posisi.length <= 1) return [isi];

  const potongan: string[] = [];
  if ((posisi[0] as number) > 0) {
    const awal = isi.slice(0, posisi[0]).replace(POLA_BUTIR, '').trim();
    if (awal) potongan.push(awal);
  }
  for (let i = 0; i < posisi.length; i++) {
    const akhir = i + 1 < posisi.length ? (posisi[i + 1] as number) : isi.length;
    // Buang penanda butir yang menempel di ekor potongan sebelumnya.
    const bagian = isi.slice(posisi[i] as number, akhir).replace(/[\s\-*•–—]+$/, '').trim();
    if (bagian) potongan.push(bagian);
  }
  return potongan;
}

/**
 * Urai seluruh isi kolom proses.
 *
 * Baris yang tidak terbaca polanya tetap dipindahkan dengan tahap LAINNYA dan
 * teks aslinya utuh. Membuang kalimat yang tidak dikenali akan menghilangkan
 * riwayat berbulan-bulan tanpa jejak, dan itu justru bagian yang paling dicari
 * OPD saat membuka monitoring.
 */
export function uraiKolomProses(teks: unknown, tahunBawaan: number): BarisRiwayat[] {
  const isi = String(teks ?? '');
  if (!isi.trim()) return [];

  const hasil: BarisRiwayat[] = [];
  for (const barisAsli of isi.split(/\r?\n/)) {
    const baris = barisAsli.trim();
    if (!baris) continue;

    const tanpaButir = baris.replace(POLA_BUTIR, '').trim();
    if (!tanpaButir) continue;

    for (const potongan of pecahKejadian(tanpaButir)) {
      const bersih = potongan.replace(POLA_BUTIR, '').trim();
      if (!bersih) continue;
      const tanggal = uraiTanggalIndonesia(bersih, tahunBawaan);
      if (tanggal) {
        hasil.push({
          tanggal: tanggal.iso,
          tahap: tebakTahap(tanggal.sisa),
          keterangan: tanggal.sisa,
          mentah: bersih
        });
      } else {
        hasil.push({ tanggal: '', tahap: 'LAINNYA', keterangan: bersih, mentah: bersih });
      }
    }
  }

  return hasil;
}

/**
 * Susun ulang kolom proses dari baris riwayat terstruktur.
 * Bentuknya sengaja dibuat sama persis dengan yang selama ini diketik manual.
 */
export function susunKolomProses(
  daftar: readonly { tanggal: string; keterangan: string }[]
): string {
  return (daftar ?? [])
    .map((baris) => {
      const tanggal = formatTanggalIndonesia(baris.tanggal);
      const keterangan = String(baris.keterangan ?? '').trim();
      return tanggal ? `- ${tanggal} ${keterangan}` : `- ${keterangan}`;
    })
    .join('\n');
}
