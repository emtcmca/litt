import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BriefResponse, BriefTimeEntryItem } from '../types';
import { T } from '../tokens';
import { Icon } from '../components/ui/Icon';
import { getBrief, downloadLedesExport } from '../api';

const FIRM_ID = 'strand-okafor';

// Realization stats — not yet in brief API; hardcoded demo values
const REALIZATION = { rate: 92, unbilledWip: 4500, writedownsMtd: 1850 };

// Scrubber rules in display order
const SCRUBBER_RULES = [
  'Missing narrative',
  'Forbidden phrases',
  'Round hours, no session',
  'Block-billing',
  'Rate deviation',
  'Duplicate entry',
  'Stale pending (>30d)',
] as const;

// Maps backend check_name → display rule label
const CHECK_NAME_MAP: Record<string, string> = {
  MISSING_NARRATIVE: 'Missing narrative',
  FORBIDDEN_PHRASE:  'Forbidden phrases',
  ROUND_HOURS:       'Round hours, no session',
  BLOCK_BILLING:     'Block-billing',
  RATE_DEVIATION:    'Rate deviation',
  DUPLICATE_ENTRY:   'Duplicate entry',
  STALE_PENDING:     'Stale pending (>30d)',
};

function money(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function deriveScrubberRules(items: BriefTimeEntryItem[]) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    for (const f of item.scrubber_flags) {
      const label = CHECK_NAME_MAP[f.check_name] ?? f.check_name;
      counts[label] = (counts[label] ?? 0) + 1;
    }
  }
  return SCRUBBER_RULES.map(rule => ({ rule, flagged: counts[rule] ?? 0 }));
}

// Builds a 5-stage pipeline from brief totals.
// Captured = total_wip_usd. Downstream stages estimated — real impl needs /api/billing/pipeline.
function derivePipeline(totalWip: number, totalCount: number, items: BriefTimeEntryItem[]) {
  const blockedAmt = items.filter(e => e.has_block).reduce((s, e) => s + e.amount, 0);
  const blockedCnt = items.filter(e => e.has_block).length;
  const approvedAmt = totalWip - blockedAmt;
  const approvedCnt = totalCount - blockedCnt;
  const invoicedAmt = Math.round(approvedAmt * 0.848);
  const invoicedCnt = Math.max(approvedCnt - 1, 0);
  const paidAmt = Math.round(approvedAmt * 0.671);
  const paidCnt = Math.max(approvedCnt - 2, 0);
  return [
    { stage: 'Captured', amount: totalWip,    count: totalCount,    note: 'Logged this period' },
    { stage: 'Scrubbed', amount: totalWip,    count: totalCount,    note: '7-rule pre-bill check' },
    { stage: 'Approved', amount: approvedAmt, count: approvedCnt,   note: 'You signed off' },
    { stage: 'Invoiced', amount: invoicedAmt, count: invoicedCnt,   note: 'On a client invoice' },
    { stage: 'Paid',     amount: paidAmt,     count: paidCnt,       note: 'Collected' },
  ];
}

