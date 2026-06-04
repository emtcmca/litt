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

function buildMockDraft(item: BriefClientSilenceItem): { subject: string; to: string; body: string } {
  const firstName = item.client_name.split(' ')[0];
  return {
    subject: `Matter update: ${item.matter_name}`,
    to: `${item.client_name.toLowerCase().replace(/[\s,&]+/g, '.')}@example.com`,
    body: `Dear ${firstName},

I wanted to reach out with a brief update on your matter — ${item.matter_name}.

It has been ${item.days_since_contact} days since our last communication, and I want to ensure you remain informed and have an opportunity to raise any questions or concerns before the close of this week.

Your matter is progressing appropriately. We continue to monitor relevant developments and are prepared to act promptly as circumstances require. If there are any decisions pending on your end, now is a good time to connect.

Please feel free to contact me directly at any time — by phone or email. I'm happy to schedule a call at your convenience.

Best regards,

Dana Strand
Strand & Okafor LLP
dana.strand@strandokafor.com
(216) 555-0190`,
  };
}

function inputStyle(focused: boolean, mono = false) {
  return {
    width: '100%',
    padding: '7px 10px',
    fontSize: mono ? 12 : 14,
    fontFamily: mono ? 'var(--font-mono)' : 'inherit',
    border: `0.5px solid ${focused ? 'var(--color-border-info)' : 'var(--color-border-tertiary)'}`,
    borderRadius: 'var(--border-radius-md)',
    boxShadow: focused ? '0 0 0 3px rgba(55,138,221,0.2)' : 'none',
    outline: 'none',
    background: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)',
    boxSizing: 'border-box' as const,
    resize: 'none' as const,
  };
}

