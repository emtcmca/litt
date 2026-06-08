import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { T } from '../tokens';
import { Icon } from '../components/ui/Icon';
import { Mono } from '../components/ui/Mono';
import { BudgetBar, budgetTone } from '../components/clients/BudgetBar';
import { MaintenancePanel } from '../components/clients/MaintenancePanel';
import { ResolvePanel } from '../components/console/ResolvePanel';
import {
  buildDeadlineDescriptor,
  buildBillingDescriptor,
  buildBudgetDescriptor,
  buildSilenceDescriptor,
  buildAnomalyDescriptor,
} from '../components/console/buildDescriptor';
import type { ItemDescriptor } from '../components/console/resolveTypes';
import { GATE_TONE, KIND_META } from '../components/console/resolveTypes';
import {
  getClients,
  getDeadlinesFull,
  getBrief,
  getInbound,
  getAuditLog,
  reviewClient,
} from '../api';
import type {
  ActionResult,
  AuditLogEvent,
  BriefResponse,
  ClientListItem,
  InboundMessage,
  RawDeadline,
} from '../types';

const FIRM_ID = 'strand-okafor';
const ATTORNEY_ID = 'dana-strand';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
  } catch { return iso.slice(0, 10); }
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  } catch { return ''; }
}

// ── Section header ────────────────────────────────────────────────────────────

