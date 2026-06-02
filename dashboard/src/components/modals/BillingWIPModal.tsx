import { useState } from 'react';
import type { BriefTimeEntryItem, ToolResult } from '../../types';
import { approveBilling, writeDownBilling, writeOffBilling, updateNarrative } from '../../api';

export type BillingAction = 'approve' | 'write-down' | 'write-off' | 'narrative';

interface Props {
  item: BriefTimeEntryItem;
  action: BillingAction;
  firmId: string;
  attorneyId: string;
  onClose: () => void;
  onSuccess: (result: ToolResult, itemId: string) => void;
}

const ACTION_TITLE: Record<BillingAction, string> = {
  approve: 'Approve entry',
  'write-down': 'Write down entry',
  'write-off': 'Write off entry',
  narrative: 'Edit narrative',
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

export function BillingWIPModal({ item, action: initialAction, firmId, attorneyId, onClose, onSuccess }: Props) {
  const [activeAction, setActiveAction] = useState<BillingAction>(initialAction);
  const [newHours, setNewHours] = useState(String(item.hours));
  const [reason, setReason] = useState('');
  const [narrative, setNarrative] = useState(item.narrative ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusHours, setFocusHours] = useState(false);
  const [focusReason, setFocusReason] = useState(false);
  const [focusNarrative, setFocusNarrative] = useState(false);

  const action = activeAction;
  const title = ACTION_TITLE[action];

  async function handleSubmit() {
    if (action === 'write-down' && (!reason.trim() || !newHours)) { setError('New hours and reason required'); return; }
    if (action === 'write-off' && !reason.trim()) { setError('Reason required'); return; }
    if (action === 'narrative' && !narrative.trim()) { setError('Narrative cannot be empty'); return; }
    setLoading(true);
    setError(null);
    try {
      const idem = `${action}-${item.entry_id}-${Date.now()}`;
      let result;
      if (action === 'approve') {
        result = await approveBilling({ firm_id: firmId, attorney_id: attorneyId, entry_id: item.entry_id, expected_version: item.version, idempotency_key: idem });
      } else if (action === 'write-down') {
        result = await writeDownBilling({ firm_id: firmId, attorney_id: attorneyId, entry_id: item.entry_id, new_hours: parseFloat(newHours), new_amount: parseFloat(newHours) * 350, reason, expected_version: item.version, idempotency_key: idem });
      } else if (action === 'write-off') {
        result = await writeOffBilling({ firm_id: firmId, attorney_id: attorneyId, entry_id: item.entry_id, reason, expected_version: item.version, idempotency_key: idem });
      } else {
        result = await updateNarrative({ firm_id: firmId, attorney_id: attorneyId, entry_id: item.entry_id, narrative, expected_version: item.version, idempotency_key: idem });
      }
      if (result.success) { onSuccess(result, item.entry_id); }
      else { setError(result.message ?? 'Action failed'); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally { setLoading(false); }
  }

  const isDanger = action === 'write-off';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 540, width: '100%', background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)', border: '0.5px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-tertiary)', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Action tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {(['approve', 'write-down', 'write-off', 'narrative'] as BillingAction[]).map(a => {
              const isDanger = a === 'write-off';
              const isWarn   = a === 'write-down';
              const isActive = activeAction === a;
              return (
                <button
                  key={a}
                  onClick={() => {
                    setActiveAction(a);
                    setError(null);
                    setReason('');
                    setNewHours(String(item.hours));
                    setNarrative(item.narrative ?? '');
                  }}
                  style={{
                    flex: 1,
                    padding: '7px 4px',
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    border: `1px solid ${isActive
                      ? isDanger ? 'var(--color-border-danger)'
                      : isWarn  ? 'var(--color-border-warning)'
                      : 'var(--color-border-info)'
                      : 'var(--color-border-tertiary)'}`,
                    borderRadius: 'var(--border-radius-md)',
                    background: isActive
                      ? isDanger ? 'var(--color-background-danger)'
                      : isWarn  ? 'var(--color-background-warning)'
                      : 'var(--color-background-info)'
                      : 'transparent',
                    color: isActive
                      ? isDanger ? 'var(--color-text-danger)'
                      : isWarn  ? 'var(--color-text-warning)'
                      : 'var(--color-text-info)'
                      : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {a}
                </button>
              );
            })}
          </div>

          {/* Entry summary */}
          <div style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: 14, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {item.has_block && <span style={{ display: 'inline-block', background: 'var(--color-ramp-red-400)', color: '#FFFFFF', padding: '3px 8px', borderRadius: 'var(--border-radius-md)', fontSize: 11, fontWeight: 600 }}>BLOCK</span>}
              {item.has_warn && !item.has_block && <span style={{ display: 'inline-block', background: 'var(--color-ramp-amber-200)', color: 'var(--color-ramp-amber-900)', padding: '3px 8px', borderRadius: 'var(--border-radius-md)', fontSize: 11, fontWeight: 500 }}>WARN</span>}
              {!item.has_block && !item.has_warn && <span style={{ display: 'inline-block', background: 'var(--color-ramp-blue-200)', color: 'var(--color-ramp-blue-900)', padding: '3px 8px', borderRadius: 'var(--border-radius-md)', fontSize: 11, fontWeight: 500 }}>PENDING</span>}
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>{item.entry_id}</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{item.status}</span>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: item.narrative ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', fontStyle: item.narrative ? 'normal' : 'italic', lineHeight: 1.5 }}>
              {item.narrative ?? 'No narrative'}
            </p>
            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
              <span><span style={{ color: 'var(--color-text-secondary)' }}>Hours:</span> <span style={{ fontWeight: 500 }}>{item.hours}h</span></span>
              <span><span style={{ color: 'var(--color-text-secondary)' }}>Amount:</span> <span style={{ fontWeight: 500 }}>${item.amount.toFixed(2)}</span></span>
              <span><span style={{ color: 'var(--color-text-secondary)' }}>Matter:</span> <span style={{ fontWeight: 500 }}>{item.matter_name}</span></span>
            </div>
          </div>

          {/* Scrubber flags */}
          {item.scrubber_flags.length > 0 && (
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {item.scrubber_flags.map((f, i) => (
                <div key={i} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 'var(--border-radius-md)', background: f.severity === 'BLOCK' ? 'var(--color-background-danger)' : 'var(--color-background-warning)', color: f.severity === 'BLOCK' ? 'var(--color-text-danger)' : 'var(--color-text-warning)' }}>
                  <span style={{ fontWeight: 500 }}>{f.severity}</span> · {f.check_name}: {f.message}
                  {f.matched_text && <span style={{ fontStyle: 'italic' }}> ("{f.matched_text}")</span>}
                </div>
              ))}
            </div>
          )}

          {action === 'approve' && (
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Advances this entry to APPROVED for billing and writes the attorney decision to the audit trail.
              {item.has_block && <span style={{ display: 'block', marginTop: 8, color: 'var(--color-text-danger)', fontWeight: 500 }}>This entry has BLOCK-level flags. Resolve the issues before approving.</span>}
            </p>
          )}

          {action === 'write-down' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>New hours (current: {item.hours}h)</label>
                <input type="number" step="0.1" min="0.1" value={newHours} onChange={e => setNewHours(e.target.value)} onFocus={() => setFocusHours(true)} onBlur={() => setFocusHours(false)} style={{ ...inputStyle(focusHours), width: 120 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Reason</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} onFocus={() => setFocusReason(true)} onBlur={() => setFocusReason(false)} rows={2} placeholder="e.g. Reduce per client billing guidelines" style={{ ...inputStyle(focusReason), height: 'auto', resize: 'vertical', minHeight: 70 }} />
              </div>
            </div>
          )}

          {action === 'write-off' && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Reason</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} onFocus={() => setFocusReason(true)} onBlur={() => setFocusReason(false)} rows={3} placeholder="e.g. Non-billable internal work" style={{ ...inputStyle(focusReason), height: 'auto', resize: 'vertical', minHeight: 80 }} />
            </div>
          )}

          {action === 'narrative' && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Narrative</label>
              <textarea value={narrative} onChange={e => setNarrative(e.target.value)} onFocus={() => setFocusNarrative(true)} onBlur={() => setFocusNarrative(false)} rows={4} placeholder="Describe work performed…" style={{ ...inputStyle(focusNarrative), height: 'auto', resize: 'vertical', minHeight: 100 }} />
            </div>
          )}

          {error && <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--color-text-danger)' }}>{error}</p>}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', fontSize: 14, background: 'transparent', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', color: 'var(--color-text-primary)', fontWeight: 400 }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading} style={{ padding: '8px 18px', fontSize: 14, fontWeight: 500, background: isDanger ? 'transparent' : 'var(--color-action-primary)', color: isDanger ? 'var(--color-text-danger)' : 'var(--color-action-primary-text)', border: isDanger ? '0.5px solid var(--color-border-danger)' : 'none', borderRadius: 'var(--border-radius-md)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Saving…' : title}
          </button>
        </div>
      </div>
    </div>
  );
}
