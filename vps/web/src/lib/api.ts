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

  const isi = (await jawab.json().catch(() => ({}))) as { galat?: string };
  if (!jawab.ok) {
    throw new Error(isi.galat ?? `Gagal menghubungi server (HTTP ${jawab.status}).`);
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
