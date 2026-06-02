import { useState } from 'react';
import type { BriefTimeEntryItem, ToolResult } from '../../types';
import { approveBilling, writeDownBilling, writeOffBilling, updateNarrative } from '../../api';

export type BillingAction = 'approve' | 'edit' | 'write-off';

interface Props {
  item: BriefTimeEntryItem;
  action: BillingAction;
  firmId: string;
  attorneyId: string;
  onClose: () => void;
  onSuccess: (result: ToolResult, itemId: string) => void;
}

const UTBMS_TASK: Record<string, string> = {
  L100: 'Case Assessment', L110: 'Fact Investigation', L120: 'Analysis/Strategy',
  L200: 'Pre-Trial Pleadings', L210: 'Pleadings', L300: 'Discovery',
  L310: 'Written Discovery', L320: 'Document Production', L400: 'Trial Prep',
  A100: 'Project Administration', A104: 'Research', A106: 'Document Review',
  A107: 'Drafting/Editing', A200: 'Negotiation Strategy', A201: 'Deal Strategy',
  A300: 'Transaction Execution', A400: 'Regulatory',
};

const UTBMS_ACTIVITY: Record<string, string> = {
  A101: 'Plan/Prepare/Coordinate', A102: 'Research', A103: 'Draft/Revise',
  A104: 'Review/Analyze', A105: 'Communicate (Other)', A106: 'Communicate (Client)',
  A107: 'Communicate (Opposing Counsel)', A108: 'Communicate (Court)', A109: 'Appear',
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

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

export function BillingWIPModal({ item, action: initialAction, firmId, attorneyId, onClose, onSuccess }: Props) {
  // map legacy 'write-down' and 'narrative' to 'edit'
  const normalise = (a: string): BillingAction =>
    (a === 'write-down' || a === 'narrative') ? 'edit' : (a as BillingAction);

  const [activeAction, setActiveAction] = useState<BillingAction>(normalise(initialAction));
  const [newHours, setNewHours] = useState(String(item.hours));
  const [reason, setReason] = useState('');
  const [narrative, setNarrative] = useState(item.narrative ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusHours, setFocusHours] = useState(false);
  const [focusReason, setFocusReason] = useState(false);
  const [focusNarrative, setFocusNarrative] = useState(false);

  const action = activeAction;

  const TITLE: Record<BillingAction, string> = {
    approve:    'Approve entry',
    edit:       'Review & edit entry',
    'write-off': 'Write off entry',
  };
  const title = TITLE[action];

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const idem = `${action}-${item.entry_id}-${Date.now()}`;
      let result: import('../../types').ActionResult | undefined;

      if (action === 'approve') {
        result = await approveBilling({
          firm_id: firmId, attorney_id: attorneyId, entry_id: item.entry_id,
          expected_version: item.version, idempotency_key: idem,
        });

      } else if (action === 'edit') {
        const hoursChanged = parseFloat(newHours) !== item.hours;
        const narrativeChanged = narrative.trim() !== (item.narrative ?? '').trim();

        if (!hoursChanged && !narrativeChanged) {
          setError('No changes to save'); setLoading(false); return;
        }

        if (hoursChanged) {
          if (!newHours || parseFloat(newHours) <= 0) { setError('Valid hours required'); setLoading(false); return; }
          if (!reason.trim()) { setError('Reason required when adjusting hours'); setLoading(false); return; }
          result = await writeDownBilling({
            firm_id: firmId, attorney_id: attorneyId, entry_id: item.entry_id,
            new_hours: parseFloat(newHours),
            new_amount: parseFloat(newHours) * 350,
            reason, expected_version: item.version,
            idempotency_key: `wd-${item.entry_id}-${Date.now()}`,
          });
          if (!result?.success) { setError((result as import('../../types').ToolError)?.message ?? 'Write-down failed'); setLoading(false); return; }
        }

        if (narrativeChanged) {
          if (!narrative.trim()) { setError('Narrative cannot be empty'); setLoading(false); return; }
          result = await updateNarrative({
            firm_id: firmId, attorney_id: attorneyId, entry_id: item.entry_id,
            narrative, expected_version: hoursChanged ? undefined : item.version,
            idempotency_key: `narr-${item.entry_id}-${Date.now()}`,
          });
        }

      } else {
        if (!reason.trim()) { setError('Reason required'); setLoading(false); return; }
        result = await writeOffBilling({
          firm_id: firmId, attorney_id: attorneyId, entry_id: item.entry_id,
          reason, expected_version: item.version, idempotency_key: idem,
        });
      }

      if (result?.success) { onSuccess(result as ToolResult, item.entry_id); }
      else { setError((result as import('../../types').ToolError)?.message ?? 'Action failed'); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally { setLoading(false); }
  }

  const isDanger = action === 'write-off';
  const taskLabel = item.task_code ? `${item.task_code} · ${UTBMS_TASK[item.task_code] ?? item.task_code}` : null;
  const actLabel  = item.activity_code ? `${item.activity_code} · ${UTBMS_ACTIVITY[item.activity_code] ?? item.activity_code}` : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 560, width: '100%', background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)', border: '0.5px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-tertiary)', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Action tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {(['approve', 'edit', 'write-off'] as BillingAction[]).map(a => {
              const isd = a === 'write-off';
              const ise = a === 'edit';
              const isActive = activeAction === a;
              return (
                <button
                  key={a}
                  onClick={() => { setActiveAction(a); setError(null); setReason(''); setNewHours(String(item.hours)); setNarrative(item.narrative ?? ''); }}
                  style={{
                    flex: 1, padding: '7px 4px', fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em',
                    border: `1px solid ${isActive
                      ? isd ? 'var(--color-border-danger)'
                      : ise ? 'var(--color-border-warning)'
                      : 'var(--color-border-info)'
                      : 'var(--color-border-tertiary)'}`,
                    borderRadius: 'var(--border-radius-md)',
                    background: isActive
                      ? isd ? 'var(--color-background-danger)'
                      : ise ? 'var(--color-background-warning)'
                      : 'var(--color-background-info)'
                      : 'transparent',
                    color: isActive
                      ? isd ? 'var(--color-text-danger)'
                      : ise ? 'var(--color-text-warning)'
                      : 'var(--color-text-info)'
                      : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {a === 'edit' ? 'Review & Edit' : a}
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
            </div>

            <p style={{ margin: '0 0 10px', fontSize: 14, color: item.narrative ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', fontStyle: item.narrative ? 'normal' : 'italic', lineHeight: 1.5 }}>
              {item.narrative ?? 'No narrative'}
            </p>

            {/* Metrics row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, marginBottom: (taskLabel || actLabel || item.session_minutes_actual != null) ? 10 : 0 }}>
              <span><span style={{ color: 'var(--color-text-secondary)' }}>Hours:</span> <span style={{ fontWeight: 500 }}>{item.hours}h</span></span>
              <span><span style={{ color: 'var(--color-text-secondary)' }}>Amount:</span> <span style={{ fontWeight: 500 }}>${item.amount.toFixed(2)}</span></span>
              <span><span style={{ color: 'var(--color-text-secondary)' }}>Matter:</span> <span style={{ fontWeight: 500 }}>{item.matter_name}</span></span>
              <span><span style={{ color: 'var(--color-text-secondary)' }}>Date:</span> <span style={{ fontWeight: 500 }}>{item.entry_date}</span></span>
            </div>

            {/* UTBMS + session data */}
            {(taskLabel || actLabel || item.session_minutes_actual != null) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 8, borderTop: '1px solid var(--color-border-tertiary)' }}>
                {taskLabel && (
                  <span style={{ background: 'var(--color-ramp-blue-200)', color: 'var(--color-ramp-blue-900)', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                    {taskLabel}
                  </span>
                )}
                {actLabel && (
                  <span style={{ background: '#F0F4F0', color: '#3A5A44', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                    {actLabel}
                  </span>
                )}
                {item.session_minutes_actual != null && (
                  <span style={{ background: '#FFF8E6', color: '#7A5C10', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                    ⏱ Session: {fmtMinutes(item.session_minutes_actual)} tracked · {item.hours}h billed
                    {Math.round(item.session_minutes_actual / 6) / 10 !== item.hours
                      ? ` (${(item.hours - item.session_minutes_actual / 60).toFixed(1)}h delta)`
                      : ''}
                  </span>
                )}
              </div>
            )}
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

          {/* Approve: no fields, just confirmation copy */}
          {action === 'approve' && (
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Advances this entry to APPROVED for billing and writes the attorney decision to the audit trail.
              {item.has_block && <span style={{ display: 'block', marginTop: 8, color: 'var(--color-text-danger)', fontWeight: 500 }}>This entry has BLOCK-level flags. Resolve the issues before approving.</span>}
            </p>
          )}

          {/* Edit: hours + narrative */}
          {action === 'edit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  Adjust hours <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(current: {item.hours}h)</span>
                </label>
                <input
                  type="number" step="0.1" min="0.1"
                  value={newHours}
                  onChange={e => setNewHours(e.target.value)}
                  onFocus={() => setFocusHours(true)}
                  onBlur={() => setFocusHours(false)}
                  style={{ ...inputStyle(focusHours), width: 120 }}
                />
                {parseFloat(newHours) !== item.hours && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Reason for adjustment</label>
                    <textarea
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      onFocus={() => setFocusReason(true)}
                      onBlur={() => setFocusReason(false)}
                      rows={2}
                      placeholder="e.g. Reduce per client billing guidelines"
                      style={{ ...inputStyle(focusReason), height: 'auto', resize: 'vertical', minHeight: 60 }}
                    />
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Narrative</label>
                <textarea
                  value={narrative}
                  onChange={e => setNarrative(e.target.value)}
                  onFocus={() => setFocusNarrative(true)}
                  onBlur={() => setFocusNarrative(false)}
                  rows={4}
                  placeholder="Describe work performed…"
                  style={{ ...inputStyle(focusNarrative), height: 'auto', resize: 'vertical', minHeight: 100 }}
                />
              </div>
            </div>
          )}

          {/* Write-off: reason only */}
          {action === 'write-off' && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Reason</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                onFocus={() => setFocusReason(true)}
                onBlur={() => setFocusReason(false)}
                rows={3}
                placeholder="e.g. Non-billable internal work"
                style={{ ...inputStyle(focusReason), height: 'auto', resize: 'vertical', minHeight: 80 }}
              />
            </div>
          )}

          {error && <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--color-text-danger)' }}>{error}</p>}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', fontSize: 14, background: 'transparent', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', color: 'var(--color-text-primary)', fontWeight: 400 }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: '8px 18px', fontSize: 14, fontWeight: 500,
              background: isDanger ? 'transparent' : 'var(--color-action-primary)',
              color: isDanger ? 'var(--color-text-danger)' : 'var(--color-action-primary-text)',
              border: isDanger ? '0.5px solid var(--color-border-danger)' : 'none',
              borderRadius: 'var(--border-radius-md)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Saving…' : action === 'edit' ? 'Save & approve' : title}
          </button>
        </div>
      </div>
    </div>
  );
}
