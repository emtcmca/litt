/* ───────────────────────────────────────────────────────────────────────────
   Litt — Console · Deadlines (Watch hero)
   Litt's other core job, alongside billing: never let a date pass unseen.
   The full book — every court date, contractual trigger, and internal due
   date — with the escalation cadence that surfaces a HARD_LEGAL deadline
   before it can become malpractice. One item is unconfirmed; the rest are
   owned and on the record.
─────────────────────────────────────────────────────────────────────────── */
const { useState: useStateDl } = React;

// escalation cadence tiers (days-out). mirrors POLICY dl_cadence 14·7·3·1
const CADENCE = [
  { tier: '1_DAY',  max: 1,  label: 'Final day',  desc: 'Due tomorrow or today',     color: '#9B2D23' },
  { tier: '3_DAY',  max: 3,  label: '3-day',      desc: 'Inside the 3-day window',   color: '#9B2D23' },
  { tier: '7_DAY',  max: 7,  label: '7-day',      desc: 'Inside the 7-day window',   color: '#A98435' },
  { tier: '14_DAY', max: 14, label: '14-day',     desc: 'First escalation fires',    color: '#A98435' },
];

function cadenceTier(daysOut) {
  for (const c of CADENCE) if (daysOut <= c.max) return c;
  return null; // beyond 14d — watched, not yet escalating
}

