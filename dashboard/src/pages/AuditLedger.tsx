import { useCallback, useEffect, useState } from 'react';
import type { AuditLogEvent, AuditTier } from '../types';
import { getAuditLog } from '../api';

const FIRM_ID = 'strand-okafor';

const TIER_META: Record<AuditTier, { label: string; color: string; bg: string; border: string }> = {
  legal_defensibility: { label: 'LEGAL', color: '#9B2D23', bg: 'rgba(155,45,35,.08)', border: 'rgba(155,45,35,.25)' },
  operational:         { label: 'OPS',   color: '#A98435', bg: 'rgba(169,132,53,.08)', border: 'rgba(169,132,53,.25)' },
  engineering:         { label: 'ENG',   color: '#5C6B64', bg: 'rgba(92,107,100,.06)', border: 'rgba(92,107,100,.2)' },
};

const TIER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All tiers' },
  { value: 'legal_defensibility', label: 'Legal' },
  { value: 'operational', label: 'Operational' },
  { value: 'engineering', label: 'Engineering' },
];
const ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All entities' },
  { value: 'time_entry', label: 'time_entry' },
  { value: 'deadline', label: 'deadline' },
  { value: 'escalation', label: 'escalation' },
  { value: 'client_comm', label: 'client_comm' },
  { value: 'invoice', label: 'invoice' },
  { value: 'ingestion_signal', label: 'ingestion_signal' },
];

const selectStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11,
  padding: '4px 8px', height: 28,
  border: '1px solid var(--color-border-secondary)', borderRadius: 4,
  background: 'var(--color-background-primary)', color: 'var(--color-text-primary)',
  cursor: 'pointer',
};

function TierBadge({ tier }: { tier: AuditTier }) {
  const m = TIER_META[tier] ?? TIER_META.engineering;
  return (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 5px', borderRadius: 3,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      flexShrink: 0,
    }}>
      {m.label}
    </span>
  );
}

