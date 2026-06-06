/* ───────────────────────────────────────────────────────────────────────────
   Litt — shared flows + UI atoms
   Resolve panel (enforces required reason / narrative — no silent action),
   proof block (depth on demand), audit-event builder, small atoms + icons.
   Exported to window for the two direction skins to consume.
─────────────────────────────────────────────────────────────────────────── */
const { useState: _useState } = React;

// ── tokens (mirrors index.css) ───────────────────────────────────────────────
const T = {
  paper: '#FBFAF6', surface: '#FFFFFF', wash: '#F1EFE8', wash2: '#F8F7F4',
  line: 'rgba(20,20,18,0.12)', soft: 'rgba(20,20,18,0.07)',
  ink: '#2C2C2A', muted: '#6F6D67', faint: '#A9A7A1',
  forest: '#14221F', forestLine: 'rgba(214,193,129,.20)',
  brass: '#D6C181', gold: '#A98435',
  teal: '#1D9E75', tealSoft: 'rgba(29,158,117,.10)',
  danger: '#9B2D23', dangerSoft: '#F6E4DF',
  audit: '#11140F', auditMuted: '#9DA89A', auditAccent: '#9EE1C7',
};

// ── tiny line icons (simple strokes only) ────────────────────────────────────
function Icon({ name, size = 16, color = 'currentColor', stroke = 1.6, style }) {
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    check: <polyline points="3.5 8.5 7 12 12.5 4.5" {...p} />,
    arrow: <g {...p}><line x1="3" y1="8" x2="13" y2="8" /><polyline points="9 4 13 8 9 12" /></g>,
    clock: <g {...p}><circle cx="8" cy="8" r="6" /><polyline points="8 4.5 8 8 10.5 9.5" /></g>,
    shield: <path d="M8 2 13 4v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z" {...p} />,
    alert: <g {...p}><path d="M8 2 15 14H1z" /><line x1="8" y1="6.5" x2="8" y2="9.5" /><circle cx="8" cy="11.6" r="0.2" /></g>,
    dollar: <g {...p}><line x1="8" y1="2" x2="8" y2="14" /><path d="M11 4.5H6.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H4.5" /></g>,
    mail: <g {...p}><rect x="2" y="3.5" width="12" height="9" rx="1.5" /><polyline points="2.5 4.5 8 9 13.5 4.5" /></g>,
    chart: <g {...p}><line x1="3" y1="13" x2="13" y2="13" /><rect x="4" y="8" width="2" height="4" /><rect x="7.5" y="5" width="2" height="7" /><rect x="11" y="9" width="2" height="3" /></g>,
    chevron: <polyline points="5 3.5 9.5 8 5 12.5" {...p} />,
    chevronD: <polyline points="3.5 6 8 10.5 12 6" {...p} />,
    x: <g {...p}><line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" /></g>,
    book: <g {...p}><path d="M3 3.5h4.5a1.5 1.5 0 0 1 1.5 1.5v8a1.2 1.2 0 0 0-1.2-1.2H3z" /><path d="M13 3.5H8.5A1.5 1.5 0 0 0 7 5v8a1.2 1.2 0 0 1 1.2-1.2H13z" /></g>,
    refresh: <g {...p}><path d="M13 8a5 5 0 1 1-1.4-3.5" /><polyline points="13 2.5 13 5 10.4 5" /></g>,
    lock: <g {...p}><rect x="3.5" y="7" width="9" height="6.3" rx="1.3" /><path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" /></g>,
    grid: <g {...p}><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></g>,
    sliders: <g {...p}><line x1="2.5" y1="5" x2="13.5" y2="5" /><line x1="2.5" y1="11" x2="13.5" y2="11" /><circle cx="10" cy="5" r="1.6" /><circle cx="6" cy="11" r="1.6" /></g>,
    plug: <g {...p}><path d="M5.5 9.5 2.5 12.5M10.5 6.5l3-3" /><rect x="6" y="4.2" width="5.8" height="5.8" rx="1.5" transform="rotate(45 9 7)" /></g>,
    users: <g {...p}><circle cx="6" cy="6" r="2.3" /><path d="M2.5 13c0-2 1.6-3.3 3.5-3.3S9.5 11 9.5 13" /><path d="M10.5 4.2a2.2 2.2 0 0 1 0 4.1M11 13c0-1.6-.8-2.8-2-3.2" /></g>,
    dot: <circle cx="8" cy="8" r="3" fill={color} stroke="none" />,
  };
  return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ display: 'block', flexShrink: 0, ...style }}>{paths[name] || null}</svg>;
}

