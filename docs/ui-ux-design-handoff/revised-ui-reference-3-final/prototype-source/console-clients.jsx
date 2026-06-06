/* ───────────────────────────────────────────────────────────────────────────
   Litt — Console · Clients & comms  ·  the Relationships hero
   Two jobs, one surface. INBOUND: Litt watches the attorney's inbox, triages
   the client messages that need a reply — summarizing each, pulling out the
   action items, and drafting what you'd send. OUTBOUND: it tracks matters
   going quiet and drafts a check-in. Reading is read-only; every draft is
   source-backed and held behind your signature. Litt never sends.
   This is the one domain with a model in the loop — so the trust story lives
   here too: deterministic detection, Gemini drafts, human gate.
─────────────────────────────────────────────────────────────────────────── */
const { useState: useStateCl } = React;

const THRESH = 14;          // silence threshold (days)
const SCALE = 21;           // recency track max (days)

// ── inbound: messages awaiting the attorney's response ────────────────────────
const INBOUND = [
  {
    id: 'in-mercer',
    from: 'Sandra Mercer', role: 'General Counsel', initials: 'SM',
    client: 'Mercer Industries', matter: 'v. Dunlap Construction',
    received: 'Jun 3 · 4:12 PM', waitDays: 2,
    urgency: { level: 'high', label: 'High' },
    message: 'Counsel — can you confirm we’ll have the opposition filed by Thursday? The board is asking for an update. We’ll also need the updated exhibit list before then. Thanks, Sandra',
    summary: 'Sandra (GC) wants confirmation the MSJ opposition will be filed by Thursday, and is asking for the updated exhibit list for the board.',
    signals: ['From the GC — decision-maker', 'Awaiting 2 days', 'Mentions a Thursday deadline', 'Names the Mercer matter'],
    actions: [
      { text: 'Confirm the opposition is filed by Thu, Jun 4', link: 'Deadline Monitor' },
      { text: 'Send the updated exhibit list (EOD tomorrow)' },
    ],
    cross: { agent: 'Deadline Monitor', note: 'Mercer opposition · due Jun 4 · UNCONFIRMED', tone: T.danger },
    reply: 'Hi Sandra — yes, we’re on track to file the opposition by Thursday, June 4. I’ll send the updated exhibit list by end of day tomorrow. Happy to hop on a quick call if the board would like a walkthrough. — Dana',
    grounding: [
      { claim: '“Thursday, June 4”', src: 'deadline', detail: 'dl-mercer-001 · court order' },
      { claim: '“exhibit list… end of day tomorrow”', src: 'matter task', detail: 'exhibit list · in progress' },
    ],
  },
  {
    id: 'in-lindqvist',
    from: 'Erik Lindqvist', role: 'Principal', initials: 'EL',
    client: 'Lindqvist Holdings', matter: 'Okafor v. Lindqvist',
    received: 'Jun 4 · 9:40 AM', waitDays: 1,
    urgency: { level: 'med', label: 'Medium' },
    summary: 'Erik is asking whether the discovery production is still on track, so he can brief his internal team this week.',
    signals: ['Awaiting 1 day', 'Mentions discovery', 'Names the Lindqvist matter'],
    actions: [{ text: 'Confirm the discovery production timeline' }],
    reply: true,
  },
  {
    id: 'in-acme',
    from: 'Karen Bell', role: 'Operations', initials: 'KB',
    client: 'Acme Commercial Partners', matter: 'GC retainer',
    received: 'Jun 4 · 8:05 AM', waitDays: 1,
    urgency: { level: 'med', label: 'Medium' },
    summary: 'Karen has a question about last month’s invoice — she’d like the hours on the contract review explained.',
    signals: ['Awaiting 1 day', 'Billing question', 'Names the Acme matter'],
    actions: [{ text: 'Walk through the contract-review hours' }],
    cross: { agent: 'Billing Reconciliation', note: 'Acme · GC retainer · pulled the entry', tone: T.gold },
    reply: true,
  },
];

