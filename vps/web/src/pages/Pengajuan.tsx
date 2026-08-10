import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { panggilApi } from '../lib/api';
import { formatUkuran } from '../lib/format';

interface AturanKolom {
  judul: string;
  ekstensi: string[];
  batasMb: number;
  maksBerkas: number;
  wajib: boolean;
  hanyaPerda: boolean;
}
type Aturan = Record<string, AturanKolom>;

interface BerkasTerunggah {
  kolom: string;
  nama: string;
  ukuran: number;
  namaDisk: string;
}

/** Yang dikirim rute publik: tanpa `kode`, karena kode adalah kunci masuk. */
interface Opd { id: number; nama_resmi: string; nama_singkat: string }

const LANGKAH = ['Jenis', 'Pemohon', 'Berkas', 'Periksa'];

export function Pengajuan() {
  const [langkah, setLangkah] = useState(1);
  const [draf, setDraf] = useState('');
  const [aturan, setAturan] = useState<Aturan | null>(null);
  const [opd, setOpd] = useState<Opd[]>([]);
  const [galat, setGalat] = useState('');
  const [galatKolom, setGalatKolom] = useState<{ kolom: string; pesan: string }[]>([]);
  const [sibuk, setSibuk] = useState(false);
  const [nomorJadi, setNomorJadi] = useState('');

  const [jenis, setJenis] = useState<'Daerah' | 'Bupati'>('Bupati');

  // Gerbang OPD. `opdSah` yang menentukan boleh lanjut atau tidak; `kodeOpd`
  // sekadar isi kotak ketik.
  const [kodeOpd, setKodeOpd] = useState('');
  const [opdSah, setOpdSah] = useState<Opd | null>(null);
  const [kodeGalat, setKodeGalat] = useState('');
  const [kodeSibuk, setKodeSibuk] = useState(false);

  const [judul, setJudul] = useState('');
  const [namaPemohon, setNamaPemohon] = useState('');
  const [wa, setWa] = useState('');
  const [umpan, setUmpan] = useState('');   // honeypot

  const [terunggah, setTerunggah] = useState<BerkasTerunggah[]>([]);
  const [progres, setProgres] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([
      panggilApi<{ draf: string }>('/api/unggah/draf', { method: 'POST' }),
      panggilApi<Aturan>('/api/pengajuan/aturan'),
      panggilApi<{ opd: Opd[] }>('/api/publik/konteks')
    ])
      .then(([d, a, k]) => { setDraf(d.draf); setAturan(a); setOpd(k.opd); })
      .catch((e: Error) => setGalat(e.message));
  }, []);

  const kolomTampil = useMemo(() => {
    if (!aturan) return [];
    return Object.entries(aturan).filter(([, a]) => !a.hanyaPerda || jenis === 'Daerah');
  }, [aturan, jenis]);

  /**
   * Memilih Bupati menghilangkan SK Tim dan BA PANSUS sepenuhnya. Berkas yang
   * terlanjur diunggah untuk kolom itu ikut dibatalkan -- kalau dibiarkan,
   * server akan menolak pengajuannya dan pemohon bingung kenapa.
   */
  useEffect(() => {
    if (!aturan || jenis === 'Daerah') return;
    const buang = terunggah.filter((b) => aturan[b.kolom]?.hanyaPerda);
    if (!buang.length) return;
    setTerunggah((t) => t.filter((b) => !aturan[b.kolom]?.hanyaPerda));
    for (const b of buang) void batalkan(b.namaDisk, true);
  }, [jenis, aturan]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function batalkan(namaDisk: string, diam = false) {
    try {
      await fetch('/api/unggah/berkas', {
        method: 'DELETE',
        headers: { 'x-draf': draf, 'x-berkas': namaDisk }
      });
      if (!diam) setTerunggah((t) => t.filter((b) => b.namaDisk !== namaDisk));
    } catch { /* server yang menentukan; kegagalan di sini tidak fatal */ }
  }

  function unggah(kolom: string, file: File) {
    const kunci = `${kolom}:${file.name}`;
    const a = aturan?.[kolom];
    setGalat('');

    // Diperiksa di sini sebelum satu byte pun dikirim.
    //
    // Server juga memeriksanya, tapi jawabannya tidak pernah sampai: server
    // menolak sebelum badan permintaan selesai terkirim, lalu menutup koneksi,
    // dan browser hanya melihat sambungan terputus. Pemeriksaan di sini yang
    // membuat pemohon tahu alasan sebenarnya -- sekaligus menghemat kuota
    // mereka, karena berkas 30 MB tidak jadi dikirim.
    if (a && file.size > a.batasMb * 1024 * 1024) {
      setGalat(`${file.name}: ukuran ${formatUkuran(file.size)} melebihi batas ${a.batasMb} MB.`);
      return;
    }
    const ekst = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
    if (a && !a.ekstensi.includes(ekst)) {
      setGalat(
        `${file.name}: jenis berkas ${ekst ? '.' + ekst : 'tanpa ekstensi'} tidak diterima. ` +
        `Yang diterima: ${a.ekstensi.join(', ')}.`
      );
      return;
    }

    setProgres((p) => ({ ...p, [kunci]: 0 }));

    // XMLHttpRequest dipakai karena fetch tidak melaporkan kemajuan unggahan.
    // Untuk berkas 30 MB, tanpa progres pemohon akan mengira sistem menggantung
    // lalu menutup tab di tengah jalan.
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/unggah/berkas');
    xhr.setRequestHeader('x-draf', draf);
    xhr.setRequestHeader('x-kolom', kolom);
    xhr.setRequestHeader('x-nama', encodeURIComponent(file.name));
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgres((p) => ({ ...p, [kunci]: Math.round((e.loaded / e.total) * 100) }));
      }
    };

    xhr.onload = () => {
      setProgres((p) => { const n = { ...p }; delete n[kunci]; return n; });
      let isi: { namaDisk?: string; nama?: string; ukuran?: number; galat?: string } = {};
      try { isi = JSON.parse(xhr.responseText); } catch { /* biarkan kosong */ }

      if (xhr.status === 200 && isi.namaDisk) {
        setTerunggah((t) => [...t, {
          kolom, nama: isi.nama ?? file.name, ukuran: isi.ukuran ?? 0, namaDisk: isi.namaDisk!
        }]);
      } else {
        setGalat(`${file.name}: ${isi.galat ?? `Gagal mengunggah (HTTP ${xhr.status}).`}`);
      }
    };

    xhr.onerror = () => {
      setProgres((p) => { const n = { ...p }; delete n[kunci]; return n; });
      setGalat(`${file.name}: sambungan terputus saat mengunggah. Coba ulangi.`);
    };

    xhr.send(file);
  }

  /**
   * Periksa kode ke server.
   *
   * Hasilnya cuma menyalakan tampilan berikutnya. Server memeriksa kodenya
   * sekali lagi saat pengiriman, jadi melewati langkah ini dari peramban tidak
   * membuat pengajuan lolos.
   */
  async function periksaKode() {
    const k = kodeOpd.trim();
    if (!k) { setKodeGalat('Kode OPD wajib diisi.'); return; }

    setKodeSibuk(true);
    setKodeGalat('');
    try {
      const r = await panggilApi<{ opd: Opd }>('/api/publik/opd/verifikasi', {
        method: 'POST',
        body: JSON.stringify({ kode: k })
      });
      setOpdSah(r.opd);
    } catch (e) {
      setOpdSah(null);
      setKodeGalat((e as Error).message);
    } finally {
      setKodeSibuk(false);
    }
  }

  function rapikanWa() {
    let a = wa.replace(/[^0-9+]/g, '');
    if (a.startsWith('+62')) a = '0' + a.slice(3);
    else if (a.startsWith('62') && a.length > 10) a = '0' + a.slice(2);
    a = a.replace(/[^0-9]/g, '');
    if (a.length >= 9) setWa(`${a.slice(0, 4)}-${a.slice(4, 8)}-${a.slice(8)}`);
  }

  async function kirim() {
    setSibuk(true);
    setGalat('');
    setGalatKolom([]);
    try {
      const r = await panggilApi<{ sukses: boolean; nomor: string }>('/api/pengajuan/kirim', {
        method: 'POST',
        body: JSON.stringify({
          draf, jenis_peraturan: jenis, kode_opd: kodeOpd.trim(), judul,
          nama_pemohon: namaPemohon, wa_pemohon: wa, situs_web: umpan
        })
      });
      setNomorJadi(r.nomor);
    } catch (e) {
      const m = (e as Error).message;
      try {
        const isi = JSON.parse(m) as { kolom: string; pesan: string }[];
        setGalatKolom(isi);

        // Kode bisa saja dinonaktifkan atau diganti Bagian Hukum di sela-sela
        // pengisian. Bertahan di langkah periksa tidak menolong: yang perlu
        // diperbaiki ada di langkah 2.
        const gKode = isi.find((g) => g.kolom === 'kode_opd');
        if (gKode) {
          setOpdSah(null);
          setKodeGalat(gKode.pesan);
          setLangkah(2);
        }
      } catch {
        setGalat(m);
      }
    } finally {
      setSibuk(false);
    }
  }

  if (nomorJadi) {
    return (
      <div className="wadah-sempit">
        <section className="kartu">
          <h1>Pengajuan terkirim</h1>
          <p>Nomor pengajuan Anda: <span className="kode">{nomorJadi}</span></p>
          <p className="petunjuk">Simpan nomor ini untuk memantau perkembangannya.</p>
          <div className="tombol-baris">
            <Link className="tombol tombol-utama" to={`/detail/${nomorJadi}`}>
              Buka halaman pantauan
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (!aturan) {
    return galat
      ? <div className="kartu kartu-peringatan"><h2>Form tidak bisa dibuka</h2><p>{galat}</p></div>
      : <p className="petunjuk">Memuat&hellip;</p>;
  }

  const berkasDi = (kolom: string) => terunggah.filter((b) => b.kolom === kolom);

  return (
    <div className="wadah-sempit">
      <h1>Pengajuan Raperda/Raperbup</h1>

      <ol className="langkah">
        {LANGKAH.map((l, i) => (
          <li key={l} className={langkah >= i + 1 ? 'aktif' : ''}>{l}</li>
        ))}
      </ol>

      {galat && <div className="kartu kartu-peringatan"><p className="galat">{galat}</p></div>}

      {langkah === 1 && (
        <section className="kartu">
          <h2>Jenis Rancangan Peraturan</h2>
          <p className="petunjuk">
            Pilihan ini menentukan berkas apa saja yang diminta di langkah berikutnya.
          </p>
          <div className="pilihan-jenis">
            {([
              ['Daerah', 'PERATURAN DAERAH', 'Perlu SK Tim & BA PANSUS'],
              ['Bupati', 'PERATURAN BUPATI', 'Tanpa SK Tim & BA PANSUS']
            ] as const).map(([nilai, judulK, catatan]) => (
              <label key={nilai} className={`kartu kartu-tautan ${jenis === nilai ? 'aktif' : ''}`}>
                <input type="radio" name="jenis" hidden checked={jenis === nilai}
                       onChange={() => setJenis(nilai)} />
                <strong>{judulK}</strong><br />
                <span className="petunjuk">{catatan}</span>
              </label>
            ))}
          </div>
          <div className="tombol-baris">
            <button className="tombol tombol-utama" onClick={() => setLangkah(2)}>
              Lanjut ke Pemohon &rarr;
            </button>
          </div>
        </section>
      )}

      {langkah === 2 && (
        <section className="kartu">
          <h2>Pemohon</h2>

          {/*
            Kode OPD berlaku seperti halaman masuk: selama belum cocok, kolom
            lain tidak ditampilkan sama sekali. Menampilkannya tapi mengunci
            tombol hanya membuat orang mengisi panjang-panjang lalu mentok.
          */}
          {!opdSah ? (
            <>
              <label>
                Kode OPD
                <input
                  value={kodeOpd}
                  onChange={(e) => { setKodeOpd(e.target.value); setKodeGalat(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void periksaKode(); } }}
                  placeholder="Contoh: BPKAD"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}
                />
              </label>

              {kodeGalat && <p className="galat">{kodeGalat}</p>}

              <p className="petunjuk">
                {opd.length === 0
                  ? 'Bagian Hukum belum mendaftarkan OPD mana pun, jadi pengajuan belum bisa dibuka. '
                    + 'Hubungi Bagian Hukum Setda Kabupaten Brebes.'
                  : 'Kode ini diberikan Bagian Hukum Setda Kabupaten Brebes. Belum punya kode, '
                    + 'atau OPD Anda belum terdaftar? Hubungi Bagian Hukum lebih dulu.'}
              </p>

              <div className="tombol-baris">
                <button className="tombol" onClick={() => setLangkah(1)}>&larr; Kembali</button>
                <button className="tombol tombol-utama" onClick={() => void periksaKode()}
                        disabled={kodeSibuk || !kodeOpd.trim()}>
                  {kodeSibuk ? 'Memeriksa…' : 'Periksa kode'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="kartu" style={{ marginBottom: 16 }}>
                <div className="baris-atas">
                  <span className="kode">{kodeOpd.trim().toUpperCase()}</span>
                  <span className="lencana lencana-selesai">Terverifikasi</span>
                </div>
                <p className="judul-pengajuan" style={{ margin: 0 }}>{opdSah.nama_resmi}</p>
                <p className="petunjuk" style={{ marginTop: 6, marginBottom: 0 }}>
                  Bukan OPD Anda?{' '}
                  <a href="#" onClick={(e) => { e.preventDefault(); setOpdSah(null); setKodeOpd(''); }}>
                    Ganti kode
                  </a>
                </p>
              </div>

              <label>
                Judul Raperda/Raperbup
                <textarea rows={3} value={judul} onChange={(e) => setJudul(e.target.value)} />
              </label>
              <label>
                Nama Pemohon
                <input value={namaPemohon} onChange={(e) => setNamaPemohon(e.target.value)} />
              </label>
              <label>
                Nomor WhatsApp
                <input type="tel" value={wa} onChange={(e) => setWa(e.target.value)}
                       onBlur={rapikanWa} placeholder="0822-9998-9690" />
              </label>

              {/* Kolom umpan. Disembunyikan dari manusia; hanya bot yang mengisinya. */}
              <input type="text" name="situs_web" value={umpan} onChange={(e) => setUmpan(e.target.value)}
                     tabIndex={-1} autoComplete="off" aria-hidden="true"
                     style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />

              <div className="tombol-baris">
                <button className="tombol" onClick={() => setLangkah(1)}>&larr; Kembali</button>
                <button className="tombol tombol-utama" onClick={() => setLangkah(3)}>
                  Lanjut ke Berkas &rarr;
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {langkah === 3 && (
        <section className="kartu">
          <h2>Berkas</h2>
          <p className="petunjuk">
            Berkas tidak perlu dinamai apa pun &mdash; sistem menyimpannya sendiri.
          </p>

          {kolomTampil.map(([kunci, a]) => {
            const wajib = a.hanyaPerda ? jenis === 'Daerah' : a.wajib;
            const isi = berkasDi(kunci);
            const sedang = Object.entries(progres).filter(([k]) => k.startsWith(`${kunci}:`));

            return (
              <div key={kunci} className="kolom-berkas">
                <label>
                  {a.judul}{wajib ? ' *' : ''}
                  <input type="file"
                         accept={a.ekstensi.map((e) => '.' + e).join(',')}
                         multiple={a.maksBerkas > 1}
                         onChange={(e) => {
                           for (const f of Array.from(e.target.files ?? [])) unggah(kunci, f);
                           e.target.value = '';
                         }} />
                </label>
                <p className="petunjuk">
                  Maks {a.batasMb} MB &middot; {a.ekstensi.join(', ').toUpperCase()}
                  {a.maksBerkas > 1 && ` · maksimal ${a.maksBerkas} berkas`}
                </p>

                <ul className="berkas">
                  {isi.map((b) => (
                    <li key={b.namaDisk}>
                      <span className="berkas-nama">{b.nama}</span>
                      <span className="berkas-ukuran">
                        {formatUkuran(b.ukuran)}
                        <button className="tombol" onClick={() => void batalkan(b.namaDisk)}>Hapus</button>
                      </span>
                    </li>
                  ))}
                  {sedang.map(([k, persen]) => (
                    <li key={k}>
                      <span className="berkas-nama">
                        {k.slice(k.indexOf(':') + 1)}
                        <span className="progress"><span style={{ width: `${persen}%` }} /></span>
                      </span>
                      <span className="berkas-ukuran">{persen}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div className="tombol-baris">
            <button className="tombol" onClick={() => setLangkah(2)}>&larr; Kembali</button>
            <button className="tombol tombol-utama" onClick={() => setLangkah(4)}>
              Lanjut ke Periksa &rarr;
            </button>
          </div>
        </section>
      )}

      {langkah === 4 && (
        <section className="kartu">
          <h2>Periksa sebelum dikirim</h2>
          <p className="petunjuk">
            Pengajuan hukum yang salah kirim mahal ongkos perbaikannya.
          </p>

          {galatKolom.length > 0 && (
            <div className="kartu kartu-peringatan">
              <h3>Belum bisa dikirim</h3>
              <ul style={{ paddingLeft: 20 }}>
                {galatKolom.map((g, i) => <li key={i}>{g.pesan}</li>)}
              </ul>
            </div>
          )}

          <p><strong>Jenis:</strong> Peraturan {jenis}</p>
          <p><strong>OPD:</strong> {opdSah?.nama_resmi ?? '(belum diisi)'}</p>
          <p><strong>Judul:</strong> {judul || '(belum diisi)'}</p>
          <p><strong>Pemohon:</strong> {namaPemohon || '(belum diisi)'} &middot; {wa || '(belum diisi)'}</p>

          <h3>Berkas</h3>
          <ul className="berkas">
            {terunggah.length === 0
              ? <li className="petunjuk">Belum ada berkas</li>
              : terunggah.map((b) => (
                  <li key={b.namaDisk}>
                    <span className="berkas-nama">{aturan[b.kolom]?.judul ?? b.kolom}</span>
                    <span className="berkas-ukuran">{b.nama} &middot; {formatUkuran(b.ukuran)}</span>
                  </li>
                ))}
          </ul>

          <div className="tombol-baris">
            <button className="tombol" onClick={() => setLangkah(3)}>&larr; Kembali</button>
            <button className="tombol tombol-utama" onClick={kirim} disabled={sibuk}>
              {sibuk ? 'Mengirim…' : 'Kirim pengajuan'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
