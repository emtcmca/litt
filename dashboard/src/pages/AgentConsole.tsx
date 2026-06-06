import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AgentObservation, CommitmentLevel } from '../types';
import { T } from '../tokens';
import { Icon } from '../components/ui/Icon';
import type { IconName } from '../components/ui/Icon';
import { runSweep } from '../api';
import sweepFixture from '../demo-fixtures/sweep.json';

const FIRM_ID   = 'strand-okafor';
const STEP_MS   = 640;
const IDLE_MS   = 2100;

// ── Static graph layout (viewBox 1000×600) ───────────────────────────────────
type NodeKind = 'input' | 'coord' | 'agent' | 'tool' | 'audit' | 'brief';
interface NodeDef { x: number; y: number; kind: NodeKind; icon: IconName; label?: string; sub?: string; plain?: string; tech?: string }
const NODE: Record<string, NodeDef> = {
  gmail:    { x: 116, y: 86,  kind: 'input', icon: 'mail',    label: 'Gmail',          sub: 'inbox & threads' },
  calendar: { x: 116, y: 228, kind: 'input', icon: 'clock',   label: 'Calendar',       sub: 'dates & hearings' },
  matter:   { x: 116, y: 370, kind: 'input', icon: 'book',    label: 'Matter store',   sub: 'cases & contacts' },
  billing:  { x: 116, y: 512, kind: 'input', icon: 'dollar',  label: 'Time & billing', sub: 'entries & budgets' },
  coordinator: { x: 372, y: 299, kind: 'coord', icon: 'refresh', label: 'Coordinator',
    plain: 'The router. Sorts every signal by a fixed rulebook.',
    tech:  'classify_signal() · deterministic dictionary routing · no model in the loop.' },
  deadline_agent: { x: 624, y: 86,  kind: 'agent', icon: 'shield',
    plain: 'Watches every court date and contractual due date.',
    tech:  'Computes days-remaining; 4 escalation tiers by deadline class.' },
  billing_agent:  { x: 624, y: 228, kind: 'agent', icon: 'dollar',
    plain: 'Checks every hour of work before it can be billed.',
    tech:  'Pre-bill scrubber — 7 deterministic rules; budget math.' },
  comms_agent:    { x: 624, y: 370, kind: 'agent', icon: 'mail',
    plain: 'Reads your inbox and your matters — triages messages that need a reply, and flags clients going quiet.',
    tech:  'Inbound triage (urgency scoring) + silence thresholds; Gemini summarizes & drafts, held at the gate.' },
  anomaly_agent:  { x: 624, y: 512, kind: 'agent', icon: 'alert',
    plain: 'Spots billing patterns that look off.',
    tech:  '13 detectors scored by severity × confidence.' },
  tool:  { x: 872, y: 158, kind: 'tool',  icon: 'lock',   label: 'Tool layer', sub: 'the only way to act' },
  audit: { x: 872, y: 330, kind: 'audit', icon: 'shield', label: 'Audit log',  sub: 'append-only record' },
  brief: { x: 872, y: 502, kind: 'brief', icon: 'check',  label: 'Your Brief', sub: 'gated to you' },
};
const INPUTS    = ['gmail', 'calendar', 'matter', 'billing'] as const;
const AGENT_IDS = ['deadline_agent', 'billing_agent', 'comms_agent', 'anomaly_agent'] as const;
const AGENT_SOURCES: Record<string, string[]> = {
  deadline_agent: ['calendar', 'matter'],
  billing_agent:  ['billing'],
  comms_agent:    ['matter', 'gmail'],
  anomaly_agent:  ['billing', 'matter'],
};
const BASE_EDGES: [string, string][] = [
  ...INPUTS.map(i => [i, 'coordinator'] as [string, string]),
  ...AGENT_IDS.map(a => ['coordinator', a] as [string, string]),
  ...AGENT_IDS.map(a => [a, 'tool'] as [string, string]),
  ['tool', 'audit'], ['tool', 'brief'],
];

// ── Static agent / coordinator data ──────────────────────────────────────────
interface AgentMeta { id: string; name: string; blurb: string; watches: string; logic: string; handledToday: number; surfaced: number; model: string | null }
const COORDINATOR_META = {
  id: 'coordinator', name: 'Coordinator',
  blurb: 'Classifies every signal with a Python function and routes it to a domain agent. It never asks the model which agent to use — routing is a dictionary, not a guess.',
};
const AGENTS_META: AgentMeta[] = [
  { id: 'deadline_agent', name: 'Deadline Monitor', model: null,
    watches: 'All active deadlines · your commitments', logic: '4 escalation tiers by classification',
    blurb: 'Computes days-remaining and applies an escalation cadence by deadline class. Surfaces unconfirmed HARD_LEGAL deadlines as critical.',
    handledToday: 11, surfaced: 1 },
  { id: 'billing_agent', name: 'Billing Reconciliation', model: null,
    watches: 'Pending time entries · budgets', logic: 'Pre-bill scrubber (7 rules) · budget math',
    blurb: 'Scrubs every pending entry against seven deterministic rules, computes budget utilization, and routes threshold crossings.',
    handledToday: 6, surfaced: 2 },
  { id: 'comms_agent', name: 'Client Comms', model: 'gemini-2.5-pro',
    watches: 'Your inbox · days since contact', logic: 'Inbound triage · silence triggers · source-backed drafts',
    blurb: 'Monitors your inbox and your matters. Triages client messages, summarizes each, pulls out action items, and drafts replies. Gmail access is read-only; every draft is held behind your approval.',
    handledToday: 9, surfaced: 4 },
  { id: 'anomaly_agent', name: 'Anomaly Escalation', model: null,
    watches: 'Billing & operational patterns', logic: '13 detectors · severity × confidence',
    blurb: 'Runs thirteen deterministic detectors, scores each by severity × confidence, and routes by risk.',
    handledToday: 14, surfaced: 1 },
];
function agentMeta(id: string) {
  if (id === 'coordinator') return COORDINATOR_META as AgentMeta;
  return AGENTS_META.find(a => a.id === id);
}

