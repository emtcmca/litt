# Litt — Brand & Design System Executive Summary

**Date:** May 30, 2026  
**Status:** Ready for implementation  
**Audience:** Design team, engineering leads, product stakeholders

---

## What You've Received

A complete, production-ready design system for Litt, comprising:

1. **Litt-Brand-Guidelines.md** — Brand philosophy, voice, visual identity, and design principles
2. **Litt-Component-Library.md** — Reusable UI components with HTML/CSS code examples
3. **Litt-Design-Tokens.md** — Design tokens (colors, spacing, typography) and CSS variables
4. **Litt-Implementation-Guide.md** — Practical patterns for developers and anti-patterns to avoid
5. **Interactive Dashboard Mockup** — Live example of the design system applied to Litt's core UI
6. **Color System Reference** — Interactive color palette with semantic assignments and contrast validation

---

## Brand Summary

### Identity

**Litt** is an operational control layer for small law firms—a platform that eliminates chaos through continuous monitoring, transparent escalation, and human-centered automation.

The brand communicates four core values:

1. **Technical rigor** — Deterministic logic, not guesses. Every action logged and defensible.
2. **Legal discipline** — Respects the gravity of legal work and attorney autonomy.
3. **Human-centered automation** — AI is the engine; attorneys always stay in control.
4. **Operational calm** — Clarity emerges from chaos. The Daily Closeout Brief is a moment of peace.

### Visual Aesthetic

- **Sophisticated & refined** — Borrowing from Notion, Figma, and fintech (Stripe, Linear)
- **Professional yet accessible** — Clear hierarchies, generous whitespace, minimal decoration
- **Tech-forward but grounded** — Sleek dashboard design without coldness
- **Dark mode native** — All colors resolve automatically to light/dark variants
- **Judge-facing controlled intensity** — The v1.0 demo should feel like a legal command center: composed, dense, and memorable without becoming decorative.

### Brand Voice

**Clear, authoritative, precise.** Litt speaks like a trusted operations partner—someone who has managed legal workflows and understands the stakes.

- Direct and literal. "Deadline confirmation" not "deadline checkpoint."
- Certainty over hedging. "Approved and logged" not "appears to be saved."
- Respectful of time. Labels are short; detail lives in panels and tooltips.
- Mirrors legal language. Use "confirmed," "approved," "logged," "dismissed with reason."

---

## Design System at a Glance

### Color Palette

| Ramp | Primary use | Light stops | Dark stops |
|------|------------|-------------|------------|
| **Blue** | Primary actions, pending, information | #E6F1FB → #378ADD | #0C447C → #042C53 |
| **Teal** | Approved, confirmed, success | #E1F5EE → #1D9E75 | #085041 → #04342C |
| **Amber** | Warnings, caution, threshold | #FAEEDA → #BA7517 | #633806 → #412402 |
| **Red** | Critical, HARD_LEGAL, escalations | #FCEBEB → #E24B4A | #791F1F → #501313 |
| **Gray** | Neutral, structural, disabled | #F1EFE8 → #888780 | #444441 → #2C2C2A |

Each ramp has 7 stops (50, 100, 200, 400, 600, 800, 900) for flexible, accessible color choices.

### Typography

Only two font weights are used:
- **400** (regular) — Body text, labels, captions
- **500** (bold) — Headings, strong emphasis

Type scale:
- **24px/500** — Heading 1 (page titles)
- **18px/500** — Heading 2 (section titles)
- **16px/500** — Heading 3 (labels)
- **16px/400** — Body text
- **14px/400** — Labels, buttons
- **12px/400** — Captions, secondary text
- **13px/400** — Monospace (code, IDs)

### Spacing Scale

```
4px   (--spacing-2xs)
8px   (--spacing-xs)
12px  (--spacing-sm)
16px  (--spacing-md)
24px  (--spacing-lg)
32px  (--spacing-xl)
48px  (--spacing-2xl)
```

