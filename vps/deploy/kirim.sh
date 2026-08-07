#!/usr/bin/env bash
#
# Kirim hasil build ke VPS lalu jalankan ulang layanan.
#
# Dijalankan dari komputer, bukan dari VPS. Membangun di komputer dan mengirim
# hasilnya membuat VPS 1 GB tidak perlu menjalankan tsc dan vite -- keduanya
# butuh ratusan MB yang tidak tersedia di sana.
#
#   ./vps/deploy/kirim.sh finnacantik@20.222.178.1

set -euo pipefail

TUJUAN="${1:?Pemakaian: kirim.sh pengguna@host}"
AKAR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Membangun server"
(cd "$AKAR/server" && npm run build)

echo "==> Membangun web"
(cd "$AKAR/web" && npm run build)

echo "==> Menyiapkan folder di VPS"
ssh "$TUJUAN" 'sudo mkdir -p /opt/simpel/server /opt/simpel/web \
  && sudo chown -R "$USER":"$USER" /opt/simpel'

echo "==> Mengirim server"
rsync -az --delete "$AKAR/server/dist/"         "$TUJUAN:/opt/simpel/server/dist/"
rsync -az --delete "$AKAR/server/sql/"          "$TUJUAN:/opt/simpel/server/sql/"
rsync -az          "$AKAR/server/package.json"  "$TUJUAN:/opt/simpel/server/"
rsync -az          "$AKAR/server/package-lock.json" "$TUJUAN:/opt/simpel/server/"

echo "==> Mengirim web"
rsync -az --delete "$AKAR/web/dist/" "$TUJUAN:/opt/simpel/web/"

echo "==> Memasang dependensi produksi"
ssh "$TUJUAN" 'cd /opt/simpel/server && npm ci --omit=dev --silent'

echo "==> Menjalankan ulang layanan"
ssh "$TUJUAN" 'sudo systemctl restart simpel && sleep 2 && systemctl is-active simpel'

echo "==> Memeriksa kesehatan"
ssh "$TUJUAN" 'curl -sf http://127.0.0.1:3101/api/sehat && echo'

echo "Selesai."
