/**
 * Panduan lengkap dashboard untuk Bagian Hukum.
 *
 * Sengaja tidak dijaga wajibAdmin: isinya penjelasan cara kerja, bukan data.
 * Kalau dijaga, halaman ini justru tidak bisa dibaca persis saat paling
 * dibutuhkan -- yaitu ketika seseorang gagal masuk dan bingung harus apa.
 *
 * Angka dan nama tahap yang bisa berubah lewat Pengaturan sengaja TIDAK
 * ditulis sebagai angka mati di sini; yang dijelaskan artinya, dan pembaca
 * diarahkan melihat nilai yang berlaku di tabnya masing-masing.
 */
import { Link } from 'react-router-dom';

interface Bagian { id: string; judul: string }

const DAFTAR_ISI: Bagian[] = [
  { id: 'masuk', judul: 'Masuk ke dashboard' },
  { id: 'antrean', judul: 'Antrean — pekerjaan harian' },
  { id: 'rekap', judul: 'Rekap — angka dan laporan' },
  { id: 'opd', judul: 'OPD — kode sebagai kunci masuk' },
  { id: 'admin', judul: 'Admin — akun Bagian Hukum' },
  { id: 'pengaturan', judul: 'Pengaturan' },
  { id: 'cadangan', judul: 'Cadangan & ekspor Excel' },
  { id: 'migrasi', judul: 'Migrasi dari spreadsheet' },
  { id: 'log', judul: 'Log — siapa mengubah apa' },
  { id: 'rutin', judul: 'Alur kerja yang disarankan' },
  { id: 'masalah', judul: 'Kalau ada masalah' }
];

