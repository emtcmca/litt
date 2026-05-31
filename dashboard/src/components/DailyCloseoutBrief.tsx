import { useCallback, useEffect, useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import type {
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

const FIRM_ID = 'strand-okafor';
const ATTORNEY_ID = 'dana-strand';

// ─── Modal union ─────────────────────────────────────────────────────────────

type OpenModal =
  | { type: 'deadline'; item: BriefDeadlineItem; action: DeadlineAction }
  | { type: 'billing'; item: BriefTimeEntryItem; action: BillingAction }
  | { type: 'comms'; item: BriefClientSilenceItem }
  | { type: 'budget'; item: BriefBudgetItem }
  | { type: 'anomaly'; item: BriefAnomalyItem };

interface ResolvedItem {
  sectionId: string;
  entityId: string;
  entityType: string;
  auditEventId: string;
  resolvedAt: string;
}

interface StoryStep {
  label: string;
  headline: string;
  detail: string;
  proof: string;
  tone: 'critical' | 'warning' | 'success' | 'neutral';
}

// ─── Design system badge ──────────────────────────────────────────────────────

interface BadgeSpec {
  bg: string;
  color: string;
  weight: number;
}

const BADGE_SPECS: Record<string, BadgeSpec> = {
  // Red critical (400 stop + white, weight 600)
  HARD_LEGAL:   { bg: 'var(--color-ramp-red-400)', color: '#FFFFFF', weight: 600 },
  CRITICAL:     { bg: 'var(--color-ramp-red-400)', color: '#FFFFFF', weight: 600 },
  BLOCK:        { bg: 'var(--color-ramp-red-400)', color: '#FFFFFF', weight: 600 },
  // Amber warning (200 stop)
  HARD_CONTRACTUAL: { bg: 'var(--color-ramp-amber-200)', color: 'var(--color-ramp-amber-900)', weight: 500 },
  WARN:         { bg: 'var(--color-ramp-amber-200)', color: 'var(--color-ramp-amber-900)', weight: 500 },
  ELEVATED:     { bg: 'var(--color-ramp-amber-200)', color: 'var(--color-ramp-amber-900)', weight: 500 },
  SILENCE:      { bg: 'var(--color-ramp-amber-200)', color: 'var(--color-ramp-amber-900)', weight: 500 },
  // Blue pending (200 stop)
  SOFT_INTERNAL: { bg: 'var(--color-ramp-blue-200)', color: 'var(--color-ramp-blue-900)', weight: 500 },
  PENDING:      { bg: 'var(--color-ramp-blue-200)', color: 'var(--color-ramp-blue-900)', weight: 500 },
  // Teal approved (200 stop)
  APPROVED:     { bg: 'var(--color-ramp-teal-200)', color: 'var(--color-ramp-teal-900)', weight: 500 },
  CONFIRMED:    { bg: 'var(--color-ramp-teal-200)', color: 'var(--color-ramp-teal-900)', weight: 500 },
  // Gray neutral (200 stop)
  ADMINISTRATIVE: { bg: 'var(--color-ramp-gray-200)', color: 'var(--color-ramp-gray-900)', weight: 500 },
  ROUTINE:      { bg: 'var(--color-ramp-gray-200)', color: 'var(--color-ramp-gray-900)', weight: 500 },
};

function Badge({ level }: { level: string }) {
  const spec = BADGE_SPECS[level] ?? { bg: 'var(--color-ramp-gray-200)', color: 'var(--color-ramp-gray-900)', weight: 500 };
  return (
    <span style={{
      display: 'inline-block',
      background: spec.bg,
      color: spec.color,
      padding: '3px 8px',
      borderRadius: 'var(--border-radius-md)',
      fontSize: 11,
      fontWeight: spec.weight,
      lineHeight: 1.4,
      flexShrink: 0,
    }}>
      {level}
    </span>
  );
}

// ─── Left accent border by severity ──────────────────────────────────────────

function accentBorder(severity: 'critical' | 'warning' | 'info' | 'neutral'): CSSProperties {
  const map = {
    critical: { borderLeft: '4px solid var(--color-border-danger)' },
    warning:  { borderLeft: '3px solid var(--color-border-warning)' },
    info:     { borderLeft: '3px solid var(--color-border-info)' },
    neutral:  { borderLeft: '3px solid var(--color-ramp-gray-200)' },
  };
  return map[severity];
}

// ─── Shared button component ──────────────────────────────────────────────────

function ActionBtn({
  label, onClick, variant = 'secondary',
}: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles: Record<string, CSSProperties> = {
    primary: {
      background: 'var(--color-action-primary)',
      color: 'var(--color-action-primary-text)',
      border: 'none',
      padding: '6px 12px',
      borderRadius: 'var(--border-radius-md)',
      fontSize: 13,
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'background 0.15s',
    },
    secondary: {
      background: 'transparent',
      color: 'var(--color-text-primary)',
      border: '0.5px solid var(--color-border-secondary)',
      padding: '6px 12px',
      borderRadius: 'var(--border-radius-md)',
      fontSize: 13,
      fontWeight: 400,
      cursor: 'pointer',
      transition: 'background 0.15s',
    },
    danger: {
      background: 'transparent',
      color: 'var(--color-text-danger)',
      border: '0.5px solid var(--color-border-danger)',
      padding: '6px 12px',
      borderRadius: 'var(--border-radius-md)',
      fontSize: 13,
      fontWeight: 400,
      cursor: 'pointer',
      transition: 'background 0.15s',
    },
  };
  return <button onClick={onClick} style={styles[variant]}>{label}</button>;
}

// ─── Section card container ───────────────────────────────────────────────────

function SectionCard({ title, count, critical, empty, children }: {
  title: string;
  count: number;
  critical?: boolean;
  empty: string;
  children?: ReactNode;
}) {
  const countBadge: CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
    background: critical ? 'var(--color-ramp-red-400)' : 'var(--color-background-secondary)',
    color: critical ? '#FFFFFF' : 'var(--color-text-secondary)',
  };

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '0.5px solid var(--color-border-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>{title}</h2>
        {count > 0
          ? <span style={countBadge}>{count}</span>
          : <span style={{ ...countBadge, background: 'var(--color-background-success)', color: 'var(--color-text-success)' }}>Clear</span>
        }
      </div>
      {count === 0
        ? <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-tertiary)' }}>{empty}</div>
        : <div>{children}</div>
      }
    </div>
  );
}

