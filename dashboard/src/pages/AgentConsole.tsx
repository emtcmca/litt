export function AgentConsole() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
        Agents
      </div>
      <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        Agent Console
      </h1>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
        Agent graph, tool registry, boundary stat, and inspector — building in v1.1.2 Phase 2.
      </div>
    </div>
  );
}
