import { useEffect, useState } from 'react';
import { T } from '../../tokens';
import { Icon } from '../ui/Icon';
import { ProofBlock } from './ProofBlock';
import {
  type ItemDescriptor,
  GATE_TONE,
  KIND_META,
  buildAuditEvent,
} from './resolveTypes';
import type { ActionResult, InboundMessage } from '../../types';
import {
  confirmDeadline,
  extendDeadline,
  verifyDeadline,
  dismissDeadline,
  approveBilling,
  writeDownBilling,
  writeOffBilling,
  updateNarrative,
  getScrubber,
  dismissAlert,
  approveComm,
  queueComm,
  dismissComm,
  getInbound,
  snoozeInbound,
} from '../../api';

interface Props {
  descriptor: ItemDescriptor;
  firmId: string;
  attorneyId: string;
  onClose: () => void;
  onSuccess: (result: ActionResult, id: string) => void;
}

// Stakes box colors per gate
const STAKES: Record<string, { bg: string; bd: string; iconColor: string; textColor: string }> = {
  ESCALATION: { bg: T.dangerSoft,       bd: 'rgba(155,45,35,.35)',  iconColor: T.danger, textColor: T.danger },
  REVIEW:     { bg: T.wash2,            bd: 'rgba(169,132,53,.25)', iconColor: T.gold,   textColor: T.ink    },
  BLOCKED:    { bg: T.wash2,            bd: T.line,                 iconColor: '#3A4A44', textColor: T.ink   },
};

// Shared label styles
const FIELD_LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: T.ink,
  marginBottom: 6,
};

const INPUT_BASE: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 12px',
  fontSize: 14,
  fontFamily: 'var(--font-sans)',
  color: T.ink,
  background: T.surface,
  borderRadius: 9,
  outline: 'none',
};

const HELP_TEXT: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 12,
  fontStyle: 'italic',
  color: T.faint,
};

