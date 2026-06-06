# UI Reference Pack — build the Console *exactly*

This folder exists because prose specs produced a UI that didn't match. The fix: **stop
interpreting descriptions, start translating the real thing.** Everything here is the actual
prototype — its source and its rendered pixels — organized so you can port it 1:1.

## The method (read this first)

1. **The prototype source is the canonical UI spec.** `prototype-source/` contains the exact
   files that render the screenshots. They are plain React (via Babel) with inline styles. Your
   job is a **faithful translation** to the repo's typed React + components — not a
   reinterpretation. When a measurement, color, gap, font-size, border-radius, or copy string
   is in the source, **use that exact value**. Do not round, "improve," or re-derive it.

2. **The screenshots are the acceptance target.** `screens/` has a rendered PNG of every page
   and key state, at the design width (1440px). After you build a page, it should look like its
   screenshot. If it doesn't, the screenshot is right and your build is wrong.

3. **Build the shared primitives first** (`design-system.md`): the token crosswalk, the `Icon`
   set, the `Mono` atom, the gate/work-kind color maps. Every page depends on them. Getting
   these wrong is why a first attempt looks "kind of right but off everywhere."

4. **Port page-by-page in the order in `_pages.md`.** Each entry pairs a screenshot with its
   source file and the exact component to translate, plus the specific things to get right.

## Why the first build diverged (likely causes — avoid these)

- **Wrong action color.** The repo's `--color-action-primary` is **blue (#185FA5)**. The
  Console design does **not** use blue for primary actions — buttons are **forest green
  (#14221F) with brass (#D6C181) text**. `forest`, `brass`, and `gold` are **brand colors not
  present in the repo's color ramp** — you must add them as tokens (see `design-system.md`).
  A build that used the repo's default blue button will look wrong on every page.
- **Paraphrased layout.** The prose said "a summary strip" or "a card with the draft"; the
  source says `display:flex; gap:22px` with specific children. Translate the source, not the
  prose.
- **Mono labels missed.** Almost every micro-label is IBM Plex **Mono**, uppercase, ~9.5–11px,
  letter-spacing ~.08em, in `--color-text-tertiary`. This single convention carries most of the
  "Litt look." See `Mono` in `design-system.md`.
- **Inline styles → made up class names.** The source uses inline styles with exact values.
  Keep the values; you choose the styling mechanism (CSS modules / Tailwind / styled). The
  *numbers* are non-negotiable; the *mechanism* is yours.

## What's in here

```
ui-reference/
  README.md           ← you are here (the method)
  design-system.md    ← tokens, atoms, icons, gate/work-kind maps — BUILD THESE FIRST
  _pages.md           ← page-by-page: screenshot ↔ source file ↔ target ↔ build notes
  prototype-source/   ← the exact prototype files that render the screenshots
  screens/            ← rendered PNG of every page + key states (1440px, the visual target)
```

## How this relates to the rest of the handoff

- This pack tells you **what to build (pixels + code)**.
- `../02-data-contracts.md` + `../03-agent-core/` tell you **what data feeds it** and the
  backend work behind the net-new features.
- `../05-ui-inventory.md` is the bridge: prototype file → target React file/component names.
- `../06-build-sequence.md` is the phase order.

Translate the source. Match the screenshot. Wire to the real endpoints. In that order.
