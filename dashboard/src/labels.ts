// Central display-label mapper.
// Keep raw enum values in audit/proof sections; use these in all primary UI.

export const CLASSIFICATION_LABEL: Record<string, string> = {
  HARD_LEGAL:        'Court/legal deadline',
  HARD_CONTRACTUAL:  'Contract deadline',
  SOFT_INTERNAL:     'Internal deadline',
};

export const GATE_LABEL: Record<string, string> = {
  ESCALATION:      'Attorney must decide',
  REVIEW_REQUIRED: 'Review required',
  BLOCKED:         'Action held',
  AUTO_SAFE:       'Logged safely',
};

export const AGENT_LABEL: Record<string, string> = {
  deadline_agent: 'Deadline agent',
  billing_agent:  'Billing agent',
  comms_agent:    'Comms agent',
  anomaly_agent:  'Anomaly agent',
  coordinator:    'Coordinator',
};

export const KIND_LABEL: Record<string, string> = {
  deadline:         'Deadline',
  billing:          'Billing & WIP',
  budget:           'Budget risk',
  'budget risk':    'Budget risk',
  anomaly:          'Anomaly',
  silence:          'Quiet client',
  'client silence': 'Quiet client',
  inbound:          'Client email',
  compound:         'Compound risk',
};

export function clsLabel(cls: string): string {
  return CLASSIFICATION_LABEL[cls] ?? cls.replace(/_/g, ' ').toLowerCase();
}

export function agentLabel(agent: string): string {
  return AGENT_LABEL[agent] ?? agent.replace(/_/g, ' ');
}
