import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BudgetUtilizationItem } from '../types';
import { T } from '../tokens';
import { Icon } from '../components/ui/Icon';
import { getBudgets } from '../api';

const FIRM_ID = 'strand-okafor';
const WARN_PCT = 75, CRIT_PCT = 90;

function money(n: number) { return '$' + n.toLocaleString(); }

function BudgetRow({ item, last }: { item: BudgetUtilizationItem; last: boolean }) {
  const navigate = useNavigate();
  const pct  = item.utilization_pct; // fixture is already 0-100
  const warn = pct >= WARN_PCT;
  const crit = pct >= CRIT_PCT;
  const col  = crit ? T.danger : warn ? T.gold : T.teal;

  return (
    <div style={{ padding: '14px 18px', borderBottom: last ? 'none' : `1px solid ${T.soft}`, display: 'grid', gap: 8, borderLeft: `3px solid ${warn ? col : 'transparent'}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{item.client_name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {warn && (
            <span style={{ fontSize: 10, fontWeight: 600, color: col, background: `${col}1a`, border: `1px solid ${col}40`, borderRadius: 5, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>
              {crit ? 'CRITICAL' : 'WARN'}
            </span>
          )}
          <span style={{ fontSize: 12.5, color: T.muted, fontFamily: 'var(--font-mono)' }}>{money(item.total_committed)} / {money(item.budget_cap)}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: col, minWidth: 42, textAlign: 'right' as const }}>{pct}%</span>
        </div>
      </div>

      <div style={{ position: 'relative', height: 7, borderRadius: 999, background: T.wash2, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: `${WARN_PCT}%`, top: -1, bottom: -1, width: 1, background: T.line, zIndex: 2 }} />
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: col, borderRadius: 999 }} />
      </div>

      {warn && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 2 }}>
          <span style={{ fontSize: 12, color: T.muted }}>
            Crossed the {WARN_PCT}% warning since last closeout — get ahead of it before the overage.
          </span>
          <button onClick={() => navigate('/brief')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: T.forest, color: T.brass, fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' as const }}>
            Review budget <Icon name="arrow" size={12} color={T.brass} />
          </button>
        </div>
      )}
    </div>
  );
}

export function Budgets() {
  const [budgets, setBudgets] = useState<BudgetUtilizationItem[] | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await getBudgets(FIRM_ID);
      setBudgets(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load budgets');
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    load();
  }, [load]);

  if (!budgets && !error) return <div style={{ padding: '28px 32px', fontSize: 13, color: T.muted }}>Loading…</div>;
  if (error) return <div style={{ padding: '28px 32px', fontSize: 13, color: T.danger }}>{error}</div>;

  const rows = [...(budgets ?? [])].sort((a, b) => b.utilization_pct - a.utilization_pct);
  const over = rows.filter(r => r.utilization_pct >= WARN_PCT);

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 18 }}>

        {/* header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Budgets</h1>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.gold, background: `${T.gold}1a`, border: `1px solid ${T.gold}44`, borderRadius: 5, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>watch</span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '64ch' }}>
            Where every client retainer stands. Litt computes utilization from billed plus approved-unbilled and fires a threshold alert before a budget surprise can erode client trust.
          </p>
        </div>

        {/* stat strip */}
        <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 26, flexWrap: 'wrap' as const }}>
          {([
            ['Budgeted matters', rows.length, 'across the book'],
            ['Over 75% warn', over.length, over.length ? 'needs a look' : 'all clear'],
            ['Thresholds', `${WARN_PCT} / ${CRIT_PCT}%`, 'warn / critical'],
          ] as [string, string | number, string][]).map(([k, v, s]) => (
            <div key={k} style={{ minWidth: 120 }}>
              <span style={{ fontSize: 9.5, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.faint, display: 'block', fontFamily: 'var(--font-mono)' }}>{k}</span>
              <div style={{ fontSize: 24, fontWeight: 600, color: (k.includes('warn') && over.length) ? T.gold : T.ink, lineHeight: 1.1, marginTop: 3 }}>{v}</div>
              <span style={{ fontSize: 10.5, color: T.faint, fontFamily: 'var(--font-mono)' }}>{s}</span>
            </div>
          ))}
        </section>

        {/* utilization list */}
        <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.soft}`, background: T.wash2 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '.09em', color: T.muted, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>Utilization by matter</span>
          </div>
          {rows.map((r, i) => <BudgetRow key={r.client_id} item={r} last={i === rows.length - 1} />)}
        </section>

      </div>
    </div>
  );
}
