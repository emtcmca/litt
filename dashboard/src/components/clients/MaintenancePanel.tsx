import { useEffect, useRef, useState } from 'react';
import { T } from '../../tokens';
import { Icon } from '../ui/Icon';
import { Mono } from '../ui/Mono';
import {
  getMaintenance,
  reviewClient,
  setCadence,
  applySuggestion,
  dismissSuggestion,
} from '../../api';
import type { AppliedUpdate, ClientMaintenanceState, SuggestedUpdate } from '../../types';

// ── Kind maps (co-located per spec) ──────────────────────────────────────────

const MX_KIND_TONE: Record<string, string> = {
  deadline: T.danger,
  contact:  T.teal,
  budget:   T.gold,
  matter:   T.muted,
};

const MX_KIND_ICON: Record<string, string> = {
  deadline: 'shield',
  contact:  'users',
  budget:   'chart-bar',
  matter:   'book-open',
};

function kindTone(kind: string) { return MX_KIND_TONE[kind] ?? T.muted; }
function kindIcon(kind: string) { return MX_KIND_ICON[kind] ?? 'circle'; }

// ── Confidence pill ───────────────────────────────────────────────────────────

function confTone(conf: number): { fg: string; bg: string } {
  if (conf >= 0.85) return { fg: T.teal,   bg: 'rgba(29,158,117,.10)' };
  if (conf >= 0.70) return { fg: T.gold,   bg: 'rgba(169,132,53,.10)' };
  return               { fg: T.danger, bg: 'rgba(155,45,35,.10)' };
}

// ── Pulse animation (keyframe injected once) ──────────────────────────────────

