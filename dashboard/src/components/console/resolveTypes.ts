import type { IconName } from '../ui/Icon';

// ---------------------------------------------------------------------------
// Input modes — what the required-input block renders
// ---------------------------------------------------------------------------

export interface InputMode {
  type: 'none' | 'textarea' | 'date_select' | 'date_reason' | 'numeric_reason';
  field?: 'reason' | 'narrative';  // textarea only
  minLen?: number;                  // 4=reason, 8=narrative
}

// ---------------------------------------------------------------------------
// Action definition — one radio option / the single action
// ---------------------------------------------------------------------------

export interface ActionDef {
  label: string;
  event: string;                   // e.g. "deadline.confirmed"
  tier: 'legal' | 'operational';
  need: InputMode;
  destructive?: boolean;           // danger styling on primary button
}

// ---------------------------------------------------------------------------
// ProofData — nested shape matching the prototype ProofBlock reads
// ---------------------------------------------------------------------------

export interface ProofData {
  what: string;                    // "What Litt read"
  did: string;                     // "What Litt did"
  source: {
    tag: string;                   // e.g. "GMAIL · EMAIL"
    ref: string;                   // document/source reference
    line: string;                  // quoted excerpt or detail line
  };
  route: {
    agent: string;                 // e.g. "deadline_agent"
    work: string;                  // deterministic | llm_assisted | tool_write
    llm: string;                   // model name or "n/a"
    extra: string;                 // e.g. "confidence: 0.92"
  };
  confidence?: number;
}

// ---------------------------------------------------------------------------
// ItemDescriptor — normalized descriptor that drives all ResolvePanel variants
// ---------------------------------------------------------------------------

export interface ItemDescriptor {
  id: string;
  kind: string;              // 'deadline'|'billing'|'budget'|'anomaly'|'silence'|'inbound'|'compound'
  gate: string;              // 'ESCALATION'|'REVIEW'|'BLOCKED'
  client_name: string;
  headline: string;
  plain: string;
  stakes: string;
  actions: ActionDef[];      // [primary, alt?, tertiary?] — always at least 1
  proof: ProofData;
  draft?: string;            // comms/silence only — pre-drafted body (null = hide draft block)
  // Separate API target for comms endpoints — CommsApproveRequest/QueueRequest/DismissRequest
  // require draft_id, not descriptor.id. Null = no draft; approve action is hidden.
  draft_id?: string | null;
  // Entity version for optimistic-lock; required by deadline + billing endpoints.
  version?: number;

  // E.3a — deadline verify
  extracted_date?: string;
  extracted_class?: string;

  // E.3b / E.3c — billing write-down + scrubber block
  current_hours?: number;
  current_amount?: number;
  scrubber_flags?: Array<{ matched_text: string; message: string }>;

  // E.3d — inbound triage (message_id from BriefInboundItem; panel fetches full InboundMessage)
  inbound_message_id?: string;

  // E.3e — compound escalation
  compound_signals?: Array<{ icon: IconName; label: string; escalation_id: string }>;
  compound_synthesis?: string;
}

// ---------------------------------------------------------------------------
// GATE_TONE — {fg, bg, bd} per gate value
// ---------------------------------------------------------------------------

export interface GateTone {
  fg: string;
  bg: string;
  bd: string;
}

import { T } from '../../tokens';

export const GATE_TONE: Record<string, GateTone> = {
  ESCALATION: { fg: T.danger,  bg: T.dangerSoft,        bd: T.danger },
  REVIEW:     { fg: T.gold,    bg: 'rgba(20,34,31,.07)', bd: T.gold },
  BLOCKED:    { fg: '#3A4A44', bg: 'rgba(20,34,31,.07)', bd: 'rgba(58,74,68,.35)' },
};

// ---------------------------------------------------------------------------
// KIND_META — icon + label per decision kind
// ---------------------------------------------------------------------------

export const KIND_META: Record<string, { label: string; icon: IconName }> = {
  deadline:         { label: 'DEADLINE',       icon: 'shield'  },
  billing:          { label: 'BILLING & WIP',  icon: 'dollar'  },
  budget:           { label: 'BUDGET RISK',    icon: 'chart'   },
  'budget risk':    { label: 'BUDGET RISK',    icon: 'chart'   },
  anomaly:          { label: 'ANOMALY',        icon: 'alert'   },
  silence:          { label: 'CLIENT COMMS',   icon: 'mail'    },
  'client silence': { label: 'CLIENT COMMS',   icon: 'mail'    },
  inbound:          { label: 'INBOUND TRIAGE', icon: 'mail'    },
  compound:         { label: 'COMPOUND RISK',  icon: 'shield'  },
};

// ---------------------------------------------------------------------------
// buildAuditEvent — computes the audit-preview row from selected action
// ---------------------------------------------------------------------------

export function buildAuditEvent(
  descriptor: ItemDescriptor,
  action: ActionDef,
  attorneyId: string
): { event: string; actor: string; entity: string; tier: string } {
  return {
    event:  action.event,
    actor:  attorneyId,
    entity: descriptor.id,
    tier:   action.tier,
  };
}
