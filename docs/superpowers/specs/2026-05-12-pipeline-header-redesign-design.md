# Pipeline Header Redesign — 3-Level Typographic Hierarchy

**Date:** 2026-05-12
**Status:** Draft
**Scope:** Visual hierarchy improvement for the Title / Hook / Synopsis header fields in the pipeline item detail page.

## Context

The pipeline item detail page (`apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx`) renders three editable header fields at the top of the main content area (lines 382-413):

1. **Title** — `<input>` for `title_pt`
2. **Hook** — `<input>` for `hook`
3. **Synopsis** — `<textarea>` for `synopsis`

These three fields serve fundamentally different purposes but currently receive near-identical visual treatment, making the header area feel flat and undifferentiated. User rating: **40/100**.

### Key File

| File | Role |
|------|------|
| `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx` | Main component; header fields at lines 382-413 |
| `apps/web/src/lib/pipeline/gem-design.ts` | Design tokens and `getPriorityConfig()` |

## Problem

| Issue | Detail |
|-------|--------|
| Near-identical sizing | Title is `text-lg font-semibold` (18px), Hook and Synopsis are both `text-sm` (14px) with `--gem-muted` color. Insufficient contrast between the primary field and secondary fields. |
| No labels | Hook and Synopsis are distinguishable only by placeholder text, which vanishes once the user types. After content is entered, the two fields are visually indistinguishable. |
| No character counter | Hook has a practical limit (~300 chars) and Synopsis (~2000 chars), but the user has zero feedback on length. |
| Uniform spacing | All three fields sit inside a `flex flex-col gap-3.5` container with identical vertical gaps, creating no visual grouping or hierarchy. |
| Subtle differentiator | Hook's `borderLeft: 2px solid ${priority.accent}` is the only visual cue separating it from Synopsis, but at 2px it is too subtle to register at a glance. |

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Title sizing | 24px bold with tight letter-spacing | Creates clear "hero" level; matches editorial tools where the title dominates. |
| Hook vs Synopsis differentiation | Different font sizes (15px vs 13px), different border-left weight (3px vs 1px), different text colors | Three visual axes of difference ensure instant recognition even without labels. |
| Floating labels | Absolute-positioned, uppercase, 9px micro-labels that appear when field has content | Labels provide persistent identification without cluttering empty-state UI. Conditional visibility avoids label+placeholder redundancy. |
| Character counters | Show on focus only, with amber warning at 80% | Always-visible counters add noise; focus-only keeps the UI clean while providing feedback when the user is actively editing. |
| Progressive spacing | 0 / 10px / 14px top margins | Increasing gap sizes reinforce the visual hierarchy: Title is tightest to the breadcrumb, Synopsis has the most breathing room from Hook. |

## Solution: 3-Level Typographic Hierarchy

### Level 1 — Title

```
font-size:       24px
font-weight:     700
color:           var(--gem-text)
letter-spacing:  -0.4px
line-height:     1.3
margin-top:      0
```

- No label (the field is self-evident as the document title).
- Placeholder: `"Titulo do conteudo"`.
- Border/background behavior follows the shared interaction states below.

### Level 2 — Hook

```
font-size:       15px
font-weight:     400
color:           #b8c5d6  (brighter than --gem-muted)
margin-top:      10px
border-left:     3px solid {priority.accent}  (was 2px)
border-radius:   0 8px 8px 0
```

**Floating label:**
- Text: `"Hook"`
- Color: `{priority.accent}` (matches the border-left)
- Font: 9px uppercase, letter-spacing 0.5px
- Position: absolute, `top: -7px`, `left: 22px`
- Visibility: `opacity: 0` when field is empty, `opacity: 1` when field has content
- Transition: `opacity 150ms ease`

**Empty state:**
- `border-left` color falls back to `var(--gem-faint)` instead of priority accent
- Placeholder: `"O que prende a audiencia em uma frase?"`

**Character counter:**
- Visible on focus only
- Format: `"X / 300"`
- Position: right-aligned below the field, `text-[10px]`, color `var(--gem-dim)`
- Warning: color changes to amber (`#f59e0b`) when character count >= 240 (80% of 300)

**Accessibility:**
- `aria-labelledby: hook-label-{id}` pointing to the floating label element
- Existing `aria-label="Hook"` maintained as fallback

### Level 3 — Synopsis

```
font-size:       13px
font-weight:     400
color:           var(--gem-muted)
margin-top:      14px
border-radius:   0 8px 8px 0
```

**Border-left behavior (3-state):**
- Idle (has content): `1px solid var(--gem-faint)`
- Hover: `1px solid var(--gem-dim)`
- Focus: `2px solid var(--gem-dim)`

