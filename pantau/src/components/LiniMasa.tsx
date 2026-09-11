import { formatTanggal } from '../lib/format';

interface Kejadian {
  tanggal: string;
  keterangan: string;
}

/**
 * Lini masa vertikal -- bentuk yang paling sesuai dengan isi kolom yang selama
 * ini ditulis manual sebagai teks bebas dalam satu sel.
 */
export function LiniMasa({ kejadian }: { kejadian: Kejadian[] }) {
  if (!kejadian.length) {
    return <p className="petunjuk">Belum ada riwayat tercatat.</p>;
  }

  return (
    <ol className="linimasa">
      {kejadian.map((k, i) => (
        <li key={`${k.tanggal}-${i}`} className={i === kejadian.length - 1 ? 'terbaru' : ''}>
          <div className="linimasa-tanggal">{formatTanggal(k.tanggal)}</div>
          <div>{k.keterangan}</div>
        </li>
      ))}
    </ol>
  );
}
