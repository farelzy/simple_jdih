import { useEffect, useState } from 'react';
import { segarkanSekarang } from '../lib/data';

/**
 * Penanda kesegaran data.
 *
 * Ada karena sumber kebenarannya spreadsheet yang disunting orang lain: tanpa
 * penanda ini, pengunjung tidak punya cara tahu apakah yang dilihatnya baru
 * atau tertinggal setengah jam. Waktunya ditulis relatif ("2 menit lalu")
 * karena yang ingin diketahui memang jaraknya, bukan jamnya.
 */
export function StatusData(
  { ditarik, menyegarkan, galat }:
  { ditarik?: string; menyegarkan: boolean; galat?: string }
) {
  // Dicentang berkala supaya tulisannya ikut menua tanpa perlu data baru.
  const [, paksaGambar] = useState(0);
  useEffect(() => {
    const j = setInterval(() => paksaGambar((n) => n + 1), 15_000);
    return () => clearInterval(j);
  }, []);

  return (
    <div className="status-data">
      <span className="petunjuk">
        {galat
          ? <span className="galat">Gagal menyegarkan; yang tampil data terakhir.</span>
          : menyegarkan
            ? 'Menyegarkan…'
            : <>Data diperbarui {jarakWaktu(ditarik)}</>}
      </span>
      <button
        type="button"
        className="tombol tombol-kecil"
        onClick={segarkanSekarang}
        disabled={menyegarkan}
      >
        {menyegarkan ? 'Menyegarkan…' : 'Segarkan'}
      </button>
    </div>
  );
}

/** '2026-09-11T04:30:00Z' -> 'baru saja' | '3 menit lalu' | '2 jam lalu' */
function jarakWaktu(iso?: string): string {
  if (!iso) return 'entah kapan';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'entah kapan';

  const detik = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (detik < 45) return 'baru saja';
  if (detik < 3600) return `${Math.round(detik / 60)} menit lalu`;
  if (detik < 86_400) return `${Math.round(detik / 3600)} jam lalu`;

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit'
  }).format(d) + ' WIB';
}
