import { useCallback, useEffect, useState } from 'react';
import type { BriefAnomalyItem, BriefResponse } from '../types';
import { getBrief } from '../api';

const FIRM_ID = 'strand-okafor';

const RISK_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: '#9B2D23', bg: 'rgba(155,45,35,.08)', border: 'rgba(155,45,35,.3)' },
  ELEVATED: { color: '#A98435', bg: 'rgba(169,132,53,.08)', border: 'rgba(169,132,53,.3)' },
  ROUTINE:  { color: '#5C6B64', bg: 'rgba(92,107,100,.06)', border: 'rgba(92,107,100,.2)' },
};

function AnomalyCard({ item }: { item: BriefAnomalyItem }) {
  const [expanded, setExpanded] = useState(false);
  const rs = RISK_STYLE[item.risk_level] ?? RISK_STYLE.ROUTINE;

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: `1px solid ${rs.border}`,
      borderLeft: `3px solid ${rs.color}`,
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          cursor: 'pointer', padding: '12px 16px',
          display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'start',
        }}
      >
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          color: rs.color, background: rs.bg, border: `1px solid ${rs.border}`,
          borderRadius: 3, padding: '2px 6px', marginTop: 1,
          whiteSpace: 'nowrap',
        }}>
          {item.risk_level}
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
            {item.what_is_happening}
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginTop: 3 }}>
            {item.entity_type} · {item.entity_id}
            {item.matter_id && <span style={{ marginLeft: 8, color: 'var(--color-text-tertiary)' }}>matter: {item.matter_id}</span>}
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--color-border-tertiary)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 4, fontWeight: 600 }}>
                Why it matters
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {item.why_it_matters}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 4, fontWeight: 600 }}>
                What Litt has done
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {item.what_litt_has_done}
              </div>
            </div>
          </div>
          <div style={{
            marginTop: 10,
            padding: '10px 12px',
            background: '#14221F',
            border: '1px solid rgba(158,225,199,.12)',
            borderRadius: 6,
          }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(158,225,199,.5)', marginBottom: 4, fontWeight: 600 }}>
              Attorney must decide
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }}>
              {item.what_attorney_must_decide}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Anomalies() {
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getBrief(FIRM_ID);
      setBrief(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load anomalies');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!brief && !error) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div style={{ fontSize: 13, color: '#9B2D23', marginBottom: 8 }}>{error}</div>
        <button onClick={load} style={{ fontSize: 12, color: '#1D9E75', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
      </div>
    );
  }

  const items = brief?.sections.anomalies.items ?? [];
  const critical = items.filter(i => i.risk_level === 'CRITICAL');
  const elevated = items.filter(i => i.risk_level === 'ELEVATED');
  const routine  = items.filter(i => i.risk_level === 'ROUTINE');

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
        Anomalies
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Anomaly Roster
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {critical.length > 0 && (
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(155,45,35,.1)', color: '#9B2D23', border: '1px solid rgba(155,45,35,.3)', borderRadius: 5, padding: '2px 8px', fontWeight: 700 }}>
              {critical.length} CRITICAL
            </span>
          )}
          {elevated.length > 0 && (
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(169,132,53,.08)', color: '#A98435', border: '1px solid rgba(169,132,53,.3)', borderRadius: 5, padding: '2px 8px', fontWeight: 600 }}>
              {elevated.length} ELEVATED
            </span>
          )}
          {routine.length > 0 && (
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(92,107,100,.06)', color: '#5C6B64', border: '1px solid rgba(92,107,100,.2)', borderRadius: 5, padding: '2px 8px' }}>
              {routine.length} ROUTINE
            </span>
          )}
        </div>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total anomalies', value: items.length, color: 'var(--color-text-primary)' },
          { label: 'Critical',        value: critical.length, color: '#9B2D23' },
          { label: 'Elevated',        value: elevated.length, color: '#A98435' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)',
            borderRadius: 8, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 10, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No anomalies detected in the current brief.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {[...items].sort((a, b) => a.priority - b.priority).map(item => (
            <AnomalyCard key={item.escalation_id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
