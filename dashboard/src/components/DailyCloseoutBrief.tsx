import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import type {
  AgentObservation,
  AgentRunTimeline as AgentRunTimelineType,
  BriefAnomalyItem,
  BriefBudgetItem,
  BriefClientSilenceItem,
  BriefDeadlineItem,
  BriefResponse,
  BriefTimeEntryItem,
  ToolResult,
} from '../types';
import { getBrief, runSweep } from '../api';
import { DeadlineModal } from './modals/DeadlineModal';
import type { DeadlineAction } from './modals/DeadlineModal';
import { BillingWIPModal } from './modals/BillingWIPModal';
import type { BillingAction } from './modals/BillingWIPModal';
import { ClientCommsModal } from './modals/ClientCommsModal';
import { BudgetModal } from './modals/BudgetModal';
import { AnomalyModal } from './modals/AnomalyModal';
import { AuditEventDrawer } from './shared/AuditEventDrawer';
import { DemoBanner } from './DemoBanner';
import { DemoResetButton } from './DemoResetButton';

// ─── Constants ────────────────────────────────────────────────────────────────

const FIRM_ID = 'strand-okafor';
const ATTORNEY_ID = 'dana-strand';

// ─── Palette tokens (mockup-aligned) ─────────────────────────────────────────

const C = {
  bg:          'var(--color-background-tertiary)',
  paper:       'var(--color-background-primary)',
  surface:     '#FFFFFF',
  navRail:     '#EAE3D5',
  line:        'var(--color-border-tertiary)',
  soft:        'rgba(0,0,0,0.07)',
  ink:         'var(--color-text-primary)',
  muted:       'var(--color-text-secondary)',
  forest:      '#14221F',
  brass:       '#D6C181',
  teal:        '#1D9E75',
  tealSoft:    'rgba(29,158,117,.1)',
  danger:      '#9B2D23',
  dangerSoft:  '#F3DED7',
  gold:        '#A98435',
  audit:       '#101713',
  auditLine:   'rgba(214,193,129,.28)',
  auditMuted:  '#AEB8A4',
  auditAccent: '#9EE1C7',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type GateLevel = 'ESCALATION' | 'REVIEW_REQUIRED' | 'BLOCKED' | 'AUTO_SAFE';

type OpenModal =
  | { type: 'deadline'; item: BriefDeadlineItem;      action: DeadlineAction }
  | { type: 'billing';  item: BriefTimeEntryItem;     action: BillingAction  }
  | { type: 'comms';    item: BriefClientSilenceItem               }
  | { type: 'budget';   item: BriefBudgetItem                      }
  | { type: 'anomaly';  item: BriefAnomalyItem                     };

interface ResolvedItem {
  sectionId:    string;
  entityId:     string;
  entityType:   string;
  auditEventId: string;
  resolvedAt:   string;
}

interface DecisionRow {
  id:                  string;
  gate:                GateLevel;
  title:               string;
  description:         string;
  matterRisk:          string;
  confidence?:         { pct: number; source: string; missing?: string };
  boundary:            { label: string; route: string; llm: string; extra: string };
  actionLabel:         string;
  onAction:            () => void;
  isEscalationDeadline?: boolean;
}

interface PressureData {
  score:        number;
  deadlineDays: number | null;
  budgetPct:    number | null;
  wipUsd:       number;
  silenceDays:  number | null;
}

// ─── Gate badge ───────────────────────────────────────────────────────────────

const GATE_SPEC: Record<GateLevel, CSSProperties> = {
  ESCALATION:      { background: '#9B2D23', color: '#FFFFFF' },
  REVIEW_REQUIRED: { background: '#A98435', color: '#FFF7E4' },
  BLOCKED:         { background: '#14221F', color: '#D6C181' },
  AUTO_SAFE:       { background: 'rgba(29,158,117,.1)', color: '#1D9E75', border: '1px solid rgba(29,158,117,.26)' },
};

function GateBadge({ gate }: { gate: GateLevel }) {
  return (
    <span style={{
      display: 'inline-flex',
      width: 'fit-content',
      borderRadius: 6,
      padding: '5px 7px',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.03em',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      alignSelf: 'start',
      ...GATE_SPEC[gate],
    }}>
      {gate}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computePressureIndex(brief: BriefResponse): PressureData {
  const { deadlines, budget_risks, client_silence, time_entries, anomalies } = brief.sections;

  const nearest = [...deadlines.items]
    .filter(d => d.classification === 'HARD_LEGAL' || d.classification === 'HARD_CONTRACTUAL')
    .sort((a, b) => a.days_out - b.days_out)[0];

  const maxBudget = budget_risks.items.length > 0
    ? Math.max(...budget_risks.items.map(b => b.utilization_pct))
    : 0;

  const maxSilence = client_silence.items.length > 0
    ? Math.max(...client_silence.items.map(s => s.days_since_contact))
    : 0;

  const wip = time_entries.total_wip_usd;

  let score = 0;
  if (nearest) {
    if (nearest.days_out <= 7)       score += 34;
    else if (nearest.days_out <= 14) score += 18;
    else if (nearest.days_out <= 30) score += 8;
  }
  if (maxBudget >= 75)     score += 22;
  else if (maxBudget >= 50) score += 10;
  if (wip >= 3000)         score += 12;
  else if (wip >= 1000)    score += 6;
  if (maxSilence >= 14)    score += 10;
  else if (maxSilence >= 7) score += 5;
  score += anomalies.items.filter(a => a.risk_level === 'CRITICAL').length * 4;

  return {
    score:        Math.min(score, 100),
    deadlineDays: nearest?.days_out ?? null,
    budgetPct:    maxBudget || null,
    wipUsd:       wip,
    silenceDays:  maxSilence || null,
  };
}

const GATE_PRIORITY: Record<GateLevel, number> = {
  ESCALATION: 0, BLOCKED: 1, REVIEW_REQUIRED: 2, AUTO_SAFE: 3,
};

function buildDecisionRows(
  brief: BriefResponse,
  openModal: (m: OpenModal) => void,
): DecisionRow[] {
  const rows: DecisionRow[] = [];
  const { deadlines, time_entries, budget_risks, client_silence, anomalies } = brief.sections;

  for (const d of deadlines.items) {
    const isEsc = d.classification === 'HARD_LEGAL' && d.is_unconfirmed;
    rows.push({
      id:          d.deadline_id,
      gate:        isEsc ? 'ESCALATION'
                 : (d.classification === 'HARD_LEGAL' || d.classification === 'HARD_CONTRACTUAL')
                   ? 'REVIEW_REQUIRED' : 'AUTO_SAFE',
      title:       isEsc
                 ? `${d.matter_name} deadline unresolved`
                 : `${d.matter_name} — ${d.days_out}d deadline${d.is_unconfirmed ? ' unconfirmed' : ''}`,
      description: isEsc
                 ? `Opposing counsel email indicates response due, but no court order found in firm sources. Litt escalates rather than guessing.`
                 : `${d.description}. ${d.days_out} days until ${d.due_date}. Attorney confirmation required before closeout.`,
      matterRisk:  'risk: malpractice exposure / missed filing deadline',
      ...(isEsc && { confidence: { pct: 70, source: 'opposing counsel email', missing: 'court order' } }),
      boundary: {
        label: isEsc ? 'Transparent Confidence' : 'Python boundary',
        route: 'deadline_agent',
        llm:   'none',
        extra: isEsc ? 'decision=ESCALATION' : 'tool=confirm_deadline',
      },
      actionLabel:         isEsc ? 'Review' : 'Confirm',
      onAction:            () => openModal({ type: 'deadline', item: d, action: 'confirm' }),
      isEscalationDeadline: isEsc,
    });
  }

  for (const e of time_entries.items) {
    const blockFlag = e.scrubber_flags.find(f => f.severity === 'BLOCK');
    rows.push({
      id:   e.entry_id,
      gate: e.has_block ? 'BLOCKED' : 'REVIEW_REQUIRED',
      title: blockFlag
        ? `Billing scrubber hit: "${blockFlag.matched_text ?? 'blocked phrase'}"`
        : !e.narrative
        ? `Time entry missing narrative — ${e.matter_name}`
        : `Billing entry pending approval — ${e.matter_name}`,
      description: e.has_block
        ? 'Likely LEDES rejection with write-down and narrative repair paths available.'
        : !e.narrative
        ? 'No narrative — reconstruction risk. Add before approving.'
        : `${e.hours}h · ${e.matter_name} · $${e.amount.toFixed(0)}`,
      matterRisk: e.has_block
        ? 'risk: invoice rejection / delayed cash collection'
        : 'risk: reconstruction risk / billing anomaly',
      boundary: {
        label: 'Python boundary',
        route: 'billing_agent',
        llm:   'none',
        extra: 'tool=scrub_time_entry',
      },
      actionLabel: 'Resolve',
      onAction:    () => openModal({ type: 'billing', item: e, action: e.has_block ? 'write-down' : 'approve' }),
    });
  }

  for (const b of budget_risks.items) {
    rows.push({
      id:          b.client_id,
      gate:        b.alert_status === 'CRITICAL' ? 'REVIEW_REQUIRED' : 'AUTO_SAFE',
      title:       `${b.client_name} budget pressure logged`,
      description: `Utilization at ${b.utilization_pct.toFixed(0)}% of $${b.budget_cap.toLocaleString()} retainer.${b.alert_status === 'CRITICAL' ? ' Overrun risk.' : ' Warning threshold crossed.'}`,
      matterRisk:  'risk: budget surprise / client trust erosion',
      boundary: {
        label: 'Python boundary',
        route: 'anomaly_agent',
        llm:   'none',
        extra: 'math=deterministic',
      },
      actionLabel: 'Inspect',
      onAction:    () => openModal({ type: 'budget', item: b }),
    });
  }

  for (const s of client_silence.items) {
    const hasDraft = !!s.comm_draft_id;
    rows.push({
      id:          s.matter_id,
      gate:        hasDraft ? 'BLOCKED' : 'REVIEW_REQUIRED',
      title:       `${s.client_name} quiet for ${s.days_since_contact} days`,
      description: hasDraft
        ? 'Comms agent prepared outreach draft. Litt will not send without attorney approval.'
        : `Client has not been contacted in ${s.days_since_contact} days. Threshold: ${s.threshold_days} days.`,
      matterRisk:  'risk: client churn / silent matter perception',
      boundary: {
        label: 'Comms agent',
        route: 'comms_agent',
        llm:   hasDraft ? 'draft_narrative' : 'none',
        extra: hasDraft ? 'write=tool_layer' : 'gate=silence_check',
      },
      actionLabel: hasDraft ? 'Draft' : 'View',
      onAction:    () => openModal({ type: 'comms', item: s }),
    });
  }

  for (const a of anomalies.items) {
    rows.push({
      id:          a.escalation_id,
      gate:        a.risk_level === 'CRITICAL' ? 'ESCALATION'
                 : a.risk_level === 'ELEVATED'  ? 'REVIEW_REQUIRED' : 'AUTO_SAFE',
      title:       a.what_is_happening,
      description: a.why_it_matters,
      matterRisk:  `decision needed: ${a.what_attorney_must_decide}`,
      boundary: {
        label: 'Python boundary',
        route: 'anomaly_agent',
        llm:   'none',
        extra: `risk=${a.risk_level.toLowerCase()}`,
      },
      actionLabel: 'Review',
      onAction:    () => openModal({ type: 'anomaly', item: a }),
    });
  }

  return rows.sort((a, b) => GATE_PRIORITY[a.gate] - GATE_PRIORITY[b.gate]);
}

// ─── NavPanel ─────────────────────────────────────────────────────────────────

function NavPanel({ brief }: { brief: BriefResponse }) {
  const { deadlines, time_entries, client_silence } = brief.sections;
  const totalDecisions =
    deadlines.count + time_entries.count + client_silence.count + brief.sections.anomalies.count;

  const labelStyle: CSSProperties = {
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: C.muted,
    fontSize: 10,
  };

  return (
    <nav style={{
      background:     C.navRail,
      borderRight:    `1px solid ${C.line}`,
      padding:        16,
      display:        'grid',
      alignContent:   'start',
      gap:            15,
      overflowY:      'auto',
    }}>
      {/* Ops card */}
      <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 12, padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
        <img src="/icons-logo/prepare-icon.png" alt="" style={{ width: 44, height: 44, objectFit: 'contain', mixBlendMode: 'multiply', flexShrink: 0 }} />
        <div>
          <strong style={{ display: 'block', fontSize: 13, color: C.ink }}>Ops control</strong>
          <span style={{ display: 'block', marginTop: 3, color: C.muted, fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Prepared layer
          </span>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={labelStyle}>Closeout</span>
        {([
          { label: 'Decision docket', count: totalDecisions,         active: true  },
          { label: 'Deadline risk',   count: deadlines.count,        active: false },
          { label: 'Billing WIP',     count: time_entries.count,     active: false },
          { label: 'Client silence',  count: client_silence.count,   active: false },
        ] as { label: string; count: number; active: boolean }[]).map(({ label, count, active }) => (
          <div key={label} style={{
            display:        'flex',
            justifyContent: 'space-between',
            gap:            14,
            padding:        '9px 10px',
            borderRadius:   6,
            background:     active ? C.forest : 'transparent',
            color:          active ? C.brass  : C.ink,
            fontSize:       13,
          }}>
            <span>{label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.8 }}>{count}</span>
          </div>
        ))}
      </div>

      {/* Architecture mini-map */}
      <div style={{ background: 'rgba(255,253,248,.72)', border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
        <span style={labelStyle}>Agent architecture</span>
        <div style={{ display: 'grid', gap: 7 }}>
          {(['Signals', 'Python router', 'Domain agents', 'Tool write path', 'Append-only audit log'] as string[]).map((step, i) => (
            <div key={step} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 8, alignItems: 'start' }}>
              <span style={{
                width: 18, height: 18, borderRadius: 999,
                background: C.forest, color: C.brass,
                display: 'grid', placeItems: 'center',
                fontSize: 9, fontWeight: 700, flexShrink: 0,
              }}>{i + 1}</span>
              <span style={{ paddingTop: 2, color: C.muted, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gate legend */}
      <div style={{ background: 'rgba(255,253,248,.72)', border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
        <span style={labelStyle}>Gate model</span>
        {([
          ['ESCALATION',      C.danger,  'Cannot resolve alone.'],
          ['REVIEW_REQUIRED', C.gold,    'Attorney judgment needed.'],
          ['BLOCKED',         C.forest,  'Prepared, not sent.'],
          ['AUTO_SAFE',       C.teal,    'Safe to log or monitor.'],
        ] as [string, string, string][]).map(([gate, color, desc]) => (
          <div key={gate} style={{ display: 'grid', gridTemplateColumns: '10px 1fr', gap: 8, alignItems: 'start' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: color, marginTop: 3, flexShrink: 0 }} />
            <div>
              <strong style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: C.ink }}>{gate}</strong>
              <span style={{ display: 'block', color: C.muted, fontSize: 11, lineHeight: 1.25 }}>{desc}</span>
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

// ─── PressureSection ──────────────────────────────────────────────────────────

const MATRIX_PRESETS: Record<string, string[]> = {
  high:   ['hot','hot','hot','gold','gold','on','on',''],
  medium: ['gold','gold','gold','on','on','on','',''],
  low:    ['on','on','on','on','','','',''],
};
const CELL_COLORS: Record<string, string> = {
  hot: '#9B2D23', gold: '#A98435', on: '#1D9E75', '': '#D8D0BE',
};

function PressureSection({ pressure, brief }: { pressure: PressureData; brief: BriefResponse }) {
  const [tab, setTab] = useState<'pressure' | 'audit' | 'agents'>('pressure');

  const preset = pressure.score >= 60 ? 'high' : pressure.score >= 40 ? 'medium' : 'low';
  const cells = MATRIX_PRESETS[preset];

  const tabBtn = (t: typeof tab): CSSProperties => ({
    border:        `1px solid ${t === tab ? C.forest : C.line}`,
    borderRadius:  999,
    padding:       8,
    textAlign:     'center',
    fontFamily:    'var(--font-mono)',
    fontSize:      10,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color:         t === tab ? C.brass   : C.muted,
    background:    t === tab ? C.forest  : C.paper,
    cursor:        'pointer',
  });

  const metricCard = (label: string, value: string, hint: string) => (
    <div key={label} style={{ border: `1px solid ${C.soft}`, borderRadius: 10, padding: 10, background: '#fbf8f0', display: 'grid', gap: 6 }}>
      <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, fontSize: 10 }}>{label}</span>
      <strong style={{ fontSize: 18, color: C.ink }}>{value}</strong>
      <p style={{ margin: 0, color: C.muted, fontSize: 12, lineHeight: 1.35 }}>{hint}</p>
    </div>
  );

  return (
    <section style={{ display: 'grid', gridTemplateColumns: '176px 1fr', border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden', background: C.surface }}>
      {/* Score */}
      <div style={{ background: C.forest, color: C.brass, padding: 18, display: 'grid', gap: 10, alignContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, color: C.auditMuted }}>
          Operational pressure
        </span>
        <div>
          <b style={{ fontSize: 68, lineHeight: 0.82, color: C.brass }}>{pressure.score}</b>
          <span style={{ color: C.auditMuted, fontSize: 12 }}> / 100 elevated</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 3 }}>
          {cells.map((type, i) => (
            <span key={i} style={{ height: 9, borderRadius: 3, background: CELL_COLORS[type] }} />
          ))}
        </div>
      </div>

      {/* Intel tabs */}
      <div style={{ padding: 15, display: 'grid', gap: 13 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
          {(['pressure', 'audit', 'agents'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={tabBtn(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'pressure' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              {
                label: 'Deadline horizon',
                value: pressure.deadlineDays != null ? `${pressure.deadlineDays} days` : '—',
                hint:  'Hard legal date unconfirmed.',
                pct:   pressure.deadlineDays != null ? Math.max(0, 100 - pressure.deadlineDays * 5) : 0,
                barType: 'hot',
              },
              {
                label: 'Budget pressure',
                value: pressure.budgetPct != null ? `${pressure.budgetPct.toFixed(0)}%` : '—',
                hint:  'Retainer utilization.',
                pct:   pressure.budgetPct ?? 0,
                barType: 'gold',
              },
              {
                label: 'WIP exposure',
                value: pressure.wipUsd > 0 ? `$${pressure.wipUsd.toLocaleString()}` : '—',
                hint:  'Pending approval.',
                pct:   Math.min((pressure.wipUsd / 6000) * 100, 100),
                barType: 'gold',
              },
              {
                label: 'Client silence',
                value: pressure.silenceDays != null ? `${pressure.silenceDays} days` : '—',
                hint:  'Outreach staged.',
                pct:   pressure.silenceDays != null ? Math.min((pressure.silenceDays / 30) * 100, 100) : 0,
                barType: 'teal',
              },
            ].map(({ label, value, hint, pct, barType }) => (
              <div key={label} style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontSize: 10 }}>{label}</span>
                <strong style={{ fontSize: 18, color: C.ink }}>{value}</strong>
                <p style={{ margin: 0, color: C.muted, fontSize: 12, lineHeight: 1.35 }}>{hint}</p>
                <div style={{ height: 7, borderRadius: 999, background: '#DFE5DC', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: barType === 'hot' ? C.danger : barType === 'gold' ? C.gold : C.teal }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {metricCard('Write path', 'tools only', 'Agents never write Firestore.')}
            {metricCard('Receipts',   '12',         'Actor, entity, timestamp, before/after.')}
            {metricCard('Lock',       'expected',   'Optimistic status checked on every write.')}
          </div>
        )}

        {tab === 'agents' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {metricCard('Python',      '31 checks',   'Routing, state, math, scoring.')}
            {metricCard('Gemini',      'drafts only', 'Narrative for human review.')}
            {metricCard('Coordinator', 'router',      'No LLM routing decisions.')}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── DecisionRowItem ──────────────────────────────────────────────────────────

interface DecisionRowItemProps {
  row:                DecisionRow;
  isReceipted:        boolean;
  isCollapsing:       boolean;
  isLast:             boolean;
  auditEventId?:      string;
  onOpenSourceDrawer?: () => void;
  onActionClick:      () => void;
}

function DecisionRowItem({
  row, isReceipted, isCollapsing, isLast, auditEventId, onOpenSourceDrawer, onActionClick,
}: DecisionRowItemProps) {
  const rowStyle: CSSProperties = {
    position:    'relative',
    display:     'grid',
    gridTemplateColumns: '128px 1fr 220px 100px',
    gap:         14,
    alignItems:  'center',
    padding:     isCollapsing ? '0 14px' : 14,
    borderBottom: (isLast || isCollapsing) ? 'none' : `1px solid ${C.soft}`,
    transition:  'background 0.35s ease, color 0.35s ease, opacity 0.55s ease, max-height 0.55s ease, padding 0.55s ease',
    maxHeight:   isCollapsing ? 0 : 320,
    overflow:    'hidden',
    background:  isReceipted ? C.forest : 'transparent',
    color:       isReceipted ? '#F5F0DC' : C.ink,
    opacity:     isCollapsing ? 0 : 1,
  };

  return (
    <div style={rowStyle}>
      <GateBadge gate={row.gate} />

      <div>
        <h3 style={{ margin: 0, fontSize: 16, lineHeight: 1.2, color: isReceipted ? '#F5F0DC' : C.ink }}>
          {row.title}
        </h3>
        <p style={{ margin: '5px 0 0', color: isReceipted ? C.auditMuted : C.muted, fontSize: 13, lineHeight: 1.35 }}>
          {row.description}
        </p>
        <div style={{ marginTop: 8, color: isReceipted ? C.auditMuted : C.danger, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          {row.matterRisk}
        </div>
        {row.confidence && !isReceipted && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, color: C.muted, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              <span>confidence={row.confidence.pct}%</span>
              <span>source={row.confidence.source}</span>
              {row.confidence.missing && <span>missing={row.confidence.missing}</span>}
            </div>
            {onOpenSourceDrawer && (
              <button
                onClick={onOpenSourceDrawer}
                style={{
                  marginTop:    8,
                  border:       '1px solid rgba(29,158,117,.3)',
                  background:   C.tealSoft,
                  color:        C.teal,
                  borderRadius: 999,
                  padding:      '5px 8px',
                  fontFamily:   'var(--font-mono)',
                  fontSize:     10,
                  cursor:       'pointer',
                }}
              >
                Open source transparency
              </button>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'grid', gap: 4, color: isReceipted ? C.auditMuted : C.muted, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
        <strong style={{ color: isReceipted ? '#F5F0DC' : C.ink, fontFamily: 'var(--font-sans)', fontSize: 12 }}>
          {row.boundary.label}
        </strong>
        <span>route={row.boundary.route}</span>
        <span>llm={row.boundary.llm}</span>
        <span>{row.boundary.extra}</span>
      </div>

      <button
        onClick={onActionClick}
        disabled={isReceipted}
        style={{
          border:       0,
          borderRadius: 7,
          background:   isReceipted ? 'rgba(255,255,255,.12)' : C.forest,
          color:        isReceipted ? C.auditMuted : '#FFFFFF',
          padding:      '8px 10px',
          fontWeight:   700,
          fontSize:     13,
          cursor:       isReceipted ? 'default' : 'pointer',
          alignSelf:    'start',
          whiteSpace:   'nowrap',
        }}
      >
        {isReceipted ? 'Logged' : row.actionLabel}
      </button>

      {isReceipted && (
        <div className="litt-receipt-flash active">
          Attorney decision logged{auditEventId ? ` / ${auditEventId.slice(0, 10)}` : ''}
        </div>
      )}
    </div>
  );
}

// ─── ProofRail ────────────────────────────────────────────────────────────────

const OBS_GATE_STYLE: Record<string, CSSProperties> = {
  ESCALATION:      { background: '#9B2D23',                    color: '#FFFFFF'  },
  REVIEW_REQUIRED: { background: 'rgba(169,132,53,.7)',         color: '#FFF7E4'  },
  BLOCKED:         { background: 'rgba(214,193,129,.14)',       color: '#D6C181', border: '1px solid rgba(214,193,129,.35)' },
  AUTO_SAFE:       { background: 'rgba(158,225,199,.22)',       color: '#9EE1C7', border: '1px solid rgba(158,225,199,.3)'  },
};

function RailObservation({ obs }: { obs: AgentObservation }) {
  const gStyle = OBS_GATE_STYLE[obs.commitment_level] ?? OBS_GATE_STYLE.AUTO_SAFE;
  return (
    <div className="litt-obs-drip" style={{
      display:    'grid',
      gap:        6,
      border:     `1px solid rgba(214,193,129,.28)`,
      borderRadius: 10,
      padding:    10,
      background: 'rgba(255,255,255,.045)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: C.auditAccent, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
        <span>{obs.agent_name}</span>
        <span>{obs.confidence != null ? `${Math.round(obs.confidence * 100)}%` : obs.observation_type.toLowerCase()}</span>
      </div>
      <div style={{ color: '#F5F0DC', fontSize: 13, lineHeight: 1.3 }}>{obs.description}</div>
      <span style={{ display: 'inline-flex', width: 'fit-content', borderRadius: 6, padding: '4px 6px', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, ...gStyle }}>
        {obs.commitment_level}
      </span>
    </div>
  );
}

interface ProofRailProps {
  isPlaying:       boolean;
  isSweepComplete: boolean;
  displayed:       AgentObservation[];
  gateCounts:      Record<string, number>;
  decisionCount:   number;
  traceRef:        RefObject<HTMLDivElement>;
  sweepError?:     string | null;
}

function ProofRail({ isPlaying, isSweepComplete, displayed, gateCounts, decisionCount, traceRef, sweepError }: ProofRailProps) {
  const agentNames = ['deadline_agent', 'billing_agent', 'comms_agent', 'anomaly_agent'];
  const lastAgent  = displayed[displayed.length - 1]?.agent_name ?? '';

  const agentStatus = (name: string): 'ready' | 'running' | 'done' => {
    if (isSweepComplete) return 'done';
    if (isPlaying && lastAgent === name) return 'running';
    return 'ready';
  };

  const railTitle = sweepError    ? 'Sweep failed'
                  : isSweepComplete ? 'Sweep complete'
                  : isPlaying       ? 'Sweep trace running'
                  : 'Sweep trace ready';

  const railCopy = sweepError
    ? sweepError
    : isSweepComplete
    ? 'The rail settles into audit proof after the agent work. Receipts are ready for every consequential action.'
    : isPlaying
    ? 'Observations are emitting from the agent layer. Gate badges appear as Litt decides what it can and cannot do.'
    : 'Click Run closeout sweep to watch agents emit observations and gate decisions in real time.';

  const railState = isPlaying
    ? `${displayed.length} / 22`
    : isSweepComplete ? 'complete' : 'pending';

  return (
    <aside
      className={isPlaying ? 'litt-rail-running' : undefined}
      style={{
        background:   C.audit,
        color:        '#E9E0C7',
        borderLeft:   `1px solid ${C.auditLine}`,
        padding:      16,
        display:      'grid',
        gap:          14,
        alignContent: 'start',
        overflowY:    'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.auditMuted, fontSize: 10, marginBottom: 6 }}>
            Defensible audit trail
          </div>
          <h3 style={{ margin: 0, color: '#F5F0DC', fontSize: 22 }}>{railTitle}</h3>
          <p style={{ margin: '6px 0 0', color: C.auditMuted, lineHeight: 1.45, fontSize: 13 }}>{railCopy}</p>
        </div>
        <span style={{ border: `1px solid ${C.auditLine}`, borderRadius: 999, padding: '5px 8px', color: C.auditAccent, fontFamily: 'var(--font-mono)', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {railState}
        </span>
      </div>

      {/* Agent grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
        {agentNames.map(name => {
          const status   = agentStatus(name);
          const isActive = status === 'running';
          return (
            <div key={name} style={{
              border:       `1px solid ${isActive ? 'rgba(158,225,199,.65)' : C.auditLine}`,
              borderRadius: 10,
              padding:      10,
              background:   'rgba(255,255,255,.045)',
              display:      'grid',
              gap:          6,
              boxShadow:    isActive ? '0 0 0 2px rgba(158,225,199,.1)' : undefined,
              transition:   'border-color 0.2s ease, box-shadow 0.2s ease',
            }}>
              <span style={{ color: C.auditMuted, fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {name}
              </span>
              <strong style={{ color: '#F5F0DC', fontSize: 14 }}>{status}</strong>
            </div>
          );
        })}
      </div>

      {/* Trace */}
      <div style={{ display: 'grid', gap: 8, maxHeight: 386, overflowY: 'auto', paddingRight: 2 }}>
        {displayed.length === 0 ? (
          <div style={{ border: `1px solid ${C.auditLine}`, borderRadius: 10, padding: 10, background: 'rgba(255,255,255,.045)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: C.auditAccent, fontFamily: 'var(--font-mono)', fontSize: 10, marginBottom: 6 }}>
              <span>pending</span><span>0 / 22</span>
            </div>
            <div style={{ color: '#F5F0DC', fontSize: 13 }}>Sweep observations will appear here every 250ms.</div>
          </div>
        ) : (
          displayed.map(obs => <RailObservation key={obs.observation_id} obs={obs} />)
        )}
        <div ref={traceRef} />
      </div>

      {/* Post-sweep receipt grid */}
      {isSweepComplete && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
          {[
            { label: 'escalation', value: gateCounts['ESCALATION']      ?? 0 },
            { label: 'review',     value: gateCounts['REVIEW_REQUIRED']  ?? 0 },
            { label: 'blocked',    value: gateCounts['BLOCKED']          ?? 0 },
            { label: 'auto safe',  value: gateCounts['AUTO_SAFE']        ?? 0 },
            { label: 'decisions',  value: decisionCount                       },
          ].map(({ label, value }) => (
            <div key={label} style={{ border: `1px solid ${C.auditLine}`, borderRadius: 10, padding: 10, background: 'rgba(158,225,199,.08)' }}>
              <span style={{ display: 'block', color: C.auditMuted, fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
              </span>
              <strong style={{ display: 'block', marginTop: 5, color: C.auditAccent, fontSize: 18 }}>
                {value}
              </strong>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

// ─── SourceDrawer ─────────────────────────────────────────────────────────────

function SourceDrawer({
  item, onClose, onConfirm,
}: {
  item:      BriefDeadlineItem | null;
  onClose:   () => void;
  onConfirm: () => void;
}) {
  const isOpen = !!item;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: isOpen ? 'auto' : 'none', zIndex: 20 }} aria-hidden={!isOpen}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(16,23,19,.24)', opacity: isOpen ? 1 : 0, transition: 'opacity 0.22s ease' }} />
      <aside style={{
        position:   'absolute',
        top:        0,
        right:      0,
        height:     '100%',
        width:      'min(460px, 92vw)',
        background: C.paper,
        borderLeft: `1px solid ${C.line}`,
        boxShadow:  '-22px 0 54px rgba(20,27,23,.18)',
        transform:  isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s ease',
        padding:    22,
        display:    'grid',
        alignContent: 'start',
        gap:        16,
        overflowY:  'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 14, borderBottom: `1px solid ${C.line}`, paddingBottom: 14 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, fontSize: 10, marginBottom: 4 }}>
              Transparent Confidence
            </div>
            <h3 style={{ margin: 0, fontSize: 24, color: C.ink }}>
              {item?.matter_name ?? 'Deadline'} source reasoning
            </h3>
          </div>
          <button onClick={onClose} aria-label="Close drawer" style={{ border: `1px solid ${C.line}`, background: C.surface, borderRadius: 8, width: 34, height: 34, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>
            ×
          </button>
        </div>

        {[
          { key: 'source_found',   value: '"Due tomorrow, Friday"',   desc: 'Rivera opposing counsel email received 2026-05-28. Useful signal, but not an authoritative deadline source.' },
          { key: 'source_missing', value: 'Court order not found',     desc: 'No court notice, docket entry, or attorney confirmation exists in firm sources.' },
          { key: 'gate_decision',  value: 'ESCALATION',               desc: 'Litt cannot confirm this autonomously. It surfaces the risk and refuses to resolve without attorney review.' },
          { key: 'confidence',     value: '70%',                      desc: 'Basis: email language and matter timing. Confidence is capped because no court document was found.' },
        ].map(({ key, value, desc }) => (
          <div key={key} style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.surface, padding: 12, display: 'grid', gap: 6 }}>
            <span style={{ color: C.muted, fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{key}</span>
            <strong style={{ fontSize: 16, color: C.ink }}>{value}</strong>
            <p style={{ margin: 0, color: C.muted, lineHeight: 1.42, fontSize: 13 }}>{desc}</p>
          </div>
        ))}

        <button
          onClick={onConfirm}
          style={{ border: 0, borderRadius: 8, background: C.forest, color: '#FFFFFF', padding: '12px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
        >
          Log attorney decision
        </button>
      </aside>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DailyCloseoutBrief() {
  const [brief,          setBrief]         = useState<BriefResponse | null>(null);
  const [timeline,       setTimeline]      = useState<AgentRunTimelineType | null>(null);
  const [loading,        setLoading]       = useState(true);
  const [sweeping,       setSweeping]      = useState(false);
  const [sweepError,     setSweepError]    = useState<string | null>(null);
  const [error,          setError]         = useState<string | null>(null);
  const [modal,          setModal]         = useState<OpenModal | null>(null);
  const [resolved,       setResolved]      = useState<Set<string>>(new Set());
  const [resolvedItems,  setResolvedItems] = useState<ResolvedItem[]>([]);
  const [auditDrawer,    setAuditDrawer]   = useState<ToolResult | null>(null);
  const [sourceItem,     setSourceItem]    = useState<BriefDeadlineItem | null>(null);
  const [receiptedIds,   setReceiptedIds]  = useState<Set<string>>(new Set());
  const [collapsingIds,  setCollapsingIds] = useState<Set<string>>(new Set());
  const [displayed,      setDisplayed]     = useState<AgentObservation[]>([]);
  const [isPlaying,      setIsPlaying]     = useState(false);
  const [isSweepComplete, setIsSweepComplete] = useState(false);
  const timerRefs    = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const traceBottomRef = useRef<HTMLDivElement>(null);

  async function loadBrief() {
    setLoading(true);
    setError(null);
    try {
      setBrief(await getBrief(FIRM_ID, ATTORNEY_ID));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load brief');
    } finally {
      setLoading(false);
    }
  }

  async function handleSweep() {
    setSweeping(true);
    setSweepError(null);
    setTimeline(null);
    setDisplayed([]);
    setIsPlaying(false);
    setIsSweepComplete(false);
    try {
      const result = await runSweep(FIRM_ID);
      if (result.timeline?.observations?.length) {
        setTimeline(result.timeline);
      } else {
        setIsSweepComplete(true);
      }
      setBrief(result.brief);
    } catch (e) {
      setSweepError(e instanceof Error ? e.message : 'Sweep failed');
      await loadBrief();
    } finally {
      setSweeping(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadBrief(); }, []);

  // Feed timeline observations into rail at 250ms/obs
  useEffect(() => {
    if (!timeline?.observations?.length) return;
    setDisplayed([]);
    setIsPlaying(true);
    setIsSweepComplete(false);
    let i = 0;
    const obs = timeline.observations;
    const interval = setInterval(() => {
      const next = obs[i];
      if (next) setDisplayed(prev => [...prev, next]);
      i++;
      if (i >= obs.length) {
        clearInterval(interval);
        setIsPlaying(false);
        setIsSweepComplete(true);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [timeline]);

  // Auto-scroll trace bottom
  useEffect(() => {
    if (displayed.length > 0) {
      traceBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [displayed.length]);

  // Cleanup transition timers on unmount
  useEffect(() => {
    const timers = timerRefs.current;
    return () => { timers.forEach(t => clearTimeout(t)); };
  }, []);

  const handleSuccess = useCallback((result: ToolResult, sectionId: string) => {
    setResolvedItems(prev => [...prev, {
      sectionId,
      entityId:     result.entity_id,
      entityType:   result.entity_type,
      auditEventId: result.audit_event_id,
      resolvedAt:   new Date().toISOString(),
    }]);
    setAuditDrawer(result);
    setModal(null);
    setSourceItem(null);

    // receipted → collapsing → resolved
    setReceiptedIds(prev => new Set([...prev, sectionId]));
    const t1 = setTimeout(() => {
      setCollapsingIds(prev => new Set([...prev, sectionId]));
      const t2 = setTimeout(() => {
        setResolved(prev => new Set([...prev, sectionId]));
        setReceiptedIds(prev => { const s = new Set(prev); s.delete(sectionId); return s; });
        setCollapsingIds(prev => { const s = new Set(prev); s.delete(sectionId); return s; });
      }, 600);
      timerRefs.current.set(`${sectionId}-2`, t2);
    }, 1250);
    timerRefs.current.set(`${sectionId}-1`, t1);
  }, []);

  const closeModal  = useCallback(() => setModal(null),       []);
  const closeDrawer = useCallback(() => setAuditDrawer(null), []);

  const decisionRows = useMemo(
    () => brief ? buildDecisionRows(brief, setModal) : [],
    [brief],
  );

  const gateCounts = useMemo(
    () => displayed.reduce((acc, obs) => {
      acc[obs.commitment_level] = (acc[obs.commitment_level] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    [displayed],
  );

  const pressure = useMemo(
    () => brief ? computePressureIndex(brief) : null,
    [brief],
  );

  const escalationDeadline = useMemo(
    () => brief?.sections.deadlines.items.find(d => d.classification === 'HARD_LEGAL' && d.is_unconfirmed) ?? null,
    [brief],
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 14, color: C.muted }}>Loading brief…</p>
      </div>
    );
  }

  if (error || !brief || !pressure) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: C.danger, marginBottom: 12 }}>{error ?? 'Brief unavailable'}</p>
          <button onClick={loadBrief} style={{ fontSize: 13, color: C.teal, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const visibleRows    = decisionRows.filter(r => !resolved.has(r.id));
  const criticalCount  = visibleRows.filter(r => r.gate === 'ESCALATION').length;
  const wipUsd         = brief.sections.time_entries.total_wip_usd;

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <DemoBanner firmName={brief.firm_name} demoDate={brief.generated_at.slice(0, 10)} />

      <div style={{ maxWidth: 1720, margin: '0 auto', padding: '20px 26px 40px' }}>
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 20, overflow: 'hidden', background: C.paper, boxShadow: '0 28px 78px rgba(32,35,31,.13)' }}>

          {/* ── Topbar ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr auto', alignItems: 'center', gap: 18, padding: '12px 18px', background: C.paper, borderBottom: `1px solid ${C.line}` }}>
            <span
              role="img"
              aria-label="Litt"
              style={{
                display:         'block',
                width:           214,
                height:          62,
                backgroundImage: 'url("/icons-logo/litt_logo_main_no_tagline.png")',
                backgroundSize:  '258px auto',
                backgroundRepeat:'no-repeat',
                backgroundPosition:'center',
                mixBlendMode:    'multiply',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              {criticalCount > 0 && (
                <span style={{ border: '1px solid rgba(155,45,35,.35)', borderRadius: 999, padding: '5px 8px', color: C.danger, background: C.dangerSoft, fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' }}>
                  {criticalCount} critical
                </span>
              )}
              <span style={{ border: `1px solid ${C.line}`, borderRadius: 999, padding: '5px 8px', color: C.muted, background: C.surface, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {visibleRows.length} decisions
              </span>
              {wipUsd > 0 && (
                <span style={{ border: `1px solid ${C.line}`, borderRadius: 999, padding: '5px 8px', color: C.muted, background: C.surface, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  ${wipUsd.toLocaleString()} WIP
                </span>
              )}
              <span style={{ border: `1px solid ${C.line}`, borderRadius: 999, padding: '5px 8px', color: C.muted, background: C.surface, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                5 agents
              </span>
              <span style={{ border: `1px solid ${C.line}`, borderRadius: 999, padding: '5px 8px', color: C.muted, background: C.surface, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {resolvedItems.length} receipts
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <DemoResetButton firmId={FIRM_ID} onReset={loadBrief} />
              <button
                onClick={handleSweep}
                disabled={sweeping}
                style={{
                  border:       0,
                  borderRadius: 8,
                  background:   C.forest,
                  color:        '#FFFFFF',
                  padding:      '11px 15px',
                  fontWeight:   700,
                  fontSize:     13,
                  cursor:       sweeping ? 'not-allowed' : 'pointer',
                  opacity:      sweeping ? 0.82 : 1,
                  whiteSpace:   'nowrap',
                }}
              >
                {sweeping ? 'Running…' : 'Run closeout sweep'}
              </button>
            </div>
          </div>

          {/* ── 3-column body ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '286px 1fr 392px', minHeight: 860 }}>

            <NavPanel brief={brief} />

            {/* Main workbench */}
            <main style={{
              padding:      18,
              display:      'grid',
              gap:          16,
              alignContent: 'start',
              background:   `linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,0) 260px), ${C.bg}`,
            }}>
              {/* Work header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'end', borderBottom: `1px solid ${C.line}`, paddingBottom: 15 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em', color: C.ink }}>
                    Closeout docket
                  </h2>
                  <p style={{ margin: '7px 0 0', color: C.muted, maxWidth: 720, lineHeight: 1.45, fontSize: 14 }}>
                    Attorney decisions ranked by operational pressure. Each row exposes Litt's gate, source confidence, architecture boundary, matter impact, and action path.
                  </p>
                </div>
                <span style={{ border: `1px solid ${C.line}`, borderRadius: 999, padding: '5px 8px', color: C.muted, background: C.surface, fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {brief.firm_id} / {brief.generated_at.slice(0, 10)}
                </span>
              </div>

              <PressureSection pressure={pressure} brief={brief} />

              {/* Decision docket */}
              <section style={{ border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden', background: C.surface }}>
                {visibleRows.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 14, color: C.muted }}>
                    All items resolved — closeout complete.
                  </div>
                ) : (
                  visibleRows.map((row, idx) => {
                    const isReceipted = receiptedIds.has(row.id);
                    const isCollapsing = collapsingIds.has(row.id);
                    const isLast = idx === visibleRows.length - 1;
                    const resolvedEntry = resolvedItems.find(r => r.sectionId === row.id);

                    return (
                      <DecisionRowItem
                        key={row.id}
                        row={row}
                        isReceipted={isReceipted}
                        isCollapsing={isCollapsing}
                        isLast={isLast}
                        auditEventId={resolvedEntry?.auditEventId}
                        onOpenSourceDrawer={
                          row.isEscalationDeadline
                            ? () => setSourceItem(escalationDeadline)
                            : undefined
                        }
                        onActionClick={() => {
                          if (row.isEscalationDeadline) {
                            setSourceItem(escalationDeadline);
                          } else {
                            row.onAction();
                          }
                        }}
                      />
                    );
                  })
                )}
              </section>
            </main>

            <ProofRail
              isPlaying={isPlaying}
              isSweepComplete={isSweepComplete}
              sweepError={sweepError}
              displayed={displayed}
              gateCounts={gateCounts}
              decisionCount={resolvedItems.length}
              traceRef={traceBottomRef}
            />
          </div>
        </div>
      </div>

      {/* Source Transparency Drawer */}
      <SourceDrawer
        item={sourceItem}
        onClose={() => setSourceItem(null)}
        onConfirm={() => {
          if (sourceItem) {
            setSourceItem(null);
            setModal({ type: 'deadline', item: sourceItem, action: 'confirm' });
          }
        }}
      />

      {/* Modals */}
      {modal?.type === 'deadline' && (
        <DeadlineModal
          item={modal.item}
          action={modal.action}
          firmId={FIRM_ID}
          attorneyId={ATTORNEY_ID}
          onClose={closeModal}
          onSuccess={r => handleSuccess(r, modal.item.deadline_id)}
        />
      )}
      {modal?.type === 'billing' && (
        <BillingWIPModal
          item={modal.item}
          action={modal.action}
          firmId={FIRM_ID}
          attorneyId={ATTORNEY_ID}
          onClose={closeModal}
          onSuccess={r => handleSuccess(r, modal.item.entry_id)}
        />
      )}
      {modal?.type === 'comms' && (
        <ClientCommsModal
          item={modal.item}
          firmId={FIRM_ID}
          attorneyId={ATTORNEY_ID}
          onClose={closeModal}
          onSuccess={r => handleSuccess(r, modal.item.matter_id)}
        />
      )}
      {modal?.type === 'budget' && (
        <BudgetModal item={modal.item} onClose={closeModal} />
      )}
      {modal?.type === 'anomaly' && (
        <AnomalyModal
          item={modal.item}
          firmId={FIRM_ID}
          attorneyId={ATTORNEY_ID}
          onClose={closeModal}
          onSuccess={r => handleSuccess(r, modal.item.escalation_id)}
        />
      )}

      <AuditEventDrawer result={auditDrawer} onClose={closeDrawer} />
    </div>
  );
}