**Empty state:**
- No border-left at all
- Placeholder: `"Sobre o que e esse conteudo? Contexto, tese, estrutura..."`

**Floating label:**
- Text: `"Synopsis"`
- Color: `var(--gem-dim)` (neutral, unlike Hook's priority-colored label)
- Same 9px uppercase style and positioning as Hook label
- Same conditional visibility (opacity 0 when empty, 1 when has content, 150ms ease)

**Character counter:**
- Visible on focus only
- Format: `"X / 2000"`
- Same styling as Hook counter
- Warning: amber when character count >= 1600 (80% of 2000)

**Accessibility:**
- `aria-labelledby: synopsis-label-{id}` pointing to the floating label element
- Existing `aria-label="Synopsis"` maintained as fallback

## Interaction States (shared by all three fields)

All three fields share these interaction states, applied via inline styles or Tailwind:

| State | Border | Background | Additional |
|-------|--------|------------|------------|
| Idle | `transparent` | `transparent` | — |
| Hover | `var(--gem-border)` | `var(--gem-surface-hi)` | — |
| Focus | `var(--gem-accent)` | `var(--gem-well)` | `box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12)` |

All transitions: `150ms ease` (matching existing `transition-colors` on the fields).

Note: For Hook and Synopsis, the border-left is independent from the interaction-state border. The interaction-state border applies to top/right/bottom, while border-left follows the field-specific rules defined above.

## Design System Tokens Used

From `gem-design.ts`:

| Token | Purpose |
|-------|---------|
| `--gem-surface` | Panel backgrounds |
| `--gem-surface-hi` | Hover background for fields |
| `--gem-border` | Hover border |
| `--gem-well` | Focus background |
| `--gem-text` | Title text color |
| `--gem-muted` | Synopsis text color |
| `--gem-dim` | Counter text, Synopsis label, Synopsis border states |
| `--gem-faint` | Hook empty-state border, Synopsis idle border |
| `--gem-accent` | Focus border, focus ring |

Additionally, `getPriorityConfig()` provides `accent` and `accentDim` per priority level.

## Priority Adaptation

Hook's `border-left` color and floating label color adapt to the item's priority via `getPriorityConfig()`:

| Priority | Accent Color | Visual Meaning |
|----------|-------------|----------------|
| P0 | `#64748b` (slate) | Backlog / unassigned |
| P1 | `#64748b` (slate) | Low priority |
| P2 | `#0ea5e9` (cyan) | Normal |
| P3 | `#6366f1` (indigo) | High |
| P4 | `#f59e0b` (amber) | Urgent |
| P5 | `#ef4444` (red) | Critical |

Synopsis does **not** adapt to priority — it uses neutral `--gem-dim` / `--gem-faint` tokens regardless of priority level.

## Visual Summary

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Titulo do conteudo                           ← 24px 700│
│                                                          │
│  ┌─ Hook ────────────────────────────────────┐  ← 15px  │
│  │ 3px accent  O que prende a audiencia...   │           │
│  │ border      ──────────────── 42 / 300     │           │
│  └───────────────────────────────────────────┘           │
│                                                          │
│  ┌─ Synopsis ────────────────────────────────┐  ← 13px  │
│  │ 1px faint   Sobre o que e esse conteudo.. │           │
│  │ border      ─────────────── 128 / 2000    │           │
│  │             (counter visible on focus)     │           │
│  └───────────────────────────────────────────┘           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Accessibility

- **aria-labelledby:** Each floating label has an `id` (`hook-label-{itemId}`, `synopsis-label-{itemId}`) and the corresponding input/textarea references it via `aria-labelledby`. This provides screen readers with a persistent label even when the floating label is visually hidden (opacity 0).
- **aria-label fallback:** The existing `aria-label="Hook"` and `aria-label="Synopsis"` attributes are maintained as fallback for cases where `aria-labelledby` target is not rendered.
- **Focus ring:** The `box-shadow: 0 0 0 2px rgba(99,102,241,0.12)` focus ring is visible on all background colors (dark surfaces), meeting WCAG focus-visible requirements.
- **Character counter:** Counters use `aria-live="polite"` so screen readers announce updates without interrupting the user.

## Out of Scope

- **Title EN toggle (bilingual)** — already handled by `TabContainer` language switching
- **Auto-resize textarea** — Synopsis textarea keeps native `resize-y`; auto-resize is a separate enhancement
- **Keyboard shortcut Tab between fields** — standard browser Tab behavior is sufficient
- **Undo/redo per field** — no field-level history tracking in this iteration
- **Title character counter** — titles have no practical limit; adding a counter would add noise without value
