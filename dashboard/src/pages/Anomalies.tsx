import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BriefAnomalyItem, BriefResponse } from '../types';
import { T } from '../tokens';
import { Icon } from '../components/ui/Icon';
import { getBrief } from '../api';

const FIRM_ID = 'strand-okafor';

// Static detector roster — display only (not API-driven). Source: console-stubs.jsx DETECTORS.
// 13 detectors; do NOT map 1:1 to the 11-value AnomalyType enum.
const DETECTORS: [string, number][] = [
  ['Missing narrative', 1], ['Vague narrative', 0], ['Duplicate entry', 0], ['Round hours, no session', 0],
  ['Rate deviation', 0], ['Block-billing', 0], ['Forbidden phrases', 0], ['Stale pending (>30d)', 0],
  ['After-hours spike', 0], ['Excessive daily hours', 0], ['Weekend anomaly', 0], ['Negative duration', 0], ['Budget overrun', 0],
];

// Static cleared list — brief has no cleared_today count in v1.x
const CLEARED = [
  { what: 'Duplicate of te-014 — auto-merged', when: '4:31 PM', by: 'billing_agent' },
  { what: 'Round-hours entry te-009 — session log matched', when: '2:02 PM', by: 'Dana Strand' },
];

function ElevatedCallout({ item }: { item: BriefAnomalyItem }) {
  const navigate = useNavigate();
  return (
    <section style={{ background: T.surface, border: 'rgba(155,45,35,.3) solid 1px', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', flexWrap: 'wrap' as const, borderLeft: `4px solid ${T.danger}` }}>
        <span style={{ width: 36, height: 36, borderRadius: 9, background: T.dangerSoft, border: '1px solid rgba(155,45,35,.22)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="alert" size={18} color={T.danger} />
        </span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <span style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.1em', color: T.danger, fontWeight: 600, fontFamily: 'var(--font-mono)', display: 'block' }}>
            1 elevated · reason required to clear
          </span>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: T.ink, marginTop: 3 }}>{item.what_is_happening}</div>
          <span style={{ fontSize: 11.5, color: T.muted, fontFamily: 'var(--font-mono)' }}>
            {item.entity_type} · {item.entity_id}{item.matter_id ? ` · ${item.matter_id}` : ''} · priority {item.priority}
          </span>
        </div>
        <button onClick={() => navigate('/brief')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: T.forest, color: T.brass, fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' as const }}>
          Resolve in closeout <Icon name="arrow" size={12} color={T.brass} />
        </button>
      </div>
    </section>
  );
}

export function Anomalies() {
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);
  const firingCount = DETECTORS.reduce((s, d) => s + d[1], 0);

  const load = useCallback(async () => {
    try {
      const data = await getBrief(FIRM_ID);
      setBrief(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    load();
  }, [load]);

  if (!brief && !error) return <div style={{ padding: '28px 32px', fontSize: 13, color: T.muted }}>Loading…</div>;
  if (error) return <div style={{ padding: '28px 32px', fontSize: 13, color: T.danger }}>{error}</div>;

  const items   = brief?.sections.anomalies.items ?? [];
  const elevated = items.find(i => i.risk_level === 'ELEVATED' || i.risk_level === 'CRITICAL');

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 18 }}>

        {/* header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Anomalies</h1>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.gold, background: `${T.gold}1a`, border: `1px solid ${T.gold}44`, borderRadius: 5, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>watch</span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '64ch' }}>
            Thirteen deterministic detectors run over every billing and operational pattern, scored by severity × confidence. Nothing is dismissed silently — clearing an anomaly always requires a reason on the record.
          </p>
        </div>

        {/* elevated callout */}
        {elevated && <ElevatedCallout item={elevated} />}

        {/* 2-col: detector roster + cleared today */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
          {/* detector grid */}
          <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '15px 17px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '.09em', color: T.muted, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>Detectors</span>
              <span style={{ fontSize: 10.5, color: firingCount ? T.danger : T.teal, fontFamily: 'var(--font-mono)' }}>{firingCount} firing · {DETECTORS.length} total</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {DETECTORS.map(([name, n]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 999, background: n ? T.dangerSoft : 'rgba(29,158,117,.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon name={n ? 'alert' : 'check'} size={8.5} color={n ? T.danger : T.teal} stroke={2.6} />
                  </span>
                  <span style={{ fontSize: 11.5, color: n ? T.ink : T.muted, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{name}</span>
                  {n > 0 && <span style={{ fontSize: 10.5, color: T.danger, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{n}</span>}
                </div>
              ))}
            </div>
          </section>

          {/* cleared today */}
          <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '15px 17px' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '.09em', color: T.muted, fontWeight: 600, display: 'block', marginBottom: 11, fontFamily: 'var(--font-mono)' }}>Cleared today</span>
            <div style={{ display: 'grid', gap: 10 }}>
              {CLEARED.map(c => (
                <div key={c.what} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 999, background: 'rgba(29,158,117,.12)', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Icon name="check" size={9} color={T.teal} stroke={2.6} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.35 }}>{c.what}</div>
                    <span style={{ fontSize: 10, color: T.faint, fontFamily: 'var(--font-mono)' }}>{c.when} · {c.by}</span>
                  </div>
                </div>
              ))}
            </div>
            <span style={{ fontSize: 10.5, color: T.faint, display: 'block', marginTop: 13, paddingTop: 11, borderTop: `1px solid ${T.soft}`, lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>
              Each clearance carries a reason and is appended to the audit ledger.
            </span>
          </section>
        </div>

      </div>
    </div>
  );
}
