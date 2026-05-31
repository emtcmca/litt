# Litt — Design Tokens & CSS Variables

**Version:** 1.0  
**Date:** May 30, 2026  
**Purpose:** Single source of truth for all design values (colors, spacing, typography, effects)

---

## Overview

Design tokens are the atomic units of design — colors, sizes, spacing, typography — expressed as reusable variables. Litt uses CSS custom properties (CSS variables) to implement these tokens, ensuring consistency and enabling theme switching.

All tokens are defined in the root CSS scope and resolve automatically to light or dark mode variants. Developers should **always use CSS variables, never hardcode hex colors or pixel values**.

---

## CSS Variable Usage

All tokens are accessed via `var(--token-name)` syntax in CSS:

```css
button {
  background: var(--color-background-info);      /* Dynamic blue from ramp */
  color: var(--color-text-info);                 /* Semantic text color */
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  padding: 10px 20px;
  font-family: var(--font-sans);
  font-size: 14px;                               /* No token; use literal px for typography */
  font-weight: 500;
}
```

---

## Color Tokens

### Background Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-background-primary` | `#FFFFFF` | `#1A1A18` | Page/card backgrounds, primary surface |
| `--color-background-secondary` | `#F8F7F4` | `#2D2D2A` | Metric cards, hover states, secondary surface |
| `--color-background-tertiary` | `#F1EFE8` | `#262623` | Page background, lowest emphasis |
| `--color-background-info` | `#E6F1FB` | `#0C447C` | Blue accent backgrounds, CTA button |
| `--color-background-warning` | `#FAEEDA` | `#633806` | Amber accent backgrounds |
| `--color-background-danger` | `#FCEBEB` | `#791F1F` | Red accent backgrounds, critical alerts |
| `--color-background-success` | `#E1F5EE` | `#085041` | Teal accent backgrounds, confirmed state |

### Text Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-text-primary` | `#2C2C2A` | `#E8E6DC` | Primary text, headings, high emphasis |
| `--color-text-secondary` | `#6F6D67` | `#A9A7A1` | Secondary text, labels, medium emphasis |
| `--color-text-tertiary` | `#A9A7A1` | `#6F6D67` | Tertiary text, hints, low emphasis |
| `--color-text-info` | `#042C53` | `#B5D4F4` | Text on blue backgrounds |
| `--color-text-warning` | `#412402` | `#FAC775` | Text on amber backgrounds |
| `--color-text-danger` | `#501313` | `#F7C1C1` | Text on red backgrounds |
| `--color-text-success` | `#04342C` | `#9FE1CB` | Text on teal backgrounds |

### Border Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-border-tertiary` | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.12)` | Default borders, dividers |
| `--color-border-secondary` | `rgba(0,0,0,0.20)` | `rgba(255,255,255,0.20)` | Hover/focus borders |
| `--color-border-primary` | `rgba(0,0,0,0.30)` | `rgba(255,255,255,0.30)` | Strong emphasis borders |
| `--color-border-info` | `#378ADD` | `#378ADD` | Blue semantic borders |
| `--color-border-warning` | `#BA7517` | `#BA7517` | Amber semantic borders |
| `--color-border-danger` | `#E24B4A` | `#E24B4A` | Red semantic borders |
| `--color-border-success` | `#1D9E75` | `#1D9E75` | Teal semantic borders |

---

## Semantic Color Ramps

For categorical or status-based coloring, use the full ramps. Each ramp has 7 stops (50, 100, 200, 400, 600, 800, 900).

### Blue Ramp (Primary)

Used for primary actions, pending state, informational content.

```css
--color-ramp-blue-50:   #E6F1FB
--color-ramp-blue-100:  #B5D4F4
--color-ramp-blue-200:  #85B7EB
--color-ramp-blue-400:  #378ADD
--color-ramp-blue-600:  #185FA5
--color-ramp-blue-800:  #0C447C
--color-ramp-blue-900:  #042C53
```

### Teal Ramp (Success/Approved)

Used for confirmed, approved, positive actions.

```css
--color-ramp-teal-50:   #E1F5EE
--color-ramp-teal-100:  #9FE1CB
--color-ramp-teal-200:  #5DCAA5
--color-ramp-teal-400:  #1D9E75
--color-ramp-teal-600:  #0F6E56
--color-ramp-teal-800:  #085041
--color-ramp-teal-900:  #04342C
```

### Amber Ramp (Warning)

Used for warnings, caution, threshold alerts.

```css
--color-ramp-amber-50:  #FAEEDA
--color-ramp-amber-100: #FAC775
--color-ramp-amber-200: #EF9F27
--color-ramp-amber-400: #BA7517
--color-ramp-amber-600: #854F0B
--color-ramp-amber-800: #633806
--color-ramp-amber-900: #412402
```

### Red Ramp (Critical/Danger)

Used for critical escalations, hard legal deadlines, errors.

