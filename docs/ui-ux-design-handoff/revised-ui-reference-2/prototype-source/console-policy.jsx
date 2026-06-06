/* ───────────────────────────────────────────────────────────────────────────
   Litt — Console · Policy & autonomy (Tune)
   The trust dial. Litt starts fully gated — everything legal asks you first.
   The firm sets a floor; the attorney can tighten but never loosen. A handful
   of safe actions are firm-permitted to automate, and you widen Litt's
   autonomy on those as trust grows. Nothing here can un-gate a malpractice-
   critical action: those are firm-locked.
─────────────────────────────────────────────────────────────────────────── */
const { useState: useStatePol } = React;

function ConsolePolicy({ user }) {
  const { POLICY } = window.LITTC;
  const isAdmin = user && user.scope === 'firm_admin';

  // per-rule attorney posture override: ruleId -> 'gated' | 'auto'
  const initial = {};
  POLICY.domains.forEach(dom => dom.rules.forEach(r => {
    if (r.firm === 'gated' || r.firm === 'auto') initial[r.id] = r.mine === 'auto' ? 'auto' : 'gated';
  }));
  const [posture, setPosture] = useStatePol(initial);

  // a rule is automatable when the firm permits widening (lockable:true)
  const automatable = [];
  POLICY.domains.forEach(dom => dom.rules.forEach(r => {
    if ((r.firm === 'gated' || r.firm === 'auto') && r.lockable) automatable.push(r.id);
  }));
  const automatedCount = automatable.filter(id => posture[id] === 'auto').length;
  const dialPct = automatable.length ? Math.round((automatedCount / automatable.length) * 100) : 0;
  const dialLabel = automatedCount === 0 ? 'Fully gated' : automatedCount === automatable.length ? 'Maximum safe autonomy' : 'Assisted';

  function setRule(id, val) { setPosture(p => ({ ...p, [id]: val })); }

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 18 }}>

        {/* header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Policy &amp; autonomy</h1>
            <Mono style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: T.gold, background: 'rgba(169,132,53,.1)', border: '1px solid rgba(169,132,53,.28)', borderRadius: 5, padding: '2px 7px' }}>tune</Mono>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '66ch' }}>
            How much Litt does on its own. It starts fully gated — every legal action asks you first. Widen its autonomy on the safe actions as trust grows. The firm sets the floor; you can only tighten it.
          </p>
        </div>

        {/* the dial */}
        <section style={{ background: T.audit, borderRadius: 16, padding: '22px 24px', display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <Mono style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.1em', color: T.auditMuted }}>Current posture</Mono>
              <div style={{ fontSize: 27, fontWeight: 600, color: '#EFEBDB', letterSpacing: '-.01em', marginTop: 4 }}>{dialLabel}</div>
              <Mono style={{ fontSize: 11.5, color: T.auditMuted, marginTop: 4, display: 'block' }}>{automatedCount} of {automatable.length} firm-permitted actions automated · everything else gated to you</Mono>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: T.auditAccent, lineHeight: 1 }}>{dialPct}%</span>
              <Mono style={{ fontSize: 10, color: T.auditMuted, display: 'block', marginTop: 3 }}>of safe autonomy used</Mono>
            </div>
          </div>
          {/* track */}
          <div style={{ position: 'relative', height: 8, borderRadius: 999, background: 'rgba(214,193,129,.14)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${dialPct}%`, background: `linear-gradient(90deg, ${T.gold}, ${T.auditAccent})`, borderRadius: 999, transition: 'width .35s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {['Everything gated', 'Assisted', 'Max safe autonomy'].map((l, i) => (
              <Mono key={l} style={{ fontSize: 9.5, color: T.auditMuted, textAlign: i === 0 ? 'left' : i === 2 ? 'right' : 'center' }}>{l}</Mono>
            ))}
          </div>
        </section>

        {/* scope banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: isAdmin ? 'rgba(214,193,129,.1)' : T.wash2, border: `1px solid ${isAdmin ? 'rgba(169,132,53,.3)' : T.soft}`, borderRadius: 12, padding: '13px 16px' }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: isAdmin ? T.brass : T.surface, border: `1px solid ${isAdmin ? 'transparent' : T.line}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name={isAdmin ? 'users' : 'lock'} size={16} color={isAdmin ? T.forest : T.gold} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{isAdmin ? `You set the firm baseline for ${window.LITTC.FIRM.name}` : 'You’re tuning your own posture, on top of the firm baseline'}</div>
            <span style={{ fontSize: 12, color: T.muted }}>{isAdmin ? 'Your changes become the floor every attorney inherits. Firm-locked rules stay gated for everyone.' : 'Set by Marcus Okafor. You can tighten any rule; you can’t loosen one below the firm floor.'}</span>
          </div>
          <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: isAdmin ? T.gold : T.faint, fontWeight: 600, whiteSpace: 'nowrap' }}>{isAdmin ? 'firm admin' : 'attorney'}</Mono>
        </div>

        {/* domains */}
        {POLICY.domains.map(dom => (
          <section key={dom.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '13px 18px', borderBottom: `1px solid ${T.soft}`, background: T.wash2, display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: T.surface, border: `1px solid ${T.line}`, display: 'grid', placeItems: 'center' }}><Icon name={dom.icon} size={14} color={T.gold} /></span>
              <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{dom.name}</span>
            </div>
            <div>
              {dom.rules.map((r, i) => (
                <PolicyRule key={r.id} rule={r} last={i === dom.rules.length - 1} isAdmin={isAdmin}
                  value={posture[r.id]} onChange={v => setRule(r.id, v)} />
              ))}
            </div>
          </section>
        ))}

        <Mono style={{ fontSize: 11, color: T.faint, textAlign: 'center', lineHeight: 1.6, marginTop: 2 }}>
          Every change here is written to the audit ledger as a <span style={{ color: T.muted }}>policy.updated</span> event.<br />Litt enforces posture at the tool layer — a gated action physically cannot execute without your approval.
        </Mono>
      </div>
    </div>
  );
}

