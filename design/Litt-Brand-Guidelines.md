# Litt — Brand Guidelines

**Version:** 1.0  
**Date:** May 30, 2026  
**Audience:** Design, engineering, marketing, and leadership  
**Purpose:** Define Litt's visual identity, brand voice, and design standards

---

## Table of Contents

1. [Brand Philosophy](#brand-philosophy)
2. [Brand Values](#brand-values)
3. [Brand Voice & Tone](#brand-voice--tone)
4. [Visual Identity](#visual-identity)
5. [Color System](#color-system)
6. [Typography](#typography)
7. [Spacing & Layout](#spacing--layout)
8. [Component Library](#component-library)
9. [Dashboard Design Language](#dashboard-design-language)
10. [Usage Examples](#usage-examples)

---

## Brand Philosophy

Litt is an **operational control layer** for small law firms. The brand exists to communicate four things:

1. **Technical rigor** — Litt is built on deterministic logic, not probabilistic guesses. Every action is logged, audited, and defensible.
2. **Legal discipline** — Litt respects the gravity of legal work. It operates within attorney-defined boundaries and never silently takes action.
3. **Human-centered automation** — AI is the engine, but attorneys remain in control. Litt *surfaces* decisions for attorney judgment; it never *makes* them.
4. **Operational calm** — Litt eliminates the friction of constant context-switching. The Daily Closeout Brief is a moment of clarity in a chaotic day.

**Visual expression:** The brand is sophisticated yet approachable, modern yet professional. It borrows from fintech design (Stripe, Linear) in its restraint and confidence, but adds the precision of legal documentation — clean lines, clear hierarchies, and transparency about what's happening behind every interaction.

### Hackathon Demo Positioning

For v1.0, Litt must impress judges quickly without losing legal credibility. The target is **controlled intensity**: calm legal discipline wrapped in a high-impact command-center experience.

The first viewport should make the product legible in 10 seconds:

1. Litt detects operational risk across deadlines, billing, budgets, communications, and anomalies.
2. Litt asks for attorney judgment instead of acting silently.
3. Litt writes every consequential decision to a defensible audit trail.

This product story is mandatory in the primary UI. Do not bury it in onboarding copy or a slide. The Daily Closeout Brief must visibly show the loop as an operating sequence: **find risk -> ask for judgment -> record decision -> prove what happened**. Judges should understand why Litt exists before they understand the law-firm specifics.

The emotional read is not "friendly assistant." It is: **end-of-day operating room for a small law firm.** The UI should feel composed, exact, and slightly dramatic at the moments where the product proves its value.

---

## Brand Values

| Value | How it shows up in design |
|-------|--------------------------|
| **Transparency** | Every element reveals what it does. No mystery. Audit trails visible by default. |
| **Precision** | Exact numbers, clear status indicators, no vague language. Attorneys need certainty. |
| **Calm** | Generous whitespace, deliberate hierarchy, only critical alerts surface. |
| **Trust** | Consistency across all touchpoints. One design language, predictable patterns. |
| **Competence** | Professional execution in every detail. Typography, spacing, color — all intentional. |

---

## Brand Voice & Tone

### Voice: Clear, Authoritative, Precise

Litt speaks like a trusted operations partner — someone who has done this before and knows the legal landscape. The voice is:

- **Professional but not stiff.** No jargon for its own sake, but precise legal/operational terminology where appropriate.
- **Direct and literal.** Avoid metaphor. Say "deadline confirmation" not "deadline checkpoint." Say "flagged for review" not "something caught our eye."
- **Action-oriented.** Verbs are active. Focus on what the attorney *does*, not what Litt *thinks*.

For the hackathon demo, the simplest voice rule is:

> Calm command, not cheerful assistance.

Avoid "I found," "looks like," "maybe," and "here are some things." Prefer "Deadline requires confirmation," "Narrative blocks approval," "Budget threshold crossed," "Action logged," and "Dismissal reason required."

### Tone: Calm, Respectful, Urgent-When-Needed

The tone adapts to context:

- **Daily Closeout Brief** — Calm, summarizing. You've had a long day; here's what you need to know.
- **Alerts and escalations** — Direct and clear. No hedging. "HARD_LEGAL deadline in 6 days" not "we noticed there might be a deadline."
- **Confirmations and feedback** — Reassuring. "Deadline confirmed and logged" (not "hopefully saved").
- **Explanations** — Patient and detailed. If an attorney clicks "why is this flagged?", explain the rule clearly.

### Tone Guide: Five Principles

1. **Certainty over hedging.** Say "billing entry approved" not "appears to be approved."
2. **Specific over vague.** Say "Acme Commercial is at 78% of retainer" not "getting close to budget."
3. **Active over passive.** Say "You need to confirm this deadline" not "confirmation is required."
4. **Respect time.** Labels are short; detail lives in tooltips and side panels.
5. **Mirror legal language.** Use "confirmed," "approved," "logged," "dismissed with reason" — the same language appears in audit records.

---

## Visual Identity

### Logo

The Litt logotype is the wordmark **Litt** in a modified sans-serif typeface (see typography). The letterforms are clean, slightly condensed, with open counters. There is no icon mark; the wordmark alone is sufficient.

**Logotype usage:**
- Minimum 24px height in all applications.
- Always paired with adequate whitespace (at least 12px minimum on all sides).
- Single color in primary context (dark text on light, light text on dark).
- Do not resize, rotate, distort, or apply effects.
- Do not remove the wordmark from the icon (there is no standalone icon).

**Dark and light variants:**
- **Light mode:** `var(--color-text-primary)` (near-black)
- **Dark mode:** `var(--color-background-primary)` (near-white)

### Imagery & Iconography

Litt uses **system icons only** (Tabler outline set). There are no photographic images, illustrations, or bespoke icons.

**Icon usage:**
- 16–20px inline, 24px max for decorative use.
- Always outline style, never filled.
- Inherit color and size from context.
- Use `aria-hidden="true"` for decorative icons; use `aria-label` for icon-only buttons.

**Approved icons:** `ti-home`, `ti-settings`, `ti-user`, `ti-search`, `ti-x`, `ti-check`, `ti-plus`, `ti-trash`, `ti-edit`, `ti-download`, `ti-upload`, `ti-file`, `ti-folder`, `ti-chart-bar`, `ti-calendar`, `ti-clock`, `ti-arrow-right`, `ti-arrow-left`, `ti-chevron-down`, `ti-external-link`, `ti-copy`, `ti-refresh`, `ti-alert-circle`, `ti-circle-check`, `ti-lock`, `ti-bell`, `ti-mail`, `ti-eye`, `ti-menu-2`, `ti-circle-x`.

---

## Color System

### Primary Palette

Litt uses a **reduced, semantic color palette** that emphasizes clarity and legal professionalism.

| Ramp | Use Case | Light (50–400) | Dark (600–900) |
|------|----------|---|---|
| **Blue** (`c-blue`) | Primary action, information, default state | `#E6F1FB` → `#378ADD` | `#185FA5` → `#042C53` |
| **Teal** (`c-teal`) | Confirmed, approved, success | `#E1F5EE` → `#1D9E75` | `#0F6E56` → `#04342C` |
| **Amber** (`c-amber`) | Warning, caution, budget threshold | `#FAEEDA` → `#BA7517` | `#854F0B` → `#412402` |
| **Red** (`c-red`) | Escalation, HARD_LEGAL, critical | `#FCEBEB` → `#E24B4A` | `#A32D2D` → `#501313` |
| **Gray** (`c-gray`) | Neutral, structural, disabled | `#F1EFE8` → `#888780` | `#5F5E5A` → `#2C2C2A` |

### Semantic Color Assignments

**Status indicators:**
- **Blue (primary):** Pending, neutral state, requires action, informational
- **Teal (approved):** Confirmed, logged, approved, SENT_CONFIRMED
- **Amber (warning):** Approaching threshold, SOFT escalation, needs attention
- **Red (alert):** HARD_LEGAL escalation, critical, malpractice-risk deadline
- **Gray (neutral):** Dismissed, archived, non-actionable, structural

**Background and surface colors:**
- Primary background: `var(--color-background-primary)` (white in light mode, near-black in dark)
- Secondary surface: `var(--color-background-secondary)` (metric card fills)
- Tertiary background: `var(--color-background-tertiary)` (page background, lowest emphasis)

### Usage Rules

1. **Status indicators always come first.** A billing entry that is "approved and flagged for pre-bill review" uses the approval status (teal), not the review status (amber).
2. **Warm colors (amber, red) demand attention.** Use sparingly. Most of the dashboard should be blue or gray.
3. **Never use color alone.** Pair it with semantic language: "Approved (teal)" not just teal.
4. **Sufficient contrast.** All text on colored backgrounds uses the 800/900 stop from the same ramp (dark mode uses 100/200).
5. **Light mode neutral:** On white backgrounds, use ramp stops 50–400. On colored backgrounds, use stops 600–900.
6. **Dark mode neutral:** On near-black backgrounds, use ramp stops 600–900. On colored fills, use 100–200.

---

## Typography

### Font Stack

**Primary font:** Anthropic Sans (system default for all body, headings, and UI labels)  
**Fallback:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`

No serif fonts. No font-weight above 500 (bold). One weight is 400 (regular), one is 500 (bold).

### Type Scale

| Role | Size | Weight | Line height | Usage |
|------|------|--------|-------------|-------|
| **Heading 1** | 24px | 500 | 1.2 | Page title, modal header |
| **Heading 2** | 18px | 500 | 1.3 | Section title, card title |
| **Heading 3** | 16px | 500 | 1.4 | Subsection, label |
| **Body** | 16px | 400 | 1.6 | Paragraph text |
| **Label** | 14px | 400 | 1.5 | Form label, button text, list item |
| **Caption** | 12px | 400 | 1.5 | Secondary text, timestamp, help text |
| **Monospace** | 13px | 400 | 1.4 | Code, IDs, structured data |

### Text Hierarchy Rules

1. **Title + subtitle.** Page title (24px/500) sits above a shorter descriptor (14px/400 secondary color).
2. **Card structure.** Card title (16px/500) → data rows (14px/400).
3. **Emphasis within body text.** Use 500 weight sparingly. Never ALL CAPS. Never underline for emphasis (reserved for links).
4. **Sentence case always.** Button text, labels, headings — all sentence case. "Confirm deadline" not "Confirm Deadline."
5. **No orphaned text.** Every text block has a clear context: a label above it, a card containing it, or a section heading preceding it.

---

## Spacing & Layout

### Spacing Scale

All spacing uses a consistent rem-based scale:

| Scale | Pixels | Usage |
|-------|--------|-------|
| **2xs** | 4px | Micro adjustments inside components |
| **xs** | 8px | Tight grouping (e.g., icon + label) |
| **sm** | 12px | Standard gap between elements |
| **md** | 16px | Standard padding inside cards |
| **lg** | 24px | Larger gaps, breathing room |
| **xl** | 32px | Section separation |
| **2xl** | 48px | Major section breaks |

### Gutters and Margins

- **Page margins (desktop):** 40px left/right minimum. Content area 680px max width, centered.
- **Card padding:** 16px top/bottom, 20px left/right minimum.
- **List item spacing:** 12px between items.
- **Section spacing:** 24px between major sections.

### Grid System

Dashboard layout uses CSS Grid:
- **Breakpoint:** Single column on mobile (< 768px), two-column on tablet+ (768px+)
- **Column gap:** 16px
- **Row gap:** 16px
- **Metric card grid:** `repeat(auto-fit, minmax(200px, 1fr))` — 2–3 cards per row depending on viewport

---

## Component Library

### Buttons

**Primary button (call to action):**
- Background: `var(--color-background-info)` (blue)
- Text: `var(--color-text-info)` (white/light)
- Padding: 10px 20px
- Border-radius: `var(--border-radius-md)` (8px)
- Font: 14px/500
- On hover: Darken background by one stop, scale(1.02)
- On active: scale(0.98)

**Secondary button (lower priority):**
- Background: `var(--color-background-secondary)` (light gray)
- Text: `var(--color-text-primary)` (dark)
- Border: 0.5px solid `var(--color-border-secondary)`
- Padding: 10px 20px
- Border-radius: `var(--border-radius-md)`
- Font: 14px/400
- On hover: Background lightens, border darkens

**Danger button (destructive action):**
- Background: transparent
- Text: `var(--color-text-danger)` (red)
- Border: 0.5px solid `var(--color-border-danger)`
- On hover: Background becomes light red, border darkens

**Button state rules:**
- Disabled: opacity 0.5, cursor not-allowed
- Loading: show spinner icon, disable click
- Focus: 2px solid `var(--color-border-info)` outline, 4px offset

### Form Elements

**Input fields:**
- Height: 36px
- Padding: 8px 12px
- Border: 0.5px solid `var(--color-border-tertiary)`
- Border-radius: `var(--border-radius-md)`
- Font: 14px/400
- On focus: Border color → info, shadow 0 0 0 3px info@20%
- Placeholder text: `var(--color-text-tertiary)`

**Select/dropdown:**
- Same styling as input
- Icon: Tabler `ti-chevron-down` on right, 16px, gray

**Checkbox & radio:**
- Standard browser rendering, no styling override
- Label sits to the right, 8px gap, clickable

**Textarea:**
- Min height: 80px
- Same border/focus treatment as input
- Resize handle: allowed bottom-right

### Cards

**Standard card (raised):**
- Background: `var(--color-background-primary)` (white)
- Border: 0.5px solid `var(--color-border-tertiary)`
- Padding: 16px
- Border-radius: `var(--border-radius-lg)` (12px)
- Box-shadow: none
- On hover: Border color → secondary (subtle emphasis)

**Metric card (summary stat):**
- Background: `var(--color-background-secondary)`
- Border: none
- Padding: 16px
- Border-radius: `var(--border-radius-md)`
- Label text: 12px/400 secondary color
- Stat number: 24px/500 primary color
- Optional: Icon in top-right, 24px, muted color

**Alert/banner card:**
- Colored background (info/warning/danger)
- Colored border on left (2px)
- Icon on left (20px)
- Text on right (padding 12px)
- Close button top-right (if dismissible)

### Badges & Pills

**Badge (small inline status):**
- Padding: 4px 12px
- Border-radius: `var(--border-radius-md)`
- Font: 12px/500
- Background + text: semantic ramp (e.g., teal fill + teal 800 text)
- Usage: status labels, category tags

**Pill (larger, rounded):**
- Padding: 6px 16px
- Border-radius: 20px (full border-radius)
- Font: 13px/500
- Usage: filter tags, select pills

### Badges for Escalation Severity

- **Critical (red badge):** HARD_LEGAL deadline ≤7 days
- **High (amber badge):** Budget at 85%+ or approaching hard deadline
- **Medium (blue badge):** Soft escalation, routine attention needed
- **Low (gray badge):** Informational, no immediate action

### Tables

**Table styling:**
- Header row: `var(--color-background-secondary)`, 14px/500 text
- Data rows: alternating white / very-light-gray (optional)
- Border: 0.5px solid `var(--color-border-tertiary)` around entire table and between rows
- Padding: 8px 12px per cell
- Sortable columns: header text + `ti-arrow-up` / `ti-arrow-down` indicator
- Links in tables: underline on hover

### Modals

**Modal container:**
- Overlay: `rgba(0,0,0,0.45)` semi-transparent backdrop
- Card: `var(--color-background-primary)`, centered on screen
- Border-radius: `var(--border-radius-lg)`
- Max width: 540px
- Padding: 24px

**Modal structure:**
- Header: 18px/500 title, close button top-right
- Body: 14px/400 text, spacing 16px
- Footer: Action buttons (right-aligned), 12px gap

---

## Dashboard Design Language

### Daily Closeout Brief Structure

The Daily Closeout Brief is Litt's core ritual. Its design reflects its purpose: **clear, scannable, actionable, calm.**

**Layout pattern:**
1. **Header:** "Daily Closeout — [date]" with time of day (e.g., "4:30 PM")
2. **Executive summary:** 2–3 lines. Number of items, critical escalations count, progress toward close.
3. **Sections (in priority order):**
   - **Escalations (HARD_LEGAL):** Red cards, one per escalation, confirmation button
   - **Budget alerts:** Amber cards for threshold crossings
   - **Work in progress:** Blue cards for unapproved billing entries
   - **Client silence alerts:** Blue cards with draft communication
   - **Routine confirmations:** Gray cards, low priority, bulk-dismissible

4. **Footer:** "Brief generated at [timestamp]" and link to full dashboard

**Hackathon v1.0 structure override:**
- **Command header:** Firm, attorney, generated time, and demo mode must be visible immediately.
- **Operational triage strip:** Show critical count, billing blocks, WIP dollars, client silence, and audit-ready status above the card list.
- **Decision timeline:** Present cards as a prioritized sequence of attorney decisions, not as a generic dashboard feed.
- **Session audit trail:** Resolved items should visibly append to a session activity tray so judges see the defensibility loop.

Each card is a **decision packet**. It answers, in order: status, what happened, why it matters, evidence/source, requested attorney action, and what will be logged.

**Card anatomy (escalation example):**
```
[RED BADGE: HARD_LEGAL] | Mercer Industries — Statute of limitations motion response
────────────────────────────────────────────────────────────────
Days until deadline:     6 days
Calendar source:         Motion order, April 29 email
Status:                  Unconfirmed
────────────────────────────────────────────────────────────────
[CONFIRM DEADLINE] [SEE FULL RECORD]
```

**Principles:**
- One action per card when possible (confirm, approve, draft approval).
- Buttons sit at the bottom, right-aligned.
- Status badges go top-left; severity color dominates.
- Key facts sit in the middle in a clean 2-column layout.
- Timestamps always included; sources included for escalations.

### Dashboard Panels

The full Litt dashboard is organized into panels, each corresponding to a sub-agent's domain:

1. **Deadline Monitor** (blue)
   - All deadline candidates, confirmed vs. unconfirmed
   - Filterable by severity, days remaining, matter
   - Single-click confirmation, bulk actions

2. **Billing Review** (blue)
   - Time entries pending approval
   - Pre-bill scrubber flags visible inline
   - Side panel for narrative editing and approval

3. **Budget Tracking** (amber)
   - Per-client/matter budget utilization chart
   - Threshold alerts, forecast to month-end
   - Approval workflow for budget overruns

4. **Client Comms** (teal)
   - Drafted status communications
   - Source-backed (sentences linked to supporting data)
   - Approval workflow, sent log with confirmations

5. **Anomaly Review** (red/amber)
   - Flagged billing anomalies
   - Duplicate detection, vague narrative detection
   - Dismissal workflow with reason required

6. **Settings** (gray)
   - Attorney preferences, firm configuration
   - Integration status (Calendar, Gmail)
   - Audit log viewer

### Information Architecture

```
Litt Dashboard (home)
├── Daily Closeout Brief (email widget, dashboard summary)
├── Deadlines
│   ├── All candidates (list view)
│   ├── My matters (filtered)
│   └── Confirmed (reference)
├── Billing
│   ├── Work in progress (approval queue)
│   ├── Pre-bill review (scrubber results)
│   └── Approved entries (reference)
├── Budget
│   ├── By client
│   ├── By matter
│   └── Month-end forecast
├── Client comms
│   ├── Draft queue (requires approval)
│   ├── Sent (log with confirmations)
│   └── Templates
├── Anomalies
│   ├── Billing (duplicates, vague narratives, etc.)
│   ├── Operational (unusual patterns)
│   └── Dismissed (archive)
└── Settings
    ├── My preferences
    ├── Firm config
    ├── Integrations
    └── Audit log
```

---

## Usage Examples

### Example 1: Deadline Escalation Card

A HARD_LEGAL deadline (statute of limitations motion due in 6 days):

```
┌─────────────────────────────────────────────────────┐
│ [CRITICAL: HARD_LEGAL]  Mercer Industries            │
│─────────────────────────────────────────────────────│
│ Matter:                 Mercer v. Capital Corp       │
│ Deadline:               June 4, 2026 (6 days)       │
│ Source:                 Motion order (April 29)     │
│ Jurisdiction:           Federal (SDNY)              │
│ Status:                 Unconfirmed                 │
│─────────────────────────────────────────────────────│
│ [CONFIRM DEADLINE]         [SEE FULL RECORD]       │
└─────────────────────────────────────────────────────┘
```

**Color:** Red background (c-red 50), red 800 text.  
**Typography:** Title 16px/500, metadata 14px/400.  
**Spacing:** 16px padding, 8px between rows.

### Example 2: Metric Card (Budget Status)

```
┌──────────────────┐
│ Acme Commercial  │
│ 78% of retainer  │
│                  │
│ $78,000 / $100K  │
└──────────────────┘
```

**Color:** Background secondary gray, text primary color.  
**Typography:** Label 12px/400 secondary, value 20px/500 primary.  
**Size:** ~160px wide, fits 3–4 per row on desktop.

### Example 3: Work-in-Progress Table

```
Matter            | Hours | Narrative     | Status   | Action
────────────────────────────────────────────────────────────────
Acme (te-005)     | 3.2h  | [incomplete]  | PENDING  | [EDIT] [APPROVE]
Mercer (te-001)   | 2.0h  | [incomplete]  | PENDING  | [EDIT] [APPROVE]
Reyes (te-003)    | 1.5h  | ✓             | PENDING  | [APPROVE]
```

**Color coding:**
- `[incomplete]` tag: red badge
- Status badge: blue (PENDING) or teal (APPROVED)
- Buttons: primary blue on hover

---

## Dark Mode

All colors, spacing, and typography work identically in dark mode. CSS variables handle the theme switch automatically:

- Backgrounds invert: white → near-black
- Text inverts: dark → light
- Ramps shift to dark-mode stops (600–900 instead of 50–400)
- Accent colors remain intentional and semantic

No separate designs are required. The system is built on CSS variables that respect `@media (prefers-color-scheme: dark)`.

---

## Accessibility

All design decisions follow WCAG 2.1 AA standards:

1. **Color contrast.** Text on colored backgrounds always uses stops 800/900 (light) or 100/200 (dark), ensuring 7:1+ contrast.
2. **Focus indicators.** Interactive elements have visible 2px focus outlines with at least 4px offset.
3. **Icon labels.** Icon-only buttons carry `aria-label`. Decorative icons use `aria-hidden="true"`.
4. **Semantic HTML.** Buttons are `<button>`, links are `<a>`, form fields are `<input>`/`<select>` with associated `<label>`.
5. **Keyboard navigation.** All interactive elements are reachable and usable via keyboard (Tab, Enter, Space, arrow keys).
6. **Screen reader support.** Headings, landmarks, and form labels provide structure. Alt text / aria-label on images and icons.

---

*End of brand guidelines. For questions or contributions, contact the design team.*