### Border Radius

```
8px   (--border-radius-md)    — Buttons, badges, small cards
12px  (--border-radius-lg)    — Cards, modals, larger containers
16px  (--border-radius-xl)    — Rare, large rounded containers
50%   — Pills (fully rounded, deliberate use)
```

### Borders

All borders are **0.5px solid** with semantic color tokens. No hardcoded values.

```
0.5px solid var(--color-border-tertiary)    — Default dividers
0.5px solid var(--color-border-secondary)   — Hover/focus states
0.5px solid var(--color-border-primary)     — Strong emphasis
```

For accent borders (e.g., left edge of escalation cards):
```
border-left: 3px solid var(--color-border-danger)
```

---

## Dashboard Design

The dashboard is structured around **the Daily Closeout Brief**—Litt's core ritual and product.

For the hackathon, the dashboard must communicate the product arc in one glance: detect risk, request attorney judgment, write the audit event, and prove what happened. The first viewport should include a command header, mandatory product story panel, operational triage strip, prioritized decision timeline, and a visible audit-ready proof point.

### Structure

The structure must lead with the product story panel before the ordinary operating metrics. The panel names the loop directly: find risk, ask for judgment, record decision, prove what happened.

1. **Command header** — Logo, brief title, firm, attorney, generated time, demo status
2. **Triage strip** — Critical risks, billing blocks, WIP dollars, client silence, audit-ready status
3. **Summary** — High-level operating narrative in 1-2 concise sentences
4. **Decision timeline (priority order):**
   - HARD_LEGAL escalations (red cards)
   - Work in progress and billing blocks (blue/red/amber cards)
   - Budget alerts (amber cards)
   - Client communications (teal/amber cards)
   - Anomalies (red/amber/gray cards)
   - Routine confirmations (gray cards)
5. **Footer** — Timestamp, link to full dashboard, audit log reference
6. **Audit reveal** — Action success surfaces the audit event ID, actor, timestamp, and entity changed.

### Card Anatomy

Each card follows a consistent pattern:

```
[Badge] Title
────────────────────
Subtitle
────────────────────
Key-value metadata (grid)
────────────────────
[Primary button] [Secondary button]
```

All cards are raised (white bg, 0.5px border, 12px radius) with consistent 16px padding.

### Color Usage

Color indicates **status**, not sequence:

- **Blue** — Pending action, informational, requires decision
- **Teal** — Already confirmed or approved, low priority
- **Amber** — Warning, threshold crossed, needs attention
- **Red** — Critical, HARD_LEGAL, malpractice risk, highest priority
- **Gray** — Dismissed or non-actionable, archived

---

## Implementation Principles

### 1. CSS Variables First

All colors, spacing, and sizing come from design tokens. Developers should never hardcode hex colors or pixel values (except for font sizes).

```css
/* Good */
background: var(--color-background-info);
border: 0.5px solid var(--color-border-tertiary);
padding: var(--spacing-md);

/* Bad */
background: #378ADD;
border: 1px solid #ddd;
padding: 15px;
```

### 2. Components from Patterns

Every component is built from an established pattern. New components should extend existing patterns, not invent new ones.

Patterns include:
- Button groups (8px gap, specific weight/color combinations)
- Card headers (badge + title + subtitle, consistent layout)
- Metadata grids (2-column, consistent font sizes and colors)
- Badge styling (inline block, semantic colors, 11px font size)
- Modal structure (header + body + footer, centered overlay)

### 3. Dark Mode is Automatic

All tokens resolve automatically based on `@media (prefers-color-scheme: dark)`. Components don't need dark mode-specific CSS.

### 4. Accessibility by Default

All color choices use 7:1+ contrast ratios. All interactive elements have visible focus indicators. All buttons are semantic `<button>` elements. No `outline: none` without replacement.

### 5. Minimal, Functional Design

No decorative effects (drop shadows, gradients, blur). No gratuitous animation. Every design element serves a purpose: it communicates status, affords an action, or separates information.

