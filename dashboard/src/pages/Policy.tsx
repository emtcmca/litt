import { useState } from 'react';
import { T } from '../tokens';
import { Icon, type IconName } from '../components/ui/Icon';

// ── Static policy data (v1.2 backend will replace; local state only) ──────────

interface PolicyRule {
  id: string;
  label: string;
  firm: string;
  mine: string;
  lockable?: boolean;
  type?: 'threshold' | 'cadence' | 'rules';
  note: string;
}

interface PolicyDomain {
  id: string;
  name: string;
  icon: IconName;
  rules: PolicyRule[];
}

const POLICY_DOMAINS: PolicyDomain[] = [
  {
    id: 'deadlines', name: 'Deadlines', icon: 'shield',
    rules: [
      { id: 'dl_hardlegal', label: 'Confirm court/legal deadlines', firm: 'gated', mine: 'gated', lockable: false, note: 'Malpractice-critical — firm requires confirmation.' },
      { id: 'dl_cadence', label: 'Escalation cadence (court/legal)', type: 'cadence', firm: '14·7·3·1d', mine: '14·7·3·1d', note: 'Days-out tiers that surface a deadline.' },
      { id: 'dl_soft', label: 'Auto-confirm internal deadlines', firm: 'gated', mine: 'gated', lockable: true, note: 'Firm allows automation; you keep it gated.' },
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
];

// Derive which rules can be toggled (lockable=true, posture type)
const AUTOMATABLE = POLICY_DOMAINS.flatMap(d =>
  d.rules.filter(r => (r.firm === 'gated' || r.firm === 'auto') && r.lockable).map(r => r.id)
);

type PostureMap = Record<string, 'gated' | 'auto'>;

function buildInitial(): PostureMap {
  const out: PostureMap = {};
  POLICY_DOMAINS.forEach(d => d.rules.forEach(r => {
    if (r.firm === 'gated' || r.firm === 'auto') {
      out[r.id] = r.mine === 'auto' ? 'auto' : 'gated';
    }
  }));
  return out;
}

// ── ThresholdControl ──────────────────────────────────────────────────────────
function ThresholdControl({ rule }: { rule: PolicyRule }) {
  const m = String(rule.mine).match(/^(\d+)(\D.*)$/);
  if (!m) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 9, background: T.wash2, border: `1px solid ${T.line}`, whiteSpace: 'nowrap' as const }}>
        <Icon name="check" size={12} color={T.teal} stroke={2.4} />
        <span style={{ fontSize: 12, color: T.ink, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{rule.mine}</span>
      </span>
    );
  }
  const unit = m[2];
  const isPct = unit.includes('%');
  const firmMatch = String(rule.firm).match(/\d+/);
  const firmNum = firmMatch ? parseInt(firmMatch[0], 10) : 100;
  const step = isPct ? 5 : 1;
  const [val, setVal] = useState(parseInt(m[1], 10));
  const tightened = val < firmNum;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' as const }}>
      {tightened && <span style={{ fontSize: 9.5, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '.05em', fontFamily: 'var(--font-mono)' }}>tightened</span>}
      <div style={{ display: 'inline-flex', alignItems: 'center', background: T.wash2, border: `1px solid ${tightened ? 'rgba(169,132,53,.4)' : T.line}`, borderRadius: 9, overflow: 'hidden' }}>
        <button onClick={() => setVal(v => Math.max(step, v - step))} aria-label="tighten" style={{ width: 28, height: 32, border: 'none', borderRight: `1px solid ${T.line}`, background: 'transparent', cursor: 'pointer', color: T.muted, fontSize: 16, fontWeight: 600, lineHeight: '1' }}>−</button>
        <span style={{ minWidth: 56, textAlign: 'center' as const, fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600, color: T.ink }}>{val}{unit}</span>
        <button onClick={() => setVal(v => Math.min(firmNum, v + step))} disabled={val >= firmNum} aria-label="loosen" style={{ width: 28, height: 32, border: 'none', borderLeft: `1px solid ${T.line}`, background: 'transparent', cursor: val >= firmNum ? 'not-allowed' : 'pointer', color: val >= firmNum ? T.faint : T.muted, fontSize: 15, fontWeight: 600, lineHeight: '1', opacity: val >= firmNum ? 0.5 : 1 }}>+</button>
      </div>
    </div>
  );
}

