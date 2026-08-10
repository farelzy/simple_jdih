import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { panggilApi } from '../lib/api';
import { formatTanggal, formatUkuran, labelTahap } from '../lib/format';
import { KotakHitungan } from '../components/KotakHitungan';
import { LencanaStatus } from '../components/LencanaStatus';
import { KolomSandi } from '../components/KolomSandi';

interface BarisAntrean {
  nomor: string; judul: string; opd: string; status: string;
  masuk: string; diperbarui: string; mandek: boolean;
}
interface DataAdmin {
  emailSaya: string;
  antrean: BarisAntrean[];
  rekap: {
    status: { TOTAL: number; PROSES: number; SELESAI: number; DIKEMBALIKAN: number };
    opd: { opd: string; jumlah: number }[];
    bulan: { bulan: string; jumlah: number }[];
    rataHari: number | null;
  };
  pengaturan: Record<string, string>;
  batasMaksMb: number;
  opd: { id: number; kode: string; nama_resmi: string; nama_singkat: string }[];
  admin: { id: number; email: string; nama: string }[];
  alasanKembali: string[];
  tahap: string[];
  status: string[];
}

const TAB = ['antrean', 'rekap', 'opd', 'admin', 'pengaturan', 'cadangan', 'migrasi', 'log'] as const;
type Tab = (typeof TAB)[number];

function hariIniIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Admin() {
  const navigate = useNavigate();
  const [data, setData] = useState<DataAdmin | null>(null);
  const [tab, setTab] = useState<Tab>('antrean');
  const [galat, setGalat] = useState('');
  const [pesan, setPesan] = useState('');

  const muat = useCallback(async () => {
    try {
      setData(await panggilApi<DataAdmin>('/api/admin/data'));
      setGalat('');
    } catch (e) {
      const m = (e as Error).message;
      if (/Bagian Hukum/i.test(m)) { navigate('/masuk'); return; }
      setGalat(m);
    }
  }, [navigate]);

  useEffect(() => { void muat(); }, [muat]);

  async function aksi(jalur: string, badan: unknown, sukses: string, metode = 'POST') {
    setGalat('');
    setPesan('');
    try {
      await panggilApi(jalur, {
        method: metode,
        ...(badan ? { body: JSON.stringify(badan) } : {})
      });
      setPesan(sukses);
      await muat();
      return true;
    } catch (e) {
      setGalat((e as Error).message);
      return false;
    }
  }

  if (galat && !data) {
    return <div className="kartu kartu-peringatan"><h2>Tidak bisa dimuat</h2><p>{galat}</p></div>;
  }
  if (!data) return <p className="petunjuk">Memuat&hellip;</p>;

  return (
    <>
      <div className="baris-atas">
        <h1 style={{ margin: 0 }}>Dashboard Bagian Hukum</h1>
        <span className="petunjuk">
          <Link to="/admin/tutorial">Panduan dashboard</Link> &middot; {data.emailSaya}
        </span>
      </div>

      <div className="saringan tab-bar">
        {TAB.map((t) => (
          <button key={t} className={`tombol ${t === tab ? 'tombol-utama' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {galat && <div className="kartu kartu-peringatan"><p className="galat">{galat}</p></div>}
      {pesan && <div className="kartu"><p>{pesan}</p></div>}

      {tab === 'antrean' && <Antrean data={data} aksi={aksi} />}
      {tab === 'rekap' && <Rekap data={data} />}
      {tab === 'opd' && <Opd data={data} aksi={aksi} />}
      {tab === 'admin' && <AdminTab data={data} aksi={aksi} />}
      {tab === 'pengaturan' && <Pengaturan data={data} aksi={aksi} />}
      {tab === 'cadangan' && <Cadangan />}
      {tab === 'migrasi' && <Migrasi />}
      {tab === 'log' && <Log />}
    </>
  );
}

type Aksi = (jalur: string, badan: unknown, sukses: string, metode?: string) => Promise<boolean>;

/* ---------- Antrean ---------- */

function Antrean({ data, aksi }: { data: DataAdmin; aksi: Aksi }) {
  const [buka, setBuka] = useState<{ nomor: string; jenis: 'riwayat' | 'status' } | null>(null);

  if (!data.antrean.length) {
    return <div className="kartu"><p className="petunjuk">Tidak ada pengajuan berstatus PROSES.</p></div>;
  }

  return (
    <>
      <p className="petunjuk">
        Diurutkan dari yang paling lama tidak diperbarui. Yang bertanda tidak bergerak
        melewati {data.pengaturan.ambang_mandek_hari ?? 7} hari.
      </p>

      {data.antrean.map((p) => (
        <div key={p.nomor} className="kartu">
          <div className="baris-atas">
            <span className="kode">{p.nomor}</span>
            {p.mandek
              ? <span className="lencana lencana-dikembalikan">Tidak bergerak</span>
              : <LencanaStatus status={p.status} />}
          </div>
          <p className="judul-pengajuan">{p.judul}</p>
          <p className="meta">{p.opd} &middot; diperbarui {formatTanggal(p.diperbarui)}</p>

          <div className="tombol-baris">
            <Link className="tombol" to={`/detail/${p.nomor}`}>Lihat</Link>
            <button className="tombol" onClick={() => setBuka({ nomor: p.nomor, jenis: 'status' })}>
              Ubah status
            </button>
            <button className="tombol tombol-utama" onClick={() => setBuka({ nomor: p.nomor, jenis: 'riwayat' })}>
              Tambah riwayat
            </button>
          </div>

          {buka?.nomor === p.nomor && buka.jenis === 'riwayat' && (
            <FormRiwayat data={data} nomor={p.nomor} tutup={() => setBuka(null)} aksi={aksi} />
          )}
          {buka?.nomor === p.nomor && buka.jenis === 'status' && (
            <FormStatus data={data} nomor={p.nomor} tutup={() => setBuka(null)} aksi={aksi} />
          )}
        </div>
      ))}
    </>
  );
}

function FormRiwayat(
  { data, nomor, tutup, aksi }: { data: DataAdmin; nomor: string; tutup: () => void; aksi: Aksi }
) {
  const [tahap, setTahap] = useState(data.tahap[0] ?? 'BERKAS_MASUK');
  const [tanggal, setTanggal] = useState(hariIniIso());
  const [keterangan, setKeterangan] = useState('');
  const [sibuk, setSibuk] = useState(false);

  return (
    <div className="kartu" style={{ marginTop: 16 }}>
      <h3>Tambah riwayat</h3>
      <label>
        Tahap
        <select value={tahap} onChange={(e) => setTahap(e.target.value)}>
          {data.tahap.map((t) => <option key={t} value={t}>{labelTahap(t)}</option>)}
        </select>
      </label>
      <label>
        Tanggal
        <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
      </label>
      <label>
        Keterangan
        <textarea rows={3} value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
      </label>
      <div className="tombol-baris">
        <button className="tombol" onClick={tutup}>Batal</button>
        <button className="tombol tombol-utama" disabled={sibuk} onClick={async () => {
          setSibuk(true);
          const ok = await aksi('/api/admin/riwayat', { nomor, tahap, tanggal, keterangan }, 'Riwayat ditambahkan.');
          setSibuk(false);
          if (ok) tutup();
        }}>
          {sibuk ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}

function FormStatus(
  { data, nomor, tutup, aksi }: { data: DataAdmin; nomor: string; tutup: () => void; aksi: Aksi }
) {
  const [status, setStatus] = useState('PROSES');
  const [alasan, setAlasan] = useState('');
  const [sibuk, setSibuk] = useState(false);

  return (
    <div className="kartu" style={{ marginTop: 16 }}>
      <h3>Ubah status</h3>
      <label>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {data.status.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label>
        Alasan / keterangan
        <textarea rows={3} value={alasan} onChange={(e) => setAlasan(e.target.value)} />
      </label>

      {status === 'DIKEMBALIKAN' && (
        <>
          <p className="petunjuk">Alasan wajib diisi. Pilihan cepat:</p>
          <div className="saringan">
            {data.alasanKembali.map((a) => (
              <button key={a} className="tombol" onClick={() => setAlasan(a)}>{a}</button>
            ))}
          </div>
        </>
      )}

      <div className="tombol-baris">
        <button className="tombol" onClick={tutup}>Batal</button>
        <button className="tombol tombol-utama" disabled={sibuk} onClick={async () => {
          setSibuk(true);
          const ok = await aksi('/api/admin/status', { nomor, status, alasan }, 'Status diubah.');
          setSibuk(false);
          if (ok) tutup();
        }}>
          {sibuk ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}

/* ---------- Rekap ---------- */

function Tabel({ judul, kepala, baris }: { judul: string; kepala: string[]; baris: (string | number)[][] }) {
  return (
    <section className="kartu">
      <h2>{judul}</h2>
      <div className="tabel-bungkus">
        <table>
          <thead><tr>{kepala.map((k) => <th key={k}>{k}</th>)}</tr></thead>
          <tbody>
            {baris.length === 0
              ? <tr><td colSpan={kepala.length} className="petunjuk">Belum ada data</td></tr>
              : baris.map((b, i) => (
                  <tr key={i}>{b.map((sel, j) => <td key={j}>{sel}</td>)}</tr>
                ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Rekap({ data }: { data: DataAdmin }) {
  const r = data.rekap;
  return (
    <>
      <div className="hitungan">
        <KotakHitungan angka={r.status.TOTAL} label="Total" />
        <KotakHitungan angka={r.status.PROSES} label="Proses" jenis="proses" />
        <KotakHitungan angka={r.status.SELESAI} label="Selesai" jenis="selesai" />
        <KotakHitungan angka={r.status.DIKEMBALIKAN} label="Kembali" jenis="dikembalikan" />
      </div>

      <section className="kartu">
        <h2>Rata-rata lama proses</h2>
        <p>
          {r.rataHari === null
            ? 'Belum ada pengajuan yang selesai.'
            : `${r.rataHari} hari, dihitung hanya dari pengajuan berstatus SELESAI`}
        </p>
      </section>

      <Tabel judul="Per OPD" kepala={['OPD', 'Jumlah']} baris={r.opd.map((o) => [o.opd, o.jumlah])} />
      <Tabel judul="Per bulan" kepala={['Bulan', 'Jumlah']} baris={r.bulan.map((b) => [b.bulan, b.jumlah])} />
    </>
  );
}

/* ---------- OPD ---------- */

function Opd({ data, aksi }: { data: DataAdmin; aksi: Aksi }) {
  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [singkat, setSingkat] = useState('');

  return (
    <>
      <section className="kartu">
        <h2>Daftar OPD</h2>
        <p className="petunjuk">
          Nama OPD pada pengajuan diambil dari daftar ini, tidak pernah diketik pemohon.
          Inilah yang menghentikan lima ejaan untuk satu instansi berkembang jadi delapan.
        </p>
        <div className="kartu kartu-peringatan">
          <p style={{ margin: 0 }}>
            <strong>Kode di bawah adalah kunci masuk form pengajuan.</strong> Siapa pun yang
            memegangnya bisa mengirim pengajuan atas nama OPD itu, jadi berikan hanya ke
            penghubung resmi masing-masing OPD. Kalau sebuah kode tersebar, ganti kodenya &mdash;
            kode lama langsung berhenti berlaku dan pengajuan yang sudah masuk tidak terpengaruh.
          </p>
        </div>
        <div className="tabel-bungkus">
          <table className="tabel-lentur">
            <thead><tr><th>Kode</th><th>Nama resmi</th><th>Singkat</th><th /></tr></thead>
            <tbody>
              {data.opd.length === 0
                ? <tr><td colSpan={4} className="petunjuk">Belum ada OPD terdaftar</td></tr>
                : data.opd.map((o) => (
                    <tr key={o.id}>
                      <td data-label="Kode"><span className="kode">{o.kode}</span></td>
                      <td data-label="Nama resmi">{o.nama_resmi}</td>
                      <td data-label="Singkat">{o.nama_singkat}</td>
                      <td>
                        <button className="tombol" onClick={() => {
                          const baru = prompt(`Kode baru untuk ${o.nama_resmi}:`, o.kode);
                          if (baru === null) return;
                          void aksi(`/api/admin/opd/${o.id}/kode`, { kode: baru },
                            `Kode ${o.nama_resmi} diganti. Beritahukan kode barunya ke OPD tersebut.`, 'PUT');
                        }}>Ganti kode</button>
                        {' '}
                        <button className="tombol" onClick={() => {
                          if (confirm(
                            `Nonaktifkan ${o.kode}?\n\n`
                            + 'OPD ini tidak akan bisa mengirim pengajuan baru. '
                            + 'Pengajuan yang sudah masuk tetap tersimpan.'
                          )) {
                            void aksi(`/api/admin/opd/${o.id}`, null, 'OPD dinonaktifkan.', 'DELETE');
                          }
                        }}>Nonaktifkan</button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="kartu">
        <h3>Tambah OPD</h3>
        <label>Kode<input value={kode} onChange={(e) => setKode(e.target.value)} placeholder="BPKAD" /></label>
        <label>Nama resmi<input value={nama} onChange={(e) => setNama(e.target.value)}
               placeholder="Badan Pengelolaan Keuangan dan Aset Daerah" /></label>
        <label>Nama singkat<input value={singkat} onChange={(e) => setSingkat(e.target.value)} placeholder="BPKAD" /></label>
        <div className="tombol-baris">
          <button className="tombol tombol-utama" onClick={async () => {
            if (await aksi('/api/admin/opd',
                { kode, nama_resmi: nama, nama_singkat: singkat }, 'OPD ditambahkan.')) {
              setKode(''); setNama(''); setSingkat('');
            }
          }}>Tambah</button>
        </div>
      </section>
    </>
  );
}

/* ---------- Admin ---------- */

function AdminTab({ data, aksi }: { data: DataAdmin; aksi: Aksi }) {
  const [email, setEmail] = useState('');
  const [nama, setNama] = useState('');
  const [sandi, setSandi] = useState('');
  const [lama, setLama] = useState('');
  const [baru, setBaru] = useState('');

  return (
    <>
      <section className="kartu">
        <h2>Admin</h2>
        <div className="tabel-bungkus">
          <table>
            <thead><tr><th>Email</th><th>Nama</th><th /></tr></thead>
            <tbody>
              {data.admin.map((a) => (
                <tr key={a.id}>
                  <td>{a.email}{a.email === data.emailSaya && <em> (Anda)</em>}</td>
                  <td>{a.nama}</td>
                  <td>
                    {a.email !== data.emailSaya && (
                      <button className="tombol" onClick={() => {
                        if (confirm(`Cabut akses ${a.email}?`)) {
                          void aksi(`/api/admin/admin/${a.id}`, null, 'Akses dicabut.', 'DELETE');
                        }
                      }}>Hapus</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="kartu">
        <h3>Tambah admin</h3>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Nama<input value={nama} onChange={(e) => setNama(e.target.value)} /></label>
        <KolomSandi label="Kata sandi" nilai={sandi} ubah={setSandi}
                    autoComplete="new-password" petunjuk="Minimal 8 karakter." />
        <div className="tombol-baris">
          <button className="tombol tombol-utama" onClick={async () => {
            if (await aksi('/api/admin/admin', { email, nama, sandi }, 'Admin ditambahkan.')) {
              setEmail(''); setNama(''); setSandi('');
            }
          }}>Tambah</button>
        </div>
      </section>

      <section className="kartu">
        <h3>Ganti kata sandi saya</h3>
        <KolomSandi label="Kata sandi lama" nilai={lama} ubah={setLama} autoComplete="current-password" />
        <KolomSandi label="Kata sandi baru" nilai={baru} ubah={setBaru} autoComplete="new-password" />
        <div className="tombol-baris">
          <button className="tombol tombol-utama" onClick={async () => {
            if (await aksi('/api/admin/ganti-sandi',
                { sandiLama: lama, sandiBaru: baru }, 'Kata sandi diganti.')) {
              setLama(''); setBaru('');
            }
          }}>Ganti</button>
        </div>
      </section>
    </>
  );
}

/* ---------- Pengaturan ---------- */

const LABEL_BATAS: Record<string, string> = {
  batas_surat_permohonan: 'Surat Permohonan',
  batas_keterangan_na: 'Keterangan/Penjelasan atau NA Perda',
  batas_rancangan: 'Rancangan Perda/Perbup',
  batas_lampiran: 'Lampiran Raperda/Raperbup',
  batas_paraf: 'Paraf Koordinasi',
  batas_dasar_hukum: 'Dasar Hukum Penyusunan',
  batas_sk_tim: 'SK Tim Penyusunan RAPERDA',
  batas_ba_pansus: 'Berita Acara Rapat PANSUS AKHIR',
  batas_hasil_konsultasi: 'Hasil Konsultasi'
};

function Pengaturan({ data, aksi }: { data: DataAdmin; aksi: Aksi }) {
  const [nilai, setNilai] = useState<Record<string, string>>({ ...data.pengaturan });

  const ubah = (k: string, v: string) => setNilai((n) => ({ ...n, [k]: v }));
  const simpan = (k: string) => aksi('/api/admin/pengaturan', { kunci: k, nilai: nilai[k] ?? '' }, `${k} disimpan.`);

  return (
    <>
      <section className="kartu">
        <h2>Keterbukaan data</h2>
        {([
          ['publik_tampilkan_wa', 'Tampilkan nomor WhatsApp pemohon',
           'Bila dimatikan, pengunjung umum hanya melihat 0822****9690.'],
          ['publik_tampilkan_berkas', 'Tampilkan tautan berkas',
           'Bila dimatikan, tautan berkas hanya bisa dibuka Bagian Hukum.']
        ] as const).map(([k, judul, catatan]) => (
          <label key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontWeight: 400 }}>
            <input type="checkbox" style={{ width: 'auto', marginTop: 4, flex: 'none' }}
                   checked={(nilai[k] ?? '').toUpperCase() === 'TRUE'}
                   onChange={(e) => {
                     const v = e.target.checked ? 'TRUE' : 'FALSE';
                     ubah(k, v);
                     void aksi('/api/admin/pengaturan', { kunci: k, nilai: v }, 'Sakelar disimpan.');
                   }} />
            <span><strong>{judul}</strong><br /><span className="petunjuk">{catatan}</span></span>
          </label>
        ))}
      </section>

      <section className="kartu">
        <h2>Batas ukuran berkas</h2>
        <p className="petunjuk">
          Dalam MB, maksimal {data.batasMaksMb}. Menyetel lebih tinggi ditolak karena
          jalur unggah tidak sanggup melayaninya &mdash; pemohon hanya akan menunggu
          lama lalu gagal di tengah.
        </p>
        {Object.entries(LABEL_BATAS).map(([k, judul]) => (
          <label key={k}>
            {judul}
            <input type="number" min={1} max={data.batasMaksMb} value={nilai[k] ?? ''}
                   onChange={(e) => ubah(k, e.target.value)} onBlur={() => void simpan(k)} />
          </label>
        ))}
      </section>

      <section className="kartu">
        <h2>Antrean &amp; tampilan</h2>
        <label>
          Tandai &ldquo;tidak bergerak&rdquo; setelah berapa hari
          <input type="number" min={1} max={365} value={nilai.ambang_mandek_hari ?? ''}
                 onChange={(e) => ubah('ambang_mandek_hari', e.target.value)}
                 onBlur={() => void simpan('ambang_mandek_hari')} />
        </label>
        <label>
          Pengumuman di halaman depan
          <textarea rows={2} value={nilai.pengumuman ?? ''}
                    onChange={(e) => ubah('pengumuman', e.target.value)}
                    onBlur={() => void simpan('pengumuman')} />
          <span className="petunjuk">Kosongkan bila tidak ada.</span>
        </label>
      </section>
    </>
  );
}

/* ---------- Migrasi ---------- */

interface LaporanMigrasi {
  barisDibaca: number; barisDisisipkan: number; dilewati: string[];
  riwayatTerurai: number; riwayatLainnya: number; berkasTertaut: number;
  opdPerluPeriksa: string[]; selisihKolom16: string[]; ujiCoba: boolean;
}

function Migrasi() {
  const [sumber, setSumber] = useState('');
  const [periksa, setPeriksa] = useState<{ sah: boolean; pesan: string; jumlahBaris?: number } | null>(null);
  const [laporan, setLaporan] = useState<LaporanMigrasi | null>(null);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  async function jalan<T>(jalur: string, badan: unknown, pasang: (h: T) => void) {
    setGalat('');
    setSibuk(true);
    try {
      pasang(await panggilApi<T>(jalur, { method: 'POST', body: JSON.stringify(badan) }));
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <section className="kartu">
      <h2>Migrasi dari spreadsheet lama</h2>
      <p className="petunjuk">
        Spreadsheet aslinya tidak akan disentuh &mdash; hanya dibaca lewat ekspor CSV
        publik Google. Aksesnya harus disetel minimal &ldquo;Siapa saja yang memiliki
        link&rdquo; sebagai Pelihat. Migrasi idempoten: dijalankan dua kali tidak
        menggandakan data.
      </p>

      {galat && <p className="galat">{galat}</p>}

      <label>
        Link spreadsheet
        <input value={sumber} onChange={(e) => { setSumber(e.target.value); setPeriksa(null); setLaporan(null); }}
               placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..." />
      </label>

      <div className="tombol-baris">
        <button className="tombol tombol-utama" disabled={sibuk || !sumber.trim()}
                onClick={() => jalan('/api/admin/periksa-sheet', { sumber: sumber.trim() }, setPeriksa)}>
          {sibuk ? 'Memeriksa…' : 'Periksa →'}
        </button>
      </div>

      {periksa && (
        <div className={`kartu ${periksa.sah ? '' : 'kartu-peringatan'}`}>
          <p className={periksa.sah ? '' : 'galat'}>{periksa.pesan}</p>
          {periksa.sah && (
            <div className="tombol-baris">
              <button className="tombol" disabled={sibuk}
                      onClick={() => jalan('/api/admin/migrasi', { sumber: sumber.trim(), ujiCoba: true }, setLaporan)}>
                Uji coba
              </button>
              <button className="tombol tombol-utama" disabled={sibuk}
                      onClick={() => jalan('/api/admin/migrasi', { sumber: sumber.trim(), ujiCoba: false }, setLaporan)}>
                Jalankan migrasi
              </button>
            </div>
          )}
        </div>
      )}

      {laporan && (
        <div className={`kartu ${laporan.selisihKolom16.length ? 'kartu-peringatan' : ''}`}>
          <h3>{laporan.ujiCoba ? 'Hasil uji coba — belum ada yang ditulis' : 'Migrasi selesai'}</h3>
          <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            <li>{laporan.barisDibaca} baris dibaca</li>
            <li>{laporan.barisDisisipkan} pengajuan {laporan.ujiCoba ? 'akan disimpan' : 'disimpan'}</li>
            <li>{laporan.riwayatTerurai} baris riwayat terurai rapi</li>
            <li>{laporan.riwayatLainnya} baris masuk sebagai LAINNYA, teks aslinya utuh</li>
            <li>{laporan.berkasTertaut} tautan berkas disalin apa adanya</li>
            {laporan.dilewati.length > 0 && <li>{laporan.dilewati.length} baris dilewati karena sudah ada</li>}
          </ul>

          {laporan.opdPerluPeriksa.length > 0 && (
            <p className="petunjuk">
              <strong>Perlu diperiksa</strong> &mdash; nama OPD berikut belum ada di daftar
              baku: {laporan.opdPerluPeriksa.join(', ')}
            </p>
          )}

          {laporan.selisihKolom16.length > 0 ? (
            <p className="galat">
              Perhatian: {laporan.selisihKolom16.length} pengajuan menghasilkan kolom riwayat
              berbeda dari aslinya ({laporan.selisihKolom16.join(', ')}). Bandingkan dulu
              dengan spreadsheet sebelum menganggap migrasi beres.
            </p>
          ) : (
            <p>Kolom riwayat hasil susun ulang sama persis dengan aslinya.</p>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- Log ---------- */

function Log() {
  const [baris, setBaris] = useState<{ waktu: string; aktor: string; aksi: string; rincian: string }[] | null>(null);

  useEffect(() => {
    panggilApi<typeof baris>('/api/admin/log?jumlah=100').then(setBaris).catch(() => setBaris([]));
  }, []);

  if (!baris) return <p className="petunjuk">Memuat&hellip;</p>;

  return (
    <Tabel
      judul="100 catatan terakhir"
      kepala={['Waktu', 'Aktor', 'Aksi', 'Rincian']}
      baris={baris.map((b) => [b.waktu, b.aktor, b.aksi, b.rincian])}
    />
  );
}

/* ---------- Cadangan ---------- */

interface InfoCadangan { nama: string; tanggal: string; ukuran: number }

/**
 * Ekspor Excel dan cadangan harian.
 *
 * Unduhan tidak lewat panggilApi: pembungkus itu mengurai jawaban sebagai
 * JSON, sedangkan yang datang di sini berkas biner. Yang dipakai anchor biasa
 * -- cookie sesi ikut terkirim sendiri, dan peramban yang mengurus namanya.
 */
function Cadangan() {
  const [data, setData] = useState<{ simpanHari: number; daftar: InfoCadangan[] } | null>(null);
  const [galat, setGalat] = useState('');
  const [pesan, setPesan] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    try {
      setData(await panggilApi('/api/admin/cadangan'));
      setGalat('');
    } catch (e) { setGalat((e as Error).message); }
  }, []);

  useEffect(() => { void muat(); }, [muat]);

  async function cadangkanSekarang() {
    setSibuk(true);
    setGalat('');
    setPesan('');
    try {
      const h = await panggilApi<{ nama: string }>('/api/admin/cadangan', { method: 'POST' });
      setPesan(`Cadangan ${h.nama} dibuat.`);
      await muat();
    } catch (e) { setGalat((e as Error).message); }
    finally { setSibuk(false); }
  }

  return (
    <>
      <section className="kartu">
        <h2>Ekspor Excel</h2>
        <p className="petunjuk">
          Susunan kolomnya sama persis dengan spreadsheet Google yang lama &mdash; 18 kolom
          form ditambah ID, email pemohon, kode OPD, dan jejak pembaruan. Kolom
          &ldquo;Tanggal dan Detail Proses&rdquo; disusun ulang dari riwayat, jadi bentuknya
          sama dengan yang selama ini diketik manual.
        </p>
        <div className="tombol-baris" style={{ justifyContent: 'flex-start' }}>
          <a className="tombol tombol-utama" href="/api/admin/ekspor">Unduh Excel sekarang</a>
        </div>
      </section>

      {galat && <div className="kartu kartu-peringatan"><p className="galat">{galat}</p></div>}
      {pesan && <div className="kartu"><p>{pesan}</p></div>}

      <section className="kartu">
        <h2>Cadangan harian</h2>
        <p className="petunjuk">
          Sistem menulis satu berkas Excel tiap hari secara otomatis. Yang disimpan{' '}
          {data?.simpanHari ?? 7} berkas terbaru &mdash; begitu ada yang baru, yang paling
          tua terhapus sendiri.
        </p>

        {!data ? <p className="petunjuk">Memuat&hellip;</p> : data.daftar.length === 0 ? (
          <p className="petunjuk">
            Belum ada cadangan. Yang pertama dibuat otomatis dalam satu jam ke depan,
            atau buat sekarang dengan tombol di bawah.
          </p>
        ) : (
          <div className="tabel-bungkus">
            <table className="tabel-lentur">
              <thead><tr><th>Tanggal</th><th>Ukuran</th><th /></tr></thead>
              <tbody>
                {data.daftar.map((c) => (
                  <tr key={c.nama}>
                    <td data-label="Tanggal"><span className="kode">{c.tanggal}</span></td>
                    <td data-label="Ukuran">{formatUkuran(c.ukuran)}</td>
                    <td>
                      <a className="tombol" href={`/api/admin/cadangan/${c.nama}`}>Unduh</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="tombol-baris" style={{ justifyContent: 'flex-start' }}>
          <button className="tombol" onClick={() => void cadangkanSekarang()} disabled={sibuk}>
            {sibuk ? 'Membuat…' : 'Buat cadangan hari ini sekarang'}
          </button>
        </div>
      </section>
    </>
  );
}
