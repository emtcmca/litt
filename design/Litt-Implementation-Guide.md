# Litt — Implementation Guide for Developers

**Version:** 1.0  
**Date:** May 30, 2026  
**Audience:** Frontend engineers building Litt components and pages  
**Purpose:** Practical patterns, code examples, and anti-patterns to avoid

---

## Quick Start

### Hackathon UI Target

Build the v1.0 interface as a judge-facing command surface, not a generic admin dashboard. The main flow should be visible without explanation:

1. Litt surfaces operational risk.
2. The attorney makes a controlled decision.
3. Litt writes a defensible audit event.

Every Daily Closeout component should reinforce that loop through hierarchy, copy, or the audit reveal.

### 1. Import the Design System

All Litt projects should include the design tokens CSS file at the top of their stylesheet:

```html
<link rel="stylesheet" href="/styles/design-tokens.css">
```

Or import in your CSS:

```css
@import url('/styles/design-tokens.css');
```

### 2. Always Use CSS Variables

❌ **Don't:**
```css
button {
  background: #378ADD;
  color: white;
  border: 1px solid #ccc;
}
```

✅ **Do:**
```css
button {
  background: var(--color-background-info);
  color: var(--color-text-info);
  border: 0.5px solid var(--color-border-secondary);
}
```

### 3. Build Components from Patterns

Every component should follow an established pattern. Use the component library as your reference:

1. Check the component library for a similar pattern
2. Adapt the pattern to your specific context
3. Never invent new spacing, colors, or sizes

---

## Common Components

### Button Group

Multiple buttons on a card should follow this pattern:

```html
<div style="display: flex; gap: 8px; margin-top: 12px;">
  <button style="
    background: var(--color-background-info);
    color: var(--color-text-info);
    padding: 8px 14px;
    border: none;
    border-radius: var(--border-radius-md);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  ">Primary action</button>
  <button style="
    background: transparent;
    color: var(--color-text-primary);
    border: 0.5px solid var(--color-border-secondary);
    padding: 8px 14px;
    border-radius: var(--border-radius-md);
    font-size: 13px;
    cursor: pointer;
  ">Secondary</button>
</div>
```

**Key rules:**
- Primary (CTA) button gets `var(--color-action-primary)` background
- Secondary button gets transparent + border
- Gap between buttons is always 8px
- Buttons are 36-40px tall (padding provides height)

### Status Badge

For inline status labels:

```html
<span style="
  display: inline-block;
  background: var(--color-ramp-blue-50);
  color: var(--color-ramp-blue-900);
  padding: 4px 10px;
  border-radius: var(--border-radius-md);
  font-size: 11px;
  font-weight: 500;
  margin-right: 8px;
">PENDING</span>
```

**Color mapping for badges:**
- Blue: `PENDING`, `REQUIRES_ACTION`
- Teal: `CONFIRMED`, `APPROVED`, `SENT`
- Amber: `WARNING`, `THRESHOLD_ALERT`
- Red: `CRITICAL`, `HARD_LEGAL`

### Card Header

Every card should have a consistent header pattern:

```html
<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
  <div>
    <span style="...">BADGE</span>
    <h3 style="
      font-size: 15px;
      font-weight: 500;
      margin: 0;
      margin-top: 4px;
      color: var(--color-text-primary);
    ">Title</h3>
    <p style="
      font-size: 12px;
      color: var(--color-text-secondary);
      margin: 2px 0 0;
    ">Subtitle</p>
  </div>
  <div style="text-align: right; font-size: 18px; font-weight: 500;">
    6d
  </div>
</div>
```

**Pattern:**
- Badge on the left (if applicable)
- Title and subtitle stack below badge
- Right-side content is right-aligned
- Title is 15px/500, subtitle is 12px/400

### Metadata Grid

For displaying key-value pairs:

