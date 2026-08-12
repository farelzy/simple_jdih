# SIMPEL Hukum Brebes — Dokumentasi Sistem

Sistem Informasi dan Manajemen Peraturan dan Pemantauan Proses Hukum
Raperda/Raperbup, Bagian Hukum Sekretariat Daerah Kabupaten Brebes.

Dokumen ini ditujukan untuk orang yang akan memelihara, memasang ulang, atau
melanjutkan pengembangan sistem ini. Untuk cara memakainya sehari-hari, lihat
halaman `/panduan` (OPD pemohon) dan `/admin/tutorial` (Bagian Hukum) di dalam
aplikasi.

---

## 1. Ringkasan

SIMPEL menggantikan Google Form + spreadsheet yang sebelumnya dipakai Bagian
Hukum untuk menerima dan memantau pengajuan Raperda/Raperbup.

Yang berubah dari cara lama:

| | Cara lama | SIMPEL |
|---|---|---|
| Pengiriman | Google Form terbuka | Form bergerbang kode OPD |
| Nama OPD | diketik bebas, lima ejaan untuk satu instansi | diambil dari daftar baku |
| Nomor pengajuan | tidak ada | `BRB-2026-0001`, berurut, dijamin unik |
| Lini masa | satu sel teks diketik manual | baris riwayat terstruktur |
| Pemantauan | pemohon menelepon | halaman publik, tanpa akun |
| Cadangan | tidak ada | harian otomatis + arsip pindah server |

Yang **tidak** berubah: susunan 18 kolom spreadsheet lama tetap jadi bentuk baku
ekspor, supaya data tidak terkurung di dalam sistem ini.

---

## 2. Tumpukan teknologi

| Lapis | Pilihan | Alasan singkat |
|---|---|---|
| Runtime | Node 22 | LTS, `fetch` bawaan, tanpa polyfill |
| Bahasa | TypeScript ketat (`noUncheckedIndexedAccess`) | indeks larik yang meleset ketahuan saat kompilasi |
| HTTP | Express 4 | cukup, dan tim mana pun bisa membacanya |
| Basis data | MariaDB 10.6+ | tersedia di semua VPS, transaksi InnoDB |
| Driver | `mysql2/promise` | `multipleStatements` **dimatikan** |
| Front end | React 19 + Vite 6 + React Router 7 | |
| Gaya | CSS biasa, tanpa Tailwind | dipindahkan apa adanya dari versi GAS |
| Excel | `exceljs` | ekspor dan pembacaan unggahan |
| Uji | Vitest + supertest | 340 uji, terhadap MariaDB sungguhan |
| Web server | Caddy | HTTPS otomatis, konfigurasi sepuluh baris |

Tidak ada Google API. Migrasi membaca endpoint ekspor CSV publik milik Google
yang tidak menuntut autentikasi — itulah sebabnya seluruh sistem ini tidak
memerlukan OAuth maupun akun layanan.

---

## 3. Susunan folder

```
vps/
├── server/
│   ├── sql/                    dijalankan berurut saat server naik
│   │   ├── 001-skema.sql       tabel
│   │   ├── 002-seed.sql        pengaturan bawaan
│   │   └── 003-opd-brebes.sql  daftar OPD Kabupaten Brebes
│   └── src/
│       ├── pure/               fungsi murni, tanpa I/O — diuji tanpa database
│       ├── repo/               semua SQL ada di sini, tidak di tempat lain
│       ├── services/           migrasi, penyimpanan berkas, ekspor, cadangan
│       ├── middleware/         sesi, penangan galat, pembatas laju
│       ├── routes/             menerjemahkan HTTP ke pemanggilan fungsi
│       ├── commands/           alat baris perintah
│       └── tests/              cerminan susunan di atas
├── web/src/
│   ├── pages/                  satu berkas per halaman
│   ├── components/             bagian yang dipakai lebih dari satu halaman
│   └── lib/                    pembungkus fetch dan pemformat
└── deploy/                     berkas systemd, contoh Caddyfile, skrip kirim
```