```css
--color-ramp-red-50:    #FCEBEB
--color-ramp-red-100:   #F7C1C1
--color-ramp-red-200:   #F09595
--color-ramp-red-400:   #E24B4A
--color-ramp-red-600:   #A32D2D
--color-ramp-red-800:   #791F1F
--color-ramp-red-900:   #501313
```

### Gray Ramp (Neutral)

Used for disabled states, structural elements, neutral information.

```css
--color-ramp-gray-50:   #F1EFE8
--color-ramp-gray-100:  #D3D1C7
--color-ramp-gray-200:  #B4B2A9
--color-ramp-gray-400:  #888780
--color-ramp-gray-600:  #5F5E5A
--color-ramp-gray-800:  #444441
--color-ramp-gray-900:  #2C2C2A
```

---

## Typography Tokens

### Font Stack

```css
--font-sans:   -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetic Neue", sans-serif
--font-serif:  "Georgia", "Times New Roman", serif
--font-mono:   "SF Mono", "Monaco", "Inconsolata", monospace
```

Use `--font-sans` for all UI. `--font-serif` only for editorial/blockquote moments. `--font-mono` for code, IDs, structured data.

### Font Sizes

No CSS tokens for typography sizes. Use literal values in pixels as defined by the type scale:

- Heading 1: `24px`, weight `500`
- Heading 2: `18px`, weight `500`
- Heading 3: `16px`, weight `500`
- Body: `16px`, weight `400`
- Label: `14px`, weight `400`
- Caption: `12px`, weight `400`
- Monospace: `13px`, weight `400`

### Font Weights

Only two weights are permitted in Litt:

```css
font-weight: 400;  /* Regular (body, labels, captions) */
font-weight: 500;  /* Bold (headings, strong emphasis) */
```

Never use `700` or other heavy weights. `600` is allowed only for red critical badges in the hackathon demo, where the badge needs to read as unmistakably urgent at a glance.

---

## Spacing Tokens

Spacing uses a consistent rem-based scale. In practice, you'll use these as pixel values (1rem = 16px in the Litt context):

| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-2xs` | `4px` | Micro adjustments inside components |
| `--spacing-xs` | `8px` | Tight grouping (icon + label) |
| `--spacing-sm` | `12px` | Standard gap between elements |
| `--spacing-md` | `16px` | Standard padding inside cards |
| `--spacing-lg` | `24px` | Larger gaps, breathing room |
| `--spacing-xl` | `32px` | Section separation |
| `--spacing-2xl` | `48px` | Major section breaks |

### Usage

```css
.card {
  padding: var(--spacing-md);              /* 16px */
  border-radius: var(--border-radius-lg);
}

.card + .card {
  margin-top: var(--spacing-sm);           /* 12px gap between cards */
}

