import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { panggilApi } from '../lib/api';
import {
  PemilihSumber, periksaSumber, jalankanSumber, sumberSiap,
  type Sumber, type HasilPeriksa, type LaporanMigrasi
} from '../components/SumberMigrasi';
import { KolomSandi } from '../components/KolomSandi';
import { Pulihkan } from '../components/Pulihkan';


export function Setup() {
  const navigate = useNavigate();
  const [langkah, setLangkah] = useState(1);
  const [perluSetup, setPerluSetup] = useState<boolean | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  // Langkah 1
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [nama, setNama] = useState('');
  const [sandi, setSandi] = useState('');

  // Langkah 2
  const [sumber, setSumber] = useState<Sumber>({ jenis: 'tautan', tautan: '' });
  const [periksa, setPeriksa] = useState<HasilPeriksa | null>(null);
  const [laporan, setLaporan] = useState<LaporanMigrasi | null>(null);

  useEffect(() => {
    panggilApi<{ perluSetup: boolean }>('/api/setup/status')
      .then((s) => setPerluSetup(s.perluSetup))
      .catch((e: Error) => setGalat(e.message));
  }, []);

  async function buatAdmin() {
    setGalat('');
    setSibuk(true);
    try {
      await panggilApi('/api/setup/admin', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim(), email: email.trim(), nama, sandi })
      });
      setLangkah(2);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  async function periksaSheet() {
    setGalat('');
    setLaporan(null);
    setSibuk(true);
    try {
      setPeriksa(await periksaSumber('/api/setup', sumber));
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  async function migrasi(ujiCoba: boolean) {
    setGalat('');
    setSibuk(true);
    try {
      setLaporan(await jalankanSumber('/api/setup', sumber, ujiCoba));
      if (!ujiCoba) setLangkah(3);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  if (perluSetup === null) return <p className="petunjuk">Memuat&hellip;</p>;

  if (perluSetup === false && langkah === 1) {
    return (
      <div className="kartu kartu-peringatan">
        <h2>Sistem sudah disiapkan</h2>
        <p>Admin pertama sudah dibuat, jadi halaman penyiapan ditutup.</p>
        <div className="tombol-baris">
          <button className="tombol tombol-utama" onClick={() => navigate('/masuk')}>
            Masuk sebagai admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wadah-sempit">
      <h1>Penyiapan SIMPEL</h1>

      <ol className="langkah">
        <li className={langkah >= 1 ? 'aktif' : ''}>Admin</li>
        <li className={langkah >= 2 ? 'aktif' : ''}>Data lama</li>
        <li className={langkah >= 3 ? 'aktif' : ''}>Selesai</li>
      </ol>

      {galat && (
        <div className="kartu kartu-peringatan">
          <p className="galat">{galat}</p>
        </div>
      )}

      {langkah === 1 && (
        <section className="kartu">
          <h2>1. Buat akun admin pertama</h2>
          <p className="petunjuk">
            Halaman ini terbuka di internet, jadi dijaga token. Token dicetak server
            ke log saat pertama hidup &mdash; baca dengan menjalankan di VPS:
          </p>
          <p><code>sudo journalctl -u simpel -n 40 | grep -A2 "BELUM DISIAPKAN"</code></p>

          <label>
            Token penyiapan
            <input value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
          </label>
          <label>
            Email admin
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                   placeholder="hukum@brebeskab.go.id" autoComplete="username" />
          </label>
          <label>
            Nama
            <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Bagian Hukum" />
          </label>
          <KolomSandi label="Kata sandi" nilai={sandi} ubah={setSandi}
                      autoComplete="new-password" petunjuk="Minimal 8 karakter." />

          <div className="tombol-baris">
            <button className="tombol tombol-utama" onClick={buatAdmin} disabled={sibuk}>
              {sibuk ? 'Menyimpan…' : 'Buat admin lalu lanjut →'}
            </button>
          </div>
        </section>
      )}

      {langkah === 2 && (
        <section className="kartu">
          <h2>2. Pindahkan data dari spreadsheet lama</h2>
          <p className="petunjuk">
            Data spreadsheet <em>PERMOHONAN RAPERDA/RAPERBUP</em> dipindahkan ke sini.
            Spreadsheet aslinya tidak akan disentuh &mdash; hanya dibaca.
          </p>

          <PemilihSumber nilai={sumber} ubah={setSumber} saatBerubah={() => setPeriksa(null)} />

          <div className="tombol-baris">
            <button className="tombol" onClick={() => setLangkah(3)} disabled={sibuk}>
              Lewati, isi manual nanti
            </button>
            <button className="tombol tombol-utama" onClick={periksaSheet} disabled={sibuk || !sumberSiap(sumber)}>
              {sibuk ? 'Memeriksa…' : 'Periksa data →'}
            </button>
          </div>

          {periksa && (
            <div className={`kartu ${periksa.sah ? '' : 'kartu-peringatan'}`}>
              <p className={periksa.sah ? '' : 'galat'}>{periksa.pesan}</p>
              {periksa.sah && (
                <>
                  <p className="petunjuk">
                    Coba dulu tanpa menulis apa pun. Perhatikan peringatan kolom
                    riwayat &mdash; itu satu-satunya tanda ada kalimat yang berubah bentuk.
                  </p>
                  <div className="tombol-baris">
                    <button className="tombol" onClick={() => migrasi(true)} disabled={sibuk}>
                      Uji coba
                    </button>
                    <button className="tombol tombol-utama" onClick={() => migrasi(false)} disabled={sibuk}>
                      Jalankan migrasi
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {laporan && <Laporan laporan={laporan} />}
        </section>
      )}

      {langkah === 2 && <Pulihkan awalan="/api/setup" />}

      {langkah === 3 && (
        <section className="kartu">
          <h2>3. Selesai</h2>
          {laporan && <Laporan laporan={laporan} />}
          <p>Sistem siap dipakai.</p>
          <div className="tombol-baris">
            <button className="tombol" onClick={() => navigate('/admin')}>Buka dashboard</button>
            <button className="tombol tombol-utama" onClick={() => navigate('/')}>Buka monitoring</button>
          </div>
        </section>
      )}
    </div>
  );
}

function Laporan({ laporan: l }: { laporan: LaporanMigrasi }) {
  return (
    <div className={`kartu ${l.selisihKolom16.length ? 'kartu-peringatan' : ''}`}>
      <h3>{l.ujiCoba ? 'Hasil uji coba — belum ada yang ditulis' : 'Migrasi selesai'}</h3>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li>{l.barisDibaca} baris dibaca</li>
        <li>{l.barisDisisipkan} pengajuan {l.ujiCoba ? 'akan disimpan' : 'disimpan'}</li>
        <li>{l.riwayatTerurai} baris riwayat terurai rapi</li>
        <li>{l.riwayatLainnya} baris masuk sebagai LAINNYA, teks aslinya utuh</li>
        <li>{l.berkasTertaut} tautan berkas disalin apa adanya</li>
        {l.dilewati.length > 0 && <li>{l.dilewati.length} baris dilewati karena sudah ada</li>}
      </ul>

      {l.opdPerluPeriksa.length > 0 && (
        <p className="petunjuk">
          <strong>Perlu diperiksa manusia</strong> &mdash; nama OPD berikut belum ada di
          daftar baku, jadi tidak dipetakan: {l.opdPerluPeriksa.join(', ')}
        </p>
      )}

      {l.selisihKolom16.length > 0 ? (
        <p className="galat">
          Perhatian: {l.selisihKolom16.length} pengajuan menghasilkan kolom riwayat yang
          berbeda dari aslinya ({l.selisihKolom16.join(', ')}). Bandingkan dulu dengan
          spreadsheet sebelum menganggap migrasi beres.
        </p>
      ) : (
        <p>Kolom riwayat hasil susun ulang sama persis dengan aslinya.</p>
      )}
    </div>
  );
}
