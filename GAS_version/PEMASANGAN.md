# Pemasangan SIMPEL Hukum Brebes — versi tempel

Dua berkas, tanpa `clasp`, tanpa proyek Google Cloud, tanpa mengubah manifes.
Cukup buat proyek Apps Script, tempel dua berkas, deploy. Semua penyiapan
selanjutnya dikerjakan dari halaman depan aplikasi.

Waktu yang dibutuhkan: sekitar 15 menit.

| Berkas di sini | Ditempel jadi | Jenis |
|---|---|---|
| `Code.gs` | `Code.gs` | Apps Script |
| `Index.html` | `Index` | HTML |

---

## Yang perlu disiapkan

- Satu akun Google yang akan **memiliki** sistem ini
- Spreadsheet tujuan — boleh yang sudah berisi pengajuan, boleh yang kosong.
  Akun di atas harus punya akses **Editor** ke spreadsheet itu.

**Tentang akun pemilik.** Akun ini yang akan menjalankan seluruh aplikasi:
dia yang menulis ke spreadsheet dan Drive, dan hanya dia yang boleh menjalankan
wizard penyiapan. Untuk sistem resmi, akun dinas lebih aman daripada akun
pribadi dari sisi kesinambungan bila yang bersangkutan pindah tugas. Pilih
sekarang, bukan nanti — memindahkannya belakangan berarti memindahkan
kepemilikan proyek Apps Script dan spreadsheet sekaligus.

---

## 1. Buat proyek Apps Script

