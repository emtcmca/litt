import type {
  BriefAnomalyItem,
  BriefBudgetItem,
  BriefClientSilenceItem,
  BriefCompoundEscalationItem,
  BriefDeadlineItem,
  BriefTimeEntryItem,
} from '../../types';
import type { ActionDef, ItemDescriptor, ProofData } from './resolveTypes';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function emptyProof(override?: Partial<ProofData>): ProofData {
  return {
    what:   override?.what ?? '',
    did:    override?.did ?? '',
    source: override?.source ?? { tag: '', ref: '', line: '' },
    route:  override?.route ?? { agent: '', work: 'deterministic', llm: 'n/a', extra: '' },
    confidence: override?.confidence,
  };
}

// ---------------------------------------------------------------------------
// Deadline — CONFIRM / EXTEND (normal variant)
// ---------------------------------------------------------------------------

export function buildDeadlineDescriptor(
  item: BriefDeadlineItem,
  gate: string,
): ItemDescriptor {
  const confirm: ActionDef = {
    label: 'Confirm deadline',
    event: 'deadline.confirmed',
    tier:  'legal',
    need:  { type: 'none' },
  };
  const extend: ActionDef = {
    label: 'Extend / reassign',
    event: 'deadline.extended',
    tier:  'legal',
    need:  { type: 'date_reason', minLen: 4 },
  };

  const isEscalation = gate === 'ESCALATION';
  const daysLabel = item.days_out === 1 ? '1 day' : `${item.days_out} days`;

  return {
    id:          item.deadline_id,
    kind:        'deadline',
    gate,
    client_name: item.client_name,
    headline:    item.description,
    plain:       'Review the deadline details and confirm it\'s on your calendar, or extend.',
    stakes:      isEscalation
      ? `${item.classification} — ${daysLabel} out. This deadline has not been confirmed — if missed, consequences are immediate and irreversible.`
      : `${item.classification} — ${daysLabel} out. Confirm this deadline or extend if the date is changing.`,
    actions:  [confirm, extend],
    version: item.version,
    proof: emptyProof({
      what: `${item.matter_name} · escalation level ${item.escalation_level ?? 'none'}`,
      did:  `Raised escalation — ${daysLabel} out, unconfirmed`,
      source: {
        tag:  item.source_type ? item.source_type.replace(/_/g, ' ').toUpperCase() : 'RECORD',
        ref:  item.source_document_id ?? item.deadline_id,
        line: item.source_excerpt ?? '',
      },
      route: {
        agent: 'deadline_agent',
        work:  'deterministic',
        llm:   'n/a',
        extra: item.escalation_level ?? '',
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Deadline — VERIFY (conflict_flagged — Gemini-extracted candidate)
// ---------------------------------------------------------------------------

export function buildDeadlineVerifyDescriptor(item: BriefDeadlineItem): ItemDescriptor {
  const verify: ActionDef = {
    label: 'Verify deadline',
    event: 'deadline.verified',
    tier:  'legal',
    need:  { type: 'date_select' },
  };
  const notADeadline: ActionDef = {
    label:       'Not a deadline',
    event:       'deadline.dismissed',
    tier:        'operational',
    need:        { type: 'textarea', field: 'reason', minLen: 4 },
    destructive: true,
  };

  return {
    id:             item.deadline_id,
    kind:           'deadline',
    gate:           'ESCALATION',
    client_name:    item.client_name,
    headline:       'Verify this deadline before it\'s calendared',
    plain:          'Litt extracted this date from an email — confirm it\'s real before it goes on the book.',
    stakes:         'An unverified date is not yet protecting you — verify the date and class, or mark it not a deadline.',
    actions:        [verify, notADeadline],
    version:        item.version,
    extracted_date:  item.due_date,
    extracted_class: item.classification,
    proof: emptyProof({
      what: `${item.matter_name} · conflict flagged`,
      did:  'Extracted deadline from source email via Gemini',
      source: {
        tag:  item.source_type ? item.source_type.replace(/_/g, ' ').toUpperCase() : 'GMAIL · EMAIL',
        ref:  item.source_document_id ?? item.deadline_id,
        line: item.source_excerpt ?? '',
      },
      route: {
        agent: 'deadline_agent',
        work:  'llm_assisted',
        llm:   'Gemini 2.5 Pro',
        extra: 'extraction confidence in proof',
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Billing — APPROVE / WRITE-OFF / WRITE-DOWN
// ---------------------------------------------------------------------------

export function buildBillingDescriptor(item: BriefTimeEntryItem): ItemDescriptor {
  const gate = item.has_block ? 'ESCALATION' : 'REVIEW';

  const approve: ActionDef = {
    label: item.has_block ? 'Revise narrative & approve' : 'Add narrative & approve',
    event: 'billing.approved',
    tier:  'legal',
    need:  { type: 'textarea', field: 'narrative', minLen: 8 },
  };
  const writeOff: ActionDef = {
    label:       'Write off',
    event:       'billing.written_off',
    tier:        'legal',
    need:        { type: 'textarea', field: 'reason', minLen: 4 },
    destructive: true,
  };
  const writeDown: ActionDef = {
    label: 'Write down',
    event: 'billing.written_down',
    tier:  'legal',
    need:  { type: 'numeric_reason' },
  };

  const flags = item.scrubber_flags
    .filter(f => f.matched_text)
    .map(f => ({ matched_text: f.matched_text!, message: f.message }));

  const blockFlag = item.scrubber_flags.find(f => f.severity === 'BLOCK');
  const warnFlag  = item.scrubber_flags.find(f => f.severity === 'WARN');
  const flagSummary = blockFlag
    ? `Scrubber BLOCK: "${blockFlag.matched_text}" — ${blockFlag.message}`
    : warnFlag
    ? `Scrubber WARN: ${warnFlag.message}`
    : 'Entry requires narrative before approval';

  return {
    id:            item.entry_id,
    kind:          'billing',
    gate,
    client_name:   item.client_name,
    headline:      item.narrative
      ? 'Billing entry needs review'
      : 'Billing entry has no narrative',
    plain:         `${item.hours}h · $${item.amount.toLocaleString()} · ${item.matter_name}`,
    stakes:        item.has_block
      ? `BLOCK flag on this entry — ${flagSummary}. Cannot bill until resolved.`
      : item.has_warn
      ? `WARN flag: ${flagSummary}. Review before approving.`
      : 'Entry is pending narrative approval before it can be billed.',
    actions:       [approve, writeOff, writeDown],
    version:        item.version,
    current_hours:  item.hours,
    current_amount: item.amount,
    scrubber_flags: flags,
    proof: emptyProof({
      what: `${item.entry_date} · ${item.hours}h · $${item.amount} · ${item.matter_name}`,
      did:  'Ran pre-bill scrubber; surfaced for attorney review',
      source: {
        tag:  'BILLING',
        ref:  item.entry_id,
        line: item.narrative ?? 'no narrative',
      },
      route: {
        agent: 'billing_agent',
        work:  item.has_block ? 'llm_assisted' : 'deterministic',
        llm:   item.has_block ? 'Gemini 2.5 Pro' : 'n/a',
        extra: `${item.scrubber_flags.length} flag(s)`,
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Budget — ACKNOWLEDGE / REQUEST INCREASE
// ---------------------------------------------------------------------------

export function buildBudgetDescriptor(item: BriefBudgetItem): ItemDescriptor {
  const acknowledge: ActionDef = {
    label: 'Acknowledge & log review',
    event: 'budget.reviewed',
    tier:  'operational',
    need:  { type: 'none' },
  };
  const requestIncrease: ActionDef = {
    label: 'Request budget increase',
    event: 'budget.increase_requested',
    tier:  'operational',
    need:  { type: 'textarea', field: 'reason', minLen: 4 },
  };

  const pct = item.utilization_pct;
  const committed = item.total_committed.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const cap = item.budget_cap.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return {
    id:          `${item.client_id}-budget`,
    kind:        'budget',
    gate:        'REVIEW',
    client_name: item.client_name,
    headline:    `${item.client_name} is at ${pct}% of budget`,
    plain:       `${committed} committed of ${cap} cap — ${pct >= 90 ? 'approaching hard cap' : 'above warning threshold'}.`,
    stakes:      `${item.client_name} at ${pct}% — ${pct >= 90 ? `hard cap approaching, no further billing without increase` : `above the ${item.threshold_pct}% warning threshold. Client may need to be notified.`}.`,
    actions:     [acknowledge, requestIncrease],
    // Budget risks have no backing Escalation document — budget.reviewed / budget.increase_requested
    // are handled as local-only acknowledgements in the submit handler.
    // TODO v1.2: surface alert_id on BriefBudgetItem + persist via dismissAlert
    proof: emptyProof({
      what: `Budget cap ${cap} · billed ${item.budget_billed.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} · approved unbilled $${item.approved_unbilled.toLocaleString()}`,
      did:  `Computed utilization: ${pct}% — triggered ${item.alert_status} alert`,
      source: {
        tag:  'BILLING',
        ref:  item.client_id,
        line: `utilization_pct: ${pct}%`,
      },
      route: {
        agent: 'billing_agent',
        work:  'deterministic',
        llm:   'n/a',
        extra: item.alert_status,
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Client silence — APPROVE DRAFT / DISMISS
// ---------------------------------------------------------------------------

export function buildSilenceDescriptor(item: BriefClientSilenceItem): ItemDescriptor {
  // approveDraft only included when a draft exists — disabled/hidden when comm_draft_id is null
  const approveDraft: ActionDef = {
    label: 'Review & approve draft',
    event: 'comms.approved',
    tier:  'operational',
    need:  { type: 'none' },
  };
  const dismiss: ActionDef = {
    label:       'Dismiss',
    event:       'comms.dismissed',
    tier:        'operational',
    need:        { type: 'textarea', field: 'reason', minLen: 4 },
    destructive: true,
  };

  // draft_id = comm_draft_id — the actual value CommsApproveRequest.draft_id requires.
  // descriptor.id = composite key used for Brief.tsx find() lookup only.
  // If comm_draft_id is null: no draft exists; approveDraft action is excluded.
  const hasDraft = item.comm_draft_id != null;
  const actions: ActionDef[] = hasDraft ? [approveDraft, dismiss] : [dismiss];

  return {
    id:          `${item.matter_id}-silence`,
    kind:        'silence',
    gate:        'BLOCKED',
    client_name: item.client_name,
    headline:    `${item.days_since_contact} days without contact — ${item.client_name}`,
    plain:       `No client contact on ${item.matter_name} in ${item.days_since_contact} days (threshold: ${item.threshold_days}).`,
    stakes:      `${item.days_since_contact} days without contact on ${item.matter_name}. ${hasDraft ? 'Litt has drafted a check-in message.' : 'Silence threshold exceeded.'}`,
    actions,
    draft_id:    item.comm_draft_id,
    // TODO v1.2: fetch draft body via GET /api/comms/:id — no endpoint yet
    draft:       undefined,
    proof: emptyProof({
      what: `${item.matter_name} · last contact ${item.last_contact_date ?? 'unknown'}`,
      did:  `Flagged silence: ${item.days_since_contact}d since contact (threshold ${item.threshold_days}d)`,
      source: {
        tag:  'MATTER',
        ref:  item.matter_id,
        line: `last_contact_date: ${item.last_contact_date ?? 'none'}`,
      },
      route: {
        agent: 'comms_agent',
        work:  'deterministic',
        llm:   item.comm_draft_id ? 'Gemini 2.5 Pro' : 'n/a',
        extra: `${item.days_since_contact}d silent`,
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Anomaly — DISMISS WITH REASON
// ---------------------------------------------------------------------------

export function buildAnomalyDescriptor(item: BriefAnomalyItem): ItemDescriptor {
  const dismiss: ActionDef = {
    label: 'Dismiss with reason',
    event: 'anomaly.dismissed',
    tier:  'operational',
    need:  { type: 'textarea', field: 'reason', minLen: 4 },
  };

  return {
    id:          item.escalation_id,
    kind:        'anomaly',
    gate:        item.risk_level === 'CRITICAL' ? 'ESCALATION' : 'REVIEW',
    client_name: '',  // anomalies don't carry client_name on the brief item
    headline:    item.what_is_happening,
    plain:       item.what_attorney_must_decide,
    stakes:      item.why_it_matters,
    actions:     [dismiss],
    proof: emptyProof({
      what: `${item.entity_type} ${item.entity_id} · matter ${item.matter_id ?? 'unknown'}`,
      did:  item.what_litt_has_done,
      source: {
        tag:  item.entity_type.replace(/_/g, ' ').toUpperCase(),
        ref:  item.entity_id,
        line: item.risk_level,
      },
      route: {
        agent: 'anomaly_agent',
        work:  'deterministic',
        llm:   'n/a',
        extra: `risk_level: ${item.risk_level}`,
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Inbound — triage shape (E.3d)
// Takes messageId (string) — Brief.tsx passes BriefInboundItem.message_id.
// Full InboundMessage (with urgency_signals, action_items[].handoff_agent,
// suggested_reply_comm_id, suggested_reply_body) is fetched inside ResolvePanel on open
// via getInbound(). Gate defaults to REVIEW; overridden after fetch if needed.
// ---------------------------------------------------------------------------

export function buildInboundDescriptor(messageId: string): ItemDescriptor {
  return {
    id:                 messageId,
    kind:               'inbound',
    gate:               'REVIEW',  // updated post-fetch inside ResolvePanel if urgency === HIGH
    client_name:        '',        // populated post-fetch
    headline:           'Inbound message awaiting triage',
    plain:              '',        // populated post-fetch
    stakes:             '',        // populated post-fetch
    // inbound shape renders its own footer actions — no shared action radios
    actions:            [],
    inbound_message_id: messageId,
    // draft_id = msg.suggested_reply_comm_id (populated post-fetch in ResolvePanel)
    // msg.id = used for snoozeInbound/dismissInbound (message_id field on those requests)
    proof: emptyProof({
      what: 'Inbound message (details loaded on open)',
      did:  'Scored urgency; drafted suggested reply',
      source: { tag: 'GMAIL · EMAIL', ref: messageId, line: '' },
      route: { agent: 'comms_agent', work: 'llm_assisted', llm: 'Gemini 2.5 Pro', extra: '' },
    }),
  };
}

// ---------------------------------------------------------------------------
// Compound escalation — ACKNOWLEDGE / DISMISS (E.3e)
// Note: contributing_signals not in BriefCompoundEscalationItem — compound_signals is empty.
// The synthesis paragraph + actions still render correctly.
// ---------------------------------------------------------------------------

export function buildCompoundDescriptor(item: BriefCompoundEscalationItem): ItemDescriptor {
  const acknowledge: ActionDef = {
    label: 'Acknowledge & triage',
    event: 'compound.acknowledged',
    tier:  'operational',
    need:  { type: 'none' },
  };
  const dismiss: ActionDef = {
    label:       'Dismiss',
    event:       'compound.dismissed',
    tier:        'operational',
    need:        { type: 'textarea', field: 'reason', minLen: 4 },
    destructive: true,
  };

  return {
    id:                item.escalation_id,
    kind:              'compound',
    gate:              item.risk_level === 'CRITICAL' ? 'ESCALATION' : 'REVIEW',
    client_name:       '',  // no client_name on compound brief item
    headline:          item.what_is_happening,
    plain:             item.what_attorney_must_decide,
    stakes:            item.why_it_matters,
    actions:           [acknowledge, dismiss],
    compound_signals:  [],  // not in BriefCompoundEscalationItem — signal list hidden when empty
    compound_synthesis: item.why_it_matters,
    proof: emptyProof({
      what: `Matter ${item.matter_id} · risk_level ${item.risk_level}`,
      did:  'Coordinator detected cross-signal compound risk',
      source: {
        tag:  'COMPOUND RISK',
        ref:  item.escalation_id,
        line: item.risk_level,
      },
      route: {
        agent: 'coordinator',
        work:  'deterministic',
        llm:   'n/a',
        extra: `priority: ${item.priority}`,
      },
    }),
  };
}
