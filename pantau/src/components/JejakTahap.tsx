/**
 * Rel enam stasiun di kaki kartu monitoring dan di kepala halaman detail.
 *
 * Posisinya datang dari server (`tahap_indeks`), tidak dihitung di sini:
 * pemetaan tahap ke stasiun hanya boleh hidup di satu tempat, yaitu
 * server/src/pure/tahap.ts. Yang dimiliki komponen ini cuma label pendeknya.
 *
 * Relnya sengaja lurus, padahal harmonisasi di Kanwil Kemenkum dan fasilitasi
 * di Biro Hukum Provinsi sering berjalan bersamaan. Yang menjaga tampilan tetap
 * jujur adalah `catatan` di bawah rel: ia menyebut kejadian terakhir apa
 * adanya, bukan nama stasiun.
 */

// Urutan harus sama dengan STASIUN di server/src/pure/tahap.ts. Kalau server
// suatu saat mengirim jumlah stasiun yang berbeda, titiknya tetap digambar
// sebanyak `total` dan yang kelebihan hanya kehilangan labelnya.
const LABEL = ['Masuk', 'Reviu', 'Pra Harmonisasi', 'Fasilitasi', 'Rapat', 'Selesai'];

export function JejakTahap(
  { indeks, total, catatan }: { indeks: number; total: number; catatan?: string }
) {
  const jumlah = Math.max(0, Math.floor(total || 0));
  if (jumlah === 0) return null;

  const kini = Math.min(Math.max(0, Math.floor(indeks || 0)), jumlah);
  const tuntas = kini >= jumlah;

  return (
    <div className="jejak">
      <ol className="jejak-rel" aria-label={`Tahap ${kini} dari ${jumlah}`}>
        {Array.from({ length: jumlah }, (_, i) => {
          const urut = i + 1;
          // Saat sudah tuntas, stasiun terakhir ikut ditandai "lewat", bukan
          // "kini". Titik oranye di ujung rel yang sudah penuh terbaca seperti
          // masih ada yang ditunggu.
          const keadaan = tuntas || urut < kini ? 'lewat' : urut === kini ? 'kini' : 'belum';
          return (
            <li key={urut} className={`jejak-titik ${keadaan}`}>
              <span className="jejak-label">{LABEL[i] ?? `Tahap ${urut}`}</span>
            </li>
          );
        })}
      </ol>

      <p className="jejak-catatan">
        {catatan ? <span className="jejak-kabar">{catatan}</span> : null}
        <span className="jejak-hitung">
          {kini === 0
            ? 'Belum ada tahap tercatat'
            : tuntas
              ? 'Tuntas'
              : `Tahap ${kini} dari ${jumlah}`}
        </span>
      </p>
    </div>
  );
}
