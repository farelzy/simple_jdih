const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/** '2026-07-23' -> '23 Juli 2026' */
export function formatTanggal(iso: string): string {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!cocok) return String(iso ?? '');
  return `${parseInt(cocok[3]!, 10)} ${BULAN[parseInt(cocok[2]!, 10) - 1]} ${cocok[1]}`;
}

export function formatUkuran(byte: number): string {
  const n = Number(byte) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(n / 1048576).toFixed(1).replace('.', ',')} MB`;
}

/** 'REVIU_HUKUM' -> 'Reviu Hukum' */
export function labelTahap(tahap: string): string {
  return String(tahap ?? '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (h) => h.toUpperCase());
}
