/**
 * layanan/migrasi.ts - memindahkan isi spreadsheet lama ke MariaDB.
 *
 * Dijalankan sekali di awal. Spreadsheet aslinya tidak pernah disentuh --
 * hanya dibaca lewat endpoint ekspor CSV publik milik Google, yang tidak
 * menuntut autentikasi apa pun. Itulah sebabnya seluruh sistem ini tidak
 * memerlukan OAuth.
 *
 * Berkas lama TIDAK dipindahkan. Kolom berkas di spreadsheet berisi tautan
 * Drive, dan tautan itu sudah bekerja; menyalin berkasnya hanya menambah
 * risiko tanpa manfaat. Yang disimpan adalah tautannya, bersumber 'tautan'.
 */

import type { PoolConnection } from 'mysql2/promise';
import { transaksi, kueri } from '../db.js';
import { uraiCsv, urlEksporCsv } from '../murni/csv.js';
import { cocokkanHeader, KOLOM_FORM } from '../murni/skema.js';
import { uraiKolomProses, susunKolomProses } from '../murni/parser-riwayat.js';
import { nomorBerikutnya } from '../murni/penomoran.js';
import { normalisasiWa } from '../murni/validasi.js';
import { opdCocokkan } from '../repo/opd.js';
import { logCatat } from '../repo/log.js';

export interface LaporanMigrasi {
  barisDibaca: number;
  barisDisisipkan: number;
  dilewati: string[];
  riwayatTerurai: number;
  riwayatLainnya: number;
  berkasTertaut: number;
  opdPerluPeriksa: string[];
  selisihKolom16: string[];
  ujiCoba: boolean;
}

export interface OpsiMigrasi {
  /** Tautan/ID spreadsheet, atau isi CSV mentah bila sudah diunduh sendiri. */
  sumber: string;
  isiCsv?: string;
  ujiCoba: boolean;
  aktor?: string;
}

/** '30/04/2026 09:15:00' atau '2026-04-30 ...' -> '2026-04-30'; '' bila gagal. */
export function tanggalDariTimestamp(teks: unknown): string {
  const isi = String(teks ?? '').trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(isi);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const lokal = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(isi);
  if (lokal) {
    return `${lokal[3]}-${String(lokal[2]).padStart(2, '0')}-${String(lokal[1]).padStart(2, '0')}`;
  }
  return '';
}

/**
 * Rapatkan teks untuk perbandingan bolak-balik.
 *
 * Penanda butir di depan baris ikut dibuang. Perbandingan ini ada untuk
 * menangkap kalimat yang hilang atau terbelah, bukan untuk mempersoalkan
 * tanda hubung: baris lanjutan di data asli kadang ditulis tanpa tanda hubung,
 * dan menyusunnya ulang selalu menambahkannya. Menghitung itu sebagai selisih
 * membuat peringatan berbunyi untuk hal yang tidak perlu diperiksa siapa pun,
 * lalu peringatan yang sungguhan ikut diabaikan.
 */
