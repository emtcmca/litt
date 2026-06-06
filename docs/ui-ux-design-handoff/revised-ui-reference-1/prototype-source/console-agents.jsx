/* ───────────────────────────────────────────────────────────────────────────
   Litt — Console · Agent Console  ·  "The Engine Room"
   A living architecture diagram you can watch think. Signals flow left→right
   through a deterministic router into four specialist agents, past the single
   tool layer, and into the append-only record + your Brief. Run a sweep and
   pulses travel the wires; flip Plain ⟷ Technical to read it either way.
   The trust story is the centerpiece: almost everything is deterministic
   Python — Gemini only ever drafts, for a human to read.
─────────────────────────────────────────────────────────────────────────── */
const { useState: useStateAg, useEffect: useEffectAg, useRef: useRefAg } = React;

// ── node graph layout (viewBox 1000 × 600; DOM positioned by the same coords)─
const NODE = {
  gmail:    { x: 116, y: 86,  kind: 'input', icon: 'mail',   label: 'Gmail',          sub: 'inbox & threads' },
  calendar: { x: 116, y: 228, kind: 'input', icon: 'clock',  label: 'Calendar',       sub: 'dates & hearings' },
  matters:  { x: 116, y: 370, kind: 'input', icon: 'book',   label: 'Matter store',   sub: 'cases & contacts' },
  time:     { x: 116, y: 512, kind: 'input', icon: 'dollar', label: 'Time & billing', sub: 'entries & budgets' },
  coordinator: { x: 372, y: 299, kind: 'coord', icon: 'refresh', label: 'Coordinator',
    plain: 'Sorts every signal and hands it to the right specialist — by a fixed rulebook, never a guess.',
    tech: 'classify_signal() · deterministic dictionary routing · no model in the loop.' },
  deadline_agent: { x: 624, y: 86,  kind: 'agent', icon: 'shield',
    plain: 'Watches every court date and contractual due date.',
    tech: 'Computes days-remaining; 4 escalation tiers by deadline class.' },
  billing_agent:  { x: 624, y: 228, kind: 'agent', icon: 'dollar',
    plain: 'Checks every hour of work before it can be billed.',
    tech: 'Pre-bill scrubber — 7 deterministic rules; budget math.' },
  comms_agent:    { x: 624, y: 370, kind: 'agent', icon: 'mail',
    plain: 'Reads your inbox and your matters — triages messages that need a reply, and flags clients going quiet.',
    tech: 'Inbound triage (urgency scoring) + silence thresholds; Gemini summarizes & drafts, held at the gate.' },
  anomaly_agent:  { x: 624, y: 512, kind: 'agent', icon: 'alert',
    plain: 'Spots billing patterns that look off.',
    tech: '13 detectors scored by severity × confidence.' },
  tool:  { x: 872, y: 158, kind: 'tool',  icon: 'lock',   label: 'Tool layer', sub: 'the only way to act' },
  audit: { x: 872, y: 330, kind: 'audit', icon: 'shield', label: 'Audit log',  sub: 'append-only record' },
  brief: { x: 872, y: 502, kind: 'brief', icon: 'check',  label: 'Your Brief', sub: 'gated to you' },
};
const INPUTS = ['gmail', 'calendar', 'matters', 'time'];
const AGENT_IDS = ['deadline_agent', 'billing_agent', 'comms_agent', 'anomaly_agent'];
// which signal sources each specialist actually reads from
const AGENT_SOURCES = {
  deadline_agent: ['calendar', 'matters'],
  billing_agent:  ['time'],
  comms_agent:    ['matters', 'gmail'],
  anomaly_agent:  ['time'],
};

const BASE_EDGES = [
  ...INPUTS.map(i => [i, 'coordinator']),
  ...AGENT_IDS.map(a => ['coordinator', a]),
  ...AGENT_IDS.map(a => [a, 'tool']),
  ['tool', 'audit'], ['tool', 'brief'],
];

// plain-language gate vocabulary
const PLAIN_GATE = {
  AUTO_SAFE:       { label: 'Handled',       note: 'Safe to log — nothing needed from you.' },
  REVIEW_REQUIRED: { label: 'Your call',     note: 'Operational, but Litt wants your judgment.' },
  ESCALATION:      { label: 'Needs you now', note: 'Litt can’t resolve this one alone.' },
  BLOCKED:         { label: 'Held',          note: 'Prepared and waiting for your signature.' },
};

