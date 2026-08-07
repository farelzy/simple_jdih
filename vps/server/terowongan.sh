#!/usr/bin/env bash
# Pastikan terowongan SSH ke MariaDB VPS hidup sebelum uji dijalankan.
#
# Uji berjalan terhadap MariaDB 10.11.14 di VPS, bukan database lokal, supaya
# tidak mungkin uji lolos di komputer lalu gagal di produksi. Terowongannya
# kadang putus sendiri, dan gejalanya membingungkan: ECONNREFUSED 127.0.0.1:3307.
set -e
if timeout 3 bash -c 'echo > /dev/tcp/127.0.0.1/3307' 2>/dev/null; then exit 0; fi
pkill -f "3307:127.0.0.1:3306" 2>/dev/null || true
ssh -f -N -o BatchMode=yes -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
    -L 3307:127.0.0.1:3306 finnacantik@20.222.178.1
sleep 2
timeout 3 bash -c 'echo > /dev/tcp/127.0.0.1/3307' 2>/dev/null \
  && echo "terowongan dinyalakan ulang" \
  || { echo "GAGAL menyalakan terowongan ke VPS"; exit 1; }