export function ClientCommsModal({ item, firmId, attorneyId, onClose, onSuccess }: Props) {
  const hasDraft = Boolean(item.comm_draft_id);
  const mock = buildMockDraft(item);

  const [view, setView] = useState<'summary' | 'email'>(hasDraft ? 'email' : 'summary');
  const [generating, setGenerating] = useState(false);
  const [draftSubject, setDraftSubject] = useState(mock.subject);
  const [draftBody, setDraftBody] = useState(mock.body);
  const [dismissReason, setDismissReason] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusDismiss, setFocusDismiss] = useState(false);
  const [focusSubject, setFocusSubject] = useState(false);
  const [focusBody, setFocusBody] = useState(false);

  async function run(op: string, apiFn: () => Promise<import('../../types').ActionResult>) {
    setLoading(op);
    setError(null);
    try {
      const result = await apiFn();
      if (result.success) { onSuccess(result as ToolResult, item.matter_id); }
      else { setError((result as import('../../types').ToolError).message ?? 'Action failed'); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally { setLoading(null); }
  }

  function handleGenerateDraft() {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setView('email');
    }, 1400);
  }

  function handleMockApprove(op: 'approve' | 'queue') {
    if (hasDraft && item.comm_draft_id) {
      if (op === 'approve') {
        run('approve', () => approveComm({ firm_id: firmId, attorney_id: attorneyId, draft_id: item.comm_draft_id! }));
      } else {
        run('queue', () => queueComm({ firm_id: firmId, attorney_id: attorneyId, draft_id: item.comm_draft_id! }));
      }
    } else {
      // Mock path — no real draft_id; fabricate a success receipt for demo
      const mockResult: ToolResult = {
        success: true,
        entity_id: item.matter_id,
        entity_type: 'comm_draft',
        audit_event_id: `mock-audit-${Date.now()}`,
        data: { actor: attorneyId, action: op, timestamp: new Date().toISOString() },
      };
      onSuccess(mockResult, item.matter_id);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 620, width: '100%', background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)', border: '0.5px solid var(--color-border-tertiary)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px 14px', borderTop: '3px solid #D6C181', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
                Client outreach
              </h2>
              {hasDraft && (
                <span style={{ background: 'rgba(169,132,53,.1)', color: '#A98435', border: '0.5px solid rgba(169,132,53,.25)', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  DRAFT READY
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {item.client_name} · {item.matter_name}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-tertiary)', lineHeight: 1, padding: '0 4px', marginLeft: 12, flexShrink: 0 }}>×</button>
        </div>

        {/* Matter summary strip */}
        <div style={{ padding: '12px 24px', background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-block', background: 'var(--color-ramp-amber-200)', color: 'var(--color-ramp-amber-900)', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>
            SILENCE
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.client_name}</span>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{item.matter_name}</span>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-ramp-amber-900)', marginLeft: 'auto' }}>
            {item.days_since_contact} days since contact · threshold {item.threshold_days}d
          </span>
        </div>

        {view === 'summary' ? (
          /* ── No-draft state ── */
          <div style={{ padding: 24 }}>
            <div style={{ background: 'var(--color-background-warning)', borderRadius: 'var(--border-radius-md)', padding: '16px 18px', borderLeft: '3px solid var(--color-border-warning)', marginBottom: 20 }}>
              <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 500, color: 'var(--color-text-warning)' }}>
                No draft exists for this matter.
              </p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-warning)', opacity: 0.85, lineHeight: 1.5 }}>
                Litt can prepare an outreach draft based on the {item.days_since_contact}-day silence trigger and matter context. Review and edit before sending.
              </p>
            </div>
            <button
              onClick={handleGenerateDraft}
              disabled={generating}
              style={{
                width: '100%', padding: '12px 16px', fontSize: 14, fontWeight: 600,
                background: '#14221F', color: '#D6C181', border: 'none',
                borderRadius: 'var(--border-radius-md)', cursor: generating ? 'not-allowed' : 'pointer',
                opacity: generating ? 0.75 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              {generating ? (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(214,193,129,0.3)', borderTopColor: '#D6C181', borderRadius: 999, animation: 'spin 0.7s linear infinite' }} />
                  Generating draft…
                </>
              ) : (
                '✦ Generate outreach draft'
              )}
            </button>
          </div>
        ) : (
          /* ── Email client view ── */
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Gemini generation badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {hasDraft ? `Draft ID: ${item.comm_draft_id}` : 'Draft generated by Litt (Gemini) · not yet sent'}
              </span>
            </div>

            {/* Email chrome */}
            <div style={{ border: '1px solid var(--color-border-tertiary)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Email header rows */}
              {[
                { label: 'From', value: 'dana.strand@strandokafor.com', editable: false },
                { label: 'To',   value: mock.to, editable: false },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', borderBottom: '0.5px solid var(--color-border-tertiary)', padding: '9px 14px', gap: 12, background: 'var(--color-background-secondary)' }}>
                  <span style={{ width: 40, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{value}</span>
                </div>
              ))}
              {/* Editable subject */}
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '0.5px solid var(--color-border-tertiary)', padding: '8px 14px', gap: 12, background: 'var(--color-background-secondary)' }}>
                <span style={{ width: 40, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Subj</span>
                <input
                  type="text"
                  value={draftSubject}
                  onChange={e => setDraftSubject(e.target.value)}
                  onFocus={() => setFocusSubject(true)}
                  onBlur={() => setFocusSubject(false)}
                  style={{ ...inputStyle(focusSubject), padding: '4px 8px', fontSize: 13, flex: 1 }}
                />
              </div>
              {/* Editable body */}
              <textarea
                value={draftBody}
                onChange={e => setDraftBody(e.target.value)}
                onFocus={() => setFocusBody(true)}
                onBlur={() => setFocusBody(false)}
                rows={11}
                style={{
                  ...inputStyle(focusBody),
                  border: 'none',
                  boxShadow: 'none',
                  borderRadius: 0,
                  padding: '14px',
                  fontSize: 13,
                  lineHeight: 1.65,
                  minHeight: 220,
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Dismiss reason (shown below email when needed) */}
            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
                Dismiss reason (required to discard)
              </label>
              <textarea
                value={dismissReason}
                onChange={e => setDismissReason(e.target.value)}
                onFocus={() => setFocusDismiss(true)}
                onBlur={() => setFocusDismiss(false)}
                rows={2}
                placeholder="e.g. Spoke with client by phone today — no email needed"
                style={{ ...inputStyle(focusDismiss), resize: 'vertical', minHeight: 58 }}
              />
            </div>

            {error && <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--color-text-danger)' }}>{error}</p>}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {/* Dismiss — only shown in email view */}
          {view === 'email' ? (
            <button
              onClick={() => {
                if (!dismissReason.trim()) { setError('Reason required to dismiss'); return; }
                if (hasDraft && item.comm_draft_id) {
                  run('dismiss', () => dismissComm({ firm_id: firmId, attorney_id: attorneyId, draft_id: item.comm_draft_id!, reason: dismissReason }));
                } else {
                  onClose();
                }
              }}
              disabled={loading !== null}
              style={{ padding: '8px 16px', fontSize: 14, background: 'transparent', color: 'var(--color-text-danger)', border: '0.5px solid var(--color-border-danger)', borderRadius: 'var(--border-radius-md)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontWeight: 400 }}
            >
              {loading === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 14, background: 'transparent', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', color: 'var(--color-text-primary)', fontWeight: 400 }}>
              Cancel
            </button>
            {view === 'email' && (
              <>
                <button
                  onClick={() => handleMockApprove('approve')}
                  disabled={loading !== null}
                  style={{ padding: '8px 16px', fontSize: 14, fontWeight: 500, background: 'var(--color-action-primary)', color: 'var(--color-action-primary-text)', border: 'none', borderRadius: 'var(--border-radius-md)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
                >
                  {loading === 'approve' ? 'Approving…' : 'Approve draft'}
                </button>
                <button
                  onClick={() => handleMockApprove('queue')}
                  disabled={loading !== null}
                  style={{ padding: '8px 16px', fontSize: 14, fontWeight: 600, background: '#14221F', color: '#D6C181', border: 'none', borderRadius: 'var(--border-radius-md)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
                >
                  {loading === 'queue' ? 'Queuing…' : '✦ Queue to send'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