**Kenapa `pure/` dipisah.** Berkas di sana tidak menyentuh database, jaringan,
atau jam sistem. Mereka bisa diuji tanpa MariaDB, dan justru di situlah logika
yang paling mudah salah tinggal: penguraian CSV, penomoran, pembacaan lini masa,
pemecah pernyataan SQL, penulis arsip tar.

**Kenapa `repo/` dipisah dari `routes/`.** Rute hanya menerjemahkan HTTP.
Seluruh SQL ada di `repo/`. Kalau suatu saat ada kueri yang lambat, hanya satu
folder yang perlu dibaca.

---

## 4. Skema basis data

Tujuh tabel. Seluruhnya InnoDB, `utf8mb4`.

```
opd ──────────┐
              │ opd_id (NULL bila tak dikenali saat migrasi)
              ↓
          pengajuan ──┬──→ riwayat   (ON DELETE CASCADE)
                      └──→ berkas    (ON DELETE CASCADE)

admin        akun Bagian Hukum
pengaturan   pasangan kunci-nilai
log          jejak audit, tidak pernah dihapus lewat aplikasi
```

### `opd`
`kode` **UNIQUE** merangkap dua peran: pengenal pendek, sekaligus **kunci masuk
form pengajuan**. Karena itu ia tidak pernah ikut dalam jawaban rute publik.
`aktif = 0` berarti OPD tidak bisa lagi mengirim; barisnya tetap tinggal supaya
pengajuan lamanya masih punya rujukan.

### `pengajuan`
`nomor` **UNIQUE**, berbentuk `BRB-<tahun>-<urut 4 digit>`. `opd_teks` menyimpan
nama resmi OPD saat pengajuan dibuat — bukan hasil ketikan pemohon.

### `riwayat`
Satu baris per kejadian: `tanggal`, `tahap`, `keterangan`. Inilah pengganti satu
sel teks di kolom 16 spreadsheet lama.

### `berkas`
Menampung dua macam sekaligus, dibedakan `sumber`:
- `lokal` — diunggah lewat SIMPEL, `jalur` berisi nama acak di disk
- `tautan` — warisan migrasi, `jalur` berisi URL Google Drive apa adanya

### `pengaturan`
| Kunci | Arti |
|---|---|
| `batas_*` | batas ukuran per jenis berkas, dalam MB |
| `maks_berkas_*` | jumlah berkas maksimum untuk kolom yang boleh lebih dari satu |
| `publik_tampilkan_wa` | `FALSE` menyamarkan nomor jadi `0822****9690` |
| `publik_tampilkan_berkas` | `FALSE` menutup tautan berkas dari umum |
| `ambang_mandek_hari` | berapa hari tanpa pembaruan sebelum ditandai di antrean |
| `pengumuman` | pita di halaman depan; kosong berarti tidak ada |
| `nomor_terakhir` | cadangan penomoran |

Kedua sakelar `publik_*` diterapkan **di server**, bukan disaring di peramban.
Menyaring di peramban berarti datanya tetap terkirim dan terbaca siapa pun yang
membuka panel jaringan.

---

## 5. Antarmuka HTTP

Awalan `/api`. Yang bertanda 🔒 menuntut sesi admin.

### Publik
| Metode | Jalur | Keterangan |
|---|---|---|
| GET | `/publik/konteks` | pengumuman, daftar OPD (**tanpa kode**), tahap, status |
| GET | `/publik/monitoring` | seluruh pengajuan + hitungan + daftar tahun |
| GET | `/publik/detail/:nomor` | satu pengajuan, riwayat, berkas |
| POST | `/publik/opd/verifikasi` | periksa kode OPD; 20×/15 menit per IP |

### Pengajuan
| Metode | Jalur | Keterangan |
|---|---|---|
| GET | `/pengajuan/aturan` | aturan berkas yang berlaku, untuk menggambar form |
| POST | `/pengajuan/kirim` | kirim pengajuan; 5×/jam per IP |
| POST | `/unggah/draf` | buka draf; maks 5 draf terbuka per IP |
| POST | `/unggah/berkas` | unggah satu berkas, bytes mentah |
| DELETE | `/unggah/berkas` | batalkan berkas dalam draf |
| GET | `/unggah/:id` | unduh berkas |