export function Collect() {
  const [brief, setBrief]     = useState<BriefResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const hasFetched = useRef(false);
  const nav = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await getBrief(FIRM_ID);
      setBrief(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    load();
  }, [load]);

  if (!brief && !error) {
    return <div style={{ padding: '28px 32px', fontSize: 13, color: T.muted }}>Loading…</div>;
  }
  if (error) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div style={{ fontSize: 13, color: T.danger, marginBottom: 8 }}>{error}</div>
        <button onClick={load} style={{ fontSize: 12, color: T.teal, background: 'none', border: 'none', cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  const te            = brief!.sections.time_entries;
  const allItems      = te.items;
  const held          = allItems.filter(e => e.has_block);
  const heldTotal     = held.reduce((s, e) => s + e.amount, 0);
  const pipeline      = derivePipeline(te.total_wip_usd, te.count, allItems);
  const scrubberRules = deriveScrubberRules(allItems);
  const flaggedTotal  = scrubberRules.reduce((s, r) => s + r.flagged, 0);
  const maxAmt        = pipeline[0].amount;
  const inFlight      = pipeline[0].amount - pipeline[pipeline.length - 1].amount;
  const paid          = pipeline[pipeline.length - 1].amount;
  const ledesReady    = te.count - held.length;

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 940, margin: '0 auto', display: 'grid', gap: 22 }}>

        {/* ── header ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Collect</h1>
            <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '60ch' }}>
              Every hour you work, turned into a defensible, billable invoice — and nothing left to fall through the cracks.
            </p>
          </div>
          <button
            onClick={() => { setExported(true); downloadLedesExport(FIRM_ID).catch(() => null); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 17px', borderRadius: 10,
              background: exported ? T.tealSoft : T.forest,
              color: exported ? T.teal : T.brass,
              border: `1px solid ${exported ? 'rgba(29,158,117,.3)' : T.forest}`,
              cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
              fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            <Icon
              name={exported ? 'check' : 'arrow'}
              size={14}
              color={exported ? T.teal : T.brass}
              style={exported ? {} : { transform: 'rotate(90deg)' }}
            />
            {exported ? 'LEDES exported' : `Export LEDES · ${ledesReady} entries`}
          </button>
        </div>

        {/* ── WIP pipeline ─────────────────────────────────────────── */}
        <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.1em', color: T.muted, fontWeight: 600 }}>
              WIP pipeline · this period
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: T.faint }}>
              {money(inFlight)} in flight · {money(paid)} collected
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${pipeline.length}, 1fr)` }}>
            {pipeline.map((p, i) => {
              const pct     = Math.round((p.amount / maxAmt) * 100);
              const dropped = i > 0 ? pipeline[i - 1].amount - p.amount : 0;
              const tone    = i === 0 ? T.gold : i === pipeline.length - 1 ? T.teal : T.forest;
              return (
                <div
                  key={p.stage}
                  style={{ position: 'relative', padding: '0 10px', borderLeft: i === 0 ? 'none' : `1px solid ${T.soft}` }}
                >
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em', color: T.faint }}>
                    {p.stage}
                  </span>
                  <div style={{ fontSize: 20, fontWeight: 600, color: T.ink, marginTop: 4, lineHeight: 1.1 }}>
                    {money(p.amount)}
                  </div>
                  <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: T.muted }}>
                    {p.count} entries
                  </span>
                  <div style={{ height: 5, borderRadius: 999, background: T.wash2, marginTop: 9, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: tone, borderRadius: 999 }} />
                  </div>
                  {dropped > 0 && (
                    <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: T.gold, marginTop: 5, display: 'block' }}>
                      −{money(dropped)} held / not yet advanced
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── held + scrubber / realization ─────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 16 }}>

          {/* held entries */}
          <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '13px 18px', borderBottom: `1px solid ${T.soft}`, display: 'flex', alignItems: 'center', gap: 8, background: T.wash2 }}>
              <Icon name="alert" size={14} color={T.gold} />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.09em', color: T.muted, fontWeight: 600 }}>
                Held — needs you before it bills
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: T.gold }}>
                {money(heldTotal)}
              </span>
            </div>
            {held.length === 0 ? (
              <div style={{ padding: '24px 18px', fontSize: 13, color: T.faint }}>No held entries.</div>
            ) : (
              held.map(h => {
                const flag = h.scrubber_flags[0];
                return (
                  <div key={h.entry_id} style={{ padding: '15px 18px', display: 'grid', gap: 9 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{h.matter_name}</div>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: T.faint }}>
                          {h.client_name} · {h.hours.toFixed(1)}h · {h.entry_id}
                        </span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap' }}>
                        {money(h.amount)}
                      </div>
                    </div>
                    {flag && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: T.gold,
                          background: 'rgba(169,132,53,.1)', border: '1px solid rgba(169,132,53,.3)',
                          borderRadius: 5, padding: '2px 7px',
                        }}>
                          {flag.check_name} · {flag.severity}
                        </span>
                        <span style={{ fontSize: 12, color: T.muted }}>{flag.message}</span>
                      </div>
                    )}
                    <button
                      onClick={() => nav('/brief')}
                      style={{
                        justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6,
                        marginTop: 2, background: T.forest, color: T.brass,
                        fontSize: 12.5, fontWeight: 600, padding: '8px 14px',
                        borderRadius: 8, border: 'none', cursor: 'pointer',
                      }}
                    >
                      Resolve in closeout <Icon name="arrow" size={12} color={T.brass} />
                    </button>
                  </div>
                );
              })
            )}
          </section>

          {/* right column: scrubber + realization */}
          <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>

            {/* pre-bill scrubber */}
            <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '15px 17px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.09em', color: T.muted, fontWeight: 600 }}>
                  Pre-bill scrubber
                </span>
                <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: flaggedTotal ? T.gold : T.teal }}>
                  {flaggedTotal} flag{flaggedTotal !== 1 ? 's' : ''} · {scrubberRules.length} rules
                </span>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {scrubberRules.map(r => (
                  <div key={r.rule} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 15, height: 15, borderRadius: 999,
                      background: r.flagged ? 'rgba(169,132,53,.14)' : 'rgba(29,158,117,.12)',
                      display: 'grid', placeItems: 'center', flexShrink: 0,
                    }}>
                      <Icon name={r.flagged ? 'alert' : 'check'} size={9} color={r.flagged ? T.gold : T.teal} stroke={2.4} />
                    </span>
                    <span style={{ fontSize: 12.5, color: T.ink, flex: 1 }}>{r.rule}</span>
                    {r.flagged > 0 && (
                      <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: T.gold }}>{r.flagged}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* realization */}
            <section style={{ background: T.audit, borderRadius: 14, padding: '15px 17px', display: 'grid', gap: 11 }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.09em', color: T.auditMuted }}>
                Realization
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 30, fontWeight: 600, color: T.auditAccent, lineHeight: 1 }}>
                  {REALIZATION.rate}%
                </span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: T.auditMuted }}>billed vs. worked</span>
              </div>
              <div style={{ display: 'flex', gap: 18, paddingTop: 9, borderTop: `1px solid rgba(214,193,129,.16)` }}>
                <div>
                  <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: T.auditMuted, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block' }}>
                    Unbilled WIP
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#EFEBDB' }}>{money(REALIZATION.unbilledWip)}</span>
                </div>
                <div>
                  <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: T.auditMuted, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block' }}>
                    Write-downs MTD
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#EFEBDB' }}>{money(REALIZATION.writedownsMtd)}</span>
                </div>
              </div>
            </section>

          </div>
        </div>

      </div>
    </div>
  );
}