// ── PolicyRuleRow ─────────────────────────────────────────────────────────────
function PolicyRuleRow({ rule, last, value, onChange }: {
  rule: PolicyRule;
  last: boolean;
  value: 'gated' | 'auto' | undefined;
  onChange: (v: 'gated' | 'auto') => void;
}) {
  const isPosture = rule.firm === 'gated' || rule.firm === 'auto';
  const firmLocked = isPosture && !rule.lockable;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center', padding: '14px 18px', borderBottom: last ? 'none' : `1px solid ${T.soft}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{rule.label}</span>
          {firmLocked && (
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.04em', color: T.danger, background: T.dangerSoft, border: '1px solid rgba(155,45,35,.24)', borderRadius: 4, padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)' }}>
              <Icon name="lock" size={9} color={T.danger} />Firm locked
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: T.muted, lineHeight: 1.4, display: 'block', marginTop: 3 }}>{rule.note}</span>
        <span style={{ fontSize: 10, color: T.faint, marginTop: 4, display: 'block', fontFamily: 'var(--font-mono)' }}>Firm minimum: {rule.firm}</span>
      </div>

      {isPosture && firmLocked && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'rgba(20,34,31,.06)', border: `1px solid ${T.line}`, color: T.forest, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const }}>
          <Icon name="lock" size={12} color={T.forest} />Always gated
        </span>
      )}

      {isPosture && !firmLocked && (
        <div style={{ display: 'inline-flex', background: T.wash2, border: `1px solid ${T.line}`, borderRadius: 999, padding: 3, gap: 2 }}>
          {([['gated', 'Ask me'], ['auto', 'Auto + log']] as ['gated' | 'auto', string][]).map(([v, label]) => {
            const on = value === v;
            const tone = v === 'auto' ? T.teal : T.forest;
            return (
              <button key={v} onClick={() => onChange(v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)', background: on ? tone : 'transparent', color: on ? (v === 'auto' ? '#fff' : T.brass) : T.muted, whiteSpace: 'nowrap' as const, transition: 'background .15s' }}>
                {on && <span style={{ width: 5, height: 5, borderRadius: 999, background: v === 'auto' ? '#fff' : T.brass }} />}
                {label}
              </button>
            );
          })}
        </div>
      )}

      {!isPosture && <ThresholdControl rule={rule} />}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function Policy() {
  const [posture, setPosture] = useState<PostureMap>(buildInitial);
  const isAdmin = false; // Dana Strand = attorney view

  const automatedCount = AUTOMATABLE.filter(id => posture[id] === 'auto').length;
  const dialPct = AUTOMATABLE.length ? Math.round((automatedCount / AUTOMATABLE.length) * 100) : 0;
  const dialLabel = automatedCount === 0 ? 'Fully gated' : automatedCount === AUTOMATABLE.length ? 'Maximum safe autonomy' : 'Assisted';

  function setRule(id: string, val: 'gated' | 'auto') {
    setPosture(p => ({ ...p, [id]: val }));
  }

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 18 }}>

        {/* header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Policy & autonomy</h1>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.04em', color: T.gold, background: 'rgba(169,132,53,.1)', border: '1px solid rgba(169,132,53,.28)', borderRadius: 5, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>Autonomy settings</span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '66ch' }}>
            How much Litt does on its own. It starts fully gated — every legal action asks you first. Widen its autonomy on the safe actions as trust grows. The firm sets the floor; you can only tighten it.
          </p>
        </div>

        {/* dial */}
        <section style={{ background: T.audit, borderRadius: 16, padding: '22px 24px', display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' as const }}>
            <div>
              <span style={{ fontSize: 10.5, textTransform: 'uppercase' as const, letterSpacing: '.1em', color: T.auditMuted, fontFamily: 'var(--font-mono)', display: 'block' }}>Current posture</span>
              <div style={{ fontSize: 27, fontWeight: 600, color: '#EFEBDB', letterSpacing: '-.01em', marginTop: 4 }}>{dialLabel}</div>
              <span style={{ fontSize: 11.5, color: T.auditMuted, marginTop: 4, display: 'block', fontFamily: 'var(--font-mono)' }}>{automatedCount} of {AUTOMATABLE.length} firm-permitted actions automated · everything else gated to you</span>
            </div>
            <div style={{ textAlign: 'right' as const }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: T.auditAccent, lineHeight: '1', display: 'block' }}>{dialPct}%</span>
              <span style={{ fontSize: 10, color: T.auditMuted, display: 'block', marginTop: 3, fontFamily: 'var(--font-mono)' }}>of safe autonomy used</span>
            </div>
          </div>
          <div style={{ position: 'relative', height: 8, borderRadius: 999, background: 'rgba(214,193,129,.14)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${dialPct}%`, background: `linear-gradient(90deg, ${T.gold}, ${T.auditAccent})`, borderRadius: 999, transition: 'width .35s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {(['Everything gated', 'Assisted', 'Max safe autonomy'] as const).map((l, i) => (
              <span key={l} style={{ fontSize: 9.5, color: T.auditMuted, fontFamily: 'var(--font-mono)', textAlign: i === 0 ? 'left' : i === 2 ? 'right' : 'center' }}>{l}</span>
            ))}
          </div>
        </section>

        {/* scope banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: isAdmin ? 'rgba(214,193,129,.1)' : T.wash2, border: `1px solid ${isAdmin ? 'rgba(169,132,53,.3)' : T.soft}`, borderRadius: 12, padding: '13px 16px' }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: isAdmin ? T.brass : T.surface, border: `1px solid ${isAdmin ? 'transparent' : T.line}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name={isAdmin ? 'users' : 'lock'} size={16} color={isAdmin ? T.forest : T.gold} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
              {isAdmin ? "You set the firm baseline for Strand & Okafor LLP" : "You're tuning your own posture, on top of the firm baseline"}
            </div>
            <span style={{ fontSize: 12, color: T.muted }}>
              {isAdmin ? 'Your changes become the floor every attorney inherits. Firm-locked rules stay gated for everyone.' : 'Set by Marcus Okafor. You can tighten any rule; you can\'t loosen one below the firm floor.'}
            </span>
          </div>
          <span style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: isAdmin ? T.gold : T.faint, fontWeight: 600, whiteSpace: 'nowrap' as const, fontFamily: 'var(--font-mono)' }}>{isAdmin ? 'firm admin' : 'attorney'}</span>
        </div>

        {/* domains */}
        {POLICY_DOMAINS.map(dom => (
          <section key={dom.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '13px 18px', borderBottom: `1px solid ${T.soft}`, background: T.wash2, display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: T.surface, border: `1px solid ${T.line}`, display: 'grid', placeItems: 'center' }}>
                <Icon name={dom.icon} size={14} color={T.gold} />
              </span>
              <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{dom.name}</span>
            </div>
            <div>
              {dom.rules.map((r, i) => (
                <PolicyRuleRow
                  key={r.id}
                  rule={r}
                  last={i === dom.rules.length - 1}
                  value={posture[r.id]}
                  onChange={v => setRule(r.id, v)}
                />
              ))}
            </div>
          </section>
        ))}

        <span style={{ fontSize: 11, color: T.faint, textAlign: 'center' as const, lineHeight: 1.6, marginTop: 2, fontFamily: 'var(--font-mono)', display: 'block' }}>
          Every change here is written to the audit ledger as a <span style={{ color: T.muted }}>policy.updated</span> event.<br />
          Litt enforces posture at the tool layer — a gated action physically cannot execute without your approval.
        </span>

      </div>
    </div>
  );
}
