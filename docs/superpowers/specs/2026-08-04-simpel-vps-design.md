# SIMPEL Hukum Brebes — Desain Aplikasi Mandiri di VPS

**Tanggal:** 4 Agustus 2026
**Status:** Draf desain, menunggu review
**Menggantikan:** `GAS_version/` (Google Apps Script) sebagai target pengembangan
**Sumber kebutuhan:** `DESAIN-SIMPEL-HUKUM-BREBES.md`

---

## 1. Kenapa pindah dari Apps Script

Versi Apps Script sudah jadi dan bisa dipakai, tapi menabrak batas yang melekat
pada platformnya:

- **Izin OAuth terlalu luas.** Tanpa proyek Google Cloud tersendiri, `DriveApp`
  dan `SpreadsheetApp` memaksa layar persetujuan meminta akses ke *seluruh*
  Drive dan *seluruh* spreadsheet akun pemilik.
- **Tidak ada database sungguhan.** Spreadsheet tidak punya transaksi, sehingga
  nomor pengajuan berurut dijaga oleh kunci buatan sendiri, bukan oleh constraint.
- **Batas runtime.** Blob maksimal ~50 MB, waktu jalan 6 menit, cache 100 KB per
  kunci — semuanya harus disiasati.

Pindah ke server sendiri menghilangkan ketiganya sekaligus, dengan biaya
tambahan Rp 0 karena VPS-nya sudah ada dan sudah dibayar.

---

## 2. Keputusan yang sudah diambil

| Topik | Keputusan | Alasan |
|---|---|---|
| Hosting | VPS yang sudah ada | Sudah dibayar; tidak ada langganan baru |
| Frontend | React 19 + Vite + Tailwind 4, build statis | Sama persis dengan stack BagiBayar yang sudah dikuasai |
| Backend | Express (Node 22) | Sama dengan BagiBayar; tanpa batas CPU seperti serverless |
| Database | **MariaDB lokal** yang sudah berjalan | Hanya makan 22 MB; MySQL-compatible sehingga `mysql2` terpakai apa adanya |
| Berkas | Google Drive, browser langsung ke Drive | Tidak membebani disk dan RAM VPS |
| Spreadsheet | **Tidak dicerminkan.** Export Excel dan Drive saat dibutuhkan | Cermin terus-menerus adalah satu-satunya bagian yang bisa gagal diam-diam dan membuat spreadsheet berbohong tanpa ada yang sadar |
| TLS & proxy | Caddy (sudah terpasang) | Sudah terbukti melayani 2 domain dengan Let's Encrypt |
| Login OPD | **Tidak ada** | Pemohon cukup mengisi form; monitoring terbuka |
| Login admin | Email + kata sandi | Hanya untuk Bagian Hukum, jumlahnya sedikit |
| Pemberitahuan email | **Tidak dibangun** | Diputuskan tidak perlu; OPD memantau lewat nomor pengajuan |

### Yang ditolak dan kenapa

- **Vercel** — paket Hobby yang gratis itu menurut ketentuannya untuk penggunaan
  pribadi non-komersial. Sistem resmi pemerintahan tidak masuk kategori itu, dan
  kalau ditegakkan pilihannya naik ke Pro (~$20/bulan) atau pindah mendadak.
- **Neon / TiDB Serverless** — tidak diperlukan setelah diketahui MariaDB sudah
  berjalan di VPS dengan konsumsi hanya 22 MB. Database di seberang jaringan
  hanya menambah latensi dan satu ketergantungan luar.
- **Cloudflare Workers** — gratis dan boleh untuk organisasi, tapi batas 10 ms
  CPU per permintaan membuat `bcryptjs` dan perakitan Excel di server tidak muat.
- **Render** — layanan gratisnya tidur setelah 15 menit dan bangun ~50 detik.
  Untuk halaman monitoring yang dibuka publik dari Linktree, itu tidak layak.

---

## 3. Kondisi VPS

Diukur langsung pada 4 Agustus 2026, sebelum dan sesudah pembersihan:

```
RAM total 842 MB · disk 5,2 GB dari 29 GB · Node v22.23.2 · MariaDB · Caddy
tersedia: 320 MB  →  422 MB  (setelah fwupd, ModemManager, udisks2 dimatikan)
```

Yang sudah berjalan dan **tidak boleh terganggu**:

| Layanan | RAM | Domain |
|---|---|---|
| `caddy` | 44 MB | reverse proxy semua domain |
| `semar` (node) | 43 MB | `jdih.marazystudio.my.id` |
| `combis-queue` + `php8.3-fpm` | 62 MB | `compbus.marazystudio.my.id` |
| `mariadb` | 22 MB | database bersama |

SIMPEL diperkirakan butuh 60–80 MB, sebanding dengan SEMAR. Dengan 422 MB
tersedia, muat dengan lega.

