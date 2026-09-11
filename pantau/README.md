# SIMPEL Pantau

Situs pemantauan Raperda/Raperbup Bagian Hukum Setda Kabupaten Brebes, tanpa
server yang harus dirawat.

Sumber kebenarannya spreadsheet: OPD mengirim lewat Google Form, Bagian Hukum
menyunting status dan lini masa langsung di Sheets. Situs ini hanya membaca dan
menampilkan.

```
OPD → Google Form (berkas → Drive Bagian Hukum)
          ↓
     Spreadsheet
          ↓  ekspor CSV publik
     Vercel · api/data.ts  ── ditarik paling sering sekali per 60 detik
          ↓
     Pengunjung; tombol berkas menuju langsung ke Drive
```

## Kenapa begini

Versi sebelumnya berjalan penuh di VPS dengan MariaDB. Yang mendorong perpindahan
ada dua: ongkos sewa bulanan, dan staf Bagian Hukum lebih cepat bekerja di Excel
daripada di dashboard. Keduanya alasan yang sah, jadi sumber kebenarannya
dikembalikan ke spreadsheet dan yang tersisa di sini murni tampilan.

Konsekuensinya disadari: tidak ada gerbang kode OPD, tidak ada jaminan nomor
unik, tidak ada log audit. Google Form terbuka bagi siapa pun yang punya
tautannya.

## Privasi

Nomor WhatsApp dan email pemohon **tidak pernah ikut keluar** dari
`src/pure/sheet.ts`. Penyaringan dilakukan di tempat data disusun, bukan di
halaman yang menampilkannya — supaya halaman baru yang lupa menyaring tidak bisa
membocorkannya.

Tapi itu hanya menutup jalur situs. **Spreadsheetnya sendiri harus ikut
ditutup**, karena selama ia bisa dibaca lewat tautan, isinya bisa diunduh
langsung tanpa melewati situs ini. Caranya: buat tab kedua khusus tampilan,

```
=QUERY(FORM!A:Z; "select B,C,D,P,Q,R,V"; 1)
```

lalu terbitkan **hanya tab itu** lewat *File → Share → Publish to web → pilih
tab → CSV*, dan arahkan `SHEET_GID` ke tab tersebut. Tab utama tetap tertutup.

## Environment

| Kunci | Wajib | Arti |
|---|---|---|
| `SHEET_ID` | ya | ID spreadsheet, bagian setelah `/d/` pada URL-nya |
| `SHEET_GID` | tidak | gid tab yang dibaca; bawaannya `0` |
| `VITE_URL_FORM` | tidak | tautan Google Form; bila kosong, menu "Ajukan" disembunyikan |

## Nomor pengajuan

Kolom `ID` dipakai kalau terisi. Baris yang kosong diberi nomor turunan
berakhiran `-B0001` supaya tetap punya alamat halaman detail — tanda bahwa ia
dibangkitkan, bukan nomor resmi.

Agar baris baru dari Form punya nomor resmi, pasang rumus di kolom `ID`:

```
="BRB-"&TEXT(A2;"yyyy")&"-"&TEXT(ROW()-1;"0000")
```

Aman karena Google Form menambah baris satu per satu, tidak pernah berbarengan.
Jangan menyortir atau menghapus baris, karena nomornya ikut bergeser.

## Kesegaran data

`api/data.ts` menarik paling sering sekali per 60 detik; sisanya dilayani dari
simpanan tepi Vercel. `stale-while-revalidate` membuat pengunjung tidak pernah
menunggu Google — mereka langsung menerima salinan terakhir sementara
penyegaran berjalan di belakang layar, termasuk saat Google bermasalah.

Realtime sungguhan tidak mungkin: spreadsheet tidak bisa mendorong pemberitahuan
ke situs, yang ada hanya menarik berkala.

## Pengembangan

```bash
npm install
npm run dev          # butuh `vercel dev` di port 3000 untuk /api/data
npm run periksa      # pemeriksaan tipe
npm run build
```

Jalur `/detail/...` dikembalikan ke `index.html` lewat `vercel.json`; tanpa itu
membuka alamat detail langsung akan 404 karena tidak ada berkas dengan nama itu.
Jalur `/api` dikecualikan supaya tidak ikut tertelan.

## Kode yang dipakai ulang

`src/pure/` disalin apa adanya dari versi VPS — pengurai CSV, pencocokan header,
pembaca kolom lini masa, rekap, dan pemetaan rel enam tahap. Salinan, bukan
impor lintas folder, supaya proyek ini berdiri sendiri saat di-deploy.
