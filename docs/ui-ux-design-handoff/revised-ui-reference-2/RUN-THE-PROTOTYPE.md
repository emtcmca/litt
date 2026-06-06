# RUN THE PROTOTYPE — live side-by-side after every phase

The screenshots in `screens/` are static targets. The **prototype itself is runnable**, and
running it is the best fidelity check: open it next to your build at the same width and compare
the *live* layout, hover states, and animations. Do this after each build phase's human gate.

---

## 1. Serve the prototype locally

The prototype loads multiple `.jsx` files through in-browser Babel, so it must be served over
HTTP (not opened as a `file://` URL — Babel can't fetch the modules cross-origin from `file://`).

```bash
cd docs/ui-ux-design-handoff/ui/ui-reference/prototype-source
python3 -m http.server 8080        # or:  npx serve -l 8080
```

Then open (note the spaces + the " - " in the filename must be URL-encoded):

```
http://localhost:8080/Litt%20-%20Console.html
```

**Requirements & caveats**
- **Needs internet:** React, ReactDOM, Babel-standalone, and IBM Plex fonts load from CDNs.
  If you're offline, the page stays blank — vendor the scripts or get online.
- **First paint is slow (~1–3s):** Babel compiles the JSX in the browser. Wait for it.
- Open your browser to a **1440px-wide** window (the screens were captured at 1440). DevTools
  device toolbar → "Responsive" → set 1440 width is the cleanest way.
- Ignore any single console warning about loading Babel in the browser — expected for a
  prototype, irrelevant to the visual output.

---

## 2. Navigate the prototype by hash

The prototype routes off `location.hash`. Change the hash (or edit the URL) to jump to any
surface. Map of **hash → your app route → screenshot(s) → build-plan phase**:

| Prototype hash | App route | Screens | Plan phase |
|---|---|---|---|
| *(none)* / `#overview` | `/` | `01-overview.png` | Phase 2 |
| `#brief` | `/brief` | `18-brief.png` | Phase 12 |
| `#deadlines` | `/deadlines` | `02`, `03` | Phase 3 |
| `#collect` | `/collect` | `04-collect.png` | Phase 4 |
| `#agents` | `/agents` | `14`,`15`,`16`,`17` | Phase 5 |
| `#record` | `/ledger` | `05-record-ledger.png` | Phase 6 |
| `#policy` | `/policy` | `06`, `07` | Phase 7 |
| `#clients` | `/relationships` | `08`,`09`,`10` | Phase 8 |
| `#budgets` | `/budgets` | `11-budgets.png` | Phase 9 |
| `#anomalies` | `/anomalies` | `12-anomalies.png` | Phase 10 |
| `#integrations` | `/integrations` | `13-integrations.png` | Phase 11 |

> `#brief`: the prototype's Brief surface (`console-brief.jsx`) is now captured as
> `18-brief.png`. **It is a redesign and differs from the repo's existing
> `DailyCloseoutBrief.tsx`** — so "match the screenshot" for `/brief` means porting
> `console-brief.jsx`, not keeping the current component. See the plan-review note / the
> drop-in Phase 12 replacement.

---

## 3. Drive the interactive states (so you can compare them, not just the static top)

Most pages scroll — scroll the prototype and your build together. The pages with **stateful**
behavior to exercise:

**Agent console (`#agents`)** — the highest-value comparisons:
- **Idle heartbeat:** on load, with no sweep running, watch the soft brass ring cycle through
  the four specialist agents (Deadline Monitor → Billing → Client Comms → Anomaly), ~one every
  **2.1s**; the dock reads "Watching · <agent>". (Matches `14-agents-idle.png`.)
- **Run a sweep:** click **Run closeout sweep** (top-right). Steps auto-advance at **~640ms
  each**, 20 steps total. Watch the firing node ring-light, its input sources light up, the live
  tool chip appear, and the wire animate. (Matches `15-agents-toolcall.png`.)
- **Scrub manually:** use the bottom segment bar / step controls to land on a specific step.
  Step **6** (and **11**) are the cross-agent hand-offs — gold dashed edge between Client Comms
  and Deadline Monitor + the inspector "Cross-agent hand-off" card. (Matches `16`.)
- **Tool catalog:** click the **Tool layer** node → the inspector shows the full catalog +
  boundary stat ("17/20 deterministic · 3 Gemini"). (Matches `17-agents-toollayer.png`.)
- **Plain/Technical toggle** (top-right) changes the node-body copy and inspector vocabulary.
- Click any agent node → "Tools it can call" list.

**Relationships (`#clients`):** the first inbound card (Mercer) is expanded by default; the
commitment cards have **Mark kept / Slipped** buttons that flip the card and fire a
"written to the audit ledger" flash. Scroll through all four sections (Awaiting / Commitments /
Going quiet / comms log).

**Deadlines (`#deadlines`):** the filter tabs (All / Needs confirmation / Court·legal / Owned
by you) re-filter the book; the timeline pins and cadence ladder are static.

**Policy (`#policy`):** the GATED/AUTO toggles and the tighten-only `±` steppers respond to
clicks (local state); firm-locked rows are inert.

**Audit ledger (`#record`):** rows expand to before→after diffs; tier/actor filters work.

**Integrations (`#integrations`):** the Clio "Connect" button flips to connected (local state).

---

## 4. The side-by-side method (per phase)

After a phase's build is up on your dev server:

1. Two browser windows at **1440px**: left = your app route, right = the prototype hash from
   the table above.
2. Scroll both to the same section. Compare: **layout, spacing, color, type scale, copy,
   chip/badge styling, hover borders.** The prototype is correct; if they differ, your build is
   wrong (per `README.md`).
3. For animated/stateful surfaces (Agent console especially), drive the same state in both
   (run the sweep, scrub to the same step, click the same node) and compare.
4. Only after the live side-by-side matches do you set/update the Playwright baseline
   (`--update-snapshots`). The prototype is the human reference; the baseline is your app's own
   approved render.

> **Why both this and the screenshots?** The PNGs catch *static* divergence fast; the live
> prototype catches *interaction/animation* divergence (heartbeat cadence, sweep timing,
> hover states, toggle behavior) that a screenshot can't show. The build plan's Phase 5 notes
> sweep/handoff states are "verify manually" — this is how you do that.

---

## 5. Quick reference — exact timings & counts to match (from source)

These are easy to get subtly wrong; they're verified against `prototype-source/console-agents.jsx`:

- Idle heartbeat interval: **2100ms**, cycling the **4 specialist agents only** (not the
  coordinator/tool/audit/brief). The active agent **plus its mapped input sources plus the
  coordinator** light up.
- Sweep step cadence (`STEP_MS`): **640ms** per step. **20** steps total.
- Source-mapping per step is driven by the step's **tool kind** — a `read` step lights that
  agent's input sources; the mapping is:
  `deadline → [calendar, matters]`, `billing → [time]`, `comms → [matters, gmail]`,
  `anomaly → [time]`.
- Boundary stat is **computed** (`total − llm_assisted`), not hard-coded: 17/20 with 3 Gemini.
- Elapsed readout format: `+{(step·0.64).toFixed(1)}s`; dock idle text: `last sweep 4:58 PM`.
