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
}

export interface DataMonitoring {
  hitungan: { TOTAL: number; PROSES: number; SELESAI: number; DIKEMBALIKAN: number };
  tahun: string[];
  daftar: RingkasPengajuan[];
}

export interface DataDetail {
  ada: boolean;
  pengajuan: Omit<RingkasPengajuan, 'terakhir'>;
  riwayat: { tanggal: string; tahap: string; keterangan: string }[];
  berkas: { kolom: string; nama: string; ukuran: number; url: string }[];
  boleh: { berkas: boolean; wa: boolean };
}
