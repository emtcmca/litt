import { useState } from 'react';
import type { BriefDeadlineItem, ToolResult } from '../../types';
import { confirmDeadline, extendDeadline, dismissDeadline } from '../../api';

export type DeadlineAction = 'confirm' | 'extend' | 'dismiss';

interface Props {
  item: BriefDeadlineItem;
  action: DeadlineAction;
  firmId: string;
  attorneyId: string;
  onClose: () => void;
  onSuccess: (result: ToolResult, itemId: string) => void;
}

const CLASS_LABEL: Record<string, string> = {
  HARD_LEGAL: 'CRITICAL: HARD_LEGAL',
  HARD_CONTRACTUAL: 'HARD_CONTRACTUAL',
  SOFT_INTERNAL: 'SOFT_INTERNAL',
  ADMINISTRATIVE: 'ADMINISTRATIVE',
};

const CLASS_BADGE_STYLE: Record<string, { bg: string; color: string; weight: number }> = {
  HARD_LEGAL:       { bg: 'var(--color-ramp-red-400)', color: '#FFFFFF', weight: 600 },
  HARD_CONTRACTUAL: { bg: 'var(--color-ramp-amber-200)', color: 'var(--color-ramp-amber-900)', weight: 500 },
  SOFT_INTERNAL:    { bg: 'var(--color-ramp-blue-200)', color: 'var(--color-ramp-blue-900)', weight: 500 },
  ADMINISTRATIVE:   { bg: 'var(--color-ramp-gray-200)', color: 'var(--color-ramp-gray-900)', weight: 500 },
};

function inputStyle(focused: boolean) {
  return {
    width: '100%',
    padding: '8px 12px',
    fontSize: 14,
    border: `0.5px solid ${focused ? 'var(--color-border-info)' : 'var(--color-border-tertiary)'}`,
    borderRadius: 'var(--border-radius-md)',
    boxShadow: focused ? '0 0 0 3px rgba(55,138,221,0.2)' : 'none',
    outline: 'none',
    fontFamily: 'inherit',
    background: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)',
    boxSizing: 'border-box' as const,
  };
}

export function DeadlineModal({ item, action, firmId, attorneyId, onClose, onSuccess }: Props) {
  const [newDueDate, setNewDueDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusDate, setFocusDate] = useState(false);
  const [focusReason, setFocusReason] = useState(false);

  const title = { confirm: 'Confirm deadline', extend: 'Extend deadline', dismiss: 'Dismiss deadline' }[action];
  const badge = CLASS_BADGE_STYLE[item.classification] ?? { bg: 'var(--color-ramp-gray-200)', color: 'var(--color-ramp-gray-900)', weight: 500 };

  async function handleSubmit() {
    if (action === 'extend' && (!newDueDate || !reason.trim())) { setError('New date and reason required'); return; }
    if (action === 'dismiss' && !reason.trim()) { setError('Reason required'); return; }
    setLoading(true);
    setError(null);
    try {
      let result;
      if (action === 'confirm') {
        result = await confirmDeadline({ firm_id: firmId, attorney_id: attorneyId, deadline_id: item.deadline_id, expected_version: item.version, idempotency_key: `confirm-${item.deadline_id}-${Date.now()}` });
      } else if (action === 'extend') {
        result = await extendDeadline({ firm_id: firmId, attorney_id: attorneyId, deadline_id: item.deadline_id, new_due_date: newDueDate, reason, expected_version: item.version, idempotency_key: `extend-${item.deadline_id}-${Date.now()}` });
      } else {
        result = await dismissDeadline({ firm_id: firmId, attorney_id: attorneyId, deadline_id: item.deadline_id, reason, expected_version: item.version, idempotency_key: `dismiss-${item.deadline_id}-${Date.now()}` });
      }
      if (result.success) { onSuccess(result, item.deadline_id); }
      else { setError(result.message ?? 'Action failed'); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 540, width: '100%', background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)', border: '0.5px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-tertiary)', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          {/* Item summary */}
          <div style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: 14, marginBottom: 20 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ display: 'inline-block', background: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: 'var(--border-radius-md)', fontSize: 11, fontWeight: badge.weight, marginRight: 8 }}>
                {CLASS_LABEL[item.classification] ?? item.classification}
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>{item.deadline_id}</span>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.description}</p>
            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
              <span><span style={{ color: 'var(--color-text-secondary)' }}>Due:</span> <span style={{ fontWeight: 500 }}>{item.due_date}</span></span>
              <span><span style={{ color: 'var(--color-text-secondary)' }}>Days out:</span> <span style={{ fontWeight: 500 }}>{item.days_out}</span></span>
              <span><span style={{ color: 'var(--color-text-secondary)' }}>Matter:</span> <span style={{ fontWeight: 500 }}>{item.matter_name}</span></span>
            </div>
          </div>

          {action === 'confirm' && (
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Confirming this deadline logs your review to the audit trail with actor, entity, timestamp, and before/after state. Use Extend if the date is changing.
            </p>
          )}

          {action === 'extend' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>New due date</label>
                <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} onFocus={() => setFocusDate(true)} onBlur={() => setFocusDate(false)} style={inputStyle(focusDate)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>Reason</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} onFocus={() => setFocusReason(true)} onBlur={() => setFocusReason(false)} rows={3} placeholder="e.g. Opposing counsel agreed to 7-day extension" style={{ ...inputStyle(focusReason), height: 'auto', resize: 'vertical', minHeight: 80 }} />
              </div>
            </div>
          )}

          {action === 'dismiss' && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>Reason</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} onFocus={() => setFocusReason(true)} onBlur={() => setFocusReason(false)} rows={3} placeholder="e.g. Resolved by settlement agreement" style={{ ...inputStyle(focusReason), height: 'auto', resize: 'vertical', minHeight: 80 }} />
            </div>
          )}

          {error && <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--color-text-danger)' }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', fontSize: 14, background: 'transparent', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', color: 'var(--color-text-primary)', fontWeight: 400 }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading} style={{ padding: '8px 18px', fontSize: 14, fontWeight: 500, background: action === 'dismiss' ? 'transparent' : 'var(--color-action-primary)', color: action === 'dismiss' ? 'var(--color-text-danger)' : 'var(--color-action-primary-text)', border: action === 'dismiss' ? '0.5px solid var(--color-border-danger)' : 'none', borderRadius: 'var(--border-radius-md)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Saving…' : title}
          </button>
        </div>
      </div>
    </div>
  );
}