let pulseInjected = false;
function ensurePulse() {
  if (pulseInjected) return;
  pulseInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes litt-pulse {
      0%,100% { opacity:1; transform:scale(1); }
      50%      { opacity:.4; transform:scale(.75); }
    }
    @keyframes cm-flash {
      from { opacity:1; max-height:200px; }
      to   { opacity:0; max-height:0; padding:0; overflow:hidden; }
    }
  `;
  document.head.appendChild(s);
}

// ── Cadence ───────────────────────────────────────────────────────────────────

const CADENCES: { key: string; label: string }[] = [
  { key: 'hourly',  label: 'Hourly'    },
  { key: 'daily',   label: 'Daily'     },
  { key: 'events',  label: 'On events' },
];

// ── SuggestionCard ────────────────────────────────────────────────────────────

type SuggestionState = 'idle' | 'dismiss-input' | 'applied' | 'dismissed';

function SuggestionCard({
  s,
  clientId,
  firmId,
  onDone,
}: {
  s: SuggestedUpdate;
  clientId: string;
  firmId: string;
  onDone: () => void;
}) {
  const [state, setState] = useState<SuggestionState>('idle');
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);
  const [dismissedReason, setDismissedReason] = useState('');

  async function doApply() {
    setWorking(true);
    await applySuggestion(clientId, s.id, firmId);
    setState('applied');
    setWorking(false);
    setTimeout(onDone, 1200);
  }

  async function doConfirmDismiss() {
    if (reason.trim().length < 4) return;
    setWorking(true);
    await dismissSuggestion(clientId, s.id, reason, firmId);
    setDismissedReason(reason.trim());
    setState('dismissed');
    setWorking(false);
    setTimeout(onDone, 1200);
  }

  const conf = s.confidence;
  const ct   = confTone(conf);

  if (state === 'applied') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', background: 'rgba(29,158,117,.06)',
        borderRadius: 12, border: `1px solid ${T.line}`,
        color: T.teal, fontSize: 12,
      }}>
        <Icon name="check-circle" size={14} color={T.teal} />
        <Mono style={{ fontSize: 11 }}>Applied &amp; written to the ledger</Mono>
      </div>
    );
  }

  if (state === 'dismissed') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', borderRadius: 12, border: `1px solid ${T.line}`,
        color: T.muted, fontSize: 12,
      }}>
        <Mono style={{ fontSize: 11, textDecoration: 'line-through', color: T.muted }}>
          Dismissed · &ldquo;{dismissedReason}&rdquo;
        </Mono>
      </div>
    );
  }

  return (
    <div style={{
      background: T.surface,
      borderLeft: `3px solid ${T.gold}`,
      borderRadius: 12,
      overflow: 'hidden',
      border: `1px solid ${T.line}`,
    }}>
      {/* Body */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, lineHeight: 1.35 }}>{s.title}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: ct.fg, background: ct.bg,
            borderRadius: 999, padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {conf.toFixed(2)}
          </span>
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 5, lineHeight: 1.45 }}>{s.detail}</div>
        {/* Source chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <Mono style={{ fontSize: 10, fontWeight: 600, color: T.gold }}>{s.source}</Mono>
          <Mono style={{ fontSize: 10, color: T.faint }}>{s.source_ref}</Mono>
        </div>
      </div>

      {/* Footer — normal or dismiss-input */}
      {state === 'idle' && (
        <div style={{
          background: T.wash2, borderTop: `1px solid ${T.line}`,
          padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <button
            onClick={doApply}
            disabled={working}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: T.forest, color: T.brass, border: 'none',
              borderRadius: 10, padding: '5px 12px', fontSize: 11.5, fontWeight: 600,
              cursor: 'pointer', opacity: working ? 0.6 : 1,
            }}
          >
            <Icon name="check" size={11} color={T.brass} />
            Apply &amp; log
          </button>
          <button
            onClick={() => setState('dismiss-input')}
            disabled={working}
            style={{
              background: 'transparent', border: 'none', color: T.muted,
              fontSize: 11.5, cursor: 'pointer', padding: '5px 8px',
            }}
          >
            Dismiss
          </button>
          <Mono style={{ fontSize: 9.5, color: T.faint, marginLeft: 'auto' }}>
            held · Litt won&apos;t apply judgment calls silently
          </Mono>
        </div>
      )}

      {state === 'dismiss-input' && (
        <div style={{
          background: T.wash2, borderTop: `1px solid ${T.line}`,
          padding: '10px 16px',
        }}>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for dismissal…"
            style={{
              width: '100%', minHeight: 52, resize: 'vertical',
              border: `1px solid ${T.line}`, borderLeft: `3px solid ${T.gold}`,
              borderRadius: 6, padding: '7px 10px', fontSize: 12,
              color: T.ink, background: T.surface, boxSizing: 'border-box',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <button
              onClick={() => { setState('idle'); setReason(''); }}
              style={{
                background: 'transparent', border: 'none',
                color: T.muted, fontSize: 11.5, cursor: 'pointer', padding: '4px 8px',
              }}
            >
              Cancel
            </button>
            <button
              onClick={doConfirmDismiss}
              disabled={reason.trim().length < 4 || working}
              style={{
                background: T.dangerSoft, color: T.danger,
                border: `1px solid ${T.danger}`, borderRadius: 8,
                padding: '5px 12px', fontSize: 11.5, fontWeight: 600,
                cursor: reason.trim().length >= 4 ? 'pointer' : 'not-allowed',
                opacity: reason.trim().length < 4 ? 0.5 : 1,
              }}
            >
              Dismiss with reason
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AppliedRow ────────────────────────────────────────────────────────────────

function fmtAppliedWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = typeof iso === 'string' ? new Date(iso) : (iso as Date);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  } catch { return ''; }
}

function AppliedRow({ a, onAuditClick }: { a: AppliedUpdate; onAuditClick?: (id: string) => void }) {
  const tone = kindTone(a.kind);
  const icon = kindIcon(a.kind);
  const workLabel = a.work === 'deterministic' ? 'deterministic' : `gemini · ${(a.confidence ?? 0).toFixed(2)}`;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 10,
        padding: '9px 4px',
        borderBottom: `1px solid ${T.soft}`,
        alignItems: 'flex-start',
        cursor: onAuditClick ? 'pointer' : 'default',
      }}
      onClick={() => onAuditClick && onAuditClick(a.audit_event_id)}
    >
      {/* Kind icon tile */}
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        background: `${tone}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={13} color={tone} />
      </div>

      {/* Content */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Mono style={{ fontSize: 10.5, fontWeight: 600, color: tone }}>{a.field_label}</Mono>
          <Mono style={{ fontSize: 10, color: T.faint }}>{fmtAppliedWhen(a.applied_at as string)}</Mono>
        </div>
        <div style={{ fontSize: 12.5, color: T.ink, marginTop: 2, lineHeight: 1.4 }}>{a.change}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Mono style={{ fontSize: 10, fontWeight: 600, color: T.gold }}>{a.source}</Mono>
          <Mono style={{ fontSize: 10, color: T.faint }}>{a.source_ref}</Mono>
          <Mono style={{ fontSize: 10, color: T.faint }}>{workLabel}</Mono>
        </div>
      </div>

      {/* Logged marker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, paddingTop: 2 }}>
        <Icon name="check" size={11} color={T.teal} />
        <Mono style={{ fontSize: 9.5, color: T.teal }}>logged</Mono>
      </div>
    </div>
  );
}

// ── MaintenancePanel ──────────────────────────────────────────────────────────

export function MaintenancePanel({ clientId, firmId, refreshTrigger }: { clientId: string; firmId: string; refreshTrigger?: number }) {
  ensurePulse();

  const [state, setState] = useState<ClientMaintenanceState | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [cadenceWorking, setCadenceWorking] = useState(false);
  const narrow = typeof window !== 'undefined' && window.innerWidth < 900;
  const [isNarrow, setIsNarrow] = useState(narrow);
  const resizeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const handler = () => setIsNarrow(window.innerWidth < 900);
    resizeRef.current = handler;
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  async function loadState() {
    const s = await getMaintenance(firmId, clientId);
    setState(s);
  }

  useEffect(() => { loadState(); }, [clientId, firmId, refreshTrigger]);

  async function handleReview() {
    setReviewing(true);
    const s = await reviewClient(firmId, clientId);
    setState(s);
    setReviewing(false);
  }

  async function handleCadence(key: string) {
    if (!state || cadenceWorking) return;
    setCadenceWorking(true);
    await setCadence(clientId, key, firmId);
    await loadState();
    setCadenceWorking(false);
  }

  if (!state) {
    return (
      <section style={{
        border: `1px solid ${T.line}`, borderRadius: 16, overflow: 'hidden',
        background: T.audit, minHeight: 80,
        display: 'grid', placeItems: 'center',
      }}>
        <Mono style={{ fontSize: 11, color: T.auditMuted }}>Loading maintenance…</Mono>
      </section>
    );
  }

  const held = state.suggested.filter(s => s.status === 'held');

  const activeCadence = state.cadence;

  return (
    <section style={{ border: `1px solid ${T.line}`, borderRadius: 16, overflow: 'hidden' }}>

      {/* ── Dark header ──────────────────────────────────────────────────── */}
      <div style={{
        background: T.audit, padding: '15px 20px',
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
      }}>
        {/* Icon tile */}
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: 'rgba(158,225,199,.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="refresh-cw" size={14} color={T.auditAccent} />
        </div>

        {/* Title block */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#EFEBDB' }}>
              Litt is keeping this file current
            </span>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: T.auditAccent, flexShrink: 0,
              animation: 'litt-pulse 2s ease-in-out infinite',
            }} />
          </div>
          <Mono style={{ fontSize: 10.5, color: T.auditMuted, marginTop: 2 }}>
            Reviewed {state.last_reviewed_label} · {state.reviews_today} sweeps today · watching {state.watched_signal_count} signals · next {state.next_sweep_label}
          </Mono>
        </div>

        {/* Cadence segmented control */}
        <div style={{
          display: 'flex', borderRadius: 8, padding: 3,
          background: 'rgba(0,0,0,.28)', gap: 2,
        }}>
          {CADENCES.map(c => {
            const active = activeCadence === c.key;
            return (
              <button
                key={c.key}
                onClick={() => handleCadence(c.key)}
                disabled={cadenceWorking}
                style={{
                  background: active ? T.brass : 'transparent',
                  color: active ? T.forest : T.auditMuted,
                  border: 'none', borderRadius: 6, padding: '4px 10px',
                  fontSize: 11, fontWeight: active ? 600 : 400,
                  cursor: cadenceWorking ? 'wait' : 'pointer',
                  transition: 'background .15s, color .15s',
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Review now button */}
        <button
          onClick={handleReview}
          disabled={reviewing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent',
            border: `1px solid ${T.brass}`,
            color: reviewing ? T.auditMuted : T.brass,
            borderRadius: 8, padding: '5px 13px',
            fontSize: 11.5, fontWeight: 500,
            cursor: reviewing ? 'wait' : 'pointer',
          }}
        >
          {reviewing
            ? <><Icon name="loader" size={12} color={T.auditMuted} /> Reviewing…</>
            : <><Icon name="refresh-cw" size={12} color={T.brass} /> Review now</>
          }
        </button>
      </div>

      {/* ── Two-tier body ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr',
        minHeight: 220,
      }}>

        {/* Left — Held for your review */}
        <div style={{
          background: T.surface,
          padding: '15px 18px',
          borderRight: isNarrow ? 'none' : `1px solid ${T.line}`,
          borderBottom: isNarrow ? `1px solid ${T.line}` : 'none',
        }}>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.gold }} />
            <Mono style={{ fontSize: 10, fontWeight: 600, color: T.muted, letterSpacing: '.06em' }}>
              HELD FOR YOUR REVIEW
            </Mono>
            {held.length > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: T.gold,
                background: 'rgba(169,132,53,.12)', borderRadius: 999,
                padding: '1px 7px',
              }}>
                {held.length}
              </span>
            )}
          </div>

          {/* Cards */}
          {held.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(29,158,117,.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="check" size={16} color={T.teal} />
              </div>
              <span style={{ fontSize: 12, color: T.muted, textAlign: 'center' }}>
                Nothing needs your judgment — file is current.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {held.map(s => (
                <SuggestionCard
                  key={s.id}
                  s={s}
                  clientId={clientId}
                  firmId={firmId}
                  onDone={loadState}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right — Applied automatically */}
        <div style={{ background: T.wash2, padding: '15px 18px' }}>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.teal }} />
            <Mono style={{ fontSize: 10, fontWeight: 600, color: T.muted, letterSpacing: '.06em' }}>
              APPLIED AUTOMATICALLY
            </Mono>
            <Mono style={{ fontSize: 10, color: T.faint, marginLeft: 'auto' }}>
              safe · already logged
            </Mono>
          </div>

          {/* Rows */}
          {state.applied.length === 0 ? (
            <Mono style={{ fontSize: 11, color: T.faint }}>No automatic changes yet.</Mono>
          ) : (
            <div>
              {state.applied.map(a => (
                <AppliedRow key={a.id} a={a} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer contract line ──────────────────────────────────────────── */}
      <div style={{
        background: T.surface,
        borderTop: `1px solid ${T.line}`,
        padding: '10px 20px',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <Icon name="lock" size={14} color={T.faint} />
        <Mono style={{ fontSize: 10, color: T.faint }}>
          Two tiers, one rule: factual updates apply &amp; log; anything needing judgment is held. Every change — applied or held — is on the audit ledger.
        </Mono>
      </div>
    </section>
  );
}
