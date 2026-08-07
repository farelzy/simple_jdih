import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Kerangka } from './komponen/Kerangka';
import { Monitoring } from './halaman/Monitoring';
import { Detail } from './halaman/Detail';

/** Sementara, sampai Tugas 10 selesai. */
function SegeraHadir({ judul }: { judul: string }) {
  return (
    <div className="rounded-[10px] border border-garis border-l-4 border-l-proses bg-white p-4">
      <h2 className="mb-2 text-lg font-semibold">{judul}</h2>
      <p className="text-sm">
        Bagian ini belum selesai dibangun. Untuk sementara, pengajuan masih lewat
        Google Form yang lama.
      </p>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Kerangka />}>
          <Route index element={<Monitoring />} />
          <Route path="detail/:nomor" element={<Detail />} />
          <Route path="ajukan" element={<SegeraHadir judul="Form pengajuan" />} />
          <Route path="*" element={<SegeraHadir judul="Halaman tidak ditemukan" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