function LedgerRow({ event }: { event: AuditLogEvent }) {
  const [open, setOpen] = useState(false);
  const ts = event.created_at ? new Date(event.created_at) : null;
  const timeStr = ts ? ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '';
  const dateStr = ts ? ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

  return (
    <div style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'grid', gridTemplateColumns: '80px auto 1fr auto',
          gap: 10, padding: '10px 16px', alignItems: 'center', textAlign: 'left',
        }}
      >
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{dateStr}</div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>{timeStr}</div>
        </div>
        <TierBadge tier={event.tier} />
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
              {event.event_type}
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
              by {event.actor}
            </span>
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {event.entity_type} · {event.entity_id}
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 12px 106px' }}>
          {event.notes && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{event.notes}</div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            {event.before_state && Object.keys(event.before_state).length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>Before</div>
                <pre style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', background: 'var(--color-background-tertiary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 4, padding: '6px 8px', maxHeight: 160, overflowY: 'auto', overflowX: 'auto', margin: 0 }}>
                  {JSON.stringify(event.before_state, null, 2)}
                </pre>
              </div>
            )}
            {event.after_state && Object.keys(event.after_state).length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>After</div>
                <pre style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', background: 'var(--color-background-tertiary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 4, padding: '6px 8px', maxHeight: 160, overflowY: 'auto', overflowX: 'auto', margin: 0 }}>
                  {JSON.stringify(event.after_state, null, 2)}
                </pre>
              </div>
            )}
          </div>
          {event.idempotency_key && (
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', marginTop: 6 }}>
              idem: {event.idempotency_key}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LedgerStatStrip({ events }: { events: AuditLogEvent[] }) {
  const today = new Date().toDateString();
  const todayCount   = events.filter(e => new Date(e.created_at).toDateString() === today).length;
  const legalCount   = events.filter(e => e.tier === 'legal_defensibility').length;
  const humanActors  = new Set(events.filter(e => e.actor !== 'litt-agent').map(e => e.actor)).size;

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
      {[
        { label: 'Events today',   value: todayCount,   color: 'var(--color-text-primary)' },
        { label: 'Legal records',  value: legalCount,   color: legalCount > 0 ? '#9B2D23' : 'var(--color-text-secondary)' },
        { label: 'Human actors',   value: humanActors,  color: '#1D9E75' },
        { label: 'Total loaded',   value: events.length, color: 'var(--color-text-primary)' },
      ].map(s => (
        <div key={s.label} style={{
          flex: 1, background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)',
          borderRadius: 8, padding: '10px 12px',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function downloadJson(events: AuditLogEvent[]) {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `strand-okafor-audit-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AuditLedger() {
  const [events, setEvents]     = useState<AuditLogEvent[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [tierFilter, setTier]   = useState('');
  const [entityFilter, setEntity] = useState('');
  const [actorFilter, setActor] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getAuditLog(FIRM_ID, {
      tier: tierFilter || undefined,
      entityType: entityFilter || undefined,
      actor: actorFilter || undefined,
      limit: 300,
    })
      .then(r => { setEvents(r.events); setTotal(r.total); })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load audit log.'))
      .finally(() => setLoading(false));
  }, [tierFilter, entityFilter, actorFilter]);

  useEffect(() => { load(); }, [load]);

  const actorOptions = [
    { value: '', label: 'All actors' },
    ...[...new Set(events.map(e => e.actor))].sort().map(a => ({ value: a, label: a })),
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
        Prove
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Audit Ledger
          </h1>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
            {loading ? '…' : `${total} total events`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => downloadJson(events)}
            disabled={events.length === 0}
            style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
              color: '#1D9E75', background: 'rgba(29,158,117,.06)',
              border: '1px solid rgba(29,158,117,.25)', borderRadius: 5,
              padding: '4px 10px', cursor: events.length === 0 ? 'not-allowed' : 'pointer',
              opacity: events.length === 0 ? 0.5 : 1,
            }}
          >
            Export JSON
          </button>
        </div>
      </div>

      {!loading && <LedgerStatStrip events={events} />}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={tierFilter} onChange={e => setTier(e.target.value)} style={selectStyle}>
          {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={entityFilter} onChange={e => setEntity(e.target.value)} style={selectStyle}>
          {ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={actorFilter} onChange={e => setActor(e.target.value)} style={selectStyle}>
          {actorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={load} style={{ ...selectStyle, cursor: 'pointer' }}>Refresh</button>
        <div style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', alignSelf: 'center' }}>
          Append-only · CREATE only at Firestore rule layer
        </div>
      </div>

      {/* Tier key */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(Object.entries(TIER_META) as [AuditTier, typeof TIER_META[AuditTier]][]).map(([tier, m]) => (
          <div
            key={tier}
            onClick={() => setTier(tierFilter === tier ? '' : tier)}
            style={{
              display: 'flex', gap: 6, alignItems: 'center',
              padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
              background: m.bg, border: `1px solid ${m.border}`,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: m.color, letterSpacing: '0.06em' }}>{m.label}</span>
            <span style={{ fontSize: 11, color: m.color }}>{tier.replace('_', ' ')}</span>
            {tierFilter === tier && <span style={{ fontSize: 10, color: m.color }}>✕</span>}
          </div>
        ))}
      </div>

      {loading && (
        <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          Loading audit ledger…
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', background: 'var(--color-background-danger)', border: '1px solid var(--color-border-danger)', borderRadius: 6, fontSize: 13, color: 'var(--color-text-danger)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          No events found. Run a sweep or adjust filters.
        </div>
      )}

      {!loading && events.length > 0 && (
        <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 10, overflow: 'hidden' }}>
          {events.map(ev => <LedgerRow key={ev.id} event={ev} />)}
        </div>
      )}

      {!loading && total > events.length && (
        <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
          Showing {events.length} of {total} — narrow filters to see more
        </div>
      )}
    </div>
  );
}