const KIND_ICON = { deadline: 'shield', billing: 'dollar', anomaly: 'alert', budget: 'chart', silence: 'mail' };
const GATE_TONE = {
  ESCALATION: { fg: T.danger, bg: T.dangerSoft, bd: 'rgba(155,45,35,.28)' },
  REVIEW: { fg: T.gold, bg: 'rgba(169,132,53,.10)', bd: 'rgba(169,132,53,.30)' },
  BLOCKED: { fg: '#3A4A44', bg: 'rgba(20,34,31,.07)', bd: 'rgba(20,34,31,.18)' },
  LOG: { fg: T.teal, bg: T.tealSoft, bd: 'rgba(29,158,117,.26)' },
};

// ── atoms ────────────────────────────────────────────────────────────────────
function Mono({ children, style }) {
  return <span style={{ fontFamily: 'var(--font-mono)', ...style }}>{children}</span>;
}

function GateChip({ gate, mono = false, size = 'md' }) {
  const g = window.LITT.GATE_META[gate]; const tone = GATE_TONE[gate];
  const pad = size === 'sm' ? '3px 8px' : '4px 10px';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: pad,
      borderRadius: 999, background: tone.bg, color: tone.fg,
      border: `1px solid ${tone.bd}`, fontSize: size === 'sm' ? 11 : 12, fontWeight: 600,
      whiteSpace: 'nowrap', lineHeight: 1.1,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.fg }} />
      {mono ? <Mono style={{ fontSize: 10.5, letterSpacing: '.02em', fontWeight: 600 }}>{g.mono}</Mono> : g.label}
    </span>
  );
}

function Btn({ children, kind = 'primary', onClick, disabled, size = 'md', full, icon, style }) {
  const sizes = { sm: '7px 12px', md: '10px 16px', lg: '12px 18px' };
  const kinds = {
    primary: { background: T.forest, color: T.brass, border: `1px solid ${T.forest}` },
    teal: { background: T.teal, color: '#fff', border: `1px solid ${T.teal}` },
    ghost: { background: 'transparent', color: T.ink, border: `1px solid ${T.line}` },
    danger: { background: 'transparent', color: T.danger, border: `1px solid rgba(155,45,35,.4)` },
    quiet: { background: 'transparent', color: T.muted, border: '1px solid transparent' },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      padding: sizes[size], borderRadius: 9, fontSize: 13.5, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', width: full ? '100%' : 'auto',
      opacity: disabled ? 0.45 : 1, transition: 'transform .06s ease, filter .15s ease',
      ...kinds[kind], ...style,
    }}
      onMouseDown={e => !disabled && (e.currentTarget.style.transform = 'scale(.98)')}
      onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
      {icon && <Icon name={icon} size={15} color="currentColor" />}{children}
    </button>
  );
}

