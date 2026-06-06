/* ───────────────────────────────────────────────────────────────────────────
   Litt — shared core data + helpers
   Real demo fixture: Strand & Okafor LLP · Dana Strand · closeout 2026-05-29
   The "decision" objects below unify the 5 brief sections into one ranked
   queue. Each carries: a clean surface (what the attorney reads first) and a
   `proof` block (depth on demand — source, agent route, confidence, audit).
─────────────────────────────────────────────────────────────────────────── */
(function () {
  const FIRM = {
    firmName: 'Strand & Okafor LLP',
    attorneyName: 'Dana Strand',
    attorneyShort: 'D. Strand',
    generatedAt: 'May 29, 2026 · 5:00 PM',
    sweepId: 'sweep-20260529-1700',
  };

  // ── Decision queue ────────────────────────────────────────────────────────
  // gate: ESCALATION (can't resolve alone) · REVIEW (judgment needed) ·
  //       BLOCKED (prepared, not sent) · LOG (safe to log/monitor)
  const DECISIONS = [
    {
      id: 'dl-mercer-001',
      kind: 'deadline',
      gate: 'ESCALATION',
      client: 'Mercer Industries',
      matter: 'Mercer Industries v. Dunlap Construction',
      // clean surface
      headline: 'A court deadline needs your confirmation',
      plain: 'Opposition to the defendant’s motion for summary judgment is due in 6 days. Litt has not seen you confirm it.',
      metricLabel: 'Due in',
      metric: '6 days',
      metricSub: 'Thu, Jun 4 · HARD_LEGAL',
      stakes: 'Miss this and it’s malpractice exposure — a default on summary judgment.',
      action: { type: 'confirm', label: 'Confirm deadline', need: null },
      alt: { type: 'extend', label: 'Extend / reassign', need: 'reason' },
      proof: {
        what: 'Active HARD_LEGAL deadline, currently UNCONFIRMED for this closeout.',
        did: 'Ran escalation cadence on all active deadlines. This one entered the 7-day window and was surfaced as critical.',
        decide: 'Confirm you have this deadline calendared and owned.',
        source: { tag: 'court calendar', ref: 'mercer-litigation · dl-v3', line: 'Motion order, SDNY — opposition deadline computed from filing + local rule 6(d).' },
        route: { agent: 'deadline_agent', work: 'deterministic', llm: 'none', extra: 'gate=ESCALATION · escalation_level=7_DAY' },
        confidence: null,
      },
    },
    {
      id: 'te-001',
      kind: 'billing',
      gate: 'REVIEW',
      client: 'Mercer Industries',
      matter: 'Mercer Industries v. Dunlap Construction',
      headline: 'A time entry can’t be billed yet',
      plain: '4.0 hours on the Mercer matter — $1,500 — has no narrative. The pre-bill scrubber is holding it.',
      metricLabel: 'At risk',
      metric: '$1,500',
      metricSub: '4.0 h · entered May 28',
      stakes: 'No narrative means reconstruction risk and a likely LEDES rejection at invoice time.',
      action: { type: 'narrative', label: 'Add narrative & approve', need: 'narrative' },
      alt: { type: 'writeoff', label: 'Write off', need: 'reason' },
      linkedAnomaly: 'anomaly-te-001',
      proof: {
        what: 'PENDING time entry te-001. Pre-bill scrubber flag: MISSING_NARRATIVE (WARN).',
        did: 'Scrubbed the entry against 7 rules. Held it before approval and opened a linked anomaly.',
        decide: 'Add a narrative describing the work, then approve — or write it off with a reason.',
        source: { tag: 'time entry', ref: 'te-001 · v1', line: '4.0h logged on mercer-litigation, rate $375/h. Narrative field empty.' },
        route: { agent: 'billing_agent', work: 'deterministic', llm: 'none', extra: 'tool=scrub_time_entry · flag=WARN' },
        confidence: null,
      },
    },
    {
      id: 'anomaly-te-001',
      kind: 'anomaly',
      gate: 'REVIEW',
      client: 'Mercer Industries',
      matter: 'Mercer Industries v. Dunlap Construction',
      headline: 'Litt flagged an anomaly on this entry',
      plain: 'Entry te-001 was logged with no narrative — an elevated billing anomaly. Litt won’t clear it without a reason on the record.',
      metricLabel: 'Risk',
      metric: 'Elevated',
      metricSub: 'Missing narrative · te-001',
      stakes: 'Silent dismissals are how bad billing habits hide. Litt requires a reason every time.',
      action: { type: 'dismiss', label: 'Dismiss with reason', need: 'reason' },
      alt: null,
      proof: {
        what: 'Anomaly anomaly-te-001 · type MISSING_NARRATIVE · risk ELEVATED.',
        did: 'Detected the missing narrative, scored it severity × confidence, and routed it to your review. No silent action taken.',
        decide: 'Resolve the underlying entry, or dismiss this with a reason that will be logged.',
        source: { tag: 'anomaly', ref: 'anomaly-te-001', line: 'entity=time_entry · entity_id=te-001 · priority=2' },
        route: { agent: 'anomaly_agent', work: 'deterministic', llm: 'none', extra: 'risk=elevated · reason required' },
        confidence: null,
      },
    },
    {
      id: 'budget-acme',
      kind: 'budget',
      gate: 'REVIEW',
      client: 'Acme Commercial Partners LLC',
      matter: 'Acme Commercial — General counsel retainer',
      headline: 'Acme is approaching its budget cap',
      plain: 'Acme is at 78% of its $15,000 retainer. You crossed the 75% warning threshold since the last closeout.',
      metricLabel: 'Utilization',
      metric: '78%',
      metricSub: '$11,700 of $15,000 committed',
      stakes: 'A budget surprise erodes client trust. Get ahead of it before the overage, not after.',
      action: { type: 'ack', label: 'Acknowledge & log review', need: null },
      alt: { type: 'raise', label: 'Request budget increase', need: 'reason' },
      proof: {
        what: 'Acme Commercial Partners LLC · 78% utilization · WARN (threshold 75%).',
        did: 'Computed utilization from billed + approved-unbilled against the retainer cap. Fired a threshold alert.',
        decide: 'Acknowledge you’ve seen it, or open a budget-increase conversation.',
        source: { tag: 'budget', ref: 'acme · retainer', line: '$9,000 billed + $2,700 approved-unbilled = $11,700 / $15,000.' },
        route: { agent: 'billing_agent', work: 'deterministic', llm: 'none', extra: 'math=deterministic · alert=WARN' },
        confidence: null,
      },
    },
    {
      id: 'silence-whitmore',
      kind: 'silence',
      gate: 'BLOCKED',
      client: 'Whitmore Group',
      matter: 'Whitmore Group Employment Advisory',
      headline: 'A client has gone quiet — draft ready',
      plain: 'No contact with Whitmore in 16 days (your threshold is 14). Litt drafted a short status note — it will not send without you.',
      metricLabel: 'Silent for',
      metric: '16 days',
      metricSub: 'Last contact May 13 · threshold 14d',
      stakes: 'Silent matters are how clients drift. A two-line update keeps the relationship warm.',
      action: { type: 'approve_comms', label: 'Review & approve draft', need: null },
      alt: { type: 'dismiss_comms', label: 'Dismiss', need: 'reason' },
      draft: 'Hi — quick check-in on your employment advisory matter. We’re monitoring the items we discussed and there’s nothing requiring action from you this week. I’ll send a fuller update once the policy review wraps. As always, reach out anytime. — Dana',
      proof: {
        what: 'Whitmore Group Employment Advisory · 16 days since contact (threshold 14d).',
        did: 'Tracked days-since-contact, tripped the silence threshold, and generated a source-backed draft. Held it behind your approval — Litt never sends.',
        decide: 'Approve the draft to queue it for your signature, or dismiss with a reason.',
        source: { tag: 'comms draft', ref: 'whitmore · draft', line: 'Every factual sentence is grounded in matter records; uncited claims become [ATTORNEY] placeholders.' },
        route: { agent: 'comms_agent', work: 'llm_assisted', llm: 'gemini-2.5-pro', extra: 'write=tool_layer · approval_gate=on' },
        confidence: 0.94,
      },
    },
  ];

  // ── Pre-existing audit events (the backbone already has history) ──────────
  // Newest first is built at runtime; store oldest→newest here.
  const SEED_AUDIT = [
    {
      id: 'ae-seed-1', t: '4:58 PM', tier: 'engineering', actor: 'Litt · coordinator',
      event: 'sweep.completed', entity: 'sweep-20260529-1700',
      summary: 'Closeout sweep ran across 4 sub-agents — 5 items surfaced, 1 critical.',
      friendly: 'Litt ran your closeout sweep — 5 items need you, 1 critical.',
      before: { state: 'idle' }, after: { items: 5, critical: 1, elapsed_ms: 2140 },
    },
    {
      id: 'ae-seed-2', tier: 'operational', t: '4:58 PM', actor: 'Litt · deadline_agent',
      event: 'deadline.escalated', entity: 'dl-mercer-001',
      summary: 'Mercer opposition deadline entered the 7-day window — surfaced as critical, unconfirmed.',
      friendly: 'Litt flagged the Mercer deadline as critical — 7 days out, unconfirmed.',
      before: { escalation_level: '14_DAY' }, after: { escalation_level: '7_DAY', surfaced: true },
    },
    {
      id: 'ae-seed-3', tier: 'operational', t: '2:14 PM', actor: 'D. Strand',
      event: 'deadline.confirmed', entity: 'dl-okafor-discovery',
      summary: 'Confirmed discovery cutoff for Okafor v. Lindqvist (Jun 19).',
      friendly: 'You confirmed the discovery cutoff for Okafor v. Lindqvist.',
      before: { verification_status: 'UNCONFIRMED' }, after: { verification_status: 'CONFIRMED', by: 'dana-strand' },
    },
  ];

  const TIER_META = {
    legal_defensibility: { label: 'legal', human: 'Legal record', color: '#9B2D23' },
    operational: { label: 'ops', human: 'Operational', color: '#A98435' },
    engineering: { label: 'eng', human: 'System', color: '#5F6F66' },
  };

  const GATE_META = {
    ESCALATION: { label: 'Needs you now', mono: 'ESCALATION', desc: 'Litt can’t resolve this alone.' },
    REVIEW: { label: 'Your call', mono: 'REVIEW_REQUIRED', desc: 'Operational, but wants your judgment.' },
    BLOCKED: { label: 'Prepared', mono: 'BLOCKED', desc: 'Drafted and held — Litt won’t send.' },
    LOG: { label: 'For the record', mono: 'AUTO_SAFE', desc: 'Safe to log or keep monitoring.' },
  };

  const KIND_META = {
    deadline: 'Deadline',
    billing: 'Billing',
    anomaly: 'Anomaly',
    budget: 'Budget',
    silence: 'Client silence',
  };

  function fmtTimeNow() {
    // demo clock — advances slightly each call so receipts read in order
    fmtTimeNow._m = (fmtTimeNow._m || 0) + 1;
    const base = 17 * 60 + 2 + fmtTimeNow._m; // 5:02 PM onward
    let h = Math.floor(base / 60), m = base % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    return `${h}:${String(m).padStart(2, '0')} ${ap}`;
  }

  // ── Time-aware greeting (varies each load; original Litt voice) ────────────
  function greet(name, forceHour) {
    const h = forceHour != null ? forceHour : new Date().getHours();
    let bucket, pool;
    if (h < 5)       { bucket = 'overnight'; pool = ['It’s late, {n}.', 'Still up, {n}? It’ll keep until morning.', 'Go home, {n} — Litt has the watch.', 'Past midnight, {n}. This can wait.']; }
    else if (h < 8)  { bucket = 'early';     pool = ['Early start, {n}.', 'Up early, {n}.', 'Ahead of the day, {n}.']; }
    else if (h < 12) { bucket = 'morning';   pool = ['Good morning, {n}.', 'Morning, {n}.', 'Morning, {n} — let’s get ahead of it.']; }
    else if (h < 17) { bucket = 'afternoon'; pool = ['Good afternoon, {n}.', 'Afternoon, {n}.', 'Afternoon, {n} — let’s keep it tidy.']; }
    else if (h < 21) { bucket = 'evening';   pool = ['Good evening, {n}.', 'Evening, {n}.', 'Evening, {n} — let’s close out.', 'Time to close out, {n}.']; }
    else             { bucket = 'night';     pool = ['Winding down, {n}?', 'Late one, {n}.', 'Still going, {n}? Almost there.', 'Long day, {n}. Let’s wrap it.']; }
    greet._c = greet._c || {};
    if (!(bucket in greet._c)) greet._c[bucket] = pool[Math.floor(Math.random() * pool.length)];
    return greet._c[bucket].replace('{n}', name);
  }

  window.LITT = { FIRM, DECISIONS, SEED_AUDIT, TIER_META, GATE_META, KIND_META, fmtTimeNow, greet };
})();