// plain narration, one per SWEEP step (index-aligned)
const PLAIN = [
  'A new closeout begins. Litt gathers everything that happened across your matters today.',
  'It sorts every signal and hands it to the right specialist — by a fixed rulebook, never a guess.',
  'Client Comms reads your inbox — read-only. Three client messages are still waiting on a reply.',
  'It ranks them by urgency. Sandra Mercer’s is the one to watch — she names a Thursday deadline.',
  'Gemini summarizes each message and pulls out exactly what’s being asked of you.',
  'Sandra’s note mentions a court deadline — so Comms hands it straight to the Deadline Monitor.',
  'The Deadline Monitor looks up that matter’s dates and finds the Mercer opposition.',
  'Six days out, a hard court deadline, and unconfirmed — it raises a flag only you can clear.',
  'Now that the date is verified, Gemini drafts Sandra’s reply — every fact traced to a record.',
  'The reply is held. Litt prepares the words; it never sends on its own.',
  'Litt also reads a note you sent Reyes — and catches a promise you made: an answer by Friday.',
  'It hands that promise to the Deadline Monitor, so your own word is watched like any other date.',
  'The Billing specialist pulls every pending time entry — nine of them, fourteen thousand dollars.',
  'It runs all nine through the seven-rule scrubber. One comes back flagged.',
  'That entry has no narrative, so Litt holds it before it can ever be billed.',
  'Acme’s budget just crossed 78% — noted before it becomes a surprise.',
  'The Anomaly watcher runs thirteen detectors over the day’s entries — one fires.',
  'It scores the pattern by severity and confidence: elevated risk, worth your eyes.',
  'It won’t clear the flag without your reason — Litt never dismisses anything silently.',
  'Everything is assembled into your Brief: 5 items need you, 1 is critical. Every step was logged.',
];

// which nodes/edges light up at each step
function stepGraph(i) {
  const s = window.LITTC.SWEEP[i];
  if (!s) return { nodes: new Set(), edges: [], routes: [] };
  if (s.type === 'SIGNAL_RECEIVED') return { nodes: new Set([...INPUTS, 'coordinator']), edges: INPUTS.map(n => n + '>coordinator'), routes: [] };
  if (s.type === 'ROUTING_DECISION') return { nodes: new Set(['coordinator', ...AGENT_IDS]), edges: AGENT_IDS.map(a => 'coordinator>' + a), routes: [] };
  // a cross-agent hand-off — light both agents and the routing edge between them
  if (s.type === 'ROUTE_HANDOFF') return { nodes: new Set([s.from, s.to]), edges: ['coordinator>' + s.from], routes: [s.from + '>' + s.to] };
  if (s.agent === 'coordinator') return { nodes: new Set(['coordinator', 'tool', 'audit', 'brief']), edges: ['tool>audit', 'tool>brief'], routes: [] };
  // an agent step — light by what the tool actually does
  const sources = AGENT_SOURCES[s.agent] || [];
  const k = s.tool && s.tool.kind;
  if (k === 'read') return { nodes: new Set([...sources, 'coordinator', s.agent]), edges: [...sources.map(n => n + '>coordinator'), 'coordinator>' + s.agent], routes: [] };
  const touchesTool = k === 'gate' || k === 'write' || ['RESULT', 'ESCALATION', 'APPROVAL_GATE_APPLIED'].includes(s.type);
  return { nodes: new Set([s.agent, ...(touchesTool ? ['tool'] : [])]), edges: ['coordinator>' + s.agent, ...(touchesTool ? [s.agent + '>tool'] : [])], routes: [] };
}

function bezier(a, b) {
  const dx = (b.x - a.x) * 0.5;
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}
// cross-agent hand-off path — bows left, into the gap between coordinator and agents
function routeBezier(a, b) {
  const mx = Math.min(a.x, b.x) - 116;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
}

// ── live tool-call chip — names the actual function the agent is invoking ──────
function ToolChip({ tool, below }) {
  const km = window.LITTC.KIND_META[tool.kind];
  return (
    <div className="ag-toolchip" style={{ position: 'absolute', left: '50%', top: below ? 'calc(100% + 7px)' : undefined, bottom: below ? undefined : 'calc(100% + 7px)', transform: 'translateX(-50%)', whiteSpace: 'nowrap', zIndex: 8, display: 'flex', alignItems: 'center', gap: 6, background: T.surface, border: `1px solid ${km.color}`, borderRadius: 999, padding: '3px 9px 3px 7px', boxShadow: `0 3px 12px ${km.color}40` }}>
      <span className="ag-node-live" style={{ width: 6, height: 6, borderRadius: 999, background: km.color, flexShrink: 0 }} />
      <Mono style={{ fontSize: 10.5, fontWeight: 600, color: T.ink }}>{tool.name}()</Mono>
      <Mono style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em', color: km.color }}>{km.label}</Mono>
    </div>
  );
}

