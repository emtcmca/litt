import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuditLogEvent, AuditLogResponse, AuditTier } from '../types';
import { T } from '../tokens';
import { Icon } from '../components/ui/Icon';
import { getAuditLog } from '../api';

const FIRM_ID = 'strand-okafor';

const TIER_META: Record<AuditTier, { label: string; human: string; color: string }> = {
  legal_defensibility: { label: 'legal',  human: 'Legal record', color: T.danger },
  operational:         { label: 'ops',    human: 'Operational',  color: T.gold },
  engineering:         { label: 'eng',    human: 'System',       color: '#5F6F66' },
};

const AGENT_NAMES: Record<string, string> = {
  coordinator:    'Coordinator',
  billing_agent:  'Billing agent',
  deadline_agent: 'Deadline agent',
  comms_agent:    'Comms agent',
  anomaly_agent:  'Anomaly agent',
};

function isLittActor(actor: string): boolean {
  return actor === 'coordinator' || actor.endsWith('_agent');
}

function fmtActor(actor: string): string {
  if (isLittActor(actor)) return 'Litt · ' + (AGENT_NAMES[actor] ?? actor);
  const parts = actor.split('-');
  return parts.map((p, i) => i === 0 ? p[0].toUpperCase() + '.' : p[0].toUpperCase() + p.slice(1)).join(' ');
}