// ── Tool registry by agent (from prototype, pixel-faithful) ──────────────────
interface ToolSpec { name: string; kind: string; sig: string }
const TOOLS_BY_AGENT: Record<string, ToolSpec[]> = {
  coordinator:    [{ name: 'classify_signal', kind: 'route', sig: '(signal) → AgentId' }, { name: 'assemble_brief', kind: 'write', sig: '(items) → Brief' }],
  deadline_agent: [{ name: 'get_active_deadlines', kind: 'read', sig: '(matter_id?) → Deadline[]' }, { name: 'compute_days_remaining', kind: 'compute', sig: '(due) → int' }, { name: 'apply_escalation_tier', kind: 'compute', sig: '(days, cls) → Tier' }, { name: 'register_commitment', kind: 'write', sig: '(promise) → SoftDeadline' }, { name: 'surface_to_brief', kind: 'write', sig: '(item, priority) → BriefItem' }],
  billing_agent:  [{ name: 'get_pending_entries', kind: 'read', sig: '() → Entry[]' }, { name: 'run_prebill_scrubber', kind: 'compute', sig: '(entry) → Flag[]' }, { name: 'compute_budget_utilization', kind: 'compute', sig: '(matter) → pct' }, { name: 'hold_entry', kind: 'write', sig: '(entry, flag) → Held' }],
  comms_agent:    [{ name: 'scan_inbox', kind: 'read', sig: '(scope) → Message[]' }, { name: 'score_urgency', kind: 'compute', sig: '(msg) → 0..1' }, { name: 'summarize_message', kind: 'gemini', sig: '(msg) → {summary, items[]}' }, { name: 'extract_commitments', kind: 'gemini', sig: '(thread) → Promise[]' }, { name: 'draft_reply', kind: 'gemini', sig: '(msg, facts[]) → Draft' }, { name: 'route_to_agent', kind: 'route', sig: '(agent, ctx) → ack' }, { name: 'hold_for_approval', kind: 'gate', sig: '(draft) → Held' }],
  anomaly_agent:  [{ name: 'run_detectors', kind: 'compute', sig: '(entry) → Anomaly[]' }, { name: 'score_risk', kind: 'compute', sig: '(anomaly) → severity×conf' }, { name: 'require_reason', kind: 'gate', sig: '(anomaly) → Blocked' }],
};

// ── Commit / work / kind metadata ────────────────────────────────────────────
const COMMIT_META: Record<CommitmentLevel, { label: string; color: string; note: string }> = {
  AUTO_SAFE:       { label: 'Handled',       color: T.teal,   note: 'Safe to log — nothing needed from you.' },
  REVIEW_REQUIRED: { label: 'Your call',     color: T.gold,   note: 'Operational, but Litt wants your judgment.' },
  ESCALATION:      { label: 'Needs you now', color: T.danger, note: 'Litt can\'t resolve this one alone.' },
  BLOCKED:         { label: 'Held',          color: T.forest, note: 'Prepared and waiting for your signature.' },
};
const KIND_META: Record<string, { label: string; color: string }> = {
  read:    { label: 'read',    color: T.gold },
  compute: { label: 'compute', color: '#1F4D3F' },
  gemini:  { label: 'gemini',  color: T.teal },
  llm:     { label: 'gemini',  color: T.teal },
  route:   { label: 'route',   color: '#5F6F66' },
  gate:    { label: 'gate',    color: T.danger },
  write:   { label: 'write',   color: T.forest },
};

// ── Plain-English step narrations (index-aligned with sweep, 20 steps) ───────
const PLAIN = [
  'A new closeout begins. Litt gathers everything that happened across your matters today.',
  'It sorts every signal and hands it to the right specialist — by a fixed rulebook, never a guess.',
  'Client Comms reads your inbox — read-only. Three client messages are still waiting on a reply.',
  'It ranks them by urgency. Sandra Mercer\'s is the one to watch — she names a Thursday deadline.',
  'Gemini summarizes each message and pulls out exactly what\'s being asked of you.',
  'Sandra\'s note mentions a court deadline — so Comms hands it straight to the Deadline Monitor.',
  'The Deadline Monitor looks up that matter\'s dates and finds the Mercer opposition.',
  'Six days out, a hard court deadline, and unconfirmed — it raises a flag only you can clear.',
  'Now that the date is verified, Gemini drafts Sandra\'s reply — every fact traced to a record.',
  'The reply is held. Litt prepares the words; it never sends on its own.',
  'Litt also reads a note you sent Reyes — and catches a promise you made: an answer by Friday.',
  'It hands that promise to the Deadline Monitor, so your own word is watched like any other date.',
  'The Billing specialist pulls every pending time entry — nine of them, fourteen thousand dollars.',
  'It runs all nine through the seven-rule scrubber. One comes back flagged.',
  'That entry has no narrative, so Litt holds it before it can ever be billed.',
  'Acme\'s budget just crossed 78% — noted before it becomes a surprise.',
  'The Anomaly watcher runs thirteen detectors over the day\'s entries — one fires.',
  'It scores the pattern by severity and confidence: elevated risk, worth your eyes.',
  'It won\'t clear the flag without your reason — Litt never dismisses anything silently.',
  'Everything is assembled into your Brief: 5 items need you, 1 is critical. Every step was logged.',
];

// ── Node blurbs for inspector ─────────────────────────────────────────────────
const NODE_BLURB: Record<string, string> = {
  gmail:    'Read-only access through an MCP adapter. Litt extracts deadlines and contact activity — it never composes or sends from here.',
  calendar: 'Court dates and hearings flow in through MCP. The Deadline Monitor computes days-remaining from them.',
  matter:   'The system of record for cases, clients, and contacts. Every agent reads from it; only the tool layer writes back.',
  billing:  'Pending time entries and client budgets. The Billing specialist scrubs each entry and tracks utilization here.',
  tool:     'The single write path. No agent acts on its own — proposed actions pass through here, which records each one to the audit log.',
  audit:    'Append-only and tamper-evident. Every signal, tool call, gate, and decision lands here — CREATE-only at the storage layer.',
  brief:    'Where everything that needs your judgment is assembled, ranked by pressure. Gated to you — Litt prepares, you decide.',
};