section + section {
  margin-top: var(--spacing-xl);           /* 32px between sections */
}
```

---

## Border Radius Tokens

```css
--border-radius-md:   8px    /* Default for most elements (inputs, buttons, small cards) */
--border-radius-lg:   12px   /* Cards, modals, larger containers */
--border-radius-xl:   16px   /* Large rounded containers, rarely used */
```

For pills (fully rounded), use `border-radius: 50%` or `20px` explicitly; don't use a token.

---

## Shadow Tokens

Litt uses **no drop shadows** except for focus rings (which are technically not shadows, just outlines).

For focus indicators, use:

```css
box-shadow: 0 0 0 3px rgba(55, 138, 221, 0.2);  /* Blue focus ring */
```

Never use `filter: drop-shadow()`, `box-shadow: 0 4px 12px rgba(...)`, or similar decorative effects.

---

## Timing & Animation Tokens

Standard transition for interactive elements:

```css
transition: all 0.2s ease;
```

For subtle hover effects (background, border color change):

```css
transition: background-color 0.2s, border-color 0.2s;
```

For button press feedback:

```css
transition: transform 0.05s ease-out;
```

No animation tokens for duration/easing; these are defined per-component as literals (`0.2s`, `0.05s`).

---

## Component Token Shortcuts

### Button Primary

```css
background: var(--color-action-primary);
color: var(--color-action-primary-text);
border: none;
border-radius: var(--border-radius-md);
padding: 10px 20px;
font-weight: 500;
```

### Judge-Facing Action Tokens

The v1.0 demo uses stronger primary actions than the base calm palette. These tokens make consequential buttons read clearly on camera while preserving the restrained legal aesthetic.

```css
--color-action-primary: #185FA5;
--color-action-primary-hover: #0C447C;
--color-action-primary-text: #FFFFFF;
--color-audit-surface: #11110F;
--color-audit-success: #5DCAA5;
```

Use `--color-action-primary` for attorney confirmation, approval, and review actions. Keep secondary and danger actions restrained.

### Card Raised

```css
background: var(--color-background-primary);
border: 0.5px solid var(--color-border-tertiary);
border-radius: var(--border-radius-lg);
padding: var(--spacing-md);
```

### Badge (Pending Blue)

```css
background: var(--color-ramp-blue-50);
color: var(--color-ramp-blue-900);
padding: 4px 10px;
border-radius: var(--border-radius-md);
font-size: 11px;
font-weight: 500;
```

### Input Field

```css
border: 0.5px solid var(--color-border-tertiary);
border-radius: var(--border-radius-md);
padding: 8px 12px;
font-size: 14px;
```

On focus:

```css
border-color: var(--color-border-info);
box-shadow: 0 0 0 3px rgba(55, 138, 221, 0.2);
```

---

## Dark Mode Handling

All tokens automatically resolve to their dark mode equivalents when the system detects `prefers-color-scheme: dark`. No custom media queries or overrides are needed in component CSS.

**Example — automatic dark mode handling:**

```css
.card {
  background: var(--color-background-primary);  /* Switches from white to near-black */
  color: var(--color-text-primary);            /* Switches from dark to light */
  border: 0.5px solid var(--color-border-tertiary);  /* Switches from dark to light stroke */
}
```

The CSS is identical in both modes; the variables do the work.

---

## Extending Tokens

When adding a new component or design pattern, follow this process:

1. **Check if an existing token fits.** Most designs can be built from the existing palette.
2. **If you need a new color**, check if it's a semantic choice (use the appropriate ramp stop) or a new category (propose a new ramp, PR to design team).
3. **If you need a new spacing value**, use one of the existing scale values; don't invent new sizes.
4. **If you need a new border radius**, ask first. The system uses three values for a reason.

---

## Migration Checklist

If moving from hardcoded colors to tokens:

- [ ] Replace all hex colors with `var(--color-*)` equivalents
- [ ] Replace all `#333`, `#666`, `#999` with semantic text tokens
- [ ] Replace `0.5px solid #ddd` with `0.5px solid var(--color-border-tertiary)`
- [ ] Replace button backgrounds with semantic info/warning/danger tokens
- [ ] Replace `border-radius` values with token equivalents
- [ ] Test in dark mode; all colors should invert correctly
- [ ] Run automated contrast checker (should show 7:1+ on all text)

---

## Reference Implementation (CSS)

```css
:root {
  /* Backgrounds */
  --color-background-primary: #FFFFFF;
  --color-background-secondary: #F8F7F4;
  --color-background-tertiary: #F1EFE8;
  --color-background-info: #E6F1FB;
  --color-background-warning: #FAEEDA;
  --color-background-danger: #FCEBEB;
  --color-background-success: #E1F5EE;

  /* Text */
  --color-text-primary: #2C2C2A;
  --color-text-secondary: #6F6D67;
  --color-text-tertiary: #A9A7A1;
  --color-text-info: #042C53;
  --color-text-warning: #412402;
  --color-text-danger: #501313;
  --color-text-success: #04342C;

  /* Borders */
  --color-border-tertiary: rgba(0, 0, 0, 0.12);
  --color-border-secondary: rgba(0, 0, 0, 0.20);
  --color-border-primary: rgba(0, 0, 0, 0.30);
  --color-border-info: #378ADD;
  --color-border-warning: #BA7517;
  --color-border-danger: #E24B4A;
  --color-border-success: #1D9E75;

  /* Ramps */
  --color-ramp-blue-50: #E6F1FB;
  --color-ramp-blue-100: #B5D4F4;
  --color-ramp-blue-200: #85B7EB;
  --color-ramp-blue-400: #378ADD;
  --color-ramp-blue-600: #185FA5;
  --color-ramp-blue-800: #0C447C;
  --color-ramp-blue-900: #042C53;

  /* ...other ramps... */

  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-serif: "Georgia", serif;
  --font-mono: "SF Mono", monospace;

  /* Spacing */
  --spacing-2xs: 4px;
  --spacing-xs: 8px;
  --spacing-sm: 12px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;

  /* Border radius */
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
  --border-radius-xl: 16px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-background-primary: #1A1A18;
    --color-background-secondary: #2D2D2A;
    --color-background-tertiary: #262623;
    --color-background-info: #0C447C;
    --color-background-warning: #633806;
    --color-background-danger: #791F1F;
    --color-background-success: #085041;

    --color-text-primary: #E8E6DC;
    --color-text-secondary: #A9A7A1;
    --color-text-tertiary: #6F6D67;
    --color-text-info: #B5D4F4;
    --color-text-warning: #FAC775;
    --color-text-danger: #F7C1C1;
    --color-text-success: #9FE1CB;

    --color-border-tertiary: rgba(255, 255, 255, 0.12);
    --color-border-secondary: rgba(255, 255, 255, 0.20);
    --color-border-primary: rgba(255, 255, 255, 0.30);

    /* Ramps invert similarly */
  }
}
```

---

*End of design tokens reference. For token additions or modifications, contact the design team.*