// ── individual node card ──────────────────────────────────────────────────────
function GraphNode({ id, live, dim, selected, idle, commitColor, onSelect, agentData, tech, liveTool }) {
  const n = NODE[id];
  const llm = id === 'comms_agent';
  const widths = { input: 138, coord: 172, agent: 196, tool: 150, audit: 150, brief: 150 };
  const w = widths[n.kind];

  const ring = live ? (commitColor || (llm ? T.teal : T.forest)) : (selected ? T.gold : null);
  const wrap = {
    position: 'absolute', left: `${(n.x / 1000) * 100}%`, top: `${(n.y / 600) * 100}%`,
    transform: 'translate(-50%,-50%)', width: w, zIndex: live ? 4 : 2, borderRadius: 12,
    opacity: dim ? 0.4 : 1, transition: 'opacity .3s, box-shadow .4s, transform .25s',
    boxShadow: idle && !live && !selected ? '0 0 0 3px rgba(214,193,129,.22)' : undefined,
    cursor: 'pointer',
  };

  // ---- input chips ----
  if (n.kind === 'input') {
    return (
      <div style={wrap} onClick={() => onSelect(id)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.surface, border: `1px solid ${ring || T.line}`, borderRadius: 9, padding: '8px 10px', boxShadow: live ? `0 0 0 3px ${ring}22` : '0 1px 2px rgba(20,20,18,.04)' }}>
          <span style={{ width: 24, height: 24, borderRadius: 6, background: T.wash2, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={n.icon} size={13} color={live ? ring : T.muted} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, lineHeight: 1.1 }}>{n.label}</div>
            <Mono style={{ fontSize: 9, color: T.faint }}>{n.sub}</Mono>
          </div>
        </div>
      </div>
    );
  }

  // ---- coordinator ----
  if (n.kind === 'coord') {
    return (
      <div style={wrap} onClick={() => onSelect(id)}>
        {liveTool && <ToolChip tool={liveTool} below />}
        <div style={{ background: live ? 'rgba(20,34,31,.04)' : T.surface, border: `1.5px solid ${ring || 'rgba(20,34,31,.4)'}`, borderRadius: 12, padding: '12px 14px', boxShadow: live ? `0 0 0 4px ${ring}1f` : '0 2px 8px rgba(20,20,18,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className={(live || idle) ? 'ag-node-live' : ''} style={{ width: 9, height: 9, borderRadius: 999, background: live ? ring : T.forest, boxShadow: live ? `0 0 8px ${ring}` : (idle ? '0 0 6px rgba(20,34,31,.5)' : 'none') }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Coordinator</span>
            <Mono style={{ marginLeft: 'auto', fontSize: 8.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: '#5F6F66', border: '1px solid rgba(95,111,102,.4)', borderRadius: 4, padding: '1px 5px' }}>Python</Mono>
          </div>
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4 }}>{tech ? n.tech : 'The router. Sorts every signal by a fixed rulebook.'}</div>
        </div>
      </div>
    );
  }

  // ---- agent ----
  if (n.kind === 'agent') {
    const a = agentData;
    return (
      <div style={wrap} onClick={() => onSelect(id)}>
        {liveTool && <ToolChip tool={liveTool} below />}
        <div style={{ background: live ? (llm ? 'rgba(29,158,117,.05)' : 'rgba(20,34,31,.03)') : T.surface, border: `1px solid ${ring || T.line}`, borderRadius: 11, padding: '10px 12px', boxShadow: live ? `0 0 0 4px ${ring}1f` : '0 1px 3px rgba(20,20,18,.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: llm ? 'rgba(29,158,117,.1)' : 'rgba(20,34,31,.06)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={n.icon} size={14} color={llm ? T.teal : T.forest} /></span>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.1, flex: 1, minWidth: 0 }}>{a.name}</span>
            <Mono style={{ fontSize: 8.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: llm ? T.teal : '#5F6F66', border: `1px solid ${llm ? 'rgba(29,158,117,.4)' : 'rgba(95,111,102,.4)'}`, borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>{llm ? 'Gemini' : 'Python'}</Mono>
          </div>
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4, marginTop: 6 }}>{tech ? n.tech : n.plain}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, paddingTop: 7, borderTop: `1px solid ${T.soft}` }}>
            {llm && <Mono style={{ fontSize: 8.5, fontWeight: 600, color: T.teal, border: '1px solid rgba(29,158,117,.4)', borderRadius: 4, padding: '0 4px' }}>⇄ inbox</Mono>}
            <Mono style={{ fontSize: 9.5, color: T.teal }}>{a.handledToday} handled</Mono>
            <span style={{ color: T.faint, fontSize: 9 }}>·</span>
            <Mono style={{ fontSize: 9.5, color: a.surfaced ? T.gold : T.faint }}>{a.surfaced} to you</Mono>
          </div>
        </div>
      </div>
    );
  }

  // ---- outcomes (tool / audit / brief) ----
  const dark = n.kind === 'audit';
  const brassy = n.kind === 'brief';
  const bg = dark ? T.audit : brassy ? 'rgba(214,193,129,.12)' : T.surface;
  const fg = dark ? '#EFEBDB' : T.ink;
  const accent = dark ? T.auditAccent : brassy ? T.gold : T.gold;
  return (
    <div style={wrap} onClick={() => onSelect(id)}>
      {liveTool && n.kind === 'tool' && <ToolChip tool={liveTool} />}
      <div style={{ background: bg, border: `1px solid ${ring || (dark ? 'transparent' : brassy ? 'rgba(169,132,53,.4)' : T.line)}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 9, boxShadow: live ? `0 0 0 4px ${ring}22` : 'none' }}>
        <Icon name={n.icon} size={15} color={accent} stroke={n.kind === 'brief' ? 2.2 : 1.6} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: fg, lineHeight: 1.1 }}>{n.label}</div>
          <Mono style={{ fontSize: 9, color: dark ? T.auditMuted : T.faint }}>{n.sub}</Mono>
        </div>
      </div>
    </div>
  );
}

function ConsoleAgents() {
  const { COORDINATOR, AGENTS, SWEEP, COMMIT_META } = window.LITTC;
  const [step, setStep] = useStateAg(-1);
  const [playing, setPlaying] = useStateAg(false);
  const [tech, setTech] = useStateAg(false);
  const [sel, setSel] = useStateAg(null);
  const [idleIdx, setIdleIdx] = useStateAg(0);
  const timers = useRefAg([]);

  const agentById = id => id === 'coordinator' ? COORDINATOR : AGENTS.find(a => a.id === id);
  const cur = step >= 0 ? SWEEP[step] : null;
  const g = step >= 0 ? stepGraph(step) : { nodes: new Set(), edges: [], routes: [] };
  const commitColor = cur ? COMMIT_META[cur.commit].color : null;
  const complete = step === SWEEP.length - 1 && !playing;
  const STEP_MS = 640;

  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = []; }
  useEffectAg(() => () => clearTimers(), []);

  // idle heartbeat — Litt is always watching; cycle a soft highlight through each domain
  useEffectAg(() => {
    if (step >= 0 || playing) return undefined;
    const t = setInterval(() => setIdleIdx(i => (i + 1) % AGENT_IDS.length), 2100);
    return () => clearInterval(t);
  }, [step, playing]);
  const idleOn = step < 0 && !playing && !sel;
  const idleAgent = AGENT_IDS[idleIdx];
  const idleSrc = AGENT_SOURCES[idleAgent];
  const idleNodes = idleOn ? new Set([...idleSrc, 'coordinator', idleAgent]) : new Set();
  const idleEdges = idleOn ? [...idleSrc.map(n => n + '>coordinator'), 'coordinator>' + idleAgent] : [];

  function play(from) {
    clearTimers();
    let start = from != null ? from : (step >= SWEEP.length - 1 ? -1 : step);
    setSel(null); setPlaying(true);
    if (start < 0) setStep(-1);
    for (let i = Math.max(0, start + (start < 0 ? 0 : 1)); i < SWEEP.length; i++) {
      const delay = (i - Math.max(0, start + (start < 0 ? 0 : 1)) + 1) * STEP_MS;
      timers.current.push(setTimeout(() => { setStep(i); if (i === SWEEP.length - 1) setPlaying(false); }, delay));
    }
  }
  function pause() { clearTimers(); setPlaying(false); }
  function scrub(i) { clearTimers(); setPlaying(false); setSel(null); setStep(i); }

  const scaleHandled = AGENTS.reduce((s, a) => s + a.handledToday, 0);
  const scaleSurfaced = AGENTS.reduce((s, a) => s + a.surfaced, 0);

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%', minHeight: 0, background: T.wash }}>
      {/* ── header ─────────────────────────────────────────────── */}
      <div style={{ padding: '20px 26px 16px', borderBottom: `1px solid ${T.soft}`, background: T.surface }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Agent console</h1>
              <Mono style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: T.teal, background: T.tealSoft, border: '1px solid rgba(29,158,117,.28)', borderRadius: 5, padding: '2px 7px' }}>the engine room</Mono>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: T.muted, lineHeight: 1.5, maxWidth: '60ch' }}>
              Watch Litt think. A coordinator routes every signal to a specialist with deterministic code, the agents do the work, and anything legal is gated back to you. Run a sweep — the wires light up as it goes.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* plain / tech toggle */}
            <div style={{ display: 'inline-flex', background: T.wash2, border: `1px solid ${T.line}`, borderRadius: 999, padding: 3 }}>
              {[['Plain English', false], ['Technical', true]].map(([label, val]) => {
                const on = tech === val;
                return <button key={label} onClick={() => setTech(val)} style={{ padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)', background: on ? T.forest : 'transparent', color: on ? T.brass : T.muted }}>{label}</button>;
              })}
            </div>
            <button onClick={() => (playing ? pause() : play())} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: T.forest, color: T.brass, border: `1px solid ${T.forest}`, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
              {playing ? <><span style={{ width: 11, height: 11, display: 'inline-flex', gap: 2 }}><span style={{ width: 3, height: 11, background: T.brass }} /><span style={{ width: 3, height: 11, background: T.brass }} /></span>Pause</> : <><Icon name="refresh" size={15} color={T.brass} />{step >= SWEEP.length - 1 ? 'Replay sweep' : step >= 0 ? 'Resume' : 'Run closeout sweep'}</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── body: graph + inspector ────────────────────────────── */}
      <div className="ag-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 312px', minHeight: 0, overflow: 'auto' }}>
        {/* graph canvas */}
        <div style={{ position: 'relative', minHeight: 560, minWidth: 0, borderRight: `1px solid ${T.soft}`, backgroundImage: 'radial-gradient(rgba(20,20,18,.05) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
          {/* column captions */}
          {[['Signals in', 116], ['Router', 372], ['Specialist agents', 624], ['On the record', 872]].map(([label, x]) => (
            <Mono key={label} style={{ position: 'absolute', left: `${(x / 1000) * 100}%`, top: 14, transform: 'translateX(-50%)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.1em', color: T.faint, whiteSpace: 'nowrap', zIndex: 3 }}>{label}</Mono>
          ))}
          {/* legend */}
          <div style={{ position: 'absolute', right: 14, top: 30, zIndex: 3, display: 'grid', gap: 4, background: 'rgba(255,255,255,.74)', borderRadius: 9, padding: '6px 10px', border: `1px solid ${T.soft}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="20" height="6" style={{ display: 'block' }}><line x1="1" y1="3" x2="19" y2="3" stroke={T.teal} strokeWidth="1.6" strokeDasharray="1.5 3" strokeLinecap="round" /></svg>
              <Mono style={{ fontSize: 9, color: T.muted }}>two-way inbox channel</Mono>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="20" height="6" style={{ display: 'block' }}><line x1="1" y1="3" x2="19" y2="3" stroke={T.gold} strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" /></svg>
              <Mono style={{ fontSize: 9, color: T.muted }}>agent hand-off</Mono>
            </div>
          </div>

          {/* edges */}
          <svg viewBox="0 0 1000 600" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}>
            {BASE_EDGES.map(([a, b]) => {
              const key = a + '>' + b;
              const on = g.edges.includes(key);
              const d = bezier(NODE[a], NODE[b]);
              return (
                <g key={key}>
                  <path d={d} fill="none" stroke={T.line} strokeWidth={1.25} vectorEffect="non-scaling-stroke" style={{ opacity: step >= 0 && !on ? 0.5 : 1 }} />
                  {(key === 'gmail>coordinator' || key === 'coordinator>comms_agent') && !on && <path d={d} fill="none" stroke={T.teal} strokeWidth={1.6} strokeLinecap="round" strokeDasharray="1.5 9" vectorEffect="non-scaling-stroke" className="ag-edge-rev" style={{ opacity: (g.nodes.has('comms_agent') || idleNodes.has('comms_agent')) ? .7 : .24 }} />}
                  {idleEdges.includes(key) && !on && <path d={d} fill="none" stroke={T.brass} strokeWidth={2} strokeLinecap="round" strokeDasharray="2 12" vectorEffect="non-scaling-stroke" className="ag-edge-idle" style={{ opacity: .65 }} />}
                  {on && <path d={d} fill="none" stroke={commitColor} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="2 11" vectorEffect="non-scaling-stroke" className="ag-edge-flow" />}
                </g>
              );
            })}
            {/* cross-agent hand-off edges (active only) */}
            {g.routes.map(r => {
              const [a, b] = r.split('>');
              return <path key={'route-' + r} d={routeBezier(NODE[a], NODE[b])} fill="none" stroke={T.gold} strokeWidth={2.6} strokeLinecap="round" strokeDasharray="2 8" vectorEffect="non-scaling-stroke" className="ag-edge-flow" />;
            })}
          </svg>

          {/* nodes */}
          {Object.keys(NODE).map(id => (
            <GraphNode key={id} id={id} tech={tech}
              live={g.nodes.has(id)} dim={step >= 0 && !g.nodes.has(id) && sel !== id}
              selected={sel === id} idle={idleNodes.has(id)} commitColor={g.nodes.has(id) ? commitColor : null}
              liveTool={(cur && cur.tool && cur.agent === id) ? cur.tool : null}
              agentData={agentById(id)} onSelect={(i) => { pause(); setSel(s => s === i ? null : i); }} />
          ))}

          {/* scrubber dock */}
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 14, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(6px)', border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14, zIndex: 5, boxShadow: '0 4px 16px rgba(20,20,18,.08)' }}>
            <button onClick={() => (playing ? pause() : play())} aria-label={playing ? 'Pause' : 'Play'} style={{ width: 30, height: 30, borderRadius: 999, border: 'none', background: T.forest, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              {playing ? <span style={{ display: 'inline-flex', gap: 2.5 }}><span style={{ width: 2.5, height: 10, background: T.brass }} /><span style={{ width: 2.5, height: 10, background: T.brass }} /></span> : <span style={{ width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: `9px solid ${T.brass}`, marginLeft: 2 }} />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {SWEEP.map((s, i) => {
                  const done = i <= step;
                  const isCur = i === step;
                  const col = COMMIT_META[s.commit].color;
                  return <button key={i} onClick={() => scrub(i)} aria-label={`Step ${i + 1}`} style={{ flex: 1, height: isCur ? 9 : 6, borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0, background: done ? col : T.wash2, opacity: done ? (isCur ? 1 : 0.5) : 1, transition: 'all .2s' }} />;
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                <Mono style={{ fontSize: 10, color: T.faint, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{idleOn && <span className="litt-pulse" style={{ width: 5, height: 5, borderRadius: 999, background: T.teal }} />}{step < 0 ? (idleOn ? `Watching · ${agentById(idleAgent).name}` : 'Ready') : `Step ${step + 1} of ${SWEEP.length}`}</Mono>
                <Mono style={{ fontSize: 10, color: T.faint }}>{step < 0 ? 'last sweep 4:58 PM' : `+${(step * STEP_MS / 1000).toFixed(1)}s`}</Mono>
              </div>
            </div>
          </div>
        </div>

        {/* inspector */}
        <div style={{ overflowY: 'auto', overflowX: 'hidden', background: T.surface, minWidth: 0 }}>
          <Inspector sel={sel} setSel={setSel} cur={cur} step={step} tech={tech}
            agentById={agentById} scaleHandled={scaleHandled} scaleSurfaced={scaleSurfaced}
            complete={complete} />
        </div>
      </div>
    </div>
  );
}

// ── right-hand inspector — reacts to selection / step / rest ──────────────────
function Inspector({ sel, setSel, cur, step, tech, agentById, scaleHandled, scaleSurfaced, complete }) {
  const { COMMIT_META, WORK_META } = window.LITTC;

  // 1) a node is selected
  if (sel) {
    const n = NODE[sel];
    const a = agentById(sel);
    const llm = sel === 'comms_agent';
    const isAgent = n.kind === 'agent', isCoord = n.kind === 'coord';
    return (
      <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14 }}>
        <button onClick={() => setSel(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 12, fontWeight: 600, padding: 0, fontFamily: 'var(--font-sans)' }}>
          <Icon name="chevron" size={12} color={T.muted} style={{ transform: 'rotate(180deg)' }} />Back
        </button>
        <div>
          <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.1em', color: T.faint }}>{n.kind === 'input' ? 'Signal source' : isCoord ? 'Router' : isAgent ? 'Specialist agent' : 'On the record'}</Mono>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: T.ink }}>{isAgent || isCoord ? a.name : n.label}</h2>
            {(isAgent || isCoord) && <Mono style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: llm ? T.teal : '#5F6F66', border: `1px solid ${llm ? 'rgba(29,158,117,.4)' : 'rgba(95,111,102,.4)'}`, borderRadius: 4, padding: '1px 6px' }}>{llm ? 'Gemini' : 'Python'}</Mono>}
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: T.ink, lineHeight: 1.55 }}>{isAgent ? (a.blurb) : isCoord ? COORDINATOR_BLURB() : NODE_BLURB[sel] || n.sub}</p>
        {isAgent && (
          <>
            <div style={{ display: 'grid', gap: 8 }}>
              {[['Watches', a.watches], ['How it decides', a.logic]].map(([k, v]) => (
                <div key={k} style={{ background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 9, padding: '9px 11px' }}>
                  <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.07em', color: T.faint, display: 'block', marginBottom: 3 }}>{k}</Mono>
                  <span style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.4 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, background: 'rgba(29,158,117,.06)', border: '1px solid rgba(29,158,117,.2)', borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.teal, lineHeight: 1 }}>{a.handledToday}</div>
                <Mono style={{ fontSize: 9.5, color: T.muted, marginTop: 2, display: 'block' }}>handled today</Mono>
              </div>
              <div style={{ flex: 1, background: a.surfaced ? 'rgba(169,132,53,.07)' : T.wash2, border: `1px solid ${a.surfaced ? 'rgba(169,132,53,.22)' : T.soft}`, borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: a.surfaced ? T.gold : T.faint, lineHeight: 1 }}>{a.surfaced}</div>
                <Mono style={{ fontSize: 9.5, color: T.muted, marginTop: 2, display: 'block' }}>surfaced to you</Mono>
              </div>
            </div>
          </>
        )}
        {n.kind === 'tool' && <BoundaryCard />}
        {n.kind === 'tool' && <ToolCatalog />}
        {window.LITTC.TOOLS[sel] && <ToolList tools={window.LITTC.TOOLS[sel]} title={isCoord ? 'What it calls' : 'Tools it can call'} />}
        {n.kind === 'brief' && <a href="Litt — Daily Closeout.html" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: T.forest, color: T.brass, fontSize: 13, fontWeight: 600, padding: '11px 16px', borderRadius: 10, textDecoration: 'none' }}>Open today’s closeout <Icon name="arrow" size={13} color={T.brass} /></a>}
      </div>
    );
  }

  // 2) running / a step is shown
  if (cur) {
    const gate = PLAIN_GATE[cur.commit];
    const cm = COMMIT_META[cur.commit];
    const wm = WORK_META[cur.work];
    const a = agentById(cur.agent);
    return (
      <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.1em', color: T.faint }}>Live · step {step + 1}</Mono>
          <Mono style={{ fontSize: 10, color: T.faint }}>{a ? a.name : 'Coordinator'}</Mono>
        </div>
        {/* gate banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: `${cm.color}10`, border: `1px solid ${cm.color}33`, borderRadius: 10, padding: '11px 13px 12px' }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: cm.color, flexShrink: 0 }} className="ag-node-live" />
          <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: cm.color, lineHeight: 1.2 }}>{gate.label}</div>
            <span style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.35, display: 'block' }}>{gate.note}</span>
          </div>
        </div>
        {/* narration */}
        <p style={{ margin: 0, fontSize: 15, color: T.ink, lineHeight: 1.55, fontWeight: 450 }}>{tech ? cur.desc : PLAIN[step]}</p>
        {/* the actual tool call */}
        {cur.tool && <LiveToolCard tool={cur.tool} />}
        {/* cross-agent hand-off */}
        {cur.type === 'ROUTE_HANDOFF' && <HandoffCard from={cur.from} to={cur.to} agentById={agentById} />}
        {/* facts */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Mono style={{ fontSize: 10.5, color: wm.tone === 'teal' ? '#0F6E56' : '#3A4A44', background: wm.tone === 'teal' ? 'rgba(29,158,117,.1)' : 'rgba(20,34,31,.06)', border: `1px solid ${wm.tone === 'teal' ? 'rgba(29,158,117,.3)' : 'rgba(20,34,31,.18)'}`, borderRadius: 5, padding: '3px 8px' }}>{wm.label}</Mono>
          {tech && <Mono style={{ fontSize: 10.5, color: T.muted, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 5, padding: '3px 8px' }}>{cur.type}</Mono>}
          {cur.model && <Mono style={{ fontSize: 10.5, color: T.teal, background: 'rgba(29,158,117,.08)', border: '1px solid rgba(29,158,117,.24)', borderRadius: 5, padding: '3px 8px' }}>model: {cur.model}</Mono>}
          {cur.conf != null && <Mono style={{ fontSize: 10.5, color: T.muted, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 5, padding: '3px 8px' }}>confidence {cur.conf}</Mono>}
        </div>
        {complete && (
          <div style={{ background: T.audit, borderRadius: 12, padding: '14px 15px', display: 'grid', gap: 10, marginTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 26, height: 26, borderRadius: 999, background: 'rgba(158,225,199,.16)', border: '1px solid rgba(158,225,199,.4)', display: 'grid', placeItems: 'center' }}><Icon name="check" size={14} color={T.auditAccent} stroke={2.2} /></span>
              <div><div style={{ fontSize: 13, fontWeight: 600, color: '#EFEBDB' }}>Sweep complete</div><Mono style={{ fontSize: 10.5, color: T.auditMuted }}>5 items · 1 critical · every step logged</Mono></div>
            </div>
            <a href="Litt — Daily Closeout.html" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: T.brass, color: T.forest, fontSize: 13, fontWeight: 600, padding: '10px 14px', borderRadius: 9, textDecoration: 'none' }}>Open today’s closeout <Icon name="arrow" size={13} color={T.forest} /></a>
          </div>
        )}
      </div>
    );
  }

  // 3) rest — the scale + the boundary (the trust story)
  return (
    <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16 }}>
      <div>
        <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.1em', color: T.faint }}>Today, across your matters</Mono>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <div style={{ flex: 1, background: 'rgba(29,158,117,.06)', border: '1px solid rgba(29,158,117,.2)', borderRadius: 11, padding: '12px 13px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: T.teal, lineHeight: 1 }}>{scaleHandled}</div>
            <Mono style={{ fontSize: 10, color: T.muted, marginTop: 3, display: 'block' }}>handled automatically</Mono>
          </div>
          <div style={{ flex: 1, background: 'rgba(169,132,53,.07)', border: '1px solid rgba(169,132,53,.22)', borderRadius: 11, padding: '12px 13px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: T.gold, lineHeight: 1 }}>{scaleSurfaced}</div>
            <Mono style={{ fontSize: 10, color: T.muted, marginTop: 3, display: 'block' }}>surfaced to you</Mono>
          </div>
        </div>
      </div>
      <BoundaryCard />
      <div style={{ background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 11, padding: '13px 14px', display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="lock" size={14} color={T.gold} /><span style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap' }}>One door to act</span></div>
        <p style={{ margin: 0, fontSize: 12, color: T.muted, lineHeight: 1.5 }}>No agent writes anything directly. Every change flows through one tool layer, which records it to the append-only log. Litt never sends, files, or bills on its own — it prepares; you decide.</p>
      </div>
      <Mono style={{ fontSize: 10.5, color: T.faint, textAlign: 'center', lineHeight: 1.6 }}>Press <span style={{ color: T.muted }}>Run closeout sweep</span> to watch it work,<br />or tap any node to inspect it.</Mono>
    </div>
  );
}

// ── tool-call surfaces ─────────────────────────────────────────────────
function KindBadge({ kind }) {
  const km = window.LITTC.KIND_META[kind];
  return <Mono style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em', color: km.color, border: `1px solid ${km.color}66`, background: `${km.color}0f`, borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>{km.label}</Mono>;
}

function LiveToolCard({ tool }) {
  const km = window.LITTC.KIND_META[tool.kind];
  return (
    <div style={{ border: `1px solid ${km.color}40`, borderRadius: 11, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', background: `${km.color}0e`, borderBottom: `1px solid ${km.color}22` }}>
        <Icon name="lock" size={12} color={km.color} />
        <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: km.color, fontWeight: 600 }}>Tool call</Mono>
        <span style={{ marginLeft: 'auto' }}><KindBadge kind={tool.kind} /></span>
      </div>
      <div style={{ padding: '10px 11px', display: 'grid', gap: 7 }}>
        <Mono style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{tool.name}()</Mono>
        <Mono style={{ fontSize: 10.5, color: T.muted, lineHeight: 1.5, wordBreak: 'break-word', background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 6, padding: '6px 8px' }}>{tool.sig}</Mono>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="arrow" size={12} color={km.color} />
          <Mono style={{ fontSize: 11.5, color: T.ink, fontWeight: 500 }}>{tool.result}</Mono>
        </div>
      </div>
    </div>
  );
}

function HandoffCard({ from, to, agentById }) {
  const fa = agentById(from), ta = agentById(to);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(169,132,53,.08)', border: '1px solid rgba(169,132,53,.3)', borderRadius: 11, padding: '11px 13px' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.07em', color: T.faint, display: 'block', marginBottom: 2 }}>Cross-agent hand-off</Mono>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{fa ? fa.name : from}</span>
          <Icon name="arrow" size={13} color={T.gold} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: T.gold }}>{ta ? ta.name : to}</span>
        </div>
      </div>
      <span style={{ width: 30, height: 30, borderRadius: 999, background: 'rgba(169,132,53,.16)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="refresh" size={15} color={T.gold} /></span>
    </div>
  );
}

