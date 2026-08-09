import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Kerangka } from './komponen/Kerangka';
import { Monitoring } from './halaman/Monitoring';
import { Detail } from './halaman/Detail';
import { Setup } from './halaman/Setup';
import { Masuk } from './halaman/Masuk';
import { Admin } from './halaman/Admin';
import { Pengajuan } from './halaman/Pengajuan';
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
          <Route path="admin" element={<Admin />} />
          <Route path="masuk" element={<Masuk />} />
          <Route path="setup" element={<Setup />} />
          <Route path="*" element={<SegeraHadir judul="Halaman tidak ditemukan" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
