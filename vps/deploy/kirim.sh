#!/usr/bin/env bash
#
# Kirim hasil build ke VPS lalu jalankan ulang layanan.
#
# Dijalankan dari komputer, bukan dari VPS. Membangun di komputer dan mengirim
# hasilnya membuat VPS 1 GB tidak perlu menjalankan tsc dan vite -- keduanya
# butuh ratusan MB yang tidak tersedia di sana.
#
# Memakai tar lewat ssh, bukan rsync: rsync tidak ada di Git Bash Windows, dan
# yang dikirim cuma ~260 KB sehingga sinkronisasi berbasis delta tidak terasa
# untungnya. Satu alat lebih sedikit yang harus terpasang di komputer.
#
#   ./vps/deploy/kirim.sh root@38.253.224.32 32030
#
# Argumen kedua (port SSH) boleh dikosongkan kalau server memakai port 22.

set -euo pipefail

TUJUAN="${1:?Pemakaian: kirim.sh pengguna@host [port]}"
PORT="${2:-22}"
AKAR="$(cd "$(dirname "$0")/.." && pwd)"

SSH=(ssh -p "$PORT")

echo "==> Membangun server"
(cd "$AKAR/server" && npm run build)

echo "==> Membangun web"
(cd "$AKAR/web" && npm run build)

echo "==> Membungkus hasil build"
BUNGKUS="$(mktemp -t simpel-rilis-XXXXXX.tar.gz)"
trap 'rm -f "$BUNGKUS"' EXIT
tar -czf "$BUNGKUS" -C "$AKAR" \
  server/dist server/sql server/package.json server/package-lock.json web/dist

echo "==> Mengirim dan memasang"
# Isi lama dibuang lebih dulu supaya berkas yang sudah tidak ada di build baru
# tidak tertinggal di server -- padanan --delete milik rsync.
"${SSH[@]}" "$TUJUAN" 'cat > /tmp/simpel-rilis.tar.gz' < "$BUNGKUS"
"${SSH[@]}" "$TUJUAN" 'set -e
  sudo mkdir -p /opt/simpel/server /opt/simpel/web
  rm -rf /tmp/rilis && mkdir -p /tmp/rilis
  tar -xzf /tmp/simpel-rilis.tar.gz -C /tmp/rilis
  sudo rm -rf /opt/simpel/server/dist /opt/simpel/server/sql /opt/simpel/web
  sudo mkdir -p /opt/simpel/web
  sudo cp -a /tmp/rilis/server/dist /opt/simpel/server/dist
  sudo cp -a /tmp/rilis/server/sql  /opt/simpel/server/sql
  sudo cp -a /tmp/rilis/server/package.json /tmp/rilis/server/package-lock.json /opt/simpel/server/
  sudo cp -a /tmp/rilis/web/dist/. /opt/simpel/web/'

echo "==> Memasang dependensi produksi"
"${SSH[@]}" "$TUJUAN" 'cd /opt/simpel/server && sudo npm ci --omit=dev --silent --no-audit --no-fund'

echo "==> Mengembalikan kepemilikan"
"${SSH[@]}" "$TUJUAN" 'sudo chown -R simpel:simpel /opt/simpel'

echo "==> Menjalankan ulang layanan"
"${SSH[@]}" "$TUJUAN" 'sudo systemctl restart simpel && sleep 3 && systemctl is-active simpel'

echo "==> Memeriksa kesehatan"
"${SSH[@]}" "$TUJUAN" 'curl -sf http://127.0.0.1:3101/api/sehat && echo'

echo "Selesai."
