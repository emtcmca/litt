import { useCallback, useEffect, useState } from 'react';
import type { RawDeadline } from '../types';
import { getDeadlinesFull } from '../api';

const FIRM_ID = 'strand-okafor';

const CLASS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  HARD_LEGAL:       { label: 'Court / Legal',  color: '#9B2D23', bg: 'rgba(155,45,35,.08)' },
  HARD_CONTRACTUAL: { label: 'Contractual',     color: '#A98435', bg: 'rgba(169,132,53,.08)' },
  SOFT_INTERNAL:    { label: 'Internal',        color: '#1D9E75', bg: 'rgba(29,158,117,.08)' },
  ADMINISTRATIVE:   { label: 'Administrative',  color: '#5C6B64', bg: 'rgba(92,107,100,.08)' },
};

const LEVEL_ORDER = ['CRITICAL', '1_DAY', '3_DAY', '7_DAY', '14_DAY'];
const LEVEL_LABEL: Record<string, string> = {
  CRITICAL: '< 1d',
  '1_DAY':  '1d',
  '3_DAY':  '3d',
  '7_DAY':  '7d',
  '14_DAY': '14d',
};

function DaysChip({ days }: { days: number | null }) {
  if (days == null) return null;
  const color = days < 0 ? '#9B2D23' : days <= 1 ? '#9B2D23' : days <= 3 ? '#A98435' : '#1D9E75';
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
      color, padding: '2px 6px', borderRadius: 4,
      background: `${color}18`,
      border: `1px solid ${color}30`,
      whiteSpace: 'nowrap',
    }}>
      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d out`}
    </span>
  );
}

function VerifBadge({ status }: { status: string }) {
  const isOk = status === 'verified';
  return (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      color: isOk ? '#1D9E75' : '#A98435',
      background: isOk ? 'rgba(29,158,117,.06)' : 'rgba(169,132,53,.06)',
      border: `1px solid ${isOk ? 'rgba(29,158,117,.25)' : 'rgba(169,132,53,.3)'}`,
      borderRadius: 3, padding: '1px 5px',
    }}>
      {isOk ? 'verified' : status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── CadenceLadder ───────────────────────────────────────────────────────────

function CadenceLadder({ deadlines }: { deadlines: RawDeadline[] }) {
  const hardLegal = deadlines.filter(d => d.classification === 'HARD_LEGAL');
  const rung = (maxDays: number) =>
    hardLegal.filter(d => d.days_out != null && d.days_out >= 0 && d.days_out <= maxDays).length;

  const rungs = [
    { label: '14d window', count: rung(14), maxDays: 14 },
    { label: '7d window',  count: rung(7),  maxDays: 7  },
    { label: '3d window',  count: rung(3),  maxDays: 3  },
    { label: '1d window',  count: rung(1),  maxDays: 1  },
  ];

  return (
    <div style={{
      background: '#14221F',
      border: '1px solid rgba(158,225,199,.12)',
      borderRadius: 10,
      padding: '14px 18px',
      display: 'grid', gap: 8,
    }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(158,225,199,.5)', marginBottom: 4 }}>
        Hard Legal Cadence
      </div>
      {rungs.map(r => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 60, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,.45)', flexShrink: 0 }}>
            {r.label}
          </div>
          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, r.count * 20)}%`,
              background: r.count === 0 ? 'rgba(29,158,117,.4)' : r.count === 1 ? '#EF9F27' : '#9B2D23',
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ width: 20, textAlign: 'right', fontSize: 12, fontWeight: 700, color: r.count === 0 ? 'rgba(158,225,199,.5)' : r.count === 1 ? '#EF9F27' : '#9B2D23', fontFamily: 'var(--font-mono)' }}>
            {r.count}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── DeadlineTimeline (45-day horizon) ───────────────────────────────────────

