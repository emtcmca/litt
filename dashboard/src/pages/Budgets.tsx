import { useCallback, useEffect, useState } from 'react';
import type { BudgetUtilizationItem } from '../types';
import { getBudgets } from '../api';

const FIRM_ID = 'strand-okafor';

function BudgetBar({ item }: { item: BudgetUtilizationItem }) {
  const pct = Math.min(100, item.utilization_pct * 100);
  const color = pct >= 90 ? '#9B2D23' : pct >= 70 ? '#A98435' : '#1D9E75';

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: `1px solid ${color}25`,
      borderRadius: 10,
      padding: '14px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {item.client_name}
          </div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {item.client_id}
          </div>
        </div>
        <span style={{
          fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color,
        }}>
          {Math.round(pct)}%
        </span>
      </div>

      <div style={{ height: 8, background: 'var(--color-background-tertiary)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 4,
          transition: 'width 0.4s ease',
        }} />
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', fontWeight: 600 }}>
            ${item.billed_to_date.toLocaleString()}
          </span>
          {' '}billed
        </div>
        {item.approved_unbilled > 0 && (
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: '#A98435', fontWeight: 600 }}>
              +${item.approved_unbilled.toLocaleString()}
            </span>
            {' '}approved/unbilled
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          of{' '}
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            ${item.budget_cap.toLocaleString()}
          </span>
          {' '}cap
        </div>
        {(item.alert_status === 'WARN' || item.alert_status === 'CRITICAL') && (
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            color, background: `${color}12`,
            border: `1px solid ${color}35`,
            borderRadius: 3, padding: '1px 5px',
          }}>
            {item.alert_status}
          </span>
        )}
      </div>
    </div>
  );
}

export function Budgets() {
  const [budgets, setBudgets] = useState<BudgetUtilizationItem[] | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getBudgets(FIRM_ID);
      setBudgets(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load budgets');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!budgets && !error) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Loading budgets…</div>
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

  const all = budgets ?? [];
  const critical = all.filter(b => b.utilization_pct >= 0.90);
  const warn     = all.filter(b => b.utilization_pct >= 0.70 && b.utilization_pct < 0.90);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
        Budgets
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Budget Utilization
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {critical.length > 0 && (
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(155,45,35,.1)', color: '#9B2D23', border: '1px solid rgba(155,45,35,.3)', borderRadius: 5, padding: '2px 8px', fontWeight: 700 }}>
              {critical.length} ≥90%
            </span>
          )}
          {warn.length > 0 && (
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(169,132,53,.08)', color: '#A98435', border: '1px solid rgba(169,132,53,.3)', borderRadius: 5, padding: '2px 8px', fontWeight: 600 }}>
              {warn.length} ≥70%
            </span>
          )}
          {all.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>No clients with budget caps</span>
          )}
        </div>
      </div>

      {all.length === 0 ? (
        <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 10, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No clients with budget caps configured.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {all.map(item => <BudgetBar key={item.client_id} item={item} />)}
        </div>
      )}
    </div>
  );
}
