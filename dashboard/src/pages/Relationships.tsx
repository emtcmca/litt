import { useCallback, useEffect, useState } from 'react';
import type { BriefClientSilenceItem, BriefResponse, InboundMessage, RelationshipMatter } from '../types';
import { approveComm, getBrief, getInbound, getRelationships, dismissInbound, snoozeInbound } from '../api';

const FIRM_ID     = 'strand-okafor';
const ATTORNEY_ID = 'dana-strand';

// ─── Urgency badge ────────────────────────────────────────────────────────────

function UrgencyBadge({ level }: { level: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    HIGH:   { color: '#9B2D23', bg: 'rgba(155,45,35,.1)', border: 'rgba(155,45,35,.3)' },
    MEDIUM: { color: '#A98435', bg: 'rgba(169,132,53,.08)', border: 'rgba(169,132,53,.3)' },
    LOW:    { color: '#5C6B64', bg: 'rgba(92,107,100,.06)', border: 'rgba(92,107,100,.2)' },
  };
  const m = map[level] ?? map.LOW;
  return (
    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: m.color, background: m.bg, border: `1px solid ${m.border}`, borderRadius: 3, padding: '2px 5px' }}>
      {level}
    </span>
  );
}

// ─── InboundCard ─────────────────────────────────────────────────────────────

function InboundCard({
  msg,
  onActioned,
}: {
  msg: InboundMessage;
  onActioned: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy]         = useState<string | null>(null);
  const [err, setErr]           = useState<string | null>(null);

  const hasDraft    = !!msg.suggested_reply_body;
  const commId      = msg.suggested_reply_comm_id;
  const borderColor = msg.urgency === 'HIGH' ? '#9B2D23' : msg.urgency === 'MEDIUM' ? '#A98435' : 'var(--color-border-tertiary)';

  async function act(action: 'approve' | 'snooze' | 'dismiss') {
    setBusy(action);
    setErr(null);
    try {
      if (action === 'approve' && commId) {
        await approveComm({ firm_id: FIRM_ID, attorney_id: ATTORNEY_ID, draft_id: commId, idempotency_key: `approve-comm-${commId}-${Date.now()}` });
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

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: `1px solid ${borderColor}`,
      borderLeft: msg.urgency !== 'LOW' ? `3px solid ${borderColor}` : '1px solid var(--color-border-tertiary)',
      borderRadius: 8, overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          cursor: 'pointer', padding: '12px 16px',
          display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 10, alignItems: 'start',
        }}
      >
        <UrgencyBadge level={msg.urgency} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {msg.from_name}
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginLeft: 8 }}>{msg.from_role}</span>
            {msg.matter_id && <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>{msg.matter_id}</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.3 }}>
            {msg.summary || msg.message_excerpt.slice(0, 120)}
          </div>
          {msg.urgency_signals.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
              {msg.urgency_signals.map((sig, i) => (
                <span key={i} style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', background: 'var(--color-background-tertiary)', borderRadius: 3, padding: '1px 5px' }}>
                  {sig}
                </span>
              ))}
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', marginTop: 2 }}>
          {msg.wait_days}d wait
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--color-border-tertiary)' }}>
          {/* Action items */}
          {msg.action_items.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
                Action items
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {msg.action_items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    <span>•</span>
                    <span>{item.text}</span>
                    {item.handoff_agent && (
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#1D9E75', background: 'rgba(29,158,117,.06)', border: '1px solid rgba(29,158,117,.2)', borderRadius: 3, padding: '1px 5px' }}>
                        → {item.handoff_agent}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested reply */}
          {hasDraft && (
            <div style={{ marginTop: 10, background: '#14221F', border: '1px solid rgba(158,225,199,.12)', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(158,225,199,.5)', marginBottom: 6 }}>
                Suggested reply (Gemini) — held for approval
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {msg.suggested_reply_body}
              </div>
            </div>
          )}

          {/* Action bar */}
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {hasDraft && commId && (
              <button
                onClick={() => act('approve')}
                disabled={!!busy}
                style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#1D9E75', background: 'rgba(29,158,117,.06)', border: '1px solid rgba(29,158,117,.3)', borderRadius: 4, padding: '4px 10px', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy === 'approve' ? 'Approving…' : 'Approve & send'}
              </button>
            )}
            <button
              onClick={() => act('snooze')}
              disabled={!!busy}
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#A98435', background: 'rgba(169,132,53,.06)', border: '1px solid rgba(169,132,53,.25)', borderRadius: 4, padding: '4px 10px', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy === 'snooze' ? 'Snoozing…' : 'Snooze'}
            </button>
            <button
              onClick={() => act('dismiss')}
              disabled={!!busy}
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#5C6B64', background: 'rgba(92,107,100,.05)', border: '1px solid rgba(92,107,100,.2)', borderRadius: 4, padding: '4px 10px', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
            </button>
            {err && <span style={{ fontSize: 11, color: '#9B2D23' }}>{err}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SilenceBar ───────────────────────────────────────────────────────────────

function SilenceBar({ days, threshold }: { days: number; threshold: number }) {
  const pct   = Math.min(100, (days / (threshold * 1.5)) * 100);
  const color = days >= threshold ? '#9B2D23' : days >= threshold * 0.75 ? '#A98435' : '#1D9E75';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--color-background-tertiary)', borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>{days}d</span>
    </div>
  );
}

// ─── RelationshipRow ──────────────────────────────────────────────────────────

function RelationshipRow({ matter }: { matter: RelationshipMatter }) {
  const days = matter.days_since_contact ?? 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, padding: '12px 16px', borderBottom: '1px solid var(--color-border-tertiary)', alignItems: 'center', background: matter.going_quiet ? 'rgba(155,45,35,.03)' : 'transparent' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{matter.matter_name || matter.matter_id}</div>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginTop: 2 }}>{matter.client_name}</div>
      </div>
      <div>
        {matter.days_since_contact != null
          ? <SilenceBar days={days} threshold={matter.silence_threshold_days} />
          : <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>no contact recorded</span>}
      </div>
      <div>
        {matter.going_quiet
          ? <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9B2D23', background: 'rgba(155,45,35,.08)', border: '1px solid rgba(155,45,35,.3)', borderRadius: 3, padding: '2px 6px' }}>going quiet</span>
          : <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#1D9E75', background: 'rgba(29,158,117,.06)', border: '1px solid rgba(29,158,117,.25)', borderRadius: 3, padding: '2px 6px' }}>active</span>}
      </div>
    </div>
  );
}

// ─── GoingQuietRow (from brief.client_silence) ────────────────────────────────

function GoingQuietRow({ item }: { item: BriefClientSilenceItem }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--color-border-tertiary)', gap: 16 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.matter_name}</div>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginTop: 2 }}>{item.client_name}</div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#9B2D23' }}>{item.days_since_contact}d since last contact</span>
        {item.comm_draft_id && (
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#1D9E75', background: 'rgba(29,158,117,.06)', border: '1px solid rgba(29,158,117,.2)', borderRadius: 3, padding: '2px 6px' }}>draft ready</span>
        )}
      </div>
    </div>
  );
}

