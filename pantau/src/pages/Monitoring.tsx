import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePantau } from '../lib/data';
import { formatTanggal } from '../lib/format';
import { KotakHitungan } from '../components/KotakHitungan';
import { LencanaStatus } from '../components/LencanaStatus';
import { JejakTahap } from '../components/JejakTahap';
import { StatusData } from '../components/StatusData';

const KELAS_STATUS: Record<string, string> = {
  PROSES: 's-proses',
  SELESAI: 's-selesai',
  DIKEMBALIKAN: 's-dikembalikan'
};

export function Monitoring() {
  const { data, galat, menyegarkan } = usePantau();
  const [cari, setCari] = useState('');
  const [jenis, setJenis] = useState('');
  const [status, setStatus] = useState('');
  const [tahun, setTahun] = useState('');

  // Penyaringan di sisi klien: barisnya puluhan, bukan ribuan, jadi memuat
  // sekali lalu menyaring di memori terasa seketika.
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

  if (galat && !data) {
    return (
      <div className="kartu kartu-peringatan">
        <h2>Data tidak bisa dibaca</h2>
        <p>{galat}</p>
        <p className="petunjuk">Bila ini berlanjut, hubungi Bagian Hukum.</p>
      </div>
    );
  }

  if (!data) return <p className="petunjuk">Memuat&hellip;</p>;

  const h = data.hitungan;

  return (
    <>
      <header className="sambutan">
        <h1>SIMPEL HUKUM BREBES</h1>
        <p>
          Sistem Informasi dan Manajemen Peraturan dan Pemantauan Proses Hukum
          Raperda/Raperbup di Bagian Hukum Sekretariat Daerah Kabupaten Brebes
        </p>
      </header>

      <h2 className="judul-bagian">Monitoring Raperda/Raperbup</h2>

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

      <StatusData ditarik={data.ditarik} menyegarkan={menyegarkan} galat={galat} />

      <p className="petunjuk">
        {hasil.length} dari {data.daftar.length} pengajuan
      </p>

      {hasil.length === 0 ? (
        <p className="petunjuk">Tidak ada pengajuan yang cocok.</p>
      ) : (
        hasil.map((p) => (
          <Link
            key={p.nomor}
            to={`/detail/${encodeURIComponent(p.nomor)}`}
            className={`kartu kartu-tautan kartu-status ${KELAS_STATUS[p.status] ?? ''}`}
          >
            <div className="baris-atas">
              <span className="kode">{p.nomor}</span>
              <LencanaStatus status={p.status} />
            </div>
            <p className="judul-pengajuan">{p.judul}</p>
            <p className="meta">{p.opd} &middot; {formatTanggal(p.masuk)}</p>
            <JejakTahap
              indeks={p.tahap_indeks}
              total={p.tahap_total}
              catatan={p.terakhir?.keterangan}
            />
          </Link>
        ))
      )}
    </>
  );
}
