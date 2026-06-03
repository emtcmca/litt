import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { getBrief, runSweep, downloadLedesExport } from '../api';
import { DeadlineModal } from './modals/DeadlineModal';
import type { DeadlineAction } from './modals/DeadlineModal';
import { BillingWIPModal } from './modals/BillingWIPModal';
import type { BillingAction } from './modals/BillingWIPModal';

// UTBMS task code labels (subset — enough for demo data)
const UTBMS_TASK_SHORT: Record<string, string> = {
  L100: 'Case Assessment', L110: 'Fact Investigation', L120: 'Analysis/Strategy',
  L200: 'Pre-Trial Pleadings', L300: 'Discovery',
  A100: 'Project Admin', A104: 'Research', A106: 'Document Review',
  A107: 'Drafting', A200: 'Negotiation', A201: 'Deal Strategy',
};
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

interface SourceRef {
  type:       string;   // court_order | contract | email | calendar
  docId:      string;
  excerpt:    string;
  court?:     string;
  detectedAt: string;   // ISO date slice
}

interface DecisionRow {
  id:                  string;
  gate:                GateLevel;
  section:             'deadline' | 'billing' | 'budget' | 'silence' | 'anomaly';
  clientId?:           string;
  title:               string;
  description:         string;
  matterRisk:          string;
  confidence?:         { pct: number; source: string; missing?: string };
  boundary:            { label: string; route: string; llm: string; extra: string };
  actionLabel:         string;
  onAction:            () => void;
  isEscalationDeadline?: boolean;
  extraTags?:          string[];
  sourceRef?:          SourceRef;
}

interface PressureSignalItem {
  id:    string;
  label: string;
  detail: string;
  pts:   number;
}

interface PressureSignal {
  key:    'deadline' | 'budget' | 'wip' | 'silence';
  label:  string;
  summary: string;
  pts:    number;
  maxPts: number;
  items:  PressureSignalItem[];
}

interface ClientPressureRow {
  clientId:          string;
  clientName:        string;
  hardDeadlineDays:  number | null;
  budgetPct:         number | null;
  wipUsd:            number;
  silenceDays:       number | null;
  score:             number;
  itemIds:           string[];
}

interface PressureData {
  score:          number;
  scoreBreakdown: Array<{ label: string; pts: number; source: string }>;
  signals:        PressureSignal[];
  clients:        ClientPressureRow[];
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
  let totalScore = 0;
  const scoreBreakdown: Array<{ label: string; pts: number; source: string }> = [];

  // ── Deadline signals (highest weight — malpractice risk) ─────────────────
  const deadlineItems: PressureSignalItem[] = [];
  for (const d of deadlines.items) {
    const isHL = d.classification === 'HARD_LEGAL';
    const isHC = d.classification === 'HARD_CONTRACTUAL';
    const unc  = d.is_unconfirmed;
    let pts = 0;
    if (isHL) {
      if (d.days_out <= 3)       pts = unc ? 46 : 38;
      else if (d.days_out <= 7)  pts = unc ? 38 : 30;
      else if (d.days_out <= 14) pts = unc ? 22 : 18;
      else if (d.days_out <= 30) pts = 8;
    } else if (isHC) {
      if (d.days_out <= 7)       pts = 20;
      else if (d.days_out <= 14) pts = 10;
    }
    if (pts > 0) {
      totalScore += pts;
      scoreBreakdown.push({ label: `${d.matter_name}${unc ? ' (unconfirmed)' : ''}`, pts, source: 'deadline' });
      deadlineItems.push({ id: d.deadline_id, label: `${d.matter_name} · ${d.classification}`, detail: `${d.days_out}d out · due ${d.due_date}${unc ? ' · UNCONFIRMED' : ''}`, pts });
    }
  }
  const nearestHard = [...deadlines.items].filter(d => d.classification === 'HARD_LEGAL' || d.classification === 'HARD_CONTRACTUAL').sort((a, b) => a.days_out - b.days_out)[0];
  const deadlineSummary = nearestHard ? `${nearestHard.days_out}d · ${nearestHard.matter_name}${nearestHard.is_unconfirmed ? ' · unconfirmed' : ''}` : 'No hard deadlines';

  // ── Budget signals (billing relationship risk) ────────────────────────────
  const budgetItems: PressureSignalItem[] = [];
  let maxBudgetPct = 0;
  for (const b of budget_risks.items) {
    maxBudgetPct = Math.max(maxBudgetPct, b.utilization_pct);
    let pts = 0;
    if (b.utilization_pct >= 90)      pts = 22;
    else if (b.utilization_pct >= 75) pts = 15;
    else if (b.utilization_pct >= 60) pts = 8;
    else if (b.utilization_pct >= 50) pts = 4;
    if (pts > 0) {
      totalScore += pts;
      scoreBreakdown.push({ label: `${b.client_name} budget`, pts, source: 'budget' });
      budgetItems.push({ id: b.client_id, label: b.client_name, detail: `${b.utilization_pct.toFixed(0)}% of $${b.budget_cap.toLocaleString()} · $${b.budget_billed.toLocaleString()} billed`, pts });
    }
  }
  const budgetSummary = maxBudgetPct > 0 ? `${maxBudgetPct.toFixed(0)}% peak utilization` : 'No budget alerts';

