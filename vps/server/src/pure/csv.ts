/**
 * pure/csv.ts - pengurai CSV sesuai RFC 4180. Fungsi murni.
 *
 * Ditulis sendiri, bukan memakai pustaka, karena yang dibutuhkan cuma satu
 * fungsi dan berkas yang diurai hanya satu: ekspor spreadsheet lama saat
 * migrasi. Menambah dependensi untuk itu tidak sepadan.
 *
 * Yang wajib ditangani benar: sel berisi koma, sel berisi tanda kutip ganda,
 * dan sel berisi baris baru. Ketiganya ada di data nyata -- kolom
 * 'Tanggal dan Detail Proses' berisi lini masa bertingkat dengan baris baru
 * di dalam satu sel, dan judul peraturan kerap memuat koma.
 */

export function uraiCsv(teks: string): string[][] {
  const isi = String(teks ?? '').replace(/^﻿/, '');   // buang BOM
  const baris: string[][] = [];
  let sel: string[] = [];
  let nilai = '';
  let dalamKutip = false;

  for (let i = 0; i < isi.length; i++) {
    const c = isi[i];

    if (dalamKutip) {
      if (c === '"') {
        if (isi[i + 1] === '"') { nilai += '"'; i++; }   // "" berarti satu kutip
        else dalamKutip = false;
      } else {
        nilai += c;
      }
      continue;
    }

    if (c === '"') { dalamKutip = true; continue; }

    if (c === ',') { sel.push(nilai); nilai = ''; continue; }

    if (c === '\r') continue;   // CRLF diperlakukan sebagai LF

    if (c === '\n') {
      sel.push(nilai);
      baris.push(sel);
      sel = [];
      nilai = '';
      continue;
    }

    nilai += c;
  }

  // Baris terakhir tanpa baris baru di ujung berkas.
  if (nilai !== '' || sel.length) {
    sel.push(nilai);
    baris.push(sel);
  }

  // Baris yang seluruh selnya kosong tidak membawa informasi apa pun.
  return baris.filter((b) => b.some((s) => s.trim() !== ''));
}

/**
 * Susun URL ekspor CSV dari tautan atau ID spreadsheet.
 *
 * Endpoint gviz ini tidak menuntut autentikasi selama spreadsheetnya dibagikan
 * lewat tautan -- persis seperti tab monitoring yang selama ini ditempel di
 * Linktree. Itulah yang membuat migrasi tidak memerlukan OAuth sama sekali.
 */
export function urlEksporCsv(tautanAtauId: string, gid?: string): string {
  const bersih = String(tautanAtauId ?? '').trim();
  if (!bersih) throw new Error('Tautan atau ID spreadsheet kosong.');

  let id = '';
  if (/^[A-Za-z0-9_-]{20,}$/.test(bersih)) {
    id = bersih;
  } else {
    const cocok = /\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(bersih)
      ?? /\/d\/([A-Za-z0-9_-]+)/.exec(bersih);
    if (!cocok) {
      throw new Error(
        'Tautan tidak dikenali. Salin URL spreadsheet dari address bar, contoh: ' +
        'https://docs.google.com/spreadsheets/d/abc123.../edit'
      );
    }
    id = cocok[1] as string;
  }

  // gid menunjuk tab tertentu. Bila tidak disebut, ikut dari tautan; bila tidak
  // ada juga, Google memberi tab pertama.
  const gidDariTautan = /[#&?]gid=(\d+)/.exec(bersih)?.[1];
  const tab = gid ?? gidDariTautan;

  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv` +
         (tab ? `&gid=${tab}` : '');
}
