import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RawDeadline, RelationshipMatter } from '../types';
import { getDeadlinesFull, getRelationships } from '../api';
import { T } from '../tokens';
import { Icon } from '../components/ui/Icon';
import { Mono } from '../components/ui/Mono';
import { ClsChip } from '../components/ui/ClsChip';

const FIRM_ID = 'strand-okafor';
const HORIZON  = 46;

// ── cadence tiers ────────────────────────────────────────────────────────────

const CADENCE = [
  { tier: '1_DAY',  max: 1,  label: 'Final day', desc: 'Due tomorrow or today',  color: T.danger },
  { tier: '3_DAY',  max: 3,  label: '3-day',     desc: 'Inside the 3-day window',color: T.danger },
  { tier: '7_DAY',  max: 7,  label: '7-day',     desc: 'Inside the 7-day window',color: T.gold   },
  { tier: '14_DAY', max: 14, label: '14-day',    desc: 'First escalation fires', color: T.gold   },
];

function cadenceTier(daysOut: number | null) {
  if (daysOut == null || daysOut < 0) return null;
  for (const c of CADENCE) if (daysOut <= c.max) return c;
  return null;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

// ── Timeline ─────────────────────────────────────────────────────────────────

interface PinnedDeadline {
  id: string;
  client: string;
  clientId?: string;
  description: string;
  cls: string;
  daysOut: number;
  isUnconfirmed: boolean;
  due: string;
}

function Timeline({ items }: { items: PinnedDeadline[] }) {
  const WEEKS = [7, 14, 21, 28, 35, 42];
  const inWindow = items.filter(d => d.daysOut >= 0 && d.daysOut <= HORIZON)
    .sort((a, b) => a.daysOut - b.daysOut);

  const CLS_COLOR: Record<string, string> = {
    HARD_LEGAL:       T.danger,
    HARD_CONTRACTUAL: T.gold,
    SOFT_INTERNAL:    T.teal,
    ADMINISTRATIVE:   '#5F6F66',
  };

  return (
    <div style={{ position: 'relative', height: 168, marginTop: 6 }}>
      {/* week gridlines */}
      {WEEKS.map(w => (
        <div key={w} style={{
          position: 'absolute',
          left:  `${(w / HORIZON) * 100}%`,
          top: 56, bottom: 56,
          width: 1, background: T.soft,
        }} />
      ))}
      {/* baseline */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '50%',
        height: 2,
        background: 'linear-gradient(90deg, rgba(20,20,18,.16), rgba(20,20,18,.06))',
        borderRadius: 2,
      }} />
      {/* TODAY */}
      <div style={{
        position: 'absolute', left: 0, top: '50%',
        transform: 'translate(-50%,-50%)',
        display: 'grid', placeItems: 'center',
      }}>
        <span style={{
          width: 11, height: 11, borderRadius: 999,
          background: T.forest, border: '2px solid #fff',
          boxShadow: '0 0 0 1px rgba(20,34,31,.3)',
        }} />
      </div>
      <Mono style={{
        position: 'absolute', left: 0, top: 'calc(50% + 12px)',
        fontSize: 9.5, color: T.forest, fontWeight: 600,
      }}>
        TODAY
      </Mono>
      {/* week ticks */}
      {WEEKS.map(w => (
        <Mono key={'l' + w} style={{
          position: 'absolute',
          left: `${(w / HORIZON) * 100}%`,
          bottom: 36,
          transform: 'translateX(-50%)',
          fontSize: 9, color: T.faint,
        }}>
          +{w}d
        </Mono>
      ))}
      {/* pins */}
      {inWindow.map((d, i) => {
        const x   = (d.daysOut / HORIZON) * 100;
        const up  = i % 2 === 0;
        const c   = CLS_COLOR[d.cls] ?? '#5F6F66';
        const due = fmtDate(d.due);
        return (
          <div key={d.id} style={{
            position: 'absolute',
            left: `${x}%`,
            top: '50%',
            transform: 'translateX(-50%)',
          }}>
            {/* stem */}
            <div style={{
              position: 'absolute', left: '50%',
              top: up ? -46 : 2, height: 44,
              width: 1.5, background: `${c}66`,
              transform: 'translateX(-50%)',
            }} />
            {/* dot */}
            <span className={d.isUnconfirmed ? 'litt-pulse' : ''} style={{
              position: 'absolute', left: '50%', top: '50%',
              transform: 'translate(-50%,-50%)',
              width: d.isUnconfirmed ? 13 : 11,
              height: d.isUnconfirmed ? 13 : 11,
              borderRadius: 999, background: c,
              border: '2px solid #fff',
              boxShadow: d.isUnconfirmed ? `0 0 0 3px ${c}33` : `0 0 0 1px ${c}44`,
              zIndex: 2, display: 'block',
            }} />
            {/* label card */}
            <div style={{
              position: 'absolute', left: '50%',
              transform: 'translateX(-50%)',
              top: up ? -84 : 48,
              width: 124, textAlign: 'center',
              background: T.surface,
              border: `1px solid ${d.isUnconfirmed ? 'rgba(155,45,35,.3)' : T.line}`,
              borderRadius: 9, padding: '6px 8px',
              boxShadow: '0 2px 8px rgba(20,20,18,.06)',
            }}>
              <Mono style={{ fontSize: 11, fontWeight: 700, color: d.isUnconfirmed ? T.danger : T.ink, display: 'block', lineHeight: 1 }}>
                {due}
              </Mono>
              <span style={{ fontSize: 10.5, color: T.muted, display: 'block', marginTop: 2, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.client}
              </span>
              <Mono style={{ fontSize: 8.5, color: c, display: 'block', marginTop: 1 }}>
                {d.daysOut}d · {d.cls.replace('HARD_', '').replace('SOFT_', '')}
              </Mono>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Cadence ladder ────────────────────────────────────────────────────────────

function CadenceLadder({ items }: { items: PinnedDeadline[] }) {
  const hardLegal = items.filter(d => d.cls === 'HARD_LEGAL');

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14, padding: '16px 17px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon name="shield" size={14} color={T.gold} />
        <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: T.muted, fontWeight: 600 }}>
          Escalation cadence
        </Mono>
      </div>
      <p style={{ margin: '0 0 13px', fontSize: 11.5, color: T.faint, lineHeight: 1.45 }}>
        Court/legal deadlines surface as they cross each window. Litt re-fires until you confirm.
      </p>
      <div style={{ display: 'grid', gap: 7 }}>
        {CADENCE.map(c => {
          const hits = hardLegal.filter(d => cadenceTier(d.daysOut)?.tier === c.tier);
          const live = hits.length > 0;
          const isDanger = c.color === T.danger;
          return (
            <div key={c.tier} style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '9px 11px', borderRadius: 10,
              background: live ? (isDanger ? T.dangerSoft : 'rgba(169,132,53,.08)') : T.wash2,
              border: `1px solid ${live ? (isDanger ? 'rgba(155,45,35,.24)' : 'rgba(169,132,53,.24)') : T.soft}`,
            }}>
              <div style={{ width: 38, textAlign: 'center', flexShrink: 0 }}>
                <Mono style={{ fontSize: 14, fontWeight: 700, color: live ? c.color : T.faint, lineHeight: 1, display: 'block' }}>
                  {c.tier.replace('_DAY', '')}
                </Mono>
                <Mono style={{ fontSize: 8.5, color: T.faint, display: 'block' }}>DAY</Mono>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {live
                  ? hits.map(h => (
                    <div key={h.id} style={{ fontSize: 12, fontWeight: 600, color: T.ink, lineHeight: 1.3 }}>
                      {h.client} · {h.daysOut}d
                      {h.isUnconfirmed && (
                        <Mono style={{ fontSize: 9.5, color: T.danger, marginLeft: 6 }}>UNCONFIRMED</Mono>
                      )}
                    </div>
                  ))
                  : <span style={{ fontSize: 11.5, color: T.faint }}>{c.desc} — clear</span>
                }
              </div>
              {live && <span style={{ width: 7, height: 7, borderRadius: 999, background: c.color, flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11, paddingTop: 11, borderTop: `1px solid ${T.soft}` }}>
        <Icon name="clock" size={12} color={T.faint} />
        <Mono style={{ fontSize: 10.5, color: T.faint }}>
          {hardLegal.filter(d => !cadenceTier(d.daysOut)).length} court/legal beyond 14d — watching
        </Mono>
      </div>
    </div>
  );
}

// ── Deadline book ─────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'unconfirmed' | 'HARD_LEGAL' | 'mine';

function DeadlineBook({ items, total }: { items: PinnedDeadline[]; total: number }) {
  const [filter, setFilter] = useState<FilterKey>('all');

  const filters: [FilterKey, string, number][] = [
    ['all',         'All deadlines',       total],
    ['unconfirmed', 'Needs confirmation',  items.filter(d => d.isUnconfirmed).length],
    ['HARD_LEGAL',  'Court / legal',       items.filter(d => d.cls === 'HARD_LEGAL').length],
    ['mine',        'Owned by you',        items.length],
  ];

  const rows = items.filter(d =>
    filter === 'all'         ? true
    : filter === 'unconfirmed' ? d.isUnconfirmed
    : filter === 'HARD_LEGAL'  ? d.cls === 'HARD_LEGAL'
    : true
  );

  return (
    <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
      {/* header + filters */}
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${T.soft}`,
        background: T.wash2, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap',
      }}>
        <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: T.muted, fontWeight: 600, marginRight: 4 }}>
          The book
        </Mono>
        {filters.map(([key, label, n]) => {
          const on = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font-sans)',
                border: `1px solid ${on ? T.forest : T.line}`,
                background: on ? T.forest : T.surface,
                color: on ? T.brass : T.muted,
              }}
            >
              {label}
              <Mono style={{ fontSize: 10, opacity: .85 }}>{n}</Mono>
            </button>
          );
        })}
      </div>
      {/* column header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 96px 92px',
        gap: 10, padding: '8px 16px',
        borderBottom: `1px solid ${T.soft}`,
      }}>
        {["Matter · what's due", 'Class', 'Due'].map(h => (
          <Mono key={h} style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint }}>
            {h}
          </Mono>
        ))}
      </div>
      {/* rows */}
      {rows.map(d => (
        <div key={d.id} style={{
          display: 'grid', gridTemplateColumns: '1fr 96px 92px', gap: 10,
          alignItems: 'center', padding: '12px 16px',
          borderBottom: `1px solid ${T.soft}`,
          borderLeft: `3px solid ${d.isUnconfirmed ? T.danger : 'transparent'}`,
          background: d.isUnconfirmed ? 'rgba(155,45,35,.025)' : 'transparent',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, lineHeight: 1.25 }}>
              {d.description}
            </div>
            <Mono style={{ fontSize: 10.5, color: T.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {d.clientId
                ? <Link to={`/clients/${d.clientId}`} style={{ color: T.ink, fontWeight: 600, textDecoration: 'none' }}>{d.client}</Link>
                : d.client}
            </Mono>
            {d.isUnconfirmed
              ? <Mono style={{ fontSize: 10, color: T.danger, fontWeight: 600 }}>UNCONFIRMED · needs you</Mono>
              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="check" size={10} color={T.teal} stroke={2.6} />
                  <Mono style={{ fontSize: 10, color: T.teal }}>confirmed</Mono>
                </span>
            }
          </div>
          <ClsChip cls={d.cls} small />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{fmtDate(d.due)}</div>
            <Mono style={{ fontSize: 10, color: (d.daysOut ?? 99) <= 7 ? T.danger : T.faint }}>
              {d.daysOut}d out
            </Mono>
          </div>
        </div>
      ))}
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Mono style={{ fontSize: 10.5, color: T.faint }}>{rows.length} of {total} · sorted soonest first</Mono>
        <Mono style={{ fontSize: 10.5, color: T.muted }}>Ingested from Calendar &amp; court orders</Mono>
      </div>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Deadlines() {
  const navigate = useNavigate();
  const [deadlines, setDeadlines] = useState<PinnedDeadline[] | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    Promise.all([
      getDeadlinesFull(FIRM_ID),
      getRelationships(FIRM_ID),
    ]).then(([rawDl, rels]) => {
      const relMap = new Map<string, { client_name: string; matter_name: string }>(
        rels.map((r: RelationshipMatter) => [r.matter_id, { client_name: r.client_name, matter_name: r.matter_name }])
      );
      const pinned: PinnedDeadline[] = (rawDl as RawDeadline[])
        .filter(d => d.days_out != null && d.days_out >= 0)
        .sort((a, b) => (a.days_out ?? 999) - (b.days_out ?? 999))
        .map(d => {
          const names = relMap.get(d.matter_id);
          return {
            id:            d.id,
            client:        names?.client_name ?? d.client_id ?? d.matter_id,
            clientId:      d.client_id,
            description:   d.description,
            cls:           d.classification,
            daysOut:       d.days_out ?? 0,
            isUnconfirmed: d.verification_status === 'UNCONFIRMED',
            due:           d.due_date,
          };
        });
      setDeadlines(pinned);
    }).catch(() => setDeadlines([]));
  }, []);

  if (!deadlines) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <Mono style={{ fontSize: 12, color: T.muted }}>Loading…</Mono>
      </div>
    );
  }

  const critical = deadlines.find(d => d.isUnconfirmed && d.cls === 'HARD_LEGAL');

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 20 }}>

        {/* header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>
              Deadlines
            </h1>
            <Mono style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em',
              color: T.gold, background: 'rgba(169,132,53,.1)',
              border: '1px solid rgba(169,132,53,.28)', borderRadius: 5, padding: '2px 7px',
            }}>
              Deadline monitor
            </Mono>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '66ch' }}>
            Every court date, contractual trigger, and internal due date Litt is watching. A court/legal deadline can't pass unseen — the escalation cadence surfaces it, and Litt holds it until you've confirmed you own it.
          </p>
        </div>

        {/* critical callout */}
        {critical && (
          <section style={{
            background: T.surface,
            border: `1px solid rgba(155,45,35,.32)`,
            borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 1px 0 rgba(155,45,35,.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              <div style={{ width: 4, background: T.danger, flexShrink: 0 }} />
              <div style={{
                flex: 1, padding: '17px 20px',
                display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
              }}>
                <div style={{
                  display: 'grid', placeItems: 'center', textAlign: 'center',
                  minWidth: 78, padding: '6px 10px', borderRadius: 11,
                  background: T.dangerSoft, border: '1px solid rgba(155,45,35,.22)',
                }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: T.danger, lineHeight: 1 }}>
                    {critical.daysOut}
                  </span>
                  <Mono style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: T.danger, marginTop: 2 }}>
                    days out
                  </Mono>
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="litt-pulse" style={{ width: 7, height: 7, borderRadius: 999, background: T.danger, display: 'inline-block' }} />
                    <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: T.danger, fontWeight: 600 }}>
                      1 deadline needs your confirmation
                    </Mono>
                  </div>
                  <div style={{ fontSize: 16.5, fontWeight: 600, color: T.ink, letterSpacing: '-.01em' }}>
                    {critical.description} · {critical.client}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5, flexWrap: 'wrap' }}>
                    <ClsChip cls={critical.cls} />
                    <Mono style={{ fontSize: 11, color: T.muted }}>Due {fmtDate(critical.due)}</Mono>
                    <span style={{ color: T.faint }}>·</span>
                    <Mono style={{ fontSize: 11, color: T.danger }}>UNCONFIRMED — entered the 7-day window</Mono>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/brief')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '11px 18px', borderRadius: 10,
                    background: T.forest, color: T.brass,
                    fontSize: 13.5, fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    whiteSpace: 'nowrap', flexShrink: 0,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Confirm in closeout <Icon name="arrow" size={14} color={T.brass} />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 45-day timeline */}
        <section style={{
          background: T.surface,
          border: `1px solid ${T.line}`,
          borderRadius: 14, padding: '18px 22px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: T.muted, fontWeight: 600 }}>
              The next 45 days
            </Mono>
          </div>
          <Timeline items={deadlines} />
        </section>

        {/* book + cadence */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16 }}>
          <DeadlineBook items={deadlines} total={deadlines.length} />
          <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            <CadenceLadder items={deadlines} />
            {/* deterministic note */}
            <div style={{ background: T.audit, borderRadius: 14, padding: '15px 17px', display: 'grid', gap: 9 }}>
              <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: T.auditMuted }}>
                How it runs
              </Mono>
              <div style={{ fontSize: 12.5, color: '#E6E2D2', lineHeight: 1.5 }}>
                <strong style={{ color: T.brass, fontWeight: 600 }}>Deadline agent</strong> computes days-remaining with a Python function and applies the cadence by class. No model decides whether a date matters.
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
                {['work: deterministic', 'llm: none', 'gate: attorney must decide'].map(t => (
                  <Mono key={t} style={{
                    fontSize: 10, color: T.auditAccent,
                    background: 'rgba(158,225,199,.08)',
                    border: '1px solid rgba(158,225,199,.2)',
                    borderRadius: 5, padding: '2px 7px',
                  }}>
                    {t}
                  </Mono>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