  // ── WIP signals (cash flow risk) ──────────────────────────────────────────
  const wip = time_entries.total_wip_usd;
  let wipPts = 0;
  if (wip >= 4000)      wipPts = 10;
  else if (wip >= 2000) wipPts = 6;
  else if (wip >= 500)  wipPts = 3;
  if (wipPts > 0) { totalScore += wipPts; scoreBreakdown.push({ label: 'WIP exposure', pts: wipPts, source: 'wip' }); }
  const wipItems: PressureSignalItem[] = time_entries.items.map(e => ({ id: e.entry_id, label: `${e.matter_name} · ${e.hours}h`, detail: `$${e.amount.toFixed(0)} pending${e.has_block ? ' · BLOCK' : e.has_warn ? ' · WARN' : ''}`, pts: 0 }));
  const wipSummary = wip > 0 ? `$${wip.toLocaleString()} pending approval` : 'No pending WIP';

  // ── Silence signals (client retention risk) ───────────────────────────────
  const silenceItems: PressureSignalItem[] = [];
  let maxSilenceDays = 0;
  for (const s of client_silence.items) {
    maxSilenceDays = Math.max(maxSilenceDays, s.days_since_contact);
    let pts = 0;
    if (s.days_since_contact >= 21)      pts = 18;
    else if (s.days_since_contact >= 14) pts = 12;
    else if (s.days_since_contact >= 7)  pts = 5;
    if (pts > 0) {
      totalScore += pts;
      scoreBreakdown.push({ label: `${s.client_name} silence`, pts, source: 'silence' });
      silenceItems.push({ id: s.matter_id, label: `${s.client_name} · ${s.matter_name}`, detail: `${s.days_since_contact} days silent · threshold ${s.threshold_days}d`, pts });
    }
  }
  const silenceSummary = maxSilenceDays > 0 ? `${maxSilenceDays}d · ${client_silence.items.length} matter${client_silence.items.length !== 1 ? 's' : ''}` : 'No silence alerts';

  // ── Anomalies ─────────────────────────────────────────────────────────────
  let anomalyPts = 0;
  for (const a of anomalies.items) {
    const pts = a.risk_level === 'CRITICAL' ? 5 : a.risk_level === 'ELEVATED' ? 2 : 0;
    if (pts > 0) {
      anomalyPts = Math.min(anomalyPts + pts, 10);
      totalScore += pts;
      scoreBreakdown.push({ label: a.what_is_happening.slice(0, 44), pts, source: 'anomaly' });
    }
  }

  // ── Per-client breakdown ──────────────────────────────────────────────────
  const clientMap = new Map<string, ClientPressureRow>();
  const ensureClient = (id: string, name: string) => {
    if (!clientMap.has(id)) clientMap.set(id, { clientId: id, clientName: name, hardDeadlineDays: null, budgetPct: null, wipUsd: 0, silenceDays: null, score: 0, itemIds: [] });
    return clientMap.get(id)!;
  };
  for (const d of deadlines.items) {
    const r = ensureClient(d.client_id, d.client_name);
    if (d.classification === 'HARD_LEGAL' || d.classification === 'HARD_CONTRACTUAL') {
      if (r.hardDeadlineDays === null || d.days_out < r.hardDeadlineDays) r.hardDeadlineDays = d.days_out;
    }
    r.itemIds.push(d.deadline_id);
  }
  for (const b of budget_risks.items) {
    const r = ensureClient(b.client_id, b.client_name);
    r.budgetPct = b.utilization_pct;
    r.itemIds.push(b.client_id);
  }
  for (const e of time_entries.items) {
    const r = ensureClient(e.client_id, e.client_name);
    r.wipUsd += e.amount;
    r.itemIds.push(e.entry_id);
  }
  for (const s of client_silence.items) {
    const r = ensureClient(s.client_id, s.client_name);
    r.silenceDays = s.days_since_contact;
    r.itemIds.push(s.matter_id);
  }
  for (const r of clientMap.values()) {
    let s = 0;
    if (r.hardDeadlineDays !== null) { if (r.hardDeadlineDays <= 7) s += 30; else if (r.hardDeadlineDays <= 14) s += 18; else if (r.hardDeadlineDays <= 30) s += 8; }
    if (r.budgetPct !== null) { if (r.budgetPct >= 90) s += 22; else if (r.budgetPct >= 75) s += 15; else if (r.budgetPct >= 60) s += 8; }
    if (r.wipUsd >= 2000) s += 6; else if (r.wipUsd >= 500) s += 3;
    if (r.silenceDays !== null) { if (r.silenceDays >= 21) s += 18; else if (r.silenceDays >= 14) s += 12; else if (r.silenceDays >= 7) s += 5; }
    r.score = Math.min(s, 100);
  }

