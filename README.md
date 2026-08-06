# SIMPEL Hukum Brebes

Sistem Informasi dan Manajemen Peraturan dan Pemantauan Proses Hukum
Raperda/Raperbup — Bagian Hukum Sekretariat Daerah Kabupaten Brebes.

Menggantikan Google Form pengajuan dan tab spreadsheet monitoring yang selama
ini dibagikan lewat Linktree.

## Isi repositori

| Folder | Isi | Status |
|---|---|---|
| `GAS_version/` | Versi Google Apps Script — dua berkas, tinggal tempel ke editor lalu deploy | Siap pakai |
| `docs/` | Spesifikasi desain | — |
| `vps/` | Versi aplikasi mandiri: Express + MariaDB + React | Dalam pengerjaan |

## Versi Apps Script

Jalur tercepat: tanpa `clasp`, tanpa proyek Google Cloud, tanpa mengubah manifes.
Buat proyek Apps Script, tempel `Code.gs` dan `Index.html`, deploy, lalu seluruh
penyiapan dikerjakan dari halaman depan aplikasi.

Panduan lengkap: [`GAS_version/PEMASANGAN.md`](GAS_version/PEMASANGAN.md)

Harganya: layar persetujuan Google meminta izin ke seluruh Drive, karena
mempersempitnya mengharuskan proyek Google Cloud tersendiri berikut Google Picker.

## Versi VPS

Aplikasi mandiri yang menghilangkan batasan Apps Script — izin Drive yang luas,
tidak adanya transaksi database, dan batas runtime.

| Lapisan | Pilihan |
|---|---|
| Frontend | React 19 + Vite + Tailwind 4, build statis |
| Backend | Express (Node 22) |
| Database | MariaDB |
| Berkas | Google Drive — browser mengunggah langsung, bytes tidak melewati server |
| Cermin | Google Sheets, disalin tiap perubahan |
| TLS & proxy | Caddy + Let's Encrypt |

Desain lengkap: [`docs/superpowers/specs/2026-08-04-simpel-vps-design.md`](docs/superpowers/specs/2026-08-04-simpel-vps-design.md)

## Fitur

- **Pengajuan** — form empat langkah, tanpa akun. SK Tim dan Berita Acara PANSUS
  otomatis wajib untuk Raperda dan tidak berlaku untuk Raperbup
- **Monitoring publik** — pencarian, saringan, hitungan per status
- **Detail** — lini masa proses yang terstruktur, bukan lagi teks bebas dalam satu sel
- **Dashboard Bagian Hukum** — antrean dengan penanda pengajuan yang tidak
  bergerak, riwayat, status, rekap, kelola OPD dan admin, log audit
- **Migrasi** — 29 pengajuan lama beserta riwayatnya dipindahkan utuh, dengan
  cadangan dan laporan perbandingan
- **Export** — Excel dan Google Drive

## Rahasia

Tidak ada kredensial di repositori ini. Kredensial database, refresh token
Google, dan JWT secret disimpan di `.env` yang tidak dilacak git.

## Lisensi

Dibuat untuk Bagian Hukum Sekretariat Daerah Kabupaten Brebes.
