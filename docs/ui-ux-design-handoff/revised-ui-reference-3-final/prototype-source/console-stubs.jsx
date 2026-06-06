/* ───────────────────────────────────────────────────────────────────────────
   Litt — Console · lighter Watch/Tune views
   Budgets, Clients & comms, Anomalies, Integrations. Real, focused surfaces
   grounded in the same fixture — lighter than the heroes (Deadlines, Collect,
   Brief), but never empty. Each one points its single live item back to the
   closeout, where resolution and its audit write actually happen.
─────────────────────────────────────────────────────────────────────────── */
const { useState: useStateStub } = React;

function money2(n) { return '$' + n.toLocaleString(); }

function PageHead({ title, tag, tagColor, sub }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>{title}</h1>
        {tag && <Mono style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: tagColor, background: `${tagColor}1a`, border: `1px solid ${tagColor}44`, borderRadius: 5, padding: '2px 7px' }}>{tag}</Mono>}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '64ch' }}>{sub}</p>
    </div>
  );
}

const ResolveLink = ({ label }) => (
  <a href="Litt — Daily Closeout.html" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: T.forest, color: T.brass, fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap' }}>
    {label || 'Resolve in closeout'} <Icon name="arrow" size={12} color={T.brass} />
  </a>
);

const Shell = ({ children, max = 920 }) => (
  <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
    <div style={{ maxWidth: max, margin: '0 auto', display: 'grid', gap: 18 }}>{children}</div>
  </div>
);

// ── Budgets ───────────────────────────────────────────────────────────────────
const BUDGETS = [
  { client: 'Acme Commercial Partners', matter: 'GC retainer', cap: 15000, committed: 11700, billed: 9000 },
  { client: 'Mercer Industries', matter: 'v. Dunlap Construction', cap: 40000, committed: 22400, billed: 18100 },
  { client: 'Lindqvist Holdings', matter: 'Okafor v. Lindqvist', cap: 25000, committed: 9000, billed: 7200 },
  { client: 'Reyes Logistics', matter: 'Vendor dispute', cap: 12000, committed: 4920, billed: 3100 },
  { client: 'Whitmore Group', matter: 'Employment advisory', cap: 8000, committed: 3360, billed: 2400 },
];
function ConsoleBudgets() {
  const WARN = 75, CRIT = 90;
  const rows = BUDGETS.map(b => ({ ...b, pct: Math.round((b.committed / b.cap) * 100) })).sort((a, b) => b.pct - a.pct);
  const over = rows.filter(r => r.pct >= WARN);
  return (
    <Shell>
      <PageHead title="Budgets" tag="watch" tagColor={T.gold} sub="Where every client retainer stands. Litt computes utilization from billed plus approved-unbilled and fires a threshold alert before a budget surprise can erode client trust." />
      <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 26, flexWrap: 'wrap' }}>
        {[['Budgeted matters', rows.length, 'across the book'], ['Over 75% warn', over.length, over.length ? 'needs a look' : 'all clear'], ['Thresholds', `${WARN} / ${CRIT}%`, 'warn / critical']].map(([k, v, s]) => (
          <div key={k} style={{ minWidth: 120 }}>
            <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint, display: 'block' }}>{k}</Mono>
            <div style={{ fontSize: 24, fontWeight: 600, color: typeof v === 'number' && over.length && k.includes('warn') ? T.gold : T.ink, lineHeight: 1.1, marginTop: 3 }}>{v}</div>
            <Mono style={{ fontSize: 10.5, color: T.faint }}>{s}</Mono>
          </div>
        ))}
      </section>
      <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.soft}`, background: T.wash2 }}>
          <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: T.muted, fontWeight: 600 }}>Utilization by matter</Mono>
        </div>
        {rows.map((r, i) => {
          const warn = r.pct >= WARN, crit = r.pct >= CRIT;
          const col = crit ? T.danger : warn ? T.gold : T.teal;
          return (
            <div key={r.client} style={{ padding: '14px 18px', borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${T.soft}`, display: 'grid', gap: 8, borderLeft: `3px solid ${warn ? col : 'transparent'}` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{r.client}</span>
                  <Mono style={{ fontSize: 11, color: T.faint, marginLeft: 8 }}>{r.matter}</Mono>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {warn && <Mono style={{ fontSize: 10, fontWeight: 600, color: col, background: `${col}1a`, border: `1px solid ${col}40`, borderRadius: 5, padding: '2px 7px' }}>{crit ? 'CRITICAL' : 'WARN'}</Mono>}
                  <Mono style={{ fontSize: 12.5, color: T.muted }}>{money2(r.committed)} / {money2(r.cap)}</Mono>
                  <span style={{ fontSize: 16, fontWeight: 700, color: col, minWidth: 42, textAlign: 'right' }}>{r.pct}%</span>
                </div>
              </div>
              <div style={{ position: 'relative', height: 7, borderRadius: 999, background: T.wash2, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: `${WARN}%`, top: -1, bottom: -1, width: 1, background: T.line, zIndex: 2 }} />
                <div style={{ height: '100%', width: `${r.pct}%`, background: col, borderRadius: 999 }} />
              </div>
              {warn && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 2 }}><span style={{ fontSize: 12, color: T.muted }}>Crossed the {WARN}% warning since last closeout — get ahead of it before the overage.</span><ResolveLink label="Review budget" /></div>}
            </div>
          );
        })}
      </section>
    </Shell>
  );
}