function DeadlineTimeline({ deadlines }: { deadlines: RawDeadline[] }) {
  const horizon = 45;
  const inWindow = deadlines.filter(d => d.days_out != null && d.days_out >= 0 && d.days_out <= horizon);

  if (inWindow.length === 0) {
    return (
      <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 10, padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No deadlines in the next 45 days</div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border-tertiary)', fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)' }}>
        45-day horizon · {inWindow.length} deadline{inWindow.length !== 1 ? 's' : ''}
      </div>
      <div style={{ padding: '12px 16px', display: 'grid', gap: 8 }}>
        {inWindow.map(d => {
          const cs = CLASS_STYLE[d.classification] ?? CLASS_STYLE.ADMINISTRATIVE;
          const pct = Math.min(100, Math.max(3, (1 - (d.days_out ?? 0) / horizon) * 100));
          return (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 160, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--color-text-primary)', fontWeight: 500 }}>
                {d.description}
              </div>
              <div style={{ flex: 1, height: 8, background: 'var(--color-background-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: cs.color, opacity: 0.6, borderRadius: 4 }} />
              </div>
              <DaysChip days={d.days_out} />
              <span style={{ flexShrink: 0, fontSize: 9, fontFamily: 'var(--font-mono)', color: cs.color, background: cs.bg, border: `1px solid ${cs.color}30`, borderRadius: 3, padding: '1px 5px', fontWeight: 600, letterSpacing: '0.04em' }}>
                {cs.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DeadlineBook ────────────────────────────────────────────────────────────

type BookFilter = 'all' | 'unconfirmed' | 'hard_legal' | 'mine';

function DeadlineBook({ deadlines }: { deadlines: RawDeadline[] }) {
  const [filter, setFilter] = useState<BookFilter>('all');

  const tabs: { key: BookFilter; label: string }[] = [
    { key: 'all',         label: 'All' },
    { key: 'unconfirmed', label: 'Needs confirmation' },
    { key: 'hard_legal',  label: 'Court / Legal' },
    { key: 'mine',        label: 'Active' },
  ];

  const filtered = deadlines.filter(d => {
    if (filter === 'unconfirmed') return d.verification_status !== 'verified';
    if (filter === 'hard_legal')  return d.classification === 'HARD_LEGAL';
    if (filter === 'mine')        return d.status === 'ACTIVE';
    return true;
  });

  return (
    <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border-tertiary)', padding: '0 16px' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 12px 8px',
              fontSize: 12, fontWeight: filter === t.key ? 600 : 400,
              color: filter === t.key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              borderBottom: filter === t.key ? '2px solid #14221F' : '2px solid transparent',
            }}
          >
            {t.label}
            <span style={{ marginLeft: 5, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
              {filter === t.key ? filtered.length : ''}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}>
          No deadlines match this filter.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-background-secondary)' }}>
              {['Deadline', 'Matter', 'Classification', 'Due', 'Days out', 'Status'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', fontWeight: 600, borderBottom: '1px solid var(--color-border-tertiary)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => {
              const cs = CLASS_STYLE[d.classification] ?? CLASS_STYLE.ADMINISTRATIVE;
              return (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--color-border-tertiary)', background: i % 2 === 0 ? 'transparent' : 'var(--color-background-secondary)' }}>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500, maxWidth: 240 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.description}</div>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                    {d.matter_id}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.04em', color: cs.color, background: cs.bg, border: `1px solid ${cs.color}30`, borderRadius: 3, padding: '1px 5px' }}>
                      {cs.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {d.due_date ? d.due_date.slice(0, 10) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <DaysChip days={d.days_out} />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <VerifBadge status={d.verification_status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Deadlines page ──────────────────────────────────────────────────────────

export function Deadlines() {
  const [deadlines, setDeadlines] = useState<RawDeadline[] | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getDeadlinesFull(FIRM_ID);
      setDeadlines(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load deadlines');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!deadlines && !error) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Loading deadlines…</div>
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

  const all = deadlines ?? [];
  const active = all.filter(d => d.status === 'ACTIVE');
  const critical = active.filter(d => d.days_out != null && d.days_out >= 0 && d.days_out <= 1);
  const unconfirmed = active.filter(d => d.verification_status !== 'verified');

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
        Deadlines
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Deadline Monitor
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {critical.length > 0 && (
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(155,45,35,.1)', color: '#9B2D23', border: '1px solid rgba(155,45,35,.3)', borderRadius: 5, padding: '2px 8px', fontWeight: 700 }}>
              {critical.length} CRITICAL
            </span>
          )}
          {unconfirmed.length > 0 && (
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(169,132,53,.08)', color: '#A98435', border: '1px solid rgba(169,132,53,.3)', borderRadius: 5, padding: '2px 8px', fontWeight: 600 }}>
              {unconfirmed.length} unconfirmed
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, marginBottom: 20 }}>
        <DeadlineTimeline deadlines={active} />
        <CadenceLadder deadlines={active} />
      </div>

      <DeadlineBook deadlines={all} />
    </div>
  );
}