### Isolasi wajib

Proses SIMPEL dijalankan lewat systemd dengan `MemoryMax=200M` dan
`Restart=always`. Kalau ia bocor memori, yang mati hanya dia sendiri lalu
dihidupkan ulang — SEMAR dan combis tidak ikut terseret. Ini bukan kehati-hatian
berlebihan: ketiganya berbagi 842 MB, dan OOM killer memilih korban berdasarkan
skor, bukan berdasarkan siapa yang bersalah.

---

## 4. Arsitektur

```
Browser
  │
  ├─ berkas (≤30 MB) ──────────────────────► Google Drive
  │                                           (unggah bertahap langsung)
  │
  └─ HTTPS ─► Caddy ─┬─► berkas statis hasil `vite build`
                     │
                     └─► /api/* ─► Express (systemd, MemoryMax=200M)
                                     │
                                     ├─► MariaDB lokal   (sumber kebenaran)
                                     ├─► Google Sheets   (dibaca sekali saat migrasi)
                                     └─► Google Drive    (sesi unggah, export, backup)
```

**Bytes berkas tidak pernah melewati Express.** Server hanya membuat sesi unggah
bertahap lalu mengembalikan URL sesinya; browser mengirim potongan langsung ke
Google. Ini menjaga RAM VPS tetap datar berapa pun besar berkasnya, dan token
OAuth tidak pernah keluar dari server.

### Akses Google

Satu **refresh token** milik akun Bagian Hukum, disimpan di `.env` server.
Sekali saja akun itu menyetujui izin lewat browser, server bisa menulis ke Drive
dan Sheets selamanya tanpa interaksi lagi.

Yang **tidak** dipakai: Service Account. Service account tidak punya kuota
penyimpanan Drive sendiri, sehingga mengunggah ke Drive akun Gmail biasa gagal
dengan `Service Accounts do not have storage quota`. Ini jebakan yang banyak
disarankan tutorial dan baru ketahuan setelah semuanya terpasang.

---

## 5. Model data

MariaDB, database `simpel`. Relasional sungguhan — bukan lagi baris spreadsheet.

```sql
opd          (id, kode, nama_resmi, nama_singkat, aktif)
pengajuan    (id, nomor UNIQUE, opd_id, jenis_peraturan, judul,
              nama_pemohon, wa_pemohon, email_pemohon, status,
              keterangan, dibuat_pada, diperbarui_pada, diperbarui_oleh)
berkas       (id, pengajuan_id, kolom, nama, ukuran, mime,
              drive_file_id, url, diunggah_pada)
riwayat      (id, pengajuan_id, tanggal, tahap, keterangan,
              dicatat_oleh, dicatat_pada)
admin        (id, email UNIQUE, nama, password_hash, aktif, dibuat_pada)
pengaturan   (kunci PRIMARY KEY, nilai, keterangan)
log          (id, waktu, aktor, aksi, pengajuan_id, rincian, ip)
```

Perbaikan nyata dibanding versi spreadsheet:

- **`nomor` punya UNIQUE constraint** dan diterbitkan di dalam transaksi. Nomor
  kembar jadi mustahil, bukan sekadar tidak mungkin.
- **`berkas` jadi tabel tersendiri**, bukan tautan yang digabung koma dalam satu
  sel. Ukuran, jenis, dan id Drive tiap berkas tercatat rapi.
- **`opd_id` foreign key**, bukan nama yang diketik bebas. Lima ejaan BPKAD tidak
  bisa lahir lagi secara struktural.

---

## 6. Fitur

### 6.1 Publik — tanpa akun

- **Monitoring**: daftar pengajuan, kotak hitungan, pencarian, saringan jenis /
  status / tahun
- **Detail**: lini masa vertikal, daftar berkas, keterangan
- Dua sakelar keterbukaan diwarisi dari desain lama: `publik_tampilkan_wa` dan
  `publik_tampilkan_berkas`, diterapkan **di server**, bukan disaring di browser

### 6.2 Form pengajuan — tanpa akun

Empat langkah: Jenis → Pemohon → Berkas → Periksa.

Aturan bersyarat tetap ditegakkan: memilih *Daerah* menjadikan SK Tim dan Berita
Acara PANSUS wajib; memilih *Bupati* membuat keduanya tidak berlaku dan ditolak
kalau tetap dikirim.

Batas berkas **30 MB**, jenis per kolom sesuai `ATURAN_BERKAS`. Divalidasi dua
kali: sebelum unggah dan setelah berkas benar-benar ada di Drive.

### 6.3 Perlindungan form terbuka

Form terbuka ke internet tanpa akun, jadi perlu penangkal. Yang dipakai —
semuanya mandiri, tanpa layanan pihak ketiga:

