import { useState } from 'react';
import type { BriefClientSilenceItem, ToolResult } from '../../types';
import { approveComm, queueComm, dismissComm } from '../../api';

interface Props {
  item: BriefClientSilenceItem;
  firmId: string;
  attorneyId: string;
  onClose: () => void;
  onSuccess: (result: ToolResult, itemId: string) => void;
}

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
    height: 'auto',
    resize: 'vertical' as const,
    minHeight: 70,
  };
}

export function ClientCommsModal({ item, firmId, attorneyId, onClose, onSuccess }: Props) {
  const [dismissReason, setDismissReason] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusDismiss, setFocusDismiss] = useState(false);

  async function run(op: string, apiFn: () => Promise<import('../../types').ActionResult>) {
    setLoading(op);
    setError(null);
    try {
      const result = await apiFn();
      if (result.success) { onSuccess(result, item.matter_id); }
      else { setError(result.message ?? 'Action failed'); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally { setLoading(null); }
  }

  const hasDraft = Boolean(item.comm_draft_id);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 540, width: '100%', background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)', border: '0.5px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>Client silence — draft outreach</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-tertiary)', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Matter summary */}
          <div style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: 14, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ display: 'inline-block', background: 'var(--color-ramp-amber-200)', color: 'var(--color-ramp-amber-900)', padding: '3px 8px', borderRadius: 'var(--border-radius-md)', fontSize: 11, fontWeight: 500 }}>SILENCE</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>{item.matter_id}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-border-warning)', marginLeft: 'auto' }}>{item.days_since_contact} days</span>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.matter_name}</p>
            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
              <span><span style={{ color: 'var(--color-text-secondary)' }}>Client:</span> <span style={{ fontWeight: 500 }}>{item.client_name}</span></span>
              <span><span style={{ color: 'var(--color-text-secondary)' }}>Threshold:</span> <span style={{ fontWeight: 500 }}>{item.threshold_days} days</span></span>
              {item.last_contact_date && <span><span style={{ color: 'var(--color-text-secondary)' }}>Last contact:</span> <span style={{ fontWeight: 500 }}>{item.last_contact_date}</span></span>}
            </div>
          </div>

          {hasDraft ? (
            <>
              <div style={{ background: 'var(--color-background-success)', borderRadius: 'var(--border-radius-md)', padding: '12px 14px', borderLeft: '3px solid var(--color-border-success)', marginBottom: 20 }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 500, color: 'var(--color-text-success)' }}>Litt drafted an outreach email</p>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--color-text-success)', fontFamily: 'var(--font-mono)', opacity: 0.9 }}>Draft ID: {item.comm_draft_id}</p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-success)', opacity: 0.85 }}>
                  Generated from {item.days_since_contact}-day silence trigger. Review before sending.
                </p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-primary)' }}>Dismiss reason (if not sending)</label>
                <textarea value={dismissReason} onChange={e => setDismissReason(e.target.value)} onFocus={() => setFocusDismiss(true)} onBlur={() => setFocusDismiss(false)} placeholder="Reason required to dismiss" style={inputStyle(focusDismiss)} />
              </div>
            </>
          ) : (
            <div style={{ background: 'var(--color-background-warning)', borderRadius: 'var(--border-radius-md)', padding: '12px 14px', borderLeft: '3px solid var(--color-border-warning)' }}>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-warning)' }}>No draft generated yet. Run a sweep to trigger draft generation for this matter.</p>
            </div>
          )}

          {error && <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--color-text-danger)' }}>{error}</p>}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button
            onClick={() => {
              if (!dismissReason.trim()) { setError('Reason required to dismiss'); return; }
              if (!item.comm_draft_id) return;
              run('dismiss', () => dismissComm({ firm_id: firmId, attorney_id: attorneyId, draft_id: item.comm_draft_id!, reason: dismissReason }));
            }}
            disabled={loading !== null || !hasDraft}
            style={{ padding: '8px 18px', fontSize: 14, background: 'transparent', color: 'var(--color-text-danger)', border: '0.5px solid var(--color-border-danger)', borderRadius: 'var(--border-radius-md)', cursor: loading || !hasDraft ? 'not-allowed' : 'pointer', opacity: loading || !hasDraft ? 0.5 : 1, fontWeight: 400 }}
          >
            {loading === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 18px', fontSize: 14, background: 'transparent', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', color: 'var(--color-text-primary)', fontWeight: 400 }}>
              Cancel
            </button>
            {hasDraft && (
              <>
                <button onClick={() => run('approve', () => approveComm({ firm_id: firmId, attorney_id: attorneyId, draft_id: item.comm_draft_id! }))} disabled={loading !== null} style={{ padding: '8px 18px', fontSize: 14, fontWeight: 500, background: 'var(--color-action-primary)', color: 'var(--color-action-primary-text)', border: 'none', borderRadius: 'var(--border-radius-md)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                  {loading === 'approve' ? 'Approving…' : 'Approve draft'}
                </button>
                <button onClick={() => run('queue', () => queueComm({ firm_id: firmId, attorney_id: attorneyId, draft_id: item.comm_draft_id! }))} disabled={loading !== null} style={{ padding: '8px 18px', fontSize: 14, fontWeight: 500, background: 'var(--color-background-success)', color: 'var(--color-text-success)', border: '0.5px solid var(--color-border-success)', borderRadius: 'var(--border-radius-md)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                  {loading === 'queue' ? 'Queuing…' : 'Queue to send'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