// ── outbound: relationships going quiet ───────────────────────────────────────
const CLIENTS = [
  { client: 'Whitmore Group', matter: 'Employment advisory', last: 'May 13', days: 16, silent: true },
  { client: 'Lindqvist Holdings', matter: 'Okafor v. Lindqvist', last: 'May 20', days: 9 },
  { client: 'Acme Commercial Partners', matter: 'GC retainer', last: 'May 24', days: 5 },
  { client: 'Mercer Industries', matter: 'v. Dunlap Construction', last: 'May 27', days: 2 },
  { client: 'Reyes Logistics', matter: 'Vendor dispute', last: 'May 28', days: 1 },
];

const DRAFT = 'Hi — quick check-in on your employment advisory matter. We’re monitoring the items we discussed and there’s nothing requiring action from you this week. I’ll send a fuller update once the policy review wraps. As always, reach out anytime. — Dana';
const GROUNDING = [
  { claim: '“the policy review wraps”', src: 'matter record', detail: 'task: policy review · in progress' },
  { claim: '“nothing requiring action”', src: 'open items', detail: '0 items awaiting client' },
];
const COMMS_LOG = [
  { dir: 'held', client: 'Mercer Industries', what: 'Reply to S. Mercer', when: 'Today · 5:00 PM', meta: 'awaiting your signature' },
  { dir: 'held', client: 'Whitmore Group', what: 'Check-in draft', when: 'Today · 5:00 PM', meta: 'awaiting your signature' },
  { dir: 'sent', client: 'Reyes Logistics', what: 'Status update', when: 'Today · 11:30 AM', meta: 'you approved · sent' },
  { dir: 'logged', client: 'Acme Commercial', what: 'Call summary', when: 'May 24', meta: 'logged to matter' },
];

function warmth(days) {
  if (days > THRESH) return { key: 'silent', label: 'silent', color: T.gold };
  if (days > 7) return { key: 'quiet', label: 'quiet', color: T.faint };
  return { key: 'warm', label: 'warm', color: T.teal };
}
const urgencyTone = lvl => lvl === 'high' ? T.danger : T.gold;

// ── section subheader ─────────────────────────────────────────────────────────
function SubHead({ icon, title, sub, count, tone }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 6 }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, background: `${tone}14`, border: `1px solid ${tone}33`, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={icon} size={15} color={tone} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', color: T.ink }}>{title}</h2>
          <Mono style={{ fontSize: 11, fontWeight: 600, color: tone, background: `${tone}14`, border: `1px solid ${tone}40`, borderRadius: 999, padding: '1px 8px' }}>{count}</Mono>
        </div>
        <span style={{ fontSize: 12.5, color: T.muted }}>{sub}</span>
      </div>
    </div>
  );
}