```html
<div style="
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  font-size: 13px;
  padding: 12px 0;
  border-top: 0.5px solid var(--color-border-tertiary);
  border-bottom: 0.5px solid var(--color-border-tertiary);
">
  <div style="display: flex; justify-content: space-between;">
    <span style="color: var(--color-text-secondary);">Rate:</span>
    <span style="font-weight: 500;">$350/hr</span>
  </div>
  <div style="display: flex; justify-content: space-between;">
    <span style="color: var(--color-text-secondary);">Amount:</span>
    <span style="font-weight: 500;">$1,120</span>
  </div>
</div>
```

**Pattern:**
- Two-column grid for dense information
- 12px gap between columns
- Labels are `text-secondary`, values are `text-primary` + bold
- Borders top and bottom separate from adjacent content

---

## Anti-Patterns & What to Avoid

### ❌ Don't Make the Demo Too Quiet

```html
<!-- WRONG -->
<div>5 items pending</div>
```

```html
<!-- RIGHT -->
<section>
  <strong>1 critical risk</strong>
  <span>5 attorney decisions pending</span>
  <span>Audit-ready</span>
</section>
```

Calm does not mean flat. Critical decisions, audit logging, and the Daily Closeout ritual need visible hierarchy.

### ❌ Don't Use Hardcoded Colors

```css
/* WRONG */
.card {
  background: #fff;
  color: #333;
  border: 1px solid #ddd;
}
```

```css
/* RIGHT */
.card {
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  border: 0.5px solid var(--color-border-tertiary);
}
```

### ❌ Don't Mix Border Widths

```css
/* WRONG */
.card {
  border: 1px solid var(--color-border-tertiary);  /* Inconsistent thickness */
}

.button {
  border: 2px solid var(--color-border-secondary);  /* Too thick */
}
```

```css
/* RIGHT */
.card {
  border: 0.5px solid var(--color-border-tertiary);
}

.button {
  border: 0.5px solid var(--color-border-secondary);
}

.card-accent {
  border: 0.5px solid var(--color-border-tertiary);
  border-left: 3px solid var(--color-border-danger);  /* Accent only on one side */
}
```

### ❌ Don't Invent Spacing Values

```css
/* WRONG */
.section {
  margin-bottom: 18px;  /* Not on the scale */
  padding: 15px;        /* Not on the scale */
}
```

```css
/* RIGHT */
.section {
  margin-bottom: var(--spacing-lg);  /* 24px from the scale */
  padding: var(--spacing-md);         /* 16px from the scale */
}
```

### ❌ Don't Use Font Weights > 500

```css
/* WRONG */
h1 {
  font-weight: 700;  /* Too heavy */
}

strong {
  font-weight: 600;  /* Not available */
}
```

```css
/* RIGHT */
h1 {
  font-weight: 500;  /* Bold is enough */
}

strong {
  font-weight: 500;
}
```

### ❌ Don't Add Drop Shadows

```css
/* WRONG */
.card {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);  /* Decorative, avoid */
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
}
```

```css
/* RIGHT */
.card {
  border: 0.5px solid var(--color-border-tertiary);  /* Minimal, crisp */
}

.card:focus-within {
  box-shadow: 0 0 0 3px rgba(55, 138, 221, 0.2);  /* Focus only */
}
```

### ❌ Don't Mix Radius Sizes

```css
/* WRONG */
.button {
  border-radius: 4px;   /* Too small */
}

.card {
  border-radius: 16px;  /* Too large for this context */
}

.badge {
  border-radius: 6px;   /* Arbitrary */
}
```

```css
/* RIGHT */
.button {
  border-radius: var(--border-radius-md);  /* 8px */
}

.card {
  border-radius: var(--border-radius-lg);  /* 12px */
}

.badge {
  border-radius: var(--border-radius-md);  /* 8px */
}

.pill {
  border-radius: 50%;  /* Fully rounded, deliberate use */
}
```

### ❌ Don't Use Title Case in UI

```html
<!-- WRONG -->
<h1>Daily Closeout Brief</h1>
<button>Confirm Deadline</button>
<span>Work In Progress</span>
```

