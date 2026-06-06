/* ───────────────────────────────────────────────────────────────────────────
   Litt — Console shell
   Persistent control-room rail (scope · system status · who you are),
   a lean operations Overview, and the view router. Hosts the heroes
   (Agent console now; Policy & Deadlines mount when present).
─────────────────────────────────────────────────────────────────────────── */
const { useState: useStateSh } = React;

const NAV = [
  { group: null, items: [
    { id: 'overview', label: 'Overview', icon: 'grid' },
    { id: 'brief', label: 'Brief', icon: 'clock', star: true },
  ] },
  { group: 'Watch', items: [
    { id: 'deadlines', label: 'Deadlines', icon: 'shield', count: 1 },
    { id: 'budgets', label: 'Budgets', icon: 'chart', count: 1 },
    { id: 'clients', label: 'Clients & comms', icon: 'mail', count: 1 },
    { id: 'anomalies', label: 'Anomalies', icon: 'alert', count: 1 },
  ] },
  { group: 'Collect', items: [
    { id: 'collect', label: 'Billing & WIP', icon: 'dollar', count: 2 },
  ] },
  { group: 'Prove', items: [
    { id: 'agents', label: 'Agent console', icon: 'refresh' },
    { id: 'record', label: 'Audit ledger', icon: 'book' },
  ] },
  { group: 'Tune', items: [
    { id: 'policy', label: 'Policy & autonomy', icon: 'sliders' },
    { id: 'integrations', label: 'Integrations', icon: 'plug' },
  ] },
];

