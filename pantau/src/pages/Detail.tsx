import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePantau } from '../lib/data';
import { formatTanggal } from '../lib/format';
import { waInternasional } from '../pure/sheet.js';
import { LencanaStatus } from '../components/LencanaStatus';
import { LiniMasa } from '../components/LiniMasa';
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

        {/* Kontak hanya ada bila TAMPILKAN_KONTAK menyala di Vercel; saat
            dimatikan, kolomnya memang tidak pernah terkirim ke sini. */}
        <ul className="kontak">
          {p.wa_pemohon && (
            <li>
              <span className="kontak-label">WhatsApp</span>
              {waInternasional(p.wa_pemohon) ? (
                <a href={`https://wa.me/${waInternasional(p.wa_pemohon)}`}
                   target="_blank" rel="noopener noreferrer">{p.wa_pemohon}</a>
              ) : (
                <span>{p.wa_pemohon}</span>
              )}
            </li>
          )}
          {p.email_pemohon && (
            <li>
              <span className="kontak-label">Email</span>
              <a href={`mailto:${p.email_pemohon}`}>{p.email_pemohon}</a>
            </li>
          )}
        </ul>
      </section>

      <Link to="/" className="tombol">&larr; Kembali</Link>
    </>
  );
}