### Sesi
| Metode | Jalur | Keterangan |
|---|---|---|
| POST | `/auth/masuk` | 10×/15 menit per IP |
| POST | `/auth/keluar` | |
| GET | `/auth/saya` | |

### Penyiapan
| Metode | Jalur | Keterangan |
|---|---|---|
| GET | `/setup/status` | apakah sistem sudah punya admin |
| POST | `/setup/admin` | admin pertama, dijaga token dari journald |
| POST 🔒 | `/setup/periksa-sheet`, `/setup/migrasi` | migrasi lewat tautan |
| POST 🔒 | `/setup/excel/periksa`, `/setup/excel/migrasi` | migrasi lewat unggahan |
| POST 🔒 | `/setup/pulihkan/periksa`, `/setup/pulihkan` | pemulihan dari arsip |

### Dashboard 🔒
| Metode | Jalur | Keterangan |
|---|---|---|
| GET | `/admin/data` | seluruh isi dashboard dalam satu permintaan |
| POST | `/admin/riwayat`, `/admin/status` | |
| POST/PUT/DELETE | `/admin/opd`, `/admin/opd/:id/kode`, `/admin/opd/:id` | |
| POST/DELETE | `/admin/admin`, `/admin/admin/:id` | |
| POST | `/admin/ganti-sandi`, `/admin/pengaturan` | |
| GET | `/admin/ekspor` | Excel, disusun saat itu juga |
| GET/POST | `/admin/cadangan`, `/admin/cadangan/:nama` | cadangan harian |
| GET | `/admin/cadangan-penuh` | arsip pindah server |
| POST | `/admin/pulihkan/periksa`, `/admin/pulihkan` | pemulihan |
| POST | `/admin/periksa-sheet`, `/admin/migrasi`, `/admin/excel/*` | migrasi |
| GET | `/admin/log` | |

---

## 6. Keamanan

### Gerbang kode OPD
Form pengajuan terbuka di internet tanpa akun. Yang menjaganya kode OPD, dan
kode itu **diperiksa dua kali**: sekali di rute verifikasi supaya form bisa
memandu pemohon, sekali lagi saat pengiriman. Yang kedua yang sebenarnya
menjaga — yang pertama hanya mengatur tampilan dan bisa dilewati siapa pun yang
memanggil rute kirim langsung.

Kode tidak pernah ikut dalam jawaban rute publik, dan tidak pernah ditulis ke
log audit. Log bisa dibaca semua admin; menuliskannya di sana sama saja
membocorkannya lagi.

### Sesi
JWT di cookie `httpOnly`, `SameSite=Strict`, berlaku 12 jam. Setiap permintaan
admin memeriksa ulang ke database bahwa akunnya **masih aktif**; tanpa itu, admin
yang dicabut aksesnya tetap bisa bekerja sampai tokennya kedaluwarsa — termasuk
mencabut balik orang yang mencabutnya.

### Pembatas laju per IP
| Rute | Batas |
|---|---|
| kirim pengajuan | 5 / jam |
| masuk | 10 / 15 menit |
| verifikasi kode OPD | 20 / 15 menit |
| unggah | 60 / jam |

Disimpan di memori proses, bukan database: menulis satu baris untuk tiap
permintaan justru menambah beban yang hendak dicegah.

### Penomoran pengajuan
Nomor diterbitkan di dalam kunci penasihat MariaDB (`GET_LOCK`), dan kuncinya
dilepas **setelah** commit — bukan di dalam transaksi. Melepasnya sebelum commit
membuat dua pengiriman bersamaan mendapat nomor kembar. Constraint `UNIQUE` pada
`nomor` jadi jaring pengaman terakhir.

Pernah dicoba dengan `SELECT ... FOR UPDATE`, dan itu menghasilkan deadlock pada
uji 20 pengiriman serentak karena gap lock InnoDB.

