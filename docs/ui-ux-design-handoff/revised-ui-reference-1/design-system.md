# Design System — build these primitives FIRST

Every Console page depends on these. The prototype defines them in
`prototype-source/litt-flows.jsx` (tokens + `Icon` + `Mono`) and
`prototype-source/console-agents.jsx` / `console-record.jsx` (gate + work-kind colors).
Below is the exact, authoritative reference plus the crosswalk to the repo's existing
`dashboard/src/index.css` tokens.

---

## 1. Color tokens — prototype `T.*` → repo CSS var

The prototype palette (`T`) was built to mirror `index.css`. **Neutrals and teal are exact
hex matches** — reuse the repo vars. **Brand colors (forest / brass / gold) and a few accents
are NOT in the repo ramp — add them.**

| `T.*` | Hex | Repo CSS var | Match | Use |
|---|---|---|---|---|
| `surface` | `#FFFFFF` | `--color-background-primary` | exact | card backgrounds |
| `wash2` | `#F8F7F4` | `--color-background-secondary` | exact | subtle fills, table headers |
| `wash` | `#F1EFE8` | `--color-background-tertiary` / `--color-ramp-gray-50` | exact | page bg behind cards |
| `paper` | `#FBFAF6` | *(none — add `--color-background-canvas`)* | new | the Console content area bg |
| `line` | `rgba(20,20,18,.12)` | `--color-border-tertiary` | ~exact | hairlines, card borders |
| `soft` | `rgba(20,20,18,.07)` | *(add `--color-border-soft`)* | new | inner row dividers |
| `ink` | `#2C2C2A` | `--color-text-primary` / `--color-ramp-gray-900` | exact | headings, primary text |
| `muted` | `#6F6D67` | `--color-text-secondary` | exact | body/secondary text |
| `faint` | `#A9A7A1` | `--color-text-tertiary` | exact | micro-labels, meta |
| `teal` | `#1D9E75` | `--color-ramp-teal-400` / `--color-border-success` | exact | success, "warm", Gemini-assist |
| `tealSoft` | `rgba(29,158,117,.10)` | `--color-background-success` (≈`#E1F5EE`) | close | teal chip fills |
| `danger` | `#9B2D23` | *(add `--color-brand-danger`; nearest `--color-ramp-red-600 #A32D2D`)* | near | critical, unconfirmed, slipped |
| `dangerSoft` | `#F6E4DF` | `--color-background-danger` (`#FCEBEB`) / `--color-ramp-red-50` | close | danger chip fills |
| **`forest`** | **`#14221F`** | **(add `--color-brand-forest`)** | **NEW** | **primary buttons, rail bg, dark ink** |
| **`brass`** | **`#D6C181`** | **(add `--color-brand-brass`)** | **NEW** | **text/icon ON forest (buttons, rail)** |
| **`gold`** | **`#A98435`** | **(add `--color-brand-gold`; amber ramp is close-ish)** | **NEW** | **warnings, "held", accents** |
| `forestLine` | `rgba(214,193,129,.20)` | derived from brass | — | hairlines on forest surfaces |
| `audit` | `#11140F` | `--color-audit-surface` (`#11110F`) | ~exact | dark "engine room" panels |
| `auditMuted` | `#9DA89A` | *(add `--color-audit-muted`)* | new | muted text on dark |
| `auditAccent` | `#9EE1C7` | `--color-audit-success` (`#5DCAA5`) / `--color-ramp-teal-100` (`#9FE1CB`) | close | mint accent on dark |

> **The single most important correction:** primary actions are **forest with brass text**,
> not the repo's blue `--color-action-primary`. Add the three brand tokens and use them.

Suggested additions to `index.css`:
```css
:root {
  --color-background-canvas: #FBFAF6;   /* Console content area */
  --color-border-soft:       rgba(20,20,18,0.07);
  --color-brand-forest:      #14221F;   /* primary buttons, rail */
  --color-brand-brass:       #D6C181;   /* text/icon on forest */
  --color-brand-gold:        #A98435;   /* warnings / held / accents */
  --color-audit-muted:       #9DA89A;
  --color-audit-accent:      #9EE1C7;
}
```

---

## 2. Typography

- **Sans:** IBM Plex Sans (`--font-sans`) — UI text. Weights 400/500/600/700. Already imported.
- **Mono:** IBM Plex Mono (`--font-mono`) — **all micro-labels, values, IDs, counts, status
  text.** This is ~70% of the "Litt look."
- **Headings:** page `<h1>` = 26px / 600 / letter-spacing -.02em / `ink`. Section `<h2>` = 17px
  / 600 / -.01em. Card titles 13.5–16px / 600.
