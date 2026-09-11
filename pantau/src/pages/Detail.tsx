import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePantau } from '../lib/data';
import { formatTanggal } from '../lib/format';
import { LencanaStatus } from '../components/LencanaStatus';
import { LiniMasa } from '../components/LiniMasa';
import { JejakTahap } from '../components/JejakTahap';
import { StatusData } from '../components/StatusData';

export function Detail() {
  const { nomor } = useParams<{ nomor: string }>();
  // Kumpulan yang sama dengan monitoring, jadi berpindah halaman tidak
  // menarik apa pun dari jaringan -- dan penyegaran berkala ikut berjalan
  // di sini, sehingga status yang diubah Bagian Hukum muncul sendiri.
  const { data, galat, menyegarkan } = usePantau();
  const p = useMemo(
    () => data?.daftar.find((x) => x.nomor === nomor) ?? null,
    [data, nomor]
  );

  if (!data && !galat) return <p className="petunjuk">Memuat&hellip;</p>;

  if (galat && !data) {
    return (
      <div className="kartu kartu-peringatan">
        <h2>Data tidak bisa dibaca</h2>
        <p>{galat}</p>
        <div className="tombol-baris">
          <Link to="/" className="tombol">Kembali ke monitoring</Link>
        </div>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="kartu kartu-peringatan">
        <h2>Pengajuan tidak ditemukan</h2>
        <p>Nomor <span className="kode">{nomor}</span> tidak ada dalam data.</p>
        <div className="tombol-baris">
          <Link to="/" className="tombol">Kembali ke monitoring</Link>
        </div>
      </div>
    );
  }

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

      <div className="kartu jejak-kartu">
        <JejakTahap indeks={p.tahap_indeks} total={p.tahap_total} />
      </div>

      <StatusData ditarik={data?.ditarik} menyegarkan={menyegarkan} galat={galat} />

      {p.keterangan && (
        <div className="kartu kartu-peringatan">
          <h3>Keterangan</h3>
          <p>{p.keterangan}</p>
        </div>
      )}

      <section className="kartu">
        <h2>Riwayat Proses</h2>
        <LiniMasa kejadian={p.riwayat} />
      </section>

      <section className="kartu">
        <h2>Berkas</h2>
        {p.berkas.length === 0 ? (
          <p className="petunjuk">Tidak ada berkas terlampir.</p>
        ) : (
          <>
            <ul className="berkas">
              {p.berkas.map((b) => (
                <li key={b.url}>
                  <span className="berkas-nama">{b.nama}</span>
                  <a href={b.url} target="_blank" rel="noopener noreferrer" className="tombol">
                    Buka di Drive
                  </a>
                </li>
              ))}
            </ul>
            <p className="petunjuk">
              Berkas tersimpan di Google Drive Bagian Hukum. Bila tautannya meminta izin,
              hubungi Bagian Hukum untuk dibukakan aksesnya.
            </p>
          </>
        )}
      </section>

      <section className="kartu">
        <h2>Pemohon</h2>
        <p>{p.nama_pemohon || <span className="petunjuk">Tidak dicantumkan</span>}</p>
        {/* Nomor WhatsApp dan email sengaja tidak ditampilkan di mana pun, dan
            memang tidak pernah ikut dikirim dari api/data.ts. */}
      </section>

      <Link to="/" className="tombol">&larr; Kembali</Link>
    </>
  );
}