### Berkas
- Nama di disk **acak**, tidak pernah nama kiriman pemohon
- `jalurPenuh()` menolak apa pun yang keluar dari folder berkas
- Ditulis ke disk dengan `pipeline()`, tidak pernah ditampung utuh di memori
- Ukuran diperiksa tiga lapis: `Content-Length` → penjaga aliran → setelah tulis
- Diperiksa juga **di peramban** sebelum satu bita terkirim. Server memang
  menolak, tapi jawabannya tidak pernah sampai: ia membalas sebelum badan
  permintaan selesai terkirim lalu menutup koneksi, dan peramban hanya melihat
  sambungan putus

### Penjagaan agar sistem tidak terkunci dari dirinya sendiri
- Admin tidak bisa menonaktifkan akunnya sendiri
- Admin aktif terakhir tidak bisa dinonaktifkan
- Email bekas admin nonaktif bisa dipakai lagi (kolomnya UNIQUE sementara daftar
  hanya menampilkan yang aktif — tanpa ini email itu terkunci selamanya)

### Pesan galat
`multipleStatements` dimatikan pada sambungan database. Pesan galat internal
tidak pernah dikirim apa adanya di produksi — pesan MariaDB bisa memuat nama
tabel dan potongan kueri. Yang **memang** salah pakai dilempar sebagai
`GalatKlien` dan sampai ke pengguna apa adanya.

---

## 7. Alur penting

### Pengajuan masuk
```
Pemohon → /ajukan
  1. pilih jenis (Perda/Perbup) → menentukan berkas yang diminta
  2. masukkan kode OPD → diperiksa server → nama OPD ditampilkan
  3. unggah berkas → tiap berkas langsung ke disk, di bawah satu draf
  4. periksa → kirim
       ↓
  honeypot? → dijawab "berhasil" palsu, tidak menyimpan apa pun
  kode OPD diperiksa ULANG
  validasi berkas dari catatan draf di server (bukan dari kiriman peramban)
  transaksi: pengajuan + berkas + riwayat "Berkas masuk ke sistem"
       ↓
  nomor BRB-2026-XXXX
```

### Migrasi dari spreadsheet lama
Dua jalur masuk, satu pipa:

```
tautan spreadsheet ──→ ekspor CSV publik ──┐
                                            ├──→ baris[][] ──→ cocokkanHeader
unggahan .xlsx / .csv ──→ excelKeBaris ────┘                        ↓
                                                          urut menurut timestamp
                                                                    ↓
                                            transaksi tunggal: seluruhnya atau tidak sama sekali
```

Idempoten: baris yang judul dan tanggal masuknya sudah ada dilewati.

Dua hal yang selalu perlu dibaca di laporannya:
- **OPD tidak dikenali** — nama yang belum ada di daftar baku
- **selisih kolom 16** — lini masa yang tidak tersusun kembali persis seperti
  aslinya. Ini yang menangkap kalimat hilang atau terbelah

### Cadangan
| | Harian | Penuh |
|---|---|---|
| Isi | Excel, 23 kolom | dump SQL + berkas + Excel + petunjuk |
| Kapan | otomatis tiap hari | saat diminta |
| Disimpan | 7 terbaru di server | tidak disimpan, langsung diunduh |
| Untuk | melihat dan mengolah data | pindah server / pemulihan |

Penjadwalnya memeriksa tiap jam dan menanyakan *"apakah cadangan hari ini sudah
ada?"*, bukan *"apakah sekarang pukul 2 pagi?"*. Bedanya terasa saat layanan
sempat mati: cara ini mengejar ketinggalan, pemicu berbasis jam melewatkannya
diam-diam.

### Pemulihan
```
1. arsip dibongkar dan diperiksa LENGKAP — belum ada yang disentuh
2. keadaan sekarang disalin ke cadangan/sebelum-pulih-<tanggal>.tar.gz
3. database ditimpa (DROP + CREATE + INSERT, kunci asing dimatikan sementara)
4. berkas unggahan ditulis ke disk
```

Langkah 2 sengaja dinamai di luar pola rotasi tujuh hari, supaya justru berkas
itulah yang tidak ikut terbuang.

