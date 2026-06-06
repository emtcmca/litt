/* ───────────────────────────────────────────────────────────────────────────
   Litt — Console data
   Powers the platform shell: agents, the live sweep, integrations, the
   firm/attorney roster, policy (firm baseline + attorney override), and the
   full operational books that the closeout only distills.
   Reuses window.LITT (closeout fixture) where possible.
─────────────────────────────────────────────────────────────────────────── */
(function () {
  // ── People (multi-user · firm policy overrides attorney) ──────────────────
  const FIRM = {
    name: 'Strand & Okafor LLP', short: 'Strand & Okafor', id: 'strand-okafor',
  };
  const USERS = [
    { id: 'marcus-okafor', name: 'Marcus Okafor', initials: 'MO', role: 'Managing Partner', scope: 'firm_admin', note: 'Sets firm policy' },
    { id: 'dana-strand', name: 'Dana Strand', initials: 'DS', role: 'Attorney', scope: 'attorney', note: 'You', you: true },
    { id: 'priya-nair', name: 'Priya Nair', initials: 'PN', role: 'Paralegal', scope: 'staff', note: 'Time capture · intake' },
  ];

  // ── Agentic architecture ──────────────────────────────────────────────────
  const COORDINATOR = {
    id: 'coordinator', name: 'Coordinator', role: 'Signal router',
    kind: 'deterministic',
    blurb: 'Classifies every signal with a Python function and routes it to a domain agent. It never asks the model which agent to use — routing is a dictionary, not a guess.',
    metric: '4 agents orchestrated', sub: 'classify_signal()',
  };
  const AGENTS = [
    {
      id: 'deadline_agent', name: 'Deadline Monitor', kind: 'deterministic',
      watches: 'All active deadlines · your commitments', logic: '4 escalation tiers by classification',
      blurb: 'Computes days-remaining and applies an escalation cadence by deadline class. Surfaces unconfirmed HARD_LEGAL deadlines as critical. Also receives commitments the Comms agent extracts from your sent replies and watches them as soft deadlines.',
      handledToday: 11, surfaced: 1, model: null,
    },
    {
      id: 'billing_agent', name: 'Billing Reconciliation', kind: 'deterministic',
      watches: 'Pending time entries · budgets', logic: 'Pre-bill scrubber (7 rules) · budget math',
      blurb: 'Scrubs every pending entry against seven deterministic rules, computes budget utilization, and routes threshold crossings. State transitions are enforced by a hardcoded table.',
      handledToday: 6, surfaced: 2, model: null,
    },
    {
      id: 'comms_agent', name: 'Client Comms', kind: 'llm_assisted',
      watches: 'Your inbox · days since contact', logic: 'Inbound triage · silence triggers · source-backed drafts',
      blurb: 'Monitors your inbox and your matters. Triages the client messages that need a reply — summarizing each, pulling out the action items, and drafting a suggested response — and detects matters that have gone quiet. Gmail access is read-only; every draft is source-backed and held behind your approval. Litt never sends.',
      handledToday: 9, surfaced: 4, model: 'gemini-2.5-pro',
    },
    {
      id: 'anomaly_agent', name: 'Anomaly Escalation', kind: 'deterministic',
      watches: 'Billing & operational patterns', logic: '13 detectors · severity × confidence',
      blurb: 'Runs thirteen deterministic detectors (duplicates, vague narratives, round-hours, rate deviations…), scores each by severity × confidence, and routes by risk.',
      handledToday: 14, surfaced: 1, model: null,
    },
  ];

  // ── Live sweep: the observation stream the Agent Console animates ──────────
  // commitment: AUTO_SAFE | REVIEW_REQUIRED | ESCALATION | BLOCKED
  // work: deterministic | llm_assisted | tool_write | human_gate
  // tool: the actual named function the agent invokes this step
  // from/to: a cross-agent hand-off (ROUTE_HANDOFF)
  const SWEEP = [
    { agent: 'coordinator', type: 'SIGNAL_RECEIVED', commit: 'AUTO_SAFE', work: 'deterministic',
      desc: 'Closeout sweep triggered for strand-okafor · 5:00 PM.' },
    { agent: 'coordinator', type: 'ROUTING_DECISION', commit: 'AUTO_SAFE', work: 'deterministic',
      tool: { name: 'classify_signal', kind: 'route', sig: 'classify_signal(signal) → AgentId', result: '18 signals → 4 agents' },
      desc: 'classify_signal() routed every signal class to its domain agent.' },

    // — inbound triage (comms-first) —
    { agent: 'comms_agent', type: 'TOOL_CALL', commit: 'AUTO_SAFE', work: 'tool_write',
      tool: { name: 'scan_inbox', kind: 'read', sig: 'scan_inbox(scope="clients") → Message[]', result: '3 messages awaiting your reply' },
      desc: 'Read the inbox (read-only) — 3 client messages await a response.' },
    { agent: 'comms_agent', type: 'REASONING', commit: 'AUTO_SAFE', work: 'deterministic',
      tool: { name: 'score_urgency', kind: 'compute', sig: 'score_urgency(msg) → 0..1', result: 'Mercer 0.88 · high' },
      desc: 'Scored each message by urgency — deterministic signals, no model.' },
    { agent: 'comms_agent', type: 'TOOL_CALL', commit: 'AUTO_SAFE', work: 'llm_assisted', model: 'gemini-2.5-pro', conf: 0.95,
      tool: { name: 'summarize_message', kind: 'llm', sig: 'summarize_message(msg) → {summary, action_items[]}', result: 'summary + 2 action items' },
      desc: 'Gemini summarized each message and extracted its action items.' },

    // — cross-agent hand-off #1: Mercer names a court date —
    { agent: 'comms_agent', type: 'ROUTE_HANDOFF', commit: 'AUTO_SAFE', work: 'deterministic', from: 'comms_agent', to: 'deadline_agent',
      tool: { name: 'route_to_agent', kind: 'route', sig: 'route_to_agent("deadline", ctx) → ack', result: '→ Deadline Monitor' },
      desc: 'Sandra’s email names a Thursday court deadline — handed to the Deadline Monitor to verify.' },
    { agent: 'deadline_agent', type: 'TOOL_CALL', commit: 'AUTO_SAFE', work: 'tool_write',
      tool: { name: 'get_active_deadlines', kind: 'read', sig: 'get_active_deadlines(matter_id) → Deadline[]', result: 'Mercer opposition · Jun 4' },
      desc: 'Pulled the matter’s active deadlines from the store.' },
    { agent: 'deadline_agent', type: 'ESCALATION', commit: 'ESCALATION', work: 'deterministic',
      tool: { name: 'apply_escalation_tier', kind: 'compute', sig: 'apply_escalation_tier(6, HARD_LEGAL) → 7_DAY', result: 'CRITICAL · unconfirmed' },
      desc: '6 days out, HARD_LEGAL, unconfirmed → surfaced as critical. Needs you.' },

    // — back to comms: draft the reply, held —
    { agent: 'comms_agent', type: 'TOOL_CALL', commit: 'BLOCKED', work: 'llm_assisted', model: 'gemini-2.5-pro', conf: 0.95,
      tool: { name: 'draft_reply', kind: 'llm', sig: 'draft_reply(msg, facts[]) → Draft', result: 'reply drafted · 2 citations' },
      desc: 'With the date verified, Gemini drafted Sandra’s reply — every fact cited.' },
    { agent: 'comms_agent', type: 'APPROVAL_GATE_APPLIED', commit: 'BLOCKED', work: 'human_gate',
      tool: { name: 'hold_for_approval', kind: 'gate', sig: 'hold_for_approval(draft) → Held', result: 'queued for your signature' },
      desc: 'Reply held — Litt never sends without your approval.' },

    // — commitment capture + cross-agent hand-off #2 —
    { agent: 'comms_agent', type: 'TOOL_CALL', commit: 'AUTO_SAFE', work: 'llm_assisted', model: 'gemini-2.5-pro', conf: 0.91,
      tool: { name: 'extract_commitments', kind: 'llm', sig: 'extract_commitments(thread) → Promise[]', result: '“answer by Friday” · Reyes' },
      desc: 'From a reply you sent Reyes, Litt extracted a promise you made — “answer by Friday.”' },
    { agent: 'comms_agent', type: 'ROUTE_HANDOFF', commit: 'AUTO_SAFE', work: 'deterministic', from: 'comms_agent', to: 'deadline_agent',
      tool: { name: 'register_commitment', kind: 'write', sig: 'register_commitment(promise) → SoftDeadline', result: 'soft deadline · Jun 5' },
      desc: 'Handed the promise to the Deadline Monitor — now watched like any other date.' },

    // — billing depth: pull → scrub → hold → budget —
    { agent: 'billing_agent', type: 'TOOL_CALL', commit: 'AUTO_SAFE', work: 'tool_write',
      tool: { name: 'get_pending_entries', kind: 'read', sig: 'get_pending_entries() → Entry[]', result: '9 pending · $14,200' },
      desc: 'Pulled every pending time entry from the billing store.' },
    { agent: 'billing_agent', type: 'TOOL_CALL', commit: 'REVIEW_REQUIRED', work: 'tool_write',
      tool: { name: 'run_prebill_scrubber', kind: 'compute', sig: 'run_prebill_scrubber(entry) → Flag[]', result: 'te-001 · MISSING_NARRATIVE' },
      desc: 'Ran all 9 entries through the 7-rule scrubber — one came back flagged.' },
    { agent: 'billing_agent', type: 'RESULT', commit: 'REVIEW_REQUIRED', work: 'tool_write',
      tool: { name: 'hold_entry', kind: 'write', sig: 'hold_entry(te-001, flag) → Held', result: 'held before billing' },
      desc: 'Held te-001 before it could be billed — $1,500, no narrative.' },
    { agent: 'billing_agent', type: 'RESULT', commit: 'REVIEW_REQUIRED', work: 'deterministic',
      tool: { name: 'compute_budget_utilization', kind: 'compute', sig: 'compute_budget_utilization(matter) → pct', result: 'Acme 78% · WARN' },
      desc: 'Acme utilization 78% → crossed the 75% WARN threshold.' },

    // — anomaly depth: detect → score → require reason —
    { agent: 'anomaly_agent', type: 'TOOL_CALL', commit: 'AUTO_SAFE', work: 'deterministic',
      tool: { name: 'run_detectors', kind: 'compute', sig: 'run_detectors(entry) → Anomaly[]', result: '13 detectors · 1 fired' },
      desc: 'Ran 13 deterministic detectors over the day’s entries — one fired.' },
    { agent: 'anomaly_agent', type: 'REASONING', commit: 'REVIEW_REQUIRED', work: 'deterministic',
      tool: { name: 'score_risk', kind: 'compute', sig: 'score_risk(anomaly) → severity×conf', result: 'ELEVATED · 0.82' },
      desc: 'Scored the missing-narrative anomaly — severity × confidence → ELEVATED.' },
    { agent: 'anomaly_agent', type: 'APPROVAL_GATE_APPLIED', commit: 'BLOCKED', work: 'human_gate',
      tool: { name: 'require_reason', kind: 'gate', sig: 'require_reason(anomaly) → Blocked', result: 'reason required to clear' },
      desc: 'Won’t clear without your reason — Litt never dismisses anything silently.' },

    // — assemble —
    { agent: 'coordinator', type: 'RESULT', commit: 'AUTO_SAFE', work: 'deterministic',
      tool: { name: 'assemble_brief', kind: 'write', sig: 'assemble_brief(items) → Brief', result: 'Brief · 5 items, 1 critical' },
      desc: 'Assembled the closeout — 5 items, 1 critical · every step logged.' },
  ];

  const COMMIT_META = {
    AUTO_SAFE:       { label: 'Auto-safe',  color: '#1D9E75' },
    REVIEW_REQUIRED: { label: 'Review',     color: '#A98435' },
    ESCALATION:      { label: 'Escalation', color: '#9B2D23' },
    BLOCKED:         { label: 'Held',       color: '#14221F' },
  };
  const WORK_META = {
    deterministic: { label: 'Python · deterministic', tone: 'forest' },
    llm_assisted:  { label: 'Gemini · llm-assisted',  tone: 'teal'   },
    tool_write:    { label: 'Tool layer · write',     tone: 'gold'   },
    human_gate:    { label: 'Human gate',             tone: 'danger' },
  };

  // ── Tool layer: the named functions each agent may invoke ─────────────────
  // kind: read | compute | llm | route | gate | write
  const KIND_META = {
    read:    { label: 'read',    color: '#A98435', note: 'Pulls from a connected source — never writes.' },
    compute: { label: 'compute', color: '#1F4D3F', note: 'Deterministic math, scoring, or state logic.' },
    llm:     { label: 'gemini',  color: '#1D9E75', note: 'Calls Gemini — only to draft or extract for you.' },
    route:   { label: 'route',   color: '#5F6F66', note: 'Classifies or hands a signal to another agent.' },
    gate:    { label: 'gate',    color: '#9B2D23', note: 'Holds an action behind your approval.' },
    write:   { label: 'write',   color: '#14221F', note: 'Commits through the tool layer to the record.' },
  };
  const TOOLS = {
    coordinator: [
      { name: 'classify_signal', kind: 'route', sig: '(signal) → AgentId' },
      { name: 'assemble_brief',  kind: 'write', sig: '(items) → Brief' },
    ],
    deadline_agent: [
      { name: 'get_active_deadlines',    kind: 'read',    sig: '(matter_id?) → Deadline[]' },
      { name: 'compute_days_remaining',  kind: 'compute', sig: '(due) → int' },
      { name: 'apply_escalation_tier',   kind: 'compute', sig: '(days, cls) → Tier' },
      { name: 'register_commitment',     kind: 'write',   sig: '(promise) → SoftDeadline' },
      { name: 'surface_to_brief',        kind: 'write',   sig: '(item, priority) → BriefItem' },
    ],
    billing_agent: [
      { name: 'get_pending_entries',        kind: 'read',    sig: '() → Entry[]' },
      { name: 'run_prebill_scrubber',       kind: 'compute', sig: '(entry) → Flag[]' },
      { name: 'compute_budget_utilization', kind: 'compute', sig: '(matter) → pct' },
      { name: 'hold_entry',                 kind: 'write',   sig: '(entry, flag) → Held' },
    ],
    comms_agent: [
      { name: 'scan_inbox',          kind: 'read',    sig: '(scope) → Message[]' },
      { name: 'score_urgency',       kind: 'compute', sig: '(msg) → 0..1' },
      { name: 'summarize_message',   kind: 'llm',     sig: '(msg) → {summary, items[]}' },
      { name: 'extract_commitments', kind: 'llm',     sig: '(thread) → Promise[]' },
      { name: 'draft_reply',         kind: 'llm',     sig: '(msg, facts[]) → Draft' },
      { name: 'route_to_agent',      kind: 'route',   sig: '(agent, ctx) → ack' },
      { name: 'hold_for_approval',   kind: 'gate',    sig: '(draft) → Held' },
    ],
    anomaly_agent: [
      { name: 'run_detectors',  kind: 'compute', sig: '(entry) → Anomaly[]' },
      { name: 'score_risk',     kind: 'compute', sig: '(anomaly) → severity×conf' },
      { name: 'require_reason', kind: 'gate',    sig: '(anomaly) → Blocked' },
    ],
  };

  // ── Commitment capture + lifecycle: promises Litt caught in YOUR replies ──
  // Each is quoted verbatim from a message you sent, then watched as a soft
  // deadline through its lifecycle: pending → tracked → kept | slipped.
  // status: pending (reply not yet sent) | tracked | due-soon | kept | slipped
  const COMMITMENTS = [
    { id: 'cm-mercer', quote: 'I’ll send the updated exhibit list by end of day tomorrow.', client: 'Mercer Industries', matter: 'v. Dunlap Construction', captured: 'today', due: 'May 30, 2026', daysOut: 1, status: 'pending', onBook: false },
    { id: 'cm-whit', quote: 'I’ll get you the policy review summary by Sunday.', client: 'Whitmore Group', matter: 'Employment advisory', captured: 'May 27', due: 'May 31, 2026', daysOut: 2, status: 'due-soon', onBook: true },
    { id: 'cm-reyes', quote: 'I’ll have our answer to you by Friday.', client: 'Reyes Logistics', matter: 'Vendor dispute', captured: 'May 28', due: 'Jun 5, 2026', daysOut: 7, status: 'tracked', onBook: true },
    { id: 'cm-acme', quote: 'We’ll circulate the revised draft to you next week.', client: 'Acme Commercial Partners', matter: 'GC retainer', captured: 'May 24', due: 'Jun 9, 2026', daysOut: 11, status: 'tracked', onBook: false },
    { id: 'cm-lind', quote: 'I’ll confirm the deposition schedule by Monday.', client: 'Lindqvist Holdings', matter: 'Okafor v. Lindqvist', captured: 'May 20', due: 'May 25, 2026', daysOut: -4, status: 'kept', onBook: false, closedNote: 'Fulfilled May 24 — a day early' },
    { id: 'cm-bell', quote: 'I’ll send the signed engagement letter by Tuesday.', client: 'Bell Manufacturing', matter: 'Matter intake', captured: 'May 18', due: 'May 22, 2026', daysOut: -7, status: 'slipped', onBook: false, closedNote: 'Re-sent May 27 — 5 days late' },
  ];

  // ── Integrations ──────────────────────────────────────────────────────────
  const INTEGRATIONS = [
    { id: 'gmail', name: 'Gmail', via: 'MCP adapter', status: 'connected', detail: 'Read-only · deadline & contact extraction', sync: 'Synced 4:58 PM' },
    { id: 'calendar', name: 'Google Calendar', via: 'MCP adapter', status: 'connected', detail: 'Deadline & hearing ingestion', sync: 'Synced 4:58 PM' },
    { id: 'ledes', name: 'LEDES 1998B export', via: 'e-billing', status: 'ready', detail: 'Approved entries → compliant invoice file', sync: 'Last export May 27' },
    { id: 'clio', name: 'Clio', via: 'practice mgmt', status: 'available', detail: 'Matter & contact sync', sync: 'Not connected' },
  ];

  // ── Policy: firm baseline + attorney override (attorney may only tighten) ──
  // posture per domain action: 'gated' (always ask) | 'auto' (act, then log)
  // Demo default: firm gates everything legal; attorney can tighten further.
  const POLICY = {
    domains: [
      {
        id: 'deadlines', name: 'Deadlines', icon: 'shield',
        rules: [
          { id: 'dl_hardlegal', label: 'Confirm HARD_LEGAL deadlines', firm: 'gated', mine: 'gated', lockable: false, note: 'Malpractice-critical — firm requires confirmation.' },
          { id: 'dl_cadence', label: 'Escalation cadence (HARD_LEGAL)', type: 'cadence', firm: '14·7·3·1d', mine: '14·7·3·1d', note: 'Days-out tiers that surface a deadline.' },
          { id: 'dl_soft', label: 'Auto-confirm SOFT_INTERNAL deadlines', firm: 'gated', mine: 'gated', lockable: true, note: 'Firm allows automation; you keep it gated.' },
        ],
      },
      {
        id: 'billing', name: 'Billing', icon: 'dollar',
        rules: [
          { id: 'bl_approve', label: 'Approve clean entries under threshold', type: 'threshold', firm: '$0 (all gated)', mine: '$0 (all gated)', note: 'Auto-approve scrubbed entries below an amount.' },
          { id: 'bl_scrub', label: 'Pre-bill scrubber', type: 'rules', firm: '7 rules on', mine: '7 rules on', note: 'Deterministic narrative & rate checks.' },
          { id: 'bl_writeoff', label: 'Write-offs require a reason', firm: 'on', mine: 'on', lockable: false, note: 'No silent write-offs, ever.' },
        ],
      },
      {
        id: 'budgets', name: 'Budgets', icon: 'chart',
        rules: [
          { id: 'bd_warn', label: 'Budget warning threshold', type: 'threshold', firm: '75%', mine: '75%', note: 'Fire a WARN alert at this utilization.' },
          { id: 'bd_crit', label: 'Budget critical threshold', type: 'threshold', firm: '90%', mine: '90%', note: 'Fire a CRITICAL alert at this utilization.' },
        ],
      },
      {
        id: 'comms', name: 'Client comms', icon: 'mail',
        rules: [
          { id: 'cm_send', label: 'Send client communications', firm: 'gated', mine: 'gated', lockable: false, note: 'Litt drafts; you always send. Cannot be automated.' },
          { id: 'cm_silence', label: 'Silence threshold', type: 'threshold', firm: '14 days', mine: '14 days', note: 'Days of no contact before Litt drafts outreach.' },
        ],
      },
    ],
  };

  // ── Full operational books (Watch) — supersets of the closeout sections ───
  const DEADLINES_BOOK = [
    { id: 'dl-mercer-001', matter: 'Mercer Industries v. Dunlap Construction', client: 'Mercer Industries', desc: 'Opposition to MSJ', due: 'Jun 4, 2026', daysOut: 6, cls: 'HARD_LEGAL', status: 'UNCONFIRMED', owner: 'Dana Strand', source: 'Calendar · court order' },
    { id: 'dl-okafor-disc', matter: 'Okafor v. Lindqvist', client: 'Lindqvist Holdings', desc: 'Discovery cutoff', due: 'Jun 19, 2026', daysOut: 21, cls: 'HARD_LEGAL', status: 'CONFIRMED', owner: 'Dana Strand', source: 'Scheduling order' },
    { id: 'dl-acme-renew', matter: 'Acme Commercial — GC retainer', client: 'Acme Commercial Partners', desc: 'Contract renewal notice', due: 'Jun 30, 2026', daysOut: 32, cls: 'HARD_CONTRACTUAL', status: 'CONFIRMED', owner: 'Marcus Okafor', source: 'Contract clause' },
    { id: 'dl-mercer-exp', matter: 'Mercer Industries v. Dunlap Construction', client: 'Mercer Industries', desc: 'Expert disclosure', due: 'Jul 10, 2026', daysOut: 42, cls: 'HARD_LEGAL', status: 'CONFIRMED', owner: 'Dana Strand', source: 'Scheduling order' },
    { id: 'dl-whit-review', matter: 'Whitmore Group Employment Advisory', client: 'Whitmore Group', desc: 'Policy review delivery', due: 'Jun 12, 2026', daysOut: 14, cls: 'SOFT_INTERNAL', status: 'CONFIRMED', owner: 'Priya Nair', source: 'Internal' },
    { id: 'dl-reyes-ans', matter: 'Reyes Logistics — Vendor dispute', client: 'Reyes Logistics', desc: 'Answer to complaint', due: 'Jun 8, 2026', daysOut: 10, cls: 'HARD_LEGAL', status: 'CONFIRMED', owner: 'Dana Strand', source: 'Service of process' },
    { id: 'dl-reyes-commit', matter: 'Reyes Logistics — Vendor dispute', client: 'Reyes Logistics', desc: 'Answer to client — your commitment', due: 'Jun 5, 2026', daysOut: 7, cls: 'SOFT_INTERNAL', status: 'CONFIRMED', owner: 'Dana Strand', source: 'Your commitment · reply May 28', commitment: true },
  ];

  const CLS_META = {
    HARD_LEGAL:       { label: 'HARD_LEGAL', color: '#9B2D23' },
    HARD_CONTRACTUAL: { label: 'HARD_CONTRACTUAL', color: '#A98435' },
    SOFT_INTERNAL:    { label: 'SOFT_INTERNAL', color: '#1D9E75' },
    ADMINISTRATIVE:   { label: 'ADMINISTRATIVE', color: '#5F6F66' },
  };

  // domain counts for the overview (books at a glance)
  const BOOKS = [
    { id: 'deadlines', name: 'Deadlines', icon: 'shield', total: 12, needsYou: 1, line: '1 unconfirmed HARD_LEGAL · nearest 6d' },
    { id: 'billing', name: 'Billing & WIP', icon: 'dollar', total: 7, needsYou: 2, line: '$1,500 held · 1 scrubber block' },
    { id: 'budgets', name: 'Budgets', icon: 'chart', total: 9, needsYou: 1, line: '1 client over 75% · Acme 78%' },
    { id: 'comms', name: 'Clients & comms', icon: 'mail', total: 5, needsYou: 1, line: '1 silent matter · draft ready' },
    { id: 'anomalies', name: 'Anomalies', icon: 'alert', total: 3, needsYou: 1, line: '1 elevated · 2 cleared' },
  ];

  // ── Billing / Collect ─────────────────────────────────────────────────────
  const BILLING = {
    pipeline: [
      { stage: 'Captured',  amount: 14200, count: 9, note: 'Logged this period' },
      { stage: 'Scrubbed',  amount: 14200, count: 9, note: '7-rule pre-bill check' },
      { stage: 'Approved',  amount: 9700,  count: 6, note: 'You signed off' },
      { stage: 'Invoiced',  amount: 8200,  count: 5, note: 'On a client invoice' },
      { stage: 'Paid',      amount: 6500,  count: 4, note: 'Collected' },
    ],
    held: [
      { id: 'te-001', matter: 'Mercer Industries v. Dunlap', client: 'Mercer Industries', hours: 4.0, amount: 1500, flag: 'MISSING_NARRATIVE', sev: 'WARN', note: 'No narrative — reconstruction & LEDES-rejection risk.' },
    ],
    scrubber: [
      { rule: 'Missing narrative', flagged: 1 }, { rule: 'Forbidden phrases', flagged: 0 },
      { rule: 'Round hours, no session', flagged: 0 }, { rule: 'Block-billing', flagged: 0 },
      { rule: 'Rate deviation', flagged: 0 }, { rule: 'Duplicate entry', flagged: 0 },
      { rule: 'Stale pending (>30d)', flagged: 0 },
    ],
    realization: { rate: 92, writedownsMtd: 1850, unbilledWip: 4500 },
    ledesReady: 6,
  };

  window.LITTC = {
    FIRM, USERS, COORDINATOR, AGENTS, SWEEP, COMMIT_META, WORK_META, KIND_META, TOOLS, COMMITMENTS,
    INTEGRATIONS, POLICY, DEADLINES_BOOK, CLS_META, BOOKS, BILLING,
  };
})();