1. **Rate limit per IP** — maksimal 5 pengajuan per jam, 20 per hari
2. **Honeypot** — kolom tersembunyi yang hanya diisi bot
3. **Batas draf** — satu IP maksimal 3 draf unggah aktif bersamaan

Tanpa ini, satu skrip iseng bisa menghabiskan kuota Drive Bagian Hukum.

### 6.4 Admin — perlu masuk

Email + kata sandi, `bcryptjs` + JWT di cookie `httpOnly`, `SameSite=Strict`.

Antrean (PROSES, terlama tidak bergerak di atas, bertanda kalau melewati ambang)
· tambah riwayat · ubah status (DIKEMBALIKAN wajib beralasan) · rekap · kelola
OPD · kelola admin · pengaturan · log audit.

### 6.5 Export

- **Excel (`.xlsx`)** — diunduh langsung
- **Ke Google Drive** — salinan dikirim ke folder arsip

Kolom `Tanggal dan Detail Proses` pada hasil export disusun ulang dari tabel
`riwayat` lewat `susunKolomProses`, bentuknya sama persis dengan yang selama ini
diketik manual — sehingga siapa pun yang terbiasa membaca spreadsheet tetap
menemukan isi yang dikenalnya.

Cermin otomatis ke Google Sheets **sengaja tidak dibangun**. Sinkronisasi
terus-menerus adalah satu-satunya bagian sistem yang bisa gagal tanpa suara,
dan spreadsheet yang diam-diam ketinggalan lebih berbahaya daripada tidak ada
spreadsheet sama sekali. Export sesuai kebutuhan memberi hasil yang sama tanpa
menanggung risiko itu.

### 6.6 Backup

`mysqldump` tiap malam lewat cron, diunggah ke Google Drive, disimpan 30 hari
terakhir. Data hukum di satu VPS tanpa cadangan adalah risiko nyata, dan karena
integrasi Drive sudah ada, penangkalnya nyaris gratis.

---

## 7. Migrasi dari spreadsheet

Dijalankan **sekali** di awal. Spreadsheet asli tidak disentuh sama sekali —
hanya dibaca — karena sumber kebenarannya sekarang pindah ke MariaDB.

1. Baca spreadsheet lewat Google Sheets API
2. Beri nomor `BRB-2026-0001` … `BRB-2026-0029`, urut menurut Timestamp terlama
3. Urai kolom 16 jadi baris `riwayat` terstruktur
4. Baris yang polanya tidak terbaca tetap dipindahkan dengan tahap `LAINNYA` dan
   teksnya utuh — tidak ada satu kalimat pun yang dibuang
5. Petakan nama OPD ke tabel `opd`; yang meragukan ditandai untuk diperiksa
   manusia, bukan ditebak diam-diam
6. Seluruhnya dalam satu transaksi

**Dua pengaman:**

- **Mode uji-coba** (`--dry-run`) menampilkan laporan lengkap tanpa menulis apa pun
- **Perbandingan bolak-balik** — kolom 16 disusun ulang dari hasil parsing lalu
  dibandingkan dengan aslinya. Kalau berbeda, id pengajuannya dilaporkan supaya
  diperiksa manusia sebelum dianggap selesai

Migrasi **idempoten**: menjalankannya dua kali tidak menggandakan data.

---

## 8. Yang diselamatkan dari versi Apps Script

Lima modul murni pindah ke TypeScript nyaris apa adanya, berikut **90 uji** yang
sudah lulus:

| Modul | Isi |
|---|---|
| `skema` | Definisi 18+5 kolom, pencocokan header beserta alias ejaan |
| `validasi` | Aturan wajib bersyarat Perda/Perbup, batas ukuran, jenis berkas, normalisasi nomor WA |
| `penomoran` | Nomor berurut, reset per tahun |
| `parser-riwayat` | Urai dan susun ulang kolom 16, termasuk uji bolak-balik |
| `rekap` | Hitungan per status/OPD/bulan, rata-rata lama proses, deteksi mandek, CSV |

Semuanya fungsi murni tanpa I/O, jadi pemindahannya mekanis dan ujinya ikut
tanpa perubahan berarti. Parser yang menjaga riwayat 29 pengajuan itu tidak
perlu ditulis ulang.

---

## 9. Struktur berkas

```
simpel/
├── server/
│   ├── src/
│   │   ├── index.ts              # bootstrap Express
│   │   ├── db.ts                 # pool mysql2
│   │   ├── rute/                 # publik.ts, pengajuan.ts, admin.ts, unggah.ts, export.ts
│   │   ├── layanan/              # google.ts, drive.ts, sheets.ts, excel.ts
│   │   ├── murni/                # skema, validasi, penomoran, parser-riwayat, rekap
│   │   ├── tengah/               # auth.ts, rate-limit.ts, galat.ts
│   │   └── migrasi/              # dari-spreadsheet.ts
│   ├── uji/                      # Vitest — 90 uji modul murni + uji rute
│   └── sql/                      # skema.sql, seed.sql
├── web/
│   ├── src/
│   │   ├── halaman/              # Monitoring, Detail, Pengajuan, Admin, Masuk
│   │   ├── komponen/
│   │   └── lib/                  # api.ts, unggah.ts, format.ts
│   └── vite.config.ts
├── deploy/
│   ├── simpel.service            # systemd + MemoryMax=200M
│   ├── Caddyfile.contoh
│   └── backup.sh
└── docs/
```