// ── proof block (depth on demand) ────────────────────────────────────────────
function ProofBlock({ proof, dark = false }) {
  const c = dark
    ? { lab: T.auditMuted, val: '#E6E2D2', line: 'rgba(214,193,129,.16)', tagBg: 'rgba(255,255,255,.05)', tagFg: T.auditAccent, tagBd: 'rgba(158,225,199,.22)', src: 'rgba(214,193,129,.06)', srcBd: 'rgba(214,193,129,.18)', srcFg: T.brass }
    : { lab: T.faint, val: T.ink, line: T.soft, tagBg: 'rgba(20,34,31,.06)', tagFg: T.forest, tagBd: 'rgba(20,34,31,.16)', src: 'rgba(169,132,53,.06)', srcBd: 'rgba(169,132,53,.22)', srcFg: T.gold };
  const Row = ({ k, children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 12, alignItems: 'start' }}>
      <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: c.lab, paddingTop: 1 }}>{k}</Mono>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: c.val }}>{children}</div>
    </div>
  );
  const r = proof.route;
  return (
    <div style={{ display: 'grid', gap: 11 }}>
      <Row k="Reading">{proof.what}</Row>
      <Row k="Litt did">{proof.did}</Row>
      {/* source */}
      <Row k="Source">
        <div style={{ background: c.src, border: `1px solid ${c.srcBd}`, borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
            <Mono style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: c.srcFg, border: `1px solid ${c.srcBd}`, borderRadius: 4, padding: '1px 6px' }}>{proof.source.tag}</Mono>
            <Mono style={{ fontSize: 10.5, color: c.lab }}>{proof.source.ref}</Mono>
          </div>
          <div style={{ fontSize: 12, fontStyle: 'italic', color: c.val, lineHeight: 1.45 }}>“{proof.source.line}”</div>
        </div>
      </Row>
      {/* routing chips */}
      <Row k="Routing">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {[r.agent, `work: ${r.work}`, `llm: ${r.llm}`, ...(proof.confidence != null ? [`confidence: ${proof.confidence}`] : []), r.extra].map(t => (
            <Mono key={t} style={{ fontSize: 10.5, color: c.tagFg, background: c.tagBg, border: `1px solid ${c.tagBd}`, borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap' }}>{t}</Mono>
          ))}
        </div>
      </Row>
    </div>
  );
}

// ── audit-event builder ──────────────────────────────────────────────────────
function buildAuditEvent(d, payload) {
  const t = window.LITT.fmtTimeNow();
  const base = { id: `ae-${d.id}-${Date.now()}`, t, actor: 'D. Strand', entity: d.id, fresh: true };
  switch (payload.actionType) {
    case 'confirm':
      return { ...base, friendly: `You confirmed the ${d.client} court deadline.`, tier: 'legal_defensibility', event: 'deadline.confirmed', summary: `Confirmed HARD_LEGAL deadline — ${d.client} opposition due Jun 4.`, before: { verification_status: 'UNCONFIRMED' }, after: { verification_status: 'CONFIRMED', by: 'dana-strand' } };
    case 'extend':
      return { ...base, friendly: `You flagged the ${d.client} deadline for extension.`, tier: 'legal_defensibility', event: 'deadline.extended', summary: `Flagged ${d.client} deadline for extension / reassignment.`, before: { owner: 'dana-strand' }, after: { status: 'EXTENSION_REQUESTED', reason: payload.text } };
    case 'narrative':
      return { ...base, friendly: `You approved a $1,500 time entry for ${d.client}.`, tier: 'legal_defensibility', event: 'billing.approved', summary: `Added narrative and approved te-001 — ${d.client}, $1,500.`, before: { status: 'PENDING', narrative: null }, after: { status: 'APPROVED', narrative: payload.text, by: 'dana-strand' } };
    case 'writeoff':
      return { ...base, friendly: `You wrote off a $1,500 time entry for ${d.client}.`, tier: 'legal_defensibility', event: 'billing.written_off', summary: `Wrote off te-001 — ${d.client}, $1,500.`, before: { status: 'PENDING' }, after: { status: 'WRITTEN_OFF', reason: payload.text } };
    case 'dismiss':
      return { ...base, friendly: `You cleared a billing flag on ${d.client}, with a reason on record.`, tier: 'operational', event: 'anomaly.dismissed', summary: `Dismissed billing anomaly on te-001 with reason on record.`, before: { status: 'OPEN' }, after: { status: 'DISMISSED', reason: payload.text } };
    case 'ack':
      return { ...base, friendly: `You reviewed ${d.client}’s budget at 78%.`, tier: 'operational', event: 'budget.reviewed', summary: `Acknowledged Acme budget at 78% of $15,000.`, before: { ack: false }, after: { ack: true, by: 'dana-strand' } };
    case 'raise':
      return { ...base, friendly: `You opened a budget-increase request for ${d.client}.`, tier: 'operational', event: 'budget.increase_requested', summary: `Opened budget-increase request for Acme.`, before: { cap: 15000 }, after: { status: 'INCREASE_REQUESTED', reason: payload.text } };
    case 'approve_comms':
      return { ...base, friendly: `You approved a status note to ${d.client} — queued for your signature.`, tier: 'operational', event: 'comms.approved', summary: `Approved Whitmore status note — queued for your signature, not sent.`, before: { status: 'DRAFT' }, after: { status: 'QUEUED', by: 'dana-strand' } };
    case 'dismiss_comms':
      return { ...base, friendly: `You dismissed the ${d.client} outreach draft.`, tier: 'operational', event: 'comms.dismissed', summary: `Dismissed Whitmore outreach draft with reason.`, before: { status: 'DRAFT' }, after: { status: 'DISMISSED', reason: payload.text } };
    default:
      return { ...base, friendly: `You resolved an item for ${d.client}.`, tier: 'operational', event: 'item.resolved', summary: `Resolved ${d.headline}.`, before: {}, after: {} };
  }
}

// ── resolve panel (modal) ────────────────────────────────────────────────────
function ResolvePanel({ decision, onResolve, onClose }) {
  const d = decision;
  const [choice, setChoice] = _useState(d.action);     // primary vs alt
  const [text, setText] = _useState('');
  const [showProof, setShowProof] = _useState(false);
  if (!d) return null;

  const need = choice.need;
  const ready = !need || text.trim().length >= (need === 'narrative' ? 8 : 4);
  const tone = GATE_TONE[d.gate];

  const inputLabel = need === 'narrative'
    ? 'Narrative — describe the work performed'
    : 'Reason — recorded permanently in the audit log';
  const placeholder = need === 'narrative'
    ? 'e.g. Drafted opposition to MSJ; reviewed Dunlap’s statement of facts and assembled controverting exhibits.'
    : choice.type === 'extend' ? 'e.g. Reassigning to Okafor; requesting 7-day extension from chambers.'
      : choice.type === 'writeoff' ? 'e.g. Non-billable internal review — absorb.'
        : choice.type === 'dismiss' ? 'e.g. Entry was a duplicate of te-014; original already narrated.'
          : 'Reason for the record…';

  const previewEvent = buildAuditEvent(d, { actionType: choice.type, text: text.trim() || '…' });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,30,26,.46)', backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 20, animation: 'litt-fade .16s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(580px, 96vw)', maxHeight: '92vh', overflowY: 'auto', background: T.surface, borderRadius: 16, border: `1px solid ${T.line}`, boxShadow: '0 24px 70px rgba(20,20,18,.28)' }}>
        {/* header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${T.soft}`, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: tone.bg, border: `1px solid ${tone.bd}`, display: 'grid', placeItems: 'center' }}><Icon name={KIND_ICON[d.kind]} size={16} color={tone.fg} /></span>
              <div>
                <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: T.faint }}>{window.LITT.KIND_META[d.kind]}</Mono>
                <div style={{ fontSize: 13, color: T.muted }}>{d.client}</div>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.faint, padding: 4 }}><Icon name="x" size={18} /></button>
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, lineHeight: 1.2, color: T.ink, letterSpacing: '-.01em' }}>{d.headline}</h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: T.muted }}>{d.plain}</p>
        </div>

        {/* body */}
        <div style={{ padding: '16px 22px 4px', display: 'grid', gap: 14 }}>
          {/* stakes line */}
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: d.gate === 'ESCALATION' ? T.dangerSoft : T.wash2, border: `1px solid ${d.gate === 'ESCALATION' ? 'rgba(155,45,35,.2)' : T.soft}`, borderRadius: 10, padding: '10px 12px' }}>
            <Icon name="alert" size={15} color={d.gate === 'ESCALATION' ? T.danger : T.gold} style={{ marginTop: 1 }} />
            <span style={{ fontSize: 12.5, lineHeight: 1.45, color: T.ink }}>{d.stakes}</span>
          </div>

          {/* draft preview for comms */}
          {d.draft && (
            <div style={{ borderLeft: `2px solid ${T.tealSoft}`, paddingLeft: 12 }}>
              <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint }}>Drafted by Litt · awaiting you</Mono>
              <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55, color: T.ink, fontStyle: 'italic' }}>{d.draft}</p>
            </div>
          )}

          {/* action selector (primary vs alt) */}
          {d.alt && (
            <div style={{ display: 'flex', gap: 8 }}>
              {[d.action, d.alt].map(a => {
                const on = choice.type === a.type;
                return (
                  <button key={a.type} onClick={() => { setChoice(a); setText(''); }} style={{
                    flex: 1, textAlign: 'left', padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                    background: on ? T.forest : T.surface, color: on ? T.brass : T.ink,
                    border: `1px solid ${on ? T.forest : T.line}`, fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ width: 14, height: 14, borderRadius: 999, border: `1.5px solid ${on ? T.brass : T.faint}`, display: 'grid', placeItems: 'center' }}>{on && <span style={{ width: 6, height: 6, borderRadius: 999, background: T.brass }} />}</span>
                    {a.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* required input */}
          {need && (
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: T.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
                {inputLabel}
                <Mono style={{ fontSize: 10, color: need === 'reason' ? T.danger : T.gold, fontWeight: 600 }}>· required</Mono>
              </label>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} rows={need === 'narrative' ? 3 : 2}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '10px 12px', borderRadius: 9, border: `1px solid ${text ? T.teal : T.line}`, fontSize: 13.5, lineHeight: 1.5, color: T.ink, background: T.surface, outline: 'none', fontFamily: 'var(--font-sans)' }} />
              <span style={{ fontSize: 11, color: T.faint }}>{need === 'narrative' ? 'Goes onto the invoice and the LEDES export.' : 'Litt never dismisses silently — this reason is logged forever.'}</span>
            </div>
          )}

          {/* depth on demand: proof */}
          <div style={{ border: `1px solid ${T.soft}`, borderRadius: 10, overflow: 'hidden' }}>
            <button onClick={() => setShowProof(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', background: T.wash2, border: 'none', cursor: 'pointer', color: T.muted }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600 }}><Icon name="book" size={14} color={T.gold} />Show Litt’s work — source, routing &amp; confidence</span>
              <Icon name={showProof ? 'chevronD' : 'chevron'} size={14} />
            </button>
            {showProof && <div style={{ padding: '14px 14px 16px' }}><ProofBlock proof={d.proof} /></div>}
          </div>

          {/* will be logged preview — the backbone */}
          <div style={{ background: T.audit, borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Icon name="shield" size={13} color={T.auditAccent} />
              <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: T.auditMuted }}>Will be written to the audit log</Mono>
            </div>
            <Mono style={{ fontSize: 11.5, color: T.brass }}>{previewEvent.event}</Mono>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Mono style={{ fontSize: 10.5, color: T.auditMuted }}>actor=dana-strand</Mono>
              <Mono style={{ fontSize: 10.5, color: T.auditMuted }}>· entity={d.id}</Mono>
              <Mono style={{ fontSize: 10.5, color: T.auditMuted }}>· tier={previewEvent.tier.replace('legal_defensibility', 'legal')}</Mono>
            </div>
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: '14px 22px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind={choice.type === 'writeoff' || choice.type === 'dismiss' || choice.type === 'dismiss_comms' ? 'danger' : 'primary'} disabled={!ready} icon={ready ? 'check' : null}
            onClick={() => onResolve(d, { actionType: choice.type, text: text.trim() })}>
            {choice.label}
          </Btn>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Icon, Mono, GateChip, Btn, ProofBlock, ResolvePanel, buildAuditEvent, KIND_ICON, GATE_TONE, T });
