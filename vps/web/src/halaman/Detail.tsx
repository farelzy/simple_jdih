import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { panggilApi, type DataDetail } from '../lib/api';
import { formatTanggal, formatUkuran } from '../lib/format';
import { LencanaStatus } from '../komponen/LencanaStatus';
import { LiniMasa } from '../komponen/LiniMasa';

const KARTU = 'mb-4 rounded-[10px] border border-garis bg-white p-4 shadow-[0_1px_3px_rgba(26,43,60,0.08)]';

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
      <div className={`${KARTU} border-l-4 border-l-proses`}>
        <h2 className="mb-2 text-lg font-semibold">Pengajuan tidak ditemukan</h2>
        <p className="mb-3 text-sm">
          Nomor <span className="font-mono text-biru-tua">{nomor}</span> tidak ada dalam data.
        </p>
        <Link
          to="/"
          className="inline-block rounded-[10px] border border-garis px-4 py-2 text-sm no-underline
                     text-teks-utama hover:border-biru-utama"
        >
          Kembali ke monitoring
        </Link>
      </div>
    );
  }

  if (!data) return <p className="text-sm text-teks-lemah">Memuat…</p>;

  const p = data.pengajuan;

  return (
    <>
      <div className="mb-1.5 flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
        <span className="font-mono text-[13px] text-biru-tua">{p.nomor}</span>
        <LencanaStatus status={p.status} />
      </div>

      <h1 className="mb-1.5 text-xl font-bold">{p.judul}</h1>
      <p className="mb-4 text-[13px] text-teks-lemah">
        {p.opd} &middot; Raper{p.jenis_peraturan === 'Daerah' ? 'da' : 'bup'} &middot;{' '}
        Masuk {formatTanggal(p.masuk)}
      </p>

      {p.keterangan && (
        <div className={`${KARTU} border-l-4 border-l-proses`}>
          <h3 className="mb-1.5 font-semibold">Keterangan</h3>
          <p className="text-sm">{p.keterangan}</p>
        </div>
      )}

      <section className={KARTU}>
        <h2 className="mb-3 text-base font-semibold">Riwayat Proses</h2>
        <LiniMasa kejadian={data.riwayat} />
      </section>

      <section className={KARTU}>
        <h2 className="mb-3 text-base font-semibold">Berkas</h2>
        {!data.boleh.berkas ? (
          <p className="text-sm text-teks-lemah">
            Tautan berkas hanya bisa dibuka oleh pemohon dan Bagian Hukum.
          </p>
        ) : data.berkas.length === 0 ? (
          <p className="text-sm text-teks-lemah">Tidak ada berkas terlampir.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {data.berkas.map((b) => (
              <li
                key={b.url}
                className="flex items-center gap-2.5 border-b border-garis py-2.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1 text-sm break-words">{b.nama}</span>
                <span className="text-xs whitespace-nowrap text-teks-lemah">
                  {formatUkuran(b.ukuran)}
                </span>
                <a
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-[10px] border border-garis px-3 py-1.5 text-sm no-underline
                             text-teks-utama hover:border-biru-utama"
                >
                  Buka
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={KARTU}>
        <h2 className="mb-3 text-base font-semibold">Pemohon</h2>
        <p className="text-sm">
          {p.nama_pemohon}
          <br />
          <span className="text-teks-lemah">{p.wa_pemohon}</span>
        </p>
      </section>

      <Link
        to="/"
        className="inline-block rounded-[10px] border border-garis bg-white px-4 py-2 text-sm
                   no-underline text-teks-utama hover:border-biru-utama"
      >
        &larr; Kembali
      </Link>
    </>
  );
}