export function ResolvePanel({ descriptor, firmId, attorneyId, onClose, onSuccess }: Props) {
  const [activeIdx, setActiveIdx]   = useState(0);
  const [text, setText]             = useState('');
  const [confirmedDate, setDate]    = useState(descriptor.extracted_date ?? '');
  const [classification, setClass]  = useState(descriptor.extracted_class ?? '');
  const [newHours, setHours]        = useState<number | ''>('');
  const [newAmount, setAmount]      = useState<number | ''>('');
  const [reason, setReason]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // E.3d — inbound triage state
  const [inboundMsg, setInboundMsg]   = useState<InboundMessage | null>(null);
  const [replyText, setReplyText]     = useState('');
  const [inboundLoading, setIbLoad]   = useState(false);

  // Fetch full InboundMessage on open (thin descriptor → rich message)
  useEffect(() => {
    if (!descriptor.inbound_message_id) return;
    getInbound(firmId).then(msgs => {
      const msg = msgs.find(m => m.id === descriptor.inbound_message_id) ?? null;
      setInboundMsg(msg);
      setReplyText(msg?.suggested_reply_body ?? '');
    });
  }, [descriptor.inbound_message_id, firmId]);

  const activeAction = descriptor.actions[activeIdx] ?? descriptor.actions[0];
  const tone         = GATE_TONE[descriptor.gate] ?? GATE_TONE.REVIEW;
  const meta         = KIND_META[descriptor.kind] ?? { label: descriptor.kind.toUpperCase(), icon: 'shield' as const };
  const stakes       = STAKES[descriptor.gate] ?? STAKES.REVIEW;
  const ver          = descriptor.version ?? 1;
  const isEscalation = descriptor.gate === 'ESCALATION';
  const isDestructive = activeAction?.destructive === true;
  const auditEvent   = activeAction ? buildAuditEvent(descriptor, activeAction, attorneyId) : null;

  // Reset input state when action changes
  function switchAction(idx: number) {
    setActiveIdx(idx);
    setText('');
    setHours('');
    setAmount('');
    setReason('');
    setError(null);
  }

  // Validation
  function isValid(): boolean {
    if (!activeAction) return false;
    const { type, minLen } = activeAction.need;
    if (type === 'none') return true;
    if (type === 'textarea') return text.trim().length >= (minLen ?? 1);
    if (type === 'date_select') return !!confirmedDate && !!classification;
    if (type === 'date_reason') return !!confirmedDate && text.trim().length >= (minLen ?? 4);
    if (type === 'numeric_reason') {
      const h = Number(newHours);
      const a = Number(newAmount);
      return h > 0 && h < (descriptor.current_hours ?? Infinity) &&
             a > 0 && a < (descriptor.current_amount ?? Infinity) &&
             reason.trim().length >= 4;
    }
    return false;
  }

  // Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Submit
  async function handleSubmit() {
    if (!isValid() || loading || !activeAction) return;
    setLoading(true);
    setError(null);
    const ikey = `${descriptor.id}-${activeAction.event}-${Date.now()}`;

    try {
      let result: ActionResult;

      switch (activeAction.event) {
        // ── Deadline ───────────────────────────────────────────────────
        case 'deadline.confirmed':
          result = await confirmDeadline({
            firm_id: firmId, attorney_id: attorneyId,
            deadline_id: descriptor.id,
            expected_version: ver, idempotency_key: ikey,
          });
          break;

        case 'deadline.extended':
          result = await extendDeadline({
            firm_id: firmId, attorney_id: attorneyId,
            deadline_id: descriptor.id,
            new_due_date: confirmedDate,
            reason: text,
            expected_version: ver, idempotency_key: ikey,
          });
          break;

        case 'deadline.verified':
          // TODO: pass confirmed_date + classification once backend DeadlineVerifyRequest accepts them
          result = await verifyDeadline({
            firm_id: firmId, attorney_id: attorneyId,
            deadline_id: descriptor.id,
            expected_version: ver, idempotency_key: ikey,
          });
          break;

        case 'deadline.dismissed':
          result = await dismissDeadline({
            firm_id: firmId, attorney_id: attorneyId,
            deadline_id: descriptor.id,
            reason: text,
            expected_version: ver, idempotency_key: ikey,
          });
          break;

        // ── Billing ────────────────────────────────────────────────────
        case 'billing.approved': {
          // Re-scrub first when entry was previously BLOCKED — check new narrative text
          // against known block-severity matched_text before persisting
          if (isEscalation) {
            const scrub = await getScrubber(firmId, descriptor.id);
            const stillBlocked = scrub.flags
              .filter(f => f.severity === 'BLOCK')
              .some(f => f.matched_text && text.toLowerCase().includes(f.matched_text.toLowerCase()));
            if (stillBlocked) {
              setError('Narrative still contains flagged language. Remove highlighted phrases to approve.');
              setLoading(false);
              return;
            }
          }
          const upd = await updateNarrative({
            firm_id: firmId, attorney_id: attorneyId,
            entry_id: descriptor.id, narrative: text,
            expected_version: ver, idempotency_key: `${ikey}-narrative`,
          });
          if (!upd.success) {
            setError((upd as { message?: string }).message ?? 'Narrative update failed');
            setLoading(false);
            return;
          }
          result = await approveBilling({
            firm_id: firmId, attorney_id: attorneyId,
            entry_id: descriptor.id,
            expected_version: ver + 1, idempotency_key: ikey,
          });
          break;
        }

        case 'billing.written_off':
          result = await writeOffBilling({
            firm_id: firmId, attorney_id: attorneyId,
            entry_id: descriptor.id, reason: text,
            expected_version: ver, idempotency_key: ikey,
          });
          break;

        case 'billing.written_down':
          result = await writeDownBilling({
            firm_id: firmId, attorney_id: attorneyId,
            entry_id: descriptor.id,
            new_hours: Number(newHours), new_amount: Number(newAmount),
            reason, expected_version: ver, idempotency_key: ikey,
          });
          break;

        // ── Anomaly ────────────────────────────────────────────────────
        case 'anomaly.dismissed':
          result = await dismissAlert({
            firm_id: firmId, attorney_id: attorneyId,
            alert_id: descriptor.id, alert_type: 'anomaly',
            reason: text, idempotency_key: ikey,
          });
          break;

        // ── Budget (local-only) ────────────────────────────────────────
        case 'budget.reviewed':
        case 'budget.increase_requested':
          // BriefBudgetItem has no escalation_id — local-only acknowledgement
          // TODO v1.2: persist via dismissAlert once alert_id surfaces on BriefBudgetItem
          onSuccess({ success: true, entity_id: descriptor.id, entity_type: 'budget', audit_event_id: '', data: null }, descriptor.id);
          return;

        // ── Comms ──────────────────────────────────────────────────────
        case 'comms.approved': {
          const did = descriptor.draft_id;
          if (!did) { setError('No draft available.'); setLoading(false); return; }
          result = await approveComm({
            firm_id: firmId, attorney_id: attorneyId,
            draft_id: did, idempotency_key: ikey,
          });
          if (result.success) {
            await queueComm({ firm_id: firmId, attorney_id: attorneyId, draft_id: did, idempotency_key: `${ikey}-queue` });
          }
          break;
        }

        case 'comms.dismissed': {
          const did = descriptor.draft_id;
          if (did) {
            result = await dismissComm({
              firm_id: firmId, attorney_id: attorneyId,
              draft_id: did, reason: text, idempotency_key: ikey,
            });
          } else {
            // No draft — local-only; TODO v1.2: silence alert endpoint
            onSuccess({ success: true, entity_id: descriptor.id, entity_type: 'silence', audit_event_id: '', data: null }, descriptor.id);
            return;
          }
          break;
        }

        // ── Compound ───────────────────────────────────────────────────
        case 'compound.acknowledged':
          result = await dismissAlert({
            firm_id: firmId, attorney_id: attorneyId,
            alert_id: descriptor.id, alert_type: 'compound',
            reason: 'acknowledged', idempotency_key: ikey,
          });
          break;

        case 'compound.dismissed':
          result = await dismissAlert({
            firm_id: firmId, attorney_id: attorneyId,
            alert_id: descriptor.id, alert_type: 'compound',
            reason: text, idempotency_key: ikey,
          });
          break;

        // ── Inbound ────────────────────────────────────────────────────
        case 'inbound.approved': {
          const did = inboundMsg?.suggested_reply_comm_id;
          if (!did) { setError('No draft available.'); setLoading(false); return; }
          result = await approveComm({ firm_id: firmId, attorney_id: attorneyId, draft_id: did, idempotency_key: ikey });
          if (result.success) await queueComm({ firm_id: firmId, attorney_id: attorneyId, draft_id: did, idempotency_key: `${ikey}-queue` });
          break;
        }

        case 'inbound.snoozed': {
          if (!inboundMsg) { setError('Message not loaded.'); setLoading(false); return; }
          result = await snoozeInbound({ firm_id: firmId, attorney_id: attorneyId, message_id: inboundMsg.id, expected_version: inboundMsg.version, idempotency_key: ikey });
          break;
        }

        default:
          setError(`Unknown action: ${activeAction.event}`);
          setLoading(false);
          return;
      }

      if (result!.success) {
        onSuccess(result!, descriptor.id);
      } else {
        setError((result as { message?: string }).message ?? 'Action failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Input block ────────────────────────────────────────────────────────────
  function renderInput() {
    if (!activeAction || activeAction.need.type === 'none') return null;
    const { type, minLen } = activeAction.need;

    if (type === 'textarea') {
      const isNarrative = activeAction.need.field === 'narrative';
      const reqColor    = isNarrative ? T.gold : T.danger;
      const filled      = text.trim().length > 0;
      return (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>
              {isNarrative ? 'Narrative' : 'Reason'}
            </label>
            <span style={{ fontSize: 12, color: reqColor }}>· required</span>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={isNarrative ? 3 : 2}
            placeholder={isNarrative ? 'Add a billing narrative…' : 'Reason for this action…'}
            style={{
              ...INPUT_BASE,
              border: `1px solid ${filled ? T.teal : T.line}`,
              resize: 'vertical',
              lineHeight: 1.5,
            }}
          />
          <p style={HELP_TEXT}>
            {isNarrative
              ? 'Goes onto the invoice and the LEDES export.'
              : 'Litt never acts silently — this reason is logged to the audit trail forever.'}
          </p>
          {minLen && text.trim().length > 0 && text.trim().length < minLen && (
            <p style={{ ...HELP_TEXT, color: T.danger, fontStyle: 'normal' }}>
              {minLen - text.trim().length} more character{minLen - text.trim().length !== 1 ? 's' : ''} required
            </p>
          )}
        </div>
      );
    }

    if (type === 'date_select') {
      // Verify variant: pre-filled date + classification dropdown
      return (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={FIELD_LABEL}>Confirmed due date</label>
            <input
              type="date"
              value={confirmedDate}
              onChange={e => setDate(e.target.value)}
              style={{ ...INPUT_BASE, border: `1px solid ${confirmedDate ? T.teal : T.line}` }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={FIELD_LABEL}>Classification</label>
            <select
              value={classification}
              onChange={e => setClass(e.target.value)}
              style={{ ...INPUT_BASE, border: `1px solid ${classification ? T.teal : T.line}` }}
            >
              <option value="">Select class…</option>
              <option value="HARD_LEGAL">HARD_LEGAL</option>
              <option value="HARD_CONTRACTUAL">HARD_CONTRACTUAL</option>
              <option value="SOFT_INTERNAL">SOFT_INTERNAL</option>
              <option value="ADMINISTRATIVE">ADMINISTRATIVE</option>
            </select>
          </div>
        </div>
      );
    }

    if (type === 'date_reason') {
      // Extend variant: new date + reason textarea
      const filled = text.trim().length > 0;
      return (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={FIELD_LABEL}>New due date</label>
            <input
              type="date"
              value={confirmedDate}
              onChange={e => setDate(e.target.value)}
              style={{ ...INPUT_BASE, border: `1px solid ${confirmedDate ? T.teal : T.line}` }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>Reason</label>
              <span style={{ fontSize: 12, color: T.danger }}>· required</span>
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={2}
              placeholder="Reason for extension…"
              style={{
                ...INPUT_BASE,
                border: `1px solid ${filled ? T.teal : T.line}`,
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
            <p style={HELP_TEXT}>
              Litt never acts silently — this reason is logged to the audit trail forever.
            </p>
          </div>
        </div>
      );
    }

    if (type === 'numeric_reason') {
      const hFilled = newHours !== '' && Number(newHours) > 0;
      const aFilled = newAmount !== '' && Number(newAmount) > 0;
      return (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={FIELD_LABEL}>
                New hours{descriptor.current_hours != null && (
                  <span style={{ fontWeight: 400, color: T.faint }}> (was {descriptor.current_hours})</span>
                )}
              </label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                max={descriptor.current_hours != null ? descriptor.current_hours - 0.1 : undefined}
                value={newHours}
                onChange={e => setHours(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ ...INPUT_BASE, border: `1px solid ${hFilled ? T.teal : T.line}` }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={FIELD_LABEL}>
                New amount ($){descriptor.current_amount != null && (
                  <span style={{ fontWeight: 400, color: T.faint }}> (was ${descriptor.current_amount.toLocaleString()})</span>
                )}
              </label>
              <input
                type="number"
                min={1}
                max={descriptor.current_amount != null ? descriptor.current_amount - 1 : undefined}
                value={newAmount}
                onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ ...INPUT_BASE, border: `1px solid ${aFilled ? T.teal : T.line}` }}
              />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>Reason</label>
              <span style={{ fontSize: 12, color: T.danger }}>· required</span>
            </div>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="Reason for write-down…"
              style={{
                ...INPUT_BASE,
                border: `1px solid ${reason.trim().length >= 4 ? T.teal : T.line}`,
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
            <p style={HELP_TEXT}>
              Litt never acts silently — this reason is logged to the audit trail forever.
            </p>
          </div>
        </div>
      );
    }

    return null;
  }

  const btnEnabled = isValid() && !loading;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(28,30,26,.46)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* Card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.surface,
          borderRadius: 16,
          border: `1px solid ${T.line}`,
          width: descriptor.kind === 'inbound' ? 'min(680px, 96vw)' : 'min(580px, 96vw)',
          maxHeight: '92vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '18px 20px 16px',
          borderBottom: `1px solid ${T.line}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {/* Gate-tinted icon tile */}
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: tone.bg,
              border: `1px solid ${tone.bd}`,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}>
              <Icon name={meta.icon} size={15} color={tone.fg} />
            </div>

            <span style={{
              flex: 1,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.08em',
              color: T.faint,
            }}>
              {meta.label}
            </span>

            {descriptor.client_name && (
              <span style={{ fontSize: 13, color: T.muted }}>{descriptor.client_name}</span>
            )}

            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                display: 'flex',
                alignItems: 'center',
                marginLeft: 4,
                flexShrink: 0,
              }}
            >
              <Icon name="x" size={16} color={T.faint} />
            </button>
          </div>

          <h2 style={{
            margin: '0 0 4px',
            fontSize: 20,
            fontWeight: 600,
            color: T.ink,
            lineHeight: 1.25,
          }}>
            {descriptor.headline}
          </h2>

          {descriptor.plain && (
            <p style={{ margin: 0, fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
              {descriptor.plain}
            </p>
          )}
        </div>

        {/* ── Scroll body ── */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>

          {/* Stakes notice */}
          {descriptor.stakes && (
            <div style={{
              background: stakes.bg,
              border: `1px solid ${stakes.bd}`,
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 16,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}>
              <Icon name="alert" size={14} color={stakes.iconColor} style={{ marginTop: 1, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 13, color: stakes.textColor, lineHeight: 1.5 }}>
                {descriptor.stakes}
              </p>
            </div>
          )}

          {/* E.3e — Compound signal list + synthesis (only when signals populated) */}
          {descriptor.compound_signals && descriptor.compound_signals.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {/* Contributing signals list */}
              <div style={{ marginBottom: 12 }}>
                {descriptor.compound_signals.map((sig, i) => (
                  <div
                    key={sig.escalation_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 0',
                      borderBottom: i < descriptor.compound_signals!.length - 1 ? `1px solid ${T.line}` : 'none',
                    }}
                  >
                    <Icon name={sig.icon} size={12} color={T.muted} />
                    <span style={{ fontSize: 14, color: T.ink }}>{sig.label}</span>
                  </div>
                ))}
              </div>
              {/* Synthesis paragraph */}
              {descriptor.compound_synthesis && (
                <div style={{
                  background: T.wash2,
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 0,
                }}>
                  <p style={{
                    margin: '0 0 6px',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: T.faint,
                  }}>
                    Why this compounds
                  </p>
                  <p style={{
                    margin: 0,
                    fontSize: 13,
                    fontStyle: 'italic',
                    color: T.muted,
                    lineHeight: 1.7,
                  }}>
                    {descriptor.compound_synthesis}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Draft preview (silence/comms) */}
          {descriptor.draft && (
            <div style={{
              borderLeft: `2px solid ${T.tealSoft}`,
              paddingLeft: 12,
              marginBottom: 16,
            }}>
              <p style={{
                margin: '0 0 6px',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: T.teal,
              }}>
                Drafted by Litt · Awaiting you
              </p>
              <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic', color: T.muted, lineHeight: 1.6 }}>
                {descriptor.draft}
              </p>
            </div>
          )}

          {/* Scrubber BLOCK callout (E.3c) */}
          {isEscalation && descriptor.scrubber_flags && descriptor.scrubber_flags.length > 0 && (
            <div style={{
              background: T.dangerSoft,
              border: `1px solid ${T.danger}`,
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 16,
            }}>
              <p style={{
                margin: '0 0 6px',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: T.danger,
              }}>
                Scrubber block
              </p>
              {descriptor.scrubber_flags.map((f, i) => (
                <p key={i} style={{ margin: i > 0 ? '6px 0 0' : '0', fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    color: T.danger,
                    fontWeight: 700,
                  }}>
                    "{f.matched_text}"
                  </span>
                  <span style={{ color: T.muted }}> — {f.message}</span>
                </p>
              ))}
            </div>
          )}

          {/* E.3d — Inbound triage body (replaces action selector + input) */}
          {descriptor.kind === 'inbound' && (
            <div>
              {inboundLoading || !inboundMsg ? (
                <p style={{ fontSize: 13, color: T.faint, fontStyle: 'italic' }}>
                  Loading message…
                </p>
              ) : (
                <>
                  {/* 1. Message block */}
                  <div style={{
                    borderLeft: `2px solid ${T.tealSoft}`,
                    paddingLeft: 12,
                    marginBottom: 16,
                  }}>
                    <p style={{
                      margin: '0 0 6px',
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: T.faint,
                    }}>
                      from Gmail · read-only
                    </p>
                    <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic', color: T.muted, lineHeight: 1.6 }}>
                      {inboundMsg.message_excerpt}
                    </p>
                  </div>

                  {/* 2. Triage grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    {/* Left: What they need */}
                    <div>
                      <p style={{
                        margin: '0 0 8px',
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: T.faint,
                      }}>
                        What they need
                      </p>
                      {inboundMsg.summary && (
                        <p style={{ margin: '0 0 10px', fontSize: 14, color: T.ink, lineHeight: 1.5 }}>
                          {inboundMsg.summary}
                        </p>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {inboundMsg.urgency_signals.map((sig, i) => (
                          <span
                            key={i}
                            style={{
                              background: T.soft,
                              borderRadius: 4,
                              padding: '1px 7px',
                              fontSize: 11,
                              fontFamily: 'var(--font-mono)',
                              color: T.muted,
                            }}
                          >
                            {sig}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right: Action items */}
                    <div>
                      <p style={{
                        margin: '0 0 8px',
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: T.faint,
                      }}>
                        Action items
                      </p>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {inboundMsg.action_items.map((item, i) => (
                          <li key={i} style={{ fontSize: 13, color: T.ink, lineHeight: 1.55, marginBottom: 6 }}>
                            {item.text}
                            {item.handoff_agent && (
                              <span style={{
                                display: 'inline-block',
                                marginLeft: 8,
                                padding: '1px 7px',
                                fontSize: 11,
                                fontFamily: 'var(--font-mono)',
                                color: T.teal,
                                border: `1px solid ${T.teal}`,
                                borderRadius: 4,
                              }}>
                                → {item.handoff_agent}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {inboundMsg.cross_agent && (
                        <span style={{
                          display: 'inline-block',
                          marginTop: 8,
                          padding: '1px 7px',
                          fontSize: 11,
                          fontFamily: 'var(--font-mono)',
                          color: T.gold,
                          background: T.soft,
                          borderRadius: 4,
                        }}>
                          Handed off
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3. Suggested reply card */}
                  <div style={{
                    background: T.wash2,
                    border: `1px solid ${T.line}`,
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 0,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <p style={{
                        margin: 0,
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: T.faint,
                        flex: 1,
                      }}>
                        Suggested reply
                      </p>
                      <span style={{
                        background: T.soft,
                        borderRadius: 4,
                        padding: '1px 7px',
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        color: T.teal,
                      }}>
                        Gemini
                      </span>
                    </div>
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      rows={4}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 12px',
                        fontSize: 13,
                        fontFamily: 'var(--font-sans)',
                        color: T.ink,
                        background: T.surface,
                        border: `1px solid ${replyText !== (inboundMsg.suggested_reply_body ?? '') ? T.teal : T.line}`,
                        borderRadius: 9,
                        resize: 'vertical',
                        outline: 'none',
                        lineHeight: 1.5,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Action selector (only when 2+ actions) */}
          {descriptor.actions.length > 1 && descriptor.kind !== 'inbound' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {descriptor.actions.map((action, idx) => {
                const active = idx === activeIdx;
                return (
                  <div
                    key={action.event}
                    onClick={() => switchAction(idx)}
                    role="radio"
                    aria-checked={active}
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') switchAction(idx); }}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: `1px solid ${active ? T.brass : T.line}`,
                      background: active ? T.forest : T.surface,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      userSelect: 'none',
                    }}
                  >
                    <div style={{
                      width: 15,
                      height: 15,
                      borderRadius: '50%',
                      flexShrink: 0,
                      border: `2px solid ${active ? T.brass : T.line}`,
                      background: active ? T.brass : 'transparent',
                    }} />
                    <span style={{
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      color: active ? T.brass : T.muted,
                      lineHeight: 1.3,
                    }}>
                      {action.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Required input block (hidden for inbound — uses custom sections above) */}
          {descriptor.kind !== 'inbound' && renderInput()}

          {/* Proof block */}
          <div style={{ marginBottom: 16 }}>
            <ProofBlock proof={descriptor.proof} />
          </div>

          {/* Audit log preview */}
          {auditEvent && (
            <div style={{
              background: T.audit,
              borderRadius: 10,
              padding: '12px 14px',
              border: '1px solid rgba(158,225,199,.12)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon name="shield" size={13} color={T.auditAccent} />
                <span style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: T.auditMuted,
                }}>
                  Will be written to the audit log
                </span>
              </div>
              <p style={{
                margin: '0 0 4px',
                fontSize: 14,
                fontFamily: 'var(--font-mono)',
                color: T.brass,
              }}>
                {auditEvent.event}
              </p>
              <p style={{
                margin: 0,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: T.auditMuted,
              }}>
                actor={auditEvent.actor} · entity={auditEvent.entity} · tier={auditEvent.tier}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p style={{ margin: '12px 0 0', fontSize: 13, color: T.danger }}>
              {error}
            </p>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '14px 20px',
          borderTop: `1px solid ${T.line}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px',
              fontSize: 14,
              background: 'transparent',
              border: `1px solid ${T.line}`,
              borderRadius: 8,
              cursor: 'pointer',
              color: T.muted,
            }}
          >
            Cancel
          </button>

          {descriptor.kind === 'inbound' ? (
            // ── Inbound footer ──
            <>
              <button
                onClick={() => {
                  if (!inboundMsg) return;
                  setLoading(true); setError(null);
                  const ikey = `${descriptor.id}-inbound.snoozed-${Date.now()}`;
                  snoozeInbound({ firm_id: firmId, attorney_id: attorneyId, message_id: inboundMsg.id, expected_version: inboundMsg.version, idempotency_key: ikey })
                    .then(r => r.success ? onSuccess(r, descriptor.id) : setError((r as { message?: string }).message ?? 'Snooze failed'))
                    .catch(e => setError(e instanceof Error ? e.message : 'Request failed'))
                    .finally(() => setLoading(false));
                }}
                disabled={loading || !inboundMsg}
                style={{
                  padding: '9px 18px',
                  fontSize: 14,
                  background: 'transparent',
                  border: `1px solid ${T.line}`,
                  borderRadius: 8,
                  cursor: loading || !inboundMsg ? 'not-allowed' : 'pointer',
                  opacity: loading || !inboundMsg ? 0.45 : 1,
                  color: T.muted,
                }}
              >
                Snooze
              </button>

              {/* Hand off — TODO v1.2 */}
              <button
                disabled
                title="Hand off — coming in v1.2"
                style={{
                  padding: '9px 18px',
                  fontSize: 14,
                  background: 'transparent',
                  border: `1px solid ${T.line}`,
                  borderRadius: 8,
                  cursor: 'not-allowed',
                  opacity: 0.35,
                  color: T.muted,
                }}
              >
                Hand off
              </button>

              <button
                onClick={() => {
                  const did = inboundMsg?.suggested_reply_comm_id;
                  if (!did || loading) return;
                  setLoading(true); setError(null);
                  const ikey = `${descriptor.id}-inbound.approved-${Date.now()}`;
                  approveComm({ firm_id: firmId, attorney_id: attorneyId, draft_id: did, idempotency_key: ikey })
                    .then(r => {
                      if (r.success) return queueComm({ firm_id: firmId, attorney_id: attorneyId, draft_id: did, idempotency_key: `${ikey}-queue` });
                      return r;
                    })
                    .then(r => r.success ? onSuccess(r, descriptor.id) : setError((r as { message?: string }).message ?? 'Failed'))
                    .catch(e => setError(e instanceof Error ? e.message : 'Request failed'))
                    .finally(() => setLoading(false));
                }}
                disabled={loading || !inboundMsg?.suggested_reply_comm_id}
                style={{
                  padding: '9px 18px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 8,
                  cursor: loading || !inboundMsg?.suggested_reply_comm_id ? 'not-allowed' : 'pointer',
                  opacity: loading || !inboundMsg?.suggested_reply_comm_id ? 0.45 : 1,
                  background: T.forest,
                  color: T.brass,
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {!loading && <Icon name="check" size={13} color="inherit" />}
                {loading ? 'Saving…' : 'Approve & send'}
              </button>
            </>
          ) : (
            // ── Standard footer ──
            descriptor.actions.length > 0 && activeAction && (
              <button
                onClick={handleSubmit}
                disabled={!btnEnabled}
                style={{
                  padding: '9px 18px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 8,
                  cursor: btnEnabled ? 'pointer' : 'not-allowed',
                  opacity: btnEnabled ? 1 : 0.45,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  ...(isDestructive
                    ? { background: T.dangerSoft, color: T.danger, border: `1px solid ${T.danger}` }
                    : { background: T.forest, color: T.brass, border: 'none' }),
                }}
              >
                {!loading && btnEnabled && <Icon name="check" size={13} color="inherit" />}
                {loading ? 'Saving…' : activeAction.label}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
