import { Link, NavLink, Outlet } from 'react-router-dom';

const kelasNav = ({ isActive }: { isActive: boolean }) => (isActive ? 'aktif' : '');

/**
 * Tautan ke Google Form pengajuan. Disetel lewat environment, bukan ditulis
 * mati di sini: form bisa diganti tanpa perlu membangun ulang situsnya.
 */
const URL_FORM = import.meta.env.VITE_URL_FORM as string | undefined;

export function Kerangka() {
  return (
    <>
      <header className="kepala">
        <div className="wadah kepala-isi">
          <Link to="/" className="merek">
            <span className="merek-nama">SIMPEL</span>
            <span className="merek-sub">Hukum Brebes</span>
          </Link>
          <nav className="nav">
            <NavLink to="/" end className={kelasNav}>Monitoring</NavLink>
            {URL_FORM && (
              // Pengajuan tetap lewat Google Form; situs ini hanya memantau.
              <a href={URL_FORM} target="_blank" rel="noopener noreferrer">Ajukan</a>
            )}
          </nav>
        </div>
      </header>

      <main className="isi">
        <div className="wadah">
          <Outlet />
        </div>
      </main>

      <footer className="kaki">
        <div className="wadah kaki-isi">
          <p>Bagian Hukum Sekretariat Daerah Kabupaten Brebes</p>
          <p>Narahubung: Mayasari &middot; WA 0878 2799 2724</p>
        </div>
      </footer>
    </>
  );
}