// ── Sweep step adapter ────────────────────────────────────────────────────────
interface SweepStep {
  agent: string; type: string; commit: CommitmentLevel; work: string; desc: string;
  tool: { name: string; kind: string; sig: string; result: string } | null;
  from: string | null; to: string | null;
  model: string | null; conf: number | null;
}
function adaptObs(obs: AgentObservation): SweepStep {
  const rt = obs.data.tool as { name: string; kind: string; signature: string; result: string } | null;
  const hd = obs.data.handoff as { from: string; to: string } | null;
  return {
    agent:  obs.agent_name,
    type:   obs.observation_type,
    commit: obs.commitment_level,
    work:   obs.work_kind,
    desc:   obs.description,
    tool:   rt ? { name: rt.name, kind: rt.kind, sig: rt.signature, result: rt.result } : null,
    from:   hd?.from ?? null,
    to:     hd?.to   ?? null,
    model:  obs.model_name,
    conf:   obs.confidence,
  };
}

// ── SVG edge paths ────────────────────────────────────────────────────────────
function bezier(a: NodeDef, b: NodeDef) {
  const dx = (b.x - a.x) * 0.5;
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}
function routeBezier(a: NodeDef, b: NodeDef) {
  const mx = Math.min(a.x, b.x) - 116;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
}

// ── Graph activation per step ─────────────────────────────────────────────────
interface GraphState { nodes: Set<string>; edges: string[]; routes: string[] }
function stepGraph(s: SweepStep | null): GraphState {
  const none: GraphState = { nodes: new Set(), edges: [], routes: [] };
  if (!s) return none;
  if (s.type === 'SIGNAL_RECEIVED')
    return { nodes: new Set([...INPUTS, 'coordinator']), edges: INPUTS.map(n => n + '>coordinator'), routes: [] };
  if (s.type === 'ROUTING_DECISION')
    return { nodes: new Set(['coordinator', ...AGENT_IDS]), edges: AGENT_IDS.map(a => 'coordinator>' + a), routes: [] };
  if (s.type === 'ROUTE_HANDOFF' && s.from && s.to)
    return { nodes: new Set([s.from, s.to]), edges: ['coordinator>' + s.from], routes: [s.from + '>' + s.to] };
  if (s.agent === 'coordinator')
    return { nodes: new Set(['coordinator', 'tool', 'audit', 'brief']), edges: ['tool>audit', 'tool>brief'], routes: [] };
  const sources = AGENT_SOURCES[s.agent] ?? [];
  const k = s.tool?.kind;
  if (k === 'read')
    return { nodes: new Set([...sources, 'coordinator', s.agent]), edges: [...sources.map(n => n + '>coordinator'), 'coordinator>' + s.agent], routes: [] };
  const touchesTool = k === 'gate' || k === 'write' || ['RESULT', 'ESCALATION', 'APPROVAL_GATE_APPLIED'].includes(s.type);
  return { nodes: new Set([s.agent, ...(touchesTool ? ['tool'] : [])]), edges: ['coordinator>' + s.agent, ...(touchesTool ? [s.agent + '>tool'] : [])], routes: [] };
}

// ── Sub-components ────────────────────────────────────────────────────────────
function KindBadge({ kind }: { kind: string }) {
  const km = KIND_META[kind] ?? { label: kind, color: T.muted };
  return (
    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.03em', color: km.color, border: `1px solid ${km.color}66`, background: `${km.color}0f`, borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' as const }}>{km.label}</span>
  );
}

function ToolChip({ tool, below }: { tool: { name: string; kind: string }; below?: boolean }) {
  const km = KIND_META[tool.kind] ?? KIND_META['compute'];
  return (
    <div style={{ position: 'absolute', left: '50%', [below ? 'top' : 'bottom']: 'calc(100% + 7px)', transform: 'translateX(-50%)', whiteSpace: 'nowrap', zIndex: 8, display: 'flex', alignItems: 'center', gap: 6, background: T.surface, border: `1px solid ${km.color}`, borderRadius: 999, padding: '3px 9px 3px 7px', boxShadow: `0 3px 12px ${km.color}40` }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: km.color, flexShrink: 0 }} />
      <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 600, color: T.ink }}>{tool.name}()</span>
      <KindBadge kind={tool.kind} />
    </div>
  );
}

