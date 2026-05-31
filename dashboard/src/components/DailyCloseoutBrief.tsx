import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
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

// ---------------------------------------------------------------------------
// Modal state union
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Shared UI atoms
// ---------------------------------------------------------------------------

const severityClass: Record<string, string> = {
  HARD_LEGAL: 'bg-red-600 text-white',
  HARD_CONTRACTUAL: 'bg-orange-600 text-white',
  SOFT_INTERNAL: 'bg-blue-500 text-white',
  ADMINISTRATIVE: 'bg-gray-500 text-white',
  CRITICAL: 'bg-red-600 text-white',
  ELEVATED: 'bg-orange-500 text-white',
  ROUTINE: 'bg-gray-400 text-white',
  WARN: 'bg-amber-500 text-white',
  BLOCK: 'bg-red-600 text-white',
  SILENCE: 'bg-purple-600 text-white',
};

function Badge({ level }: { level: string }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${severityClass[level] ?? 'bg-gray-400 text-white'}`}>
      {level}
    </span>
  );
}

function Btn({ label, onClick, variant = 'default' }: { label: string; onClick: () => void; variant?: 'default' | 'primary' | 'danger' }) {
  const cls = {
    default: 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200',
    primary: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200',
    danger: 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200',
  }[variant];
  return (
    <button onClick={onClick} className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${cls}`}>
      {label}
    </button>
  );
}