// ── Clients & comms lives in console-clients.jsx (full Relationships hero) ─────

// ── Anomalies ─────────────────────────────────────────────────────────────────
const DETECTORS = [
  ['Missing narrative', 1], ['Vague narrative', 0], ['Duplicate entry', 0], ['Round hours, no session', 0],
  ['Rate deviation', 0], ['Block-billing', 0], ['Forbidden phrases', 0], ['Stale pending (>30d)', 0],
  ['After-hours spike', 0], ['Excessive daily hours', 0], ['Weekend anomaly', 0], ['Negative duration', 0], ['Budget overrun', 0],
];
function ConsoleAnomalies() {
  const flagged = DETECTORS.reduce((s, d) => s + d[1], 0);
  const cleared = [
    { what: 'Duplicate of te-014 — auto-merged', when: '4:31 PM', by: 'billing_agent' },
    { what: 'Round-hours entry te-009 — session log matched', when: '2:02 PM', by: 'Dana Strand' },
  ];
  return (
    <Shell>
      <PageHead title="Anomalies" tag="watch" tagColor={T.gold} sub="Thirteen deterministic detectors run over every billing and operational pattern, scored by severity × confidence. Nothing is dismissed silently — clearing an anomaly always requires a reason on the record." />
      {/* open elevated */}
      <section style={{ background: T.surface, border: `1px solid rgba(155,45,35,.3)`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', flexWrap: 'wrap', borderLeft: `4px solid ${T.danger}` }}>
          <span style={{ width: 36, height: 36, borderRadius: 9, background: T.dangerSoft, border: '1px solid rgba(155,45,35,.22)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="alert" size={18} color={T.danger} /></span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: T.danger, fontWeight: 600 }}>1 elevated · reason required to clear</Mono>
            <div style={{ fontSize: 15.5, fontWeight: 600, color: T.ink, marginTop: 3 }}>Missing narrative on te-001</div>
            <Mono style={{ fontSize: 11.5, color: T.muted }}>Mercer Industries · $1,500 · MISSING_NARRATIVE · priority 2</Mono>
          </div>
          <ResolveLink label="Resolve in closeout" />
        </div>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }} className="co-grid">
        {/* detector grid */}
        <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '15px 17px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: T.muted, fontWeight: 600 }}>Detectors</Mono>
            <Mono style={{ fontSize: 10.5, color: flagged ? T.danger : T.teal }}>{flagged} firing · {DETECTORS.length} total</Mono>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {DETECTORS.map(([name, n]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 14, height: 14, borderRadius: 999, background: n ? T.dangerSoft : 'rgba(29,158,117,.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon name={n ? 'alert' : 'check'} size={8.5} color={n ? T.danger : T.teal} stroke={2.6} />
                </span>
                <span style={{ fontSize: 11.5, color: n ? T.ink : T.muted, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                {n > 0 && <Mono style={{ fontSize: 10.5, color: T.danger, fontWeight: 600 }}>{n}</Mono>}
              </div>
            ))}
          </div>
        </section>
        {/* cleared today */}
        <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '15px 17px' }}>
          <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: T.muted, fontWeight: 600, display: 'block', marginBottom: 11 }}>Cleared today</Mono>
          <div style={{ display: 'grid', gap: 10 }}>
            {cleared.map(c => (
              <div key={c.what} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{ width: 16, height: 16, borderRadius: 999, background: 'rgba(29,158,117,.12)', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}><Icon name="check" size={9} color={T.teal} stroke={2.6} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.35 }}>{c.what}</div>
                  <Mono style={{ fontSize: 10, color: T.faint }}>{c.when} · {c.by}</Mono>
                </div>
              </div>
            ))}
          </div>
          <Mono style={{ fontSize: 10.5, color: T.faint, display: 'block', marginTop: 13, paddingTop: 11, borderTop: `1px solid ${T.soft}`, lineHeight: 1.5 }}>Each clearance carries a reason and is appended to the audit ledger.</Mono>
        </section>
      </div>
    </Shell>
  );
}

