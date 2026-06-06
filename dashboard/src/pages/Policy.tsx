export function Policy() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
        Policy
      </div>
      <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        Policy & Autonomy
      </h1>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginBottom: 16 }}>
        FirmPolicy and AttorneyPolicyOverride controls — requires v1.2 backend.
      </div>
      <div style={{
        display:      'inline-block',
        padding:      '4px 10px',
        background:   'var(--color-background-secondary)',
        border:       '1px solid var(--color-border-tertiary)',
        borderRadius: 6,
        fontSize:     11,
        fontFamily:   'var(--font-mono)',
        color:        'var(--color-text-secondary)',
      }}>
        stub — v1.2
      </div>
    </div>
  );
}
