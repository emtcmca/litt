import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AuditLogEvent, AuditTier } from '../types';
import { getAuditLog } from '../api';

const FIRM_ID = 'strand-okafor';
const DEMO_FIRM_NAME = 'Strand & Okafor LLP';

const TIER_META: Record<AuditTier, { label: string; bg: string; color: string; border: string }> = {
  legal_defensibility: {
    label: 'LEGAL',
    bg: 'var(--color-background-warning)',
    color: 'var(--color-text-warning)',
    border: 'var(--color-border-warning)',
  },
  operational: {
    label: 'OPS',
    bg: 'var(--color-background-info)',
    color: 'var(--color-text-info)',
    border: 'var(--color-border-info)',
  },
  engineering: {
    label: 'ENG',
    bg: 'var(--color-background-tertiary)',
    color: 'var(--color-text-secondary)',
    border: 'var(--color-border-secondary)',
  },
};

function TierBadge({ tier }: { tier: AuditTier }) {
  const m = TIER_META[tier] ?? TIER_META.engineering;
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.06em',
      padding: '2px 6px',
      borderRadius: 3,
      background: m.bg,
      color: m.color,
      border: `1px solid ${m.border}`,
      flexShrink: 0,
    }}>
      {m.label}
    </span>
  );
}

function StateViewer({ label, state }: { label: string; state: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 4 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--color-text-info)',
          textDecoration: 'underline',
        }}
      >
        {open ? '▾' : '▸'} {label}
      </button>
      {open && (
        <pre style={{
          margin: '4px 0 0',
          padding: '8px 10px',
          borderRadius: 4,
          background: 'var(--color-background-tertiary)',
          border: '1px solid var(--color-border-tertiary)',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-text-primary)',
          overflowX: 'auto',
          maxHeight: 200,
          overflowY: 'auto',
        }}>
          {JSON.stringify(state, null, 2)}
        </pre>
      )}
    </div>
  );
}

function EventRow({ event }: { event: AuditLogEvent }) {
  const ts = event.created_at ? new Date(event.created_at) : null;
  const dateStr = ts ? ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
  const timeStr = ts ? ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '72px 1fr',
      gap: '0 12px',
      padding: '10px 0',
      borderBottom: '1px solid var(--color-border-tertiary)',
    }}>
      {/* Timestamp column */}
      <div style={{ paddingTop: 2, textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>{dateStr}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>{timeStr}</div>
      </div>

      {/* Body column */}
      <div>
        {/* Top row: tier badge + event_type + actor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <TierBadge tier={event.tier} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {event.event_type}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
            by {event.actor}
          </span>
        </div>

        {/* Entity line */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
          <span style={{ color: 'var(--color-text-tertiary)' }}>{event.entity_type}</span>
          {' '}
          <span style={{ color: 'var(--color-text-primary)' }}>{event.entity_id}</span>
        </div>

        {/* Notes */}
        {event.notes && (
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
            {event.notes}
          </div>
        )}

        {/* State viewers */}
        {event.before_state && Object.keys(event.before_state).length > 0 && (
          <StateViewer label="before" state={event.before_state} />
        )}
        {event.after_state && Object.keys(event.after_state).length > 0 && (
          <StateViewer label="after" state={event.after_state} />
        )}

        {/* Idempotency key */}
        {event.idempotency_key && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
            idem: {event.idempotency_key}
          </div>
        )}
      </div>
    </div>
  );
}

const TIER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All tiers' },
  { value: 'legal_defensibility', label: 'Legal defensibility' },
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
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  padding: '5px 10px',
  border: '1px solid var(--color-border-secondary)',
  borderRadius: 4,
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  height: 32,
};

export function AuditLog() {
  const [events, setEvents] = useState<AuditLogEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tierFilter, setTierFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');

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

  // Derive unique actors from loaded events for the actor filter dropdown
  const actorOptions = [
    { value: '', label: 'All actors' },
    ...[...new Set(events.map(e => e.actor))].sort().map(a => ({ value: a, label: a })),
  ];

  return (
    <div style={{ background: 'var(--color-background-tertiary)' }}>
      {/* Topbar */}
      <div style={{
        background: 'var(--color-background-primary)',
        borderBottom: '1px solid var(--color-border-tertiary)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 0,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        minHeight: 58,
      }}>

        {/* Brand identity — mirrors main dashboard topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
          <Link to="/" aria-label="Back to brief" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <span
              role="img"
              aria-label="Litt"
              style={{
                display:             'block',
                flexShrink:          0,
                width:               76,
                height:              42,
                backgroundImage:     'url("/icons-logo/litt_logo_main_no_tagline.png")',
                backgroundSize:      '94px auto',
                backgroundRepeat:    'no-repeat',
                backgroundPosition:  'left center',
                mixBlendMode:        'multiply',
              }}
            />
          </Link>

          <div style={{ borderLeft: '1px solid var(--color-border-tertiary)', paddingLeft: 14, marginLeft: 14 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#14221F', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              {DEMO_FIRM_NAME}
            </span>
            <span style={{ display: 'block', fontSize: 10, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2, letterSpacing: '0.04em' }}>
              {FIRM_ID}
            </span>
          </div>

          <div style={{ borderLeft: '1px solid var(--color-border-tertiary)', paddingLeft: 14, marginLeft: 14 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              Audit Log
            </span>
            <span style={{ display: 'block', fontSize: 10, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {loading ? '…' : `${total} events`}
            </span>
          </div>
        </div>

        {/* Back link + filters — pushed right */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/" style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--color-text-info)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginRight: 8,
          }}>
            ← Brief
          </Link>
          <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} style={selectStyle}>
            {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)} style={selectStyle}>
            {ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={actorFilter} onChange={e => setActorFilter(e.target.value)} style={selectStyle}>
            {actorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={load}
            style={{
              ...selectStyle,
              background: 'var(--color-background-tertiary)',
              border: '1px solid var(--color-border-secondary)',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
        {/* Tier legend */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(Object.entries(TIER_META) as [AuditTier, typeof TIER_META[AuditTier]][]).map(([tier, m]) => (
            <div key={tier} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 4,
              background: m.bg,
              border: `1px solid ${m.border}`,
              cursor: 'pointer',
            }} onClick={() => setTierFilter(tierFilter === tier ? '' : tier)}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: m.color, letterSpacing: '0.06em' }}>
                {m.label}
              </span>
              <span style={{ fontSize: 11, color: m.color }}>
                {tier.replace('_', ' ')}
              </span>
              {tierFilter === tier && (
                <span style={{ fontSize: 10, color: m.color }}>✕</span>
              )}
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center' }}>
            Append-only · CREATE denied UPDATE/DELETE at Firestore rule layer
          </div>
        </div>

        {loading && (
          <div style={{ padding: '48px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
            Loading audit log…
          </div>
        )}

        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'var(--color-background-danger)',
            border: '1px solid var(--color-border-danger)',
            borderRadius: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--color-text-danger)',
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div style={{ padding: '48px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
            No audit events found. Run a sweep to generate records.
          </div>
        )}

        {!loading && events.length > 0 && (
          <div style={{
            background: 'var(--color-background-primary)',
            border: '1px solid var(--color-border-tertiary)',
            borderRadius: 8,
            padding: '0 16px',
          }}>
            {events.map(ev => <EventRow key={ev.id} event={ev} />)}
          </div>
        )}

        {!loading && total > events.length && (
          <div style={{ marginTop: 12, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            Showing {events.length} of {total} — narrow filters to see more
          </div>
        )}
      </div>
    </div>
  );
}