1. Buka [script.google.com](https://script.google.com) dengan akun pemilik
2. Klik **New project**
3. Ganti nama proyek dari "Untitled project" jadi **SIMPEL Hukum Brebes**
   (klik namanya di kiri atas)

## 2. Tempel `Code.gs`

Proyek baru sudah punya berkas `Code.gs` berisi contoh `myFunction`.

1. Klik di dalam editor, tekan **Ctrl+A** lalu **Delete** — buang semua isinya
2. Buka `Code.gs` dari folder ini, salin **seluruh** isinya
3. Tempel ke editor
4. **Ctrl+S** untuk menyimpan

## 3. Tempel `Index.html`

1. Di panel kiri, di sebelah **Files**, klik tanda **+** → pilih **HTML**
2. Ketik namanya: **`Index`**

   > Ketik `Index` saja, **tanpa** `.html`. Apps Script menambahkannya sendiri.
   > Nama ini harus persis — kode memanggil `createTemplateFromFile('Index')`,
   > dan salah huruf besar-kecil pun membuat aplikasi gagal dimuat dengan pesan
   > "No HTML file named Index was found".

3. Hapus isi bawaannya (**Ctrl+A**, **Delete**)
4. Salin seluruh isi `Index.html` dari folder ini, tempel
5. **Ctrl+S**

### Periksa sebentar sebelum lanjut

Di editor, pilih fungsi **`jalankanSeluruhUji`** dari dropdown di atas, lalu
klik **Run**. Buka **Executions** di panel kiri — hasilnya harus
`Seluruh uji lulus.`

Kalau muncul galat sintaks, berarti ada bagian yang terpotong saat menyalin.
Ulangi langkah 2.

## 4. Deploy

1. Klik **Deploy** (kanan atas) → **New deployment**
2. Klik ikon gerigi ⚙ di sebelah "Select type" → pilih **Web app**
3. Isi:

| Pengaturan | Nilai | Kenapa |
|---|---|---|
| Description | `v1` | Bebas, untuk menandai versi |
| Execute as | **Me** | Aplikasi menulis ke spreadsheet dan Drive atas nama Anda, sehingga OPD tidak perlu diberi akses edit ke spreadsheet sama sekali |
| Who has access | **Anyone with a Google account** | Pengunjung wajib masuk, tapi tidak perlu didaftarkan. Ini yang membuat email pemohon tercatat otomatis dan tidak bisa dipalsukan |

4. Klik **Deploy**

> **Jangan pilih "Anyone".** Pilihan itu membuat pengunjung anonim, dan email
> pemohon jadi kosong untuk semua orang. Aplikasi tetap jalan, tapi pemohon
> harus mengetik emailnya sendiri dan siapa pun bisa mengetik email siapa pun.

## 5. Beri izin

Saat pertama deploy, Google meminta persetujuan.

1. **Authorize access** → pilih akun pemilik
2. Akan muncul layar **"Google hasn't verified this app"**. Ini normal untuk
   skrip buatan sendiri yang belum melalui proses verifikasi Google.
   Klik **Advanced** → **Go to SIMPEL Hukum Brebes (unsafe)**
3. Baca daftar izin, lalu **Allow**

**Yang akan diminta, dan kenapa:**

| Izin | Dipakai untuk |
|---|---|
| Lihat, ubah, buat, hapus seluruh file Google Drive Anda | Menyimpan berkas pengajuan ke folder Drive |
| Lihat, ubah, buat, hapus seluruh spreadsheet Google Sheets Anda | Membaca dan menulis spreadsheet basis data |
| Lihat alamat email Anda | Mencatat siapa yang mengajukan dan siapa admin |
| Terhubung ke layanan eksternal | Unggah berkas langsung dari browser ke Drive |

Dua izin pertama terasa luas, dan memang luas. Itu harga dari "cukup tempel
dan deploy": mempersempitnya ke *hanya berkas yang dipakai aplikasi ini*
mengharuskan pemasangan proyek Google Cloud tersendiri berikut Google Picker.
Izin ini melekat pada akun pemilik saja — pengunjung dan OPD tidak dimintai
izin apa pun.

4. Salin **Web app URL** yang muncul. Ini alamat aplikasinya.

---

## 6. Penyiapan lewat halaman depan

Buka Web app URL tadi **sebagai akun pemilik**. Wizard penyiapan muncul sendiri.
Pengunjung lain hanya melihat "Sistem belum disiapkan" — jadi tidak ada yang
bisa mengarahkan aplikasi ini ke spreadsheet miliknya sendiri.

**Langkah 1 — tempel link spreadsheet.** Dua-duanya bisa:

- **Spreadsheet lama** yang sudah berisi pengajuan. Kolom 1–18 tidak diubah
  sama sekali, hanya ditambah lima kolom baru di sebelah kanan, sehingga
  tautan monitoring lama tetap bisa dibuka seperti biasa.
- **Spreadsheet kosong** yang baru dibuat. Seluruh kolom dibangun dari nol.

**Langkah 2 — hasil pemeriksaan.** Aplikasi membaca baris header dan
memberitahu apa yang akan dilakukannya sebelum menyentuh apa pun.

**Langkah 3 — jalankan.** Sheet pendukung dibuat otomatis: `Riwayat`, `OPD`,
`Pengaturan`, `Log`, `Admin`, plus folder Drive bernama `SIMPEL`.

### Kalau spreadsheet lama berisi data: coba di salinan dulu

Migrasi membuat cadangan sendiri sebelum menyentuh apa pun, tapi mencobanya di
salinan tetap lebih aman.

1. Buka spreadsheet asli → **File → Make a copy**
2. Jalankan wizard pada salinan itu, centang **Muat dan migrasikan data lama**
3. Periksa laporan yang muncul:
   - berapa baris diberi nomor pengajuan
   - berapa baris riwayat berhasil diurai
   - **peringatan kolom 16 harus tidak muncul.** Kalau muncul, buka pengajuan
     yang disebut dan bandingkan kolom 16 lama dengan hasil susun ulangnya
     sebelum melanjutkan
   - daftar OPD yang perlu diperiksa manusia
4. Kalau semuanya wajar, ulangi pada spreadsheet sungguhan

## 7. Isi daftar OPD dan admin

Buka **Dashboard → Pengaturan**.

**Daftar OPD.** Selama sheet ini kosong, form pengajuan terpaksa menerima
ketikan bebas — dan itu yang menghasilkan lima ejaan untuk satu instansi
(`BPKAD`, `BPKAD `, `BPKAD KAB. BREBES`, dan seterusnya). Isi dengan daftar
resmi OPD Kabupaten Brebes supaya OPD tinggal memilih.

**Admin.** Pemilik dan editor spreadsheet otomatis jadi admin. Untuk menambah
orang lain tanpa memberi akses ke spreadsheet, masukkan emailnya di kartu
**Admin**. Berlaku seketika.

**Folder penyimpanan.** Bisa dipindahkan kapan saja — tempel link folder Drive
mana pun. Berkas yang sudah masuk tetap di folder lamanya; yang pindah hanya
pengajuan berikutnya.

## 8. Serah terima

- Perbarui tautan Linktree ke Web app URL
- **Tutup Google Form lama** setelah sistem berjalan stabil. Dua pintu masuk
  yang sama-sama hidup akan menghasilkan data yang tidak sinkron
- Bagikan `docs/PANDUAN.md` ke Bagian Hukum dan OPD

---

## Mengelola setelah berjalan

### Memperbarui kode

1. Tempel ulang isi `Code.gs` dan/atau `Index` yang baru, **Ctrl+S**
2. **Deploy → Manage deployments** → ikon pensil ✏ → **Version: New version** →
   **Deploy**

> Tanpa menaikkan versi, pengunjung masih memakai kode lama. Menempel saja
> tidak cukup.

### Memindahkan ke spreadsheet lain

**Dashboard → Pengaturan → Ganti Link Spreadsheet.** Aplikasi kembali ke layar
penyiapan dan meminta link baru. Tidak ada data yang dihapus, dan data lama
tidak ikut pindah.

### Menambah atau mencabut admin

Lewat **Dashboard → Pengaturan → Admin**, atau dengan menambah/mengeluarkan
orang dari sharing spreadsheet sebagai *Editor*. Yang lewat sharing berlaku
setelah paling lama 5 menit; yang lewat aplikasi berlaku seketika.

### Mengubah batas ukuran berkas atau sakelar keterbukaan

**Dashboard → Pengaturan.** Tidak perlu deploy ulang. Batas maksimal 30 MB —
menyetel lebih tinggi ditolak karena jalur unggahnya memang tidak sanggup,
dan memaksakannya hanya membuat pemohon menunggu lama lalu gagal di tengah.

---

## Kalau ada masalah

| Gejala | Sebab yang paling mungkin |
|---|---|
| `No HTML file named Index was found` | Berkas HTML salah nama. Harus persis `Index`, bukan `index` atau `Index.html` |
| Halaman putih kosong | Ada bagian `Code.gs` yang terpotong saat menyalin. Jalankan `jalankanSeluruhUji` untuk memastikan |
| Perubahan kode tidak muncul | Deployment belum dinaikkan versinya — lihat "Memperbarui kode" |
| `Penyiapan hanya bisa dijalankan oleh pemilik aplikasi` | Anda membuka aplikasi dengan akun lain, bukan akun yang men-deploy |
| `Anda tidak memiliki akses EDIT ke spreadsheet ini` | Minta pemilik spreadsheet menambahkan akun pemilik aplikasi sebagai Editor |
| `Header sheet tidak dikenali` | Sheet yang dipilih bukan sheet pengajuan. Pilih sheet lain, atau mulai dari spreadsheet kosong |
| Pemohon tercatat tanpa email | Deployment memakai *Anyone* (anonim), bukan *Anyone with a Google account* |
| Dashboard tertutup padahal sudah jadi editor spreadsheet | Tunggu 5 menit, atau tambahkan diri Anda lewat Dashboard → Pengaturan → Admin |
| Unggah berkas gagal di tengah | Jaringan memutus unggahan. Ulangi. Berkas gagal tidak meninggalkan baris di spreadsheet |
| Halaman monitoring kosong padahal data ada | Nama sheet berubah setelah penyiapan. Jalankan **Ganti Link Spreadsheet** lalu siapkan ulang |
