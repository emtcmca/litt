/* ───────────────────────────────────────────────────────────────────────────
   Litt — Console · Collect (billing hero)
   Every hour, turned into a defensible, billable invoice. The WIP pipeline,
   what the scrubber is holding, the pre-bill rules, and one-click LEDES.
─────────────────────────────────────────────────────────────────────────── */
const { useState: useStateCo } = React;

function money(n) { return '$' + n.toLocaleString(); }

function ConsoleCollect() {
  const { BILLING } = window.LITTC;
  const { pipeline, held, scrubber, realization, ledesReady } = BILLING;
  const [exported, setExported] = useStateCo(false);
  const maxAmt = pipeline[0].amount;
  const captured = pipeline[0].amount, paid = pipeline[pipeline.length - 1].amount;
  const inFlight = captured - paid;
  const flaggedTotal = scrubber.reduce((s, r) => s + r.flagged, 0);

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 940, margin: '0 auto', display: 'grid', gap: 22 }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Collect</h1>
            <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '60ch' }}>
              Every hour you work, turned into a defensible, billable invoice — and nothing left to fall through the cracks.
            </p>
          </div>
          <button onClick={() => setExported(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 17px', borderRadius: 10, background: exported ? T.tealSoft : T.forest, color: exported ? T.teal : T.brass, border: `1px solid ${exported ? 'rgba(29,158,117,.3)' : T.forest}`, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <Icon name={exported ? 'check' : 'arrow'} size={14} color={exported ? T.teal : T.brass} style={exported ? {} : { transform: 'rotate(90deg)' }} />{exported ? 'LEDES exported' : `Export LEDES · ${ledesReady} entries`}
          </button>
        </div>

        {/* pipeline */}
        <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: T.muted, fontWeight: 600 }}>WIP pipeline · this period</Mono>
            <Mono style={{ fontSize: 11, color: T.faint }}>{money(inFlight)} in flight · {money(paid)} collected</Mono>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${pipeline.length}, 1fr)`, gap: 0 }}>
            {pipeline.map((p, i) => {
              const pct = Math.round((p.amount / maxAmt) * 100);
              const dropped = i > 0 ? pipeline[i - 1].amount - p.amount : 0;
              const tone = i === 0 ? T.gold : i === pipeline.length - 1 ? T.teal : T.forest;
              return (
                <div key={p.stage} style={{ position: 'relative', padding: '0 10px', borderLeft: i === 0 ? 'none' : `1px solid ${T.soft}` }}>
                  <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: T.faint }}>{p.stage}</Mono>
                  <div style={{ fontSize: 20, fontWeight: 600, color: T.ink, marginTop: 4, lineHeight: 1.1 }}>{money(p.amount)}</div>
                  <Mono style={{ fontSize: 10.5, color: T.muted }}>{p.count} entries</Mono>
                  <div style={{ height: 5, borderRadius: 999, background: T.wash2, marginTop: 9, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: tone, borderRadius: 999 }} />
                  </div>
                  {dropped > 0 && <Mono style={{ fontSize: 9.5, color: T.gold, marginTop: 5, display: 'block' }}>−{money(dropped)} held / not yet advanced</Mono>}
                </div>
              );
            })}
          </div>
        </section>

        {/* held + scrubber */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 16 }} className="co-grid">
          {/* held by scrubber */}
          <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '13px 18px', borderBottom: `1px solid ${T.soft}`, display: 'flex', alignItems: 'center', gap: 8, background: T.wash2 }}>
              <Icon name="alert" size={14} color={T.gold} />
              <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: T.muted, fontWeight: 600 }}>Held — needs you before it bills</Mono>
              <Mono style={{ marginLeft: 'auto', fontSize: 11, color: T.gold }}>{money(held.reduce((s, h) => s + h.amount, 0))}</Mono>
            </div>
            {held.map(h => (
              <div key={h.id} style={{ padding: '15px 18px', display: 'grid', gap: 9 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{h.matter}</div>
                    <Mono style={{ fontSize: 11, color: T.faint }}>{h.client} · {h.hours.toFixed(1)}h · {h.id}</Mono>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap' }}>{money(h.amount)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Mono style={{ fontSize: 10, fontWeight: 600, color: T.gold, background: 'rgba(169,132,53,.1)', border: '1px solid rgba(169,132,53,.3)', borderRadius: 5, padding: '2px 7px' }}>{h.flag} · {h.sev}</Mono>
                  <span style={{ fontSize: 12, color: T.muted }}>{h.note}</span>
                </div>
                <a href="Litt — Daily Closeout.html" style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2, background: T.forest, color: T.brass, fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 8, textDecoration: 'none' }}>
                  Resolve in closeout <Icon name="arrow" size={12} color={T.brass} />
                </a>
              </div>
            ))}
          </section>

          {/* scrubber + realization */}
          <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            <section style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '15px 17px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                <Mono style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: T.muted, fontWeight: 600 }}>Pre-bill scrubber</Mono>
                <Mono style={{ fontSize: 10.5, color: flaggedTotal ? T.gold : T.teal }}>{flaggedTotal} flag{flaggedTotal !== 1 ? 's' : ''} · {scrubber.length} rules</Mono>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {scrubber.map(r => (
                  <div key={r.rule} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 15, height: 15, borderRadius: 999, background: r.flagged ? 'rgba(169,132,53,.14)' : 'rgba(29,158,117,.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon name={r.flagged ? 'alert' : 'check'} size={9} color={r.flagged ? T.gold : T.teal} stroke={2.4} />
                    </span>
                    <span style={{ fontSize: 12.5, color: T.ink, flex: 1 }}>{r.rule}</span>
                    {r.flagged > 0 && <Mono style={{ fontSize: 10.5, color: T.gold }}>{r.flagged}</Mono>}
                  </div>
                ))}
              </div>
            </section>
            <section style={{ background: T.audit, borderRadius: 14, padding: '15px 17px', display: 'grid', gap: 11 }}>
              <Mono style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: T.auditMuted }}>Realization</Mono>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 30, fontWeight: 600, color: T.auditAccent, lineHeight: 1 }}>{realization.rate}%</span>
                <Mono style={{ fontSize: 11, color: T.auditMuted }}>billed vs. worked</Mono>
              </div>
              <div style={{ display: 'flex', gap: 18, paddingTop: 9, borderTop: `1px solid rgba(214,193,129,.16)` }}>
                <div><Mono style={{ fontSize: 9.5, color: T.auditMuted, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block' }}>Unbilled WIP</Mono><span style={{ fontSize: 14, fontWeight: 600, color: '#EFEBDB' }}>{money(realization.unbilledWip)}</span></div>
                <div><Mono style={{ fontSize: 9.5, color: T.auditMuted, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block' }}>Write-downs MTD</Mono><span style={{ fontSize: 14, fontWeight: 600, color: '#EFEBDB' }}>{money(realization.writedownsMtd)}</span></div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ConsoleCollect = ConsoleCollect;
