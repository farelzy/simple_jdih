/**
 * Kotak pemulihan dari arsip cadangan penuh.
 *
 * Dipakai wizard penyiapan dan tab Cadangan. Ini tombol paling berbahaya di
 * seluruh sistem: ia menghapus seluruh isi database lalu menggantinya. Karena
 * itu alurnya dipaksa dua langkah -- periksa dulu, baru jalankan -- dan tombol
 * jalankan tidak pernah muncul sebelum arsipnya terbukti sah.
 */
import { useState } from 'react';
import { kirimBerkas } from '../lib/api';
import { formatUkuran } from '../lib/format';

interface HasilPeriksa {
  sah: boolean;
  pesan: string;
  tabel?: string[];
  jumlahBerkas?: number;
  dibuat?: string;
}

interface HasilPulih {
  pernyataanDijalankan: number;
  berkasDipulihkan: number;
  tabel: string[];
  cadanganSebelumnya: string;
}

export function Pulihkan({ awalan }: { awalan: '/api/setup' | '/api/admin' }) {
  const [berkas, setBerkas] = useState<File | null>(null);
  const [periksa, setPeriksa] = useState<HasilPeriksa | null>(null);
  const [hasil, setHasil] = useState<HasilPulih | null>(null);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  async function jalan<T>(kerja: () => Promise<T>, pasang: (h: T) => void) {
    setGalat('');
    setSibuk(true);
    try { pasang(await kerja()); }
    catch (e) { setGalat((e as Error).message); }
    finally { setSibuk(false); }
  }

  if (hasil) {
    return (
      <section className="kartu">
        <h2>Pemulihan selesai</h2>
        <ul className="poin">
          <li>{hasil.tabel.length} tabel dipulihkan: {hasil.tabel.join(', ')}</li>
          <li>{hasil.pernyataanDijalankan} pernyataan dijalankan</li>
          <li>{hasil.berkasDipulihkan} berkas unggahan dikembalikan ke disk</li>
          <li>
            Keadaan sebelumnya disimpan sebagai{' '}
            <span className="kode">{hasil.cadanganSebelumnya}</span> di folder cadangan server.
          </li>
        </ul>
        <div className="kartu kartu-peringatan">
          <p style={{ margin: 0 }}>
            Akun admin ikut tergantikan oleh akun dari cadangan. Kalau akun Anda sekarang
            tidak ada di cadangan itu, Anda akan diminta masuk lagi &mdash; pakai email dan
            kata sandi dari server lama.
          </p>
        </div>
        <div className="tombol-baris" style={{ justifyContent: 'flex-start' }}>
          <a className="tombol tombol-utama" href="/admin">Buka dashboard</a>
        </div>
      </section>
    );
  }

  return (
    <section className="kartu kartu-peringatan">
      <h2>Pulihkan dari cadangan penuh</h2>
      <p className="petunjuk">
        Unggah berkas <span className="kode">simpel-penuh-....tar.gz</span> dari server lama.
        Seluruh pengajuan, riwayat, OPD, akun admin, pengaturan, dan berkas unggahan
        dikembalikan persis seperti saat cadangan dibuat.
      </p>
      <p className="galat">
        <strong>Ini menghapus seluruh isi database sekarang, lalu menggantinya.</strong>{' '}
        Sebelum menimpa, sistem menyalin keadaan sekarang ke folder cadangan server &mdash;
        tapi jangan bergantung pada itu: unduh dulu cadangan penuh yang sekarang bila
        datanya masih Anda butuhkan.
      </p>

      {galat && <p className="galat">{galat}</p>}

      <label>
        Berkas cadangan
        <input type="file" accept=".gz,.tgz,.tar,application/gzip,application/x-tar"
               onChange={(e) => {
                 setBerkas(e.target.files?.[0] ?? null);
                 setPeriksa(null);
               }} />
        <span className="petunjuk">Maksimal 200 MB.</span>
      </label>

      {berkas && (
        <p className="petunjuk">
          Terpilih: <strong>{berkas.name}</strong> &middot; {formatUkuran(berkas.size)}
        </p>
      )}

      <div className="tombol-baris" style={{ justifyContent: 'flex-start' }}>
        <button className="tombol tombol-utama" disabled={sibuk || !berkas}
                onClick={() => jalan(
                  () => kirimBerkas<HasilPeriksa>(`${awalan}/pulihkan/periksa`, berkas!),
                  setPeriksa
                )}>
          {sibuk ? 'Memeriksa…' : 'Periksa isi cadangan →'}
        </button>
      </div>

      {periksa && (
        <div className={`kartu ${periksa.sah ? '' : 'kartu-peringatan'}`}>
          <p className={periksa.sah ? '' : 'galat'}>{periksa.pesan}</p>
          {periksa.sah && (
            <>
              <ul className="poin">
                {periksa.dibuat && <li>Dibuat: {periksa.dibuat}</li>}
                <li>Tabel: {periksa.tabel?.join(', ')}</li>
                <li>{periksa.jumlahBerkas} berkas unggahan ikut di dalamnya</li>
              </ul>
              <div className="tombol-baris" style={{ justifyContent: 'flex-start' }}>
                <button className="tombol tombol-utama" disabled={sibuk}
                        onClick={() => {
                          if (!confirm(
                            'Seluruh data yang ada sekarang akan DIHAPUS dan diganti isi '
                            + 'cadangan ini.\n\nLanjutkan?'
                          )) return;
                          void jalan(
                            () => kirimBerkas<HasilPulih>(`${awalan}/pulihkan`, berkas!),
                            setHasil
                          );
                        }}>
                  {sibuk ? 'Memulihkan…' : 'Hapus data sekarang lalu pulihkan'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
