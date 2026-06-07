// @deprecated — replaced by ResolvePanel (dashboard/src/components/console/ResolvePanel.tsx)
import type { BriefBudgetItem } from '../../types';

interface Props {
  item: BriefBudgetItem;
  onClose: () => void;
}

export function BudgetModal({ item, onClose }: Props) {
  const pct = item.utilization_pct;
  const pctDisplay = pct.toFixed(0);
  const isCritical = item.alert_status === 'CRITICAL';
  const accentColor = isCritical ? 'var(--color-border-danger)' : 'var(--color-border-warning)';
  const badgeBg = isCritical ? 'var(--color-ramp-red-400)' : 'var(--color-ramp-amber-200)';
  const badgeColor = isCritical ? '#FFFFFF' : 'var(--color-ramp-amber-900)';
  const alertBg = isCritical ? 'var(--color-background-danger)' : 'var(--color-background-warning)';
  const alertColor = isCritical ? 'var(--color-text-danger)' : 'var(--color-text-warning)';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 540, width: '100%', background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)', border: '0.5px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>Budget risk — {item.client_name}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-tertiary)', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Utilization header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Budget utilization</span>
            <span style={{ display: 'inline-block', background: badgeBg, color: badgeColor, padding: '3px 10px', borderRadius: 'var(--border-radius-md)', fontSize: 12, fontWeight: isCritical ? 600 : 500 }}>
              {item.alert_status} · {pctDisplay}%
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 8, background: 'var(--color-background-secondary)', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: accentColor, borderRadius: 4 }} />
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Budget cap', value: `$${item.budget_cap.toLocaleString()}` },
              { label: 'Total committed', value: `$${item.total_committed.toLocaleString()}` },
              { label: 'Already billed', value: `$${item.budget_billed.toLocaleString()}` },
              { label: 'Approved, unbilled', value: `$${item.approved_unbilled.toLocaleString()}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '12px 14px' }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Alert message */}
          <div style={{ background: alertBg, borderRadius: 'var(--border-radius-md)', padding: '12px 14px', borderLeft: `3px solid ${accentColor}` }}>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 500, color: alertColor }}>
              {isCritical
                ? 'Budget nearly exhausted. Notify client before posting additional time.'
                : 'Budget at warning threshold. Monitor new entries closely.'}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: alertColor, opacity: 0.8 }}>
              Threshold set at {item.threshold_pct.toFixed(0)}%
            </p>
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', fontSize: 14, background: 'transparent', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', color: 'var(--color-text-primary)', fontWeight: 400 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
