/* ───────────────────────────────────────────────────────────────────────────
   Litt — Console · Audit Ledger (Prove's home, full page)
   The defensibility surface. Every signal Litt classified, every tool it
   wrote, every gate it applied, every decision you made — append-only,
   tamper-evident, ordered newest-first. This is the page the email digest's
   "View the ledger" link resolves to.
─────────────────────────────────────────────────────────────────────────── */
const { useState: useStateRec } = React;

// fuller day-of-record for the dedicated page — grounded in the closeout fixture
const LEDGER = [
  { id: 'L13', t: '5:04 PM', tier: 'legal_defensibility', actor: 'D. Strand', event: 'deadline.confirmed', entity: 'dl-okafor-disc', summary: 'Confirmed discovery cutoff for Okafor v. Lindqvist (Jun 19).', before: { verification_status: 'UNCONFIRMED' }, after: { verification_status: 'CONFIRMED', by: 'dana-strand' } },
  { id: 'L12', t: '5:00 PM', tier: 'engineering', actor: 'Litt · coordinator', event: 'sweep.completed', entity: 'sweep-20260529-1700', summary: 'Closeout sweep ran across 4 sub-agents — 5 items surfaced, 1 critical.', before: { state: 'idle' }, after: { items: 5, critical: 1, elapsed_ms: 2140 } },
  { id: 'L11', t: '5:00 PM', tier: 'operational', actor: 'Litt · comms_agent', event: 'comms.draft_held', entity: 'whitmore-draft-01', summary: 'Drafted a Whitmore status note and held it behind your approval — not sent.', before: { status: 'NONE' }, after: { status: 'DRAFT_HELD', approval_gate: 'on', confidence: 0.94 } },
  { id: 'Lc1', t: '5:00 PM', tier: 'operational', actor: 'Litt · comms_agent', event: 'commitment.captured', entity: 'cm-reyes', summary: 'Caught a promise in your reply to Reyes — “answer by Friday” — and registered it as a tracked soft deadline.', before: { status: 'NONE' }, after: { status: 'TRACKED', due: '2026-06-05', source: 'attorney_reply', extracted_by: 'gemini-2.5-pro' } },
  { id: 'L10', t: '5:00 PM', tier: 'operational', actor: 'Litt · anomaly_agent', event: 'anomaly.detected', entity: 'anomaly-te-001', summary: 'Elevated billing anomaly on te-001 — missing narrative, reason required to clear.', before: { status: 'NONE' }, after: { status: 'OPEN', risk: 'ELEVATED', type: 'MISSING_NARRATIVE' } },
  { id: 'L09', t: '5:00 PM', tier: 'operational', actor: 'Litt · billing_agent', event: 'budget.threshold_crossed', entity: 'acme-retainer', summary: 'Acme utilization reached 78% — crossed the 75% WARN threshold.', before: { utilization: 0.71, alert: 'none' }, after: { utilization: 0.78, alert: 'WARN' } },
  { id: 'L08', t: '5:00 PM', tier: 'operational', actor: 'Litt · billing_agent', event: 'time_entry.held', entity: 'te-001', summary: 'Pre-bill scrubber held te-001 before approval — MISSING_NARRATIVE (WARN).', before: { status: 'PENDING' }, after: { status: 'HELD', flag: 'MISSING_NARRATIVE', severity: 'WARN' } },
  { id: 'L07', t: '4:58 PM', tier: 'operational', actor: 'Litt · deadline_agent', event: 'deadline.escalated', entity: 'dl-mercer-001', summary: 'Mercer opposition deadline entered the 7-day window — surfaced as critical, unconfirmed.', before: { escalation_level: '14_DAY' }, after: { escalation_level: '7_DAY', surfaced: true } },
  { id: 'L06', t: '4:58 PM', tier: 'engineering', actor: 'Litt · coordinator', event: 'signals.routed', entity: 'sweep-20260529-1700', summary: 'classify_signal() routed 4 signal classes to their domain agents.', before: { routed: 0 }, after: { routed: 4, method: 'deterministic_dict' } },
  { id: 'L05', t: '2:14 PM', tier: 'legal_defensibility', actor: 'D. Strand', event: 'billing.approved', entity: 'te-014', summary: 'Approved a narrated 2.5h entry on the Reyes matter ($938).', before: { status: 'PENDING' }, after: { status: 'APPROVED', amount: 938, by: 'dana-strand' } },
  { id: 'L04', t: '11:30 AM', tier: 'operational', actor: 'Litt · comms_agent', event: 'comms.sent', entity: 'reyes-update-07', summary: 'Sent an attorney-approved status update to Reyes Logistics.', before: { status: 'QUEUED' }, after: { status: 'SENT', approved_by: 'dana-strand' } },
  { id: 'L03', t: '9:02 AM', tier: 'engineering', actor: 'Litt · coordinator', event: 'integration.synced', entity: 'gmail+calendar', summary: 'Pulled new deadlines and contact activity from Gmail & Calendar via MCP.', before: { last_sync: '05-28 17:00' }, after: { last_sync: '05-29 09:02', new_signals: 3 } },
  { id: 'L02', t: '8:47 AM', tier: 'legal_defensibility', actor: 'M. Okafor', event: 'policy.updated', entity: 'firm-policy', summary: 'Managing partner set the billing auto-approve threshold — all entries remain gated.', before: { bl_approve: '$250' }, after: { bl_approve: '$0 (all gated)', by: 'marcus-okafor' } },
  { id: 'L01', t: '8:45 AM', tier: 'engineering', actor: 'Litt · coordinator', event: 'sweep.completed', entity: 'sweep-20260529-0845', summary: 'Morning scan ran clean — no critical items surfaced.', before: { state: 'idle' }, after: { items: 2, critical: 0, elapsed_ms: 1980 } },
];

