import { Link, NavLink, Outlet } from 'react-router-dom';

const tautanNav = ({ isActive }: { isActive: boolean }) =>
  `rounded-[10px] px-3 py-1.5 text-sm ${
    isActive
      ? 'bg-biru-muda font-semibold text-biru-tua'
      : 'text-teks-lemah hover:bg-biru-muda'
  }`;

export function Kerangka() {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-garis bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-2.5">
          <Link to="/" className="flex items-baseline gap-1.5 text-biru-tua no-underline">
            <span className="font-bold tracking-wide">SIMPEL</span>
            <span className="text-xs text-teks-lemah">Hukum Brebes</span>
          </Link>
          <nav className="ml-auto flex gap-1">
            <NavLink to="/" end className={tautanNav}>Monitoring</NavLink>
            <NavLink to="/ajukan" className={tautanNav}>Ajukan</NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-garis bg-white py-5 text-sm">
        <div className="mx-auto max-w-5xl px-4">
          <p>Bagian Hukum Sekretariat Daerah Kabupaten Brebes</p>
          <p className="text-xs text-teks-lemah">
            Narahubung: Mayasari &middot; WA 0878 2799 2724
          </p>
        </div>
      </footer>
    </>
  );
}
