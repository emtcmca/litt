interface Props {
  firmName: string;
  demoDate: string; // ISO YYYY-MM-DD
}

function formatDemoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}

export function DemoBanner({ firmName, demoDate }: Props) {
  const formatted = formatDemoDate(demoDate);
  return (
    <div style={{
      background: 'var(--color-ramp-amber-200)',
      color: 'var(--color-ramp-amber-900)',
      fontSize: 12,
      fontWeight: 500,
      textAlign: 'center',
      padding: '7px 16px',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      letterSpacing: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    }}>
      <span>Demo mode · {firmName} · synthetic data only</span>
      <span style={{
        background: 'rgba(0,0,0,0.12)',
        borderRadius: 4,
        padding: '2px 10px',
        fontWeight: 700,
        letterSpacing: '0.01em',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
      }}>
        System date: {formatted}
      </span>
    </div>
  );
}