// ── inbound triage card ───────────────────────────────────────────────────────
function InboundCard({ m, expanded }) {
  const tone = urgencyTone(m.urgency.level);
  if (!expanded) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 13, padding: '13px 16px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center' }}>
        <span style={{ width: 34, height: 34, borderRadius: 999, background: T.wash2, border: `1px solid ${T.line}`, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: T.muted, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{m.initials}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{m.from}</span>
            <Mono style={{ fontSize: 10.5, color: T.faint }}>{m.client} · {m.matter}</Mono>
            {m.cross && <Mono style={{ fontSize: 9.5, fontWeight: 600, color: m.cross.tone, background: `${m.cross.tone}12`, border: `1px solid ${m.cross.tone}33`, borderRadius: 5, padding: '1px 6px' }}>→ {m.cross.agent}</Mono>}
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: T.muted, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{m.summary}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <Mono style={{ fontSize: 10, fontWeight: 600, color: tone, textTransform: 'uppercase', letterSpacing: '.04em', display: 'block' }}>{m.urgency.label}</Mono>
            <Mono style={{ fontSize: 10, color: T.teal }}>reply ready</Mono>
          </div>
          <a href="Litt — Daily Closeout.html" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T.forest, fontSize: 12.5, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Review <Icon name="chevron" size={12} color={T.forest} /></a>
        </div>
      </div>
    );
  }
  return (
    <section style={{ background: T.surface, border: `1px solid ${tone}40`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ width: 4, background: tone, flexShrink: 0 }} />
        <div style={{ flex: 1, padding: '17px 20px', minWidth: 0 }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ width: 38, height: 38, borderRadius: 999, background: T.wash2, border: `1px solid ${T.line}`, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: T.muted, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{m.initials}</span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{m.from} <span style={{ fontSize: 12, fontWeight: 400, color: T.faint }}>· {m.role}</span></div>
              <Mono style={{ fontSize: 11, color: T.muted }}>{m.client} · {m.matter} · {m.received}</Mono>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 999, background: `${tone}12`, border: `1px solid ${tone}38` }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: tone }} />
              <Mono style={{ fontSize: 10.5, fontWeight: 600, color: tone }}>{m.urgency.label} · awaiting {m.waitDays}d</Mono>
            </span>
          </div>

          {/* original message */}
          <div style={{ marginTop: 13, borderLeft: `2px solid ${T.line}`, paddingLeft: 12 }}>
            <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint }}>The message · read-only from Gmail</Mono>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: T.muted, lineHeight: 1.55, fontStyle: 'italic' }}>“{m.message}”</p>
          </div>

          {/* triage grid */}
          <div style={{ marginTop: 15, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="co-grid">
            <div>
              <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint, display: 'block', marginBottom: 5 }}>What they need</Mono>
              <p style={{ margin: 0, fontSize: 13, color: T.ink, lineHeight: 1.5 }}>{m.summary}</p>
              <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint, display: 'block', margin: '12px 0 6px' }}>Why it surfaced</Mono>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {m.signals.map(s => <Mono key={s} style={{ fontSize: 10, color: T.muted, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 5, padding: '2px 7px' }}>{s}</Mono>)}
              </div>
            </div>
            <div>
              <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint, display: 'block', marginBottom: 7 }}>Action items</Mono>
              <div style={{ display: 'grid', gap: 7 }}>
                {m.actions.map(a => (
                  <div key={a.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${T.faint}`, flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.4 }}>{a.text}{a.link && <Mono style={{ fontSize: 9.5, fontWeight: 600, color: T.danger, background: 'rgba(155,45,35,.08)', border: '1px solid rgba(155,45,35,.24)', borderRadius: 5, padding: '1px 6px', marginLeft: 6, whiteSpace: 'nowrap' }}>→ {a.link}</Mono>}</span>
                  </div>
                ))}
              </div>
              {m.cross && (
                <div style={{ marginTop: 11, display: 'flex', alignItems: 'center', gap: 8, background: `${m.cross.tone}0c`, border: `1px solid ${m.cross.tone}2e`, borderRadius: 9, padding: '8px 10px' }}>
                  <Icon name="refresh" size={13} color={m.cross.tone} />
                  <div style={{ minWidth: 0 }}>
                    <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.06em', color: T.faint, display: 'block' }}>Handed to {m.cross.agent}</Mono>
                    <Mono style={{ fontSize: 11, color: T.ink }}>{m.cross.note}</Mono>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* suggested reply */}
          <div style={{ marginTop: 15, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
              <Icon name="mail" size={13} color={T.teal} />
              <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: T.faint }}>Suggested reply · drafted by Litt · held</Mono>
              <Mono style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 600, color: T.teal, border: '1px solid rgba(29,158,117,.4)', borderRadius: 5, padding: '1px 6px' }}>Gemini · 0.95</Mono>
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: T.ink, fontStyle: 'italic' }}>{m.reply}</p>
            <div style={{ marginTop: 11, paddingTop: 11, borderTop: `1px solid ${T.soft}`, display: 'grid', gap: 6 }}>
              {m.grounding.map(gd => (
                <div key={gd.claim} style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <Icon name="check" size={12} color={T.teal} stroke={2.4} />
                  <span style={{ fontSize: 12, color: T.ink }}>{gd.claim}</span>
                  <Mono style={{ fontSize: 9.5, fontWeight: 600, color: T.gold, background: 'rgba(169,132,53,.1)', border: '1px solid rgba(169,132,53,.26)', borderRadius: 5, padding: '1px 6px' }}>{gd.src}</Mono>
                  <Mono style={{ fontSize: 10.5, color: T.faint }}>{gd.detail}</Mono>
                </div>
              ))}
            </div>
          </div>

          {/* actions */}
          <div style={{ marginTop: 14, display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href="Litt — Daily Closeout.html" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: T.forest, color: T.brass, fontSize: 13.5, fontWeight: 600, padding: '11px 18px', borderRadius: 10, textDecoration: 'none' }}>Approve &amp; send <Icon name="arrow" size={14} color={T.brass} /></a>
            {['Edit', 'Snooze', 'Hand off'].map(b => (
              <button key={b} style={{ background: 'transparent', color: T.muted, fontSize: 13, fontWeight: 600, padding: '10px 15px', borderRadius: 10, border: `1px solid ${T.line}`, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{b}</button>
            ))}
            <Mono style={{ fontSize: 10.5, color: T.faint, marginLeft: 'auto' }}>Litt never sends — approval queues it for your signature.</Mono>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── commitment lifecycle ──────────────────────────────────────────────────────
const CM_STATUS = {
  pending:    { label: 'Pending send', color: '#8A8578' },
  tracked:    { label: 'Tracked',      color: T.teal },
  'due-soon': { label: 'Due soon',     color: T.gold },
  kept:       { label: 'Kept',         color: T.teal },
  slipped:    { label: 'Slipped',      color: T.danger },
};

function StageRail({ status, captured }) {
  const closed = status === 'kept' || status === 'slipped';
  const trackedDone = status !== 'pending';
  const outcome = status === 'slipped' ? { label: 'Slipped', color: T.danger }
    : status === 'kept' ? { label: 'Kept', color: T.teal }
    : { label: 'Outcome', color: T.faint };
  const nodes = [
    { label: `Captured ${captured}`, color: T.teal, done: true },
    { label: 'Tracked', color: trackedDone ? T.teal : T.faint, done: trackedDone },
    { label: outcome.label, color: closed ? outcome.color : T.faint, done: closed },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {nodes.map((n, i) => (
        <React.Fragment key={i}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: n.done ? n.color : 'transparent', border: `1.5px solid ${n.done ? n.color : T.line}`, flexShrink: 0 }} />
            <Mono style={{ fontSize: 9.5, color: n.done ? T.muted : T.faint, whiteSpace: 'nowrap' }}>{n.label}</Mono>
          </span>
          {i < 2 && <span style={{ width: 20, height: 1.5, background: nodes[i + 1].done ? nodes[i + 1].color : T.soft, margin: '0 8px', flexShrink: 0 }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function CommitmentCard({ c, onMark, flashed }) {
  const sm = CM_STATUS[c.status];
  const closed = c.status === 'kept' || c.status === 'slipped';
  const pending = c.status === 'pending';
  const dueSoon = c.status === 'due-soon';
  return (
    <div style={{ border: `1px solid ${closed ? T.soft : sm.color + '40'}`, borderLeft: `3px solid ${dueSoon ? T.gold : closed ? sm.color : 'transparent'}`, borderRadius: 12, padding: '13px 15px', background: closed ? T.wash2 : T.surface, display: 'grid', gap: 10 }}>
      {/* quote + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: closed ? T.muted : T.ink, lineHeight: 1.45, fontStyle: 'italic' }}>“{c.quote}”</div>
          <Mono style={{ fontSize: 10.5, color: T.faint, marginTop: 3, display: 'block' }}>{c.client} · {c.matter}</Mono>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: `${sm.color}14`, border: `1px solid ${sm.color}40`, flexShrink: 0 }}>
          {(c.status === 'kept') && <Icon name="check" size={10} color={sm.color} stroke={2.6} />}
          {dueSoon && <span style={{ width: 6, height: 6, borderRadius: 999, background: sm.color }} className="litt-pulse" />}
          <Mono style={{ fontSize: 10.5, fontWeight: 600, color: sm.color }}>{sm.label}</Mono>
        </span>
      </div>
      {/* lifecycle rail */}
      <StageRail status={c.status} captured={c.captured} />
      {/* footer: due + link + actions, or outcome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 9, borderTop: `1px solid ${T.soft}` }}>
        {closed ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Icon name={c.status === 'kept' ? 'check' : 'alert'} size={12} color={sm.color} stroke={c.status === 'kept' ? 2.6 : 1.8} />
            <Mono style={{ fontSize: 11.5, color: c.status === 'kept' ? T.muted : T.danger }}>{c.closedNote}</Mono>
          </span>
        ) : (
          <>
            <Mono style={{ fontSize: 11.5, color: T.muted }}>Due {c.due.replace(', 2026', '')}</Mono>
            <Mono style={{ fontSize: 11, fontWeight: 600, color: dueSoon ? T.gold : T.faint }}>{c.daysOut <= 0 ? 'today' : c.daysOut + 'd'}</Mono>
            <span style={{ color: T.faint, fontSize: 10 }}>·</span>
            {c.onBook
              ? <a href="Litt - Console.html#deadlines" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}><Icon name="check" size={11} color={T.teal} stroke={2.4} /><Mono style={{ fontSize: 10.5, fontWeight: 600, color: T.teal }}>on the deadline book</Mono></a>
              : pending
                ? <Mono style={{ fontSize: 10.5, color: T.faint }}>tracks once you send</Mono>
                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="refresh" size={11} color={T.gold} /><Mono style={{ fontSize: 10.5, fontWeight: 600, color: T.gold }}>→ Deadline Monitor</Mono></span>}
            {!pending && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
                <button onClick={() => onMark(c.id, 'kept')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: `1px solid ${T.forest}`, background: T.forest, color: T.brass, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}><Icon name="check" size={11} color={T.brass} stroke={2.6} />Mark kept</button>
                <button onClick={() => onMark(c.id, 'slipped')} style={{ padding: '6px 11px', borderRadius: 8, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Slipped</button>
              </div>
            )}
          </>
        )}
      </div>
      {/* ledger-write confirmation */}
      {flashed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: T.audit, borderRadius: 8, padding: '7px 11px' }} className="cm-flash">
          <span style={{ width: 6, height: 6, borderRadius: 999, background: T.auditAccent, boxShadow: `0 0 6px ${T.auditAccent}` }} />
          <Mono style={{ fontSize: 10.5, color: '#E6E2D2' }}>commitment.{c.status} written to the audit ledger</Mono>
          <a href="Litt - Console.html#record" style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 600, color: T.auditAccent, textDecoration: 'none' }}>view →</a>
        </div>
      )}
    </div>
  );
}

function CommitmentTracker() {
  const base = window.LITTC.COMMITMENTS;
  const [over, setOver] = useStateCl({});
  const [flash, setFlash] = useStateCl(null);
  const items = base.map(c => (over[c.id] ? { ...c, ...over[c.id] } : c));

  function mark(id, status) {
    setOver(o => ({ ...o, [id]: { status, daysOut: 0, onBook: false, closedNote: status === 'kept' ? 'Fulfilled today' : 'Marked slipped today' } }));
    setFlash(id);
    setTimeout(() => setFlash(f => (f === id ? null : f)), 3200);
  }

  const isActive = c => c.status === 'pending' || c.status === 'tracked' || c.status === 'due-soon';
  const active = items.filter(isActive);
  const closed = items.filter(c => !isActive(c));
  const stats = [
    ['Active', active.length, T.teal],
    ['Due soon', items.filter(c => c.status === 'due-soon').length, T.gold],
    ['Kept', items.filter(c => c.status === 'kept').length, T.forest],
    ['Slipped', items.filter(c => c.status === 'slipped').length, T.danger],
  ];

  return (
    <>
      <SubHead icon="shield" title="Commitments you’ve made" tone={T.teal} count={`${active.length} active`}
        sub="Promises Litt caught in your sent replies — watched as soft deadlines from capture to kept." />

      {/* lifecycle summary + explainer */}
      <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '14px 18px', display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
        {stats.map(([k, v, c]) => (
          <div key={k} style={{ minWidth: 78 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: c }} />
              <span style={{ fontSize: 21, fontWeight: 700, color: T.ink, lineHeight: 1 }}>{v}</span>
            </div>
            <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: T.faint, display: 'block', marginTop: 4 }}>{k}</Mono>
          </div>
        ))}
        <div style={{ flex: 1, minWidth: 220, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 9, padding: '9px 12px' }}>
          <Icon name="shield" size={14} color={T.gold} />
          <Mono style={{ fontSize: 11, color: T.muted, lineHeight: 1.4 }}>Litt holds you to your word the way it holds clients to theirs. Each is quoted from a message you sent — never invented. Marking an outcome writes to the ledger.</Mono>
        </div>
      </section>

      {/* active */}
      <div style={{ display: 'grid', gap: 10 }}>
        {active.map(c => <CommitmentCard key={c.id} c={c} onMark={mark} flashed={flash === c.id} />)}
      </div>

      {/* closed this period */}
      {closed.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: T.faint, marginTop: 2 }}>Closed this period · {closed.length}</Mono>
          {closed.map(c => <CommitmentCard key={c.id} c={c} onMark={mark} flashed={flash === c.id} />)}
        </div>
      )}
    </>
  );
}

function ConsoleClients() {
  const rows = [...CLIENTS].sort((a, b) => b.days - a.days);
  const silent = rows.filter(r => r.days > THRESH);
  const warm = rows.filter(r => r.days <= 7);
  const quiet = rows.filter(r => r.days > 7 && r.days <= THRESH);
  const hero = silent[0];

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 18 }}>

        {/* header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Clients &amp; comms</h1>
            <Mono style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: T.teal, background: T.tealSoft, border: '1px solid rgba(29,158,117,.28)', borderRadius: 5, padding: '2px 7px' }}>relationships</Mono>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '70ch' }}>
            Litt watches your inbox and your matters. It surfaces the client messages that need a reply — summarizing each, pulling out the action items, and drafting what you’d send — and it flags the relationships going quiet. Reading is read-only; every draft is held for your signature.
          </p>
        </div>

        {/* summary strip */}
        <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '15px 20px', display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
          {[['Awaiting your reply', INBOUND.length, T.danger, 'inbound · needs you'],
            ['Going quiet', silent.length, T.gold, `past ${THRESH}d silent`],
            ['Warm', warm.length, T.teal, '≤ 7 days']].map(([k, v, c, s]) => (
            <div key={k} style={{ minWidth: 118 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: c }} />
                <span style={{ fontSize: 22, fontWeight: 700, color: T.ink, lineHeight: 1 }}>{v}</span>
              </div>
              <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: T.faint, display: 'block', marginTop: 4 }}>{k}</Mono>
              <Mono style={{ fontSize: 10, color: T.faint }}>{s}</Mono>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 9, padding: '8px 12px' }}>
            <Icon name="lock" size={13} color={T.gold} />
            <Mono style={{ fontSize: 11, color: T.muted }}>Read-only inbox · Litt drafts · you send</Mono>
          </div>
        </section>

        {/* ── INBOUND: awaiting your response ─────────────────────── */}
        <SubHead icon="mail" title="Awaiting your response" tone={T.danger} count={`${INBOUND.length} messages`}
          sub="Important client emails sitting in your inbox — triaged, with a reply ready to review." />
        {INBOUND.map((m, i) => <InboundCard key={m.id} m={m} expanded={i === 0} />)}

        {/* ── COMMITMENTS: promises you made · lifecycle tracker ──── */}
        <CommitmentTracker />

        {/* ── OUTBOUND: going quiet ───────────────────────────────── */}
        <SubHead icon="clock" title="Going quiet" tone={T.gold} count={`${silent.length} matter`}
          sub="Relationships drifting past your contact threshold — with a check-in drafted." />

        {hero && (
          <section style={{ background: T.surface, border: `1px solid rgba(169,132,53,.34)`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              <div style={{ width: 4, background: T.gold, flexShrink: 0 }} />
              <div style={{ flex: 1, padding: '18px 22px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center', minWidth: 76, padding: '7px 12px', borderRadius: 12, background: 'rgba(169,132,53,.1)', border: '1px solid rgba(169,132,53,.24)' }}>
                    <div style={{ fontSize: 30, fontWeight: 700, color: T.gold, lineHeight: 1 }}>{hero.days}</div>
                    <Mono style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: T.gold, marginTop: 2 }}>days silent</Mono>
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: T.gold }} className="litt-pulse" />
                      <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: T.gold, fontWeight: 600 }}>No contact in 16 days · a draft is ready</Mono>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: T.ink, letterSpacing: '-.01em' }}>{hero.client}</div>
                    <Mono style={{ fontSize: 11.5, color: T.muted }}>{hero.matter} · last contact {hero.last} · threshold {THRESH}d</Mono>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <Mono style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', color: T.teal, border: '1px solid rgba(29,158,117,.4)', borderRadius: 5, padding: '2px 7px' }}>Gemini draft</Mono>
                    <Mono style={{ fontSize: 10.5, color: T.faint }}>confidence 0.94</Mono>
                  </div>
                </div>
                <div style={{ marginTop: 16, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 12, padding: '15px 17px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Icon name="mail" size={13} color={T.gold} />
                    <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: T.faint }}>Drafted by Litt · every fact cited · awaiting your signature</Mono>
                  </div>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: T.ink, fontStyle: 'italic' }}>{DRAFT}</p>
                  <div style={{ marginTop: 13, paddingTop: 12, borderTop: `1px solid ${T.soft}`, display: 'grid', gap: 7 }}>
                    <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint }}>Where each claim comes from</Mono>
                    {GROUNDING.map(gd => (
                      <div key={gd.claim} style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                        <Icon name="check" size={12} color={T.teal} stroke={2.4} />
                        <span style={{ fontSize: 12.5, color: T.ink }}>{gd.claim}</span>
                        <Mono style={{ fontSize: 9.5, fontWeight: 600, color: T.gold, background: 'rgba(169,132,53,.1)', border: '1px solid rgba(169,132,53,.26)', borderRadius: 5, padding: '1px 6px' }}>{gd.src}</Mono>
                        <Mono style={{ fontSize: 10.5, color: T.faint }}>{gd.detail}</Mono>
                      </div>
                    ))}
                    <Mono style={{ fontSize: 10.5, color: T.faint, lineHeight: 1.5 }}>Any sentence Litt can’t ground becomes an <span style={{ color: T.muted }}>[ATTORNEY]</span> placeholder — never an invented fact.</Mono>
                  </div>
                </div>
                <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <a href="Litt — Daily Closeout.html" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: T.forest, color: T.brass, fontSize: 13.5, fontWeight: 600, padding: '11px 18px', borderRadius: 10, textDecoration: 'none' }}>Review &amp; approve in closeout <Icon name="arrow" size={14} color={T.brass} /></a>
                  <a href="Litt — Daily Closeout.html" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', color: T.muted, fontSize: 13.5, fontWeight: 600, padding: '11px 16px', borderRadius: 10, textDecoration: 'none', border: `1px solid ${T.line}` }}>Dismiss with a reason</a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* relationship board */}
        <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.soft}`, background: T.wash2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: T.muted, fontWeight: 600 }}>Every relationship · time since last contact</Mono>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 18, height: 2, background: T.gold, display: 'inline-block' }} />
              <Mono style={{ fontSize: 10, color: T.faint }}>{THRESH}d threshold</Mono>
            </div>
          </div>
          {rows.map((r, i) => {
            const w = warmth(r.days);
            const pct = Math.min(100, (r.days / SCALE) * 100);
            const next = w.key === 'silent' ? 'Send the held draft' : w.key === 'quiet' ? 'Touch base this week' : 'On track';
            return (
              <div key={r.client} style={{ display: 'grid', gridTemplateColumns: '210px 1fr 132px', gap: 16, alignItems: 'center', padding: '13px 18px', borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${T.soft}`, borderLeft: `3px solid ${w.key === 'silent' ? T.gold : 'transparent'}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.client}</div>
                  <Mono style={{ fontSize: 10.5, color: T.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.matter}</Mono>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ position: 'relative', height: 8, borderRadius: 999, background: T.wash2 }}>
                    <div style={{ position: 'absolute', left: `${(THRESH / SCALE) * 100}%`, top: -3, bottom: -3, width: 2, background: T.gold, borderRadius: 2, opacity: .6 }} />
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: w.color, borderRadius: 999, transition: 'width .3s' }} />
                  </div>
                  <Mono style={{ fontSize: 10, color: T.faint, marginTop: 5, display: 'block' }}>last contact {r.last} · {next}</Mono>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: `${w.color}14`, border: `1px solid ${w.color}40` }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: w.color }} />
                    <Mono style={{ fontSize: 10.5, fontWeight: 600, color: w.color }}>{w.label}</Mono>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: w.color, minWidth: 30, textAlign: 'right' }}>{r.days}d</span>
                </div>
              </div>
            );
          })}
        </section>

        {/* comms log + how it works */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 16 }} className="co-grid">
          <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.soft}`, background: T.wash2 }}>
              <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: T.muted, fontWeight: 600 }}>Recent communications</Mono>
            </div>
            {COMMS_LOG.map((c, i) => {
              const tone = c.dir === 'held' ? T.gold : c.dir === 'sent' ? T.teal : T.faint;
              const verb = c.dir === 'held' ? 'Held' : c.dir === 'sent' ? 'Sent' : 'Logged';
              const icon = c.dir === 'held' ? 'lock' : c.dir === 'sent' ? 'check' : 'book';
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 11, alignItems: 'center', padding: '12px 18px', borderBottom: i === COMMS_LOG.length - 1 ? 'none' : `1px solid ${T.soft}` }}>
                  <span style={{ width: 26, height: 26, borderRadius: 7, background: `${tone}16`, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={icon} size={13} color={tone} stroke={c.dir === 'sent' ? 2.4 : 1.6} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}><span style={{ fontWeight: 600 }}>{c.what}</span> · {c.client}</div>
                    <Mono style={{ fontSize: 10.5, color: T.faint }}>{c.meta}</Mono>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Mono style={{ fontSize: 10, fontWeight: 600, color: tone, textTransform: 'uppercase', letterSpacing: '.04em', display: 'block' }}>{verb}</Mono>
                    <Mono style={{ fontSize: 10, color: T.faint }}>{c.when}</Mono>
                  </div>
                </div>
              );
            })}
          </section>

          <section style={{ background: T.audit, borderRadius: 14, padding: '16px 18px', display: 'grid', gap: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="mail" size={14} color={T.auditAccent} />
              <Mono style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.09em', color: T.auditMuted }}>How Litt handles your comms</Mono>
            </div>
            {[
              ['Read', '#9DA89A', 'Watches your inbox (read-only) and your matters. Scores urgency and silence deterministically — no model.'],
              ['Draft', T.auditAccent, 'Gemini summarizes each message and drafts a reply or check-in. Every fact must cite a record.'],
              ['Hold', T.brass, 'Drafts wait behind your signature. Litt prepares the words — it never sends.'],
            ].map(([k, c, d], i) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 11, alignItems: 'start' }}>
                <div style={{ display: 'grid', justifyItems: 'center', gap: 2 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 999, border: `1.5px solid ${c}`, color: c, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{i + 1}</span>
                  {i < 2 && <span style={{ width: 1, height: 14, background: 'rgba(214,193,129,.2)' }} />}
                </div>
                <div style={{ paddingTop: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#EFEBDB' }}>{k}</div>
                  <span style={{ fontSize: 11.5, color: T.auditMuted, lineHeight: 1.45 }}>{d}</span>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingTop: 4 }}>
              {['comms_agent', 'gmail: read-only', 'gemini-2.5-pro', 'approval_gate: on'].map(t => (
                <Mono key={t} style={{ fontSize: 9.5, color: T.auditAccent, background: 'rgba(158,225,199,.08)', border: '1px solid rgba(158,225,199,.2)', borderRadius: 5, padding: '2px 7px' }}>{t}</Mono>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

window.ConsoleClients = ConsoleClients;