function SectionCard({ title, count, critical, empty, children }: {
  title: string;
  count: number;
  critical?: boolean;
  empty: string;
  children?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
        {count > 0
          ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${critical ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{count}</span>
          : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Clear</span>
        }
      </div>
      {count === 0
        ? <div className="px-4 py-5 text-sm text-gray-400 text-center">{empty}</div>
        : <div className="divide-y divide-gray-100">{children}</div>
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Deadlines
// ---------------------------------------------------------------------------

function DeadlinesSection({ items, resolved, onModal }: {
  items: BriefDeadlineItem[];
  resolved: Set<string>;
  onModal: (m: OpenModal) => void;
}) {
  const visible = items.filter(i => !resolved.has(i.deadline_id));
  return (
    <SectionCard title="Deadlines" count={visible.length} critical={visible.some(i => i.classification === 'HARD_LEGAL')} empty="No pending deadlines">
      {visible.map(item => (
        <div key={item.deadline_id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <Badge level={item.classification} />
            <span className="text-xs font-mono text-gray-500">{item.deadline_id}</span>
            <span className={`text-xs font-medium ${item.days_out <= 3 ? 'text-red-600' : item.days_out <= 7 ? 'text-orange-600' : 'text-gray-600'}`}>
              {item.days_out}d out
            </span>
            {item.is_unconfirmed && <span className="text-xs text-amber-600 font-medium">· Unconfirmed</span>}
          </div>
          <p className="text-sm text-gray-900 mb-1 leading-snug">{item.description}</p>
          <p className="text-xs text-gray-500 mb-2">Due {item.due_date} · {item.matter_name} · {item.client_name}</p>
          <div className="flex gap-1.5 flex-wrap">
            <Btn variant="primary" label="Confirm" onClick={() => onModal({ type: 'deadline', item, action: 'confirm' })} />
            <Btn label="Extend" onClick={() => onModal({ type: 'deadline', item, action: 'extend' })} />
            <Btn variant="danger" label="Dismiss" onClick={() => onModal({ type: 'deadline', item, action: 'dismiss' })} />
          </div>
        </div>
      ))}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section: WIP Entries
// ---------------------------------------------------------------------------

function WIPSection({ items, resolved, onModal }: {
  items: BriefTimeEntryItem[];
  resolved: Set<string>;
  onModal: (m: OpenModal) => void;
}) {
  const visible = items.filter(i => !resolved.has(i.entry_id));
  return (
    <SectionCard title="WIP Entries" count={visible.length} critical={visible.some(i => i.has_block)} empty="No pending WIP entries">
      {visible.map(item => (
        <div key={item.entry_id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {item.has_block && <Badge level="BLOCK" />}
            {item.has_warn && !item.has_block && <Badge level="WARN" />}
            <span className="text-xs font-mono text-gray-500">{item.entry_id}</span>
            <span className="text-xs text-gray-400">{item.status}</span>
          </div>
          <p className="text-sm text-gray-900 mb-1 leading-snug truncate">
            {item.narrative ?? <span className="italic text-gray-400">No narrative</span>}
          </p>
          <p className="text-xs text-gray-500 mb-2">
            {item.hours}h · ${item.amount.toFixed(2)} · {item.matter_name} · {item.entry_date}
          </p>
          <div className="flex gap-1.5 flex-wrap">
            <Btn variant="primary" label="Approve" onClick={() => onModal({ type: 'billing', item, action: 'approve' })} />
            <Btn label="Write Down" onClick={() => onModal({ type: 'billing', item, action: 'write-down' })} />
            <Btn variant="danger" label="Write Off" onClick={() => onModal({ type: 'billing', item, action: 'write-off' })} />
            {!item.narrative && <Btn label="Add Narrative" onClick={() => onModal({ type: 'billing', item, action: 'narrative' })} />}
          </div>
        </div>
      ))}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section: Budget Risks
// ---------------------------------------------------------------------------

function BudgetSection({ items, resolved, onModal }: {
  items: BriefBudgetItem[];
  resolved: Set<string>;
  onModal: (m: OpenModal) => void;
}) {
  const visible = items.filter(i => !resolved.has(i.client_id));
  return (
    <SectionCard title="Budget Risks" count={visible.length} critical={visible.some(i => i.alert_status === 'CRITICAL')} empty="No budget risks">
      {visible.map(item => (
        <div key={item.client_id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <Badge level={item.alert_status} />
            <span className="text-xs font-mono text-gray-500">{item.client_id}</span>
            <span className="text-xs font-medium text-gray-700">{(item.utilization_pct * 100).toFixed(0)}% used</span>
          </div>
          <p className="text-sm text-gray-900 mb-1">{item.client_name}</p>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full ${item.alert_status === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(item.utilization_pct * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mb-2">
            ${item.total_committed.toLocaleString()} committed · ${item.budget_cap.toLocaleString()} cap
          </p>
          <div className="flex gap-1.5">
            <Btn variant="primary" label="View Details" onClick={() => onModal({ type: 'budget', item })} />
          </div>
        </div>
      ))}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section: Client Silence
// ---------------------------------------------------------------------------

function SilenceSection({ items, resolved, onModal }: {
  items: BriefClientSilenceItem[];
  resolved: Set<string>;
  onModal: (m: OpenModal) => void;
}) {
  const visible = items.filter(i => !resolved.has(i.matter_id));
  return (
    <SectionCard title="Client Silence" count={visible.length} empty="No silence triggers">
      {visible.map(item => (
        <div key={item.matter_id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <Badge level="SILENCE" />
            <span className="text-xs font-mono text-gray-500">{item.matter_id}</span>
            <span className="text-xs font-medium text-orange-600">{item.days_since_contact}d</span>
          </div>
          <p className="text-sm text-gray-900 mb-1">{item.matter_name}</p>
          <p className="text-xs text-gray-500 mb-2">
            {item.client_name} · threshold: {item.threshold_days}d
            {item.last_contact_date && ` · last: ${item.last_contact_date}`}
          </p>
          <div className="flex gap-1.5">
            <Btn
              variant={item.comm_draft_id ? 'primary' : 'default'}
              label={item.comm_draft_id ? 'Review Draft' : 'View'}
              onClick={() => onModal({ type: 'comms', item })}
            />
          </div>
        </div>
      ))}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section: Anomalies
// ---------------------------------------------------------------------------

function AnomaliesSection({ items, resolved, onModal }: {
  items: BriefAnomalyItem[];
  resolved: Set<string>;
  onModal: (m: OpenModal) => void;
}) {
  const visible = items.filter(i => !resolved.has(i.escalation_id));
  return (
    <SectionCard title="Anomalies" count={visible.length} critical={visible.some(i => i.risk_level === 'CRITICAL')} empty="No anomalies detected">
      {visible.map(item => (
        <div key={item.escalation_id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <Badge level={item.risk_level} />
            <span className="text-xs font-mono text-gray-500">{item.entity_id}</span>
            <span className="text-xs text-gray-400">P{item.priority}/5</span>
          </div>
          <p className="text-sm text-gray-900 mb-1 leading-snug">{item.what_is_happening}</p>
          <p className="text-xs text-gray-500 mb-2 leading-snug">{item.why_it_matters}</p>
          <div className="flex gap-1.5">
            <Btn variant="primary" label="Review" onClick={() => onModal({ type: 'anomaly', item })} />
          </div>
        </div>
      ))}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Resolved tray
// ---------------------------------------------------------------------------

function ResolvedTray({ items }: { items: ResolvedItem[] }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <span className="text-sm font-medium text-gray-700">
          {items.length} item{items.length !== 1 ? 's' : ''} resolved this session
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <span className="font-mono">audit trail</span>
          <span>{expanded ? '▲' : '▾'}</span>
        </span>
      </button>
      {expanded && (
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {items.map((r, i) => (
            <div key={i} className="px-4 py-2.5 font-mono text-xs flex items-center gap-4">
              <span className="text-gray-900 truncate">{r.entityType} / {r.entityId}</span>
              <span className="text-green-600 shrink-0">{r.auditEventId.slice(0, 8)}…</span>
              <span className="text-gray-400 shrink-0 ml-auto">{r.resolvedAt.slice(11, 19)} UTC</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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
    } catch {
      // sweep errors non-fatal — brief may still be stale
    } finally {
      setSweeping(false);
    }
  }

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading brief…</p>
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-sm mb-3">{error ?? 'Brief unavailable'}</p>
          <button onClick={load} className="text-sm text-blue-600 underline">Retry</button>
        </div>
      </div>
    );
  }

  const s = brief.sections;

  return (
    <div className="min-h-screen bg-gray-50">
      <DemoBanner firmName={brief.firm_name} demoDate={brief.generated_at.slice(0, 10)} />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Daily Closeout Brief</h1>
            <p className="text-sm text-gray-500 mt-0.5">{brief.firm_name} · {brief.attorney_name}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <DemoResetButton firmId={FIRM_ID} onReset={load} />
            <a href="/email-preview" target="_blank" className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              Email Preview
            </a>
            <button
              onClick={handleSweep}
              disabled={sweeping}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {sweeping ? 'Sweeping…' : 'Run Sweep'}
            </button>
          </div>
        </div>

        {/* Section cards */}
        <div className="space-y-4">
          <DeadlinesSection items={s.deadlines.items} resolved={resolved} onModal={setModal} />
          <WIPSection items={s.time_entries.items} resolved={resolved} onModal={setModal} />
          <BudgetSection items={s.budget_risks.items} resolved={resolved} onModal={setModal} />
          <SilenceSection items={s.client_silence.items} resolved={resolved} onModal={setModal} />
          <AnomaliesSection items={s.anomalies.items} resolved={resolved} onModal={setModal} />
          <ResolvedTray items={resolvedItems} />
        </div>

        <div className="mt-4 text-right text-xs text-gray-400">
          Total WIP: ${s.time_entries.total_wip_usd.toLocaleString()} · Generated {brief.generated_at.slice(0, 19).replace('T', ' ')} UTC
        </div>
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
