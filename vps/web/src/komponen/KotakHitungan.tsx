const WARNA: Record<string, string> = {
  total: 'text-teks-utama',
  proses: 'text-proses',
  selesai: 'text-selesai',
  dikembalikan: 'text-dikembalikan'
};

export function KotakHitungan(
  { angka, label, jenis }: { angka: number; label: string; jenis: keyof typeof WARNA }
) {
  return (
    <div className="rounded-[10px] border border-garis bg-white p-3.5 text-center">
      <div className={`text-2xl leading-tight font-bold ${WARNA[jenis]}`}>{angka ?? 0}</div>
      <div className="text-xs tracking-wide text-teks-lemah uppercase">{label}</div>
    </div>
  );
}