```html
<!-- RIGHT -->
<h1>Daily closeout brief</h1>
<button>Confirm deadline</button>
<span>Work in progress</span>
```

### ❌ Don't Mix Text Emphasis Methods

```html
<!-- WRONG -->
<p>Important: <strong>This is bold</strong> but also <u>underlined</u> and <span style="color: red;">red</span>.</p>
```

```html
<!-- RIGHT -->
<p>Important: <span style="font-weight: 500;">This is bold</span>. This is normal text.</p>
```

(Only use weight for emphasis, never color changes within paragraphs.)

---

## Real-World Examples

### Example 1: Deadline Escalation Card

```html
<div style="
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  border-left: 3px solid var(--color-border-danger);
  border-radius: var(--border-radius-lg);
  padding: 16px;
">
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
    <div>
      <span style="
        display: inline-block;
        background: #FCEBEB;
        color: #501313;
        padding: 4px 10px;
        border-radius: var(--border-radius-md);
        font-size: 11px;
        font-weight: 500;
        margin-right: 8px;
      ">CRITICAL: HARD_LEGAL</span>
      <h3 style="
        font-size: 15px;
        font-weight: 500;
        margin: 0;
        margin-top: 4px;
        color: var(--color-text-primary);
      ">Mercer Industries</h3>
      <p style="
        font-size: 12px;
        color: var(--color-text-secondary);
        margin: 2px 0 0;
      ">Statute of limitations motion response</p>
    </div>
    <div style="text-align: right; font-size: 24px; font-weight: 500; color: #E24B4A;">6d</div>
  </div>

  <!-- Metadata -->
  <div style="
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    font-size: 13px;
    padding: 12px 0;
    border-top: 0.5px solid var(--color-border-tertiary);
    border-bottom: 0.5px solid var(--color-border-tertiary);
  ">
    <div style="display: flex; justify-content: space-between;">
      <span style="color: var(--color-text-secondary);">Matter:</span>
      <span style="font-weight: 500;">Mercer v. Capital Corp</span>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <span style="color: var(--color-text-secondary);">Source:</span>
      <span style="font-weight: 500;">Motion order, April 29</span>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <span style="color: var(--color-text-secondary);">Jurisdiction:</span>
      <span style="font-weight: 500;">Federal (SDNY)</span>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <span style="color: var(--color-text-secondary);">Status:</span>
      <span style="font-weight: 500;">Unconfirmed</span>
    </div>
  </div>

  <!-- Actions -->
  <div style="display: flex; gap: 8px; margin-top: 12px;">
    <button style="
      background: var(--color-background-info);
      color: var(--color-text-info);
      padding: 8px 14px;
      border: none;
      border-radius: var(--border-radius-md);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    ">Confirm deadline</button>
    <button style="
      background: transparent;
      color: var(--color-text-primary);
      border: 0.5px solid var(--color-border-secondary);
      padding: 8px 14px;
      border-radius: var(--border-radius-md);
      font-size: 13px;
      cursor: pointer;
    ">Full record</button>
  </div>
</div>
```

### Example 2: Work-in-Progress Billing Entry