function LeftRail({ active, onNav, user, onSwitchUser }) {
  const [menu, setMenu] = useStateSh(false);
  const { FIRM, USERS } = window.LITTC;
  const RailItem = ({ it }) => {
    const on = active === it.id;
    const star = it.star && !on;
    const inner = (
      <>
        <Icon name={it.icon} size={15} color={on ? T.forest : (star ? T.brass : '#B7B2A2')} />
        <span style={{ flex: 1 }}>{it.label}</span>
        {it.star && !on && <Mono style={{ fontSize: 9, color: T.auditAccent, textTransform: 'uppercase', letterSpacing: '.06em' }}>ready</Mono>}
        {it.count ? <Mono style={{ fontSize: 10.5, color: on ? T.forest : T.danger, background: on ? 'rgba(20,34,31,.12)' : 'rgba(155,45,35,.16)', borderRadius: 999, padding: '1px 6px', fontWeight: 600 }}>{it.count}</Mono> : null}
      </>
    );
    const style = {
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
      padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
      border: star ? '1px solid rgba(214,193,129,.4)' : '1px solid transparent',
      fontSize: 13, fontWeight: on || it.star ? 600 : 500, fontFamily: 'var(--font-sans)',
      background: on ? T.brass : (star ? 'rgba(214,193,129,.08)' : 'transparent'),
      color: on ? T.forest : '#D8D3C3',
      transition: 'background .15s',
    };
    if (it.href) return <a href={it.href} style={{ ...style, textDecoration: 'none' }}>{inner}</a>;
    return <button onClick={() => onNav(it.id)} style={style} onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,.05)'; }} onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}>{inner}</button>;
  };

  return (
    <nav style={{ width: 232, background: T.forest, display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: `1px solid rgba(214,193,129,.18)` }}>
      {/* brand */}
      <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid rgba(214,193,129,.14)` }}>
        <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-.03em', color: '#EFEBDB' }}>Litt<span style={{ color: T.teal }}>.</span></div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#9DA89A', marginTop: 3 }}>{FIRM.name}</div>
      </div>

      {/* nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px', display: 'grid', gap: 16, alignContent: 'start' }}>
        {NAV.map((sec, i) => (
          <div key={i} style={{ display: 'grid', gap: 3 }}>
            {sec.group && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.12em', color: '#7E8A7C', padding: '4px 10px 2px' }}>{sec.group}</div>}
            {sec.items.map(it => <RailItem key={it.id} it={it} />)}
          </div>
        ))}
      </div>

      {/* system status */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid rgba(214,193,129,.14)`, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: T.auditAccent, boxShadow: `0 0 6px ${T.auditAccent}` }} />
          <Mono style={{ fontSize: 10.5, color: '#9DA89A' }}>All systems nominal</Mono>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Mono style={{ fontSize: 10, color: '#7E8A7C' }}>Last sweep</Mono><Mono style={{ fontSize: 10, color: T.brass }}>4:58 PM</Mono>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Mono style={{ fontSize: 10, color: '#7E8A7C' }}>Integrations</Mono><Mono style={{ fontSize: 10, color: T.brass }}>2 connected</Mono>
        </div>
      </div>

      {/* user switcher */}
      <div style={{ position: 'relative', padding: '12px 14px', borderTop: `1px solid rgba(214,193,129,.14)` }}>
        {menu && (
          <div style={{ position: 'absolute', bottom: '100%', left: 12, right: 12, marginBottom: 6, background: '#1C2E2A', border: `1px solid rgba(214,193,129,.22)`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,.4)' }}>
            {USERS.map(u => (
              <button key={u.id} onClick={() => { onSwitchUser(u); setMenu(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', background: u.id === user.id ? 'rgba(214,193,129,.1)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 24, height: 24, borderRadius: 999, background: u.scope === 'firm_admin' ? T.brass : 'rgba(214,193,129,.18)', color: u.scope === 'firm_admin' ? T.forest : T.brass, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{u.initials}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, color: '#EFEBDB', fontWeight: 500 }}>{u.name}</span>
                  <Mono style={{ fontSize: 9.5, color: '#9DA89A' }}>{u.role}{u.scope === 'firm_admin' ? ' · sets firm policy' : ''}</Mono>
                </span>
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setMenu(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, background: 'transparent', border: `1px solid rgba(214,193,129,.18)`, borderRadius: 9, padding: '8px 10px', cursor: 'pointer' }}>
          <span style={{ width: 26, height: 26, borderRadius: 999, background: user.scope === 'firm_admin' ? T.brass : 'rgba(214,193,129,.18)', color: user.scope === 'firm_admin' ? T.forest : T.brass, display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 700, flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{user.initials}</span>
          <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: 12.5, color: '#EFEBDB', fontWeight: 500 }}>{user.name}</span>
            <Mono style={{ fontSize: 9.5, color: '#9DA89A' }}>{user.role}</Mono>
          </span>
          <Icon name="chevronD" size={13} color="#9DA89A" />
        </button>
      </div>
    </nav>
  );
}

function Overview({ user, onNav }) {
  const { BOOKS, AGENTS, INTEGRATIONS } = window.LITTC;
  const needsYou = BOOKS.reduce((s, b) => s + b.needsYou, 0);
  return (
    <div style={{ overflowY: 'auto', padding: '30px 34px 60px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'grid', gap: 22 }}>
        {/* header */}
        <div>
          <Mono style={{ fontSize: 12, color: T.muted }}>May 29, 2026 · 5:00 PM · operations overview</Mono>
          <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 500, letterSpacing: '-.02em', color: T.ink }}>{window.LITT.greet(user.name.split(' ')[0])}</h1>
          <p style={{ margin: '9px 0 0', fontSize: 16, lineHeight: 1.55, color: '#3C3B35', maxWidth: '56ch' }}>
            Litt is watching everything. <strong style={{ color: T.ink, fontWeight: 600 }}>{needsYou} item{needsYou !== 1 ? 's' : ''}</strong> across your books need your judgment — the rest is handled and on the record.
          </p>
          <button onClick={() => onNav('brief')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16, background: T.forest, color: T.brass, fontWeight: 600, fontSize: 14, padding: '12px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            Open the Brief <Icon name="arrow" size={14} color={T.brass} />
          </button>
        </div>

        {/* the books */}
        <div>
          <div style={{ marginBottom: 15 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-.015em', color: T.ink, fontFamily: 'var(--font-sans)' }}>The Books</h2>
            <p style={{ margin: '3px 0 0', fontSize: 13.5, color: T.muted, fontFamily: 'var(--font-sans)' }}>What Litt is watching across your matters.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {BOOKS.map(b => {
              const c = { deadlines: '#185FA5', billing: '#1D9E75', budgets: '#A98435', comms: '#5F6F66', anomalies: '#9B2D23' }[b.id] || T.gold;
              return (
              <button key={b.id} onClick={() => onNav(b.id)} style={{ textAlign: 'left', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 13, padding: '15px 16px', cursor: 'pointer', transition: 'border-color .15s, transform .06s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = c + '66'} onMouseLeave={e => e.currentTarget.style.borderColor = T.line}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: c + '14', border: `1px solid ${c}33`, display: 'grid', placeItems: 'center' }}><Icon name={b.icon} size={15} color={c} /></span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{b.name}</span>
                  {b.needsYou > 0 && <Mono style={{ marginLeft: 'auto', fontSize: 10, color: T.danger, background: 'rgba(155,45,35,.1)', border: '1px solid rgba(155,45,35,.24)', borderRadius: 999, padding: '1px 7px', fontWeight: 600 }}>{b.needsYou} needs you</Mono>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span style={{ fontSize: 24, fontWeight: 600, color: T.ink }}>{b.total}</span>
                  <Mono style={{ fontSize: 10.5, color: T.faint }}>tracked</Mono>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: T.muted, lineHeight: 1.4 }}>{b.line}</p>
              </button>
              );
            })}
          </div>
        </div>

        {/* system row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <button onClick={() => onNav('agents')} style={{ textAlign: 'left', background: T.audit, border: 'none', borderRadius: 13, padding: '15px 16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="refresh" size={14} color={T.auditAccent} /><span style={{ fontSize: 13, fontWeight: 600, color: '#EFEBDB' }}>Agents</span><Mono style={{ marginLeft: 'auto', fontSize: 10, color: T.auditMuted }}>see them work →</Mono></div>
            <p style={{ margin: '7px 0 0', fontSize: 12, color: T.auditMuted, lineHeight: 1.4 }}>4 sub-agents + a deterministic router · last sweep 4:58 PM</p>
          </button>
          <button onClick={() => onNav('policy')} style={{ textAlign: 'left', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 13, padding: '15px 16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="sliders" size={14} color={T.gold} /><span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Policy & autonomy</span><Mono style={{ marginLeft: 'auto', fontSize: 10, color: T.faint }}>tune →</Mono></div>
            <p style={{ margin: '7px 0 0', fontSize: 12, color: T.muted, lineHeight: 1.4 }}>Everything legal is gated to you. Widen Litt’s autonomy when you’re ready.</p>
          </button>
          <button onClick={() => onNav('integrations')} style={{ textAlign: 'left', background: T.surface, border: `1px solid ${T.line}`, borderRadius: 13, padding: '15px 16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="plug" size={14} color={T.gold} /><span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Integrations</span><Mono style={{ marginLeft: 'auto', fontSize: 10, color: T.faint }}>manage →</Mono></div>
            <p style={{ margin: '7px 0 0', fontSize: 12, color: T.muted, lineHeight: 1.4 }}>Gmail & Calendar connected via MCP · LEDES export ready</p>
          </button>
        </div>
      </div>
    </div>
  );
}

function Stub({ view }) {
  const labels = {
    billing: 'Billing & WIP', budgets: 'Budgets', clients: 'Clients & comms',
    anomalies: 'Anomalies', integrations: 'Integrations', record: 'Audit ledger', settings: 'Settings',
  };
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 40 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <span style={{ width: 48, height: 48, borderRadius: 12, background: T.wash2, border: `1px solid ${T.line}`, display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><Icon name="grid" size={22} color={T.gold} /></span>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: T.ink }}>{labels[view] || view}</h2>
        <p style={{ margin: '8px 0 0', fontSize: 13.5, color: T.muted, lineHeight: 1.5 }}>This Watch view is part of the platform shell. We’re building the heroes first — Agent console and Policy &amp; autonomy are live; this one is next.</p>
      </div>
    </div>
  );
}

const NAV_IDS = NAV.flatMap(s => s.items.map(i => i.id));

function ConsoleApp() {
  const initial = (typeof location !== 'undefined' && NAV_IDS.includes(location.hash.slice(1))) ? location.hash.slice(1) : 'overview';
  const [active, setActiveRaw] = useStateSh(initial);
  const [user, setUser] = useStateSh(window.LITTC.USERS.find(u => u.you));

  const setActive = React.useCallback(id => {
    setActiveRaw(id);
    if (typeof history !== 'undefined') history.replaceState(null, '', id === 'overview' ? location.pathname + location.search : '#' + id);
  }, []);

  React.useEffect(() => {
    const onHash = () => { const h = location.hash.slice(1); if (NAV_IDS.includes(h)) setActiveRaw(h); else if (!h) setActiveRaw('overview'); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  let view;
  if (active === 'overview') view = <Overview user={user} onNav={setActive} />;
  else if (active === 'brief') view = <window.ConsoleBrief onNav={setActive} />;
  else if (active === 'collect' || active === 'billing') view = <window.ConsoleCollect />;
  else if (active === 'agents') view = <window.ConsoleAgents />;
  else if (active === 'policy' && window.ConsolePolicy) view = <window.ConsolePolicy user={user} />;
  else if (active === 'deadlines' && window.ConsoleWatch) view = <window.ConsoleWatch onNav={setActive} />;
  else if (active === 'budgets' && window.ConsoleBudgets) view = <window.ConsoleBudgets />;
  else if (active === 'clients' && window.ConsoleClients) view = <window.ConsoleClients />;
  else if (active === 'anomalies' && window.ConsoleAnomalies) view = <window.ConsoleAnomalies />;
  else if (active === 'integrations' && window.ConsoleIntegrations) view = <window.ConsoleIntegrations />;
  else if (active === 'record' && window.ConsoleRecord) view = <window.ConsoleRecord />;
  else view = <Stub view={active} />;

  return (
    <div style={{ height: '100vh', display: 'flex', background: T.forest }}>
      <LeftRail active={active} onNav={setActive} user={user} onSwitchUser={setUser} />
      <main style={{ flex: 1, minWidth: 0, background: T.wash, display: 'grid', gridTemplateRows: '1fr', minHeight: 0 }}>
        {view}
      </main>
    </div>
  );
}

window.ConsoleApp = ConsoleApp;
