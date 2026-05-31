# Litt — Component Library & Implementation Guide

**Version:** 1.0  
**Date:** May 30, 2026  
**Purpose:** Provides developers and designers with reusable components, patterns, and code examples

---

## Overview

All Litt components follow a single design philosophy: **clarity through constraint**. Every component has a single, well-defined purpose. Components are semantic (a button looks like a button), efficient (no decoration), and accessible (keyboard and screen reader compatible).

For the v1.0 hackathon demo, components should create a memorable proof loop: **risk surfaced -> attorney decision -> audit event written**. The UI remains restrained, but critical cards, primary actions, and the audit confirmation drawer may carry more visual weight than ordinary legal SaaS screens.

The product story is a first-class component, not a marketing aside. The Daily Closeout Brief should include a prominent four-step panel: **find risk -> ask for judgment -> record decision -> prove what happened**. Pair it with a visible Closeout Brief timeline and a session audit log so judges can follow the platform's purpose before opening a modal.

This guide includes HTML/CSS code examples for every component. Use these as starting points; adapt them to your specific context while maintaining the established spacing, typography, and color rules.

---

## Table of Contents

1. [Buttons](#buttons)
2. [Forms](#forms)
3. [Cards](#cards)
4. [Alerts & Badges](#alerts--badges)
5. [Tables](#tables)
6. [Modals](#modals)
7. [Navigation](#navigation)
8. [Layout Patterns](#layout-patterns)

---

## Buttons

All buttons use semantic HTML (`<button>` elements) and inherit font from the parent context.

### Primary Button

Call-to-action button. Use for the main action a user should take on a page or card.

```html
<button style="
  background: var(--color-action-primary);
  color: var(--color-action-primary-text);
  padding: 10px 20px;
  border: none;
  border-radius: var(--border-radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
"
  onmouseover="this.style.background='#185FA5'"
  onmouseout="this.style.background='var(--color-background-info)'"
  onmousedown="this.style.transform='scale(0.98)'"
  onmouseup="this.style.transform='scale(1)'"
>
  Confirm deadline
</button>
```

**Behavior:**
- Hover: Darken to next ramp stop (blue 600)
- Active: `scale(0.98)` feedback
- Disabled: `opacity: 0.5`, `cursor: not-allowed`
- Focus: `outline: 2px solid var(--color-border-info); outline-offset: 4px`

### Secondary Button

Lower-priority actions. Default for most clickable elements.

```html
<button style="
  background: transparent;
  color: var(--color-text-primary);
  padding: 10px 20px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
"
  onmouseover="this.style.backgroundColor='var(--color-background-secondary)'"
  onmouseout="this.style.backgroundColor='transparent'"
>
  See full record
</button>
```

### Danger Button

Destructive actions (dismiss, delete, etc.). Low visual weight.

```html
<button style="
  background: transparent;
  color: var(--color-text-danger);
  padding: 10px 20px;
  border: 0.5px solid var(--color-border-danger);
  border-radius: var(--border-radius-md);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
"
  onmouseover="this.style.backgroundColor='var(--color-background-danger)'; this.style.opacity='0.8'"
  onmouseout="this.style.backgroundColor='transparent'; this.style.opacity='1'"
>
  Dismiss
</button>
```

### Button Group

Multiple buttons on a single card should sit in a flexbox with 8px gap.

```html
<div style="display: flex; gap: 8px;">
  <button>Primary action</button>
  <button>Secondary action</button>
  <button style="color: var(--color-text-danger); border-color: var(--color-border-danger);">Danger</button>
</div>
```

---

## Forms

### Text Input

Standard 36px height with semantic styling.

```html
<input
  type="text"
  placeholder="Plaintiff name"
  style="
    width: 100%;
    padding: 8px 12px;
    font-size: 14px;
    border: 0.5px solid var(--color-border-tertiary);
    border-radius: var(--border-radius-md);
    height: 36px;
    transition: border-color 0.2s, box-shadow 0.2s;
  "
  onfocus="this.style.borderColor='var(--color-border-info)'; this.style.boxShadow='0 0 0 3px rgba(55, 138, 221, 0.2)'"
  onblur="this.style.borderColor='var(--color-border-tertiary)'; this.style.boxShadow='none'"
/>
```

**Focus state:** Blue border + light blue shadow ring  
**Placeholder color:** `var(--color-text-tertiary)`  
**Error state:** Red border (`var(--color-border-danger)`)

### Textarea

Multi-line text input with minimum height.

```html
<textarea
  style="
    width: 100%;
    padding: 12px;
    font-size: 14px;
    border: 0.5px solid var(--color-border-tertiary);
    border-radius: var(--border-radius-md);
    min-height: 120px;
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    transition: border-color 0.2s;
  "
  placeholder="Add notes or explanation..."
  onfocus="this.style.borderColor='var(--color-border-info)'"
  onblur="this.style.borderColor='var(--color-border-tertiary)'"
></textarea>
```

### Select Dropdown

```html
<select
  style="
    width: 100%;
    padding: 8px 12px;
    font-size: 14px;
    border: 0.5px solid var(--color-border-tertiary);
    border-radius: var(--border-radius-md);
    height: 36px;
    background: var(--color-background-primary);
    color: var(--color-text-primary);
    cursor: pointer;
    appearance: none;
    background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 16 16%22><path fill=%22%23444%22 d=%22M4 6l4 4 4-4%22/></svg>');
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 32px;
  "
>
  <option>Select status</option>
  <option>Pending</option>
  <option>Approved</option>
  <option>Rejected</option>
</select>
```

### Checkbox

```html
<label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px;">
  <input type="checkbox" />
  <span>I confirm this entry is accurate</span>
</label>
```

### Form Wrapper

Group related fields with consistent spacing.

```html
<form style="display: flex; flex-direction: column; gap: 16px;">
  <div style="display: flex; flex-direction: column; gap: 6px;">
    <label style="font-size: 14px; font-weight: 500; color: var(--color-text-primary);">Matter name</label>
    <input type="text" placeholder="e.g., Acme Commercial — NDA dispute" />
  </div>
  <div style="display: flex; flex-direction: column; gap: 6px;">
    <label style="font-size: 14px; font-weight: 500; color: var(--color-text-primary);">Client</label>
    <select></select>
  </div>
  <button style="width: 100%; background: var(--color-background-info); color: white; border: none; padding: 12px; border-radius: var(--border-radius-md); font-weight: 500; cursor: pointer;">Save</button>
</form>
```

---

## Cards

### Decision Packet Card

The Daily Closeout Brief uses decision packet cards instead of generic dashboard cards. Each packet must show:

1. **Status:** Badge and severity accent.
2. **What happened:** Plain-language event or issue.
3. **Why it matters:** Short operational/legal consequence.
4. **Evidence/source:** Matter, client, date, source excerpt, or system rule.
5. **Attorney action:** One primary action, with secondary/danger actions de-emphasized.
6. **Audit promise:** Copy such as "Action will be logged" in modal or drawer context.

Use this pattern for deadlines, billing blocks, budget alerts, client silence, and anomalies.

### Standard Card (Raised)

Used for bounded UI objects — deadlines, billing entries, client records.

```html
<div style="
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-lg);
  padding: 16px;
  transition: border-color 0.2s;
"
  onmouseover="this.style.borderColor='var(--color-border-secondary)'"
  onmouseout="this.style.borderColor='var(--color-border-tertiary)'"
>
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
    <div>
      <span style="display: inline-block; background: #E6F1FB; color: #042C53; padding: 4px 10px; border-radius: var(--border-radius-md); font-size: 11px; font-weight: 500; margin-right: 8px;">PENDING</span>
      <h3 style="font-size: 15px; font-weight: 500; margin: 0; margin-top: 4px;">Acme Commercial (te-005)</h3>
      <p style="font-size: 12px; color: var(--color-text-secondary); margin: 2px 0 0;">3.2 hours — Document review</p>
    </div>
  </div>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; padding: 12px 0; border-top: 0.5px solid var(--color-border-tertiary); border-bottom: 0.5px solid var(--color-border-tertiary);">
    <div style="display: flex; justify-content: space-between;">
      <span style="color: var(--color-text-secondary);">Rate:</span>
      <span style="font-weight: 500;">$350/hr</span>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <span style="color: var(--color-text-secondary);">Amount:</span>
      <span style="font-weight: 500;">$1,120</span>
    </div>
  </div>
  <div style="display: flex; gap: 8px; margin-top: 12px;">
    <button style="background: var(--color-background-info); color: white; padding: 8px 14px; border: none; border-radius: var(--border-radius-md); font-size: 13px; cursor: pointer;">Approve</button>
    <button style="background: transparent; color: var(--color-text-primary); border: 0.5px solid var(--color-border-secondary); padding: 8px 14px; border-radius: var(--border-radius-md); font-size: 13px; cursor: pointer;">Edit</button>
  </div>
</div>
```

### Metric Card

Summary statistics for dashboards. No border, soft background.

```html
<div style="
  background: var(--color-background-secondary);
  border-radius: var(--border-radius-md);
  padding: 14px;
  text-align: center;
">
  <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 4px;">
    Entries approved
  </div>
  <div style="font-size: 20px; font-weight: 500; color: var(--color-text-primary);">
    4
  </div>
  <div style="font-size: 11px; color: var(--color-text-secondary); margin-top: 2px;">
    of 6 pending
  </div>
</div>
```

Use in a grid layout:

```html
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
  <div style="background: var(--color-background-secondary); border-radius: var(--border-radius-md); padding: 14px; text-align: center;">
    <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 4px;">Entries approved</div>
    <div style="font-size: 20px; font-weight: 500;">4</div>
    <div style="font-size: 11px; color: var(--color-text-secondary); margin-top: 2px;">of 6 pending</div>
  </div>
  <!-- Repeat for other metrics -->
</div>
```

---

## Alerts & Badges

Critical badge `600` weight is the only approved exception to the normal 400/500 typography system. The exception exists because judges and attorneys must be able to identify a HARD_LEGAL item instantly in a scrolling demo.

### Status Badge (Inline)

Small label for status indication. Standard badges use 200 stop; critical Red badge uses 400 stop with white text for maximum visibility.

**Standard badge (200 stop):**

```html
<span style="
  display: inline-block;
  background: #85B7EB;
  color: #042C53;
  padding: 4px 10px;
  border-radius: var(--border-radius-md);
  font-size: 11px;
  font-weight: 500;
">
  PENDING
</span>
```

**Critical badge (400 stop) — Red only:**

```html
<span style="
  display: inline-block;
  background: #E24B4A;
  color: #FFFFFF;
  padding: 4px 10px;
  border-radius: var(--border-radius-md);
  font-size: 11px;
  font-weight: 600;
">
  CRITICAL: HARD_LEGAL
</span>
```

**Color assignments:**
- Blue: `PENDING`, `REQUIRES_ACTION`, informational — 200 stop (#85B7EB bg + #042C53 text)
- Teal: `APPROVED`, `CONFIRMED`, `SENT_CONFIRMED` — 200 stop (#5DCAA5 bg + #04342C text)
- Amber: `WARNING`, `THRESHOLD_ALERT` — 200 stop (#EF9F27 bg + #412402 text)
- Red: `CRITICAL`, `HARD_LEGAL`, escalations — 400 stop (#E24B4A bg + white text, weight 600)

### Alert Banner

Full-width banner for important notices.

```html
<div style="
  background: #FCEBEB;
  border-left: 2px solid #E24B4A;
  padding: 12px 16px;
  border-radius: var(--border-radius-md);
  display: flex;
  gap: 12px;
  align-items: flex-start;
  font-size: 13px;
  color: #501313;
">
  <svg style="width: 20px; height: 20px; flex-shrink: 0; color: #E24B4A;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
  <div>
    <p style="margin: 0; font-weight: 500;">Statute of limitations deadline in 6 days</p>
    <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.8;">Mercer Industries — Motion response due June 4</p>
  </div>
</div>
```

### Audit Event Drawer

The audit event drawer is a signature demo component. It should feel like a receipt, not a toast. Show:

- Written to audit log
- Audit event ID
- Entity type and ID
- Actor
- Timestamp
- Before/after summary when available

Use a dark audit surface and teal success text so the moment is visually distinct and memorable.

---

## Tables

### Billing Review Table

```html
<table style="
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
">
  <thead>
    <tr style="background: var(--color-background-secondary); border-bottom: 0.5px solid var(--color-border-tertiary);">
      <th style="padding: 10px; text-align: left; font-weight: 500; color: var(--color-text-primary);">Matter</th>
      <th style="padding: 10px; text-align: left; font-weight: 500; color: var(--color-text-primary);">Hours</th>
      <th style="padding: 10px; text-align: left; font-weight: 500; color: var(--color-text-primary);">Narrative</th>
      <th style="padding: 10px; text-align: left; font-weight: 500; color: var(--color-text-primary);">Status</th>
      <th style="padding: 10px; text-align: right; font-weight: 500; color: var(--color-text-primary);">Action</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom: 0.5px solid var(--color-border-tertiary);">
      <td style="padding: 10px; color: var(--color-text-primary);">Acme (te-005)</td>
      <td style="padding: 10px; color: var(--color-text-primary);">3.2h</td>
      <td style="padding: 10px; color: #E24B4A;">[incomplete]</td>
      <td style="padding: 10px;"><span style="background: #E6F1FB; color: #042C53; padding: 4px 8px; border-radius: var(--border-radius-md); font-size: 11px; font-weight: 500;">PENDING</span></td>
      <td style="padding: 10px; text-align: right;">
        <button style="background: transparent; color: var(--color-text-info); border: none; font-size: 13px; cursor: pointer; font-weight: 500;">Edit</button>
      </td>
    </tr>
  </tbody>
</table>
```

---

## Modals

### Approval Modal

Centered modal for confirming an action.

```html
<div style="
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
">
  <div style="
    background: var(--color-background-primary);
    border-radius: var(--border-radius-lg);
    padding: 24px;
    max-width: 540px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  ">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="font-size: 18px; font-weight: 500; margin: 0;">Confirm deadline</h2>
      <button style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--color-text-secondary);">×</button>
    </div>
    
    <p style="font-size: 14px; color: var(--color-text-secondary); margin: 0 0 16px;">
      You're about to confirm the statute of limitations motion response deadline for Mercer Industries on June 4, 2026. This will be logged in the audit trail.
    </p>
    
    <div style="
      background: var(--color-background-secondary);
      padding: 12px;
      border-radius: var(--border-radius-md);
      margin-bottom: 20px;
      font-size: 13px;
    ">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: var(--color-text-secondary);">Matter:</span>
        <span style="font-weight: 500;">Mercer v. Capital Corp</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--color-text-secondary);">Days until:</span>
        <span style="font-weight: 500;">6 days</span>
      </div>
    </div>
    
    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button style="background: transparent; color: var(--color-text-primary); border: 0.5px solid var(--color-border-secondary); padding: 10px 20px; border-radius: var(--border-radius-md); cursor: pointer; font-weight: 500;">Cancel</button>
      <button style="background: var(--color-background-info); color: white; border: none; padding: 10px 20px; border-radius: var(--border-radius-md); cursor: pointer; font-weight: 500;">Confirm</button>
    </div>
  </div>
</div>
```

---

## Navigation

### Top Navigation / Tabs

Horizontal navigation for switching between dashboard sections.

```html
<nav style="
  display: flex;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  background: var(--color-background-primary);
">
  <a href="#" style="
    flex: 1;
    padding: 12px 16px;
    text-align: center;
    font-size: 13px;
    color: var(--color-text-secondary);
    text-decoration: none;
    border-right: 0.5px solid var(--color-border-tertiary);
    border-bottom: 2px solid var(--color-text-info);
    color: var(--color-text-info);
    transition: all 0.2s;
  ">Brief</a>
  <a href="#" style="
    flex: 1;
    padding: 12px 16px;
    text-align: center;
    font-size: 13px;
    color: var(--color-text-secondary);
    text-decoration: none;
    border-right: 0.5px solid var(--color-border-tertiary);
    transition: all 0.2s;
  " onmouseover="this.style.backgroundColor='var(--color-background-secondary)'" onmouseout="this.style.backgroundColor='transparent'">Deadlines</a>
  <a href="#" style="
    flex: 1;
    padding: 12px 16px;
    text-align: center;
    font-size: 13px;
    color: var(--color-text-secondary);
    text-decoration: none;
    transition: all 0.2s;
  " onmouseover="this.style.backgroundColor='var(--color-background-secondary)'" onmouseout="this.style.backgroundColor='transparent'">Billing</a>
</nav>
```

---

## Layout Patterns

### Page Header

Consistent header for all pages.

```html
<header style="
  background: var(--color-background-primary);
  border-bottom: 0.5px solid var(--color-border-tertiary);
  padding: 24px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 100%;
">
  <div>
    <h1 style="font-size: 22px; font-weight: 500; margin: 0;">Litt</h1>
  </div>
  <div style="font-size: 13px; color: var(--color-text-secondary);">
    Daily Closeout — 4:30 PM
  </div>
</header>
```

### Two-Column Layout

For content + sidebar.

```html
<div style="display: grid; grid-template-columns: 1fr 280px; gap: 24px; max-width: 1000px; margin: 0 auto;">
  <main style="display: flex; flex-direction: column; gap: 24px;">
    <!-- Main content here -->
  </main>
  <aside style="display: flex; flex-direction: column; gap: 16px;">
    <!-- Sidebar widgets -->
  </aside>
</div>
```

### Section Divider

Separate major content sections.

```html
<div style="
  padding: 24px 0;
  margin-bottom: 24px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
">
  <h2 style="font-size: 18px; font-weight: 500; margin: 0 0 16px;">Section title</h2>
  <!-- Content here -->
</div>
```

---

## Accessibility Checklist

Every component should:

- [ ] Have sufficient color contrast (7:1 for text on colored backgrounds)
- [ ] Include focus outlines (2px, 4px offset) for interactive elements
- [ ] Use semantic HTML (`<button>`, `<input>`, `<select>`, `<a>`)
- [ ] Include `aria-label` on icon-only buttons
- [ ] Have visible focus states (not `outline: none`)
- [ ] Be keyboard navigable (Tab, Enter, Space, arrow keys)
- [ ] Work with screen readers (proper headings, labels, ARIA)
- [ ] Have adequate touch target size (minimum 44px × 44px)

---

## Common Patterns

### Pending Approval Status

```html
<span style="
  display: inline-block;
  background: #E6F1FB;
  color: #042C53;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
">PENDING</span>
```

### Budget Utilization Progress

```html
<div style="font-size: 13px; margin-bottom: 8px;">
  <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
    <span style="color: var(--color-text-secondary);">Budget:</span>
    <span style="font-weight: 500;">$78,000 / $100,000 (78%)</span>
  </div>
  <div style="
    width: 100%;
    height: 6px;
    background: var(--color-background-secondary);
    border-radius: 3px;
    overflow: hidden;
  ">
    <div style="
      width: 78%;
      height: 100%;
      background: #BA7517;
      border-radius: 3px;
    "></div>
  </div>
</div>
```

### Action Card Group

Multiple related actions in a single card.

```html
<div style="display: flex; gap: 8px; flex-wrap: wrap;">
  <button style="background: var(--color-background-info); color: white; padding: 8px 14px; border: none; border-radius: var(--border-radius-md); font-size: 13px; cursor: pointer; font-weight: 500;">Primary action</button>
  <button style="background: transparent; border: 0.5px solid var(--color-border-secondary); padding: 8px 14px; border-radius: var(--border-radius-md); font-size: 13px; cursor: pointer;">Secondary action</button>
  <button style="background: transparent; color: #791F1F; border: 0.5px solid #791F1F; padding: 8px 14px; border-radius: var(--border-radius-md); font-size: 13px; cursor: pointer;">Danger action</button>
</div>
```

---

## Migration Notes (if updating from prior design)

If you're migrating from a previous design system:

1. **Typography:** Switch all fonts to Anthropic Sans. Use only 400 and 500 weights.
2. **Spacing:** Replace fixed px spacing with `var(--border-radius-md)` and standard gap scale (12px, 16px, 24px).
3. **Borders:** Change all borders to `0.5px solid var(--color-border-tertiary)`.
4. **Colors:** Migrate to the new semantic ramp system (blue for primary, teal for success, amber for warning, red for danger).
5. **Button styling:** Remove any custom button hover effects; use the pre-built patterns.
6. **Cards:** Ensure all cards use `border-radius: var(--border-radius-lg)` and padding `16px`.

---

*End of component library. For questions or new component proposals, contact the design team.*