  return {
    score: Math.min(Math.round(totalScore), 100),
    scoreBreakdown,
    signals: [
      { key: 'deadline', label: 'Deadline horizon', summary: deadlineSummary, pts: deadlineItems.reduce((s, i) => s + i.pts, 0), maxPts: 46, items: deadlineItems },
      { key: 'budget',   label: 'Budget pressure',  summary: budgetSummary,  pts: budgetItems.reduce((s, i) => s + i.pts, 0),   maxPts: 22, items: budgetItems   },
      { key: 'wip',      label: 'WIP exposure',     summary: wipSummary,     pts: wipPts,                                        maxPts: 10, items: wipItems       },
      { key: 'silence',  label: 'Client silence',   summary: silenceSummary, pts: silenceItems.reduce((s, i) => s + i.pts, 0),  maxPts: 18, items: silenceItems   },
    ],
    clients: [...clientMap.values()].sort((a, b) => b.score - a.score),
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
    const isConflict = d.verification_status === 'conflict_flagged';
    const isEsc = !isConflict && d.classification === 'HARD_LEGAL' && d.is_unconfirmed;
    const sourceRef: SourceRef | undefined = d.source_document_id ? {
      type:       d.source_type ?? 'document',
      docId:      d.source_document_id,
      excerpt:    d.source_excerpt ?? '',
      court:      d.court ?? undefined,
      detectedAt: d.detected_at ? d.detected_at.slice(0, 10) : '',
    } : undefined;
    rows.push({
      id:          d.deadline_id,
      section:     'deadline',
      clientId:    d.client_id,
      gate:        (isConflict || isEsc) ? 'ESCALATION'
                 : (d.classification === 'HARD_LEGAL' || d.classification === 'HARD_CONTRACTUAL')
                   ? 'REVIEW_REQUIRED' : 'AUTO_SAFE',
      title:       isConflict
                 ? `${d.matter_name} — source conflict · ${d.days_out}d`
                 : isEsc
                 ? `${d.matter_name} — unconfirmed HARD_LEGAL deadline`
                 : `${d.matter_name} — ${d.days_out}d deadline${d.is_unconfirmed ? ' unconfirmed' : ''}`,
      description: isConflict
                 ? `${d.description}. ${d.days_out} day${d.days_out !== 1 ? 's' : ''} until ${d.due_date}. Source: opposing counsel communication only — no confirming court order found in firm records.`
                 : `${d.description}. ${d.days_out} days until ${d.due_date}.${d.is_unconfirmed ? ' Not yet confirmed for this closeout period.' : ''}`,
      matterRisk:  isConflict
                 ? 'risk: unverified deadline / source conflict — malpractice exposure if missed'
                 : 'risk: malpractice exposure / missed filing deadline',
      boundary: {
        label: isConflict ? 'Gemini extraction' : 'Python boundary',
        route: 'deadline_agent',
        llm:   isConflict ? 'gemini-2.5-pro' : 'none',
        extra: isConflict ? 'work_kind=llm_assisted · confidence=0.92' : isEsc ? 'gate=ESCALATION · confirm required' : 'tool=confirm_deadline',
      },
      actionLabel:         isConflict ? 'Verify' : isEsc ? 'Review' : 'Confirm',
      onAction:            () => openModal({ type: 'deadline', item: d, action: isConflict ? 'verify' : 'confirm' }),
      isEscalationDeadline: isEsc || isConflict,
      sourceRef,
    });
  }

  for (const e of time_entries.items) {
    const blockFlag = e.scrubber_flags.find(f => f.severity === 'BLOCK');
    const needsEdit = e.has_block || !e.narrative;
    const tags: string[] = [];
    if (e.task_code) tags.push(e.task_code + (UTBMS_TASK_SHORT[e.task_code] ? ` · ${UTBMS_TASK_SHORT[e.task_code]}` : ''));
    if (e.session_minutes_actual != null) {
      const h = Math.floor(e.session_minutes_actual / 60);
      const m = e.session_minutes_actual % 60;
      tags.push(`⏱ ${h > 0 ? `${h}h ` : ''}${m}m tracked`);
    }
    rows.push({
      id:       e.entry_id,
      section:  'billing',
      clientId: e.client_id,
      gate:    e.has_block ? 'BLOCKED' : 'REVIEW_REQUIRED',
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
      onAction:    () => openModal({ type: 'billing', item: e, action: needsEdit ? 'edit' : 'approve' }),
      extraTags:   tags.length ? tags : undefined,
    });
  }