- **Body:** 13–14.5px / `muted`, line-height ~1.5, `max-width` ~64–70ch on paragraphs.
- **The `Mono` micro-label convention:** uppercase, 9.5–11px, `letter-spacing: .08–.1em`,
  color `faint` (or a tone color for status). Used as eyebrows/section labels everywhere.

```tsx
// atom — port verbatim
export const Mono = ({ children, style }: {children: React.ReactNode; style?: React.CSSProperties}) =>
  <span style={{ fontFamily: "var(--font-mono)", ...style }}>{children}</span>;
```

---

## 3. The `Icon` set (port verbatim from `litt-flows.jsx`)

A single inline-SVG component, 16×16 viewBox, stroke-only (`fill:none`, `strokeWidth` ~1.6,
round caps/joins). Names used across the Console — keep the same names so source ports cleanly:

`check · arrow · clock · shield · alert · dollar · mail · chart · chevron · chevronD · x ·
book · refresh · lock · grid · sliders · plug · users · dot`

Signature: `<Icon name size=16 color="currentColor" stroke=1.6 style />`. The full path data
is in `prototype-source/litt-flows.jsx` (lines ~22–55) — copy it exactly; do not redraw. If
you swap to an icon library, match the same stroke weight and 16px optical size or the UI
density shifts.

---

## 4. Gate (commitment level) + work-kind color maps

These drive the Agent console and the brief. They already exist in the repo
(`AgentRunTimeline.tsx` `GATE_SPEC` / `WORK_KIND_SPEC`) — **reuse them** so the graph and the
log agree. Prototype values for reference:

| Gate / `CommitmentLevel` | Color | Meaning |
|---|---|---|
| `AUTO_SAFE` / `LOG` | `teal #1D9E75` | safe to log/monitor |
| `REVIEW_REQUIRED` / `REVIEW` | `gold #A98435` | judgment needed |
| `ESCALATION` | `danger #9B2D23` | can't resolve alone |
| `BLOCKED` | forest/slate `#3A4A44` | prepared, not sent |

| `work_kind` | Chip label | Color |
|---|---|---|
| `deterministic` | PYTHON / compute | `faint` / tertiary |
| `llm_assisted` | GEMINI | `teal` (info/blue in repo `WORK_KIND_SPEC` — keep repo's) |
| `tool_write` | write | `teal` |
| `route` | route | `brass` *(new — add to `WORK_KIND_SPEC`)* |
| `human_gate` | gate | `gold` |

---

## 5. Shared layout primitives (recurring across pages)

Build these as components; they repeat on every surface (see source for exact values):

- **Card** — `background: surface; border: 1px solid line; border-radius: 14px`. (Repo
  `--border-radius-lg` is 12px; the Console uses **14px** on big cards, 12 on small, 8–10 on
  chips/buttons — follow the source per element.)
- **Section header bar** — card top strip: `padding: 12px 18px; border-bottom: 1px solid soft;
  background: wash2`, holding a `Mono` uppercase label.
- **`SubHead`** (`console-clients.jsx`) — icon tile + `<h2>` + count pill + sub. Used to split
  a page into sections ("Awaiting your response", "Going quiet", "Commitments you've made").
- **`PageHead`** (`console-stubs.jsx`) — `<h1>` + section tag pill + descriptive sub.
- **Stat strip** — a `flex; gap:22px` row of `{Mono eyebrow, big number, Mono sub}` cells.
- **Pill / chip** — `inline-flex; gap:5px; padding:3px 9px; border-radius:999px; background:
  {tone}14; border:1px solid {tone}40`, with a 6px dot + `Mono` label.
- **Dark panel** ("engine room" / "how it works") — `background: audit; border-radius:14px`,
  mint `auditAccent` accents, `auditMuted` text. Used on Agent console, ledger stat strip,
  the comms "How Litt handles your comms" card, the deadline "How it runs" card.
- **Primary button** — `background: forest; color: brass; border-radius:10px; padding:11px
  18px; font-weight:600`, usually with a trailing `arrow` icon. **Never blue.**
- **Secondary button** — `background: transparent; color: muted; border:1px solid line`.

---

## 6. Content area + rail geometry (`console-shell.jsx`)

- **Rail:** fixed left column, `background: forest`, `width` ~232px. Logo block at top, four
  nav groups (`Watch / Collect / Prove / Tune`) with `Mono` uppercase group labels, a system-
  status block + user chip pinned at the bottom. Active item = brass-tinted pill. **Prove sits
  above Tune** (we reordered this).
- **Content:** scrollable, `background: paper`, inner `max-width` ~920–980px centered, padding
  `24px 30px 60px`.
- The prototype routes by `location.hash`; the repo uses React Router — map hash ids to routes
  (see `../05-ui-inventory.md`).