function ConsoleDeadlines({ onNav }) {
  const { DEADLINES_BOOK, CLS_META } = window.LITTC;
  const [filter, setFilter] = useStateDl('all');

  const book = [...DEADLINES_BOOK].sort((a, b) => a.daysOut - b.daysOut);
  const critical = book.find(d => d.status === 'UNCONFIRMED');
  const hardLegal = book.filter(d => d.cls === 'HARD_LEGAL');
  const horizon = 46; // days shown on the timeline axis

  const filters = [
    ['all', 'All deadlines', book.length],
    ['unconfirmed', 'Needs confirmation', book.filter(d => d.status === 'UNCONFIRMED').length],
    ['HARD_LEGAL', 'Court / legal', book.filter(d => d.cls === 'HARD_LEGAL').length],
    ['mine', 'Owned by you', book.filter(d => d.owner === 'Dana Strand').length],
  ];
  const rows = book.filter(d =>
    filter === 'all' ? true
    : filter === 'unconfirmed' ? d.status === 'UNCONFIRMED'
    : filter === 'mine' ? d.owner === 'Dana Strand'
    : d.cls === filter);

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 20 }}>

        {/* ── header ─────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Deadlines</h1>
            <Mono style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: T.gold, background: 'rgba(169,132,53,.1)', border: '1px solid rgba(169,132,53,.28)', borderRadius: 5, padding: '2px 7px' }}>core job</Mono>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '66ch' }}>
            Every court date, contractual trigger, and internal due date Litt is watching. A HARD_LEGAL deadline can’t pass unseen — the escalation cadence surfaces it, and Litt holds it until you’ve confirmed you own it.
          </p>
        </div>

        {/* ── critical callout: the one unconfirmed ──────────────── */}
        {critical && (
          <section style={{ background: T.surface, border: `1px solid rgba(155,45,35,.32)`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 0 rgba(155,45,35,.05)' }}>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              <div style={{ width: 4, background: T.danger, flexShrink: 0 }} />
              <div style={{ flex: 1, padding: '17px 20px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'grid', placeItems: 'center', textAlign: 'center', minWidth: 78, padding: '6px 10px', borderRadius: 11, background: T.dangerSoft, border: '1px solid rgba(155,45,35,.22)' }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: T.danger, lineHeight: 1 }}>{critical.daysOut}</span>
                  <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: T.danger, marginTop: 2 }}>days out</Mono>
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: T.danger }} className="litt-pulse" />
                    <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: T.danger, fontWeight: 600 }}>1 deadline needs your confirmation</Mono>
                  </div>
                  <div style={{ fontSize: 16.5, fontWeight: 600, color: T.ink, letterSpacing: '-.01em' }}>{critical.desc} · {critical.matter}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5, flexWrap: 'wrap' }}>
                    <ClsChip cls={critical.cls} />
                    <Mono style={{ fontSize: 11, color: T.muted }}>Due {critical.due}</Mono>
                    <span style={{ color: T.faint }}>·</span>
                    <Mono style={{ fontSize: 11, color: T.danger }}>UNCONFIRMED — entered the 7-day window</Mono>
                  </div>
                </div>
                <a href="Litt — Daily Closeout.html" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 10, background: T.forest, color: T.brass, fontSize: 13.5, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Confirm in closeout <Icon name="arrow" size={14} color={T.brass} />
                </a>
              </div>
            </div>
          </section>
        )}

        {/* ── 45-day horizon timeline ────────────────────────────── */}
        <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '18px 22px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: T.muted, fontWeight: 600 }}>The next 45 days</Mono>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.entries(CLS_META).filter(([k]) => book.some(d => d.cls === k)).map(([k, m]) => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: m.color }} />
                  <Mono style={{ fontSize: 9.5, color: T.faint }}>{m.label.replace('_', ' ')}</Mono>
                </span>
              ))}
            </div>
          </div>
          <Timeline book={book} horizon={horizon} />
        </section>

        {/* ── book table + cadence ladder ────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16 }} className="co-grid">

          {/* the book */}
          <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.soft}`, background: T.wash2, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: T.muted, fontWeight: 600, marginRight: 4 }}>The book</Mono>
              {filters.map(([key, label, n]) => {
                const on = filter === key;
                return (
                  <button key={key} onClick={() => setFilter(key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font-sans)', border: `1px solid ${on ? T.forest : T.line}`, background: on ? T.forest : T.surface, color: on ? T.brass : T.muted }}>
                    {label}<Mono style={{ fontSize: 10, opacity: .85 }}>{n}</Mono>
                  </button>
                );
              })}
            </div>
            {/* column header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px 92px 78px', gap: 10, padding: '8px 16px', borderBottom: `1px solid ${T.soft}` }}>
              {['Matter · what’s due', 'Class', 'Due', 'Owner'].map(h => (
                <Mono key={h} style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint }}>{h}</Mono>
              ))}
            </div>
            {rows.map(d => {
              const unc = d.status === 'UNCONFIRMED';
              const owner = d.owner === 'Dana Strand' ? 'You' : d.owner.split(' ')[0];
              return (
                <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '1fr 96px 92px 78px', gap: 10, alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${T.soft}`, borderLeft: `3px solid ${unc ? T.danger : 'transparent'}`, background: unc ? 'rgba(155,45,35,.025)' : 'transparent' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, lineHeight: 1.25, display: 'flex', alignItems: 'center', gap: 7 }}>{d.desc}{d.commitment && <Mono style={{ fontSize: 8.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: T.teal, background: 'rgba(29,158,117,.1)', border: '1px solid rgba(29,158,117,.3)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>promise</Mono>}</div>
                    <Mono style={{ fontSize: 10.5, color: T.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{d.matter}</Mono>
                    {unc
                      ? <Mono style={{ fontSize: 10, color: T.danger, fontWeight: 600 }}>UNCONFIRMED · needs you</Mono>
                      : d.commitment
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="mail" size={10} color={T.teal} /><Mono style={{ fontSize: 10, color: T.teal }}>captured from your reply</Mono></span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="check" size={10} color={T.teal} stroke={2.6} /><Mono style={{ fontSize: 10, color: T.teal }}>confirmed</Mono></span>}
                  </div>
                  <ClsChip cls={d.cls} small />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{d.due.replace(', 2026', '')}</div>
                    <Mono style={{ fontSize: 10, color: d.daysOut <= 7 ? T.danger : T.faint }}>{d.daysOut}d out</Mono>
                  </div>
                  <Mono style={{ fontSize: 11.5, color: owner === 'You' ? T.forest : T.muted, fontWeight: owner === 'You' ? 600 : 400 }}>{owner}</Mono>
                </div>
              );
            })}
            <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Mono style={{ fontSize: 10.5, color: T.faint }}>{rows.length} of {book.length} · sorted soonest first</Mono>
              <Mono style={{ fontSize: 10.5, color: T.muted }}>Ingested from Calendar &amp; court orders</Mono>
            </div>
          </section>

          {/* escalation cadence ladder */}
          <section style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '16px 17px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Icon name="shield" size={14} color={T.gold} />
                <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: T.muted, fontWeight: 600 }}>Escalation cadence</Mono>
              </div>
              <p style={{ margin: '0 0 13px', fontSize: 11.5, color: T.faint, lineHeight: 1.45 }}>HARD_LEGAL deadlines surface as they cross each window. Litt re-fires until you confirm.</p>
              <div style={{ display: 'grid', gap: 7 }}>
                {CADENCE.map(c => {
                  const hits = hardLegal.filter(d => cadenceTier(d.daysOut) && cadenceTier(d.daysOut).tier === c.tier);
                  const live = hits.length > 0;
                  return (
                    <div key={c.tier} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 10, background: live ? (c.color === T.danger ? T.dangerSoft : 'rgba(169,132,53,.08)') : T.wash2, border: `1px solid ${live ? (c.color === T.danger ? 'rgba(155,45,35,.24)' : 'rgba(169,132,53,.24)') : T.soft}` }}>
                      <div style={{ width: 38, textAlign: 'center', flexShrink: 0 }}>
                        <Mono style={{ fontSize: 14, fontWeight: 700, color: live ? c.color : T.faint, lineHeight: 1 }}>{c.tier.replace('_DAY', '')}</Mono>
                        <Mono style={{ fontSize: 8.5, color: T.faint, display: 'block' }}>DAY</Mono>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {live
                          ? hits.map(h => <div key={h.id} style={{ fontSize: 12, fontWeight: 600, color: T.ink, lineHeight: 1.3 }}>{h.client} · {h.daysOut}d{h.status === 'UNCONFIRMED' ? <Mono style={{ fontSize: 9.5, color: T.danger, marginLeft: 6 }}>UNCONFIRMED</Mono> : null}</div>)
                          : <span style={{ fontSize: 11.5, color: T.faint }}>{c.desc} — clear</span>}
                      </div>
                      {live && <span style={{ width: 7, height: 7, borderRadius: 999, background: c.color, flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11, paddingTop: 11, borderTop: `1px solid ${T.soft}` }}>
                <Icon name="clock" size={12} color={T.faint} />
                <Mono style={{ fontSize: 10.5, color: T.faint }}>{hardLegal.filter(d => !cadenceTier(d.daysOut)).length} HARD_LEGAL beyond 14d · watching</Mono>
              </div>
            </div>

            {/* deterministic note */}
            <div style={{ background: T.audit, borderRadius: 14, padding: '15px 17px', display: 'grid', gap: 9 }}>
              <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: T.auditMuted }}>How it runs</Mono>
              <div style={{ fontSize: 12.5, color: '#E6E2D2', lineHeight: 1.5 }}>
                <strong style={{ color: T.brass, fontWeight: 600 }}>deadline_agent</strong> computes days-remaining with a Python function and applies the cadence by class. No model decides whether a date matters.
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
                {['work: deterministic', 'llm: none', 'gate: ESCALATION'].map(t => (
                  <Mono key={t} style={{ fontSize: 10, color: T.auditAccent, background: 'rgba(158,225,199,.08)', border: '1px solid rgba(158,225,199,.2)', borderRadius: 5, padding: '2px 7px' }}>{t}</Mono>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── class chip ──────────────────────────────────────────────────────────────
function ClsChip({ cls, small }) {
  const m = window.LITTC.CLS_META[cls];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: small ? '2px 7px' : '3px 9px', borderRadius: 6, border: `1px solid ${m.color}44`, background: `${m.color}10`, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: m.color, flexShrink: 0 }} />
      <Mono style={{ fontSize: small ? 9 : 9.5, fontWeight: 600, letterSpacing: '.02em', color: m.color }}>{m.label.replace('HARD_', '').replace('SOFT_', '')}</Mono>
    </span>
  );
}

// ── horizon timeline ─────────────────────────────────────────────────────────
function Timeline({ book, horizon }) {
  const { CLS_META } = window.LITTC;
  const weeks = [7, 14, 21, 28, 35, 42];
  // alternate label side by sorted order to avoid overlap on tight clusters
  return (
    <div style={{ position: 'relative', height: 168, marginTop: 6 }}>
      {/* week gridlines */}
      {weeks.map(w => (
        <div key={w} style={{ position: 'absolute', left: `${(w / horizon) * 100}%`, top: 56, bottom: 56, width: 1, background: T.soft }} />
      ))}
      {/* baseline */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'linear-gradient(90deg, rgba(20,20,18,.16), rgba(20,20,18,.06))', borderRadius: 2 }} />
      {/* today marker */}
      <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translate(-50%,-50%)', display: 'grid', placeItems: 'center' }}>
        <span style={{ width: 11, height: 11, borderRadius: 999, background: T.forest, border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(20,34,31,.3)' }} />
      </div>
      <Mono style={{ position: 'absolute', left: 0, top: 'calc(50% + 12px)', fontSize: 9.5, color: T.forest, fontWeight: 600 }}>TODAY</Mono>
      {/* week ticks */}
      {weeks.map(w => (
        <Mono key={'l' + w} style={{ position: 'absolute', left: `${(w / horizon) * 100}%`, bottom: 36, transform: 'translateX(-50%)', fontSize: 9, color: T.faint }}>+{w}d</Mono>
      ))}
      {/* pins */}
      {book.map((d, i) => {
        const x = (d.daysOut / horizon) * 100;
        const up = i % 2 === 0;
        const m = CLS_META[d.cls];
        const unc = d.status === 'UNCONFIRMED';
        const due = d.due.replace(', 2026', '');
        return (
          <div key={d.id} style={{ position: 'absolute', left: `${x}%`, top: '50%', transform: 'translateX(-50%)' }}>
            {/* stem */}
            <div style={{ position: 'absolute', left: '50%', top: up ? -46 : 2, height: 44, width: 1.5, background: `${m.color}66`, transform: 'translateX(-50%)' }} />
            {/* dot */}
            <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: unc ? 13 : 11, height: unc ? 13 : 11, borderRadius: 999, background: m.color, border: '2px solid #fff', boxShadow: unc ? `0 0 0 3px ${m.color}33` : `0 0 0 1px ${m.color}44`, zIndex: 2 }} className={unc ? 'litt-pulse' : ''} />
            {/* label card */}
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: up ? -84 : 48, width: 124, textAlign: 'center', background: T.surface, border: `1px solid ${unc ? 'rgba(155,45,35,.3)' : T.line}`, borderRadius: 9, padding: '6px 8px', boxShadow: '0 2px 8px rgba(20,20,18,.06)' }}>
              <Mono style={{ fontSize: 11, fontWeight: 700, color: unc ? T.danger : T.ink, display: 'block', lineHeight: 1 }}>{due}</Mono>
              <span style={{ fontSize: 10.5, color: T.muted, display: 'block', marginTop: 2, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.client}</span>
              <Mono style={{ fontSize: 8.5, color: m.color, display: 'block', marginTop: 1 }}>{d.daysOut}d · {m.label.replace('HARD_', '').replace('SOFT_', '')}</Mono>
            </div>
          </div>
        );
      })}
    </div>
  );
}

window.ConsoleWatch = ConsoleDeadlines;
