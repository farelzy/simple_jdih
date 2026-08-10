/**
 * penomoran.ts - nomor pengajuan berurut. Fungsi murni.
 *
 * Tidak menyentuh database dan tidak mengunci apa pun. Pemanggilnya
 * (repo/pengajuan.ts) yang bertanggung jawab membaca nomor terakhir dan
 * menuliskan hasilnya kembali di dalam satu transaksi, dengan constraint
 * UNIQUE pada kolom `nomor` sebagai jaring pengaman terakhir.
 */

export const PREFIKS_NOMOR = 'BRB';
const PANJANG_URUT = 4;

export interface NomorTerurai {
  prefiks: string;
  tahun: number;
  urut: number;
}

export function uraiNomor(kode: unknown): NomorTerurai | null {
  if (kode === null || kode === undefined) return null;
  const cocok = /^([A-Za-z]{2,5})-(\d{4})-(\d{4,})$/.exec(String(kode).trim());
  if (!cocok) return null;
  return {
    prefiks: (cocok[1] as string).toUpperCase(),
    tahun: parseInt(cocok[2] as string, 10),
    urut: parseInt(cocok[3] as string, 10)
  };
}

function bantalNol(angka: number, panjang: number): string {
  return String(angka).padStart(panjang, '0');
}

/**
 * @param tahun tahun pengajuan baru
 * @param nomorTerakhir nomor terakhir yang tercatat; boleh kosong atau rusak
 */
export function nomorBerikutnya(tahun: number, nomorTerakhir: string | null | undefined): string {
  const urai = uraiNomor(nomorTerakhir);
  const urut = urai && urai.tahun === Number(tahun) ? urai.urut + 1 : 1;
  return `${PREFIKS_NOMOR}-${tahun}-${bantalNol(urut, PANJANG_URUT)}`;
}

/** @returns kode dengan tahun lalu urut tertinggi; '' bila tak ada yang sah */
export function nomorTerbesar(daftarKode: readonly (string | null | undefined)[]): string {
  let terbaik: NomorTerurai | null = null;
  let kodeTerbaik = '';
  for (const kode of daftarKode ?? []) {
    const urai = uraiNomor(kode);
    if (!urai) continue;
    if (!terbaik || urai.tahun > terbaik.tahun ||
        (urai.tahun === terbaik.tahun && urai.urut > terbaik.urut)) {
      terbaik = urai;
      kodeTerbaik = String(kode).trim().toUpperCase();
    }
  }
  return kodeTerbaik;
}