export function normalisasiBanding(teks: unknown): string {
  return String(teks ?? '')
    .split(/\r?\n/)
    .map((b) => b.trim().replace(/^[-*•–—]+\s*/, '').replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('\n');
}

async function ambilCsv(opsi: OpsiMigrasi): Promise<string> {
  if (opsi.isiCsv) return opsi.isiCsv;

  const url = urlEksporCsv(opsi.sumber);
  const jawab = await fetch(url, { redirect: 'follow' });
  if (!jawab.ok) {
    throw new Error(
      `Spreadsheet tidak bisa dibaca (HTTP ${jawab.status}). Pastikan aksesnya ` +
      'disetel "Siapa saja yang memiliki link" minimal sebagai Pelihat.'
    );
  }
  const teks = await jawab.text();
  if (teks.trimStart().startsWith('<')) {
    throw new Error(
      'Google mengembalikan halaman login, bukan data. Spreadsheet masih tertutup — ' +
      'buka aksesnya lewat tautan, atau unduh CSV-nya lalu unggah berkasnya di sini.'
    );
  }
  return teks;
}

/**
 * Baca spreadsheet dan laporkan apa yang akan terjadi, tanpa menulis apa pun.
 * Dipakai langkah "periksa" di wizard penyiapan.
 */
export async function migrasiPeriksa(opsi: OpsiMigrasi): Promise<{
  sah: boolean;
  pesan: string;
  jenis?: string;
  jumlahBaris?: number;
  hilang?: string[];
}> {
  try {
    const baris = uraiCsv(await ambilCsv(opsi));
    if (!baris.length) return { sah: false, pesan: 'Spreadsheet kosong.' };

    const cocok = cocokkanHeader(baris[0] as string[]);
    if (cocok.jenis === 'ASING') {
      return {
        sah: false,
        jenis: cocok.jenis,
        hilang: cocok.hilang,
        pesan: 'Header spreadsheet tidak dikenali, jadi migrasi dihentikan daripada ' +
               'menebak-nebak dan salah menaruh data. Kolom yang tidak ditemukan: ' +
               cocok.hilang.join(', ') + '.'
      };
    }

    return {
      sah: true,
      jenis: cocok.jenis,
      jumlahBaris: baris.length - 1,
      pesan: `Dikenali sebagai spreadsheet pengajuan dengan ${baris.length - 1} baris data.`
    };
  } catch (galat) {
    return { sah: false, pesan: (galat as Error).message };
  }
}

/**
 * Jalankan migrasi.
 *
 * Seluruh penyisipan berada dalam SATU transaksi: kalau baris ke-20 gagal,
 * tidak ada satu pun yang tersisip setengah jalan.
 *
 * Idempoten: baris yang judul dan tanggal masuknya sudah ada dilewati, jadi
 * menjalankannya dua kali tidak menggandakan data.
 */
export async function migrasiJalankan(opsi: OpsiMigrasi): Promise<LaporanMigrasi> {
  const laporan: LaporanMigrasi = {
    barisDibaca: 0, barisDisisipkan: 0, dilewati: [],
    riwayatTerurai: 0, riwayatLainnya: 0, berkasTertaut: 0,
    opdPerluPeriksa: [], selisihKolom16: [], ujiCoba: opsi.ujiCoba
  };

  const semua = uraiCsv(await ambilCsv(opsi));
  if (semua.length < 2) throw new Error('Spreadsheet tidak berisi data apa pun.');

  const peta = cocokkanHeader(semua[0] as string[]).peta;
  if (peta.judul === undefined || peta.timestamp === undefined) {
    throw new Error('Header spreadsheet tidak dikenali. Migrasi dihentikan.');
  }

  const sel = (baris: string[], kunci: string): string => {
    const i = peta[kunci];
    return i === undefined ? '' : String(baris[i] ?? '').trim();
  };

  // Urut menurut timestamp terlama supaya BRB-2026-0001 benar-benar pengajuan
  // pertama, bukan sekadar baris pertama di spreadsheet.
  const baris = semua.slice(1)
    .map((b) => b as string[])
    .filter((b) => sel(b, 'judul') || sel(b, 'timestamp'))
    .map((b) => ({ b, masuk: tanggalDariTimestamp(sel(b, 'timestamp')) }))
    .sort((x, y) => (x.masuk < y.masuk ? -1 : x.masuk > y.masuk ? 1 : 0));

  laporan.barisDibaca = baris.length;

  const opdBelumDikenal = new Set<string>();
  const sudahAda = await kueri<{ judul: string; masuk: string }>(
    `SELECT judul, DATE(dibuat_pada) AS masuk FROM pengajuan`
  );
  const kunciAda = new Set(sudahAda.map((p) => `${p.judul}|${String(p.masuk).slice(0, 10)}`));

  const kerjakan = async (conn: PoolConnection) => {
    let nomorTerakhir = '';

    for (const { b, masuk } of baris) {
      const judul = sel(b, 'judul');
      if (kunciAda.has(`${judul}|${masuk}`)) {
        laporan.dilewati.push(judul.slice(0, 60));
        continue;
      }

      const tahun = Number(masuk.slice(0, 4)) || new Date().getFullYear();
      const nomor = nomorBerikutnya(tahun, nomorTerakhir);
      nomorTerakhir = nomor;

      const namaOpd = sel(b, 'opd');
      const opdId = namaOpd ? await opdCocokkan(namaOpd) : null;
      if (namaOpd && opdId === null) opdBelumDikenal.add(namaOpd);

      const jenis = sel(b, 'jenis_peraturan').toLowerCase().includes('daerah') ? 'Daerah' : 'Bupati';
      const status = (sel(b, 'status').toUpperCase() || 'PROSES').trim();
      const statusSah = ['PROSES', 'SELESAI', 'DIKEMBALIKAN'].includes(status) ? status : 'PROSES';

      let idPengajuan = 0;
      if (!opsi.ujiCoba) {
        const [hasil] = await conn.query(
          `INSERT INTO pengajuan
            (nomor, opd_id, opd_teks, jenis_peraturan, judul, nama_pemohon, wa_pemohon,
             email_pemohon, status, keterangan, dibuat_pada, diperbarui_pada, diperbarui_oleh)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [nomor, opdId, namaOpd, jenis, judul, sel(b, 'nama_pemohon'),
           normalisasiWa(sel(b, 'wa_pemohon')) ?? sel(b, 'wa_pemohon'), '',
           statusSah, sel(b, 'keterangan'),
           `${masuk || '2026-01-01'} 00:00:00`, `${masuk || '2026-01-01'} 00:00:00`, 'migrasi']
        );
        idPengajuan = (hasil as { insertId: number }).insertId;
      }
      laporan.barisDisisipkan++;

      // Kolom 16 -> baris riwayat terstruktur.
      const kejadian = uraiKolomProses(sel(b, 'proses'), tahun);
      for (const k of kejadian) {
        if (k.tahap === 'LAINNYA') laporan.riwayatLainnya++;
        else laporan.riwayatTerurai++;

        if (!opsi.ujiCoba) {
          await conn.query(
            `INSERT INTO riwayat (pengajuan_id, tanggal, tahap, keterangan, dicatat_oleh, dicatat_pada)
             VALUES (?,?,?,?,?, NOW())`,
            [idPengajuan, k.tanggal || masuk || '2026-01-01', k.tahap, k.keterangan, 'migrasi']
          );
        }
      }

      // Perbandingan bolak-balik: susun ulang kolom 16 dari hasil parsing lalu
      // bandingkan dengan aslinya. Kalau berbeda, ada kalimat yang berubah
      // bentuk dan itu harus dilihat manusia.
      if (kejadian.length &&
          normalisasiBanding(susunKolomProses(kejadian)) !== normalisasiBanding(sel(b, 'proses'))) {
        laporan.selisihKolom16.push(nomor);
      }

      // Tautan berkas disalin apa adanya, tidak dipindahkan.
      for (const kol of KOLOM_FORM) {
        if (kol.jenis !== 'berkas') continue;
        for (const potong of sel(b, kol.kunci).split(/[\s,]+/)) {
          const url = potong.trim();
          if (!/^https?:\/\//i.test(url)) continue;
          laporan.berkasTertaut++;
          if (!opsi.ujiCoba) {
            await conn.query(
              `INSERT INTO berkas (pengajuan_id, kolom, nama, ukuran, mime, sumber, jalur, diunggah_pada)
               VALUES (?,?,?,0,'','tautan',?, ?)`,
              [idPengajuan, kol.kunci, kol.judul, url, `${masuk || '2026-01-01'} 00:00:00`]
            );
          }
        }
      }
    }
  };

  if (opsi.ujiCoba) {
    // Mode uji-coba tetap melewati transaksi lalu di-rollback, supaya jalur
    // kodenya persis sama dengan yang sungguhan -- laporan yang dihasilkan
    // dari jalur berbeda tidak bisa dipercaya.
    await transaksi(async (conn) => {
      await kerjakan(conn);
      throw new BatalUjiCoba();
    }).catch((e) => { if (!(e instanceof BatalUjiCoba)) throw e; });
  } else {
    await transaksi(kerjakan);
  }

  laporan.opdPerluPeriksa = [...opdBelumDikenal];

  if (!opsi.ujiCoba) {
    await logCatat({
      aktor: opsi.aktor ?? 'penyiapan',
      aksi: 'MIGRASI',
      rincian: `${laporan.barisDisisipkan} pengajuan, ` +
               `${laporan.riwayatTerurai + laporan.riwayatLainnya} riwayat, ` +
               `${laporan.selisihKolom16.length} selisih kolom 16`
    });
  }

  return laporan;
}

class BatalUjiCoba extends Error {
  constructor() { super('uji coba dibatalkan'); }
}