export function TutorialAdmin() {
  return (
    <div className="wadah-sempit">
      <header className="sambutan">
        <h1>Panduan Dashboard</h1>
        <p>
          Buku pegangan lengkap untuk Bagian Hukum Sekretariat Daerah Kabupaten Brebes
          dalam mengelola SIMPEL: antrean, kode OPD, akun, pengaturan, cadangan, dan log.
        </p>
      </header>

      <nav className="kartu">
        <h2>Isi panduan</h2>
        <ol className="daftar-isi">
          {DAFTAR_ISI.map((b) => (
            <li key={b.id}><a href={`#${b.id}`}>{b.judul}</a></li>
          ))}
        </ol>
      </nav>

      {/* ---------- Masuk ---------- */}
      <section className="kartu" id="masuk">
        <h2>1. Masuk ke dashboard</h2>
        <p>
          Buka <Link to="/masuk">/masuk</Link>, isi email dan kata sandi akun Bagian Hukum.
          Setelah berhasil, Anda diarahkan ke <Link to="/admin">/admin</Link>.
        </p>
        <ul className="poin">
          <li>
            Sesi bertahan <strong>12 jam</strong>, lalu Anda diminta masuk lagi. Ini sengaja:
            dashboard sering dibuka di komputer bersama.
          </li>
          <li>
            Kalau akun Anda dinonaktifkan admin lain, akses langsung terputus pada permintaan
            berikutnya &mdash; tidak menunggu sesi habis.
          </li>
          <li>
            Percobaan masuk dibatasi <strong>10 kali per 15 menit</strong> dari satu jaringan.
            Kalau kena batas, tunggu lalu coba lagi; itu bukan kerusakan.
          </li>
          <li>
            Lupa kata sandi? Tidak ada tombol reset lewat email. Minta admin lain membuka
            tab <strong>Admin</strong> dan menonaktifkan akun Anda, lalu mendaftarkannya lagi
            dengan email yang sama dan kata sandi baru.
          </li>
        </ul>
      </section>

      {/* ---------- Antrean ---------- */}
      <section className="kartu" id="antrean">
        <h2>2. Antrean &mdash; pekerjaan harian</h2>
        <p>
          Tab pertama yang terbuka. Isinya <strong>hanya pengajuan berstatus PROSES</strong>,
          diurutkan dari yang <strong>paling lama tidak diperbarui</strong> &mdash; bukan dari
          yang paling baru masuk. Jadi yang paling atas adalah yang paling perlu disentuh.
        </p>

        <h3>Tanda &ldquo;Tidak bergerak&rdquo;</h3>
        <p className="petunjuk">
          Lencana merah muncul kalau pengajuan tidak diperbarui melewati ambang hari yang
          disetel di tab Pengaturan. Ini alat bantu, bukan tuduhan &mdash; kadang memang
          sedang menunggu pihak lain.
        </p>

        <h3>Mencari pengajuan yang tidak ada di antrean</h3>
        <p className="petunjuk">
          Kotak cari di atas daftar menjangkau <strong>seluruh pengajuan</strong>, termasuk
          yang sudah SELESAI atau DIKEMBALIKAN dan karena itu tidak muncul di antrean. Ketik
          nomor, judul, atau nama OPD. Kosongkan lagi untuk kembali ke antrean.
        </p>

        <h3>Ubah tahap &mdash; cara tercepat memindahkan titik</h3>
        <p className="petunjuk">
          Tombol biru di tiap kartu. Isinya satu pilihan berisi enam tahap, dari
          <strong> 1. Masuk</strong> sampai <strong>6. Selesai</strong>. Pilih yang sekarang
          sudah dicapai, isi tanggal kejadiannya, simpan &mdash; titik di kartu langsung
          pindah. Keterangan boleh dikosongkan, tapi kalau diisi, kalimat itulah yang dibaca
          OPD di lini masa.
        </p>
        <p className="petunjuk">
          Yang tersimpan tetap satu baris riwayat, jadi tidak ada dua catatan yang bisa saling
          bertentangan. Formulir ini hanya memendekkan jalannya.
        </p>
        <p className="petunjuk">
          Kalau tahap yang dipilih <strong>lebih awal</strong> dari posisi sekarang, akan muncul
          peringatan bahwa titiknya tidak akan bergerak. Itu bukan kerusakan: rel memakai stasiun
          terjauh yang pernah dicapai, bukan catatan terakhir. Untuk memundurkan atau membetulkan
          yang terlanjur salah, pakai <strong>Kelola riwayat</strong>.
        </p>

        <h3>Kelola riwayat &mdash; untuk membetulkan dan mencatat yang di luar rel</h3>
        <p className="petunjuk">
          Tombol yang paling sering dipakai. Setiap kali ada perkembangan, catat di sini:
          pilih <strong>tahap</strong>, isi <strong>tanggal</strong> kejadiannya (bukan
          tanggal Anda mengetik), dan tulis <strong>keterangan</strong> dengan kalimat yang
          bisa dibaca pemohon.
        </p>
        <p className="petunjuk">
          Riwayat inilah yang muncul sebagai lini masa di halaman publik. Kalau tidak ada
          yang mencatat, pemohon menelepon &mdash; dan itu yang hendak dikurangi sistem ini.
        </p>

        <h3>Rel enam titik di kartu monitoring</h3>
        <p className="petunjuk">
          Deretan titik <em>Masuk &rarr; Reviu &rarr; Pra Harmonisasi &rarr; Fasilitasi &rarr;
          Rapat &rarr; Selesai</em> di kaki tiap kartu <strong>tidak disetel langsung</strong>.
          Tidak ada tombol untuk menggesernya. Posisinya dihitung sendiri oleh sistem dari
          baris riwayat yang sudah Anda catat.
        </p>
        <p className="petunjuk">Aturannya tiga, dan hanya tiga:</p>
        <ul className="poin">
          <li>
            Titik yang menyala adalah <strong>stasiun terjauh</strong> yang pernah disentuh,
            bukan baris yang terakhir dicatat. Jadi mencatat kejadian lama menyusul tidak
            akan memundurkan rel.
          </li>
          <li>
            Hanya enam tahap yang ada di rel. Di formulir, keenamnya dikelompokkan di bawah
            judul <strong>&ldquo;Menggerakkan rel&rdquo;</strong> dan diberi nomor stasiun.
            Tahap di kelompok bawah &mdash; Lainnya, Perbaikan, Dikembalikan &mdash; tetap
            tersimpan dan tetap tampil ke pemohon, tapi <strong>tidak memajukan titik</strong>.
          </li>
          <li>
            Pengajuan berstatus <strong>SELESAI</strong> relnya selalu ditampilkan penuh,
            apa pun isi riwayatnya.
          </li>
        </ul>
        <p className="petunjuk">
          Jadi kalau sebuah kartu menulis &ldquo;Tahap 1 dari 6&rdquo; padahal berkasnya jelas
          sudah sampai pra harmonisasi, penyebabnya hampir selalu satu: baris riwayatnya
          bertahap <strong>Lainnya</strong>. Ada dua cara membereskannya, dan pilih menurut
          maksudnya:
        </p>
        <ul className="poin">
          <li>
            <strong>Ubah tahap</strong> kalau catatan lamanya memang benar dan Anda cuma ingin
            titiknya maju. Menambah satu baris baru, yang lama tetap utuh.
          </li>
          <li>
            <strong>Kelola riwayat &rarr; Ubah</strong> kalau baris lamanya yang salah pilih
            tahap. Membetulkan di tempat, tidak menambah catatan baru.
          </li>
        </ul>

        <h3>Membetulkan dan menghapus baris</h3>
        <p className="petunjuk">
          Di dalam <strong>Kelola riwayat</strong>, tiap baris punya tombol <strong>Ubah</strong>
          dan <strong>Hapus</strong>. Ubah untuk membetulkan tahap, tanggal, atau keterangan
          yang salah ketik. Hapus hanya untuk baris yang memang tidak pernah terjadi &mdash;
          bukan untuk kejadian yang batal, karena pembatalan itu sendiri kabar yang perlu
          dibaca pemohon; catat sebagai baris baru saja.
        </p>
        <p className="petunjuk">
          Keduanya tercatat di tab <strong>Log</strong> lengkap dengan tahap sebelumnya, jadi
          selalu ada jejak isi lama sebuah baris. Baris yang sudah dihapus tidak bisa
          dikembalikan sendiri; pemulihannya lewat cadangan harian.
        </p>
        <p className="petunjuk">
          Pilih tahap <strong>Lainnya</strong> hanya bila kejadiannya memang di luar keenam
          stasiun &mdash; misalnya konsultasi atau surat menyurat. Kalau kejadiannya
          sebenarnya salah satu stasiun, pilih stasiunnya, supaya rel di halaman publik tidak
          tertinggal dari kenyataan.
        </p>

        <h3>Ubah status</h3>
        <p className="petunjuk">
          Tiga status yang ada:
        </p>
        <ul className="poin">
          <li>
            <span className="lencana lencana-proses">PROSES</span> Masih berjalan. Semua
            pengajuan baru mulai di sini.
          </li>
          <li>
            <span className="lencana lencana-selesai">SELESAI</span> Rampung. Pengajuan keluar
            dari antrean, tapi tetap terlihat di Monitoring.
          </li>
          <li>
            <span className="lencana lencana-dikembalikan">DIKEMBALIKAN</span> Perlu diperbaiki
            OPD. <strong>Wajib mengisi alasan</strong> &mdash; ada beberapa alasan yang sering
            terpakai sebagai pilihan cepat, dan Anda tetap bisa mengetik sendiri.
          </li>
        </ul>
        <p className="petunjuk">
          Alasan pengembalian tampil ke pemohon di halaman detail. Tulis yang jelas: itu satu-satunya
          petunjuk yang mereka punya untuk memperbaiki.
        </p>
      </section>

      {/* ---------- Rekap ---------- */}
      <section className="kartu" id="rekap">
        <h2>3. Rekap &mdash; angka dan laporan</h2>
        <p>Empat tabel siap salin ke laporan:</p>
        <ul className="poin">
          <li><strong>Per status</strong> &mdash; jumlah PROSES, SELESAI, DIKEMBALIKAN, dan totalnya.</li>
          <li><strong>Per OPD</strong> &mdash; OPD mana yang paling banyak mengajukan.</li>
          <li><strong>Per bulan</strong> &mdash; sebaran pengajuan sepanjang tahun.</li>
          <li>
            <strong>Rata-rata lama proses</strong> &mdash; dihitung dari pengajuan yang sudah
            SELESAI saja. Yang masih berjalan tidak ikut, karena lamanya belum diketahui.
          </li>
        </ul>
        <p className="petunjuk">
          Butuh angkanya dalam Excel? Pakai tab <a href="#cadangan">Cadangan</a> &mdash; datanya
          lengkap dan bisa diolah sendiri dengan pivot.
        </p>
      </section>

      {/* ---------- OPD ---------- */}
      <section className="kartu kartu-peringatan" id="opd">
        <h2>4. OPD &mdash; kode sebagai kunci masuk</h2>
        <p>
          <strong>Bagian terpenting di panduan ini.</strong> Kode OPD bukan sekadar singkatan:
          ia adalah <strong>kunci masuk form pengajuan</strong>. Siapa pun yang memegang kode
          sebuah OPD bisa mengirim pengajuan atas nama OPD itu.
        </p>

        <h3>Cara kerjanya</h3>
        <ol className="poin">
          <li>Pemohon membuka <Link to="/ajukan">/ajukan</Link> dan memasukkan kode OPD-nya.</li>
          <li>Sistem memeriksa, lalu menampilkan nama OPD supaya pemohon bisa memastikan.</li>
          <li>Selama kode belum cocok, kolom judul dan pemohon <strong>tidak muncul sama sekali</strong>.</li>
          <li>Kode diperiksa <strong>sekali lagi</strong> saat mengirim, jadi tidak bisa dilewati.</li>
        </ol>

        <h3>Membagikan kode</h3>
        <p className="petunjuk">
          Berikan kode hanya ke <strong>penghubung resmi</strong> tiap OPD, lewat jalur yang
          bisa dipertanggungjawabkan. Kode dipakai berulang untuk semua pengajuan dari OPD itu,
          jadi ia bukan sesuatu yang disebar di grup terbuka.
        </p>

        <h3>Menambah OPD</h3>
        <p className="petunjuk">
          Isi kode, nama resmi, dan nama singkat, lalu <strong>Tambah</strong>. Nama resmi
          inilah yang tersimpan di setiap pengajuan OPD tersebut &mdash; pemohon tidak pernah
          mengetiknya sendiri. Itulah yang menghentikan lima ejaan untuk satu instansi.
        </p>

        <h3>Ganti kode</h3>
        <p className="petunjuk">
          Dipakai kalau kode tersebar ke luar OPD-nya. Kode lama <strong>langsung berhenti
          berlaku</strong>; pengajuan yang sudah masuk tidak terpengaruh sama sekali. Setelah
          mengganti, beritahukan kode barunya ke OPD tersebut &mdash; sistem tidak
          mengirimkannya sendiri.
        </p>

        <h3>Nonaktifkan</h3>
        <p className="petunjuk">
          OPD nonaktif tidak bisa lagi mengirim pengajuan baru, dan kodenya berhenti berlaku
          seketika. Pengajuan lamanya tetap tersimpan dan tetap terlihat. Kalau suatu saat OPD
          itu didaftarkan lagi dengan kode yang sama, barisnya dihidupkan kembali &mdash; bukan
          dibuat ganda.
        </p>

        <p className="petunjuk" style={{ marginBottom: 0 }}>
          <strong>Catatan:</strong> kode bawaan hasil pemasangan awal (BPKAD, BAPENDA, dan
          seterusnya) mudah ditebak siapa pun. Kalau kode benar-benar dimaksudkan menjaga,
          gantilah dengan sesuatu yang tidak bisa ditebak sebelum dibagikan.
        </p>
      </section>

      {/* ---------- Admin ---------- */}
      <section className="kartu" id="admin">
        <h2>5. Admin &mdash; akun Bagian Hukum</h2>
        <p>
          Hanya Bagian Hukum yang punya akun. OPD mengirim dan memantau tanpa masuk, jadi tidak
          ada puluhan akun OPD yang perlu diurus.
        </p>

        <h3>Menambah admin</h3>
        <p className="petunjuk">
          Isi email, nama, dan kata sandi minimal <strong>8 karakter</strong>. Kalau emailnya
          sudah dipakai admin yang masih aktif, sistem menolak dan menyebutkan emailnya.
        </p>

        <h3>Menonaktifkan admin</h3>
        <p className="petunjuk">
          Akses orang itu terputus pada permintaan berikutnya, bukan menunggu sesinya habis.
          Jejaknya di Log tetap tersimpan &mdash; catatan siapa mengubah apa tidak ikut hilang.
        </p>
        <p className="petunjuk">
          Emailnya <strong>bisa dipakai lagi</strong>: daftarkan ulang email yang sama dengan
          kata sandi baru, dan akunnya dihidupkan kembali.
        </p>

        <h3>Dua penjagaan yang tidak bisa dilanggar</h3>
        <ul className="poin">
          <li>Anda tidak bisa menonaktifkan akun Anda sendiri.</li>
          <li>
            Admin aktif terakhir tidak bisa dinonaktifkan. Tanpa ini, sistem bisa terkunci dari
            dirinya sendiri dan hanya bisa dibuka lewat baris perintah di server.
          </li>
        </ul>

        <h3>Ganti kata sandi saya</h3>
        <p className="petunjuk">
          Butuh kata sandi lama, jadi orang yang menemukan komputer Anda dalam keadaan terbuka
          tidak bisa langsung mengunci Anda keluar. Ikon mata di ujung kolom memperlihatkan apa
          yang Anda ketik &mdash; berguna untuk kata sandi panjang.
        </p>
      </section>

      {/* ---------- Pengaturan ---------- */}
      <section className="kartu" id="pengaturan">
        <h2>6. Pengaturan</h2>

        <h3>Keterbukaan data</h3>
        <ul className="poin">
          <li>
            <strong>Tampilkan nomor WhatsApp pemohon</strong> &mdash; bila dimatikan, pengunjung
            umum hanya melihat <span className="kode">0822****9690</span>. Bagian Hukum tetap
            melihat lengkap.
          </li>
          <li>
            <strong>Tampilkan tautan berkas</strong> &mdash; bila dimatikan, berkas hanya bisa
            dibuka setelah masuk.
          </li>
        </ul>
        <p className="petunjuk">
          Kedua sakelar diterapkan <strong>di server</strong>, bukan disembunyikan di tampilan.
          Yang dimatikan benar-benar tidak dikirim ke peramban.
        </p>

        <h3>Batas ukuran berkas</h3>
        <p className="petunjuk">
          Dalam MB, per jenis berkas. Ada batas atas yang tidak bisa dilampaui &mdash; menyetel
          lebih tinggi ditolak, karena jalur unggahnya tidak sanggup melayaninya dan pemohon
          hanya akan menunggu lama lalu gagal di tengah.
        </p>
        <p className="petunjuk">
          Batas ini langsung terpakai di form pengajuan dan di halaman{' '}
          <Link to="/panduan">Panduan</Link>; keduanya membaca angka yang sama, jadi tidak
          ada yang perlu diperbarui manual.
        </p>

        <h3>Antrean &amp; tampilan</h3>
        <ul className="poin">
          <li>
            <strong>Ambang &ldquo;tidak bergerak&rdquo;</strong> &mdash; berapa hari tanpa
            pembaruan sebelum sebuah pengajuan ditandai di antrean.
          </li>
          <li>
            <strong>Pengumuman di halaman depan</strong> &mdash; pita biru di atas halaman
            publik. Kosongkan bila tidak ada. Cocok untuk pemberitahuan libur atau perubahan
            prosedur.
          </li>
        </ul>
        <p className="petunjuk" style={{ marginBottom: 0 }}>
          Semua pengaturan tersimpan begitu Anda berpindah dari kolomnya &mdash; tidak ada
          tombol simpan besar di bawah.
        </p>
      </section>

      {/* ---------- Cadangan ---------- */}
      <section className="kartu" id="cadangan">
        <h2>7. Cadangan &amp; ekspor Excel</h2>

        <h3>Unduh Excel sekarang</h3>
        <p className="petunjuk">
          Menghasilkan berkas <span className="kode">.xlsx</span> berisi seluruh pengajuan,
          disusun saat itu juga. Susunan kolomnya <strong>sama persis dengan spreadsheet Google
          yang lama</strong>: 18 kolom form, lalu ID, Email Pemohon, Kode OPD, Diperbarui Pada,
          dan Diperbarui Oleh.
        </p>
        <p className="petunjuk">
          Kolom &ldquo;Tanggal dan Detail Proses&rdquo; disusun ulang dari riwayat, jadi
          bentuknya sama dengan yang selama ini diketik manual. Artinya berkas ini bisa dibaca
          balik oleh sistem lain &mdash; data Anda tidak terkurung di dalam SIMPEL.
        </p>

        <h3>Cadangan harian</h3>
        <ul className="poin">
          <li>Sistem menulis <strong>satu berkas Excel tiap hari</strong> secara otomatis.</li>
          <li>Yang disimpan <strong>tujuh berkas terbaru</strong>; begitu ada yang baru, yang paling tua terhapus sendiri.</li>
          <li>Setiap berkas dinamai menurut tanggalnya, jadi mudah dikenali.</li>
          <li>Semua bisa diunduh kapan saja lewat tombol di tabel.</li>
        </ul>
        <p className="petunjuk">
          Kalau layanan sempat mati seharian, cadangan yang terlewat tetap dikejar begitu
          layanan hidup lagi &mdash; sistem menanyakan &ldquo;apakah cadangan hari ini sudah
          ada?&rdquo;, bukan menunggu jam tertentu.
        </p>

        <h3>Buat cadangan sekarang</h3>
        <p className="petunjuk">
          Menimpa cadangan hari ini dengan keadaan terkini. Berguna sebelum melakukan sesuatu
          yang berisiko, misalnya menjalankan migrasi.
        </p>

        <div className="kartu kartu-peringatan" style={{ marginBottom: 0 }}>
          <p style={{ margin: 0 }}>
            <strong>Yang belum tercakup:</strong> cadangan ini berisi <em>data</em> pengajuan,
            bukan <em>berkas</em> yang diunggah OPD. Untuk pengamanan penuh, berkas di server
            dan basis data tetap perlu disalin terpisah &mdash; unduh cadangan Excel secara
            berkala dan simpan di luar server sebagai lapisan tambahan.
          </p>
        </div>
      </section>

      {/* ---------- Migrasi ---------- */}
      <section className="kartu" id="migrasi">
        <h2>8. Migrasi dari spreadsheet</h2>
        <p>
          Dipakai sekali di awal untuk memindahkan isi spreadsheet Google lama ke sistem ini.
          Setelah itu tab ini jarang disentuh lagi.
        </p>
        <ol className="poin">
          <li>Tempel tautan spreadsheet. Spreadsheet harus dapat dibuka siapa saja yang punya tautan.</li>
          <li>
            Jalankan <strong>uji coba</strong> lebih dulu. Ini membaca dan melaporkan tanpa
            menulis apa pun ke basis data.
          </li>
          <li>
            Baca laporannya. Dua hal yang paling perlu diperiksa: <strong>OPD yang tidak
            dikenali</strong> (nama yang belum ada di daftar OPD), dan <strong>selisih kolom
            16</strong> (lini masa yang tidak tersusun kembali persis seperti aslinya).
          </li>
          <li>Perbaiki daftar OPD bila perlu, ulangi uji coba, baru jalankan sungguhan.</li>
        </ol>
        <p className="petunjuk" style={{ marginBottom: 0 }}>
          Migrasi berjalan dalam satu transaksi: kalau ada satu baris yang gagal, tidak ada
          satu pun yang tersisip setengah jalan. Tetap saja, buat cadangan dulu sebelum
          menjalankannya sungguhan.
        </p>
      </section>

      {/* ---------- Log ---------- */}
      <section className="kartu" id="log">
        <h2>9. Log &mdash; siapa mengubah apa</h2>
        <p>
          Catatan tindakan penting: perubahan status, penambahan riwayat, penambahan dan
          penonaktifan OPD maupun admin, penggantian kode, ekspor, migrasi, dan percobaan kode
          OPD yang gagal.
        </p>
        <ul className="poin">
          <li>Tiap baris memuat waktu, siapa pelakunya, tindakannya, dan rinciannya.</li>
          <li>
            Log <strong>tidak bisa disunting atau dihapus</strong> lewat dashboard. Itulah yang
            membuatnya berguna sebagai bukti.
          </li>
          <li>
            Kode OPD sendiri tidak pernah ditulis ke log. Log bisa dibaca semua admin, dan
            menuliskannya di sana sama saja membocorkannya lagi.
          </li>
          <li>
            Banyak baris <span className="kode">KODE_OPD_SALAH</span> dari satu jaringan dalam
            waktu singkat berarti ada yang menebak-nebak. Pertimbangkan mengganti kode.
          </li>
        </ul>
      </section>

      {/* ---------- Rutin ---------- */}
      <section className="kartu" id="rutin">
        <h2>10. Alur kerja yang disarankan</h2>

        <h3>Setiap hari kerja</h3>
        <ol className="poin">
          <li>Buka tab <strong>Antrean</strong>. Kerjakan dari atas &mdash; yang paling lama tidak tersentuh.</li>
          <li>
            Untuk tiap pengajuan yang ada perkembangannya, buka <strong>Kelola riwayat</strong> lalu
            tambah barisnya. Pilih tahap dari kelompok &ldquo;Menggerakkan rel&rdquo; kalau berkasnya
            memang maju satu stasiun &mdash; itu yang membuat titik di kartu ikut berpindah.
          </li>
          <li>Perhatikan yang bertanda &ldquo;Tidak bergerak&rdquo;. Kalau memang menunggu pihak lain, catat itu sebagai riwayat supaya pemohon tahu.</li>
          <li>Tandai <strong>SELESAI</strong> begitu rampung, supaya antrean tetap mencerminkan pekerjaan nyata.</li>
        </ol>

        <h3>Setiap minggu</h3>
        <ol className="poin">
          <li>Unduh satu cadangan Excel, simpan di luar server.</li>
          <li>Lihat sekilas tab <strong>Log</strong> &mdash; terutama percobaan kode OPD yang gagal.</li>
        </ol>

        <h3>Saat ada OPD baru</h3>
        <ol className="poin">
          <li>Tambahkan di tab <strong>OPD</strong> dengan kode yang tidak mudah ditebak.</li>
          <li>Sampaikan kodenya ke penghubung resmi OPD tersebut.</li>
          <li>Arahkan mereka ke halaman <Link to="/panduan">Panduan</Link> untuk cara mengajukan.</li>
        </ol>
      </section>

      {/* ---------- Masalah ---------- */}
      <section className="kartu" id="masalah">
        <h2>11. Kalau ada masalah</h2>

        <h3>&ldquo;Akses Anda sudah dicabut&rdquo;</h3>
        <p className="petunjuk">
          Akun Anda dinonaktifkan admin lain. Minta salah satu admin aktif mendaftarkan email
          Anda kembali.
        </p>

        <h3>&ldquo;Terlalu banyak permintaan&rdquo;</h3>
        <p className="petunjuk">
          Pembatas laju sedang bekerja. Tunggu sebentar lalu ulangi &mdash; ini penjagaan
          terhadap percobaan bertubi-tubi, bukan kerusakan.
        </p>

        <h3>OPD melapor pengajuannya gagal terkirim</h3>
        <p className="petunjuk">
          Tanyakan pesan yang mereka lihat. Yang paling sering: kode OPD salah atau sudah
          diganti, berkas melebihi batas ukuran, atau berkas wajib belum lengkap. Ketiganya
          disebutkan apa adanya oleh sistem, jadi pesannya bisa dipercaya.
        </p>

        <h3>OPD tidak menemukan pengajuannya di Monitoring</h3>
        <p className="petunjuk">
          Cari dengan nomor pengajuan <span className="kode">BRB-2026-0001</span>, bukan
          judulnya. Kalau tetap tidak ada, kemungkinan pengirimannya memang tidak pernah
          selesai.
        </p>

        <h3>Halaman terlihat aneh setelah pembaruan</h3>
        <p className="petunjuk">
          Muat ulang paksa &mdash; <span className="kode">Ctrl</span> +{' '}
          <span className="kode">Shift</span> + <span className="kode">R</span> di komputer.
          Peramban kadang masih memakai tampilan versi lama.
        </p>

        <h3>Yang tidak bisa dilakukan lewat dashboard</h3>
        <ul className="poin">
          <li>Menghapus pengajuan. Sengaja &mdash; riwayat proses hukum tidak dihapus, hanya ditandai.</li>
          <li>Menyunting atau menghapus log.</li>
          <li>Mengubah nomor pengajuan yang sudah terbit.</li>
        </ul>
      </section>

      <section className="kartu">
        <h2>Butuh bantuan teknis?</h2>
        <p style={{ marginBottom: 0 }}>
          Untuk pertanyaan seputar prosedur, hubungi Bagian Hukum Setda Kabupaten Brebes.
          Untuk masalah yang terlihat seperti kerusakan sistem, sertakan waktu kejadian dan
          pesan yang muncul di layar &mdash; keduanya membuat penelusuran jauh lebih cepat.
        </p>
      </section>

      <div className="tombol-baris" style={{ justifyContent: 'flex-start' }}>
        <Link className="tombol tombol-utama" to="/admin">&larr; Kembali ke dashboard</Link>
      </div>
    </div>
  );
}