// ─── Relationships page ───────────────────────────────────────────────────────

export function Relationships() {
  const [inbound, setInbound]   = useState<InboundMessage[] | null>(null);
  const [brief, setBrief]       = useState<BriefResponse | null>(null);
  const [matters, setMatters]   = useState<RelationshipMatter[] | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [inboundData, briefData, mattersData] = await Promise.all([
        getInbound(FIRM_ID),
        getBrief(FIRM_ID),
        getRelationships(FIRM_ID),
      ]);
      setInbound(inboundData);
      setBrief(briefData);
      setMatters(mattersData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load relationships');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!inbound && !error) {
    return <div style={{ padding: '28px 32px' }}><div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Loading…</div></div>;
  }
  if (error) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div style={{ fontSize: 13, color: '#9B2D23', marginBottom: 8 }}>{error}</div>
        <button onClick={load} style={{ fontSize: 12, color: '#1D9E75', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
      </div>
    );
  }

  const allInbound = (inbound ?? []).filter(m => !actionedIds.has(m.id));
  const awaitingTriage = allInbound.filter(m => m.status === 'AWAITING_TRIAGE');
  const silenceItems = brief?.sections.client_silence.items ?? [];
  const allMatters   = matters ?? [];
  const goingQuiet   = allMatters.filter(m => m.going_quiet);

  function handleActioned(id: string) {
    setActionedIds(prev => new Set([...prev, id]));
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
        Relationships
      </div>
      <h1 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        Clients & Comms
      </h1>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Awaiting response', value: awaitingTriage.length, color: awaitingTriage.length > 0 ? '#9B2D23' : 'var(--color-text-secondary)' },
          { label: 'Going quiet',       value: silenceItems.length,   color: silenceItems.length > 0 ? '#A98435' : 'var(--color-text-secondary)' },
          { label: 'Active matters',    value: allMatters.length,      color: '#1D9E75' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ① Awaiting response */}
      {awaitingTriage.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9B2D23', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            Awaiting your response
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'rgba(155,45,35,.1)', border: '1px solid rgba(155,45,35,.25)', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>
              {awaitingTriage.length}
            </span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {awaitingTriage.map(msg => (
              <InboundCard key={msg.id} msg={msg} onActioned={handleActioned} />
            ))}
          </div>
        </section>
      )}

      {/* ② Going quiet (from brief.client_silence) */}
      {silenceItems.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#A98435', marginBottom: 8 }}>Going quiet</div>
          <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 10, overflow: 'hidden' }}>
            {silenceItems.map((item, i) => <GoingQuietRow key={i} item={item} />)}
          </div>
        </section>
      )}

      {/* ③ Relationship board */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>Relationship board</div>
        <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--color-border-tertiary)', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16 }}>
            {['Matter', 'Days since contact', 'Status'].map(h => (
              <div key={h} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>{h}</div>
            ))}
          </div>
          {allMatters.length === 0
            ? <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}>No active matters found.</div>
            : allMatters.map(m => <RelationshipRow key={m.matter_id} matter={m} />)}
        </div>
      </section>

      {/* ④ How Litt handles comms */}
      <div style={{ background: '#14221F', border: '1px solid rgba(158,225,199,.12)', borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(158,225,199,.5)', marginBottom: 12 }}>
          How Litt handles your comms
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { step: 'Read',  desc: 'Monitors silence thresholds and inbound messages' },
            { step: 'Draft', desc: 'Generates client-appropriate drafts via Gemini 2.5 Pro' },
            { step: 'Hold',  desc: 'Holds all drafts for attorney approval — Litt never sends' },
          ].map(s => (
            <div key={s.step} style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9FE1CB', marginBottom: 4 }}>{s.step}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', lineHeight: 1.4 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
