import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Kerangka } from './components/Kerangka';
import { Monitoring } from './pages/Monitoring';
import { Detail } from './pages/Detail';
import { Setup } from './pages/Setup';
import { Masuk } from './pages/Masuk';
import { Admin } from './pages/Admin';
import { Pengajuan } from './pages/Pengajuan';
import { Panduan } from './pages/Panduan';
import { TutorialAdmin } from './pages/TutorialAdmin';
import { panggilApi } from './lib/api';

/** Sementara, sampai halaman terkait selesai dibangun. */
function SegeraHadir({ judul }: { judul: string }) {
  return (
    <div className="kartu kartu-peringatan">
      <h2>{judul}</h2>
      <p>
        Bagian ini belum selesai dibangun. Untuk sementara, pengajuan masih lewat
        Google Form yang lama.
      </p>
    </div>
  );
}

/**
 * Selama sistem belum punya admin, seluruh halaman dialihkan ke penyiapan.
 * Tanpa ini, pengunjung pertama hanya melihat monitoring kosong tanpa petunjuk
 * apa pun tentang apa yang harus dilakukan.
 */
function Pengalih({ anak }: { anak: React.ReactNode }) {
  const [perluSetup, setPerluSetup] = useState<boolean | null>(null);

  useEffect(() => {
    panggilApi<{ perluSetup: boolean }>('/api/setup/status')
      .then((s) => setPerluSetup(s.perluSetup))
      .catch(() => setPerluSetup(false));   // server bermasalah: jangan sembunyikan halaman
  }, []);

  if (perluSetup === null) return null;
  if (perluSetup) return <Navigate to="/setup" replace />;
  return <>{anak}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Kerangka />}>
          <Route index element={<Pengalih anak={<Monitoring />} />} />
          <Route path="detail/:nomor" element={<Detail />} />
          <Route path="ajukan" element={<Pengajuan />} />
          <Route path="panduan" element={<Panduan />} />
          <Route path="admin" element={<Admin />} />
          <Route path="admin/tutorial" element={<TutorialAdmin />} />
          <Route path="masuk" element={<Masuk />} />
          <Route path="setup" element={<Setup />} />
          <Route path="*" element={<SegeraHadir judul="Halaman tidak ditemukan" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
