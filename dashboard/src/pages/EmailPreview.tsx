import { useEffect, useState } from 'react';
import type { BriefResponse } from '../types';
import { getBrief } from '../api';

const FIRM_ID = 'strand-okafor';
const ATTORNEY_ID = 'dana-strand';

export function EmailPreview() {
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBrief(FIRM_ID, ATTORNEY_ID).then(setBrief).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading…</div>;
  if (!brief) return <div className="p-8 text-red-600 text-sm">Failed to load brief.</div>;

  const s = brief.sections;
  const date = brief.generated_at.slice(0, 10);

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 text-sm text-gray-800" style={{ fontFamily: 'ui-monospace, "Cascadia Code", monospace' }}>
      <div className="border-b-2 border-gray-900 pb-3 mb-6">
        <p className="text-xs text-gray-400 mb-1 uppercase tracking-widest">DAILY CLOSEOUT BRIEF — CONFIDENTIAL — DEMO MODE</p>
        <h1 className="text-2xl font-bold text-gray-900">Litt / {brief.firm_name}</h1>
        <p className="text-xs text-gray-500 mt-1">{brief.attorney_name} · {date}</p>
      </div>

      {s.deadlines.count > 0 && (
        <section className="mb-7">
          <h2 className="font-bold uppercase text-xs tracking-widest text-gray-900 border-b border-gray-300 pb-1 mb-3">
            ■ DEADLINES ({s.deadlines.count})
          </h2>
          {s.deadlines.items.map(d => (
            <div key={d.deadline_id} className="mb-4 pl-3 border-l-2 border-red-400">
              <p className="font-bold">{d.classification} · {d.deadline_id}</p>
              <p>{d.description}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Due {d.due_date} ({d.days_out}d) · {d.matter_name} · {d.client_name}
                {d.is_unconfirmed ? ' · UNCONFIRMED' : ''}
              </p>
            </div>
          ))}
        </section>
      )}

      {s.time_entries.count > 0 && (
        <section className="mb-7">
          <h2 className="font-bold uppercase text-xs tracking-widest text-gray-900 border-b border-gray-300 pb-1 mb-3">
            ■ WIP ENTRIES ({s.time_entries.count}) — ${s.time_entries.total_wip_usd.toLocaleString()} total
          </h2>
          {s.time_entries.items.map(e => (
            <div key={e.entry_id} className="mb-4 pl-3 border-l-2 border-amber-400">
              <p className="font-bold">
                {e.entry_id} · {e.status}
                {e.has_block ? ' [BLOCK]' : e.has_warn ? ' [WARN]' : ''}
              </p>
              <p>{e.narrative ?? '(no narrative)'}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {e.hours}h · ${e.amount.toFixed(2)} · {e.matter_name} · {e.entry_date}
              </p>
              {e.scrubber_flags.map((f, i) => (
                <p key={i} className="text-red-600 text-xs mt-0.5">
                  → {f.severity}: {f.message}{f.matched_text ? ` ("${f.matched_text}")` : ''}
                </p>
              ))}
            </div>
          ))}
        </section>
      )}

      {s.budget_risks.count > 0 && (
        <section className="mb-7">
          <h2 className="font-bold uppercase text-xs tracking-widest text-gray-900 border-b border-gray-300 pb-1 mb-3">
            ■ BUDGET RISKS ({s.budget_risks.count})
          </h2>
          {s.budget_risks.items.map(b => (
            <div key={b.client_id} className="mb-4 pl-3 border-l-2 border-orange-400">
              <p className="font-bold">{b.alert_status} · {b.client_name}</p>
              <p className="text-xs text-gray-500">
                ${b.total_committed.toLocaleString()} / ${b.budget_cap.toLocaleString()} ({(b.utilization_pct * 100).toFixed(0)}%)
              </p>
            </div>
          ))}
        </section>
      )}

      {s.client_silence.count > 0 && (
        <section className="mb-7">
          <h2 className="font-bold uppercase text-xs tracking-widest text-gray-900 border-b border-gray-300 pb-1 mb-3">
            ■ CLIENT SILENCE ({s.client_silence.count})
          </h2>
          {s.client_silence.items.map(c => (
            <div key={c.matter_id} className="mb-4 pl-3 border-l-2 border-purple-400">
              <p className="font-bold">{c.matter_id}</p>
              <p>{c.client_name} — {c.days_since_contact} days since contact (threshold {c.threshold_days})</p>
              {c.comm_draft_id && <p className="text-xs text-gray-500">Draft ready: {c.comm_draft_id}</p>}
            </div>
          ))}
        </section>
      )}

      {s.anomalies.count > 0 && (
        <section className="mb-7">
          <h2 className="font-bold uppercase text-xs tracking-widest text-gray-900 border-b border-gray-300 pb-1 mb-3">
            ■ ANOMALIES ({s.anomalies.count})
          </h2>
          {s.anomalies.items.map(a => (
            <div key={a.escalation_id} className="mb-4 pl-3 border-l-2 border-gray-400">
              <p className="font-bold">{a.risk_level} P{a.priority}/5 · {a.entity_id}</p>
              <p>{a.what_is_happening}</p>
              <p className="text-gray-500 text-xs mt-0.5">→ {a.what_attorney_must_decide}</p>
            </div>
          ))}
        </section>
      )}

      <div className="border-t border-gray-200 pt-3 text-xs text-gray-400">
        Generated {brief.generated_at.slice(0, 19).replace('T', ' ')} UTC · Litt v1.0 · Defensible audit trail enabled
      </div>
    </div>
  );
}
