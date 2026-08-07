import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { panggilApi, type DataMonitoring } from '../lib/api';
import { formatTanggal } from '../lib/format';
import { KotakHitungan } from '../komponen/KotakHitungan';
import { LencanaStatus } from '../komponen/LencanaStatus';

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
      <div className="kartu kartu-peringatan">
        <h2>Data tidak bisa dibaca</h2>
        <p>{galat}</p>
        <p className="petunjuk">
          Bila ini berlanjut, hubungi Bagian Hukum.
        </p>
      </div>
    );
  }

  if (!data) return <p className="petunjuk">Memuat&hellip;</p>;

  const h = data.hitungan;

  return (
    <>
      <h1>Monitoring Raperda/Raperbup</h1>

      <div className="hitungan">
        <KotakHitungan angka={h.TOTAL} label="Total" />
        <KotakHitungan angka={h.PROSES} label="Proses" jenis="proses" />
        <KotakHitungan angka={h.SELESAI} label="Selesai" jenis="selesai" />
        <KotakHitungan angka={h.DIKEMBALIKAN} label="Kembali" jenis="dikembalikan" />
      </div>

      <div className="saringan">
        <input
          type="search"
          placeholder="Cari judul, OPD, atau nomor&hellip;"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
        <select value={jenis} onChange={(e) => setJenis(e.target.value)}>
          <option value="">Semua jenis</option>
          <option value="Daerah">Peraturan Daerah</option>
          <option value="Bupati">Peraturan Bupati</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua status</option>
          <option value="PROSES">PROSES</option>
          <option value="SELESAI">SELESAI</option>
          <option value="DIKEMBALIKAN">DIKEMBALIKAN</option>
        </select>
        <select value={tahun} onChange={(e) => setTahun(e.target.value)}>
          <option value="">Semua tahun</option>
          {data.tahun.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <p className="petunjuk">
        {hasil.length} dari {data.daftar.length} pengajuan
      </p>

      {hasil.length === 0 ? (
        <p className="petunjuk">Tidak ada pengajuan yang cocok.</p>
      ) : (
        hasil.map((p) => (
          <Link key={p.nomor} to={`/detail/${p.nomor}`} className="kartu kartu-tautan">
            <div className="baris-atas">
              <span className="kode">{p.nomor}</span>
              <LencanaStatus status={p.status} />
            </div>
            <p className="judul-pengajuan">{p.judul}</p>
            <p className="meta">{p.opd} &middot; {formatTanggal(p.masuk)}</p>
            {p.terakhir && (
              <p className="terakhir">&#9656; Terakhir: {p.terakhir.keterangan}</p>
            )}
          </Link>
        ))
      )}
    </>
  );
}
