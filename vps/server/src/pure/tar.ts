/**
 * pure/tar.ts - penulis arsip tar (format ustar).
 *
 * Ditulis sendiri, bukan menambah pustaka: formatnya tetap sejak 1988 dan
 * hanya bagian penulisan yang dipakai di sini. Satu dependensi baru harus ikut
 * diperbarui, diaudit, dan dibawa ke setiap pemasangan seumur hidup proyek --
 * mahal untuk enam puluh baris yang tidak akan pernah berubah.
 *
 * Fungsi murni tanpa I/O, jadi hasilnya bisa diuji tanpa menyentuh disk.
 */

const BLOK = 512;
const MAKS_NAMA = 100;

export interface EntriTar {
  nama: string;
  isi: Buffer;
  /** Detik sejak epoch. Diberikan dari luar supaya keluarannya bisa diulang. */
  waktu?: number;
}

/** Angka oktal berlapis nol, ditutup NUL, sepanjang `lebar` bita. */
function oktal(nilai: number, lebar: number): string {
  return nilai.toString(8).padStart(lebar - 1, '0') + '\0';
}

function tulis(kepala: Buffer, teks: string, mulai: number, panjang: number): void {
  kepala.write(teks, mulai, panjang, 'utf8');
}

/**
 * Kepala 512 bita untuk satu berkas.
 *
 * Checksum dihitung dengan kolomnya sendiri dianggap berisi spasi -- itu
 * bagian dari definisi formatnya, bukan kebetulan.
 */
function kepalaEntri(nama: string, ukuran: number, waktu: number): Buffer {
  const bitaNama = Buffer.from(nama, 'utf8');
  if (bitaNama.length > MAKS_NAMA) {
    throw new Error(`Nama di dalam arsip terlalu panjang (maks ${MAKS_NAMA} bita): ${nama}`);
  }

  const k = Buffer.alloc(BLOK);
  tulis(k, nama, 0, MAKS_NAMA);
  tulis(k, oktal(0o644, 8), 100, 8);      // mode
  tulis(k, oktal(0, 8), 108, 8);          // uid
  tulis(k, oktal(0, 8), 116, 8);          // gid
  tulis(k, oktal(ukuran, 12), 124, 12);
  tulis(k, oktal(Math.floor(waktu), 12), 136, 12);
  k.write('        ', 148, 8, 'utf8');    // checksum sementara: delapan spasi
  k.write('0', 156, 1, 'utf8');           // typeflag: berkas biasa
  k.write('ustar\0', 257, 6, 'utf8');
  k.write('00', 263, 2, 'utf8');

  let jumlah = 0;
  for (const b of k) jumlah += b;
  k.write(oktal(jumlah, 7) + ' ', 148, 8, 'utf8');

  return k;
}

/** Bantalan nol supaya panjangnya kelipatan 512. */
function bantalan(panjang: number): Buffer {
  const sisa = panjang % BLOK;
  return sisa === 0 ? Buffer.alloc(0) : Buffer.alloc(BLOK - sisa);
}

/**
 * Susun beberapa berkas jadi satu arsip tar.
 *
 * @param waktuBaku dipakai untuk entri yang tidak menyebut waktunya sendiri
 */
export function susunTar(entri: readonly EntriTar[], waktuBaku = 0): Buffer {
  const potongan: Buffer[] = [];

  for (const e of entri) {
    potongan.push(kepalaEntri(e.nama, e.isi.length, e.waktu ?? waktuBaku));
    potongan.push(e.isi);
    potongan.push(bantalan(e.isi.length));
  }

  // Penanda akhir arsip: dua blok nol. Tanpa ini sebagian pembaca tar
  // melaporkan "unexpected end of file" walau isinya sudah lengkap.
  potongan.push(Buffer.alloc(BLOK * 2));

  return Buffer.concat(potongan);
}