// ── one rule row ──────────────────────────────────────────────────────────────
function PolicyRule({ rule: r, last, isAdmin, value, onChange }) {
  const isPosture = r.firm === 'gated' || r.firm === 'auto';
  const isThreshold = r.type === 'threshold';
  const firmLocked = isPosture && !r.lockable; // malpractice-critical: gated forever

  const base = {
    display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center',
    padding: '14px 18px', borderBottom: last ? 'none' : `1px solid ${T.soft}`,
  };

  return (
    <div style={base}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{r.label}</span>
          {firmLocked && <Mono style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: T.danger, background: T.dangerSoft, border: '1px solid rgba(155,45,35,.24)', borderRadius: 4, padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="lock" size={9} color={T.danger} />firm-locked</Mono>}
        </div>
        <span style={{ fontSize: 12, color: T.muted, lineHeight: 1.4, display: 'block', marginTop: 3 }}>{r.note}</span>
        <Mono style={{ fontSize: 10, color: T.faint, marginTop: 4, display: 'block' }}>Firm floor: {r.firm}</Mono>
      </div>

      {/* control */}
      {isPosture && firmLocked && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'rgba(20,34,31,.06)', border: `1px solid ${T.line}`, color: T.forest, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
          <Icon name="lock" size={12} color={T.forest} />Always gated
        </span>
      )}
      {isPosture && !firmLocked && (
        <div style={{ display: 'inline-flex', background: T.wash2, border: `1px solid ${T.line}`, borderRadius: 999, padding: 3, gap: 2 }}>
          {[['gated', 'Ask me'], ['auto', 'Auto + log']].map(([v, label]) => {
            const on = value === v;
            const tone = v === 'auto' ? T.teal : T.forest;
            return (
              <button key={v} onClick={() => onChange(v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)', background: on ? tone : 'transparent', color: on ? (v === 'auto' ? '#fff' : T.brass) : T.muted, whiteSpace: 'nowrap', transition: 'background .15s' }}>
                {on && <span style={{ width: 5, height: 5, borderRadius: 999, background: v === 'auto' ? '#fff' : T.brass }} />}
                {label}
              </button>
            );
          })}
        </div>
      )}
      {!isPosture && (
        <ThresholdControl rule={r} isThreshold={isThreshold} />
      )}
    </div>
  );
}

// ── threshold / cadence / rules control ───────────────────────────────────────
function ThresholdControl({ rule: r, isThreshold }) {
  // parse a leading number out of e.g. "75%" / "14 days" — tighten-only stepper
  const m = String(r.mine).match(/^(\d+)(\D*)$/);
  const numeric = isThreshold && m;
  const [val, setVal] = useStatePol(numeric ? parseInt(m[1], 10) : null);
  if (!numeric) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 9, background: T.wash2, border: `1px solid ${T.line}`, whiteSpace: 'nowrap' }}>
        <Icon name="check" size={12} color={T.teal} stroke={2.4} />
        <Mono style={{ fontSize: 12, color: T.ink, fontWeight: 600 }}>{r.mine}</Mono>
      </span>
    );
  }
  const unit = m[2];
  const isPct = unit.includes('%');
  const firmNum = parseInt(String(r.firm).match(/\d+/)[0], 10);
  const tightened = val < firmNum; // for % and days, lower = stricter
  const step = isPct ? 5 : 1;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
      {tightened && <Mono style={{ fontSize: 9.5, color: T.gold, textTransform: 'uppercase', letterSpacing: '.05em' }}>tightened</Mono>}
      <div style={{ display: 'inline-flex', alignItems: 'center', background: T.wash2, border: `1px solid ${tightened ? 'rgba(169,132,53,.4)' : T.line}`, borderRadius: 9, overflow: 'hidden' }}>
        <button onClick={() => setVal(v => Math.max(step, v - step))} aria-label="tighten" style={{ width: 28, height: 32, border: 'none', borderRight: `1px solid ${T.line}`, background: 'transparent', cursor: 'pointer', color: T.muted, fontSize: 16, fontWeight: 600, lineHeight: 1 }}>−</button>
        <span style={{ minWidth: 56, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600, color: T.ink }}>{val}{unit}</span>
        <button onClick={() => setVal(v => Math.min(firmNum, v + step))} disabled={val >= firmNum} aria-label="loosen" style={{ width: 28, height: 32, border: 'none', borderLeft: `1px solid ${T.line}`, background: 'transparent', cursor: val >= firmNum ? 'not-allowed' : 'pointer', color: val >= firmNum ? T.faint : T.muted, fontSize: 15, fontWeight: 600, lineHeight: 1, opacity: val >= firmNum ? 0.5 : 1 }}>+</button>
      </div>
    </div>
  );
}

window.ConsolePolicy = ConsolePolicy;
