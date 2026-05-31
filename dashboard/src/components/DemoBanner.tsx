interface Props {
  firmName: string;
  demoDate: string;
}

export function DemoBanner({ firmName, demoDate }: Props) {
  return (
    <div style={{
      background: 'var(--color-ramp-amber-200)',
      color: 'var(--color-ramp-amber-900)',
      fontSize: 12,
      fontWeight: 500,
      textAlign: 'center',
      padding: '8px 16px',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      letterSpacing: 0,
    }}>
      Demo mode / {firmName} / synthetic data only / {demoDate}
    </div>
  );
}