---

## 10. Penanganan galat

| Keadaan | Perilaku |
|---|---|
| MariaDB tidak bisa dihubungi | Halaman monitoring menampilkan pesan jelas, bukan halaman kosong |
| Refresh token Google kedaluwarsa | Unggah dan export berhenti dengan pesan tegas yang menyebut cara memperbaikinya; pengajuan yang sudah masuk tetap tersimpan di database |
| Kuota Drive habis | Unggah ditolak dengan pesan yang menyebut sebabnya |
| Unggah putus di tengah | Sesi bertahap bisa dilanjutkan; berkas gagal tidak meninggalkan baris di database |
| Proses kehabisan memori | systemd mematikan dan menghidupkan ulang hanya SIMPEL |

---

## 11. Pengujian

- **Modul murni** — 90 uji Vitest yang sudah ada, dipindahkan
- **Rute** — uji integrasi dengan MariaDB sungguhan di database `simpel_uji`
- **Migrasi** — dijalankan atas salinan data 29 baris, memastikan perbandingan
  bolak-balik kolom 16 bersih
- **Manual** — unggah 30 MB sampai selesai; unggah diputus lalu diulang; dua
  admin menambah riwayat pada pengajuan yang sama; pengunjung tanpa akses membuka
  `/admin`; refresh token dicabut paksa untuk memastikan pesan perbaikannya muncul
  dan pengajuan yang sudah masuk tetap aman

---

## 12. Urutan pengerjaan

| Tahap | Isi | Hasil yang bisa dilihat |
|---|---|---|
| 1 | Kerangka repo, skema SQL, pool db, systemd, Caddy | Aplikasi kosong hidup di subdomain |
| 2 | Pindahkan 5 modul murni + 90 uji | `npm test` hijau |
| 3 | Auth admin, rute publik, monitoring | Monitoring menggantikan tautan spreadsheet |
| 4 | Detail + lini masa | Riwayat terbaca rapi |
| 5 | Migrasi dari spreadsheet + laporan | 29 baris hidup di MariaDB |
| 6 | Integrasi Drive + unggah bertahap | Berkas 30 MB terbukti naik |
| 7 | Form pengajuan 4 langkah + rate limit | Menggantikan Google Form |
| 8 | Dashboard admin lengkap | Bagian Hukum berhenti mengetik di sel |
| 9 | Export Excel & Drive, backup nightly | Siap dipakai penuh |
| 10 | Rapikan tampilan, uji ponsel, panduan | Siap diserahkan |

Tahap 6 sengaja mendahului form pengajuan: unggah berkas adalah bagian yang
paling mungkin gagal, jadi dibuktikan lebih dulu sebelum banyak pekerjaan lain
menumpuk di atasnya.

---

## 13. Yang masih perlu diputuskan

1. **Nama subdomain** — akan dibuat sendiri oleh pemilik VPS
2. **Akun Google pemilik** — sekarang `mayasaribaghukum22@gmail.com`, akun
   pribadi. Refresh token akan terikat ke akun ini, dan kuota Drive 15 GB-nya
   dibagi dengan Gmail serta Photos. Akun dinas lebih aman untuk kesinambungan
3. **Nasib Google Form lama** — harus ditutup setelah sistem berjalan, karena dua
   pintu masuk yang sama-sama hidup menghasilkan data tidak sinkron
4. **Nasib `GAS_version/`** — dipertahankan sebagai cadangan atau dihapus
5. **Daftar OPD baku** — dibutuhkan untuk mengisi tabel `opd`

---

## Lampiran — sumber

- `DESAIN-SIMPEL-HUKUM-BREBES.md` — kebutuhan asli
- Spreadsheet `PERMOHONAN RAPERDA/RAPERBUP`, tab `PROGRES PENGAJUAN`, 29 baris.
  Header aslinya diverifikasi 4 Agustus 2026 dan berbeda dari dokumen desain di
  dua kolom (`Keterangan/Penjelasan **Rancangan** Perbup atau NA Perda` dan
  `Dasar Hukum Penyusunan **Raperda/Raperbup**`)
- Pengukuran VPS produksi, 4 Agustus 2026. Host, nama pengguna, dan kredensial
  SSH sengaja tidak ditulis di repositori — simpan di pengelola sandi atau
  `~/.ssh/config` masing-masing
