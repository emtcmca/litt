interface Props {
  firmName: string;
  demoDate: string;
}

export function DemoBanner({ firmName, demoDate }: Props) {
  return (
    <div className="bg-amber-400 text-amber-900 text-xs font-medium text-center py-2 px-4 sticky top-0 z-40">
      DEMO MODE — {firmName} — Synthetic data only — {demoDate}
    </div>
  );
}
