const GAYA: Record<string, string> = {
  PROSES: 'bg-[#FDF3E0] text-[#8A5E00]',
  SELESAI: 'bg-[#E6F5EC] text-[#1B6B40]',
  DIKEMBALIKAN: 'bg-[#FBEAEA] text-[#9B2C2C]'
};

export function LencanaStatus({ status }: { status: string }) {
  const s = String(status ?? '').toUpperCase();
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5
                  text-xs font-semibold ${GAYA[s] ?? GAYA.PROSES}`}
    >
      <span aria-hidden="true" className="text-[8px]">●</span>
      {s || 'PROSES'}
    </span>
  );
}
