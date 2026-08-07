export function KotakHitungan(
  { angka, label, jenis }: { angka: number; label: string; jenis?: string }
) {
  return (
    <div className={`hitungan-kotak ${jenis ?? ''}`}>
      <div className="hitungan-angka">{angka ?? 0}</div>
      <div className="hitungan-label">{label}</div>
    </div>
  );
}
