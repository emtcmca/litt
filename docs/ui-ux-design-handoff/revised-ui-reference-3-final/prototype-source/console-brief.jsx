/* ───────────────────────────────────────────────────────────────────────────
   Litt — Console · Brief (the centerpiece)
   The closeout, run on demand or on a schedule of the attorney's choosing.
   Litt runs a sweep → assembles the Brief → you decide → it's all logged.
─────────────────────────────────────────────────────────────────────────── */
const { useState: useStateBr } = React;

function ConsoleBrief({ onNav }) {
  const DEC = window.LITT.DECISIONS;
  const crit = DEC.filter(d => d.gate === 'ESCALATION').length;
  const [sched, setSched] = useStateBr({ daily: true, morning: false, events: true });
  const [running, setRunning] = useStateBr(false);

  const toggle = k => setSched(s => ({ ...s, [k]: !s[k] }));
  const schedules = [
    { k: 'daily', label: 'Daily closeout', time: '5:00 PM', sub: 'Every business day' },
    { k: 'morning', label: 'Morning brief', time: '8:00 AM', sub: 'Start-of-day scan' },
    { k: 'events', label: 'On significant events', time: 'Real-time', sub: 'New HARD_LEGAL deadline, scrubber block…' },
  ];

  function runNow() {
    setRunning(true);
    setTimeout(() => { setRunning(false); onNav && onNav('agents'); }, 900);
  }

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 940, margin: '0 auto', display: 'grid', gap: 20 }}>
        {/* header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Brief</h1>
            <Mono style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: T.teal, background: T.tealSoft, border: '1px solid rgba(29,158,117,.28)', borderRadius: 5, padding: '2px 7px' }}>the centerpiece</Mono>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '64ch' }}>
            Litt assembles everything that needs you into one closeout — on demand, or on a schedule you set. Everything it surfaces is gated to your judgment and written to the record.
          </p>
        </div>

        {/* hero: ready / run */}
        <section style={{ background: T.audit, borderRadius: 16, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: T.auditAccent, boxShadow: `0 0 8px ${T.auditAccent}` }} />
              <Mono style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.1em', color: T.auditMuted }}>Brief ready · assembled 5:00 PM</Mono>
            </div>
            <div style={{ fontSize: 27, fontWeight: 600, color: '#EFEBDB', letterSpacing: '-.01em', lineHeight: 1.15 }}>
              {DEC.length} decisions need you · <span style={{ color: '#F0A8A0' }}>{crit} critical</span>
            </div>
            <Mono style={{ fontSize: 11.5, color: T.auditMuted, marginTop: 6, display: 'block' }}>Next scheduled run: tomorrow 5:00 PM · 4 agents · 1 deterministic router</Mono>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <a href="Litt — Daily Closeout.html" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', borderRadius: 10, background: T.brass, color: T.forest, fontSize: 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Open today’s closeout <Icon name="arrow" size={14} color={T.forest} />
            </a>
            <button onClick={runNow} disabled={running} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 20px', borderRadius: 10, background: 'transparent', color: T.brass, border: `1px solid rgba(214,193,129,.35)`, cursor: running ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
              {running ? <><span className="ag-spin" style={{ width: 12, height: 12, border: `2px solid rgba(214,193,129,.4)`, borderTopColor: T.brass, borderRadius: 999, display: 'inline-block' }} />Sweeping…</> : <><Icon name="refresh" size={14} color={T.brass} />Run brief now</>}
            </button>
          </div>
        </section>

        {/* body: surfaced + schedule */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }} className="co-grid">
          {/* what it surfaced */}
          <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '13px 18px', borderBottom: `1px solid ${T.soft}`, background: T.wash2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: T.muted, fontWeight: 600 }}>What this brief surfaced</Mono>
              <Mono style={{ fontSize: 11, color: T.faint }}>ranked by pressure</Mono>
            </div>
            {DEC.map((d, i) => {
              const tone = window.GATE_TONE[d.gate];
              return (
                <a key={d.id} href="Litt — Daily Closeout.html" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 11, alignItems: 'center', padding: '12px 18px', borderBottom: i === DEC.length - 1 ? 'none' : `1px solid ${T.soft}`, textDecoration: 'none', borderLeft: `3px solid ${d.gate === 'ESCALATION' ? T.danger : 'transparent'}` }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: tone.fg, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.headline}</div>
                    <Mono style={{ fontSize: 10.5, color: T.faint }}>{window.LITT.KIND_META[d.kind]} · {d.client}</Mono>
                  </div>
                  <Icon name="chevron" size={13} color={T.faint} />
                </a>
              );
            })}
          </section>

          {/* schedule */}
          <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '15px 17px', alignContent: 'start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Icon name="clock" size={14} color={T.gold} />
              <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: T.muted, fontWeight: 600 }}>Schedule</Mono>
            </div>
            <div style={{ display: 'grid', gap: 9 }}>
              {schedules.map(s => {
                const on = sched[s.k];
                return (
                  <button key={s.k} onClick={() => toggle(s.k)} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', textAlign: 'left', background: on ? 'rgba(29,158,117,.05)' : T.wash2, border: `1px solid ${on ? 'rgba(29,158,117,.26)' : T.soft}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap' }}>{s.label}</span>
                        <Mono style={{ fontSize: 11, color: on ? T.teal : T.faint, whiteSpace: 'nowrap' }}>{s.time}</Mono>
                      </div>
                      <span style={{ fontSize: 11.5, color: T.muted }}>{s.sub}</span>
                    </div>
                    <span style={{ width: 34, height: 20, borderRadius: 999, background: on ? T.teal : T.faint, position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: 999, background: '#fff', transition: 'left .2s' }} />
                    </span>
                  </button>
                );
              })}
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 11.5, color: T.faint, lineHeight: 1.5 }}>Run on demand anytime with <strong style={{ color: T.muted }}>Run brief now</strong>. Every brief and every decision is appended to the audit log.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

window.ConsoleBrief = ConsoleBrief;
