/**
 * Pembungkus fetch. Satu tempat untuk menerjemahkan jawaban galat server jadi
 * Error yang pesannya bisa langsung ditampilkan ke pengguna.
 */
export async function panggilApi<T>(jalur: string, opsi: RequestInit = {}): Promise<T> {
  const jawab = await fetch(jalur, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opsi.headers ?? {}) },
    ...opsi
  });

  return bacaJawaban<T>(jawab);
}

async function bacaJawaban<T>(jawab: Response): Promise<T> {
  const isi = (await jawab.json().catch(() => ({}))) as { galat?: unknown };
  if (!jawab.ok) {
    const g = isi.galat;
    // Sebagian rute menjawab dengan galat per kolom ({kolom, pesan}[]) supaya
    // form bisa menandai kolom yang salah. Tanpa JSON.stringify di sini,
    // `new Error(array)` memampatkannya jadi "[object Object]" dan pemohon
    // hanya melihat itu, bukan alasan penolakannya.
    throw new Error(
      Array.isArray(g) ? JSON.stringify(g)
        : typeof g === 'string' && g ? g
          : `Gagal menghubungi server (HTTP ${jawab.status}).`
    );
  }
  return isi as T;
}

/**
 * Kirim satu berkas sebagai bytes mentah.
 *
 * Bukan multipart: server membaca badan permintaan apa adanya, mengikuti cara
 * rute unggah berkas pengajuan. Content-Type sengaja octet-stream supaya
 * express.json() melewatinya dan alirannya masih utuh saat dibaca.
 */
export async function kirimBerkas<T>(jalur: string, berkas: File): Promise<T> {
  return bacaJawaban<T>(await fetch(jalur, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: berkas
  }));
}

export interface RingkasPengajuan {
  nomor: string;
  judul: string;
  opd: string;
  jenis_peraturan: 'Daerah' | 'Bupati';
  status: 'PROSES' | 'SELESAI' | 'DIKEMBALIKAN';
  keterangan: string;
  masuk: string;
  diperbarui: string;
  nama_pemohon: string;
  wa_pemohon: string;
  terakhir: { tanggal: string; tahap: string; keterangan: string } | null;
  /**
   * Posisi di rel tahap, 0 sampai `tahap_total`. Dihitung server dari SELURUH
   * riwayat, bukan dari `terakhir`: tahap LAINNYA adalah yang terbanyak di data
   * dan ia tidak ada di rel, jadi kejadian terakhir bukan penanda posisi.
   */
  tahap_indeks: number;
  tahap_total: number;
}

export interface DataMonitoring {
  hitungan: { TOTAL: number; PROSES: number; SELESAI: number; DIKEMBALIKAN: number };
  tahun: string[];
  daftar: RingkasPengajuan[];
}

export interface DataDetail {
  ada: boolean;
  pengajuan: Omit<RingkasPengajuan, 'terakhir' | 'tahap_indeks' | 'tahap_total'>;
  riwayat: { tanggal: string; tahap: string; keterangan: string }[];
  berkas: { kolom: string; nama: string; ukuran: number; url: string }[];
  tahap_indeks: number;
  tahap_total: number;
  boleh: { berkas: boolean; wa: boolean };
}
