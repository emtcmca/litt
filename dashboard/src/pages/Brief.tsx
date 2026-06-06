import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BriefResponse, BriefSections } from '../types';
import { T } from '../tokens';
import { Icon } from '../components/ui/Icon';
import { getBrief, runSweep } from '../api';

const FIRM_ID = 'strand-okafor';

interface Decision {
  id: string;
  gate: 'ESCALATION' | 'REVIEW_REQUIRED' | 'AUTO_SAFE';
  headline: string;
  kind: string;
  client: string;
}

const GATE_COLOR: Record<string, string> = {
  ESCALATION: T.danger,
  REVIEW_REQUIRED: T.gold,
  AUTO_SAFE: T.teal,
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

function deriveDecisions(sections: BriefSections): Decision[] {
  const decs: Decision[] = [];

  for (const d of sections.deadlines.items) {
    const escalating = d.is_unconfirmed && !!d.escalation_level;
    const gate: Decision['gate'] = escalating || d.escalation_level === 'CRITICAL'
      ? 'ESCALATION'
      : d.escalation_level ? 'REVIEW_REQUIRED' : 'AUTO_SAFE';
    if (gate !== 'AUTO_SAFE') {
      decs.push({ id: d.deadline_id, gate, headline: d.description, kind: 'deadline', client: d.client_name });
    }
  }

  for (const e of sections.time_entries.items) {
    const gate: Decision['gate'] = e.has_block ? 'ESCALATION' : e.has_warn ? 'REVIEW_REQUIRED' : 'AUTO_SAFE';
    if (gate !== 'AUTO_SAFE') {
      decs.push({
        id: e.entry_id,
        gate,
        headline: e.narrative ?? `${e.hours}h — ${e.matter_name}`,
        kind: 'billing',
        client: e.client_name,
      });
    }
  }

  for (const a of sections.anomalies.items) {
    const gate: Decision['gate'] = (a.risk_level === 'CRITICAL' || a.risk_level === 'ELEVATED') ? 'ESCALATION' : 'REVIEW_REQUIRED';
    decs.push({ id: a.escalation_id, gate, headline: a.what_is_happening, kind: 'anomaly', client: a.matter_id ?? a.entity_id });
  }

  for (const b of sections.budget_risks.items) {
    decs.push({
      id: `${b.client_id}-budget`,
      gate: b.alert_status === 'CRITICAL' ? 'ESCALATION' : 'REVIEW_REQUIRED',
      headline: `Budget at ${b.utilization_pct}% — ${b.client_name}`,
      kind: 'budget risk',
      client: b.client_name,
    });
  }

  for (const s of sections.client_silence.items) {
    decs.push({
      id: `${s.matter_id}-silence`,
      gate: 'REVIEW_REQUIRED',
      headline: `${s.days_since_contact}d since last contact`,
      kind: 'client silence',
      client: s.client_name,
    });
  }

  const ord: Record<string, number> = { ESCALATION: 0, REVIEW_REQUIRED: 1, AUTO_SAFE: 2 };
  return decs.sort((a, b) => ord[a.gate] - ord[b.gate]);
}

const KIND_LABEL: Record<string, string> = {
  deadline: 'deadline', billing: 'billing', anomaly: 'anomaly',
  'budget risk': 'budget risk', 'client silence': 'client silence',
};

const SCHEDULES = [
  { k: 'daily',   label: 'Daily closeout',          time: '5:00 PM',    sub: 'Every business day' },
  { k: 'morning', label: 'Morning brief',            time: '8:00 AM',    sub: 'Start-of-day scan' },
  { k: 'events',  label: 'On significant events',    time: 'Real-time',  sub: 'New HARD_LEGAL deadline, scrubber block…' },
] as const;

export function Brief() {
  const navigate = useNavigate();
  const [brief,   setBrief]   = useState<BriefResponse | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [sched,   setSched]   = useState({ daily: true, morning: false, events: true });
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await getBrief(FIRM_ID);
      setBrief(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load brief');
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    load();
  }, [load]);

  async function runNow() {
    if (running) return;
    setRunning(true);
    try { await runSweep(FIRM_ID); } catch { /* non-fatal */ }
    setRunning(false);
    navigate('/agents');
  }

  if (!brief && !error) return <div style={{ padding: '28px 32px', fontSize: 13, color: T.muted }}>Loading…</div>;
  if (error) return <div style={{ padding: '28px 32px', fontSize: 13, color: T.danger }}>{error}</div>;

  const decs  = deriveDecisions(brief!.sections);
  const crit  = decs.filter(d => d.gate === 'ESCALATION').length;
  const time  = fmtTime(brief!.generated_at);

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 940, margin: '0 auto', display: 'grid', gap: 20 }}>

        {/* header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Brief</h1>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.teal, background: T.tealSoft, border: '1px solid rgba(29,158,117,.28)', borderRadius: 5, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>the centerpiece</span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '64ch' }}>
            Litt assembles everything that needs you into one closeout — on demand, or on a schedule you set. Everything it surfaces is gated to your judgment and written to the record.
          </p>
        </div>

        {/* dark hero */}
        <section style={{ background: T.audit, borderRadius: 16, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' as const }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: T.auditAccent, boxShadow: `0 0 8px ${T.auditAccent}` }} />
              <span style={{ fontSize: 10.5, textTransform: 'uppercase' as const, letterSpacing: '.1em', color: T.auditMuted, fontFamily: 'var(--font-mono)' }}>Brief ready · assembled {time}</span>
            </div>
            <div style={{ fontSize: 27, fontWeight: 600, color: '#EFEBDB', letterSpacing: '-.01em', lineHeight: 1.15 }}>
              {decs.length} decisions need you{' '}
              {crit > 0 && <span style={{ color: '#F0A8A0' }}>· {crit} critical</span>}
            </div>
            <span style={{ fontSize: 11.5, color: T.auditMuted, marginTop: 6, display: 'block', fontFamily: 'var(--font-mono)' }}>
              Next scheduled run: tomorrow 5:00 PM · 4 agents · 1 deterministic router
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 9 }}>
            <button onClick={() => navigate('/closeout')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', borderRadius: 10, background: T.brass, color: T.forest, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' as const }}>
              Open today's closeout <Icon name="arrow" size={14} color={T.forest} />
            </button>
            <button onClick={runNow} disabled={running} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 20px', borderRadius: 10, background: 'transparent', color: T.brass, border: `1px solid rgba(214,193,129,.35)`, cursor: running ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' as const }}>
              {running
                ? <><span style={{ width: 12, height: 12, border: '2px solid rgba(214,193,129,.4)', borderTopColor: T.brass, borderRadius: 999, display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />Sweeping…</>
                : <><Icon name="refresh" size={14} color={T.brass} />Run brief now</>}
            </button>
          </div>
        </section>

        {/* 2-col body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
          {/* what it surfaced */}
          <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '13px 18px', borderBottom: `1px solid ${T.soft}`, background: T.wash2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '.09em', color: T.muted, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>What this brief surfaced</span>
              <span style={{ fontSize: 11, color: T.faint, fontFamily: 'var(--font-mono)' }}>ranked by pressure</span>
            </div>
            {decs.length === 0 && (
              <div style={{ padding: '20px 18px', fontSize: 13, color: T.faint }}>Nothing needs you right now.</div>
            )}
            {decs.map((d, i) => {
              const col = GATE_COLOR[d.gate];
              return (
                <button key={d.id} onClick={() => navigate('/closeout')} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 11, alignItems: 'center', padding: '12px 18px', borderBottom: i === decs.length - 1 ? 'none' : `1px solid ${T.soft}`, textDecoration: 'none', borderLeft: `3px solid ${d.gate === 'ESCALATION' ? T.danger : 'transparent'}`, width: '100%', background: 'transparent', textAlign: 'left' as const, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: col, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{d.headline}</div>
                    <span style={{ fontSize: 10.5, color: T.faint, fontFamily: 'var(--font-mono)' }}>{KIND_LABEL[d.kind] ?? d.kind} · {d.client}</span>
                  </div>
                  <Icon name="chevron" size={13} color={T.faint} />
                </button>
              );
            })}
          </section>

          {/* schedule */}
          <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '15px 17px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Icon name="clock" size={14} color={T.gold} />
              <span style={{ fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '.09em', color: T.muted, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>Schedule</span>
            </div>
            <div style={{ display: 'grid', gap: 9 }}>
              {SCHEDULES.map(s => {
                const on = sched[s.k];
                return (
                  <button key={s.k} onClick={() => setSched(p => ({ ...p, [s.k]: !p[s.k] }))} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', textAlign: 'left' as const, background: on ? 'rgba(29,158,117,.05)' : T.wash2, border: `1px solid ${on ? 'rgba(29,158,117,.26)' : T.soft}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap' as const }}>{s.label}</span>
                        <span style={{ fontSize: 11, color: on ? T.teal : T.faint, whiteSpace: 'nowrap' as const, fontFamily: 'var(--font-mono)' }}>{s.time}</span>
                      </div>
                      <span style={{ fontSize: 11.5, color: T.muted }}>{s.sub}</span>
                    </div>
                    <span style={{ width: 34, height: 20, borderRadius: 999, background: on ? T.teal : T.faint, position: 'relative' as const, transition: 'background .2s', flexShrink: 0, display: 'block' }}>
                      <span style={{ position: 'absolute' as const, top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: 999, background: '#fff', transition: 'left .2s' }} />
                    </span>
                  </button>
                );
              })}
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 11.5, color: T.faint, lineHeight: 1.5 }}>
              Run on demand anytime with <strong style={{ color: T.muted }}>Run brief now</strong>. Every brief and every decision is appended to the audit log.
            </p>
          </section>
        </div>

      </div>
    </div>
  );
}
