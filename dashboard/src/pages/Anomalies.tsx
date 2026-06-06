export function Anomalies() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
        Anomalies
      </div>
      <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        Anomaly Roster
      </h1>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
        Anomaly detector results, severity tiers, and Gemini assessments — building in v1.1.2 Phase 1.
      </div>
    </div>
  );
}