// ─── Metadata row helper ──────────────────────────────────────────────────────

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
      <span>{label}:</span>{' '}
      <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{value}</span>
    </span>
  );
}

function Divider() {
  return <div style={{ height: '0.5px', background: 'var(--color-border-tertiary)', margin: '10px 0' }} />;
}

function TriageMetric({ label, value, tone = 'neutral', detail }: {
  label: string;
  value: string;
  tone?: 'critical' | 'warning' | 'success' | 'neutral';
  detail?: string;
}) {
  const toneStyle: Record<string, CSSProperties> = {
    critical: { color: 'var(--color-text-danger)', background: 'var(--color-background-danger)', borderColor: 'var(--color-border-danger)' },
    warning: { color: 'var(--color-text-warning)', background: 'var(--color-background-warning)', borderColor: 'var(--color-border-warning)' },
    success: { color: 'var(--color-text-success)', background: 'var(--color-background-success)', borderColor: 'var(--color-border-success)' },
    neutral: { color: 'var(--color-text-primary)', background: 'var(--color-background-primary)', borderColor: 'var(--color-border-tertiary)' },
  };
  const style = toneStyle[tone];
  return (
    <div style={{
      background: style.background,
      border: `0.5px solid ${style.borderColor}`,
      borderRadius: 'var(--border-radius-lg)',
      padding: '14px 16px',
      minHeight: 82,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{label}</span>
      <strong style={{ fontSize: 24, fontWeight: 500, color: style.color, lineHeight: 1 }}>{value}</strong>
      {detail && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{detail}</span>}
    </div>
  );
}

function CommandSummary({ criticalCount, decisionCount, totalWip }: {
  criticalCount: number;
  decisionCount: number;
  totalWip: number;
}) {
  const summary = criticalCount > 0
    ? `${criticalCount} critical ${criticalCount === 1 ? 'item requires' : 'items require'} attorney judgment before closeout.`
    : 'No critical items are currently blocking closeout.';

  return (
    <section style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding: 18,
      display: 'grid',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          Operational closeout
        </h2>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text-success)', background: 'var(--color-background-success)', padding: '4px 8px', borderRadius: 'var(--border-radius-md)' }}>
          audit-ready
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
        {summary} Litt has assembled {decisionCount} attorney decision{decisionCount === 1 ? '' : 's'} across deadlines, billing, budgets, communications, and anomalies.
      </p>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--color-text-tertiary)' }}>
        Confirm, approve, dismiss, or write down items from this brief. Each consequential action writes an audit event with actor, entity, timestamp, and before/after state.
      </p>
      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
        closeout.wip_usd={totalWip.toLocaleString()} / route=deterministic / ai=brief_narrative_only
      </div>
    </section>
  );
}

