/**
 * pure/sql.ts - memecah berkas .sql jadi pernyataan satu per satu.
 *
 * Diperlukan karena multipleStatements dimatikan di sambungan database --
 * sengaja, karena itulah yang membuat satu celah injeksi berubah dari
 * "membaca satu tabel" jadi "menjalankan apa pun".
 *
 * Pemecahan naif (`split(';')`) cukup untuk berkas skema yang ditulis tangan,
 * tapi berbahaya untuk dump yang memuat data manusia:
 *
 *   INSERT INTO pengajuan VALUES ('Raperda tentang Retribusi; Perubahan');
 *
 * Titik koma di dalam petik itu bukan akhir pernyataan. Memecah di sana
 * menghasilkan dua pernyataan rusak, dan pemulihan gagal di tengah jalan --
 * setelah sebagian tabel terlanjur dihapus.
 *
 * Fungsi murni tanpa I/O.
 */

/**
 * Pecah teks SQL jadi daftar pernyataan.
 *
 * Yang dihormati: petik tunggal, petik ganda, backtick, pelolosan garis miring
 * terbalik, petik ganda-dua di dalam petik (`''`), komentar `--`, `#`, dan
 * `/* *\/`. Pernyataan kosong dibuang.
 */
export function pisahPernyataanSql(sql: string): string[] {
  const hasil: string[] = [];
  const teks = String(sql ?? '');

  /**
   * Pernyataan disusun bertahap, bukan diiris dari teks asli.
   *
   * Mengiris `teks.slice(mulai, i)` terlihat lebih ringkas, tapi ikut membawa
   * komentar yang sudah sengaja dilewati -- dan komentar itu lalu muncul di
   * pesan galat "gagal pada pernyataan ke-N", tepat saat orang sedang berusaha
   * memahami pernyataan mana yang bermasalah.
   */
  let sedang = '';
  let i = 0;

  /** Kutip yang sedang terbuka; kosong berarti di luar kutip. */
  let kutip = '';

  const dorong = () => {
    const potong = sedang.trim();
    if (potong) hasil.push(potong);
    sedang = '';
  };

  while (i < teks.length) {
    const c = teks[i] as string;

    if (kutip) {
      if (c === '\\' && kutip !== '`') {
        // Backtick tidak mengenal pelolosan garis miring terbalik; yang lain
        // mengenal, jadi karakter berikutnya ikut apa pun isinya.
        sedang += teks.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === kutip) {
        // `''` di dalam petik tunggal berarti satu petik, bukan penutup.
        if (teks[i + 1] === kutip) { sedang += c + c; i += 2; continue; }
        kutip = '';
      }
      sedang += c;
      i++;
      continue;
    }

    if (c === "'" || c === '"' || c === '`') { kutip = c; sedang += c; i++; continue; }

    // Komentar sampai akhir baris. '--' hanya berlaku bila diikuti spasi atau
    // akhir baris; tanpa syarat itu, `5--3` di dalam ekspresi ikut terpotong.
    if ((c === '-' && teks[i + 1] === '-' && /[\s\0]|^$/.test(teks[i + 2] ?? '\n')) || c === '#') {
      const akhirBaris = teks.indexOf('\n', i);
      if (akhirBaris < 0) break;
      // Baris baru tetap disertakan supaya kata di baris berikutnya tidak
      // menempel ke kata sebelum komentar.
      sedang += '\n';
      i = akhirBaris + 1;
      continue;
    }

    if (c === '/' && teks[i + 1] === '*') {
      const tutup = teks.indexOf('*/', i + 2);
      sedang += ' ';
      i = tutup < 0 ? teks.length : tutup + 2;
      continue;
    }

    if (c === ';') { dorong(); i++; continue; }

    sedang += c;
    i++;
  }

  // Pernyataan terakhir boleh tanpa titik koma penutup.
  dorong();
  return hasil;
}
