import { formatTanggal, labelTahap } from '../lib/format';

interface Kejadian {
  tanggal: string;
  tahap: string;
  keterangan: string;
}

/**
 * Lini masa vertikal -- bentuk yang paling sesuai dengan isi kolom yang selama
 * ini ditulis manual sebagai teks bebas dalam satu sel.
 */
export function LiniMasa({ kejadian }: { kejadian: Kejadian[] }) {
  if (!kejadian.length) {
    return <p className="text-sm text-teks-lemah">Belum ada riwayat tercatat.</p>;
  }

  return (
    <ol className="m-0 list-none p-0">
      {kejadian.map((k, i) => {
        const terakhir = i === kejadian.length - 1;
        return (
          <li
            key={`${k.tanggal}-${i}`}
            className={`relative pl-6 ${terakhir ? 'pb-0' : 'border-l-2 border-garis pb-5'}`}
            style={terakhir ? { borderLeft: '2px solid transparent' } : undefined}
          >
            <span
              aria-hidden="true"
              className={`absolute top-1 -left-[7px] h-3 w-3 rounded-full border-2 border-biru-utama
                          ${terakhir ? 'bg-biru-utama' : 'bg-white'}`}
            />
            <div className="text-sm font-semibold">{formatTanggal(k.tanggal)}</div>
            <div className="text-[11px] tracking-wide text-teks-lemah uppercase">
              {labelTahap(k.tahap)}
            </div>
            <div className="text-sm">{k.keterangan}</div>
          </li>
        );
      })}
    </ol>
  );
}
