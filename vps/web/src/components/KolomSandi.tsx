/**
 * Kotak isian kata sandi dengan tombol lihat.
 *
 * Kata sandi admin di sini panjang dan bercampur simbol, dan salah ketik baru
 * ketahuan setelah ditolak -- yang pada form "ganti kata sandi" berarti menebak
 * mana dari dua kolom yang meleset. Tombol lihat menghilangkan tebakan itu.
 *
 * Ikonnya SVG sebaris, bukan pustaka ikon: satu ikon tidak sepadan dengan
 * tambahan berkas yang harus ikut terunduh pengunjung.
 */
import { useId, useState } from 'react';

interface Props {
  label: string;
  nilai: string;
  ubah: (nilai: string) => void;
  autoComplete?: string;
  petunjuk?: string;
  wajib?: boolean;
}

export function KolomSandi({ label, nilai, ubah, autoComplete, petunjuk, wajib }: Props) {
  const [terlihat, setTerlihat] = useState(false);
  const id = useId();

  return (
    <label htmlFor={id}>
      {label}
      <span className="kolom-sandi">
        <input
          id={id}
          type={terlihat ? 'text' : 'password'}
          value={nilai}
          onChange={(e) => ubah(e.target.value)}
          autoComplete={autoComplete}
          required={wajib}
        />
        <button
          type="button"
          className="sandi-lihat"
          onClick={() => setTerlihat((t) => !t)}
          // Tombol ini bukan bagian dari alur pengisian; menekan Tab dari kolom
          // sandi harus langsung sampai ke tombol kirim.
          tabIndex={-1}
          aria-label={terlihat ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
          aria-pressed={terlihat}
          title={terlihat ? 'Sembunyikan' : 'Lihat'}
        >
          {terlihat ? <IkonTutup /> : <IkonMata />}
        </button>
      </span>
      {petunjuk && <span className="petunjuk">{petunjuk}</span>}
    </label>
  );
}

function IkonMata() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IkonTutup() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
