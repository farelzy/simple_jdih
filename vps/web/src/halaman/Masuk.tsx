import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { panggilApi } from '../lib/api';

export function Masuk() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sandi, setSandi] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setGalat('');
    setSibuk(true);
    try {
      await panggilApi('/api/auth/masuk', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), sandi })
      });
      navigate('/admin');
    } catch (err) {
      setGalat((err as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="wadah-sempit">
      <h1>Masuk</h1>
      <form className="kartu" onSubmit={kirim}>
        <p className="petunjuk">
          Hanya untuk Bagian Hukum. OPD tidak perlu akun &mdash; pengajuan dan
          monitoring terbuka tanpa masuk.
        </p>

        {galat && <p className="galat">{galat}</p>}

        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                 autoComplete="username" required />
        </label>
        <label>
          Kata sandi
          <input type="password" value={sandi} onChange={(e) => setSandi(e.target.value)}
                 autoComplete="current-password" required />
        </label>

        <div className="tombol-baris">
          <button type="submit" className="tombol tombol-utama" disabled={sibuk}>
            {sibuk ? 'Memeriksa…' : 'Masuk'}
          </button>
        </div>
      </form>
    </div>
  );
}