Nama di dalam tar yang hendak keluar dari folder tujuan (`../../etc/cron.d/x`)
ditolak. Arsip pemulihan diunggah manusia dan belum tentu buatan sistem ini.

---

## 8. Memasang dari nol

Diuji pada Ubuntu 22.04.

```bash
# 1. Paket
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs mariadb-server caddy

# 2. Basis data
mariadb -e "CREATE DATABASE simpel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mariadb -e "CREATE USER 'simpel'@'localhost' IDENTIFIED BY '<sandi acak>';"
mariadb -e "GRANT ALL ON simpel.* TO 'simpel'@'localhost'; FLUSH PRIVILEGES;"

# 3. Kode — dibangun di komputer, hasilnya dikirim
#    (VPS kecil tidak perlu menjalankan tsc dan vite)
cd vps/server && npm run build
cd ../web && npm run build
# kirim server/dist, server/sql, package*.json, dan web/dist ke /opt/simpel

cd /opt/simpel/server && npm ci --omit=dev

# 4. .env — salin dari .env.contoh, isi DB_PASSWORD dan JWT_SECRET
openssl rand -hex 32          # untuk JWT_SECRET

# 5. Layanan
useradd --system --home /opt/simpel --shell /usr/sbin/nologin simpel
chown -R simpel:simpel /opt/simpel
cp deploy/simpel.service /etc/systemd/system/
systemctl enable --now simpel

# 6. Caddy — lihat deploy/Caddyfile.contoh
systemctl reload caddy
```

Skema tabel dibuat sendiri saat server pertama hidup; tidak ada alat migrasi
terpisah. Setiap berkas SQL ditulis idempoten (`CREATE TABLE IF NOT EXISTS`,
`INSERT IGNORE`), jadi aman dijalankan tiap kali server naik.

Token penyiapan dicetak ke journald saat pertama hidup:

```bash
journalctl -u simpel -n 40 | grep -A2 "BELUM DISIAPKAN"
```

Buka `/setup`, masukkan token, buat admin pertama. Lalu pilih salah satu:
migrasi dari spreadsheet, unggah Excel, atau pulihkan dari cadangan penuh.

### Variabel lingkungan

| Kunci | Wajib | Keterangan |
|---|---|---|
| `PORT` | | bawaan 3101 |
| `DB_HOST`, `DB_USER`, `DB_NAME` | ✓ | |
| `DB_PASSWORD` | | kosong bila MariaDB memakai autentikasi soket |
| `JWT_SECRET` | ✓ | minimal 32 karakter |
| `GOOGLE_*`, `DRIVE_FOLDER_ID`, `SHEETS_ID` | ✓ | **sisa lama**, isi apa saja |
| `DIR_BERKAS` | | bawaan `/opt/simpel/berkas` |
| `DIR_CADANGAN` | | bawaan `/opt/simpel/cadangan` |
| `CADANGAN_SIMPAN_HARI` | | bawaan 7 |
| `BASE_URL` | | menyusun URL berkas di lembar ekspor agar bisa diklik |

`konfig.ts` masih mewajibkan kunci Google sekalipun integrasinya sudah dibuang.
Membersihkannya adalah pekerjaan kecil yang belum dikerjakan.

---

## 9. Operasi harian

```bash
# Status dan log
systemctl status simpel
journalctl -u simpel -f
journalctl -u simpel -n 100 --no-pager | grep -i galat

# Menerapkan versi baru (dijalankan dari komputer)
./vps/deploy/kirim.sh pengguna@host

# Cadangan
ls -la /opt/simpel/cadangan/

# Memakai database langsung
mariadb -u simpel -p simpel
```

### Uji

```bash
cd vps/server
npm test              # 340 uji, butuh MariaDB
npm run periksa       # tsc --noEmit
```

Uji berjalan terhadap MariaDB **sungguhan**, bukan tiruan — perilaku kunci
penasihat, gap lock, dan constraint UNIQUE tidak bisa diuji dengan tiruan.
`fileParallelism: false` karena seluruh berkas uji berbagi satu skema.

