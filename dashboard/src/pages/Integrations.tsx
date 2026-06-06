const INTEGRATIONS = [
  { name: 'Gmail',          status: 'demo',    note: 'OAuth live inbox — v1.2' },
  { name: 'Google Calendar',status: 'demo',    note: 'Calendar adapter — demo fixtures' },
  { name: 'Matter store',   status: 'active',  note: 'Firestore — read/write' },
  { name: 'Time & Billing', status: 'active',  note: 'Firestore — full state machine' },
  { name: 'Audit log',      status: 'active',  note: 'CREATE-only Firestore collection' },
  { name: 'Gemini 2.5 Pro', status: 'active',  note: 'Vertex AI — enrichment only' },
];

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  active: { bg: 'rgba(29,158,117,.06)', color: '#1D9E75', border: 'rgba(29,158,117,.25)', label: 'active' },
  demo:   { bg: 'rgba(169,132,53,.06)', color: '#A98435', border: 'rgba(169,132,53,.3)',  label: 'demo fixtures' },
};

export function Integrations() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
        Integrations
      </div>
      <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        Integrations
      </h1>
      <div style={{ display: 'grid', gap: 8, maxWidth: 560 }}>
        {INTEGRATIONS.map(intg => {
          const s = STATUS_STYLE[intg.status] ?? STATUS_STYLE.demo;
          return (
            <div key={intg.name} style={{
              display:      'flex',
              alignItems:   'center',
              gap:          12,
              padding:      '10px 14px',
              background:   'var(--color-background-primary)',
              border:       '1px solid var(--color-border-tertiary)',
              borderRadius: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{intg.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{intg.note}</div>
              </div>
              <span style={{
                flexShrink:    0,
                background:    s.bg,
                color:         s.color,
                border:        `1px solid ${s.border}`,
                borderRadius:  4,
                padding:       '2px 7px',
                fontSize:      10,
                fontFamily:    'var(--font-mono)',
                fontWeight:    600,
                letterSpacing: '0.04em',
              }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
