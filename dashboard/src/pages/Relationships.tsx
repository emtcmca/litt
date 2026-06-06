import { useCallback, useEffect, useState } from 'react';
import type { RelationshipMatter } from '../types';
import { getRelationships } from '../api';

const FIRM_ID = 'strand-okafor';

function SilenceBar({ days, threshold }: { days: number; threshold: number }) {
  const pct = Math.min(100, (days / (threshold * 1.5)) * 100);
  const color = days >= threshold ? '#9B2D23' : days >= threshold * 0.75 ? '#A98435' : '#1D9E75';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--color-background-tertiary)', borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
        {days}d
      </span>
    </div>
  );
}

function RelationshipRow({ matter }: { matter: RelationshipMatter }) {
  const days = matter.days_since_contact ?? 0;
  const goingQuiet = matter.going_quiet;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr auto',
      gap: 16,
      padding: '12px 16px',
      borderBottom: '1px solid var(--color-border-tertiary)',
      background: goingQuiet ? 'rgba(155,45,35,.03)' : 'transparent',
      alignItems: 'center',
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {matter.matter_name || matter.matter_id}
        </div>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
          {matter.client_name}
        </div>
      </div>
      <div>
        {matter.days_since_contact != null ? (
          <SilenceBar days={days} threshold={matter.silence_threshold_days} />
        ) : (
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>no contact recorded</span>
        )}
      </div>
      <div>
        {goingQuiet ? (
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            color: '#9B2D23', background: 'rgba(155,45,35,.08)',
            border: '1px solid rgba(155,45,35,.3)',
            borderRadius: 3, padding: '2px 6px',
          }}>
            going quiet
          </span>
        ) : (
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: '#1D9E75', background: 'rgba(29,158,117,.06)',
            border: '1px solid rgba(29,158,117,.25)',
            borderRadius: 3, padding: '2px 6px',
          }}>
            active
          </span>
        )}
      </div>
    </div>
  );
}

export function Relationships() {
  const [matters, setMatters] = useState<RelationshipMatter[] | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getRelationships(FIRM_ID);
      setMatters(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load relationships');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!matters && !error) {
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

  const all = matters ?? [];
  const goingQuiet = all.filter(m => m.going_quiet);
  const healthy    = all.filter(m => !m.going_quiet);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
        Relationships
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Clients & Comms
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {goingQuiet.length > 0 && (
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(155,45,35,.1)', color: '#9B2D23', border: '1px solid rgba(155,45,35,.3)', borderRadius: 5, padding: '2px 8px', fontWeight: 700 }}>
              {goingQuiet.length} going quiet
            </span>
          )}
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(29,158,117,.06)', color: '#1D9E75', border: '1px solid rgba(29,158,117,.25)', borderRadius: 5, padding: '2px 8px', fontWeight: 600 }}>
            {healthy.length} active
          </span>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Going quiet',     value: goingQuiet.length, color: '#9B2D23' },
          { label: 'Active matters',  value: all.length,         color: '#1D9E75' },
          { label: 'Silence threshold', value: `${all[0]?.silence_threshold_days ?? 14}d`, color: '#A98435' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)',
            borderRadius: 8, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Relationship board */}
      <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border-tertiary)', display: 'flex', gap: 16 }}>
          {[
            { label: 'Matter', width: '1fr' },
            { label: `Days since contact (threshold)`, width: '1fr' },
            { label: 'Status', width: 'auto' },
          ].map(h => (
            <div key={h.label} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>
              {h.label}
            </div>
          ))}
        </div>
        {all.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            No active matters found.
          </div>
        ) : (
          all.map(m => <RelationshipRow key={m.matter_id} matter={m} />)
        )}
      </div>

      {/* How Litt handles comms */}
      <div style={{
        marginTop: 20,
        background: '#14221F',
        border: '1px solid rgba(158,225,199,.12)',
        borderRadius: 10,
        padding: '16px 20px',
      }}>
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
