import { Link, NavLink, Outlet } from 'react-router-dom';

const kelasNav = ({ isActive }: { isActive: boolean }) => (isActive ? 'aktif' : '');

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
            <NavLink to="/ajukan" className={kelasNav}>Ajukan</NavLink>
            <NavLink to="/panduan" className={kelasNav}>Panduan</NavLink>
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