function GraphNode({ id, live, dim, selected, idle, commitColor, liveTool, tech, onSelect }: {
  id: string; live: boolean; dim: boolean; selected: boolean; idle: boolean;
  commitColor: string | null; liveTool: { name: string; kind: string } | null;
  tech: boolean; onSelect: (id: string) => void;
}) {
  const n = NODE[id];
  const isLLM = id === 'comms_agent';
  const widths: Record<NodeKind, number> = { input: 138, coord: 172, agent: 196, tool: 150, audit: 150, brief: 150 };
  const w = widths[n.kind];
  const ring = live ? (commitColor ?? (isLLM ? T.teal : T.forest)) : selected ? T.gold : null;

  const wrap: React.CSSProperties = {
    position: 'absolute', left: `${(n.x / 1000) * 100}%`, top: `${(n.y / 600) * 100}%`,
    transform: 'translate(-50%,-50%)', width: w, zIndex: live ? 4 : 2, borderRadius: 12,
    opacity: dim ? 0.4 : 1, transition: 'opacity .3s, box-shadow .4s',
    boxShadow: idle && !live && !selected ? '0 0 0 3px rgba(214,193,129,.22)' : undefined,
    cursor: 'pointer',
  };

  if (n.kind === 'input') {
    return (
      <div style={wrap} onClick={() => onSelect(id)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.surface, border: `1px solid ${ring ?? T.line}`, borderRadius: 9, padding: '8px 10px', boxShadow: live ? `0 0 0 3px ${ring}22` : '0 1px 2px rgba(20,20,18,.04)' }}>
          <span style={{ width: 24, height: 24, borderRadius: 6, background: T.wash2, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={n.icon} size={13} color={live ? (ring ?? T.muted) : T.muted} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, lineHeight: 1.1 }}>{n.label}</div>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: T.faint }}>{n.sub}</span>
          </div>
        </div>
      </div>
    );
  }

  if (n.kind === 'coord') {
    return (
      <div style={wrap} onClick={() => onSelect(id)}>
        {liveTool && <ToolChip tool={liveTool} below />}
        <div style={{ background: live ? 'rgba(20,34,31,.04)' : T.surface, border: `1.5px solid ${ring ?? 'rgba(20,34,31,.4)'}`, borderRadius: 12, padding: '12px 14px', boxShadow: live ? `0 0 0 4px ${ring}1f` : '0 2px 8px rgba(20,20,18,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: live ? (ring ?? T.forest) : T.forest }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Coordinator</span>
            <span style={{ marginLeft: 'auto', fontSize: 8.5, fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.04em', color: '#5F6F66', border: '1px solid rgba(95,111,102,.4)', borderRadius: 4, padding: '1px 5px' }}>Python</span>
          </div>
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4 }}>{tech ? n.tech : n.plain}</div>
        </div>
      </div>
    );
  }

  if (n.kind === 'agent') {
    const a = agentMeta(id);
    return (
      <div style={wrap} onClick={() => onSelect(id)}>
        {liveTool && <ToolChip tool={liveTool} below />}
        <div style={{ background: live ? (isLLM ? 'rgba(29,158,117,.05)' : 'rgba(20,34,31,.03)') : T.surface, border: `1px solid ${ring ?? T.line}`, borderRadius: 11, padding: '10px 12px', boxShadow: live ? `0 0 0 4px ${ring}1f` : '0 1px 3px rgba(20,20,18,.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: isLLM ? 'rgba(29,158,117,.1)' : 'rgba(20,34,31,.06)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon name={n.icon} size={14} color={isLLM ? T.teal : T.forest} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, flex: 1, minWidth: 0 }}>{a?.name ?? id}</span>
            <span style={{ fontSize: 8.5, fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.04em', color: isLLM ? T.teal : '#5F6F66', border: `1px solid ${isLLM ? 'rgba(29,158,117,.4)' : 'rgba(95,111,102,.4)'}`, borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>{isLLM ? 'Gemini' : 'Python'}</span>
          </div>
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4, marginTop: 6 }}>{tech ? n.tech : n.plain}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, paddingTop: 7, borderTop: `1px solid ${T.soft}` }}>
            {isLLM && <span style={{ fontSize: 8.5, fontFamily: 'var(--font-mono)', fontWeight: 600, color: T.teal, border: '1px solid rgba(29,158,117,.4)', borderRadius: 4, padding: '0 4px' }}>⇄ inbox</span>}
            <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: T.teal }}>{a?.handledToday ?? 0} handled</span>
            <span style={{ color: T.faint, fontSize: 9 }}>·</span>
            <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: (a?.surfaced ?? 0) > 0 ? T.gold : T.faint }}>{a?.surfaced ?? 0} to you</span>
          </div>
        </div>
      </div>
    );
  }

  // outcome nodes: tool / audit / brief
  const isDark  = n.kind === 'audit';
  const isBrief = n.kind === 'brief';
  const bg      = isDark ? T.audit : isBrief ? 'rgba(214,193,129,.12)' : T.surface;
  const fg      = isDark ? '#EFEBDB' : T.ink;
  const accent  = isDark ? T.auditAccent : T.gold;
  return (
    <div style={wrap} onClick={() => onSelect(id)}>
      {liveTool && n.kind === 'tool' && <ToolChip tool={liveTool} />}
      <div style={{ background: bg, border: `1px solid ${ring ?? (isDark ? 'transparent' : isBrief ? 'rgba(169,132,53,.4)' : T.line)}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 9, boxShadow: live ? `0 0 0 4px ${ring}22` : 'none' }}>
        <Icon name={n.icon} size={15} color={accent} stroke={isBrief ? 2.2 : 1.6} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: fg, lineHeight: 1.1 }}>{n.label}</div>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: isDark ? T.auditMuted : T.faint }}>{n.sub}</span>
        </div>
      </div>
    </div>
  );
}

// ── Inspector sub-cards ───────────────────────────────────────────────────────
function BoundaryCard({ sweep }: { sweep: SweepStep[] }) {
  const toolCalls   = sweep.filter(s => s.tool !== null);
  const geminiCount = toolCalls.filter(s => s.tool?.kind === 'gemini').length;
  const detCount    = toolCalls.length - geminiCount;
  return (
    <div style={{ border: `1px solid ${T.soft}`, borderRadius: 11, overflow: 'hidden' }}>
      <div style={{ padding: '11px 13px 9px', background: T.wash2, borderBottom: `1px solid ${T.soft}` }}>
        <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.faint }}>The boundary — why you can trust it</span>
      </div>
      <div style={{ padding: '12px 13px', display: 'grid', gap: 11 }}>
        {[['Python', '#5F6F66', 'Deterministic', 'Same input, same output — every time. Routing, math, state, and scoring. Auditable to the line.'],
          ['Gemini', T.teal,   'Drafts only',   'Touches a model only when a human will read the result. Drafting and extraction — never a decision, never a send.']
        ].map(([k, c, t, d]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '58px 1fr', gap: 9, alignItems: 'start' }}>
            <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 600, color: c, border: `1px solid ${c}55`, borderRadius: 5, padding: '2px 0', textAlign: 'center' as const }}>{k}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{t}</div>
              <span style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.4 }}>{d}</span>
            </div>
          </div>
        ))}
        {sweep.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingTop: 9, borderTop: `1px solid ${T.soft}` }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: T.forest }}>{detCount}<span style={{ fontSize: 11, color: T.faint, fontWeight: 500 }}>/{sweep.length}</span></span>
            <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: T.muted, lineHeight: 1.35 }}>steps in a sweep are deterministic. {geminiCount} call Gemini — only to summarize &amp; draft.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolList({ tools, title }: { tools: ToolSpec[]; title: string }) {
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.faint }}>{title} · {tools.length}</span>
      <div style={{ display: 'grid', gap: 5 }}>
        {tools.map(t => (
          <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 8, padding: '7px 9px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: 600, color: T.ink }}>{t.name}</span>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.faint, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{t.sig}</span>
            </div>
            <KindBadge kind={t.kind} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolCatalog({ sweep }: { sweep: SweepStep[] }) {
  const order = ['coordinator', 'deadline_agent', 'billing_agent', 'comms_agent', 'anomaly_agent'];
  const kindCounts: Record<string, number> = {};
  Object.values(TOOLS_BY_AGENT).flat().forEach(t => { kindCounts[t.kind] = (kindCounts[t.kind] ?? 0) + 1; });
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.faint, display: 'block', marginBottom: 6 }}>Tool kinds</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {Object.keys(KIND_META).filter(k => kindCounts[k]).map(k => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <KindBadge kind={k} />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.faint }}>{kindCounts[k]}</span>
            </span>
          ))}
        </div>
      </div>
      <BoundaryCard sweep={sweep} />
      {order.map(id => {
        const tools = TOOLS_BY_AGENT[id] ?? [];
        const a = agentMeta(id);
        return (
          <div key={id} style={{ display: 'grid', gap: 5 }}>
            <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 600, color: T.muted }}>{a?.name ?? id}</span>
            {tools.map(t => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 9px', background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 7 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: T.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{t.name}<span style={{ color: T.faint, fontWeight: 400 }}>{t.sig}</span></span>
                <KindBadge kind={t.kind} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function LiveToolCard({ tool }: { tool: { name: string; kind: string; sig: string; result: string } }) {
  const km = KIND_META[tool.kind] ?? KIND_META['compute'];
  return (
    <div style={{ border: `1px solid ${km.color}40`, borderRadius: 11, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', background: `${km.color}0e`, borderBottom: `1px solid ${km.color}22` }}>
        <Icon name="lock" size={12} color={km.color} />
        <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.08em', color: km.color, fontWeight: 600 }}>Tool call</span>
        <span style={{ marginLeft: 'auto' }}><KindBadge kind={tool.kind} /></span>
      </div>
      <div style={{ padding: '10px 11px', display: 'grid', gap: 7 }}>
        <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: T.ink }}>{tool.name}()</span>
        <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: T.muted, lineHeight: 1.5, wordBreak: 'break-word' as const, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 6, padding: '6px 8px', display: 'block' }}>{tool.sig}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="arrow" size={12} color={km.color} />
          <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: T.ink, fontWeight: 500 }}>{tool.result}</span>
        </div>
      </div>
    </div>
  );
}

function HandoffCard({ from, to }: { from: string; to: string }) {
  const fa = agentMeta(from), ta = agentMeta(to);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(169,132,53,.08)', border: '1px solid rgba(169,132,53,.3)', borderRadius: 11, padding: '11px 13px' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.07em', color: T.faint, display: 'block', marginBottom: 2 }}>Cross-agent hand-off</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{fa?.name ?? from}</span>
          <Icon name="arrow" size={13} color={T.gold} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: T.gold }}>{ta?.name ?? to}</span>
        </div>
      </div>
      <span style={{ width: 30, height: 30, borderRadius: 999, background: 'rgba(169,132,53,.16)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="refresh" size={15} color={T.gold} /></span>
    </div>
  );
}

// ── Inspector panel ───────────────────────────────────────────────────────────
function Inspector({ sel, setSel, step, sweep, tech, onBriefNav, sweepEmpty }: {
  sel: string | null; setSel: (s: string | null) => void;
  step: number; sweep: SweepStep[]; tech: boolean;
  onBriefNav: () => void; sweepEmpty: boolean;
}) {
  const [tab, setTab] = useState<'inspector' | 'log'>('inspector');
  const cur = step >= 0 && step < sweep.length ? sweep[step] : null;
  const complete = step === sweep.length - 1 && sweep.length > 0;

  // node selected
  if (sel) {
    const n    = NODE[sel];
    const a    = agentMeta(sel);
    const isAgent = n.kind === 'agent', isCoord = n.kind === 'coord';
    const isLLM   = sel === 'comms_agent';
    return (
      <div style={{ padding: '16px 18px', display: 'grid', gap: 14, alignContent: 'start', overflowY: 'auto' }}>
        <button onClick={() => setSel(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 12, fontWeight: 600, padding: 0, fontFamily: 'var(--font-sans)', justifySelf: 'start' }}>
          <Icon name="chevron" size={12} color={T.muted} style={{ transform: 'rotate(180deg)' }} />Back
        </button>
        <div>
          <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.1em', color: T.faint }}>
            {n.kind === 'input' ? 'Signal source' : isCoord ? 'Router' : isAgent ? 'Specialist agent' : 'On the record'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: T.ink }}>{isAgent || isCoord ? (a?.name ?? sel) : n.label}</h2>
            {(isAgent || isCoord) && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase' as const, color: isLLM ? T.teal : '#5F6F66', border: `1px solid ${isLLM ? 'rgba(29,158,117,.4)' : 'rgba(95,111,102,.4)'}`, borderRadius: 4, padding: '1px 6px' }}>{isLLM ? 'Gemini' : 'Python'}</span>}
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: T.ink, lineHeight: 1.55 }}>{isAgent && a ? a.blurb : isCoord ? COORDINATOR_META.blurb : NODE_BLURB[sel] ?? (n.sub ?? '')}</p>
        {isAgent && a && (
          <>
            <div style={{ display: 'grid', gap: 8 }}>
              {[['Watches', a.watches], ['How it decides', a.logic]].map(([k, v]) => (
                <div key={k} style={{ background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 9, padding: '9px 11px' }}>
                  <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.07em', color: T.faint, display: 'block', marginBottom: 3 }}>{k}</span>
                  <span style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.4 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, background: 'rgba(29,158,117,.06)', border: '1px solid rgba(29,158,117,.2)', borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.teal, lineHeight: 1 }}>{a.handledToday}</div>
                <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: T.muted, marginTop: 2, display: 'block' }}>handled today</span>
              </div>
              <div style={{ flex: 1, background: a.surfaced ? 'rgba(169,132,53,.07)' : T.wash2, border: `1px solid ${a.surfaced ? 'rgba(169,132,53,.22)' : T.soft}`, borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: a.surfaced ? T.gold : T.faint, lineHeight: 1 }}>{a.surfaced}</div>
                <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: T.muted, marginTop: 2, display: 'block' }}>surfaced to you</span>
              </div>
            </div>
            <ToolList tools={TOOLS_BY_AGENT[sel] ?? []} title="Tools it can call" />
          </>
        )}
        {(isCoord) && <ToolList tools={TOOLS_BY_AGENT['coordinator'] ?? []} title="What it calls" />}
        {n.kind === 'tool' && <ToolCatalog sweep={sweep} />}
        {n.kind === 'brief' && (
          <button onClick={onBriefNav} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: T.forest, color: T.brass, fontSize: 13, fontWeight: 600, padding: '11px 16px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
            Open Brief <Icon name="arrow" size={13} color={T.brass} />
          </button>
        )}
      </div>
    );
  }

  // step active
  if (cur) {
    const cm   = COMMIT_META[cur.commit];
    const wm   = { deterministic: { label: 'Python · deterministic', tone: 'forest' }, llm_assisted: { label: 'Gemini · llm-assisted', tone: 'teal' }, tool_write: { label: 'Tool layer · write', tone: 'gold' }, human_gate: { label: 'Human gate', tone: 'danger' }, route: { label: 'Python · route', tone: 'forest' } }[cur.work] ?? { label: cur.work, tone: 'forest' };
    const isTealTone = wm.tone === 'teal';
    return (
      <div style={{ overflowY: 'auto' }}>
        <div style={{ padding: '16px 18px', display: 'grid', gap: 14 }}>
          {/* tab bar */}
          <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${T.soft}`, paddingBottom: 10 }}>
            {(['inspector', 'log'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.06em', color: tab === t ? T.ink : T.faint, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px', borderBottom: `2px solid ${tab === t ? T.forest : 'transparent'}` }}>{t}</button>
            ))}
          </div>
          {tab === 'inspector' ? (
            <>
              {complete ? (
                /* ── Sweep-complete summary (replaces step-level detail) ── */
                <div style={{ display: 'grid', gap: 14 }}>
                  <div style={{ background: T.audit, borderRadius: 12, padding: '16px 16px', display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 30, height: 30, borderRadius: 999, background: 'rgba(158,225,199,.16)', border: '1px solid rgba(158,225,199,.4)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="check" size={16} color={T.auditAccent} stroke={2.2} /></span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#EFEBDB', lineHeight: 1.2 }}>Sweep complete</div>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: T.auditMuted }}>every step was logged</span>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: T.auditMuted, lineHeight: 1.6 }}>
                      Litt reviewed everything across your matters. Five items need your attention — one requires immediate action. Nothing was sent, filed, or billed. Switch to the Log tab to see every step.
                    </p>
                    <button onClick={onBriefNav} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: T.brass, color: T.forest, fontSize: 13, fontWeight: 600, padding: '11px 14px', borderRadius: 9, border: 'none', cursor: 'pointer' }}>
                      Review items in your Brief <Icon name="arrow" size={13} color={T.forest} />
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Live step detail ── */
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.1em', color: T.faint }}>Live · step {step + 1}</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.faint }}>{agentMeta(cur.agent)?.name ?? cur.agent}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: `${cm.color}10`, border: `1px solid ${cm.color}33`, borderRadius: 10, padding: '11px 13px 12px' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: cm.color, flexShrink: 0 }} />
                    <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: cm.color, lineHeight: 1.2 }}>{cm.label}</div>
                      <span style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.35, display: 'block' }}>{cm.note}</span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 15, color: T.ink, lineHeight: 1.55, fontWeight: 450 }}>{tech ? cur.desc : (PLAIN[step] ?? cur.desc)}</p>
                  {cur.tool && cur.tool.sig && <LiveToolCard tool={{ name: cur.tool.name, kind: cur.tool.kind, sig: cur.tool.sig, result: cur.tool.result }} />}
                  {cur.type === 'ROUTE_HANDOFF' && cur.from && cur.to && <HandoffCard from={cur.from} to={cur.to} />}
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                    <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: isTealTone ? '#0F6E56' : '#3A4A44', background: isTealTone ? 'rgba(29,158,117,.1)' : 'rgba(20,34,31,.06)', border: `1px solid ${isTealTone ? 'rgba(29,158,117,.3)' : 'rgba(20,34,31,.18)'}`, borderRadius: 5, padding: '3px 8px' }}>{wm.label}</span>
                    {tech && <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: T.muted, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 5, padding: '3px 8px' }}>{cur.type}</span>}
                    {cur.model && <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: T.teal, background: 'rgba(29,158,117,.08)', border: '1px solid rgba(29,158,117,.24)', borderRadius: 5, padding: '3px 8px' }}>model: {cur.model}</span>}
                    {cur.conf != null && <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: T.muted, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 5, padding: '3px 8px' }}>confidence {cur.conf}</span>}
                  </div>
                </>
              )}
            </>
          ) : (
            // Log tab
            <div style={{ display: 'grid', gap: 6 }}>
              {sweep.map((s, i) => {
                const c = COMMIT_META[s.commit];
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 9px', background: i === step ? T.wash2 : 'none', borderRadius: 7, border: i === step ? `1px solid ${T.soft}` : '1px solid transparent' }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: c.color, flexShrink: 0, marginTop: 4 }} />
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: T.muted, display: 'block' }}>{agentMeta(s.agent)?.name ?? s.agent}</span>
                      <span style={{ fontSize: 11.5, color: T.ink, lineHeight: 1.4 }}>{s.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // idle — no step
  const scaleHandled  = AGENTS_META.reduce((s, a) => s + a.handledToday, 0);
  const scaleSurfaced = AGENTS_META.reduce((s, a) => s + a.surfaced, 0);
  return (
    <div style={{ padding: '16px 18px', display: 'grid', gap: 16, alignContent: 'start' }}>
      <div>
        <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.1em', color: T.faint }}>Today, across your matters</span>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <div style={{ flex: 1, background: 'rgba(29,158,117,.06)', border: '1px solid rgba(29,158,117,.2)', borderRadius: 11, padding: '12px 13px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: T.teal, lineHeight: 1 }}>{scaleHandled}</div>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.muted, marginTop: 3, display: 'block' }}>handled automatically</span>
          </div>
          <div style={{ flex: 1, background: 'rgba(169,132,53,.07)', border: '1px solid rgba(169,132,53,.22)', borderRadius: 11, padding: '12px 13px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: T.gold, lineHeight: 1 }}>{scaleSurfaced}</div>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.muted, marginTop: 3, display: 'block' }}>surfaced to you</span>
          </div>
        </div>
      </div>
      <BoundaryCard sweep={sweepEmpty ? [] : []} />
      <div style={{ background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 11, padding: '13px 14px', display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="lock" size={14} color={T.gold} />
          <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>One door to act</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: T.muted, lineHeight: 1.5 }}>No agent writes anything directly. Every change flows through one tool layer, which records it to the append-only log. Litt never sends, files, or bills on its own — it prepares; you decide.</p>
      </div>
      <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: T.faint, textAlign: 'center' as const, lineHeight: 1.6 }}>Press <span style={{ color: T.muted }}>Run closeout sweep</span> to watch it work,<br />or tap any node to inspect it.</span>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function AgentConsole() {
  const location = useLocation();
  const nav      = useNavigate();
  const frozen   = new URLSearchParams(location.search).get('frozen') === '1';

  const [sweep,      setSweep]      = useState<SweepStep[]>([]);
  const [step,       setStep]       = useState(-1);
  const [playing,    setPlaying]    = useState(false);
  const [tech,       setTech]       = useState(false);
  const [sel,        setSel]        = useState<string | null>(null);
  const [idleIdx,    setIdleIdx]    = useState(0);
  const [error,      setError]      = useState<string | null>(null);
  const [isRunning,  setIsRunning]  = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = []; }
  useEffect(() => () => clearTimers(), []);

  // Pre-load sweep when frozen=1 (Playwright tests need the scrubber segments)
  useEffect(() => {
    if (!frozen) return;
    runSweep(FIRM_ID)
      .then(res => setSweep(res.timeline.observations.map(adaptObs)))
      .catch(() => setSweep((sweepFixture as AgentObservation[]).map(adaptObs)));
  }, [frozen]);

  // Idle heartbeat
  useEffect(() => {
    if (frozen || step >= 0 || playing) return;
    const t = setInterval(() => setIdleIdx(i => (i + 1) % AGENT_IDS.length), IDLE_MS);
    return () => clearInterval(t);
  }, [frozen, step, playing]);
  const idleOn    = step < 0 && !playing && !sel;
  const idleAgent = AGENT_IDS[idleIdx];
  const idleSrc   = AGENT_SOURCES[idleAgent] ?? [];
  const idleNodes = idleOn ? new Set([...idleSrc, 'coordinator', idleAgent]) : new Set<string>();
  const idleEdges = idleOn ? [...idleSrc.map(n => n + '>coordinator'), 'coordinator>' + idleAgent] : [];

  const handleRun = useCallback(async () => {
    clearTimers();
    setIsRunning(true);
    setError(null);
    setSel(null);
    try {
      let obs: AgentObservation[];
      try {
        const res = await runSweep(FIRM_ID);
        obs = res.timeline.observations;
      } catch {
        // Backend not running — use demo fixture
        obs = sweepFixture as AgentObservation[];
      }
      const steps = obs.map(adaptObs);
      setSweep(steps);
      setStep(-1);
      setPlaying(true);
      for (let i = 0; i < steps.length; i++) {
        const id = setTimeout(() => {
          setStep(i);
          if (i === steps.length - 1) setPlaying(false);
        }, (i + 1) * STEP_MS);
        timers.current.push(id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sweep failed');
    } finally {
      setIsRunning(false);
    }
  }, []);

  function pause() { clearTimers(); setPlaying(false); }
  function scrub(i: number) { clearTimers(); setPlaying(false); setSel(null); setStep(i); }

  const g = stepGraph(step >= 0 && step < sweep.length ? sweep[step] : null);
  const cur         = step >= 0 && step < sweep.length ? sweep[step] : null;
  const commitColor = cur ? COMMIT_META[cur.commit].color : null;

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%', minHeight: 0, background: T.wash }}>
      {/* header */}
      <div style={{ padding: '20px 26px 16px', borderBottom: `1px solid ${T.soft}`, background: T.surface }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Agent console</h1>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: T.teal, background: T.tealSoft, border: '1px solid rgba(29,158,117,.28)', borderRadius: 5, padding: '2px 7px' }}>the engine room</span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: T.muted, lineHeight: 1.5, maxWidth: '60ch' }}>
              Watch Litt think. A coordinator routes every signal to a specialist with deterministic code, the agents do the work, and anything legal is gated back to you.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'inline-flex', background: T.wash2, border: `1px solid ${T.line}`, borderRadius: 999, padding: 3 }}>
              {([['Plain English', false], ['Technical', true]] as [string, boolean][]).map(([label, val]) => (
                <button key={label} onClick={() => setTech(val)} style={{ padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)', background: tech === val ? T.forest : 'transparent', color: tech === val ? T.brass : T.muted }}>{label}</button>
              ))}
            </div>
            <button onClick={() => playing ? pause() : handleRun()} disabled={isRunning} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: T.forest, color: T.brass, border: `1px solid ${T.forest}`, cursor: isRunning ? 'wait' : 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' as const, opacity: isRunning ? 0.7 : 1 }}>
              {playing ? (
                <><span style={{ display: 'inline-flex', gap: 2.5 }}><span style={{ width: 2.5, height: 11, background: T.brass }} /><span style={{ width: 2.5, height: 11, background: T.brass }} /></span>Pause</>
              ) : (
                <><Icon name="refresh" size={15} color={T.brass} />{sweep.length > 0 && step === sweep.length - 1 ? 'Replay sweep' : step >= 0 ? 'Resume' : 'Run closeout sweep'}</>
              )}
            </button>
          </div>
        </div>
        {error && <div style={{ fontSize: 12, color: T.danger, marginTop: 8 }}>{error}</div>}
      </div>

      {/* body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 312px', minHeight: 0, overflow: 'auto' }}>
        {/* graph canvas */}
        <div style={{ position: 'relative', minHeight: 560, minWidth: 0, borderRight: `1px solid ${T.soft}`, backgroundImage: 'radial-gradient(rgba(20,20,18,.05) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
          {/* column captions */}
          {([['Signals in', 116], ['Router', 372], ['Specialist agents', 624], ['On the record', 872]] as [string, number][]).map(([label, x]) => (
            <span key={label} style={{ position: 'absolute', left: `${(x / 1000) * 100}%`, top: 14, transform: 'translateX(-50%)', fontSize: 9.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.1em', color: T.faint, whiteSpace: 'nowrap', zIndex: 3 }}>{label}</span>
          ))}
          {/* legend */}
          <div style={{ position: 'absolute', right: 14, top: 30, zIndex: 3, display: 'grid', gap: 4, background: 'rgba(255,255,255,.74)', borderRadius: 9, padding: '6px 10px', border: `1px solid ${T.soft}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="20" height="6" style={{ display: 'block' }}><line x1="1" y1="3" x2="19" y2="3" stroke={T.teal} strokeWidth="1.6" strokeDasharray="1.5 3" strokeLinecap="round" /></svg>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: T.muted }}>two-way inbox channel</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="20" height="6" style={{ display: 'block' }}><line x1="1" y1="3" x2="19" y2="3" stroke={T.gold} strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" /></svg>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: T.muted }}>agent hand-off</span>
            </div>
          </div>

          {/* SVG edges */}
          <svg viewBox="0 0 1000 600" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}>
            {BASE_EDGES.map(([a, b]) => {
              const key = a + '>' + b;
              const on  = g.edges.includes(key);
              const d   = bezier(NODE[a], NODE[b]);
              return (
                <g key={key}>
                  <path d={d} fill="none" stroke={T.line} strokeWidth={1.25} vectorEffect="non-scaling-stroke" style={{ opacity: step >= 0 && !on ? 0.5 : 1 }} />
                  {(key === 'gmail>coordinator' || key === 'coordinator>comms_agent') && !on && (
                    <path d={d} fill="none" stroke={T.teal} strokeWidth={1.6} strokeLinecap="round" strokeDasharray="1.5 9" vectorEffect="non-scaling-stroke" style={{ opacity: (g.nodes.has('comms_agent') || idleNodes.has('comms_agent')) ? .7 : .24 }} />
                  )}
                  {idleEdges.includes(key) && !on && (
                    <path d={d} fill="none" stroke={T.brass} strokeWidth={2} strokeLinecap="round" strokeDasharray="2 12" vectorEffect="non-scaling-stroke" className="ag-edge-idle" style={{ opacity: .65 }} />
                  )}
                  {on && (
                    <path d={d} fill="none" stroke={commitColor ?? T.teal} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="2 11" vectorEffect="non-scaling-stroke" className="ag-edge-flow" />
                  )}
                </g>
              );
            })}
            {g.routes.map(r => {
              const [a, b] = r.split('>');
              return <path key={'route-' + r} d={routeBezier(NODE[a], NODE[b])} fill="none" stroke={T.gold} strokeWidth={2.6} strokeLinecap="round" strokeDasharray="2 8" vectorEffect="non-scaling-stroke" className="ag-edge-flow" />;
            })}
          </svg>

          {/* nodes */}
          {Object.keys(NODE).map(id => (
            <GraphNode key={id} id={id} tech={tech}
              live={g.nodes.has(id)}
              dim={step >= 0 && !g.nodes.has(id) && sel !== id}
              selected={sel === id}
              idle={idleNodes.has(id)}
              commitColor={g.nodes.has(id) ? commitColor : null}
              liveTool={(cur && cur.tool && cur.type === 'TOOL_CALL' && cur.agent === id) ? cur.tool : null}
              onSelect={id => { pause(); setSel(s => s === id ? null : id); }}
            />
          ))}

          {/* scrubber dock */}
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 14, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(6px)', border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14, zIndex: 5, boxShadow: '0 4px 16px rgba(20,20,18,.08)' }}>
            <button onClick={() => playing ? pause() : handleRun()} aria-label={playing ? 'Pause' : 'Play'} style={{ width: 30, height: 30, borderRadius: 999, border: 'none', background: T.forest, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              {playing
                ? <span style={{ display: 'inline-flex', gap: 2.5 }}><span style={{ width: 2.5, height: 10, background: T.brass }} /><span style={{ width: 2.5, height: 10, background: T.brass }} /></span>
                : <span style={{ width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: `9px solid ${T.brass}`, marginLeft: 2 }} />
              }
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              {sweep.length > 0 ? (
                <>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {sweep.map((s, i) => {
                      const done   = i <= step;
                      const isCur  = i === step;
                      const col    = COMMIT_META[s.commit].color;
                      return (
                        <button key={i} data-testid="sweep-step" onClick={() => scrub(i)} aria-label={`Step ${i + 1}`}
                          style={{ flex: 1, height: isCur ? 9 : 6, borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0, background: done ? col : T.wash2, opacity: done ? (isCur ? 1 : 0.5) : 1, transition: 'all .2s' }} />
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.faint, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {idleOn && <span className="litt-pulse" style={{ width: 5, height: 5, borderRadius: 999, background: T.teal }} />}
                      {step < 0 ? `Watching · ${agentMeta(idleAgent)?.name ?? idleAgent}` : `Step ${step + 1} of ${sweep.length}`}
                    </span>
                    <span data-dynamic style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.faint }}>{step < 0 ? 'last sweep 5:00 PM' : `+${(step * STEP_MS / 1000).toFixed(1)}s`}</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.faint, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {idleOn && <span className="litt-pulse" style={{ width: 5, height: 5, borderRadius: 999, background: T.teal }} />}
                    {`Watching · ${agentMeta(idleAgent)?.name ?? idleAgent}`}
                  </span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.faint }}>last sweep 5:00 PM</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* inspector */}
        <div style={{ overflowY: 'auto', overflowX: 'hidden', background: T.surface, minWidth: 0 }}>
          <Inspector sel={sel} setSel={setSel} step={step} sweep={sweep} tech={tech}
            onBriefNav={() => nav('/brief')}
            sweepEmpty={sweep.length === 0} />
        </div>
      </div>
    </div>
  );
}