---

## Common Pitfalls

1. **Hardcoded colors** — Use `var(--color-*)` tokens, not hex values
2. **Inconsistent spacing** — Use the scale (4, 8, 12, 16, 24, 32, 48px), not arbitrary values
3. **Font weights outside {400, 500}** — Don't use 600, 700, or lighter weights
4. **Borders thicker than 0.5px** — Standard borders are always 0.5px (except 3px accent borders)
5. **Mixing Title Case with sentence case** — All UI text is sentence case
6. **Drop shadows** — Never use decorative shadows (only 3px focus rings)
7. **Over-customized buttons** — Buttons should follow the primary/secondary/danger pattern
8. **Inconsistent card padding** — Always 16px (`var(--spacing-md)`)

---

## Color Coding Quick Reference

### Status Indicators

- **Blue badge** — PENDING, REQUIRES_ACTION, informational
- **Teal badge** — CONFIRMED, APPROVED, SENT_CONFIRMED, success
- **Amber badge** — WARNING, THRESHOLD_ALERT, caution
- **Red badge** — CRITICAL, HARD_LEGAL, escalation, danger

### Card Types

- **Red left border** (3px) — HARD_LEGAL deadline, critical escalation
- **Amber left border** (3px) — Budget alert, warning
- **No left border** — Routine, pending approval, informational
- **Teal left border** (if used) — Confirmed or approved state

---

## Files Provided

| File | Purpose | Audience |
|------|---------|----------|
| **Litt-Brand-Guidelines.md** | Complete brand identity, voice, visual system | Design team, marketing, leadership |
| **Litt-Component-Library.md** | Reusable components with code examples | Frontend developers |
| **Litt-Design-Tokens.md** | CSS variables and design token reference | Frontend developers, designers |
| **Litt-Implementation-Guide.md** | Practical patterns and anti-patterns | Frontend developers |
| **Dashboard Mockup** (interactive) | Live example of the system in action | All stakeholders |
| **Color System Reference** (interactive) | Palette, contrast validation, quick lookup | Designers, developers |

---

## Next Steps

### For Design Team
1. Save these guidelines as the source of truth
2. Review the dashboard mockup with stakeholders
3. Use the component patterns for future mockups
4. Reference the color system for any new designs

### For Engineering Team
1. Implement the design tokens CSS in your build system
2. Use the component library as starting points for UI code
3. Refer to the implementation guide for patterns and pitfalls
4. Test dark mode thoroughly (should work automatically)

### For Product/Leadership
1. Review the brand guidelines to understand Litt's positioning
2. Ensure marketing materials align with the voice and tone
3. Use the dashboard mockup to understand the user experience
4. Share the guidelines with any external partners (vendors, agencies)

---

## Success Metrics

The design system is working when:

- ✅ All UI uses CSS variables (zero hardcoded colors)
- ✅ Components are consistent across all pages
- ✅ Dark mode works without custom overrides
- ✅ Spacing is predictable and follows the scale
- ✅ Contrast meets WCAG AA standard (7:1+)
- ✅ New pages can be built 30% faster than before
- ✅ Design reviews focus on behavior, not visual details
- ✅ No questions about "what blue should this be?"

---

## Questions?

Refer to the specific guideline documents for detailed information:

- **"What color should this component be?"** → Litt-Brand-Guidelines.md, Color System section
- **"How do I build a button?"** → Litt-Component-Library.md, Buttons section
- **"What CSS variable should I use?"** → Litt-Design-Tokens.md, CSS Variable Usage
- **"What's the spacing between these elements?"** → Litt-Design-Tokens.md, Spacing Tokens
- **"How do I avoid common mistakes?"** → Litt-Implementation-Guide.md, Anti-Patterns section

For questions not covered, the answer is almost always: **Look at an existing component and follow its pattern.**

---

*Litt brand and design system. Version 1.0. Complete and ready for implementation.*
