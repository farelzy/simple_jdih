import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { panggilApi, type DataDetail } from '../lib/api';
import { formatTanggal, formatUkuran } from '../lib/format';
import { LencanaStatus } from '../components/LencanaStatus';
import { LiniMasa } from '../components/LiniMasa';

export function Detail() {
  const { nomor } = useParams<{ nomor: string }>();
  const [data, setData] = useState<DataDetail | null>(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    setData(null);
    setGalat('');
    panggilApi<DataDetail>(`/api/publik/detail/${encodeURIComponent(nomor ?? '')}`)
      .then(setData)
      .catch((e: Error) => setGalat(e.message));
  }, [nomor]);

  if (galat) {
    return (
      <div className="kartu kartu-peringatan">
        <h2>Pengajuan tidak ditemukan</h2>
        <p>
          Nomor <span className="kode">{nomor}</span> tidak ada dalam data.
        </p>
        <div className="tombol-baris">
          <Link to="/" className="tombol">Kembali ke monitoring</Link>
        </div>
      </div>
    );
  }

  if (!data) return <p className="petunjuk">Memuat&hellip;</p>;

  const p = data.pengajuan;

  return (
    <>
      <div className="baris-atas">
        <span className="kode">{p.nomor}</span>
        <LencanaStatus status={p.status} />
      </div>

      <h1>{p.judul}</h1>
      <p className="meta">
        {p.opd} &middot; Raper{p.jenis_peraturan === 'Daerah' ? 'da' : 'bup'} &middot;{' '}
        Masuk {formatTanggal(p.masuk)}
      </p>

      {p.keterangan && (
        <div className="kartu kartu-peringatan">
          <h3>Keterangan</h3>
          <p>{p.keterangan}</p>
        </div>
      )}

      <section className="kartu">
        <h2>Riwayat Proses</h2>
        <LiniMasa kejadian={data.riwayat} />
      </section>

      <section className="kartu">
        <h2>Berkas</h2>
        {!data.boleh.berkas ? (
          <p className="petunjuk">
            Tautan berkas hanya bisa dibuka oleh pemohon dan Bagian Hukum.
          </p>
        ) : data.berkas.length === 0 ? (
          <p className="petunjuk">Tidak ada berkas terlampir.</p>
        ) : (
          <ul className="berkas">
            {data.berkas.map((b) => (
              <li key={b.url}>
                <span className="berkas-nama">{b.nama}</span>
                <span className="berkas-ukuran">{formatUkuran(b.ukuran)}</span>
                <a href={b.url} target="_blank" rel="noopener noreferrer" className="tombol">
                  Buka
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="kartu">
        <h2>Pemohon</h2>
        <p>
          {p.nama_pemohon}
          <br />
          <span className="petunjuk">{p.wa_pemohon}</span>
        </p>
      </section>

      <Link to="/" className="tombol">&larr; Kembali</Link>
    </>
  );
}