function Sec({ label, count }: { label: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <Mono style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: T.muted }}>
        {label}
      </Mono>
      {count != null && count > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 700, color: T.danger,
          background: T.dangerSoft, border: '1px solid rgba(155,45,35,.22)',
          borderRadius: 999, padding: '1px 7px',
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ── AttnCard ──────────────────────────────────────────────────────────────────

function AttnCard({
  descriptor,
  resolved,
  onResolve,
}: {
  descriptor: ItemDescriptor;
  resolved: boolean;
  onResolve: (d: ItemDescriptor) => void;
}) {
  const meta = KIND_META[descriptor.kind] ?? KIND_META.deadline;
  const tone = GATE_TONE[descriptor.gate] ?? GATE_TONE.REVIEW;
  const isEscalation = descriptor.gate === 'ESCALATION';

  if (resolved) {
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr auto',
        gap: 12, padding: '13px 16px', borderRadius: 11,
        background: T.wash2, border: `1px solid ${T.soft}`,
        borderLeft: `3px solid ${T.teal}`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: T.tealSoft, display: 'grid', placeItems: 'center',
        }}>
          <Icon name="check" size={14} color={T.teal} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.muted }}>{descriptor.headline}</div>
          <Mono style={{ fontSize: 10, color: T.faint, marginTop: 2 }}>{meta.label}</Mono>
        </div>
        <Mono style={{ fontSize: 10, color: T.teal, alignSelf: 'center' }}>resolved</Mono>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'auto 1fr auto',
      gap: 12, padding: '13px 16px', borderRadius: 11,
      background: T.surface, border: `1px solid ${T.line}`,
      borderLeft: `3px solid ${tone.fg}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: tone.bg, display: 'grid', placeItems: 'center',
      }}>
        <Icon name={meta.icon} size={14} color={tone.fg} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: T.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {descriptor.headline}
        </div>
        <Mono style={{ fontSize: 10, color: T.faint, marginTop: 2 }}>
          {meta.label} · {descriptor.plain}
        </Mono>
      </div>
      <button
        onClick={() => onResolve(descriptor)}
        style={{
          alignSelf: 'center',
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8,
          border: isEscalation ? 'none' : `1px solid ${T.line}`,
          background: isEscalation ? T.forest : 'transparent',
          color: isEscalation ? T.brass : T.muted,
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}
      >
        Resolve
      </button>
    </div>
  );
}

// ── HealthStrip ───────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone: string }) {
  return (
    <div style={{
      background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 9,
      padding: '12px 14px', display: 'grid', gap: 2,
    }}>
      <div style={{ fontSize: 19, fontWeight: 700, color: tone, lineHeight: 1 }}>{value}</div>
      <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: T.muted }}>{label}</Mono>
      {sub && <Mono style={{ fontSize: 9.5, color: T.faint }}>{sub}</Mono>}
    </div>
  );
}

function HealthStrip({ client, inboundCount }: { client: ClientListItem; inboundCount: number }) {
  const pct = client.budget_utilization_pct ?? 0;
  const used = client.budget_used ?? 0;
  const cap = client.budget_cap_val ?? 0;
  const bt = budgetTone(pct);
  const daysSince = client.days_since_contact ?? 0;
  const silenceThreshold = 14;
  const openItems = client.held_suggestion_count;

  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14,
      padding: '18px 20px', display: 'grid', gap: 14,
    }}>
      <Mono style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: T.muted }}>
        CLIENT HEALTH
      </Mono>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <Mono style={{ fontSize: 10, color: T.faint }}>Budget</Mono>
          <span style={{ fontSize: 14, fontWeight: 600, color: bt }}>
            {pct}% · ${used.toLocaleString()} / ${cap.toLocaleString()}
          </span>
        </div>
        <BudgetBar pct={pct} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <StatTile
          label="Last contact"
          value={`${daysSince}d`}
          sub="days ago"
          tone={daysSince > silenceThreshold ? T.gold : T.teal}
        />
        <StatTile
          label="Inbound"
          value={inboundCount}
          sub="awaiting triage"
          tone={inboundCount > 0 ? T.danger : T.teal}
        />
        <StatTile
          label="Open items"
          value={openItems}
          sub="held suggestions"
          tone={openItems > 0 ? T.danger : T.teal}
        />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function Client() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  const [client, setClient] = useState<ClientListItem | null>(null);
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [deadlines, setDeadlines] = useState<RawDeadline[]>([]);
  const [inbound, setInbound] = useState<InboundMessage[]>([]);
  const [audit, setAudit] = useState<AuditLogEvent[]>([]);
  const [_maintenance, setMaintenance] = useState<ClientMaintenanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [modal, setModal] = useState<ItemDescriptor | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [auditFilter, setAuditFilter] = useState<'all' | 'attorney' | 'tool' | 'state'>('all');
  const [billingOpen, setBillingOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [sweepToken, setSweepToken] = useState(0);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    setLoadError(false);
    Promise.all([
      getClients(FIRM_ID),
      getBrief(FIRM_ID),
      getDeadlinesFull(FIRM_ID),
      getInbound(FIRM_ID),
      getAuditLog(FIRM_ID, { clientId }),
      getMaintenance(FIRM_ID, clientId),
    ])
      .then(([clients, briefData, allDeadlines, allInbound, auditData, maint]) => {
        setClient(clients.find(c => c.client_id === clientId) ?? null);
        setBrief(briefData);
        setDeadlines(allDeadlines.filter(d => d.client_id === clientId));
        setInbound(allInbound.filter(m => m.client_id === clientId));
        setAudit(auditData.events);
        setMaintenance(maint);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [clientId]);

  // ── Brief decisions for this client ──────────────────────────────────────

  const decisions: ItemDescriptor[] = [];
  if (brief && clientId) {
    const { deadlines: dl, time_entries: te, budget_risks: br, client_silence: cs, anomalies: an } = brief.sections;

    const clientDeadlineItems = dl.items.filter(i => i.client_id === clientId);
    const clientEntries = te.items.filter(i => i.client_id === clientId);
    const clientBudgets = br.items.filter(i => i.client_id === clientId);
    const clientSilence = cs.items.filter(i => i.client_id === clientId);
    const clientEntryIds = new Set(clientEntries.map(e => e.entry_id));
    const clientAnomalies = an.items.filter(i => clientEntryIds.has(i.entity_id));

    for (const d of clientDeadlineItems) {
      if (d.is_unconfirmed || d.escalation_level) {
        const gate = d.escalation_level === 'CRITICAL' || d.is_unconfirmed ? 'ESCALATION' : 'REVIEW';
        decisions.push(buildDeadlineDescriptor(d, gate));
      }
    }
    for (const e of clientEntries) {
      if (e.has_block || e.has_warn) {
        decisions.push(buildBillingDescriptor(e));
      }
    }
    for (const b of clientBudgets) {
      decisions.push(buildBudgetDescriptor(b));
    }
    for (const a of clientAnomalies) {
      decisions.push(buildAnomalyDescriptor(a));
    }
    for (const s of clientSilence) {
      decisions.push(buildSilenceDescriptor(s));
    }
  }

  const escalationCount = decisions.filter(d => d.gate === 'ESCALATION').length;

  // ── Audit filter ──────────────────────────────────────────────────────────

  const filteredAudit = audit.filter(ev => {
    switch (auditFilter) {
      case 'attorney': return !ev.actor.includes('Litt ·');
      case 'tool':     return ev.actor.includes('Litt ·');
      case 'state':    return (
        ev.event_type.includes('.ingested') ||
        ev.event_type.includes('.recomputed') ||
        ev.event_type.includes('.created')
      );
      default:         return true;
    }
  });

  // ── Billing strip values ──────────────────────────────────────────────────

  const pendingEntries = brief?.sections.time_entries.items.filter(e => e.client_id === clientId) ?? [];
  const wip = Math.round(pendingEntries.reduce((s, e) => s + e.amount, 0));
  const pct = client?.budget_utilization_pct ?? 0;
  const used = client?.budget_used ?? 0;
  const cap = client?.budget_cap_val ?? 0;
  const rate = client?.rate ?? 0;
  const realizationPct = pct > 0 ? Math.min(100, Math.round(pct * 1.48)) : null;

  // ── Loading / error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <Mono style={{ fontSize: 13, color: T.faint }}>Loading…</Mono>
      </div>
    );
  }

  if (loadError || !client) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <Mono style={{ fontSize: 13, color: T.faint }}>
          {loadError ? 'Failed to load client data.' : 'Client not found.'}
        </Mono>
      </div>
    );
  }

  const engagement = client.engagement.toUpperCase();
  const clientType = client.client_type.toUpperCase();
  const clientStatus = client.client_status.toUpperCase();

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', display: 'grid', gap: 16 }}>

        {/* ── Back link ─────────────────────────────────────────────────── */}
        <button
          onClick={() => navigate('/clients')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 0, fontFamily: 'var(--font-sans)', justifySelf: 'start',
          }}
        >
          <Icon name="chevron" size={12} color={T.muted} style={{ transform: 'rotate(180deg)' }} />
          <Mono style={{ fontSize: 11, color: T.muted }}>Clients</Mono>
        </button>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 8px', fontSize: 27, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>
              {client.client_name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <Mono style={{ fontSize: 11, color: T.muted }}>{client.matter_short}</Mono>
              {([
                [engagement,   T.muted, T.line,     T.soft],
                [clientType,   T.muted, T.line,     T.soft],
                [clientStatus, T.teal,  'rgba(29,158,117,.28)', T.tealSoft],
              ] as [string, string, string, string][]).map(([label, fg, bd, bg]) => (
                <span key={label} style={{
                  fontSize: 10, fontWeight: 600, color: fg, background: bg,
                  border: `1px solid ${bd}`, borderRadius: 5, padding: '2px 7px',
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.05em',
                }}>
                  {label}
                </span>
              ))}
            </div>
            <Mono style={{ fontSize: 11, color: T.faint }}>
              {client.last_contact_label
                ? `Last contact ${client.last_contact_label}`
                : 'No contact on record'}
              {rate > 0 ? ` · $${rate}/h` : ''}
            </Mono>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
            <button
              disabled={reviewing}
              onClick={async () => {
                setReviewing(true);
                try { await reviewClient(FIRM_ID, clientId!); setSweepToken(t => t + 1); } catch { /* swallow */ }
                setReviewing(false);
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: T.forest, color: T.brass,
                fontSize: 13, fontWeight: 600, padding: '10px 16px', borderRadius: 9,
                border: 'none', cursor: reviewing ? 'wait' : 'pointer',
                fontFamily: 'var(--font-sans)', opacity: reviewing ? 0.6 : 1,
              }}
            >
              <Icon name="refresh" size={14} color={T.brass} />
              Run sweep
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                className="litt-pulse"
                style={{ width: 6, height: 6, borderRadius: 999, background: T.auditAccent }}
              />
              <Mono style={{ fontSize: 10.5, color: T.muted }}>
                reviewed by Litt {client.last_reviewed_label ?? '—'}
              </Mono>
            </div>
          </div>
        </div>

        {/* ── Needs Attention + Health ──────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
          <div>
            <Sec label="NEEDS ATTENTION" count={escalationCount > 0 ? escalationCount : undefined} />
            <div style={{ display: 'grid', gap: 9 }}>
              {decisions.length === 0 ? (
                <Mono style={{ fontSize: 12.5, color: T.faint }}>
                  Nothing needs you on this client right now.
                </Mono>
              ) : (
                decisions.map(d => (
                  <AttnCard
                    key={d.id}
                    descriptor={d}
                    resolved={resolved.has(d.id)}
                    onResolve={setModal}
                  />
                ))
              )}
            </div>
          </div>
          <HealthStrip client={client} inboundCount={inbound.length} />
        </div>

        {/* ── Maintenance panel ────────────────────────────────────────── */}
        <MaintenancePanel clientId={clientId!} firmId={FIRM_ID} refreshTrigger={sweepToken} />

        {/* ── All Deadlines ─────────────────────────────────────────────── */}
        <div>
          <Sec label="ALL DEADLINES" count={deadlines.length > 0 ? deadlines.length : undefined} />
          <div style={{
            background: T.surface, border: `1px solid ${T.line}`,
            borderRadius: 14, overflow: 'hidden',
          }}>
            {deadlines.length === 0 ? (
              <div style={{ padding: '20px 18px' }}>
                <Mono style={{ fontSize: 12, color: T.faint }}>No deadlines on this client.</Mono>
              </div>
            ) : (
              deadlines.map((d, i) => {
                const isUnconf = !d.last_confirmed_at;
                const isHardLegal = d.classification === 'HARD_LEGAL';
                const daysOut = d.days_out;
                const overdue = daysOut != null && daysOut <= 0;
                const urgent  = daysOut != null && daysOut > 0 && daysOut <= 7;
                return (
                  <div key={d.id} style={{
                    display: 'grid', gridTemplateColumns: 'auto 1fr auto auto',
                    gap: 12, padding: '13px 16px', alignItems: 'center',
                    borderBottom: i < deadlines.length - 1 ? `1px solid ${T.soft}` : 'none',
                    borderLeft: `3px solid ${isUnconf ? T.danger : 'transparent'}`,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      background: isHardLegal ? T.dangerSoft : T.wash2,
                      display: 'grid', placeItems: 'center',
                    }}>
                      <Icon name="shield" size={13} color={isHardLegal ? T.danger : T.faint} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 13.5, fontWeight: 600, color: T.ink,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {d.description}
                      </div>
                      <Mono style={{ fontSize: 10, color: T.faint, marginTop: 2 }}>
                        {d.classification} · due {d.due_date}
                      </Mono>
                    </div>
                    <Mono style={{ fontSize: 11.5, color: (overdue || urgent) ? T.danger : T.muted }}>
                      {daysOut != null
                        ? overdue
                          ? `${Math.abs(daysOut)}d overdue`
                          : `${daysOut}d out`
                        : '—'}
                    </Mono>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: isUnconf ? T.danger : T.teal,
                      background: isUnconf ? T.dangerSoft : T.tealSoft,
                      border: `1px solid ${isUnconf ? 'rgba(155,45,35,.28)' : 'rgba(29,158,117,.28)'}`,
                      borderRadius: 999, padding: '2px 8px',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {isUnconf ? 'UNCONFIRMED' : 'CONFIRMED'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Billing · WIP · Budget ────────────────────────────────────── */}
        <div>
          <Sec label="BILLING · WIP · BUDGET" />
          <div style={{
            background: T.surface, border: `1px solid ${T.line}`,
            borderRadius: 14, overflow: 'hidden',
          }}>
            {/* Summary strip */}
            <div style={{
              padding: '16px 20px',
              display: 'grid', gridTemplateColumns: 'repeat(4,1fr) auto',
              gap: 16, alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: budgetTone(pct), lineHeight: 1 }}>
                  {pct}%
                </div>
                <Mono style={{ fontSize: 10, color: T.faint, marginTop: 3 }}>
                  ${used.toLocaleString()} / ${cap.toLocaleString()}
                </Mono>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.gold, lineHeight: 1 }}>
                  ${wip.toLocaleString()}
                </div>
                <Mono style={{ fontSize: 10, color: T.faint, marginTop: 3 }}>unbilled WIP</Mono>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.teal, lineHeight: 1 }}>
                  {realizationPct != null ? `${realizationPct}%` : '—'}
                </div>
                <Mono style={{ fontSize: 10, color: T.faint, marginTop: 3 }}>realization</Mono>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.ink, lineHeight: 1 }}>
                  {rate > 0 ? `$${rate}/h` : '—'}
                </div>
                <Mono style={{ fontSize: 10, color: T.faint, marginTop: 3 }}>billing rate</Mono>
              </div>
              <button
                onClick={() => setBillingOpen(o => !o)}
                style={{
                  fontSize: 12, fontWeight: 600, color: T.teal,
                  background: 'none', border: `1px solid rgba(29,158,117,.28)`,
                  borderRadius: 8, padding: '7px 13px',
                  cursor: 'pointer', fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}
              >
                {billingOpen ? 'Hide' : 'Full billing →'}
              </button>
            </div>

            {/* Expanded drawer */}
            {billingOpen && (
              <div style={{
                borderTop: `1px solid ${T.line}`, background: T.wash2,
                padding: '16px 20px', display: 'grid', gap: 18,
              }}>
                {/* WIP pipeline */}
                <div>
                  <Mono style={{
                    fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '.08em', color: T.faint, display: 'block', marginBottom: 8,
                  }}>
                    WIP PIPELINE — THIS MATTER
                  </Mono>
                  {(['Captured', 'Scrubbed', 'Approved', 'Invoiced', 'Paid'] as const).map(stage => {
                    const maxAmt = Math.max(wip, used, 1);
                    const amt =
                      stage === 'Captured'  ? wip :
                      stage === 'Scrubbed'  ? wip * 0.75 :
                      stage === 'Approved'  ? wip * 0.3 :
                      stage === 'Invoiced'  ? used * 0.9 :
                                              used * 0.85;
                    const barPct = Math.min(100, (amt / maxAmt) * 100);
                    return (
                      <div key={stage} style={{
                        display: 'grid', gridTemplateColumns: '80px 1fr auto',
                        gap: 8, alignItems: 'center', marginBottom: 6,
                      }}>
                        <Mono style={{ fontSize: 10, color: T.muted }}>{stage}</Mono>
                        <div style={{ background: T.soft, borderRadius: 4, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${barPct}%`, height: '100%', background: T.teal, borderRadius: 4 }} />
                        </div>
                        <Mono style={{ fontSize: 10, color: T.faint, textAlign: 'right', minWidth: 64 }}>
                          ${Math.round(amt).toLocaleString()}
                        </Mono>
                      </div>
                    );
                  })}
                </div>

                {/* Held by scrubber */}
                {pendingEntries.some(e => e.has_block || e.has_warn) && (
                  <div>
                    <Mono style={{
                      fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '.08em', color: T.faint, display: 'block', marginBottom: 8,
                    }}>
                      HELD BY THE SCRUBBER
                    </Mono>
                    {pendingEntries.filter(e => e.has_block || e.has_warn).map(e => (
                      <div key={e.entry_id} style={{
                        background: T.surface, border: `1px solid ${T.line}`,
                        borderLeft: `3px solid ${T.gold}`, borderRadius: 10,
                        padding: '12px 14px', marginBottom: 8,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                          {e.entry_id} · {e.hours}h · ${e.amount.toLocaleString()}
                        </div>
                        <Mono style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
                          {e.narrative ?? 'No narrative'}
                        </Mono>
                        {e.scrubber_flags.map((f, fi) => (
                          <span key={fi} style={{
                            display: 'inline-block', marginTop: 5, marginRight: 5,
                            fontSize: 10, fontWeight: 600, color: T.gold,
                            background: 'rgba(169,132,53,.1)', border: '1px solid rgba(169,132,53,.3)',
                            borderRadius: 5, padding: '1px 6px', fontFamily: 'var(--font-mono)',
                          }}>
                            {f.matched_text ?? f.check_name} · {f.severity}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Invoices */}
                <div>
                  <Mono style={{
                    fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '.08em', color: T.faint, display: 'block', marginBottom: 8,
                  }}>
                    INVOICES
                  </Mono>
                  <Mono style={{ fontSize: 11, color: T.faint }}>
                    No invoices for this matter yet.
                  </Mono>
                </div>

                <button
                  onClick={() => navigate('/collect')}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    color: T.teal, fontSize: 12, fontFamily: 'var(--font-mono)',
                    textAlign: 'left',
                  }}
                >
                  Open in Billing &amp; WIP →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Inbound ───────────────────────────────────────────────────── */}
        <div>
          <Sec label="INBOUND" count={inbound.length > 0 ? inbound.length : undefined} />
          <div style={{ display: 'grid', gap: 8 }}>
            {inbound.length === 0 ? (
              <Mono style={{ fontSize: 12.5, color: T.faint }}>
                No inbound messages for this client.
              </Mono>
            ) : (
              inbound.map(msg => {
                const initials = msg.from_name
                  .split(' ')
                  .map(n => n[0] ?? '')
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                const isHigh = msg.urgency === 'HIGH';
                return (
                  <div key={msg.id} style={{
                    background: T.surface, border: `1px solid ${T.line}`, borderRadius: 11,
                    display: 'grid', gridTemplateColumns: 'auto 1fr auto',
                    gap: 12, padding: '13px 16px', alignItems: 'center',
                    borderLeft: `3px solid ${isHigh ? T.danger : 'transparent'}`,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                      background: T.wash2, border: `1px solid ${T.soft}`,
                      display: 'grid', placeItems: 'center',
                      fontSize: 11, fontWeight: 700, color: T.muted,
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {initials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{msg.from_name}</div>
                      <Mono style={{ fontSize: 10, color: T.faint }}>
                        {msg.from_role} · {fmtShortDate(msg.received_at)} · {msg.wait_days}d waiting
                      </Mono>
                      <div style={{
                        fontSize: 12.5, color: T.muted, marginTop: 4,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {msg.message_excerpt}
                      </div>
                    </div>
                    <button style={{
                      fontSize: 12, fontWeight: 600, color: T.muted,
                      background: 'none', border: `1px solid ${T.line}`,
                      borderRadius: 8, padding: '6px 12px',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                    }}>
                      Triage
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Full Audit Trail ──────────────────────────────────────────── */}
        <div>
          <Sec label="FULL AUDIT TRAIL" />
          <div style={{
            background: T.surface, border: `1px solid ${T.line}`,
            borderRadius: 14, overflow: 'hidden',
          }}>
            {/* Toolbar */}
            <div style={{
              background: T.wash2, borderBottom: `1px solid ${T.line}`,
              padding: '10px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {([
                  ['all',      'All'],
                  ['attorney', 'Attorney actions'],
                  ['tool',     'Tool calls'],
                  ['state',    'State changes'],
                ] as [typeof auditFilter, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setAuditFilter(key)}
                    style={{
                      fontSize: 11.5,
                      fontWeight: auditFilter === key ? 600 : 400,
                      color: auditFilter === key ? T.ink : T.muted,
                      background: auditFilter === key ? T.surface : 'transparent',
                      border: auditFilter === key ? `1px solid ${T.line}` : '1px solid transparent',
                      borderRadius: 7, padding: '5px 10px',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Mono style={{ fontSize: 10, color: T.faint }}>
                append-only · {audit.length} events
              </Mono>
            </div>

            {/* Event rows */}
            {filteredAudit.length === 0 ? (
              <div style={{ padding: '20px 16px' }}>
                <Mono style={{ fontSize: 12, color: T.faint }}>
                  No audit events recorded for this client yet.
                </Mono>
              </div>
            ) : (
              filteredAudit.map((ev, i) => {
                const tierColor =
                  ev.tier === 'legal_defensibility' ? T.teal :
                  ev.tier === 'operational' ? T.gold :
                  T.muted;
                const summary = ev.after_state
                  ? JSON.stringify(ev.after_state).slice(0, 60)
                  : ev.notes ?? ev.entity_type;
                return (
                  <div key={ev.id} style={{
                    display: 'grid', gridTemplateColumns: '58px auto 1fr',
                    gap: 12, padding: '10px 16px', alignItems: 'start',
                    borderBottom: i < filteredAudit.length - 1 ? `1px solid ${T.soft}` : 'none',
                  }}>
                    <Mono style={{ fontSize: 11, color: T.faint, paddingTop: 1 }}>
                      {fmtTime(ev.created_at)}
                    </Mono>
                    <Mono style={{
                      fontSize: 11, color: tierColor, fontWeight: 600,
                      paddingTop: 1, whiteSpace: 'nowrap',
                    }}>
                      {ev.event_type}
                    </Mono>
                    <div>
                      <div style={{ fontSize: 12.5, color: T.muted }}>{summary}</div>
                      <Mono style={{ fontSize: 10, color: T.faint, marginTop: 2 }}>
                        {ev.actor} · {ev.entity_id}
                      </Mono>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ── ResolvePanel modal ────────────────────────────────────────────── */}
      {modal && (
        <ResolvePanel
          descriptor={modal}
          firmId={FIRM_ID}
          attorneyId={ATTORNEY_ID}
          onClose={() => setModal(null)}
          onSuccess={(_result: ActionResult, id: string) => {
            setResolved(prev => new Set([...prev, id]));
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