// ── Integrations ──────────────────────────────────────────────────────────────
function ConsoleIntegrations() {
  const { INTEGRATIONS } = window.LITTC;
  const [connected, setConnected] = useStateStub({});
  const meta = {
    connected: { label: 'Connected', color: T.teal },
    ready: { label: 'Ready', color: T.gold },
    available: { label: 'Available', color: T.faint },
  };
  const icon = { gmail: 'mail', calendar: 'clock', ledes: 'dollar', clio: 'grid' };
  return (
    <Shell>
      <PageHead title="Integrations" tag="tune" tagColor={T.gold} sub="Where Litt reads from and writes to. Every connection runs through an MCP adapter with least-privilege scopes — read-only where reading is all that's needed, and never a credential Litt doesn't require." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {INTEGRATIONS.map(it => {
          const isOn = connected[it.id] || it.status !== 'available';
          const st = connected[it.id] ? meta.connected : meta[it.status];
          return (
            <div key={it.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '16px 18px', display: 'grid', gap: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, background: isOn ? 'rgba(29,158,117,.08)' : T.wash2, border: `1px solid ${isOn ? 'rgba(29,158,117,.2)' : T.line}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon name={icon[it.id] || 'plug'} size={18} color={isOn ? T.teal : T.faint} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{it.name}</div>
                  <Mono style={{ fontSize: 10.5, color: T.faint }}>{it.via}</Mono>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: `${st.color}14`, border: `1px solid ${st.color}40` }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: st.color }} />
                  <Mono style={{ fontSize: 10, fontWeight: 600, color: st.color }}>{st.label}</Mono>
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: T.muted, lineHeight: 1.45 }}>{it.detail}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 9, borderTop: `1px solid ${T.soft}` }}>
                <Mono style={{ fontSize: 10.5, color: T.faint }}>{connected[it.id] ? 'Synced just now' : it.sync}</Mono>
                {it.status === 'available' && !connected[it.id]
                  ? <button onClick={() => setConnected(c => ({ ...c, [it.id]: true }))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: T.forest, color: T.brass, border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)' }}><Icon name="plug" size={12} color={T.brass} />Connect</button>
                  : <Mono style={{ fontSize: 10.5, color: T.teal, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={11} color={T.teal} stroke={2.4} />{it.status === 'ready' ? 'export ready' : 'least-privilege'}</Mono>}
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

window.ConsoleBudgets = ConsoleBudgets;
window.ConsoleAnomalies = ConsoleAnomalies;
window.ConsoleIntegrations = ConsoleIntegrations;
