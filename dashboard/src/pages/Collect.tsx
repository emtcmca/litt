import { useCallback, useEffect, useState } from 'react';
import type { BriefResponse, BriefTimeEntryItem, ScrubberFlag } from '../types';
import { getBrief, downloadLedesExport, approveBilling } from '../api';

const FIRM_ID      = 'strand-okafor';
const ATTORNEY_ID  = 'dana-strand';

function ScrubChip({ flag }: { flag: ScrubberFlag }) {
  const isBlock = flag.severity === 'BLOCK';
  return (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      color: isBlock ? '#9B2D23' : '#A98435',
      background: isBlock ? 'rgba(155,45,35,.08)' : 'rgba(169,132,53,.08)',
      border: `1px solid ${isBlock ? 'rgba(155,45,35,.3)' : 'rgba(169,132,53,.3)'}`,
      borderRadius: 3, padding: '1px 5px',
    }}>
      {flag.severity}
    </span>
  );
}

function EntryRow({
  item,
  onApproved,
}: {
  item: BriefTimeEntryItem;
  onApproved: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const canApprove = !item.has_block && item.status === 'PENDING';

  async function handleApprove() {
    setApproving(true);
    setApproveError(null);
    try {
      await approveBilling({
        firm_id: FIRM_ID,
        attorney_id: ATTORNEY_ID,
        entry_id: item.entry_id,
        expected_version: item.version,
        idempotency_key: `approve-${item.entry_id}-${Date.now()}`,
      });
      onApproved(item.entry_id);
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setApproving(false);
    }
  }

  const borderColor = item.has_block ? '#9B2D23' : item.has_warn ? '#A98435' : 'var(--color-border-tertiary)';

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: `1px solid ${borderColor}`,
      borderLeft: item.has_block ? '3px solid #9B2D23' : item.has_warn ? '3px solid #A98435' : '1px solid var(--color-border-tertiary)',
      borderRadius: 8, overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          cursor: 'pointer', padding: '10px 14px',
          display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 3 }}>
            {item.narrative || <em style={{ color: 'var(--color-text-tertiary)' }}>no narrative</em>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
              {item.matter_name} · {item.client_name}
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
              {item.entry_date}
            </span>
            {item.task_code && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', background: 'var(--color-background-tertiary)', borderRadius: 3, padding: '1px 4px' }}>
                {item.task_code}{item.activity_code ? `/${item.activity_code}` : ''}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {item.scrubber_flags.slice(0, 3).map((f, i) => <ScrubChip key={i} flag={f} />)}
          {item.scrubber_flags.length > 3 && (
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>+{item.scrubber_flags.length - 3}</span>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
            ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
            {item.hours}h
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid var(--color-border-tertiary)' }}>
          {/* Scrubber flags detail */}
          {item.scrubber_flags.length > 0 && (
            <div style={{ marginTop: 10, marginBottom: 10 }}>
              {item.scrubber_flags.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                  <ScrubChip flag={f} />
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{f.message}</span>
                  {f.matched_text && (
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
                      "{f.matched_text}"
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Suggested narrative */}
          {item.suggested_narrative && (
            <div style={{
              marginTop: 8, padding: '8px 10px',
              background: '#14221F', border: '1px solid rgba(158,225,199,.12)', borderRadius: 6,
            }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(158,225,199,.5)', marginBottom: 4 }}>
                Gemini suggested narrative
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }}>
                {item.suggested_narrative}
              </div>
            </div>
          )}

          {/* Actions */}
          {canApprove && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={(e) => { e.stopPropagation(); handleApprove(); }}
                disabled={approving}
                style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                  color: '#1D9E75', background: 'rgba(29,158,117,.06)',
                  border: '1px solid rgba(29,158,117,.3)', borderRadius: 4,
                  padding: '4px 10px', cursor: approving ? 'not-allowed' : 'pointer',
                  opacity: approving ? 0.6 : 1,
                }}
              >
                {approving ? 'Approving…' : 'Approve'}
              </button>
              {approveError && <span style={{ fontSize: 11, color: '#9B2D23' }}>{approveError}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Collect() {
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const data = await getBrief(FIRM_ID);
      setBrief(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing data');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!brief && !error) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div style={{ fontSize: 13, color: '#9B2D23', marginBottom: 8 }}>{error}</div>
        <button onClick={load} style={{ fontSize: 12, color: '#1D9E75', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
      </div>
    );
  }

  const allEntries: BriefTimeEntryItem[] = brief?.sections.time_entries.items ?? [];
  const visibleEntries = allEntries.filter(e => !approvedIds.has(e.entry_id));
  const blocked = visibleEntries.filter(e => e.has_block);
  const warned  = visibleEntries.filter(e => !e.has_block && e.has_warn);
  const clean   = visibleEntries.filter(e => !e.has_block && !e.has_warn);
  const totalWip = brief?.sections.time_entries.total_wip_usd ?? 0;

  function handleApproved(id: string) {
    setApprovedIds(prev => new Set([...prev, id]));
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
        Collect
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Billing & WIP
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {blocked.length > 0 && (
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(155,45,35,.1)', color: '#9B2D23', border: '1px solid rgba(155,45,35,.3)', borderRadius: 5, padding: '2px 8px', fontWeight: 700 }}>
                {blocked.length} blocked
              </span>
            )}
            {warned.length > 0 && (
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(169,132,53,.08)', color: '#A98435', border: '1px solid rgba(169,132,53,.3)', borderRadius: 5, padding: '2px 8px', fontWeight: 600 }}>
                {warned.length} warn
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => downloadLedesExport(FIRM_ID).catch(() => null)}
          style={{
            fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: '#1D9E75', background: 'rgba(29,158,117,.06)',
            border: '1px solid rgba(29,158,117,.25)', borderRadius: 5,
            padding: '5px 12px', cursor: 'pointer',
          }}
        >
          Export LEDES
        </button>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total WIP',     value: `$${totalWip.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'var(--color-text-primary)' },
          { label: 'Entries',       value: visibleEntries.length, color: 'var(--color-text-primary)' },
          { label: 'Scrubber blocks', value: blocked.length, color: blocked.length > 0 ? '#9B2D23' : 'var(--color-text-secondary)' },
          { label: 'Clean entries', value: clean.length,   color: '#1D9E75' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)',
            borderRadius: 8, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {visibleEntries.length === 0 ? (
        <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 10, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No pending time entries in current brief.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {visibleEntries.map(entry => (
            <EntryRow key={entry.entry_id} item={entry} onApproved={handleApproved} />
          ))}
        </div>
      )}
    </div>
  );
}