```html
<div style="
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-lg);
  padding: 16px;
">
  <!-- Header with flag -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
    <div>
      <span style="
        display: inline-block;
        background: var(--color-ramp-blue-50);
        color: var(--color-ramp-blue-900);
        padding: 4px 10px;
        border-radius: var(--border-radius-md);
        font-size: 11px;
        font-weight: 500;
        margin-right: 8px;
      ">PENDING</span>
      <h3 style="
        font-size: 15px;
        font-weight: 500;
        margin: 0;
        margin-top: 4px;
      ">Acme Commercial (te-005)</h3>
      <p style="
        font-size: 12px;
        color: var(--color-text-secondary);
        margin: 2px 0 0;
      ">3.2 hours — Review documents</p>
    </div>
    <div style="text-align: right; font-size: 13px; color: #E24B4A;">Flag: vague narrative</div>
  </div>

  <!-- Metadata grid -->
  <div style="
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    font-size: 13px;
    padding: 12px 0;
    border-top: 0.5px solid var(--color-border-tertiary);
    border-bottom: 0.5px solid var(--color-border-tertiary);
  ">
    <div style="display: flex; justify-content: space-between;">
      <span style="color: var(--color-text-secondary);">Rate:</span>
      <span style="font-weight: 500;">$350/hr</span>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <span style="color: var(--color-text-secondary);">Amount:</span>
      <span style="font-weight: 500;">$1,120</span>
    </div>
  </div>

  <!-- Actions -->
  <div style="display: flex; gap: 8px; margin-top: 12px;">
    <button style="
      background: var(--color-background-info);
      color: var(--color-text-info);
      padding: 8px 14px;
      border: none;
      border-radius: var(--border-radius-md);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    ">Approve</button>
    <button style="
      background: transparent;
      color: var(--color-text-primary);
      border: 0.5px solid var(--color-border-secondary);
      padding: 8px 14px;
      border-radius: var(--border-radius-md);
      font-size: 13px;
      cursor: pointer;
    ">Edit narrative</button>
  </div>
</div>
```

### Example 3: Metric Card Grid

```html
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
  <div style="
    background: var(--color-background-secondary);
    padding: 14px;
    border-radius: var(--border-radius-md);
    text-align: center;
  ">
    <div style="
      font-size: 12px;
      color: var(--color-text-secondary);
      margin-bottom: 4px;
    ">Entries approved</div>
    <div style="
      font-size: 20px;
      font-weight: 500;
      color: var(--color-text-primary);
    ">4</div>
    <div style="
      font-size: 11px;
      color: var(--color-text-secondary);
      margin-top: 2px;
    ">of 6 pending</div>
  </div>

  <!-- Repeat for other metrics -->
</div>
```

---

## Testing Checklist

Before shipping any component:

- [ ] All text uses CSS variables (no hardcoded hex colors)
- [ ] Contrast is 7:1+ (test with WebAIM checker)
- [ ] Focus states are visible (outlines, not invisible)
- [ ] Spacing uses the scale (4px, 8px, 12px, 16px, 24px, 32px, 48px)
- [ ] Border radius matches the system (8px, 12px, or 50%)
- [ ] Font weights are 400 or 500 only
- [ ] Text is sentence case (not Title Case)
- [ ] Button styles follow the pattern (primary, secondary, danger)
- [ ] Card padding is 16px (or `var(--spacing-md)`)
- [ ] Colors match the semantic ramp (blue, teal, amber, red, gray)
- [ ] No drop shadows (except focus rings)
- [ ] Dark mode works (test with `prefers-color-scheme: dark`)
- [ ] Keyboard navigation works (Tab, Enter, Space, arrow keys)

---

## Debugging Common Issues

### Colors look wrong in dark mode

**Cause:** Hardcoded hex colors or manual rgba() values.  
**Fix:** Use `var(--color-*)` tokens exclusively.

### Buttons look misaligned

**Cause:** Padding is inconsistent or height is set explicitly.  
**Fix:** Use padding for height (8px + 14px), not `height: 40px`.

### Cards look heavy or floaty

**Cause:** Using drop shadows or exaggerated borders.  
**Fix:** Use `0.5px solid var(--color-border-tertiary)` only.

### Text is hard to read

**Cause:** Font weight too light or color contrast too low.  
**Fix:** Use `font-weight: 500` for emphasis, 400 for body. Always use semantic text color tokens.

### Spacing looks inconsistent

**Cause:** Using arbitrary px values.  
**Fix:** Use the spacing scale (4px, 8px, 12px, 16px, 24px, 32px, 48px) for all gaps and padding.

---

*End of implementation guide. For questions or patterns not covered here, ask in the design review.*