---

## 10. Pemecahan masalah

| Gejala | Sebab yang paling sering |
|---|---|
| "Terjadi kesalahan di server" | galat sungguhan; lihat `journalctl -u simpel` |
| Unggahan putus di tengah | berkas melebihi batas; server menutup koneksi sebelum badan selesai terkirim |
| "Akses Anda sudah dicabut" | akun dinonaktifkan admin lain |
| "Terlalu banyak permintaan" | pembatas laju; tunggu, bukan kerusakan |
| Halaman tampak versi lama | cache peramban; `Ctrl+Shift+R` |
| `position: sticky` tidak jalan | `overflow-x: hidden` pada `<body>` — jangan pernah ditambahkan di sana |
| Caddy gagal dimuat ulang | biasanya izin folder log; `caddy validate --config` dulu |
| Sertifikat tidak terbit | port 80 tidak sampai ke mesin; Let's Encrypt memvalidasi lewat sana |

---

## 11. Keputusan desain, dan alasannya

**Tidak memakai Google API sama sekali.** Migrasi cukup membaca endpoint ekspor
CSV publik. Menambahkan OAuth berarti menambah Google Cloud Project, kredensial
yang harus diperbarui, dan satu lagi sistem yang bisa mati sendiri.

**Berkas disimpan di VPS, bukan Drive.** Tautan Drive mati ketika pemiliknya
pindah atau pensiun, dan berkas yang tidak dibuka aksesnya membuat Bagian Hukum
tidak bisa membacanya. Sejak ada cadangan penuh, alasan terbesar memilih Drive —
"supaya bisa ikut pindah" — sudah hilang.

**Kode OPD merangkap kunci masuk.** Menambah sistem akun untuk puluhan OPD
berarti reset sandi, akun terlantar, dan pekerjaan administrasi yang tidak
sepadan. Satu kode per OPD, dibagikan ke penghubung resminya, jauh lebih ringan.
Konsekuensinya: kode harus diperlakukan seperti kata sandi.

**Nama OPD tidak pernah diketik pemohon.** Inilah satu-satunya cara menghentikan
lima ejaan untuk satu instansi berkembang jadi delapan.

**Pengajuan tidak bisa dihapus lewat dashboard.** Riwayat proses hukum tidak
dihapus, hanya ditandai.

**Log tidak bisa disunting.** Itulah yang membuatnya berguna sebagai bukti.

**CSS dipindahkan apa adanya, bukan diterjemahkan ke Tailwind.** Terjemahan
pasti meleset di bayangan, gradien, dan jeda animasi — dan meleset sedikit di
banyak tempat terlihat lebih janggal daripada berbeda sekalian.

**Penulis tar dan pemecah SQL ditulis sendiri.** Keduanya format yang tidak
berubah, dan hanya sebagian kecilnya dipakai. Satu dependensi baru harus ikut
diperbarui, diaudit, dan dibawa ke setiap pemasangan seumur hidup proyek.

---

## 12. Yang belum dikerjakan

- `konfig.ts` masih mewajibkan `GOOGLE_*`, `DRIVE_FOLDER_ID`, `SHEETS_ID`
  padahal integrasinya sudah dibuang
- Kode OPD bawaan dari `003-opd-brebes.sql` (`BPKAD`, `BAPENDA`, …) mudah
  ditebak. Bila kode dimaksudkan benar-benar menjaga, gantilah sebelum
  dibagikan
- `nama_resmi` dan `nama_singkat` tertukar pada lima baris seed (BPKAD,
  Bapperida, Bapenda, BPBD, DP3KB) — terlihat di kartu konfirmasi pemohon dan
  kolom "Nama OPD Pemohon" pada ekspor
- Cadangan penuh disusun di memori. Untuk data sekarang jauh di bawah batas,
  tapi bila unggahan tumbuh sampai ratusan MB, bagian itu perlu diubah jadi
  aliran
- Ekspor ke Google Drive pernah diminta di awal; dilepas bersama seluruh
  integrasi Google
