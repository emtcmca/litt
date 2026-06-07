// @deprecated — replaced by ResolvePanel (dashboard/src/components/console/ResolvePanel.tsx)
import { useState } from 'react';
import type { BriefAnomalyItem, ToolResult } from '../../types';
import { dismissAlert } from '../../api';

interface Props {
  item: BriefAnomalyItem;
  firmId: string;
  attorneyId: string;
  onClose: () => void;
  onSuccess: (result: ToolResult, itemId: string) => void;
}

const RISK_BADGE: Record<string, { bg: string; color: string; weight: number }> = {
  CRITICAL: { bg: 'var(--color-ramp-red-400)', color: '#FFFFFF', weight: 600 },
  ELEVATED: { bg: 'var(--color-ramp-amber-200)', color: 'var(--color-ramp-amber-900)', weight: 500 },
  ROUTINE:  { bg: 'var(--color-ramp-gray-200)', color: 'var(--color-ramp-gray-900)', weight: 500 },
};

function NarrativeBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>{value}</p>
    </div>
  );
}

export function AnomalyModal({ item, firmId, attorneyId, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const badge = RISK_BADGE[item.risk_level] ?? RISK_BADGE.ROUTINE;

  async function handleDismiss() {
    if (!reason.trim()) { setError('Reason required'); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await dismissAlert({
        firm_id: firmId,
        attorney_id: attorneyId,
        alert_id: item.escalation_id,
        alert_type: item.entity_type,
        reason,
        idempotency_key: `dismiss-anomaly-${item.escalation_id}`,
      });
      if (result.success) { onSuccess(result, item.escalation_id); }
      else { setError(result.message ?? 'Dismiss failed'); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 540, width: '100%', background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)', border: '0.5px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px 14px', borderTop: '3px solid #D6C181', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Anomaly detected</h2>
              <span style={{ display: 'inline-flex', background: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: badge.weight, fontFamily: 'var(--font-mono)', letterSpacing: '0.03em' }}>
                {item.risk_level}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {item.entity_id} · priority {item.priority}/5
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-tertiary)', lineHeight: 1, padding: '0 4px', marginLeft: 12, flexShrink: 0 }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Risk header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ display: 'inline-block', background: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: 'var(--border-radius-md)', fontSize: 11, fontWeight: badge.weight }}>{item.risk_level}</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>{item.entity_type}</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>priority {item.priority}/5</span>
          </div>

          {/* Narrative blocks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            <NarrativeBlock label="What is happening" value={item.what_is_happening} />
            <NarrativeBlock label="Why it matters" value={item.why_it_matters} />
            <NarrativeBlock label="What Litt has done" value={item.what_litt_has_done} />
            <div style={{ background: 'var(--color-background-info)', borderRadius: 'var(--border-radius-md)', padding: '12px 14px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-info)', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7 }}>Attorney decision needed</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--color-text-info)', lineHeight: 1.5 }}>{item.what_attorney_must_decide}</p>
            </div>
          </div>

          {/* Dismiss reason */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-primary)' }}>Dismissal reason (required)</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              rows={2}
              placeholder="e.g. Verified manually — no issue found"
              style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: `0.5px solid ${focused ? 'var(--color-border-info)' : 'var(--color-border-tertiary)'}`, borderRadius: 'var(--border-radius-md)', boxShadow: focused ? '0 0 0 3px rgba(55,138,221,0.2)' : 'none', outline: 'none', fontFamily: 'inherit', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', boxSizing: 'border-box', resize: 'vertical', minHeight: 70 }}
            />
          </div>

          {error && <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--color-text-danger)' }}>{error}</p>}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', fontSize: 14, background: 'transparent', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', color: 'var(--color-text-primary)', fontWeight: 400 }}>
            Cancel
          </button>
          <button onClick={handleDismiss} disabled={loading} style={{ padding: '8px 18px', fontSize: 14, fontWeight: 500, background: 'transparent', color: 'var(--color-text-danger)', border: '0.5px solid var(--color-border-danger)', borderRadius: 'var(--border-radius-md)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Dismissing…' : 'Dismiss anomaly'}
          </button>
        </div>
      </div>
    </div>
  );
}
