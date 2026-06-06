export function Budgets() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
        Budgets
      </div>
      <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        Budget Utilization
      </h1>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
        Per-matter and per-client budget bars — building in v1.1.2 Phase 1.
      </div>
    </div>
  );
}
