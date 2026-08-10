/**
 * Halaman panduan untuk OPD pemohon.
 *
 * Aturan berkas diambil dari server, bukan ditulis ulang di sini. Batas ukuran
 * dan jenis berkas bisa diubah Bagian Hukum lewat dashboard; panduan yang
 * menuliskannya sendiri akan menyesatkan begitu angkanya diubah sekali saja.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { panggilApi } from '../lib/api';

interface AturanKolom {
  judul: string;
  ekstensi: string[];
  batasMb: number;
  maksBerkas: number;
  wajib: boolean;
  hanyaPerda: boolean;
}
type Aturan = Record<string, AturanKolom>;

export function Panduan() {
  const [aturan, setAturan] = useState<Aturan | null>(null);

  useEffect(() => {
    panggilApi<Aturan>('/api/pengajuan/aturan')
      .then(setAturan)
      .catch(() => setAturan(null));   // panduan tetap berguna tanpa tabel berkas
  }, []);

  const berkas = aturan ? Object.entries(aturan) : [];

  return (
    <div className="wadah-sempit">
      <header className="sambutan">
        <h1>Cara Pakai</h1>
        <p>
          Panduan mengajukan Raperda/Raperbup ke Bagian Hukum Sekretariat Daerah
          Kabupaten Brebes lewat SIMPEL.
        </p>
      </header>

      <section className="kartu kartu-peringatan">
        <h2>Sebelum mulai: minta kode OPD</h2>
        <p>
          Pengajuan hanya bisa dibuka dengan <strong>kode OPD</strong>. Kode ini diberikan
          Bagian Hukum kepada penghubung resmi tiap OPD, dan dipakai berulang untuk semua
          pengajuan dari OPD tersebut.
        </p>
        <p style={{ marginBottom: 0 }}>
          Belum punya kode, lupa kodenya, atau OPD Anda belum terdaftar? Hubungi Bagian
          Hukum lebih dulu &mdash; nomornya ada di bagian bawah halaman ini.
        </p>
      </section>

      <h2 className="judul-bagian">Empat langkah pengajuan</h2>
      <ol className="panduan">
        <li>
          <h3>Pilih jenis rancangan</h3>
          <p className="petunjuk">
            Peraturan Daerah atau Peraturan Bupati. Pilihan ini menentukan berkas apa saja
            yang diminta &mdash; Raperda perlu SK Tim dan Berita Acara PANSUS, Raperbup tidak.
          </p>
        </li>
        <li>
          <h3>Masukkan kode OPD, lalu isi data pemohon</h3>
          <p className="petunjuk">
            Sistem memeriksa kode dan menampilkan nama OPD-nya. Pastikan nama yang muncul
            benar sebelum lanjut. Setelah itu isi judul rancangan, nama pemohon, dan nomor
            WhatsApp yang bisa dihubungi.
          </p>
        </li>
        <li>
          <h3>Unggah berkas</h3>
          <p className="petunjuk">
            Berkas tidak perlu dinamai apa pun &mdash; sistem menyimpannya sendiri. Setiap
            berkas terunggah langsung, jadi Anda bisa melihat kemajuannya dan menghapus yang
            salah sebelum mengirim.
          </p>
        </li>
        <li>
          <h3>Periksa lalu kirim</h3>
          <p className="petunjuk">
            Layar terakhir merangkum seluruh isian dan daftar berkas. Setelah dikirim, Anda
            menerima <strong>nomor pengajuan</strong> berbentuk <span className="kode">BRB-2026-0001</span>.
            Simpan nomor itu.
          </p>
        </li>
      </ol>

      <div className="tombol-baris" style={{ justifyContent: 'flex-start', marginBottom: 28 }}>
        <Link className="tombol tombol-utama" to="/ajukan">Mulai mengajukan &rarr;</Link>
      </div>

      <h2 className="judul-bagian">Berkas yang perlu disiapkan</h2>
      {berkas.length === 0 ? (
        <div className="kartu">
          <p className="petunjuk" style={{ margin: 0 }}>
            Daftar berkas sedang tidak bisa dimuat. Buka halaman{' '}
            <Link to="/ajukan">Ajukan</Link> untuk melihat daftar terbaru.
          </p>
        </div>
      ) : (
        <>
          <div className="kartu">
            <div className="tabel-bungkus">
              <table className="tabel-lentur">
                <thead>
                  <tr><th>Berkas</th><th>Format</th><th>Maks</th><th>Keterangan</th></tr>
                </thead>
                <tbody>
                  {berkas.map(([kunci, a]) => (
                    <tr key={kunci}>
                      <td data-label="Berkas">{a.judul}</td>
                      <td data-label="Format">{a.ekstensi.join(', ').toUpperCase()}</td>
                      <td data-label="Maks" style={{ whiteSpace: 'nowrap' }}>
                        {a.batasMb} MB
                        {a.maksBerkas > 1 && <> &middot; {a.maksBerkas} berkas</>}
                      </td>
                      <td data-label="Keterangan" style={{ whiteSpace: 'normal' }}>
                        {a.hanyaPerda
                          ? <span className="lencana lencana-proses">Khusus Raperda</span>
                          : a.wajib
                            ? <span className="lencana lencana-dikembalikan">Wajib</span>
                            : <span className="petunjuk">Opsional</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="petunjuk">
            Berkas yang melebihi batas ditolak di browser sebelum terkirim, jadi kuota Anda
            tidak habis percuma. Rancangan Perda/Perbup diminta dalam format yang bisa
            disunting supaya Bagian Hukum dapat langsung mengoreksinya.
          </p>
        </>
      )}

      <h2 className="judul-bagian">Memantau perkembangan</h2>
      <section className="kartu">
        <p>
          Semua pengajuan tampil di halaman <Link to="/">Monitoring</Link> dan bisa dicari
          dengan judul, nama OPD, atau nomor pengajuan. Buka salah satu untuk melihat lini
          masa lengkapnya: tanggal berkas masuk, reviu, sampai selesai.
        </p>
        <p style={{ marginBottom: 0 }}>
          Tidak perlu akun untuk memantau. Akun hanya dipakai Bagian Hukum untuk memperbarui
          status.
        </p>
      </section>

      <h2 className="judul-bagian">Arti status</h2>
      <section className="kartu">
        <ul className="berkas">
          <li>
            <span className="berkas-nama"><span className="lencana lencana-proses">PROSES</span></span>
            <span className="petunjuk" style={{ flex: 2 }}>
              Berkas sudah diterima dan sedang berjalan di Bagian Hukum.
            </span>
          </li>
          <li>
            <span className="berkas-nama"><span className="lencana lencana-selesai">SELESAI</span></span>
            <span className="petunjuk" style={{ flex: 2 }}>
              Proses hukum atas rancangan ini sudah rampung.
            </span>
          </li>
          <li>
            <span className="berkas-nama">
              <span className="lencana lencana-dikembalikan">DIKEMBALIKAN</span>
            </span>
            <span className="petunjuk" style={{ flex: 2 }}>
              Ada yang perlu diperbaiki. Alasannya tertulis pada keterangan di halaman detail;
              perbaiki lalu ajukan kembali.
            </span>
          </li>
        </ul>
      </section>

      <h2 className="judul-bagian">Pertanyaan yang sering muncul</h2>
      <section className="kartu">
        <h3>Kode OPD saya ditolak</h3>
        <p className="petunjuk">
          Periksa ejaannya. Huruf besar-kecil dan spasi berlebih tidak masalah, tapi tanda
          hubung dan angka harus persis. Kalau tetap ditolak, kemungkinan kodenya sudah
          diganti &mdash; tanyakan ke Bagian Hukum.
        </p>

        <h3>Bisakah satu OPD punya beberapa pemohon?</h3>
        <p className="petunjuk">
          Bisa. Kode OPD dipakai bersama; nama dan nomor WhatsApp pemohon diisi per pengajuan.
        </p>

        <h3>Saya salah kirim, bagaimana?</h3>
        <p className="petunjuk">
          Pengajuan tidak bisa dihapus sendiri. Hubungi Bagian Hukum dengan menyebut nomor
          pengajuannya.
        </p>

        <h3>Berkas saya lebih besar dari batas</h3>
        <p className="petunjuk">
          Pindai ulang pada resolusi lebih rendah, atau mampatkan PDF-nya. Kalau memang tidak
          bisa, hubungi Bagian Hukum &mdash; batas ukuran dapat disesuaikan.
        </p>
      </section>

      <section className="kartu">
        <h2>Masih bingung?</h2>
        <p style={{ marginBottom: 0 }}>
          Hubungi Bagian Hukum Sekretariat Daerah Kabupaten Brebes &mdash; Mayasari,
          WhatsApp <a href="https://wa.me/6287827992724">0878 2799 2724</a>.
        </p>
      </section>
    </div>
  );
}
