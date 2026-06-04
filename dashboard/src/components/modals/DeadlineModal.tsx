import { useEffect, useRef, useState } from 'react';
import type { BriefDeadlineItem, SourceEmail, ToolResult } from '../../types';
import { confirmDeadline, extendDeadline, dismissDeadline, verifyDeadline, getSourceEmail } from '../../api';

export type DeadlineAction = 'confirm' | 'verify' | 'extend' | 'dismiss';

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

export function DeadlineModal({ item, action: initialAction, firmId, attorneyId, onClose, onSuccess }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isConflict = item.verification_status === 'conflict_flagged';
  const tabs: DeadlineAction[] = isConflict ? ['verify', 'extend', 'dismiss'] : ['confirm', 'extend', 'dismiss'];

  const [activeAction, setActiveAction] = useState<DeadlineAction>(initialAction);
  const [newDueDate, setNewDueDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusDate, setFocusDate] = useState(false);
  const [focusReason, setFocusReason] = useState(false);

  // Source email viewer state
  const [showEmail, setShowEmail] = useState(false);
  const [emailData, setEmailData] = useState<SourceEmail | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const action = activeAction;
  const titleMap: Record<DeadlineAction, string> = {
    confirm: 'Confirm deadline',
    verify:  'Verify deadline',
    extend:  'Extend deadline',
    dismiss: 'Dismiss deadline',
  };
  const title = titleMap[action] ?? 'Deadline';
  const badge = CLASS_BADGE_STYLE[item.classification] ?? { bg: 'var(--color-ramp-gray-200)', color: 'var(--color-ramp-gray-900)', weight: 500 };
  const titleId = 'deadline-modal-title';

  useEffect(() => { closeButtonRef.current?.focus(); }, []);

  async function handleLoadEmail() {
    if (emailData) { setShowEmail(v => !v); return; }
    if (!item.source_document_id) return;
    setEmailLoading(true);
    setEmailError(null);
    try {
      const data = await getSourceEmail(firmId, item.source_document_id);
      setEmailData(data);
      setShowEmail(true);
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : 'Failed to load source email');
    } finally { setEmailLoading(false); }
  }

  async function handleSubmit() {
    if (action === 'extend' && (!newDueDate || !reason.trim())) { setError('New date and reason required'); return; }
    if (action === 'dismiss' && !reason.trim()) { setError('Reason required'); return; }
    setLoading(true);
    setError(null);
    try {
      let result;
      if (action === 'verify') {
        result = await verifyDeadline({ firm_id: firmId, attorney_id: attorneyId, deadline_id: item.deadline_id, expected_version: item.version, idempotency_key: `verify-${item.deadline_id}-${Date.now()}` });
      } else if (action === 'confirm') {
        result = await confirmDeadline({ firm_id: firmId, attorney_id: attorneyId, deadline_id: item.deadline_id, expected_version: item.version, idempotency_key: `confirm-${item.deadline_id}-${Date.now()}` });
      } else if (action === 'extend') {
        result = await extendDeadline({ firm_id: firmId, attorney_id: attorneyId, deadline_id: item.deadline_id, new_due_date: newDueDate, reason, expected_version: item.version, idempotency_key: `extend-${item.deadline_id}-${Date.now()}` });
      } else {
        result = await dismissDeadline({ firm_id: firmId, attorney_id: attorneyId, deadline_id: item.deadline_id, reason, expected_version: item.version, idempotency_key: `dismiss-${item.deadline_id}-${Date.now()}` });
      }
      if (result.success) { onSuccess(result, item.deadline_id); }
      else { setError((result as { message?: string }).message ?? 'Action failed'); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ maxWidth: 580, width: '100%', background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)', border: '0.5px solid var(--color-border-tertiary)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px 14px', borderTop: '3px solid #D6C181', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
              <h2 id={titleId} style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>{title}</h2>
              <span style={{ display: 'inline-flex', background: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: badge.weight, fontFamily: 'var(--font-mono)', letterSpacing: '0.03em', flexShrink: 0 }}>
                {CLASS_LABEL[item.classification] ?? item.classification}
              </span>
              {isConflict && (
                <span style={{ background: '#FFF3CD', color: '#856404', border: '0.5px solid #FFCA2C', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  SOURCE CONFLICT
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>{item.matter_name}</p>
          </div>
          <button ref={closeButtonRef} onClick={onClose} aria-label="Close dialog" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-tertiary)', lineHeight: 1, padding: '0 4px', marginLeft: 12, flexShrink: 0 }}>×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>

          {/* Action tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {tabs.map(a => (
              <button
                key={a}
                onClick={() => { setActiveAction(a); setError(null); setNewDueDate(''); setReason(''); }}
                style={{
                  flex: 1, padding: '7px 4px', fontSize: 13,
                  fontWeight: activeAction === a ? 600 : 400,
                  fontFamily: 'var(--font-sans)', textTransform: 'capitalize',
                  border: `1px solid ${activeAction === a
                    ? (a === 'dismiss' ? 'var(--color-border-danger)' : a === 'verify' ? 'var(--color-border-warning)' : 'var(--color-border-info)')
                    : 'var(--color-border-tertiary)'}`,
                  borderRadius: 'var(--border-radius-md)',
                  background: activeAction === a
                    ? (a === 'dismiss' ? 'var(--color-background-danger)' : a === 'verify' ? 'var(--color-background-warning)' : 'var(--color-background-info)')
                    : 'transparent',
                  color: activeAction === a
                    ? (a === 'dismiss' ? 'var(--color-text-danger)' : a === 'verify' ? 'var(--color-text-warning)' : 'var(--color-text-info)')
                    : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {a}
              </button>
            ))}
          </div>

          {/* Item summary */}
          <div style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: 14, marginBottom: 20 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ display: 'inline-block', background: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: 'var(--border-radius-md)', fontSize: 11, fontWeight: badge.weight, marginRight: 8 }}>
                {CLASS_LABEL[item.classification] ?? item.classification}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 4, padding: '1px 6px' }}>{item.deadline_id}</span>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.description}</p>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
              <span><span style={{ color: 'var(--color-text-secondary)' }}>Due:</span> <span style={{ fontWeight: 500 }}>{item.due_date}</span></span>
              <span><span style={{ color: 'var(--color-text-secondary)' }}>Days out:</span> <span style={{ fontWeight: 500 }}>{item.days_out}</span></span>
              <span><span style={{ color: 'var(--color-text-secondary)' }}>Matter:</span> <span style={{ fontWeight: 500 }}>{item.matter_name}</span></span>
            </div>

            {/* Source citation */}
            {item.source_document_id && (
              <div style={{ marginTop: 12, borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'rgba(169,132,53,.1)', color: '#A98435', border: '0.5px solid rgba(169,132,53,.25)', borderRadius: 3, padding: '1px 5px' }}>
                    {(item.source_type ?? 'source').replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
                    {item.source_document_id}
                    {item.court ? ` · ${item.court}` : ''}
                    {item.jurisdiction ? ` · ${item.jurisdiction}` : ''}
                    {item.detected_at ? ` · Detected ${item.detected_at.slice(0, 10)}` : ''}
                  </span>
                </div>
                {item.source_excerpt && (
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--color-text-secondary)', fontStyle: 'italic', lineHeight: 1.5, borderLeft: '2px solid rgba(169,132,53,.4)', paddingLeft: 8 }}>
                    "{item.source_excerpt}"
                  </p>
                )}
                {/* View source email toggle — only for email source type */}
                {item.source_type === 'email' && (
                  <button
                    onClick={handleLoadEmail}
                    disabled={emailLoading}
                    style={{ fontSize: 12, fontFamily: 'var(--font-mono)', background: 'none', border: '0.5px solid var(--color-border-secondary)', borderRadius: 4, padding: '3px 8px', cursor: emailLoading ? 'not-allowed' : 'pointer', color: 'var(--color-text-secondary)', opacity: emailLoading ? 0.6 : 1 }}
                  >
                    {emailLoading ? 'Loading…' : showEmail ? '▲ Hide source email' : '▼ View source email'}
                  </button>
                )}
                {emailError && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-text-danger)' }}>{emailError}</p>}
              </div>
            )}

            {/* Source email viewer */}
            {showEmail && emailData && (
              <div style={{ marginTop: 12, border: '1px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden' }}>
                {/* Email header */}
                <div style={{ background: 'var(--color-background-tertiary)', padding: '10px 14px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                  {[
                    { label: 'From', value: emailData.from_name ? `${emailData.from_name} <${emailData.from_address}>` : (emailData.from_address ?? '—') },
                    { label: 'To',   value: emailData.to_address ?? '—' },
                    { label: 'Subj', value: emailData.subject ?? '—' },
                    { label: 'Date', value: emailData.received_at ? emailData.received_at.slice(0, 16).replace('T', ' ') + ' UTC' : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', gap: 10, fontSize: 12, marginBottom: 3 }}>
                      <span style={{ width: 32, flexShrink: 0, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontSize: 10, paddingTop: 1 }}>{label}</span>
                      <span style={{ color: 'var(--color-text-secondary)', wordBreak: 'break-all' }}>{value}</span>
                    </div>
                  ))}
                </div>
                {/* Gemini extraction badge */}
                <div style={{ padding: '6px 14px', background: '#FFFBEB', borderBottom: '0.5px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gemini 2.5 Pro</span>
                  <span style={{ fontSize: 11, color: '#78350F' }}>Extracted deadline from this email — confidence: 0.92 — no confirming court order found</span>
                </div>
                {/* Email body */}
                <pre style={{ margin: 0, padding: '12px 14px', fontSize: 12, fontFamily: 'var(--font-sans)', lineHeight: 1.6, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--color-background-primary)', maxHeight: 220, overflowY: 'auto' }}>
                  {emailData.body}
                </pre>
              </div>
            )}
          </div>

          {/* Conflict detail notice */}
          {isConflict && item.conflict_detail && action !== 'dismiss' && (
            <div style={{ background: 'var(--color-background-warning)', border: '0.5px solid var(--color-border-warning)', borderRadius: 'var(--border-radius-md)', padding: '12px 14px', marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-warning)', lineHeight: 1.5 }}>{item.conflict_detail}</p>
            </div>
          )}

          {(action === 'verify' || action === 'confirm') && (
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {action === 'verify'
                ? 'Verifying this deadline accepts the source email as sufficient authority and marks it as attorney-verified. The next sweep will process it under the normal escalation cadence. This action is logged to the audit trail.'
                : 'Confirming this deadline logs your review to the audit trail with actor, entity, timestamp, and before/after state. Use Extend if the date is changing.'}
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
        <div style={{ padding: '14px 24px', borderTop: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', fontSize: 14, background: 'transparent', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', color: 'var(--color-text-primary)', fontWeight: 400 }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: '8px 18px', fontSize: 14, fontWeight: 500, borderRadius: 'var(--border-radius-md)',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
              background: action === 'dismiss' ? 'transparent' : action === 'verify' ? 'var(--color-ramp-amber-600)' : 'var(--color-action-primary)',
              color: action === 'dismiss' ? 'var(--color-text-danger)' : '#FFFFFF',
              border: action === 'dismiss' ? '0.5px solid var(--color-border-danger)' : 'none',
            }}
          >
            {loading ? 'Saving…' : title}
          </button>
        </div>
      </div>
    </div>
  );
}