  for (const b of budget_risks.items) {
    rows.push({
      id:       b.client_id,
      section:  'budget',
      clientId: b.client_id,
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
      id:       s.matter_id,
      section:  'silence',
      clientId: s.client_id,
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
      section:     'anomaly',
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

type ActiveView = 'docket' | 'deadlines' | 'billing' | 'silence';

interface NavPanelProps {
  brief: BriefResponse;
  decisionCount: number;
  activeView: ActiveView;
  onViewChange: (v: ActiveView) => void;
  firmName: string;
  attorneyName: string;
}

function NavPanel({ brief, decisionCount, activeView, onViewChange, firmName, attorneyName }: NavPanelProps) {
  const { deadlines, time_entries, client_silence } = brief.sections;

  const labelStyle: CSSProperties = {
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: C.muted,
    fontSize: 10,
  };

  const navItems: { label: string; count: number; view: ActiveView }[] = [
    { label: 'Decision docket', count: decisionCount,        view: 'docket'    },
    { label: 'Deadline risk',   count: deadlines.count,      view: 'deadlines' },
    { label: 'Billing WIP',     count: time_entries.count,   view: 'billing'   },
    { label: 'Client silence',  count: client_silence.count, view: 'silence'   },
  ];

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
      {/* Firm + attorney identity card */}
      <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 12, padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
        <img src="/icons-logo/prepare-icon.png" alt="" style={{ width: 44, height: 44, objectFit: 'contain', mixBlendMode: 'multiply', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', fontSize: 12, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{firmName}</strong>
          <span style={{ display: 'block', marginTop: 2, color: C.muted, fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {attorneyName}
          </span>
          <span style={{ display: 'block', marginTop: 1, color: C.muted, fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Ops control layer
          </span>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={labelStyle}>Closeout</span>
        {navItems.map(({ label, count, view }) => {
          const active = activeView === view;
          return (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              style={{
                display:        'flex',
                justifyContent: 'space-between',
                gap:            14,
                padding:        '9px 10px',
                borderRadius:   6,
                background:     active ? C.forest : 'transparent',
                color:          active ? C.brass  : C.ink,
                fontSize:       13,
                border:         'none',
                cursor:         'pointer',
                textAlign:      'left',
                width:          '100%',
              }}
            >
              <span>{label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.8 }}>{count}</span>
            </button>
          );
        })}
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

const SIG_COLOR: Record<PressureSignal['key'], string> = {
  deadline: C.danger, budget: C.gold, wip: C.gold, silence: C.teal,
};

function PressureSection({ pressure, decisionRows }: { pressure: PressureData; decisionRows: DecisionRow[] }) {
  const [tab,            setTab]           = useState<'signal' | 'client'>('signal');
  const [expandedSig,    setExpandedSig]   = useState<PressureSignal['key'] | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [showFormula,    setShowFormula]   = useState(false);

  // Score bar: 8 cells filled proportionally, colored by severity
  const filledCells = Math.round((pressure.score / 100) * 8);
  const cellColor = (i: number) => {
    if (i >= filledCells) return '#D8D0BE';
    const pct = (i + 1) / 8;
    if (pct > 0.75 || pressure.score >= 60) return C.danger;
    if (pct > 0.4  || pressure.score >= 35) return C.gold;
    return C.teal;
  };

  const topSignal = pressure.scoreBreakdown[0];
  const scoreLabel = pressure.score >= 70 ? 'Critical' : pressure.score >= 40 ? 'Elevated' : 'Normal';

  const tabBtn = (t: 'signal' | 'client'): CSSProperties => ({
    flex: 1, border: `1px solid ${t === tab ? C.forest : C.line}`,
    borderRadius: 999, padding: '7px 8px', textAlign: 'center',
    fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: t === tab ? C.brass : C.muted,
    background: t === tab ? C.forest : C.paper, cursor: 'pointer',
  });

  return (
    <section style={{ border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden', background: C.surface }}>
      <div style={{ display: 'grid', gridTemplateColumns: '196px 1fr' }}>

        {/* ── Left: Score panel ── */}
        <div style={{ background: C.forest, color: C.brass, padding: '20px 18px', display: 'grid', gap: 12, alignContent: 'start', borderRight: `1px solid rgba(214,193,129,.2)` }}>
          <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 9, color: C.auditMuted }}>
            Operational pressure
          </span>
          <div>
            <b style={{ fontSize: 66, lineHeight: 0.82, color: C.brass, display: 'block' }}>{pressure.score}</b>
            <span style={{ color: C.auditMuted, fontSize: 11, fontFamily: 'var(--font-mono)' }}>/ 100 · {scoreLabel}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 3 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} style={{ height: 8, borderRadius: 3, background: cellColor(i) }} />
            ))}
          </div>
          {topSignal && (
            <div style={{ paddingTop: 8, borderTop: `1px solid rgba(214,193,129,.18)` }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: C.auditMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Top signal
              </span>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: C.brass, lineHeight: 1.35 }}>
                {topSignal.label} <span style={{ color: C.auditMuted }}>+{topSignal.pts}pts</span>
              </p>
            </div>
          )}
          {/* Formula toggle */}
          <button
            onClick={() => setShowFormula(v => !v)}
            style={{ background: 'none', border: `1px solid rgba(214,193,129,.22)`, borderRadius: 6, padding: '5px 8px', fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: C.auditMuted, cursor: 'pointer', textAlign: 'left' }}
          >
            {showFormula ? '▲ Hide formula' : '▼ How scored'}
          </button>
        </div>

        {/* ── Right: tabs ── */}
        <div style={{ padding: 15, display: 'grid', gap: 12, alignContent: 'start' }}>
          <div style={{ display: 'flex', gap: 7 }}>
            {(['signal', 'client'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={tabBtn(t)}>
                {t === 'signal' ? 'By Signal' : 'By Client'}
              </button>
            ))}
          </div>

          {/* ── By Signal ── */}
          {tab === 'signal' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
              {pressure.signals.map(sig => {
                const isExpanded = expandedSig === sig.key;
                const color = SIG_COLOR[sig.key];
                const pct = sig.maxPts > 0 ? Math.min((sig.pts / sig.maxPts) * 100, 100) : 0;
                return (
                  <div key={sig.key} style={{ border: `1px solid ${C.soft}`, borderRadius: 10, padding: 12, background: '#fbf8f0', display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 6 }}>
                      <div>
                        <span style={{ display: 'block', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, fontSize: 9 }}>{sig.label}</span>
                        <strong style={{ display: 'block', fontSize: 16, color: C.ink, marginTop: 3, lineHeight: 1.1 }}>{sig.summary}</strong>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: sig.pts > 0 ? color : C.muted, whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600 }}>
                        +{sig.pts}
                      </span>
                    </div>
                    {/* Contribution bar */}
                    <div style={{ height: 5, borderRadius: 999, background: '#DFE5DC', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.4s ease' }} />
                    </div>
                    {/* Expand toggle */}
                    {sig.items.length > 0 && (
                      <button
                        onClick={() => setExpandedSig(isExpanded ? null : sig.key)}
                        style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: color, cursor: 'pointer', fontFamily: 'var(--font-mono)', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        {isExpanded ? '▲' : '▼'} {sig.items.length} item{sig.items.length !== 1 ? 's' : ''}
                      </button>
                    )}
                    {/* Expanded items */}
                    {isExpanded && (
                      <div style={{ borderTop: `1px solid ${C.soft}`, paddingTop: 8, display: 'grid', gap: 6 }}>
                        {sig.items.map(item => {
                          const row = decisionRows.find(r => r.id === item.id);
                          return (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 500, color: C.ink }}>{item.label}</div>
                                <div style={{ fontSize: 11, color: C.muted, fontFamily: 'var(--font-mono)', marginTop: 2 }}>{item.detail}</div>
                                {item.pts > 0 && <div style={{ fontSize: 10, color: color, fontFamily: 'var(--font-mono)', marginTop: 2 }}>+{item.pts} pts</div>}
                              </div>
                              {row && (
                                <button
                                  onClick={row.onAction}
                                  style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, padding: '4px 10px', border: `1px solid ${C.forest}`, borderRadius: 6, background: C.forest, color: '#FFF', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  {row.actionLabel} →
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── By Client ── */}
          {tab === 'client' && (
            <div style={{ display: 'grid', gap: 8 }}>
              {pressure.clients.length === 0 ? (
                <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>No active client signals.</p>
              ) : pressure.clients.map(client => {
                const isExpanded = expandedClient === client.clientId;
                const level = client.score >= 40 ? 'high' : client.score >= 20 ? 'med' : 'low';
                const dotColor = level === 'high' ? C.danger : level === 'med' ? C.gold : C.teal;
                const clientRows = decisionRows.filter(r => r.clientId === client.clientId);
                return (
                  <div key={client.clientId} style={{ border: `1px solid ${C.soft}`, borderRadius: 10, background: '#fbf8f0', overflow: 'hidden' }}>
                    <button
                      onClick={() => setExpandedClient(isExpanded ? null : client.clientId)}
                      style={{ width: '100%', background: 'none', border: 'none', padding: '11px 14px', cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', textAlign: 'left' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: dotColor, flexShrink: 0 }} />
                        <strong style={{ fontSize: 13, color: C.ink }}>{client.clientName}</strong>
                        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: C.muted, fontFamily: 'var(--font-mono)' }}>
                          {client.hardDeadlineDays != null && <span style={{ color: C.danger }}>⚑ {client.hardDeadlineDays}d</span>}
                          {client.budgetPct != null && <span style={{ color: C.gold }}>⬡ {client.budgetPct.toFixed(0)}%</span>}
                          {client.wipUsd > 0 && <span>${client.wipUsd.toLocaleString()}</span>}
                          {client.silenceDays != null && <span>{client.silenceDays}d silent</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: dotColor }}>{client.score}</span>
                        <span style={{ fontSize: 11, color: C.muted }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    {isExpanded && clientRows.length > 0 && (
                      <div style={{ borderTop: `1px solid ${C.soft}`, padding: '10px 14px', display: 'grid', gap: 8 }}>
                        {clientRows.map(row => (
                          <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <GateBadge gate={row.gate} />
                                <span style={{ fontSize: 12, fontWeight: 500, color: C.ink }}>{row.title}</span>
                              </div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 3, fontFamily: 'var(--font-mono)' }}>{row.description.slice(0, 72)}</div>
                            </div>
                            <button
                              onClick={row.onAction}
                              style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, padding: '5px 12px', border: `1px solid ${C.forest}`, borderRadius: 6, background: C.forest, color: '#FFF', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Open →
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {isExpanded && clientRows.length === 0 && (
                      <div style={{ borderTop: `1px solid ${C.soft}`, padding: '10px 14px' }}>
                        <span style={{ fontSize: 12, color: C.muted }}>No open action items.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Score formula (collapsible, full width) ── */}
      {showFormula && (
        <div style={{ borderTop: `1px solid ${C.line}`, padding: '14px 18px', background: C.forest }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.auditMuted }}>Score formula</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
            {[
              ['HARD_LEGAL ≤7d, unconfirmed', '38 pts'],
              ['HARD_LEGAL ≤7d', '30 pts'],
              ['HARD_LEGAL ≤14d', '18 pts'],
              ['HARD_CONTRACTUAL ≤7d', '20 pts'],
              ['Budget ≥75%', '15 pts'],
              ['Budget ≥90%', '22 pts'],
              ['Client silence ≥14d', '12 pts'],
              ['Client silence ≥21d', '18 pts'],
              ['WIP ≥$2,000', '6 pts'],
              ['WIP ≥$4,000', '10 pts'],
              ['Critical anomaly', '+5 pts each'],
            ].map(([label, pts]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 11, color: C.auditMuted }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: C.brass, flexShrink: 0 }}>{pts}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid rgba(214,193,129,.18)`, display: 'grid', gap: 4 }}>
            {pressure.scoreBreakdown.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11 }}>
                <span style={{ color: C.auditMuted }}>{item.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: C.brass, flexShrink: 0 }}>+{item.pts}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, fontWeight: 600, paddingTop: 6, borderTop: `1px solid rgba(214,193,129,.18)` }}>
              <span style={{ color: C.brass, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</span>
              <span style={{ color: C.brass, fontFamily: 'var(--font-mono)' }}>{pressure.score} / 100</span>
            </div>
          </div>
        </div>
      )}
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
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.2, color: isReceipted ? '#F5F0DC' : C.ink }}>
          {row.title}
        </h3>
        <p style={{ margin: '5px 0 0', color: isReceipted ? C.auditMuted : C.muted, fontSize: 13, lineHeight: 1.35 }}>
          {row.description}
        </p>
        <div style={{ marginTop: 8, color: isReceipted ? C.auditMuted : C.danger, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          {row.matterRisk}
        </div>
        {row.extraTags && !isReceipted && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
            {row.extraTags.map(tag => (
              <span key={tag} style={{
                background: C.tealSoft, color: C.teal, border: `1px solid rgba(29,158,117,.2)`,
                borderRadius: 4, padding: '2px 7px', fontFamily: 'var(--font-mono)', fontSize: 10,
              }}>{tag}</span>
            ))}
          </div>
        )}
        {row.sourceRef && !isReceipted && (
          <div style={{ marginTop: 9, borderLeft: `2px solid rgba(29,158,117,.35)`, paddingLeft: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ background: 'rgba(29,158,117,.1)', color: C.teal, border: `1px solid rgba(29,158,117,.2)`, borderRadius: 3, padding: '1px 5px', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {row.sourceRef.type.replace(/_/g, ' ')}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: C.muted }}>
                {row.sourceRef.docId}
                {row.sourceRef.court ? ` · ${row.sourceRef.court}` : ''}
                {row.sourceRef.detectedAt ? ` · Detected ${row.sourceRef.detectedAt}` : ''}
              </span>
            </div>
            {row.sourceRef.excerpt && (
              <p style={{ margin: 0, fontSize: 12, color: C.muted, fontStyle: 'italic', lineHeight: 1.4 }}>
                "{row.sourceRef.excerpt}"
              </p>
            )}
          </div>
        )}
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
  traceRef:        RefObject<HTMLDivElement | null>;
  sweepError?:     string | null;
  isOpen:          boolean;
  onToggle:        () => void;
}

function ProofRail({ isPlaying, isSweepComplete, displayed, gateCounts, decisionCount, traceRef, sweepError, isOpen, onToggle }: ProofRailProps) {
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

  if (!isOpen) {
    return (
      <aside style={{
        background: C.audit, borderLeft: `1px solid ${C.auditLine}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, gap: 12,
        cursor: 'pointer',
      }} onClick={onToggle}>
        <button
          title="Expand audit trail"
          style={{ background: 'none', border: `1px solid ${C.auditLine}`, borderRadius: 999, color: C.auditAccent, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}
        >◀</button>
        <span style={{
          writingMode: 'vertical-rl', transform: 'rotate(180deg)',
          fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
          letterSpacing: '0.12em', color: C.auditMuted, userSelect: 'none',
        }}>Audit trail</span>
        {isPlaying && (
          <span style={{ width: 8, height: 8, borderRadius: 999, background: C.auditAccent, animation: 'litt-rail-pulse 1s ease-in-out infinite' }} />
        )}
      </aside>
    );
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ border: `1px solid ${C.auditLine}`, borderRadius: 999, padding: '5px 8px', color: C.auditAccent, fontFamily: 'var(--font-mono)', fontSize: 10, whiteSpace: 'nowrap' }}>
            {railState}
          </span>
          <button
            onClick={onToggle}
            title="Collapse audit trail"
            style={{ background: 'none', border: `1px solid ${C.auditLine}`, borderRadius: 999, color: C.auditMuted, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}
          >▶</button>
        </div>
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
  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'auto', zIndex: 20 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(16,23,19,.24)', opacity: 1, transition: 'opacity 0.22s ease' }} />
      <aside style={{
        position:   'absolute',
        top:        0,
        right:      0,
        height:     '100%',
        width:      'min(460px, 92vw)',
        background: C.paper,
        borderLeft: `1px solid ${C.line}`,
        boxShadow:  '-22px 0 54px rgba(20,27,23,.18)',
        transform:  'translateX(0)',
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
  const [activeView,     setActiveView]    = useState<ActiveView>('docket');
  const [railOpen,       setRailOpen]      = useState(false);
  const timerRefs    = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const traceBottomRef = useRef<HTMLDivElement>(null);

  const loadBrief = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBrief(await getBrief(FIRM_ID, ATTORNEY_ID));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load brief');
    } finally {
      setLoading(false);
    }
  }, []);

  // Silent background refresh — no loading spinner, used after action animations
  const refreshBrief = useCallback(async () => {
    try {
      setBrief(await getBrief(FIRM_ID, ATTORNEY_ID));
    } catch (_) {
      // don't disrupt UI for a background refresh failure
    }
  }, []);

  async function handleSweep() {
    setSweeping(true);
    setSweepError(null);
    setTimeline(null);
    setDisplayed([]);
    setIsPlaying(false);
    setIsSweepComplete(false);
    setRailOpen(true);
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

  useEffect(() => { loadBrief(); }, [loadBrief]);

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

    // receipted → collapsing → resolved → silent brief refresh
    setReceiptedIds(prev => new Set([...prev, sectionId]));
    const t1 = setTimeout(() => {
      setCollapsingIds(prev => new Set([...prev, sectionId]));
      const t2 = setTimeout(() => {
        setResolved(prev => new Set([...prev, sectionId]));
        setReceiptedIds(prev => { const s = new Set(prev); s.delete(sectionId); return s; });
        setCollapsingIds(prev => { const s = new Set(prev); s.delete(sectionId); return s; });
        refreshBrief(); // sync center column to true Firestore state after animation
      }, 600);
      timerRefs.current.set(`${sectionId}-2`, t2);
    }, 1250);
    timerRefs.current.set(`${sectionId}-1`, t1);
  }, [refreshBrief]);

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

  const VIEW_META: Record<ActiveView, { title: string; desc: string }> = {
    docket:    { title: 'Closeout docket',  desc: 'Attorney decisions ranked by operational pressure. Each row exposes gate, confidence, architecture boundary, and action path.' },
    deadlines: { title: 'Deadline risk',    desc: 'Court-filed, contractual, and internal deadlines requiring attorney confirmation before closeout.' },
    billing:   { title: 'Billing WIP',      desc: 'Pending time entries — scrubber results, UTBMS codes, session data, and approval paths.' },
    silence:   { title: 'Client silence',   desc: 'Matters past the contact threshold. Comms agent drafts are gated behind attorney approval.' },
  };

  const VIEW_SECTION: Record<ActiveView, DecisionRow['section'] | null> = {
    docket: null, deadlines: 'deadline', billing: 'billing', silence: 'silence',
  };

  const allVisible     = decisionRows.filter(r => !resolved.has(r.id));
  const sectionFilter  = VIEW_SECTION[activeView];
  const visibleRows    = sectionFilter ? allVisible.filter(r => r.section === sectionFilter) : allVisible;
  const criticalCount  = allVisible.filter(r => r.gate === 'ESCALATION').length;
  const wipUsd         = brief.sections.time_entries.total_wip_usd;

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <DemoBanner firmName={brief.firm_name} demoDate={brief.generated_at.slice(0, 10)} />

      <div className="litt-shell-padding" style={{ maxWidth: 1720, margin: '0 auto', padding: '20px 26px 40px' }}>
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 20, overflow: 'hidden', background: C.paper, boxShadow: '0 28px 78px rgba(32,35,31,.13)' }}>

          {/* ── Topbar ── */}
          <div className="litt-topbar" style={{ display: 'grid', gridTemplateColumns: '286px 1fr auto', alignItems: 'center', gap: 18, padding: '12px 18px', background: C.paper, borderBottom: `1px solid ${C.line}` }}>
            {/* Logo + firm identity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span
                className="litt-logo"
                role="img"
                aria-label="Litt"
                style={{
                  display:          'block',
                  width:            180,
                  height:           48,
                  backgroundImage:  'url("/icons-logo/litt_logo_main_no_tagline.png")',
                  backgroundSize:   '220px auto',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'left center',
                  mixBlendMode:     'multiply',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.forest, letterSpacing: '-0.01em' }}>
                  {brief.firm_name}
                </span>
                <span style={{ color: C.line, fontSize: 14 }}>·</span>
                <span style={{ fontSize: 11, color: C.muted, fontFamily: 'var(--font-mono)' }}>
                  {brief.attorney_name}
                </span>
              </div>
            </div>

            <div className="litt-status-pills" style={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: 0 }}>
              {([
                criticalCount > 0 ? { value: String(criticalCount), label: 'escalation', color: C.danger, bg: C.dangerSoft } : null,
                { value: String(allVisible.length), label: 'decisions', color: C.ink, bg: 'transparent' },
                wipUsd > 0 ? { value: `$${wipUsd.toLocaleString()}`, label: 'wip pending', color: C.gold, bg: 'transparent' } : null,
                { value: '5', label: 'agents', color: C.muted, bg: 'transparent' },
                resolvedItems.length > 0 ? { value: String(resolvedItems.length), label: 'receipts', color: C.teal, bg: 'transparent' } : null,
              ] as ({ value: string; label: string; color: string; bg: string } | null)[]).filter(Boolean).map((stat, i, arr) => (
                <div key={stat!.label} style={{
                  display:        'flex',
                  flexDirection:  'column',
                  alignItems:     'center',
                  justifyContent: 'center',
                  padding:        '0 18px',
                  borderRight:    i < arr.length - 1 ? `1px solid ${C.line}` : 'none',
                  borderLeft:     i === 0 ? `1px solid ${C.line}` : 'none',
                  background:     stat!.bg,
                  minWidth:       52,
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: stat!.color, lineHeight: 1.1 }}>
                    {stat!.value}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: C.muted, marginTop: 2 }}>
                    {stat!.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="litt-topbar-actions" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <DemoResetButton firmId={FIRM_ID} onReset={loadBrief} />
              <Link
                to="/audit"
                style={{
                  border:       `1px solid ${C.line}`,
                  borderRadius: 8,
                  background:   C.surface,
                  color:        C.ink,
                  padding:      '10px 14px',
                  fontWeight:   500,
                  fontSize:     12,
                  whiteSpace:   'nowrap',
                  fontFamily:   'var(--font-sans)',
                  textDecoration: 'none',
                  display:      'inline-flex',
                  alignItems:   'center',
                }}
                title="View full audit log"
              >
                Audit Log
              </Link>
              <button
                onClick={() => downloadLedesExport(FIRM_ID).catch(e => console.error('LEDES export failed', e))}
                style={{
                  border:       `1px solid ${C.line}`,
                  borderRadius: 8,
                  background:   C.surface,
                  color:        C.ink,
                  padding:      '10px 14px',
                  fontWeight:   500,
                  fontSize:     12,
                  cursor:       'pointer',
                  whiteSpace:   'nowrap',
                  fontFamily:   'var(--font-sans)',
                }}
                title="Export all approved time entries as LEDES 1998B"
              >
                LEDES Export
              </button>
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
                  fontFamily:   'var(--font-sans)',
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
          <div className="litt-body-grid" style={{ display: 'grid', gridTemplateColumns: `286px 1fr ${railOpen ? '392px' : '40px'}`, minHeight: 860, transition: 'grid-template-columns 0.25s ease' }}>

            <NavPanel
              brief={brief}
              decisionCount={allVisible.length}
              activeView={activeView}
              onViewChange={setActiveView}
              firmName={brief.firm_name}
              attorneyName={brief.attorney_name}
            />

            {/* Main workbench */}
            <main className="litt-main" style={{
              padding:      18,
              display:      'grid',
              gap:          16,
              alignContent: 'start',
              background:   `linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,0) 260px), ${C.bg}`,
            }}>
              {/* Work header */}
              <div className="litt-work-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'end', borderBottom: `1px solid ${C.line}`, paddingBottom: 15 }}>
                <div>
                  <h2 className="litt-work-title" style={{ margin: 0, fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em', color: C.ink }}>
                    {VIEW_META[activeView].title}
                  </h2>
                  <p style={{ margin: '7px 0 0', color: C.muted, maxWidth: 720, lineHeight: 1.45, fontSize: 14 }}>
                    {VIEW_META[activeView].desc}
                  </p>
                </div>
                <span style={{ border: `1px solid ${C.line}`, borderRadius: 999, padding: '5px 8px', color: C.muted, background: C.surface, fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {brief.generated_at.slice(0, 10)}
                </span>
              </div>

              {activeView === 'docket' && <PressureSection pressure={pressure} decisionRows={decisionRows} />}

              {/* Decision docket / filtered view */}
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
              isOpen={railOpen}
              onToggle={() => setRailOpen(o => !o)}
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
