import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { T } from '../tokens';
import { Icon } from '../components/ui/Icon';
import { Mono } from '../components/ui/Mono';
import { ClientsSubnav } from '../components/clients/ClientsSubnav';
import { BudgetBar, budgetTone } from '../components/clients/BudgetBar';
import type { ClientListItem, PendingClient } from '../types';
import { getClients, getPendingClients } from '../api';

const FIRM_ID = 'strand-okafor';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDetected(isoStr: string): string {
  try {
    const now = new Date('2026-05-29T17:00:00Z');
    const t = new Date(isoStr);
    const diffMin = Math.round((now.getTime() - t.getTime()) / 60000);
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ago`;
    return `${Math.round(diffMin / 1440)}d ago`;
  } catch {
    return '';
  }
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow({ last }: { last: boolean }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '232px 1fr 150px 132px', gap: 16,
      alignItems: 'center', padding: '14px 18px',
      borderBottom: last ? 'none' : `1px solid ${T.soft}`,
    }}>
      {[100, 200, 80, 60].map((w, i) => (
        <div key={i} style={{
          height: 14, borderRadius: 6,
          background: T.wash2, width: w,
          animation: 'litt-pulse 1.5s ease-in-out infinite',
        }} />
      ))}
    </div>
  );
}

// ── Roster row ────────────────────────────────────────────────────────────────

function RosterRow({ c, onOpen, last }: { c: ClientListItem; onOpen: (id: string) => void; last: boolean }) {
  const [hovered, setHovered] = useState(false);
  const bt = budgetTone(c.budget_utilization_pct ?? 0);
  const stale = (c.days_since_contact ?? 0) > 14;

  return (
    <button
      onClick={() => onOpen(c.client_id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', textAlign: 'left',
        display: 'grid', gridTemplateColumns: '232px 1fr 150px 132px',
        gap: 16, alignItems: 'center',
        padding: '14px 18px',
        borderBottom: last ? 'none' : `1px solid ${T.soft}`,
        background: hovered ? T.wash2 : 'transparent',
        border: 'none',
        borderLeft: `3px solid ${c.pending_item_count > 0 ? T.danger : 'transparent'}`,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        transition: 'background .12s',
      }}
    >
      {/* Col 1 — client name + engagement/status */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: T.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {c.client_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
          <Mono style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: T.muted }}>
            {c.engagement}
          </Mono>
          <span style={{ width: 3, height: 3, borderRadius: 999, background: T.faint, flexShrink: 0 }} />
          <Mono style={{ fontSize: 9.5, color: T.teal }}>{c.client_status}</Mono>
        </div>
      </div>

      {/* Col 2 — matter short + budget bar */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 5,
        }}>
          <Mono style={{
            fontSize: 10, color: T.faint,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {c.matter_short}
          </Mono>
          {c.budget_utilization_pct != null && (
            <span style={{ fontSize: 12, fontWeight: 600, color: bt, flexShrink: 0, marginLeft: 8 }}>
              {c.budget_utilization_pct}%
            </span>
          )}
        </div>
        {c.budget_utilization_pct != null && <BudgetBar pct={c.budget_utilization_pct} />}
      </div>

      {/* Col 3 — contact freshness */}
      <div>
        <div style={{
          fontSize: 12.5,
          color: stale ? T.gold : T.muted,
          fontWeight: stale ? 600 : 400,
        }}>
          {c.days_since_contact != null ? `${c.days_since_contact}d since contact` : '—'}
        </div>
        <Mono style={{ fontSize: 9.5, color: T.faint, marginTop: 2 }}>
          reviewed {c.last_reviewed_label ?? '—'}
        </Mono>
      </div>

      {/* Col 4 — pending pill or clear + chevron */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 9 }}>
        {c.pending_item_count > 0 ? (
          <Mono style={{
            fontSize: 10.5, fontWeight: 600, color: T.danger,
            background: 'rgba(155,45,35,.08)', border: '1px solid rgba(155,45,35,.24)',
            borderRadius: 999, padding: '2px 9px',
          }}>
            {c.pending_item_count} {c.pending_item_count === 1 ? 'needs' : 'need'} you
          </Mono>
        ) : (
          <Mono style={{ fontSize: 10.5, color: T.teal }}>clear</Mono>
        )}
        <Icon name="chevron" size={14} color={T.faint} />
      </div>
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientListItem[] | null>(null);
  const [pending, setPending] = useState<PendingClient[]>([]);

  useEffect(() => {
    getClients(FIRM_ID)
      .then(setClients)
      .catch(() => setClients([]));
    getPendingClients(FIRM_ID)
      .then(setPending)
      .catch(() => setPending([]));
  }, []);

  const sorted = clients
    ? [...clients].sort((a, b) =>
        (b.pending_item_count - a.pending_item_count) ||
        ((b.budget_utilization_pct ?? 0) - (a.budget_utilization_pct ?? 0))
      )
    : null;

  const needsAttn  = clients ? clients.reduce((s, c) => s + c.pending_item_count, 0) : 0;
  const quiet      = clients ? clients.filter(c => (c.days_since_contact ?? 0) > 14).length : 0;
  const budgetWatch= clients ? clients.filter(c => (c.budget_utilization_pct ?? 0) >= 75).length : 0;

  const pendingItem = pending[0] ?? null;

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 18 }}>

        {/* Sub-nav */}
        <div style={{ justifySelf: 'start' }}>
          <ClientsSubnav />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>
                Clients
              </h1>
              <Mono style={{
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em',
                color: T.teal, background: T.tealSoft,
                border: '1px solid rgba(29,158,117,.28)', borderRadius: 5, padding: '2px 7px',
              }}>
                roster
              </Mono>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: T.muted, lineHeight: 1.5, maxWidth: '60ch' }}>
              Every client Litt watches — health, budget, and the items on your radar at a glance. Litt keeps each file current on a cadence; open one for the full command center.
            </p>
          </div>
          <button
            onClick={() => navigate('/clients/new')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: T.forest, color: T.brass,
              fontSize: 13.5, fontWeight: 600,
              padding: '11px 17px', borderRadius: 10,
              border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
            }}
          >
            <Icon name="users" size={15} color={T.brass} />
            Add client
          </button>
        </div>

        {/* Summary strip */}
        <section style={{
          background: T.surface, border: `1px solid ${T.line}`,
          borderRadius: 14, padding: '15px 20px',
          display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'center',
        }}>
          {([
            ['Active clients', clients?.length ?? 0, T.teal,   'on the roster'],
            ['Needs you',      needsAttn,             T.danger, 'open items'],
            ['Going quiet',    quiet,                 T.gold,   'past 14d silent'],
            ['Budget watch',   budgetWatch,           T.gold,   'over 75%'],
          ] as [string, number, string, string][]).map(([label, val, color, sub]) => (
            <div key={label} style={{ minWidth: 96 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 22, fontWeight: 700, color: T.ink, lineHeight: 1 }}>{val}</span>
              </div>
              <Mono style={{
                fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em',
                color: T.faint, display: 'block', marginTop: 4,
              }}>
                {label}
              </Mono>
              <Mono style={{ fontSize: 10, color: T.faint }}>{sub}</Mono>
            </div>
          ))}
          <div style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8,
            background: T.wash2, border: `1px solid ${T.soft}`,
            borderRadius: 9, padding: '8px 12px',
          }}>
            <span
              className="litt-pulse"
              style={{ width: 6, height: 6, borderRadius: 999, background: T.auditAccent }}
            />
            <Mono style={{ fontSize: 10.5, color: T.muted }}>All files reviewed within the hour</Mono>
          </div>
        </section>

        {/* Pending onboarding banner */}
        {pendingItem && (
          <section style={{
            background: T.surface,
            border: '1px solid rgba(169,132,53,.34)',
            borderLeft: `3px solid ${T.gold}`,
            borderRadius: 13, padding: '14px 18px',
            display: 'grid', gridTemplateColumns: 'auto 1fr auto',
            gap: 14, alignItems: 'center',
          }}>
            <span style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              background: 'rgba(169,132,53,.1)', border: '1px solid rgba(169,132,53,.28)',
              display: 'grid', placeItems: 'center',
            }}>
              <Icon name="mail" size={16} color={T.gold} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>
                  New client drafted from an engagement letter
                </span>
                <Mono style={{
                  fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em',
                  color: T.gold, background: 'rgba(169,132,53,.1)',
                  border: '1px solid rgba(169,132,53,.3)', borderRadius: 5, padding: '1px 6px',
                }}>
                  auto · held
                </Mono>
              </div>
              <Mono style={{ fontSize: 10.5, color: T.faint, marginTop: 3, display: 'block' }}>
                {pendingItem.proposed_name} · {pendingItem.via} · detected {fmtDetected(pendingItem.detected_at)} · {pendingItem.extraction.fields_extracted_count}/{pendingItem.extraction.fields_total} fields extracted
              </Mono>
            </div>
            <button
              onClick={() => navigate(`/clients/new?pending=${pendingItem.id}`)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: T.forest, color: T.brass,
                fontSize: 12.5, fontWeight: 600,
                padding: '9px 15px', borderRadius: 9,
                border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
              }}
            >
              Review &amp; confirm <Icon name="arrow" size={13} color={T.brass} />
            </button>
          </section>
        )}

        {/* Roster table */}
        <section style={{
          background: T.surface, border: `1px solid ${T.line}`,
          borderRadius: 14, overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '232px 1fr 150px 132px',
            gap: 16, padding: '10px 18px',
            borderBottom: `1px solid ${T.soft}`,
            background: T.wash2,
          }}>
            {(['Client', 'Matter · budget', 'Contact', ''] as const).map((h, i) => (
              <Mono key={i} style={{
                fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em',
                color: T.faint, fontWeight: 600,
                textAlign: i === 3 ? 'right' : 'left',
              }}>
                {h}
              </Mono>
            ))}
          </div>

          {/* Rows */}
          {sorted === null ? (
            [0, 1, 2, 3].map(i => <SkeletonRow key={i} last={i === 3} />)
          ) : sorted.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center' }}>
              <Mono style={{ fontSize: 12, color: T.faint }}>
                No clients yet — add your first client
              </Mono>
            </div>
          ) : (
            sorted.map((c, i) => (
              <RosterRow
                key={c.client_id}
                c={c}
                onOpen={id => navigate(`/clients/${id}`)}
                last={i === sorted.length - 1}
              />
            ))
          )}
        </section>

      </div>
    </div>
  );
}
