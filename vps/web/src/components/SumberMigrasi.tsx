/**
 * Pemilih sumber migrasi: tautan spreadsheet atau berkas Excel yang diunggah.
 *
 * Dipakai wizard penyiapan dan tab Migrasi di dashboard. Keduanya memanggil
 * rute yang bentuknya sama, hanya awalannya berbeda, jadi awalan itu yang
 * dijadikan prop.
 *
 * Unggahan ada karena membuka akses "siapa saja yang punya link" bukan selalu
 * keputusan yang bisa diambil orang yang sedang memasang sistem ini. Mengunduh
 * spreadsheet-nya lalu mengunggah berkasnya di sini tidak menuntut izin apa pun.
 */
import { useState } from 'react';
import { panggilApi, kirimBerkas } from '../lib/api';
import { formatUkuran } from '../lib/format';

export interface HasilPeriksa {
  sah: boolean;
  pesan: string;
  jenis?: string;
  jumlahBaris?: number;
  hilang?: string[];
}

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

export type Awalan = '/api/setup' | '/api/admin';

/** Sumber yang sedang dipilih; null berarti belum siap dijalankan. */
export type Sumber =
  | { jenis: 'tautan'; tautan: string }
  | { jenis: 'berkas'; berkas: File };

export async function periksaSumber(awalan: Awalan, s: Sumber): Promise<HasilPeriksa> {
  if (s.jenis === 'berkas') return kirimBerkas<HasilPeriksa>(`${awalan}/excel/periksa`, s.berkas);
  return panggilApi<HasilPeriksa>(`${awalan}/periksa-sheet`, {
    method: 'POST',
    body: JSON.stringify({ sumber: s.tautan.trim() })
  });
}

export async function jalankanSumber(
  awalan: Awalan, s: Sumber, ujiCoba: boolean
): Promise<LaporanMigrasi> {
  if (s.jenis === 'berkas') {
    // Berkasnya dikirim lagi, bukan disimpan di server antara periksa dan
    // jalankan. Menyimpannya berarti keadaan yang harus dibersihkan dan
    // dibatasi; berkasnya sendiri puluhan KB dan sudah ada di komputer ini.
    return kirimBerkas<LaporanMigrasi>(
      `${awalan}/excel/migrasi?ujiCoba=${ujiCoba ? '1' : '0'}`, s.berkas
    );
  }
  return panggilApi<LaporanMigrasi>(`${awalan}/migrasi`, {
    method: 'POST',
    body: JSON.stringify({ sumber: s.tautan.trim(), ujiCoba })
  });
}

interface Props {
  nilai: Sumber;
  ubah: (s: Sumber) => void;
  /** Dipanggil saat sumbernya berubah, supaya hasil periksa lama dibuang. */
  saatBerubah?: () => void;
}

export function PemilihSumber({ nilai, ubah, saatBerubah }: Props) {
  // `mode` menentukan kolom mana yang tampil; `nilai` menyimpan isinya.
  // Keduanya dipisah karena mode 'berkas' punya keadaan antara yang sah:
  // sudah memilih mode, belum memilih berkas.
  const [mode, setMode] = useState<'tautan' | 'berkas'>(nilai.jenis);
  const [tautanTerakhir, setTautanTerakhir] = useState(
    nilai.jenis === 'tautan' ? nilai.tautan : ''
  );

  function pilihJenis(jenis: 'tautan' | 'berkas') {
    if (jenis === mode) return;
    setMode(jenis);
    saatBerubah?.();
    // Kembali ke mode tautan memulihkan apa yang sempat diketik. Pindah ke mode
    // berkas mengosongkan sumbernya sampai ada berkas yang benar-benar dipilih,
    // supaya tombol Periksa tidak menyala untuk sesuatu yang belum ada.
    ubah({ jenis: 'tautan', tautan: jenis === 'tautan' ? tautanTerakhir : '' });
  }

  return (
    <>
      <div className="pilihan-sumber">
        {([
          ['tautan', 'Dari link spreadsheet', 'Spreadsheet harus bisa dibuka lewat link'],
          ['berkas', 'Unggah berkas Excel', 'Tidak perlu mengubah akses spreadsheet']
        ] as const).map(([j, judul, catatan]) => (
          <label key={j} className={`kartu kartu-tautan ${mode === j ? 'aktif' : ''}`}>
            <input type="radio" name="sumber-migrasi" hidden checked={mode === j}
                   onChange={() => pilihJenis(j)} />
            <strong>{judul}</strong><br />
            <span className="petunjuk">{catatan}</span>
          </label>
        ))}
      </div>

      {mode === 'tautan' ? (
        <label>
          Link spreadsheet
          <input
            value={nilai.jenis === 'tautan' ? nilai.tautan : ''}
            onChange={(e) => {
              saatBerubah?.();
              setTautanTerakhir(e.target.value);
              ubah({ jenis: 'tautan', tautan: e.target.value });
            }}
            placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..."
          />
          <span className="petunjuk">
            Aksesnya harus disetel minimal &ldquo;Siapa saja yang memiliki link&rdquo;
            sebagai Pelihat. Spreadsheet aslinya hanya dibaca, tidak pernah diubah.
          </span>
        </label>
      ) : (
        <label>
          Berkas Excel
          <input
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              saatBerubah?.();
              if (f) ubah({ jenis: 'berkas', berkas: f });
            }}
          />
          <span className="petunjuk">
            Di Google Sheets: <strong>File &rarr; Download &rarr; Microsoft Excel (.xlsx)</strong>.
            Berkas .csv juga diterima. Maksimal 15 MB.
          </span>
        </label>
      )}

      {nilai.jenis === 'berkas' && (
        <p className="petunjuk">
          Terpilih: <strong>{nilai.berkas.name}</strong> &middot; {formatUkuran(nilai.berkas.size)}
        </p>
      )}
    </>
  );
}

/**
 * Sumber sudah cukup lengkap untuk dikirim ke server?
 *
 * Mode berkas yang belum memilih berkas tetap tersimpan sebagai tautan kosong,
 * jadi pemeriksaan ini menangkap keduanya sekaligus.
 */
export function sumberSiap(s: Sumber): boolean {
  return s.jenis === 'berkas' ? s.berkas.size > 0 : s.tautan.trim() !== '';
}
