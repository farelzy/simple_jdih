const KELAS: Record<string, string> = {
  PROSES: 'lencana-proses',
  SELESAI: 'lencana-selesai',
  DIKEMBALIKAN: 'lencana-dikembalikan'
};

export function LencanaStatus({ status }: { status: string }) {
  const s = String(status ?? '').toUpperCase();
  return <span className={`lencana ${KELAS[s] ?? KELAS.PROSES}`}>{s || 'PROSES'}</span>;
}
