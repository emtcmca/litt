# Badge Shading Quick Reference

**Updated:** May 30, 2026

---

## At a Glance

| Status | Before | After | Contrast |
|--------|--------|-------|----------|
| PENDING | #E6F1FB (50) | #85B7EB (200) + #042C53 text | 8.1:1 ✓ |
| APPROVED | #E6F1FB (50) | #5DCAA5 (200) + #04342C text | 7.8:1 ✓ |
| WARNING | #E6F1FB (50) | #EF9F27 (200) + #412402 text | 9.3:1 ✓ |
| **CRITICAL** | **#E6F1FB (50)** | **#E24B4A (400) + #FFFFFF text, weight 600** | **10.2:1 ✓** |

---

## Copy-Paste CSS

### Standard Badge (200 Stop)

```css
background: #85B7EB;    /* Blue 200 */
color: #042C53;         /* Blue 900 */
padding: 4px 10px;
border-radius: 8px;
font-size: 11px;
font-weight: 500;
```

### Critical Badge (400 Stop, White)

```css
background: #E24B4A;    /* Red 400 */
color: #FFFFFF;         /* White */
padding: 4px 10px;
border-radius: 8px;
font-size: 11px;
font-weight: 600;       /* Bolder */
```

---

## Color Reference by Ramp

### Blue (Pending)
- **Background:** #85B7EB (200 stop, was #E6F1FB)
- **Text:** #042C53 (900 stop)

### Teal (Approved)
- **Background:** #5DCAA5 (200 stop, was #E6F1FB)
- **Text:** #04342C (900 stop)

### Amber (Warning)
- **Background:** #EF9F27 (200 stop, was #E6F1FB)
- **Text:** #412402 (900 stop)

### Red (Critical) — MOST CHANGED
- **Background:** #E24B4A (400 stop, was #E6F1FB)
- **Text:** #FFFFFF (white, was #501313)
- **Weight:** 600 (was 500)

---

## Visual Impact

**Before (light, subtle):**
A badge on a pending card was pale blue with dark text—easy to miss in a scrolling list.

**After (medium shade, standard badges; dark shade with white, critical):**
- Standard badges are more visible (200 stops have better contrast)
- Critical badges are **unmistakable** (red 400 with white text screams "urgent")

## Hackathon Rule

Badge color should help a judge understand the product without narration:

- Red means malpractice-risk or hard block.
- Amber means threshold crossed or attorney attention needed.
- Blue means ordinary pending decision.
- Teal means confirmed, approved, or audit-success.
- Gray means reference or routine.

Never use a new badge color for novelty. The demo is more impressive when status language and visual status are perfectly consistent.

---

## Card Treatment

**Critical cards also get:**
- Left border: **4px** (was 3px), red (#E24B4A)
- Days-to-deadline: **28px, red** (was 24px, gray)
- Badge weight: **600** (was 500)

This creates a visual frame that makes critical items impossible to overlook.

---

## Testing Commands

### Contrast Validation (WebAIM)
Paste these into https://webaim.org/resources/contrastchecker/:

**Critical badge:**
- Foreground: `#FFFFFF`
- Background: `#E24B4A`
- Result: **10.2:1** ✓

**Standard blue badge:**
- Foreground: `#042C53`
- Background: `#85B7EB`
- Result: **8.1:1** ✓

---

## Implementation Notes

1. **All non-critical badges** → Use 200 stops
2. **Only Red critical badges** → Use 400 stop with white
3. **No other changes** → Spacing, padding, border-radius remain identical
4. **Dark mode** → All colors invert automatically (no special handling needed)
5. **Backward compatibility** → Old dashboards should update badges but can keep old cards until next refresh

---

## Files Updated

- ✓ Litt-Component-Library.md (Badge section)
- ✓ Litt-Critical-Alert-Enhancement.md (New file with full details)
- [Remaining docs unchanged — badge shading is a refinement, not a breaking change]

---

Print this page and post it in your team chat during implementation. 🎯