function ToolList({ tools, title }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 7 }}>
      <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint }}>{title} · {tools.length}</Mono>
      <div style={{ display: 'grid', gap: 5 }}>
        {tools.map(t => (
          <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 8, padding: '7px 9px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Mono style={{ fontSize: 11.5, fontWeight: 600, color: T.ink }}>{t.name}</Mono>
              <Mono style={{ fontSize: 10, color: T.faint, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.sig}</Mono>
            </div>
            <KindBadge kind={t.kind} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolCatalog() {
  const { TOOLS, KIND_META, AGENTS, COORDINATOR } = window.LITTC;
  const order = ['coordinator', 'deadline_agent', 'billing_agent', 'comms_agent', 'anomaly_agent'];
  const nameOf = id => id === 'coordinator' ? COORDINATOR.name : AGENTS.find(a => a.id === id).name;
  const counts = {};
  Object.values(TOOLS).flat().forEach(t => { counts[t.kind] = (counts[t.kind] || 0) + 1; });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
      <div>
        <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint, display: 'block', marginBottom: 6 }}>Tool kinds</Mono>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {Object.keys(KIND_META).map(k => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <KindBadge kind={k} /><Mono style={{ fontSize: 10, color: T.faint }}>{counts[k] || 0}</Mono>
            </span>
          ))}
        </div>
      </div>
      {order.map(id => (
        <div key={id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 5 }}>
          <Mono style={{ fontSize: 10.5, fontWeight: 600, color: T.muted }}>{nameOf(id)}</Mono>
          {TOOLS[id].map(t => (
            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 9px', background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 7 }}>
              <Mono style={{ fontSize: 11, fontWeight: 600, color: T.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}<span style={{ color: T.faint, fontWeight: 400 }}>{t.sig}</span></Mono>
              <KindBadge kind={t.kind} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function BoundaryCard() {
  return (
    <div style={{ border: `1px solid ${T.soft}`, borderRadius: 11, overflow: 'hidden' }}>
      <div style={{ padding: '11px 13px 9px', background: T.wash2, borderBottom: `1px solid ${T.soft}` }}>
        <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint }}>The boundary — why you can trust it</Mono>
      </div>
      <div style={{ padding: '12px 13px', display: 'grid', gap: 11 }}>
        {[['Python', '#5F6F66', 'Deterministic', 'Same input, same output — every time. Routing, math, state, and scoring. Auditable to the line.'],
          ['Gemini', T.teal, 'Drafts only', 'Touches a model only when a human will read the result. Drafting and extraction — never a decision, never a send.']].map(([k, c, t, d]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '58px 1fr', gap: 9, alignItems: 'start' }}>
            <Mono style={{ fontSize: 9.5, fontWeight: 600, color: c, border: `1px solid ${c}55`, borderRadius: 5, padding: '2px 0', textAlign: 'center' }}>{k}</Mono>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{t}</div>
              <span style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.4 }}>{d}</span>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingTop: 9, borderTop: `1px solid ${T.soft}` }}>
          {(() => {
            const sweep = window.LITTC.SWEEP;
            const llm = sweep.filter(s => s.work === 'llm_assisted').length;
            const det = sweep.length - llm;
            return <>
              <span style={{ fontSize: 17, fontWeight: 700, color: T.forest }}>{det}<span style={{ fontSize: 11, color: T.faint, fontWeight: 500 }}>/{sweep.length}</span></span>
              <Mono style={{ fontSize: 10.5, color: T.muted, lineHeight: 1.35 }}>steps in a sweep are deterministic. {llm} call Gemini — only to summarize &amp; draft.</Mono>
            </>;
          })()}
        </div>
      </div>
    </div>
  );
}

const NODE_BLURB = {
  gmail: 'Read-only access through an MCP adapter. Litt extracts deadlines and contact activity — it never composes or sends from here.',
  calendar: 'Court dates and hearings flow in through MCP. The Deadline Monitor computes days-remaining from them.',
  matters: 'The system of record for cases, clients, and contacts. Every agent reads from it; only the tool layer writes back.',
  time: 'Pending time entries and client budgets. The Billing specialist scrubs each entry and tracks utilization here.',
  tool: 'The single write path. No agent acts on its own — proposed actions pass through here, which records each one to the audit log.',
  audit: 'Append-only and tamper-evident. Every signal, tool call, gate, and decision lands here — CREATE-only at the storage layer.',
  brief: 'Where everything that needs your judgment is assembled, ranked by pressure. Gated to you — Litt prepares, you decide.',
};
function COORDINATOR_BLURB() { return window.LITTC.COORDINATOR.blurb; }

window.ConsoleAgents = ConsoleAgents;
