import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { InboundMessage, RelationshipMatter } from '../types';
import { T } from '../tokens';
import { Icon } from '../components/ui/Icon';
import { ClientsSubnav } from '../components/clients/ClientsSubnav';
import { approveComm, dismissInbound, getInbound, getRelationships, snoozeInbound } from '../api';
import commitmentsRaw from '../demo-fixtures/commitments.json';

const FIRM_ID     = 'strand-okafor';
const ATTORNEY_ID = 'dana-strand';
const THRESH = 14;
const SCALE  = 21;

// ── Local commitment type (TODO v1.2: replace with GET /api/commitments) ─────
interface Commitment {
  id: string;
  quote: string;
  client: string;
  matter: string;
  captured: string;
  due: string;
  daysOut: number;
  status: 'pending' | 'tracked' | 'due-soon' | 'kept' | 'slipped';
  onBook?: boolean;
  closedNote?: string;
}

const COMMITMENTS: Commitment[] = commitmentsRaw as Commitment[];

// ── Demo-specific Whitmore draft (mirrors prototype exactly) ─────────────────
const WHITMORE_DRAFT = 'Hi — quick check-in on your employment advisory matter. We\'re monitoring the items we discussed and there\'s nothing requiring action from you this week. I\'ll send a fuller update once the policy review wraps. As always, reach out anytime. — Dana';
const WHITMORE_GROUNDING = [
  { claim: '"the policy review wraps"', src: 'matter record', detail: 'task: policy review · in progress' },
  { claim: '"nothing requiring action"', src: 'open items', detail: '0 items awaiting client' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function urgencyColor(u: string) {
  if (u === 'HIGH') return T.danger;
  if (u === 'MEDIUM') return T.gold;
  return T.faint;
}

function warmth(days: number) {
  if (days > THRESH) return { key: 'silent', label: 'silent', color: T.gold };
  if (days > 7)      return { key: 'quiet',  label: 'quiet',  color: T.faint };
  return                    { key: 'warm',   label: 'warm',   color: T.teal };
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function fmtRole(role: string) {
  if (role === 'client') return 'Client';
  if (role === 'billing_contact') return 'Billing';
  if (role === 'opposing_counsel') return 'Opposing counsel';
  return role;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ── InboundCard (expanded first card, collapsed others) ───────────────────────
function InboundCard({ msg, expanded, onToggle, onActioned }: {
  msg: InboundMessage;
  expanded: boolean;
  onToggle: () => void;
  onActioned: (id: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr]   = useState<string | null>(null);
  const tone    = urgencyColor(msg.urgency);
  const hasDraft = !!msg.suggested_reply_body;
  const commId   = msg.suggested_reply_comm_id;

  async function act(action: 'approve' | 'snooze' | 'dismiss') {
    setBusy(action);
    setErr(null);
    try {
      if (action === 'approve' && commId) {
        await approveComm({ firm_id: FIRM_ID, attorney_id: ATTORNEY_ID, draft_id: commId, idempotency_key: `approve-${commId}-${Date.now()}` });
      } else if (action === 'snooze') {
        await snoozeInbound({ firm_id: FIRM_ID, attorney_id: ATTORNEY_ID, message_id: msg.id, expected_version: msg.version, idempotency_key: `snooze-${msg.id}-${Date.now()}` });
      } else if (action === 'dismiss') {
        await dismissInbound({ firm_id: FIRM_ID, attorney_id: ATTORNEY_ID, message_id: msg.id, expected_version: msg.version, idempotency_key: `dismiss-${msg.id}-${Date.now()}` });
      }
      onActioned(msg.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  if (!expanded) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 13, padding: '13px 16px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center', cursor: 'pointer' }} onClick={onToggle}>
        <span style={{ width: 34, height: 34, borderRadius: 999, background: T.wash2, border: `1px solid ${T.line}`, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: T.muted, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{initials(msg.from_name)}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{msg.from_name}</span>
            <span style={{ fontSize: 10.5, color: T.faint, fontFamily: 'var(--font-mono)' }}>{msg.client_id} · {msg.matter_id}</span>
            {msg.cross_agent && (
              <span style={{ fontSize: 9.5, fontWeight: 600, color: T.gold, background: 'rgba(169,132,53,.12)', border: '1px solid rgba(169,132,53,.33)', borderRadius: 5, padding: '1px 6px', fontFamily: 'var(--font-mono)' }}>→ Billing</span>
            )}
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: T.muted, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: '1', WebkitBoxOrient: 'vertical' } as React.CSSProperties}>{msg.summary}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' as const }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: tone, textTransform: 'uppercase' as const, letterSpacing: '.04em', display: 'block', fontFamily: 'var(--font-mono)' }}>{msg.urgency}</span>
            {hasDraft && <span style={{ fontSize: 10, color: T.teal, fontFamily: 'var(--font-mono)' }}>reply ready</span>}
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T.forest, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' as const }}>
            Review <Icon name="chevron" size={12} color={T.forest} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <section style={{ background: T.surface, border: `1px solid ${tone}40`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ width: 4, background: tone, flexShrink: 0 }} />
        <div style={{ flex: 1, padding: '17px 20px', minWidth: 0 }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
            <span style={{ width: 38, height: 38, borderRadius: 999, background: T.wash2, border: `1px solid ${T.line}`, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: T.muted, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{initials(msg.from_name)}</span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{msg.from_name} <span style={{ fontSize: 12, fontWeight: 400, color: T.faint }}>· {fmtRole(msg.from_role)}</span></div>
              <span style={{ fontSize: 11, color: T.muted, fontFamily: 'var(--font-mono)', display: 'block' }}>{msg.client_id} · {msg.matter_id} · {fmtDate(msg.received_at)}</span>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 999, background: `${tone}12`, border: `1px solid ${tone}38` }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: tone }} />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: tone, fontFamily: 'var(--font-mono)' }}>{msg.urgency} · awaiting {msg.wait_days}d</span>
            </span>
          </div>

          {/* original message */}
          <div style={{ marginTop: 13, borderLeft: `2px solid ${T.line}`, paddingLeft: 12 }}>
            <span style={{ fontSize: 9.5, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.faint, fontFamily: 'var(--font-mono)' }}>The message · read-only</span>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: T.muted, lineHeight: 1.55, fontStyle: 'italic' }}>"{msg.message_excerpt}"</p>
          </div>

          {/* triage grid */}
          <div style={{ marginTop: 15, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <span style={{ fontSize: 9.5, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.faint, display: 'block', marginBottom: 5, fontFamily: 'var(--font-mono)' }}>What they need</span>
              <p style={{ margin: 0, fontSize: 13, color: T.ink, lineHeight: 1.5 }}>{msg.summary}</p>
              <span style={{ fontSize: 9.5, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.faint, display: 'block', margin: '12px 0 6px', fontFamily: 'var(--font-mono)' }}>Why it surfaced</span>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                {msg.urgency_signals.map(s => (
                  <span key={s} style={{ fontSize: 10, color: T.muted, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 5, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>{s}</span>
                ))}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 9.5, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.faint, display: 'block', marginBottom: 7, fontFamily: 'var(--font-mono)' }}>Action items</span>
              <div style={{ display: 'grid', gap: 7 }}>
                {msg.action_items.map(a => (
                  <div key={a.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${T.faint}`, flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.4 }}>
                      {a.text}
                      {a.handoff_agent && (
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: T.danger, background: 'rgba(155,45,35,.08)', border: '1px solid rgba(155,45,35,.24)', borderRadius: 5, padding: '1px 6px', marginLeft: 6, whiteSpace: 'nowrap' as const, fontFamily: 'var(--font-mono)' }}>→ {a.handoff_agent}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* suggested reply */}
          {hasDraft && (
            <div style={{ marginTop: 15, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' as const }}>
                <Icon name="mail" size={13} color={T.teal} />
                <span style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.09em', color: T.faint, fontFamily: 'var(--font-mono)' }}>Suggested reply · drafted by Litt · held</span>
                <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 600, color: T.teal, border: '1px solid rgba(29,158,117,.4)', borderRadius: 5, padding: '1px 6px', fontFamily: 'var(--font-mono)' }}>Gemini · 0.95</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: T.ink, fontStyle: 'italic' }}>{msg.suggested_reply_body}</p>
            </div>
          )}

          {/* actions */}
          <div style={{ marginTop: 14, display: 'flex', gap: 9, flexWrap: 'wrap' as const, alignItems: 'center' }}>
            {hasDraft && commId && (
              <button onClick={() => act('approve')} disabled={!!busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: T.forest, color: T.brass, fontSize: 13.5, fontWeight: 600, padding: '11px 18px', borderRadius: 10, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'var(--font-sans)' }}>
                {busy === 'approve' ? 'Approving…' : <><span>Approve & send</span><Icon name="arrow" size={14} color={T.brass} /></>}
              </button>
            )}
            {(['Edit', 'Snooze', 'Hand off'] as const).map(b => (
              <button key={b} onClick={b === 'Snooze' ? () => act('snooze') : undefined} disabled={!!busy} style={{ background: 'transparent', color: T.muted, fontSize: 13, fontWeight: 600, padding: '10px 15px', borderRadius: 10, border: `1px solid ${T.line}`, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>{b}</button>
            ))}
            {err && <span style={{ fontSize: 11, color: T.danger }}>{err}</span>}
            <span style={{ fontSize: 10.5, color: T.faint, marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>Litt never sends — approval queues it for your signature.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── CommitmentCard ────────────────────────────────────────────────────────────
const CM_STATUS: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pending send', color: '#8A8578' },
  tracked:  { label: 'Tracked',      color: T.teal },
  'due-soon': { label: 'Due soon',   color: T.gold },
  kept:     { label: 'Kept',         color: T.teal },
  slipped:  { label: 'Slipped',      color: T.danger },
};

function StageRail({ status, captured }: { status: string; captured: string }) {
  const closed     = status === 'kept' || status === 'slipped';
  const trackedDone = status !== 'pending';
  const outcome    = status === 'slipped' ? { label: 'Slipped', color: T.danger }
                   : status === 'kept'    ? { label: 'Kept', color: T.teal }
                   :                        { label: 'Outcome', color: T.faint };
  const nodes = [
    { label: `Captured ${captured}`, color: T.teal,                           done: true },
    { label: 'Tracked',              color: trackedDone ? T.teal : T.faint,   done: trackedDone },
    { label: outcome.label,          color: closed ? outcome.color : T.faint, done: closed },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {nodes.map((n, i) => (
        <Fragment key={i}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: n.done ? n.color : 'transparent', border: `1.5px solid ${n.done ? n.color : T.line}`, flexShrink: 0 }} />
            <span style={{ fontSize: 9.5, color: n.done ? T.muted : T.faint, whiteSpace: 'nowrap' as const, fontFamily: 'var(--font-mono)' }}>{n.label}</span>
          </span>
          {i < 2 && <span style={{ width: 20, height: 1.5, background: nodes[i + 1].done ? nodes[i + 1].color : T.soft, margin: '0 8px', flexShrink: 0 }} />}
        </Fragment>
      ))}
    </div>
  );
}

function CommitmentCard({ c, onMark, flashed }: { c: Commitment; onMark: (id: string, status: 'kept' | 'slipped') => void; flashed: boolean }) {
  const sm      = CM_STATUS[c.status] ?? CM_STATUS.tracked;
  const closed  = c.status === 'kept' || c.status === 'slipped';
  const pending = c.status === 'pending';
  const dueSoon = c.status === 'due-soon';

  return (
    <div style={{ border: `1px solid ${closed ? T.soft : sm.color + '40'}`, borderLeft: `3px solid ${dueSoon ? T.gold : closed ? sm.color : 'transparent'}`, borderRadius: 12, padding: '13px 15px', background: closed ? T.wash2 : T.surface, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: closed ? T.muted : T.ink, lineHeight: 1.45, fontStyle: 'italic' }}>"{c.quote}"</div>
          <span style={{ fontSize: 10.5, color: T.faint, marginTop: 3, display: 'block', fontFamily: 'var(--font-mono)' }}>{c.client} · {c.matter}</span>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: `${sm.color}14`, border: `1px solid ${sm.color}40`, flexShrink: 0 }}>
          {c.status === 'kept' && <Icon name="check" size={10} color={sm.color} stroke={2.6} />}
          {dueSoon && <span className="litt-pulse" style={{ width: 6, height: 6, borderRadius: 999, background: sm.color }} />}
          <span style={{ fontSize: 10.5, fontWeight: 600, color: sm.color, fontFamily: 'var(--font-mono)' }}>{sm.label}</span>
        </span>
      </div>
      <StageRail status={c.status} captured={c.captured} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, paddingTop: 9, borderTop: `1px solid ${T.soft}` }}>
        {closed ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Icon name={c.status === 'kept' ? 'check' : 'alert'} size={12} color={sm.color} stroke={c.status === 'kept' ? 2.6 : 1.8} />
            <span style={{ fontSize: 11.5, color: c.status === 'kept' ? T.muted : T.danger, fontFamily: 'var(--font-mono)' }}>{c.closedNote}</span>
          </span>
        ) : (
          <>
            <span style={{ fontSize: 11.5, color: T.muted, fontFamily: 'var(--font-mono)' }}>Due {c.due.replace(', 2026', '')}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: dueSoon ? T.gold : T.faint, fontFamily: 'var(--font-mono)' }}>{c.daysOut <= 0 ? 'today' : c.daysOut + 'd'}</span>
            <span style={{ color: T.faint, fontSize: 10 }}>·</span>
            {c.onBook
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={11} color={T.teal} stroke={2.4} /><span style={{ fontSize: 10.5, fontWeight: 600, color: T.teal, fontFamily: 'var(--font-mono)' }}>on the deadline book</span></span>
              : pending
                ? <span style={{ fontSize: 10.5, color: T.faint, fontFamily: 'var(--font-mono)' }}>tracks once you send</span>
                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="refresh" size={11} color={T.gold} /><span style={{ fontSize: 10.5, fontWeight: 600, color: T.gold, fontFamily: 'var(--font-mono)' }}>→ Deadline Monitor</span></span>}
            {!pending && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
                <button onClick={() => onMark(c.id, 'kept')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: `1px solid ${T.forest}`, background: T.forest, color: T.brass, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}><Icon name="check" size={11} color={T.brass} stroke={2.6} />Mark kept</button>
                <button onClick={() => onMark(c.id, 'slipped')} style={{ padding: '6px 11px', borderRadius: 8, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Slipped</button>
              </div>
            )}
          </>
        )}
      </div>
      {flashed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: T.audit, borderRadius: 8, padding: '7px 11px' }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: T.auditAccent, boxShadow: `0 0 6px ${T.auditAccent}` }} />
          <span style={{ fontSize: 10.5, color: '#E6E2D2', fontFamily: 'var(--font-mono)' }}>commitment.{c.status} written to the audit ledger</span>
          <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 600, color: T.auditAccent, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>view →</span>
        </div>
      )}
    </div>
  );
}

// ── CommitmentTracker section ─────────────────────────────────────────────────
function CommitmentTracker() {
  // TODO v1.2: replace with GET /api/commitments
  const [overrides, setOverrides] = useState<Record<string, Partial<Commitment>>>({});
  const [flash, setFlash]         = useState<string | null>(null);

  const items = COMMITMENTS.map(c => ({ ...c, ...(overrides[c.id] ?? {}) }));

  function mark(id: string, status: 'kept' | 'slipped') {
    setOverrides(o => ({ ...o, [id]: { status, daysOut: 0, onBook: false, closedNote: status === 'kept' ? 'Fulfilled today' : 'Marked slipped today' } }));
    setFlash(id);
    setTimeout(() => setFlash(f => f === id ? null : f), 3200);
  }

  const isActive = (c: Commitment) => c.status === 'pending' || c.status === 'tracked' || c.status === 'due-soon';
  const active = items.filter(c => isActive(c));
  const closed = items.filter(c => !isActive(c));

  const stats: [string, number, string][] = [
    ['Active',   active.length, T.teal],
    ['Due soon', items.filter(c => c.status === 'due-soon').length, T.gold],
    ['Kept',     items.filter(c => c.status === 'kept').length,     T.forest],
    ['Slipped',  items.filter(c => c.status === 'slipped').length,  T.danger],
  ];

  return (
    <>
      {/* section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 6 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: `${T.teal}14`, border: `1px solid ${T.teal}33`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="shield" size={15} color={T.teal} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', color: T.ink }}>Commitments you've made</h2>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.teal, background: `${T.teal}14`, border: `1px solid ${T.teal}40`, borderRadius: 999, padding: '1px 8px', fontFamily: 'var(--font-mono)' }}>{active.length} active</span>
          </div>
          <span style={{ fontSize: 12.5, color: T.muted }}>Promises Litt caught in your sent replies — watched as soft deadlines from capture to kept.</span>
        </div>
      </div>

      <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '14px 18px', display: 'flex', gap: 22, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        {stats.map(([k, v, c]) => (
          <div key={k} style={{ minWidth: 78 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: c }} />
              <span style={{ fontSize: 21, fontWeight: 700, color: T.ink, lineHeight: '1' }}>{v}</span>
            </div>
            <span style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: T.faint, display: 'block', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{k}</span>
          </div>
        ))}
        <div style={{ flex: 1, minWidth: 220, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 9, padding: '9px 12px' }}>
          <Icon name="shield" size={14} color={T.gold} />
          <span style={{ fontSize: 11, color: T.muted, lineHeight: 1.4, fontFamily: 'var(--font-mono)' }}>Litt holds you to your word the way it holds clients to theirs. Each is quoted from a message you sent — never invented. Marking an outcome writes to the ledger.</span>
        </div>
      </section>

      <div style={{ display: 'grid', gap: 10 }}>
        {active.map(c => <CommitmentCard key={c.id} c={c} onMark={mark} flashed={flash === c.id} />)}
      </div>

      {closed.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          <span style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.09em', color: T.faint, marginTop: 2, fontFamily: 'var(--font-mono)' }}>Closed this period · {closed.length}</span>
          {closed.map(c => <CommitmentCard key={c.id} c={c} onMark={mark} flashed={flash === c.id} />)}
        </div>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function Relationships() {
  const [inbound,  setInbound]  = useState<InboundMessage[] | null>(null);
  const [matters,  setMatters]  = useState<RelationshipMatter[] | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [removed,  setRemoved]  = useState<Set<string>>(new Set());
  const [expandId, setExpandId] = useState<string | null>(null);
  const hasFetched = useRef(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const [inbData, relData] = await Promise.all([getInbound(FIRM_ID), getRelationships(FIRM_ID)]);
      setInbound(inbData);
      setMatters(relData);
      const first = inbData.find(m => m.urgency === 'HIGH');
      if (first) setExpandId(first.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    load();
  }, [load]);

  if (!inbound && !error) return <div style={{ padding: '28px 32px', fontSize: 13, color: T.muted }}>Loading…</div>;
  if (error) return <div style={{ padding: '28px 32px', fontSize: 13, color: T.danger }}>{error}</div>;

  const visible  = (inbound ?? []).filter(m => !removed.has(m.id));
  const rows     = [...(matters ?? [])].sort((a, b) => (b.days_since_contact ?? 0) - (a.days_since_contact ?? 0));
  const silent   = rows.filter(r => (r.days_since_contact ?? 0) > THRESH);
  const warm     = rows.filter(r => (r.days_since_contact ?? 0) <= 7);
  const hero     = silent[0] ?? null;

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 18 }}>

        {/* sub-nav */}
        <div style={{ justifySelf: 'start' }}>
          <ClientsSubnav />
        </div>

        {/* header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Clients & comms</h1>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.teal, background: T.tealSoft, border: '1px solid rgba(29,158,117,.28)', borderRadius: 5, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>relationships</span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '70ch' }}>
            Litt watches your inbox and your matters. It surfaces the client messages that need a reply — summarizing each, pulling out the action items, and drafting what you'd send — and it flags the relationships going quiet. Reading is read-only; every draft is held for your signature.
          </p>
        </div>

        {/* summary strip */}
        <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '15px 20px', display: 'flex', gap: 22, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          {([
            ['Awaiting your reply', visible.length, T.danger, 'inbound · needs you'],
            ['Going quiet', silent.length, T.gold, `past ${THRESH}d silent`],
            ['Warm', warm.length, T.teal, '≤ 7 days'],
          ] as [string, number, string, string][]).map(([k, v, c, s]) => (
            <div key={k} style={{ minWidth: 118 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: c }} />
                <span style={{ fontSize: 22, fontWeight: 700, color: T.ink, lineHeight: '1' }}>{v}</span>
              </div>
              <span style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: T.faint, display: 'block', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{k}</span>
              <span style={{ fontSize: 10, color: T.faint, fontFamily: 'var(--font-mono)' }}>{s}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 9, padding: '8px 12px' }}>
            <Icon name="lock" size={13} color={T.gold} />
            <span style={{ fontSize: 11, color: T.muted, fontFamily: 'var(--font-mono)' }}>Read-only inbox · Litt drafts · you send</span>
          </div>
        </section>

        {/* ── Section 1: Awaiting your response ───────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 6 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: `${T.danger}14`, border: `1px solid ${T.danger}33`, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="mail" size={15} color={T.danger} /></span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', color: T.ink }}>Awaiting your response</h2>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.danger, background: `${T.danger}14`, border: `1px solid ${T.danger}40`, borderRadius: 999, padding: '1px 8px', fontFamily: 'var(--font-mono)' }}>{visible.length} messages</span>
            </div>
            <span style={{ fontSize: 12.5, color: T.muted }}>Important client emails sitting in your inbox — triaged, with a reply ready to review.</span>
          </div>
        </div>

        {visible.map(m => (
          <InboundCard
            key={m.id}
            msg={m}
            expanded={expandId === m.id}
            onToggle={() => setExpandId(id => id === m.id ? null : m.id)}
            onActioned={id => setRemoved(s => { const n = new Set(s); n.add(id); return n; })}
          />
        ))}

        {/* ── Section 2: Commitments ───────────────────────────────── */}
        <CommitmentTracker />

        {/* ── Section 3: Going quiet ───────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 6 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: `${T.gold}14`, border: `1px solid ${T.gold}33`, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="clock" size={15} color={T.gold} /></span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', color: T.ink }}>Going quiet</h2>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.gold, background: `${T.gold}14`, border: `1px solid ${T.gold}40`, borderRadius: 999, padding: '1px 8px', fontFamily: 'var(--font-mono)' }}>{silent.length} matter</span>
            </div>
            <span style={{ fontSize: 12.5, color: T.muted }}>Relationships drifting past your contact threshold — with a check-in drafted.</span>
          </div>
        </div>

        {hero && (
          <section style={{ background: T.surface, border: '1px solid rgba(169,132,53,.34)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              <div style={{ width: 4, background: T.gold, flexShrink: 0 }} />
              <div style={{ flex: 1, padding: '18px 22px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' as const }}>
                  <div style={{ textAlign: 'center' as const, minWidth: 76, padding: '7px 12px', borderRadius: 12, background: 'rgba(169,132,53,.1)', border: '1px solid rgba(169,132,53,.24)' }}>
                    <div style={{ fontSize: 30, fontWeight: 700, color: T.gold, lineHeight: '1' }}>{hero.days_since_contact}</div>
                    <span style={{ fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: T.gold, marginTop: 2, display: 'block', fontFamily: 'var(--font-mono)' }}>days silent</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span className="litt-pulse" style={{ width: 7, height: 7, borderRadius: 999, background: T.gold }} />
                      <span style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.1em', color: T.gold, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>No contact in {hero.days_since_contact} days · a draft is ready</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: T.ink, letterSpacing: '-.01em' }}>
                      <Link to={`/clients/${hero.client_id}`} style={{ color: T.ink, textDecoration: 'none' }}>{hero.client_name}</Link>
                    </div>
                    <span style={{ fontSize: 11.5, color: T.muted, fontFamily: 'var(--font-mono)', display: 'block' }}>{hero.matter_name} · last contact {hero.last_client_contact} · threshold {THRESH}d</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 6 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase' as const, color: T.teal, border: '1px solid rgba(29,158,117,.4)', borderRadius: 5, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>Gemini draft</span>
                    <span style={{ fontSize: 10.5, color: T.faint, fontFamily: 'var(--font-mono)' }}>confidence 0.94</span>
                  </div>
                </div>

                <div style={{ marginTop: 16, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 12, padding: '15px 17px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Icon name="mail" size={13} color={T.gold} />
                    <span style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.09em', color: T.faint, fontFamily: 'var(--font-mono)' }}>Drafted by Litt · every fact cited · awaiting your signature</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: T.ink, fontStyle: 'italic' }}>{WHITMORE_DRAFT}</p>
                  <div style={{ marginTop: 13, paddingTop: 12, borderTop: `1px solid ${T.soft}`, display: 'grid', gap: 7 }}>
                    <span style={{ fontSize: 9.5, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.faint, fontFamily: 'var(--font-mono)' }}>Where each claim comes from</span>
                    {WHITMORE_GROUNDING.map(gd => (
                      <div key={gd.claim} style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' as const }}>
                        <Icon name="check" size={12} color={T.teal} stroke={2.4} />
                        <span style={{ fontSize: 12.5, color: T.ink }}>{gd.claim}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: T.gold, background: 'rgba(169,132,53,.1)', border: '1px solid rgba(169,132,53,.26)', borderRadius: 5, padding: '1px 6px', fontFamily: 'var(--font-mono)' }}>{gd.src}</span>
                        <span style={{ fontSize: 10.5, color: T.faint, fontFamily: 'var(--font-mono)' }}>{gd.detail}</span>
                      </div>
                    ))}
                    <span style={{ fontSize: 10.5, color: T.faint, lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>Any sentence Litt can't ground becomes an <span style={{ color: T.muted }}>[ATTORNEY]</span> placeholder — never an invented fact.</span>
                  </div>
                </div>

                <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                  <button onClick={() => navigate('/brief')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: T.forest, color: T.brass, fontSize: 13.5, fontWeight: 600, padding: '11px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    Review & approve in closeout <Icon name="arrow" size={14} color={T.brass} />
                  </button>
                  <button style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', color: T.muted, fontSize: 13.5, fontWeight: 600, padding: '11px 16px', borderRadius: 10, border: `1px solid ${T.line}`, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    Dismiss with a reason
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* relationship board */}
        <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.soft}`, background: T.wash2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '.09em', color: T.muted, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>Every relationship · time since last contact</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 18, height: 2, background: T.gold, display: 'inline-block' }} />
              <span style={{ fontSize: 10, color: T.faint, fontFamily: 'var(--font-mono)' }}>{THRESH}d threshold</span>
            </div>
          </div>
          {rows.map((r, i) => {
            const days = r.days_since_contact ?? 0;
            const w    = warmth(days);
            const pct  = Math.min(100, (days / SCALE) * 100);
            const next = w.key === 'silent' ? 'Send the held draft' : w.key === 'quiet' ? 'Touch base this week' : 'On track';
            const last = r.last_client_contact ?? 'no record';
            return (
              <div key={r.matter_id} style={{ display: 'grid', gridTemplateColumns: '210px 1fr 132px', gap: 16, alignItems: 'center', padding: '13px 18px', borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${T.soft}`, borderLeft: `3px solid ${w.key === 'silent' ? T.gold : 'transparent'}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                    <Link to={`/clients/${r.client_id}`} style={{ color: T.ink, textDecoration: 'none' }}>{r.client_name}</Link>
                  </div>
                  <span style={{ fontSize: 10.5, color: T.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, display: 'block', fontFamily: 'var(--font-mono)' }}>{r.matter_name}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ position: 'relative', height: 8, borderRadius: 999, background: T.wash2 }}>
                    <div style={{ position: 'absolute', left: `${(THRESH / SCALE) * 100}%`, top: -3, bottom: -3, width: 2, background: T.gold, borderRadius: 2, opacity: .6 }} />
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: w.color, borderRadius: 999, transition: 'width .3s' }} />
                  </div>
                  <span style={{ fontSize: 10, color: T.faint, marginTop: 5, display: 'block', fontFamily: 'var(--font-mono)' }}>last contact {last} · {next}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: `${w.color}14`, border: `1px solid ${w.color}40` }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: w.color }} />
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: w.color, fontFamily: 'var(--font-mono)' }}>{w.label}</span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: w.color, minWidth: 30, textAlign: 'right' as const }}>{days}d</span>
                </div>
              </div>
            );
          })}
        </section>

        {/* how Litt handles comms */}
        <section style={{ background: T.audit, borderRadius: 14, padding: '16px 18px', display: 'grid', gap: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="mail" size={14} color={T.auditAccent} />
            <span style={{ fontSize: 10.5, textTransform: 'uppercase' as const, letterSpacing: '.09em', color: T.auditMuted, fontFamily: 'var(--font-mono)' }}>How Litt handles your comms</span>
          </div>
          {([
            ['Read', '#9DA89A', 'Watches your inbox (read-only) and your matters. Scores urgency and silence deterministically — no model.'],
            ['Draft', T.auditAccent, 'Gemini summarizes each message and drafts a reply or check-in. Every fact must cite a record.'],
            ['Hold', T.brass, 'Drafts wait behind your signature. Litt prepares the words — it never sends.'],
          ] as [string, string, string][]).map(([k, c, d], i) => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 11, alignItems: 'start' }}>
              <div style={{ display: 'grid', justifyItems: 'center', gap: 2 }}>
                <span style={{ width: 20, height: 20, borderRadius: 999, border: `1.5px solid ${c}`, color: c, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{i + 1}</span>
                {i < 2 && <span style={{ width: 1, height: 14, background: 'rgba(214,193,129,.2)' }} />}
              </div>
              <div style={{ paddingTop: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#EFEBDB' }}>{k}</div>
                <span style={{ fontSize: 11.5, color: T.auditMuted, lineHeight: 1.45 }}>{d}</span>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, paddingTop: 4 }}>
            {['comms_agent', 'gmail: read-only', 'gemini-2.5-pro', 'approval_gate: on'].map(t => (
              <span key={t} style={{ fontSize: 9.5, color: T.auditAccent, background: 'rgba(158,225,199,.08)', border: '1px solid rgba(158,225,199,.2)', borderRadius: 5, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>{t}</span>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
