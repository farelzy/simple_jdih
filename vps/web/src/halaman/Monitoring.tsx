import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { panggilApi, type DataMonitoring } from '../lib/api';
import { formatTanggal } from '../lib/format';
import { KotakHitungan } from '../komponen/KotakHitungan';
import { LencanaStatus } from '../komponen/LencanaStatus';

const KELAS_INPUT =
  'w-full rounded-[10px] border border-garis bg-white px-2.5 py-2 text-sm ' +
  'outline-none focus:border-biru-utama focus:ring-3 focus:ring-biru-utama/15';

export function Monitoring() {
  const [data, setData] = useState<DataMonitoring | null>(null);
  const [galat, setGalat] = useState('');
  const [cari, setCari] = useState('');
  const [jenis, setJenis] = useState('');
  const [status, setStatus] = useState('');
  const [tahun, setTahun] = useState('');

  useEffect(() => {
    panggilApi<DataMonitoring>('/api/publik/monitoring')
      .then(setData)
      .catch((e: Error) => setGalat(e.message));
  }, []);

  // Penyaringan dilakukan di sisi klien: jumlah barisnya ratusan, bukan ribuan,
  // jadi memuat sekali lalu menyaring di memori terasa seketika.
  const hasil = useMemo(() => {
    if (!data) return [];
    const q = cari.trim().toLowerCase();
    return data.daftar.filter((p) => {
      if (jenis && p.jenis_peraturan !== jenis) return false;
      if (status && p.status !== status) return false;
      if (tahun && p.masuk.slice(0, 4) !== tahun) return false;
      if (q && !`${p.judul} ${p.opd} ${p.nomor}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, cari, jenis, status, tahun]);

  if (galat) {
    return (
      <div className="rounded-[10px] border border-garis border-l-4 border-l-proses bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold">Data tidak bisa dibaca</h2>
        <p className="text-sm">{galat}</p>
      </div>
    );
  }

  if (!data) return <p className="text-sm text-teks-lemah">Memuat…</p>;

  const h = data.hitungan;

  return (
    <>
      <h1 className="mb-4 text-xl font-bold">Monitoring Raperda/Raperbup</h1>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KotakHitungan angka={h.TOTAL} label="Total" jenis="total" />
        <KotakHitungan angka={h.PROSES} label="Proses" jenis="proses" />
        <KotakHitungan angka={h.SELESAI} label="Selesai" jenis="selesai" />
        <KotakHitungan angka={h.DIKEMBALIKAN} label="Kembali" jenis="dikembalikan" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          className={`${KELAS_INPUT} flex-1 basis-56`}
          placeholder="Cari judul, OPD, atau nomor…"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
        <select className={`${KELAS_INPUT} sm:w-auto`} value={jenis} onChange={(e) => setJenis(e.target.value)}>
          <option value="">Semua jenis</option>
          <option value="Daerah">Peraturan Daerah</option>
          <option value="Bupati">Peraturan Bupati</option>
        </select>
        <select className={`${KELAS_INPUT} sm:w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua status</option>
          <option value="PROSES">PROSES</option>
          <option value="SELESAI">SELESAI</option>
          <option value="DIKEMBALIKAN">DIKEMBALIKAN</option>
        </select>
        <select className={`${KELAS_INPUT} sm:w-auto`} value={tahun} onChange={(e) => setTahun(e.target.value)}>
          <option value="">Semua tahun</option>
          {data.tahun.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <p className="mb-3 text-xs text-teks-lemah">
        {hasil.length} dari {data.daftar.length} pengajuan
      </p>

      {hasil.length === 0 ? (
        <p className="text-sm text-teks-lemah">Tidak ada pengajuan yang cocok.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {hasil.map((p) => (
            <Link
              key={p.nomor}
              to={`/detail/${p.nomor}`}
              className="block rounded-[10px] border border-garis bg-white p-4 no-underline
                         shadow-[0_1px_3px_rgba(26,43,60,0.08)] transition
                         hover:border-biru-utama hover:shadow-[0_3px_10px_rgba(26,43,60,0.12)]"
            >
              <div className="mb-1.5 flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                <span className="font-mono text-[13px] text-biru-tua">{p.nomor}</span>
                <LencanaStatus status={p.status} />
              </div>
              <p className="mb-1.5 font-semibold text-teks-utama">{p.judul}</p>
              <p className="text-[13px] text-teks-lemah">
                {p.opd} &middot; {formatTanggal(p.masuk)}
              </p>
              {p.terakhir && (
                <p className="mt-2 border-t border-garis pt-2 text-[13px] text-teks-utama">
                  &#9656; Terakhir: {p.terakhir.keterangan}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