function actorInitials(actor: string): string {
  if (isLittActor(actor)) return '◆';
  return actor.split('-').map(p => p[0].toUpperCase()).slice(0, 2).join('');
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Diff panel ────────────────────────────────────────────────────────────────
function RecDiff({ label, obj, accent }: { label: string; obj: Record<string, unknown>; accent?: boolean }) {
  return (
    <div style={{ background: '#0E120D', border: `1px solid rgba(214,193,129,.16)`, borderRadius: 7, padding: '9px 11px', minWidth: 0 }}>
      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.08em', color: accent ? T.auditAccent : T.auditMuted }}>{label}</span>
      <pre style={{ margin: '6px 0 0', fontSize: 11, color: '#D7D3C3', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const, lineHeight: 1.5 }}>{'{\n'}{Object.entries(obj).map(([k, v]) => `  "${k}": ${JSON.stringify(v)}`).join(',\n')}{'\n}'}</pre>
    </div>
  );
}

// ── Single ledger row ─────────────────────────────────────────────────────────
function RecRow({ e, open, onToggle }: { e: AuditLogEvent; open: boolean; onToggle: () => void }) {
  const tm     = TIER_META[e.tier] ?? TIER_META.engineering;
  const isLitt = isLittActor(e.actor);
  const summary = e.notes ?? e.event_type;

  return (
    <div data-testid="ledger-row" style={{ borderBottom: `1px solid ${T.soft}`, background: open ? T.wash2 : 'transparent' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'grid', gridTemplateColumns: '70px 70px 1fr auto', gap: 14, alignItems: 'center', padding: '13px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}
      >
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: T.muted }}>{fmtTime(e.created_at)}</span>
        <span style={{ justifySelf: 'start' as const, fontSize: 9, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.05em', color: tm.color, border: `1px solid ${tm.color}`, borderRadius: 4, padding: '1px 6px', fontFamily: 'var(--font-mono)' }}>{tm.label}</span>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: T.forest, fontWeight: 600, display: 'block' }}>{e.event_type}</span>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2, lineHeight: 1.4, overflow: open ? 'visible' : 'hidden', textOverflow: 'ellipsis', whiteSpace: open ? 'normal' : 'nowrap' }}>{summary}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' as const }}>
            <span style={{ width: 18, height: 18, borderRadius: 999, background: isLitt ? 'rgba(20,34,31,.08)' : T.brass, color: T.forest, display: 'grid', placeItems: 'center', fontSize: 8.5, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {actorInitials(e.actor)}
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: T.faint }}>{isLitt ? fmtActor(e.actor).replace('Litt · ', '') : fmtActor(e.actor)}</span>
          </span>
          <Icon name={open ? 'chevronD' : 'chevron'} size={13} color={T.faint} />
        </div>
      </button>

      {open && (
        <div style={{ padding: '4px 20px 20px', display: 'grid', gap: 12 }}>
          {/* metadata grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 8 }}>
            {([
              ['entity', e.entity_id],
              ['actor', isLitt ? fmtActor(e.actor).replace('Litt · ', 'litt:') : e.actor],
              ['tier', e.tier],
              ['idempotency_key', e.idempotency_key ?? '—'],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ background: T.surface, border: `1px solid ${T.soft}`, borderRadius: 7, padding: '7px 10px' }}>
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.07em', color: T.faint, display: 'block' }}>{k}</span>
                <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: T.ink, wordBreak: 'break-all' as const }}>{v}</span>
              </div>
            ))}
          </div>

          {/* before → after diff */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 18px 1fr', gap: 8, alignItems: 'center' }}>
            <RecDiff label="before_state" obj={e.before_state ?? { state: 'none' }} />
            <Icon name="arrow" size={16} color={T.gold} style={{ margin: '0 auto' }} />
            <RecDiff label="after_state" obj={e.after_state ?? { state: 'unknown' }} accent />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AuditLedger() {
  const [data,   setData]   = useState<AuditLogResponse | null>(null);
  const [error,  setError]  = useState<string | null>(null);
  const [tier,   setTier]   = useState<string>('all');
  const [actor,  setActorF] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    try {
      const d = await getAuditLog(FIRM_ID, { limit: 100 });
      setData(d);
      setOpenId(d.events[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    load();
  }, [load]);

  function exportJson() {
    const events = data?.events ?? [];
    const payload = JSON.stringify({ firm_id: FIRM_ID, count: events.length, events }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'litt-audit-ledger.json';
    a.click();
  }

  if (!data && !error) {
    return <div style={{ padding: '28px 32px', fontSize: 13, color: T.muted }}>Loading…</div>;
  }
  if (error) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div style={{ fontSize: 13, color: T.danger, marginBottom: 8 }}>{error}</div>
        <button onClick={load} style={{ fontSize: 12, color: T.teal, background: 'none', border: 'none', cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  const events  = data!.events;
  const legalCount = events.filter(e => e.tier === 'legal_defensibility').length;
  const youCount   = events.filter(e => !isLittActor(e.actor)).length;

  const filtered = events.filter(e =>
    (tier  === 'all' || e.tier === tier) &&
    (actor === 'all' || (actor === 'litt' ? isLittActor(e.actor) : !isLittActor(e.actor)))
  );

  const TIER_FILTERS = [['all', 'All'], ['legal_defensibility', 'Legal record'], ['operational', 'Operational'], ['engineering', 'System']];

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 18 }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Audit ledger</h1>
              <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: T.audit, background: T.auditAccent, borderRadius: 5, padding: '2px 7px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.05em' }}>append-only</span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '62ch' }}>
              The defensible record. Every signal Litt classified, every tool it wrote, every gate it applied — and every decision you made. Tamper-evident and CREATE-only at the storage layer.
            </p>
          </div>
          <button
            onClick={exportJson}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: T.forest, border: `1px solid ${T.forest}`, borderRadius: 9, padding: '10px 15px', cursor: 'pointer', color: T.brass, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' as const, flexShrink: 0 }}
          >
            <Icon name="arrow" size={14} color={T.brass} style={{ transform: 'rotate(90deg)' }} />Export JSON
          </button>
        </div>

        {/* dark stat strip */}
        <section style={{ background: T.audit, borderRadius: 14, padding: '17px 22px', display: 'flex', gap: 24, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.auditMuted, display: 'block' }}>Events today</span>
            <div style={{ fontSize: 23, fontWeight: 600, color: T.auditAccent, lineHeight: 1.1, marginTop: 3 }}>{events.length}</div>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.auditMuted }}>across 2 sweeps</span>
          </div>
          <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(214,193,129,.16)' }} />
          <div style={{ flex: 1, minWidth: 120 }}>
            <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.auditMuted, display: 'block' }}>Legal record</span>
            <div style={{ fontSize: 23, fontWeight: 600, color: '#EFEBDB', lineHeight: 1.1, marginTop: 3 }}>{legalCount}</div>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.auditMuted }}>defensibility tier</span>
          </div>
          <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(214,193,129,.16)' }} />
          <div style={{ flex: 1, minWidth: 120 }}>
            <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.auditMuted, display: 'block' }}>Your decisions</span>
            <div style={{ fontSize: 23, fontWeight: 600, color: '#EFEBDB', lineHeight: 1.1, marginTop: 3 }}>{youCount}</div>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.auditMuted }}>{events.length - youCount} by Litt</span>
          </div>
          <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(214,193,129,.16)' }} />
          <div style={{ flex: 1, minWidth: 150 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: T.auditAccent, boxShadow: `0 0 6px ${T.auditAccent}` }} />
              <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: '#9DA89A' }}>Last write {fmtTime(events[0]?.created_at ?? '')}</span>
            </div>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.auditMuted, marginTop: 5, display: 'block', lineHeight: 1.4 }}>Production: Cloud Audit Logs · restricted IAM · archival export</span>
          </div>
        </section>

        {/* ledger table */}
        <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
          {/* filter toolbar */}
          <div style={{ padding: '11px 18px', borderBottom: `1px solid ${T.soft}`, background: T.wash2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.faint, marginRight: 2 }}>Tier</span>
            {TIER_FILTERS.map(([key, label]) => {
              const on  = tier === key;
              const col = key === 'all' ? T.forest : (TIER_META[key as AuditTier]?.color ?? T.forest);
              const cnt = key === 'all' ? events.length : events.filter(e => e.tier === key).length;
              return (
                <button key={key} onClick={() => setTier(key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)', border: `1px solid ${on ? col : T.line}`, background: on ? col : T.surface, color: on ? '#fff' : T.muted }}>
                  {key !== 'all' && <span style={{ width: 6, height: 6, borderRadius: 999, background: on ? '#fff' : col }} />}
                  {label}
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', opacity: .8 }}>{cnt}</span>
                </button>
              );
            })}
            <span style={{ width: 1, height: 18, background: T.line, margin: '0 4px' }} />
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.faint, marginRight: 2 }}>Actor</span>
            {([['all', 'Everyone'], ['litt', 'Litt'], ['you', 'You']] as [string, string][]).map(([key, label]) => {
              const on = actor === key;
              return (
                <button key={key} onClick={() => setActorF(key)} style={{ padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)', border: `1px solid ${on ? T.gold : T.line}`, background: on ? 'rgba(169,132,53,.12)' : T.surface, color: on ? T.gold : T.muted }}>{label}</button>
              );
            })}
          </div>

          {/* column header */}
          <div style={{ display: 'grid', gridTemplateColumns: '70px 70px 1fr auto', gap: 14, padding: '8px 20px', borderBottom: `1px solid ${T.soft}` }}>
            {['Time', 'Tier', 'Event type · summary', 'Actor'].map(h => (
              <span key={h} style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.faint }}>{h}</span>
            ))}
          </div>

          {filtered.map(e => (
            <RecRow key={e.id} e={e} open={openId === e.id} onToggle={() => setOpenId(openId === e.id ? null : e.id)} />
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center' as const }}>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: T.faint }}>No events match this filter.</span>
            </div>
          )}

          {/* footer */}
          <div style={{ padding: '11px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.wash2 }}>
            <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: T.faint }}>Showing {filtered.length} of {events.length} · newest first</span>
            <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: T.muted }}>Hash-chained · every row carries an idempotency key</span>
          </div>
        </section>

      </div>
    </div>
  );
}
