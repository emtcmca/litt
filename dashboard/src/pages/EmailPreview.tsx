import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { BriefResponse } from '../types';
import { getBrief } from '../api';
import { clsLabel } from '../labels';

const FIRM_ID = 'strand-okafor';
const ATTORNEY_ID = 'dana-strand';

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ margin: '0 0 12px', paddingBottom: 8, borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
        {title} / {count}
      </h2>
      {children}
    </section>
  );
}

function EmailItem({ accent, children }: { accent: string; children: ReactNode }) {
  return (
    <div style={{ borderLeft: `3px solid ${accent}`, paddingLeft: 12, marginBottom: 16 }}>
      {children}
    </div>
  );
}

export function EmailPreview() {
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBrief(FIRM_ID, ATTORNEY_ID)
      .then(setBrief)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load brief.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'start center', padding: 32, color: 'var(--color-text-tertiary)', fontSize: 14 }}>
        Preparing daily closeout email preview...
      </div>
    );
  }
  if (error || !brief) {
    return (
      <div role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'start center', padding: 32, color: 'var(--color-text-danger)', fontSize: 14 }}>
        {error ?? 'Failed to load brief.'}
      </div>
    );
  }

  const s = brief.sections;
  const date = brief.generated_at.slice(0, 10);

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', color: 'var(--color-text-primary)', background: 'var(--color-background-primary)', minHeight: '100vh' }}>
      <header style={{ borderBottom: '2px solid var(--color-text-primary)', paddingBottom: 14, marginBottom: 28 }}>
        <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          Daily closeout brief / confidential / demo mode
        </p>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 500 }}>Litt / {brief.firm_name}</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>{brief.attorney_name} / {date}</p>
      </header>

      <Section title="Deadlines" count={s.deadlines.count}>
        {s.deadlines.items.map(d => (
          <EmailItem key={d.deadline_id} accent="var(--color-border-danger)">
            <p style={{ margin: '0 0 4px', fontWeight: 500 }}>{clsLabel(d.classification)}</p>
            <p style={{ margin: '0 0 4px' }}>{d.description}</p>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 12 }}>
              Due {d.due_date} ({d.days_out}d) / {d.matter_name} / {d.client_name}{d.is_unconfirmed ? ' / attorney confirmation required' : ''}
            </p>
          </EmailItem>
        ))}
      </Section>

      <Section title="Work in progress" count={s.time_entries.count}>
        {s.time_entries.items.map(e => (
          <EmailItem key={e.entry_id} accent={e.has_block ? 'var(--color-border-danger)' : e.has_warn ? 'var(--color-border-warning)' : 'var(--color-border-info)'}>
            <p style={{ margin: '0 0 4px', fontWeight: 500 }}>
              {e.status}{e.has_block ? ' · Block' : e.has_warn ? ' · Flag' : ''}
            </p>
            <p style={{ margin: '0 0 4px' }}>{e.narrative ?? 'No narrative'}</p>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 12 }}>
              {e.hours}h / ${e.amount.toFixed(2)} / {e.matter_name} / {e.entry_date}
            </p>
            {e.scrubber_flags.map((f, i) => (
              <p key={i} style={{ margin: '4px 0 0', color: f.severity === 'BLOCK' ? 'var(--color-text-danger)' : 'var(--color-text-warning)', fontSize: 12 }}>
                {f.severity === 'BLOCK' ? 'Block' : 'Flag'}: {f.message}{f.matched_text ? ` ("${f.matched_text}")` : ''}
              </p>
            ))}
          </EmailItem>
        ))}
      </Section>

      <Section title="Budget risks" count={s.budget_risks.count}>
        {s.budget_risks.items.map(b => (
          <EmailItem key={b.client_id} accent="var(--color-border-warning)">
            <p style={{ margin: '0 0 4px', fontWeight: 500 }}>{b.client_name}</p>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 12 }}>
              ${b.total_committed.toLocaleString()} / ${b.budget_cap.toLocaleString()} ({b.utilization_pct.toFixed(0)}%)
            </p>
          </EmailItem>
        ))}
      </Section>

      <Section title="Client silence" count={s.client_silence.count}>
        {s.client_silence.items.map(c => (
          <EmailItem key={c.matter_id} accent="var(--color-border-warning)">
            <p style={{ margin: '0 0 4px', fontWeight: 500 }}>{c.client_name}</p>
            <p style={{ margin: 0 }}>{c.client_name} / {c.days_since_contact} days since contact / threshold {c.threshold_days}</p>
          </EmailItem>
        ))}
      </Section>

      <Section title="Anomalies" count={s.anomalies.count}>
        {s.anomalies.items.map(a => (
          <EmailItem key={a.escalation_id} accent={a.risk_level === 'CRITICAL' ? 'var(--color-border-danger)' : 'var(--color-border-warning)'}>
            <p style={{ margin: '0 0 4px', fontWeight: 500 }}>Priority {a.priority}/5 · {a.risk_level.charAt(0) + a.risk_level.slice(1).toLowerCase()}</p>
            <p style={{ margin: '0 0 4px' }}>{a.what_is_happening}</p>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 12 }}>Decision needed: {a.what_attorney_must_decide}</p>
          </EmailItem>
        ))}
      </Section>

      <footer style={{ borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 12, fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
        Generated {brief.generated_at.slice(0, 19).replace('T', ' ')} UTC / Litt v1.1.4 / audit trail enabled
      </footer>
    </main>
  );
}