function recIdemKey(e) {
  const base = `${e.event}:${e.entity}:${e.t}`.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return `idk_${base.slice(0, 18)}${String(base.length * 7 % 9973).padStart(4, '0')}`;
}

function RecDiff({ label, obj, accent }) {
  return (
    <div style={{ background: '#0E120D', border: `1px solid rgba(214,193,129,.16)`, borderRadius: 7, padding: '9px 11px', minWidth: 0 }}>
      <Mono style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.08em', color: accent ? '#9EE1C7' : '#9DA89A' }}>{label}</Mono>
      <pre style={{ margin: '6px 0 0', fontSize: 11, color: '#D7D3C3', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{`{\n`}{Object.entries(obj).map(([k, v]) => `  "${k}": ${JSON.stringify(v)}`).join(',\n')}{`\n}`}</pre>
    </div>
  );
}

function RecRow({ e, open, onToggle }) {
  const tm = window.LITT.TIER_META[e.tier];
  const isLitt = e.actor.startsWith('Litt');
  return (
    <div style={{ borderBottom: `1px solid ${T.soft}`, background: open ? T.wash2 : 'transparent' }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'grid', gridTemplateColumns: '70px 70px 1fr auto', gap: 14, alignItems: 'center', padding: '13px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <Mono style={{ fontSize: 11, color: T.muted }}>{e.t}</Mono>
        <span style={{ justifySelf: 'start', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: tm.color, border: `1px solid ${tm.color}`, borderRadius: 4, padding: '1px 6px', fontFamily: 'var(--font-mono)' }}>{tm.label}</span>
        <div style={{ minWidth: 0 }}>
          <Mono style={{ fontSize: 12, color: T.forest, fontWeight: 600 }}>{e.event}</Mono>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2, lineHeight: 1.4, overflow: open ? 'visible' : 'hidden', textOverflow: 'ellipsis', whiteSpace: open ? 'normal' : 'nowrap' }}>{e.summary}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span style={{ width: 18, height: 18, borderRadius: 999, background: isLitt ? 'rgba(20,34,31,.08)' : T.brass, color: isLitt ? T.forest : T.forest, display: 'grid', placeItems: 'center', fontSize: 8.5, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{isLitt ? '◆' : 'DS'}</span>
            <Mono style={{ fontSize: 11, color: T.faint }}>{isLitt ? e.actor.replace('Litt · ', '') : e.actor}</Mono>
          </span>
          <Icon name={open ? 'chevronD' : 'chevron'} size={13} color={T.faint} />
        </div>
      </button>
      {open && (
        <div style={{ padding: '4px 20px 20px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 8 }}>
            {[['entity', e.entity], ['actor', isLitt ? e.actor.replace('Litt · ', 'litt:') : 'dana-strand'], ['tier', e.tier], ['idempotency_key', recIdemKey(e)]].map(([k, v]) => (
              <div key={k} style={{ background: T.surface, border: `1px solid ${T.soft}`, borderRadius: 7, padding: '7px 10px' }}>
                <Mono style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.07em', color: T.faint, display: 'block' }}>{k}</Mono>
                <Mono style={{ fontSize: 11.5, color: T.ink, wordBreak: 'break-all' }}>{v}</Mono>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 18px 1fr', gap: 8, alignItems: 'center' }}>
            <RecDiff label="before_state" obj={e.before} />
            <Icon name="arrow" size={16} color={T.gold} style={{ margin: '0 auto' }} />
            <RecDiff label="after_state" obj={e.after} accent />
          </div>
        </div>
      )}
    </div>
  );
}

function ConsoleRecord() {
  const events = LEDGER;
  const [tier, setTier] = useStateRec('all');
  const [actor, setActor] = useStateRec('all');
  const [openId, setOpenId] = useStateRec(events[0].id);
  const tierMeta = window.LITT.TIER_META;

  const filtered = events.filter(e =>
    (tier === 'all' || e.tier === tier) &&
    (actor === 'all' || (actor === 'litt' ? e.actor.startsWith('Litt') : !e.actor.startsWith('Litt'))));

  const legalCount = events.filter(e => e.tier === 'legal_defensibility').length;
  const youCount = events.filter(e => !e.actor.startsWith('Litt')).length;
  const tierFilters = [['all', 'All'], ['legal_defensibility', 'Legal record'], ['operational', 'Operational'], ['engineering', 'System']];

  function exportJson() {
    const payload = JSON.stringify({ firm_id: 'strand-okafor', generated_at: window.LITT.FIRM.generatedAt, count: events.length, events: events.map(e => ({ time: e.t, tier: e.tier, event_type: e.event, actor: e.actor, entity: e.entity, idempotency_key: recIdemKey(e), before_state: e.before, after_state: e.after, summary: e.summary })) }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'litt-audit-ledger-2026-05-29.json'; a.click();
  }

  const Stat = ({ k, v, sub, accent }) => (
    <div style={{ flex: 1, minWidth: 120 }}>
      <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: T.auditMuted, display: 'block' }}>{k}</Mono>
      <div style={{ fontSize: 23, fontWeight: 600, color: accent || '#EFEBDB', lineHeight: 1.1, marginTop: 3 }}>{v}</div>
      <Mono style={{ fontSize: 10, color: T.auditMuted }}>{sub}</Mono>
    </div>
  );

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 18 }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Audit ledger</h1>
              <Mono style={{ fontSize: 9.5, color: T.audit, background: T.auditAccent, borderRadius: 5, padding: '2px 7px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>append-only</Mono>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '62ch' }}>
              The defensible record. Every signal Litt classified, every tool it wrote, every gate it applied — and every decision you made. Tamper-evident and CREATE-only at the storage layer.
            </p>
          </div>
          <button onClick={exportJson} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: T.forest, border: `1px solid ${T.forest}`, borderRadius: 9, padding: '10px 15px', cursor: 'pointer', color: T.brass, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <Icon name="arrow" size={14} color={T.brass} style={{ transform: 'rotate(90deg)' }} />Export JSON
          </button>
        </div>

        {/* dark stat strip */}
        <section style={{ background: T.audit, borderRadius: 14, padding: '17px 22px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <Stat k="Events today" v={events.length} sub="across 2 sweeps" accent={T.auditAccent} />
          <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(214,193,129,.16)' }} />
          <Stat k="Legal record" v={legalCount} sub="defensibility tier" />
          <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(214,193,129,.16)' }} />
          <Stat k="Your decisions" v={youCount} sub={`${events.length - youCount} by Litt`} />
          <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(214,193,129,.16)' }} />
          <div style={{ flex: 1, minWidth: 150 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: T.auditAccent, boxShadow: `0 0 6px ${T.auditAccent}` }} />
              <Mono style={{ fontSize: 10.5, color: '#9DA89A' }}>Last write 5:04 PM</Mono>
            </div>
            <Mono style={{ fontSize: 10, color: T.auditMuted, marginTop: 5, display: 'block', lineHeight: 1.4 }}>Production: Cloud Audit Logs · restricted IAM · archival export</Mono>
          </div>
        </section>

        {/* ledger table */}
        <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
          {/* filter toolbar */}
          <div style={{ padding: '11px 18px', borderBottom: `1px solid ${T.soft}`, background: T.wash2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint, marginRight: 2 }}>Tier</Mono>
            {tierFilters.map(([key, label]) => {
              const on = tier === key;
              const col = key === 'all' ? T.forest : tierMeta[key].color;
              return (
                <button key={key} onClick={() => setTier(key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)', border: `1px solid ${on ? col : T.line}`, background: on ? col : T.surface, color: on ? '#fff' : T.muted }}>
                  {key !== 'all' && <span style={{ width: 6, height: 6, borderRadius: 999, background: on ? '#fff' : col }} />}
                  {label}<Mono style={{ fontSize: 10, opacity: .8 }}>{key === 'all' ? events.length : events.filter(e => e.tier === key).length}</Mono>
                </button>
              );
            })}
            <span style={{ width: 1, height: 18, background: T.line, margin: '0 4px' }} />
            <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint, marginRight: 2 }}>Actor</Mono>
            {[['all', 'Everyone'], ['litt', 'Litt'], ['you', 'You']].map(([key, label]) => {
              const on = actor === key;
              return (
                <button key={key} onClick={() => setActor(key)} style={{ padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)', border: `1px solid ${on ? T.gold : T.line}`, background: on ? 'rgba(169,132,53,.12)' : T.surface, color: on ? T.gold : T.muted }}>{label}</button>
              );
            })}
          </div>
          {/* column header */}
          <div style={{ display: 'grid', gridTemplateColumns: '70px 70px 1fr auto', gap: 14, padding: '8px 20px', borderBottom: `1px solid ${T.soft}` }}>
            {['Time', 'Tier', 'Event type · summary', 'Actor'].map(h => (
              <Mono key={h} style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint }}>{h}</Mono>
            ))}
          </div>
          {filtered.map(e => <RecRow key={e.id} e={e} open={openId === e.id} onToggle={() => setOpenId(openId === e.id ? null : e.id)} />)}
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center' }}><Mono style={{ fontSize: 12, color: T.faint }}>No events match this filter.</Mono></div>}
          <div style={{ padding: '11px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.wash2 }}>
            <Mono style={{ fontSize: 10.5, color: T.faint }}>Showing {filtered.length} of {events.length} · newest first</Mono>
            <Mono style={{ fontSize: 10.5, color: T.muted }}>Hash-chained · every row carries an idempotency key</Mono>
          </div>
        </section>
      </div>
    </div>
  );
}

window.ConsoleRecord = ConsoleRecord;