// ─── Section: Deadlines ───────────────────────────────────────────────────────

function storyToneStyle(tone: StoryStep['tone']): CSSProperties {
  const styles: Record<StoryStep['tone'], CSSProperties> = {
    critical: { color: 'var(--color-text-danger)', background: 'var(--color-background-danger)', borderColor: 'var(--color-border-danger)' },
    warning: { color: 'var(--color-text-warning)', background: 'var(--color-background-warning)', borderColor: 'var(--color-border-warning)' },
    success: { color: 'var(--color-text-success)', background: 'var(--color-background-success)', borderColor: 'var(--color-border-success)' },
    neutral: { color: 'var(--color-text-info)', background: 'var(--color-background-info)', borderColor: 'var(--color-border-info)' },
  };
  return styles[tone];
}

function ProductStoryPanel({ criticalCount, decisionCount, resolvedItems, totalWip, blockCount, silenceCount, budgetCount }: {
  criticalCount: number;
  decisionCount: number;
  resolvedItems: ResolvedItem[];
  totalWip: number;
  blockCount: number;
  silenceCount: number;
  budgetCount: number;
}) {
  const latestAuditId = resolvedItems[resolvedItems.length - 1]?.auditEventId;
  const steps: StoryStep[] = [
    {
      label: '01',
      headline: 'Find risk',
      detail: 'Litt watches deadlines, billing blocks, budget pressure, client silence, and anomalies across the firm.',
      proof: `${criticalCount} critical / ${blockCount} billing block${blockCount === 1 ? '' : 's'} / $${totalWip.toLocaleString()} WIP`,
      tone: criticalCount > 0 ? 'critical' : 'success',
    },
    {
      label: '02',
      headline: 'Ask for judgment',
      detail: 'The dashboard turns operational noise into attorney decision packets with the exact action needed.',
      proof: `${decisionCount} decision${decisionCount === 1 ? '' : 's'} pending across ${budgetCount + silenceCount > 0 ? 'risk and comms' : 'active sections'}`,
      tone: decisionCount > 0 ? 'warning' : 'success',
    },
    {
      label: '03',
      headline: 'Record decision',
      detail: 'Confirming, approving, writing down, or dismissing runs through Litt tools with expected-state checks.',
      proof: `${resolvedItems.length} audit event${resolvedItems.length === 1 ? '' : 's'} logged this session`,
      tone: resolvedItems.length > 0 ? 'success' : 'neutral',
    },
    {
      label: '04',
      headline: 'Prove what happened',
      detail: 'Every consequential action produces a receipt: actor, entity, timestamp, state change, and audit ID.',
      proof: latestAuditId ? `latest=${latestAuditId.slice(0, 10)}` : 'ready for first attorney action',
      tone: latestAuditId ? 'success' : 'neutral',
    },
  ];

  return (
    <section style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-xl)',
      padding: 18,
      marginBottom: 16,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text-info)', marginBottom: 7 }}>
            PRODUCT STORY / WHY LITT MATTERS
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: 0 }}>
            Find risk. Get attorney judgment. Write proof.
          </h2>
        </div>
        <p style={{ margin: 0, maxWidth: 360, fontSize: 13, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
          Litt is not a chatbot. It is an operational control layer that closes the loop between firm signals, human decisions, and defensible records.
        </p>
      </div>

      <div className="product-story-grid" style={{ display: 'grid', gap: 10 }}>
        {steps.map((step) => {
          const tone = storyToneStyle(step.tone);
          return (
            <div
              key={step.label}
              style={{
                border: `0.5px solid ${tone.borderColor}`,
                background: tone.background,
                borderRadius: 'var(--border-radius-lg)',
                padding: 14,
                minHeight: 172,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: tone.color }}>{step.label}</span>
                <span style={{ width: 8, height: 8, borderRadius: 8, background: tone.color, flexShrink: 0 }} />
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>{step.headline}</h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--color-text-secondary)', flex: 1 }}>{step.detail}</p>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: tone.color, lineHeight: 1.4 }}>
                {step.proof}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CloseoutTimeline({ deadlines, entries, budgets, silence, anomalies, resolvedItems }: {
  deadlines: number;
  entries: number;
  budgets: number;
  silence: number;
  anomalies: number;
  resolvedItems: ResolvedItem[];
}) {
  const stages: Array<{ label: string; detail: string; tone: StoryStep['tone'] }> = [
    { label: 'Detect deadlines', detail: `${deadlines} deadline${deadlines === 1 ? '' : 's'} routed`, tone: deadlines > 0 ? 'critical' : 'success' },
    { label: 'Scrub billing', detail: `${entries} WIP entr${entries === 1 ? 'y' : 'ies'} checked`, tone: entries > 0 ? 'warning' : 'success' },
    { label: 'Watch budgets', detail: `${budgets} budget risk${budgets === 1 ? '' : 's'}`, tone: budgets > 0 ? 'warning' : 'success' },
    { label: 'Monitor silence', detail: `${silence} client trigger${silence === 1 ? '' : 's'}`, tone: silence > 0 ? 'warning' : 'success' },
    { label: 'Review anomalies', detail: `${anomalies} escalation${anomalies === 1 ? '' : 's'}`, tone: anomalies > 0 ? 'critical' : 'success' },
    { label: 'Append audit log', detail: `${resolvedItems.length} session event${resolvedItems.length === 1 ? '' : 's'}`, tone: resolvedItems.length > 0 ? 'success' : 'neutral' },
  ];

  return (
    <section style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding: 16,
    }}>
      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text-info)', marginBottom: 12 }}>
        CLOSEOUT BRIEF TIMELINE
      </div>
      <div style={{ display: 'grid' }}>
        {stages.map((stage, index) => {
          const tone = storyToneStyle(stage.tone);
          const isLast = index === stages.length - 1;
          return (
            <div key={stage.label} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ width: 9, height: 9, borderRadius: 9, background: tone.color, marginTop: 4 }} />
                {!isLast && <span style={{ width: 1, minHeight: 34, background: 'var(--color-border-tertiary)', flex: 1 }} />}
              </div>
              <div style={{ paddingBottom: isLast ? 0 : 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.35 }}>{stage.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{stage.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DeadlinesSection({ items, resolved, onModal }: {
  items: BriefDeadlineItem[];
  resolved: Set<string>;
  onModal: (m: OpenModal) => void;
}) {
  const visible = items.filter(i => !resolved.has(i.deadline_id));
  const hasCritical = visible.some(i => i.classification === 'HARD_LEGAL');

  return (
    <SectionCard title="Deadlines" count={visible.length} critical={hasCritical} empty="No pending deadlines">
      {visible.map((item, idx) => {
        const isHardLegal = item.classification === 'HARD_LEGAL';
        const accent = isHardLegal ? accentBorder('critical')
          : item.classification === 'HARD_CONTRACTUAL' ? accentBorder('warning')
          : accentBorder('info');
        const isLast = idx === visible.length - 1;

        return (
          <div
            key={item.deadline_id}
            style={{
              ...accent,
              padding: '14px 16px',
              borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-tertiary)',
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Badge level={item.classification} />
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>{item.deadline_id}</span>
                {item.is_unconfirmed && (
                  <span style={{ fontSize: 12, color: 'var(--color-border-warning)', fontWeight: 500 }}>Attorney confirmation required</span>
                )}
              </div>
              {/* Days countdown — large + red for critical */}
              <span style={{
                fontSize: isHardLegal ? 24 : 18,
                fontWeight: 500,
                color: item.days_out <= 3 ? 'var(--color-border-danger)' : item.days_out <= 7 ? 'var(--color-border-warning)' : 'var(--color-text-secondary)',
                flexShrink: 0,
                marginLeft: 12,
              }}>
                {item.days_out}d
              </span>
            </div>
            {/* Description */}
            <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
              {item.description}
            </p>
            {isHardLegal && (
              <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--color-text-danger)', lineHeight: 1.4 }}>
                Hard legal deadline. Confirmation will be written to the audit trail.
              </p>
            )}
            <Divider />
            {/* Metadata */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
              <Meta label="Due" value={item.due_date} />
              <Meta label="Matter" value={item.matter_name} />
              <Meta label="Client" value={item.client_name} />
            </div>
            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <ActionBtn variant="primary" label="Confirm deadline" onClick={() => onModal({ type: 'deadline', item, action: 'confirm' })} />
              <ActionBtn label="Extend" onClick={() => onModal({ type: 'deadline', item, action: 'extend' })} />
              <ActionBtn variant="danger" label="Dismiss" onClick={() => onModal({ type: 'deadline', item, action: 'dismiss' })} />
            </div>
          </div>
        );
      })}
    </SectionCard>
  );
}

// ─── Section: WIP Entries ─────────────────────────────────────────────────────

function WIPSection({ items, resolved, onModal }: {
  items: BriefTimeEntryItem[];
  resolved: Set<string>;
  onModal: (m: OpenModal) => void;
}) {
  const visible = items.filter(i => !resolved.has(i.entry_id));

  return (
    <SectionCard title="Work in progress" count={visible.length} critical={visible.some(i => i.has_block)} empty="No pending WIP entries">
      {visible.map((item, idx) => {
        const accent = item.has_block ? accentBorder('critical')
          : item.has_warn ? accentBorder('warning')
          : accentBorder('info');
        const isLast = idx === visible.length - 1;
        const statusLevel = item.has_block ? 'BLOCK' : item.has_warn ? 'WARN' : 'PENDING';

        return (
          <div
            key={item.entry_id}
            style={{
              ...accent,
              padding: '14px 16px',
              borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-tertiary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Badge level={statusLevel} />
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>{item.entry_id}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{item.status}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', flexShrink: 0, marginLeft: 12 }}>
                ${item.amount.toFixed(2)}
              </span>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 14, color: item.narrative ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', lineHeight: 1.4, fontStyle: item.narrative ? 'normal' : 'italic' }}>
              {item.narrative ?? 'No narrative — add one before approving'}
            </p>
            {item.scrubber_flags.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                {item.scrubber_flags.slice(0, 2).map((f, i) => (
                  <div key={i} style={{ fontSize: 12, color: f.severity === 'BLOCK' ? 'var(--color-border-danger)' : 'var(--color-border-warning)', marginBottom: 2 }}>
                    {f.severity}: {f.message}{f.matched_text ? ` ("${f.matched_text}")` : ''}
                  </div>
                ))}
              </div>
            )}
            <Divider />
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
              <Meta label="Hours" value={`${item.hours}h`} />
              <Meta label="Matter" value={item.matter_name} />
              <Meta label="Date" value={item.entry_date} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <ActionBtn variant="primary" label="Approve" onClick={() => onModal({ type: 'billing', item, action: 'approve' })} />
              <ActionBtn label="Write down" onClick={() => onModal({ type: 'billing', item, action: 'write-down' })} />
              <ActionBtn variant="danger" label="Write off" onClick={() => onModal({ type: 'billing', item, action: 'write-off' })} />
              {!item.narrative && (
                <ActionBtn label="Add narrative" onClick={() => onModal({ type: 'billing', item, action: 'narrative' })} />
              )}
            </div>
          </div>
        );
      })}
    </SectionCard>
  );
}

// ─── Section: Budget risks ────────────────────────────────────────────────────

function BudgetSection({ items, resolved, onModal }: {
  items: BriefBudgetItem[];
  resolved: Set<string>;
  onModal: (m: OpenModal) => void;
}) {
  const visible = items.filter(i => !resolved.has(i.client_id));

  return (
    <SectionCard title="Budget risks" count={visible.length} critical={visible.some(i => i.alert_status === 'CRITICAL')} empty="No budget risks">
      {visible.map((item, idx) => {
        const accent = item.alert_status === 'CRITICAL' ? accentBorder('critical') : accentBorder('warning');
        const isLast = idx === visible.length - 1;
        const pctDisplay = item.utilization_pct.toFixed(0);
        const barColor = item.alert_status === 'CRITICAL' ? 'var(--color-border-danger)' : 'var(--color-border-warning)';

        return (
          <div
            key={item.client_id}
            style={{
              ...accent,
              padding: '14px 16px',
              borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-tertiary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge level={item.alert_status} />
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>{item.client_id}</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 500, color: barColor, flexShrink: 0, marginLeft: 12 }}>
                {pctDisplay}%
              </span>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.client_name}</p>
            {/* Progress bar */}
            <div style={{ height: 5, background: 'var(--color-background-secondary)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${Math.min(item.utilization_pct, 100)}%`, background: barColor, borderRadius: 3 }} />
            </div>
            <Divider />
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
              <Meta label="Committed" value={`$${item.total_committed.toLocaleString()}`} />
              <Meta label="Cap" value={`$${item.budget_cap.toLocaleString()}`} />
              <Meta label="Unbilled" value={`$${item.approved_unbilled.toLocaleString()}`} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <ActionBtn variant="primary" label="View details" onClick={() => onModal({ type: 'budget', item })} />
            </div>
          </div>
        );
      })}
    </SectionCard>
  );
}

// ─── Section: Client silence ──────────────────────────────────────────────────

function SilenceSection({ items, resolved, onModal }: {
  items: BriefClientSilenceItem[];
  resolved: Set<string>;
  onModal: (m: OpenModal) => void;
}) {
  const visible = items.filter(i => !resolved.has(i.matter_id));

  return (
    <SectionCard title="Client silence" count={visible.length} empty="No silence triggers">
      {visible.map((item, idx) => {
        const isLast = idx === visible.length - 1;
        return (
          <div
            key={item.matter_id}
            style={{
              ...accentBorder('warning'),
              padding: '14px 16px',
              borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-tertiary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge level="SILENCE" />
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>{item.matter_id}</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-border-warning)', flexShrink: 0, marginLeft: 12 }}>
                {item.days_since_contact}d
              </span>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.matter_name}</p>
            <Divider />
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
              <Meta label="Client" value={item.client_name} />
              <Meta label="Threshold" value={`${item.threshold_days} days`} />
              {item.last_contact_date && <Meta label="Last contact" value={item.last_contact_date} />}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <ActionBtn
                variant={item.comm_draft_id ? 'primary' : 'secondary'}
                label={item.comm_draft_id ? 'Review draft' : 'View'}
                onClick={() => onModal({ type: 'comms', item })}
              />
            </div>
          </div>
        );
      })}
    </SectionCard>
  );
}

// ─── Section: Anomalies ───────────────────────────────────────────────────────

function AnomaliesSection({ items, resolved, onModal }: {
  items: BriefAnomalyItem[];
  resolved: Set<string>;
  onModal: (m: OpenModal) => void;
}) {
  const visible = items.filter(i => !resolved.has(i.escalation_id));

  return (
    <SectionCard title="Anomalies" count={visible.length} critical={visible.some(i => i.risk_level === 'CRITICAL')} empty="No anomalies detected">
      {visible.map((item, idx) => {
        const accent = item.risk_level === 'CRITICAL' ? accentBorder('critical')
          : item.risk_level === 'ELEVATED' ? accentBorder('warning')
          : accentBorder('neutral');
        const isLast = idx === visible.length - 1;

        return (
          <div
            key={item.escalation_id}
            style={{
              ...accent,
              padding: '14px 16px',
              borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-tertiary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge level={item.risk_level} />
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>{item.entity_id}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>P{item.priority}/5</span>
              </div>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
              {item.what_is_happening}
            </p>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
              {item.why_it_matters}
            </p>
            <Divider />
            <div style={{ marginBottom: 10 }}>
              <Meta label="Decision needed" value={item.what_attorney_must_decide} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <ActionBtn variant="primary" label="Review" onClick={() => onModal({ type: 'anomaly', item })} />
            </div>
          </div>
        );
      })}
    </SectionCard>
  );
}

// ─── Resolved tray ────────────────────────────────────────────────────────────

function ResolvedTray({ items }: { items: ResolvedItem[] }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          textAlign: 'left',
        }}
      >
        <span>
          <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Session audit log</span>
          <span style={{ marginLeft: 8, color: 'var(--color-text-tertiary)' }}>
            {items.length} event{items.length === 1 ? '' : 's'}
          </span>
        </span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
          audit trail {expanded ? '▲' : '▾'}
        </span>
      </button>
      {expanded && (
        <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
          {items.length === 0 && (
            <p style={{ margin: 0, padding: '12px 16px', fontSize: 12, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
              No decisions logged yet. Confirm or approve an item to append the first audit event.
            </p>
          )}
          {items.map((r, i) => (
            <div
              key={i}
              style={{
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: i < items.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span style={{ color: 'var(--color-text-primary)' }}>{r.entityType} / {r.entityId}</span>
              <span style={{ color: 'var(--color-ramp-teal-400)', marginLeft: 16 }}>{r.auditEventId.slice(0, 8)}…</span>
              <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 'auto', paddingLeft: 16 }}>{r.resolvedAt.slice(11, 19)} UTC</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DailyCloseoutBrief() {
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<OpenModal | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [resolvedItems, setResolvedItems] = useState<ResolvedItem[]>([]);
  const [auditDrawer, setAuditDrawer] = useState<ToolResult | null>(null);

  async function load() {
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
    try {
      await runSweep(FIRM_ID);
      await load();
    } catch { /* non-fatal */ } finally {
      setSweeping(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const handleSuccess = useCallback((result: ToolResult, sectionId: string) => {
    setResolved(prev => new Set([...prev, sectionId]));
    setResolvedItems(prev => [...prev, {
      sectionId,
      entityId: result.entity_id,
      entityType: result.entity_type,
      auditEventId: result.audit_event_id,
      resolvedAt: new Date().toISOString(),
    }]);
    setAuditDrawer(result);
    setModal(null);
  }, []);

  const closeModal = useCallback(() => setModal(null), []);
  const closeDrawer = useCallback(() => setAuditDrawer(null), []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-background-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--color-text-tertiary)' }}>Loading brief…</p>
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-background-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--color-text-danger)', marginBottom: 12 }}>{error ?? 'Brief unavailable'}</p>
          <button onClick={load} style={{ fontSize: 13, color: 'var(--color-text-info)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
        </div>
      </div>
    );
  }

  const s = brief.sections;
  const visibleDeadlines = s.deadlines.items.filter(i => !resolved.has(i.deadline_id));
  const visibleEntries = s.time_entries.items.filter(i => !resolved.has(i.entry_id));
  const visibleBudgets = s.budget_risks.items.filter(i => !resolved.has(i.client_id));
  const visibleSilence = s.client_silence.items.filter(i => !resolved.has(i.matter_id));
  const visibleAnomalies = s.anomalies.items.filter(i => !resolved.has(i.escalation_id));
  const criticalCount = visibleDeadlines.filter(i => i.classification === 'HARD_LEGAL' && i.days_out <= 7).length
    + visibleEntries.filter(i => i.has_block).length
    + visibleBudgets.filter(i => i.alert_status === 'CRITICAL').length
    + visibleAnomalies.filter(i => i.risk_level === 'CRITICAL').length;
  const decisionCount = visibleDeadlines.length + visibleEntries.length + visibleBudgets.length + visibleSilence.length + visibleAnomalies.length;
  const blockCount = visibleEntries.filter(i => i.has_block).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background-tertiary)' }}>
      <DemoBanner firmName={brief.firm_name} demoDate={brief.generated_at.slice(0, 10)} />

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 20px 40px' }}>
        {/* Page header */}
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
              LITT / OPERATIONS CONTROL
            </div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: 0 }}>Daily closeout brief</h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--color-text-secondary)' }}>
              {brief.firm_name} / {brief.attorney_name} / generated {brief.generated_at.slice(11, 16)} UTC
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <DemoResetButton firmId={FIRM_ID} onReset={load} />
            <a
              href="/email-preview"
              target="_blank"
              style={{ fontSize: 13, color: 'var(--color-text-secondary)', textDecoration: 'none', border: '0.5px solid var(--color-border-secondary)', padding: '6px 12px', borderRadius: 'var(--border-radius-md)' }}
            >
              Email preview
            </a>
            <button
              onClick={handleSweep}
              disabled={sweeping}
              style={{
                fontSize: 13,
                fontWeight: 500,
                background: 'var(--color-action-primary)',
                color: 'var(--color-action-primary-text)',
                border: 'none',
                padding: '7px 14px',
                borderRadius: 'var(--border-radius-md)',
                cursor: sweeping ? 'not-allowed' : 'pointer',
                opacity: sweeping ? 0.6 : 1,
              }}
            >
              {sweeping ? 'Refreshing...' : 'Refresh brief'}
            </button>
          </div>
        </div>

        <ProductStoryPanel
          criticalCount={criticalCount}
          decisionCount={decisionCount}
          resolvedItems={resolvedItems}
          totalWip={s.time_entries.total_wip_usd}
          blockCount={blockCount}
          silenceCount={visibleSilence.length}
          budgetCount={visibleBudgets.length}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
          <TriageMetric label={criticalCount === 1 ? 'Critical risk' : 'Critical risks'} value={String(criticalCount)} tone={criticalCount > 0 ? 'critical' : 'success'} detail="requires judgment" />
          <TriageMetric label="Billing blocks" value={String(blockCount)} tone={blockCount > 0 ? 'critical' : 'success'} detail="approval blockers" />
          <TriageMetric label="WIP exposure" value={`$${s.time_entries.total_wip_usd.toLocaleString()}`} tone={s.time_entries.total_wip_usd > 0 ? 'warning' : 'neutral'} detail="pending approval" />
          <TriageMetric label="Client silence" value={String(visibleSilence.length)} tone={visibleSilence.length > 0 ? 'warning' : 'success'} detail="outreach triggers" />
          <TriageMetric label="Audit posture" value="Ready" tone="success" detail={`${resolvedItems.length} logged this session`} />
        </div>

        <div className="closeout-layout" style={{ display: 'grid', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <CommandSummary criticalCount={criticalCount} decisionCount={decisionCount} totalWip={s.time_entries.total_wip_usd} />
            <DeadlinesSection items={s.deadlines.items} resolved={resolved} onModal={setModal} />
            <WIPSection items={s.time_entries.items} resolved={resolved} onModal={setModal} />
            <BudgetSection items={s.budget_risks.items} resolved={resolved} onModal={setModal} />
            <SilenceSection items={s.client_silence.items} resolved={resolved} onModal={setModal} />
            <AnomaliesSection items={s.anomalies.items} resolved={resolved} onModal={setModal} />
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 48 }}>
            <CloseoutTimeline
              deadlines={visibleDeadlines.length}
              entries={visibleEntries.length}
              budgets={visibleBudgets.length}
              silence={visibleSilence.length}
              anomalies={visibleAnomalies.length}
              resolvedItems={resolvedItems}
            />
            <div style={{
              background: 'var(--color-audit-surface)',
              color: '#E8E6DC',
              borderRadius: 'var(--border-radius-lg)',
              padding: 16,
              border: '0.5px solid rgba(255,255,255,0.14)',
            }}>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-audit-success)', marginBottom: 10 }}>
                DEFENSIBLE AUDIT TRAIL
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.5, color: '#D3D1C7' }}>
                Every write path runs through Litt tools, validates expected state, and logs the resulting audit event.
              </p>
              <div style={{ display: 'grid', gap: 8, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                <span>tool_layer=only_write_path</span>
                <span>routing=python_deterministic</span>
                <span>firm_id={brief.firm_id}</span>
              </div>
            </div>
            <ResolvedTray items={resolvedItems} />
          </aside>
        </div>

        <p style={{ marginTop: 16, textAlign: 'right', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          Total WIP: ${s.time_entries.total_wip_usd.toLocaleString()} / Generated {brief.generated_at.slice(0, 19).replace('T', ' ')} UTC
        </p>
      </div>

      {/* Modals */}
      {modal?.type === 'deadline' && (
        <DeadlineModal item={modal.item} action={modal.action} firmId={FIRM_ID} attorneyId={ATTORNEY_ID} onClose={closeModal} onSuccess={handleSuccess} />
      )}
      {modal?.type === 'billing' && (
        <BillingWIPModal item={modal.item} action={modal.action} firmId={FIRM_ID} attorneyId={ATTORNEY_ID} onClose={closeModal} onSuccess={handleSuccess} />
      )}
      {modal?.type === 'comms' && (
        <ClientCommsModal item={modal.item} firmId={FIRM_ID} attorneyId={ATTORNEY_ID} onClose={closeModal} onSuccess={handleSuccess} />
      )}
      {modal?.type === 'budget' && (
        <BudgetModal item={modal.item} onClose={closeModal} />
      )}
      {modal?.type === 'anomaly' && (
        <AnomalyModal item={modal.item} firmId={FIRM_ID} attorneyId={ATTORNEY_ID} onClose={closeModal} onSuccess={handleSuccess} />
      )}

      <AuditEventDrawer result={auditDrawer} onClose={closeDrawer} />
    </div>
  );
}
