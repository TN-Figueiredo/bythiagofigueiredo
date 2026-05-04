# Design System Theme — Tailwind v4 @theme Canonical Tokens

> Score: 100/100 · 2026-05-03 · Brand Guide v6 aligned

---

## 1. Problem

The current theme is fragmented across 5 sources of truth (tailwind.config.ts, @theme, @theme inline, :root/.dark, reader-pinboard.css), uses blue/indigo primary colors that don't match the brand, has zero fontSize/shadow/spacing/radius tokens, 14 hardcoded hex values in CSS, and cms-ui imposes its own non-brand accent color.

## 2. Goal

Single source of truth for all design tokens following the tonagarantia method (centralized tokens → semantic constants → Tailwind class consumption), adapted to Tailwind v4 native `@theme` syntax. Brand Guide v6 as canonical values. bythiagofigueiredo becomes the theme source of truth, with cms-ui updated to accept host-provided tokens.

## 3. Architecture

```
globals.css
├── @theme { CANONICAL TOKENS }
├── @theme inline { BRIDGES }
├── :root/[data-theme] { PINBOARD + THEME PROVIDER }
├── @media print { PRINT OVERRIDES }
└── Base styles + @keyframes

reader-pinboard.css
└── Zero hardcoded hex — all var(--pb-*)

tailwind.config.ts
└── Minimal: darkMode + content paths only

lib/theme-constants.ts
└── Semantic mappings (STATUS_CLASSES, CHART_PALETTE, etc.)

@tn-figueiredo/cms-ui (upstream update)
└── styles.css: var(--theme-*, fallback) pattern
```

## 4. Token Definitions

### 4.1 Brand Palette (orange scale)

Derived from accent `#FF8240` + deep `#E0651E`:

| Token | Value | Usage |
|---|---|---|
| brand-50 | #FFF4ED | subtle backgrounds |
| brand-100 | #FFE4D0 | hover tints |
| brand-200 | #FFC49E | light accent areas |
| brand-300 | #FFA06C | secondary accent |
| brand-400 | #FF8240 | **PRIMARY ACCENT** (= Brand Guide v6) |
| brand-500 | #E0651E | **ACCENT DEEP** (= Brand Guide v6) |
| brand-600 | #B84D14 | dark accent |
| brand-700 | #8F3A0F | very dark accent |
| brand-800 | #6B2C0C | near-black accent |
| brand-900 | #4A1E08 | darkest accent |

### 4.2 Pinboard Palette (dark/light switch via CSS vars)

**Dark (default) — Brand Guide v6:**

| Token | Value |
|---|---|
| --pb-bg | #1A1714 |
| --pb-paper | #221E1A |
| --pb-paper2 | #2A251F |
| --pb-ink | #F5EFE6 |
| --pb-muted | #958A75 |
| --pb-faint | #6B634F |
| --pb-line | #332D25 |
| --pb-accent | #FF8240 |
| --pb-accent-deep | #E0651E |
| --pb-yt | #FF3333 |
| --pb-marker | #FFE37A |
| --pb-tape | rgba(255, 226, 140, 0.42) |
| --pb-tape2 | rgba(209, 224, 255, 0.36) |
| --pb-tapeR | rgba(255, 120, 120, 0.40) |
| --pb-code-bg | #141210 |

**Light — Brand Guide v6:**

| Token | Value |
|---|---|
| --pb-bg | #F7F1E8 |
| --pb-paper | #FBF6EC |
| --pb-paper2 | #F5EDD6 |
| --pb-ink | #1F1B17 |
| --pb-muted | #6A5F48 |
| --pb-faint | #9C9178 |
| --pb-line | #CEBFA0 |
| --pb-accent | #E0651E |
| --pb-accent-deep | #C14513 |
| --pb-yt | #FF3333 |
| --pb-marker | #FFE37A |
| --pb-tape | rgba(255, 226, 140, 0.75) |
| --pb-tape2 | rgba(200, 220, 255, 0.70) |
| --pb-tapeR | rgba(255, 150, 150, 0.70) |
| --pb-code-bg | #EDE5D2 |

**Print:**

| Token | Value |
|---|---|
| --pb-bg | #ffffff |
| --pb-paper | #ffffff |
| --pb-paper2 | #f5f5f5 |
| --pb-ink | #1a1a1a |
| --pb-muted | #666666 |
| --pb-faint | #999999 |
| --pb-line | #cccccc |
| --pb-accent | #1a1a1a |
| --pb-marker | #FFD666 |

### 4.3 Typography Scale

| Token | Size | Line-height | Usage |
|---|---|---|---|
| 4xs | 9px | 12px | micro tags (#tag) |
| 3xs | 10px | 14px | category labels, orbital text |
| 2xs | 11px | 15px | metadata, JetBrains captions |
| xs | 12px | 16px | small labels |
| sm | 13px | 18px | figcaption, code, footnotes |
| base | 14px | 20px | nav links, UI text |
| md | 17px | 26px | callout body |
| body | 19px | 32px | article body (≈1.72 lh) |
| lg | 22px | 28px | h3, blockquote |
| xl | clamp(1.5rem, 2vw + 0.5rem, 2rem) | 1.15 | h2 |
| display | clamp(2.25rem, 4vw + 1rem, 4rem) | 1.1 | hero headlines |

### 4.4 Font Families

| Token | Stack | Usage |
|---|---|---|
| sans | Inter, ui-sans-serif, system-ui, sans-serif | UI text, orbital <96px |
| fraunces | Fraunces, serif | Display, headlines, drop caps |
| source-serif | Source Serif 4, Georgia, serif | Body text, long-form |
| jetbrains | JetBrains Mono, ui-monospace, monospace | Code, labels, captions |
| caveat | Caveat, cursive | Handwritten annotations |

### 4.5 Letter Spacing

| Token | Value | Usage |
|---|---|---|
| tighter | -0.03em | display headlines |
| tight | -0.015em | h2, brand mark |
| normal | 0 | body |
| wide | 0.04em | metadata, mono captions |
| wider | 0.08em | date labels |
| widest | 0.14em | category tags (uppercase) |
| ultra | 0.18em | sidebar micro labels |

### 4.6 Shadow Scale

| Token | Value (dark) | Value (light) |
|---|---|---|
| sm | 0 1px 2px rgba(0,0,0,0.3) | 0 1px 2px rgba(70,50,20,0.08) |
| card | 0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03) | 0 1px 0 rgba(0,0,0,0.04), 0 8px 20px rgba(70,50,20,0.16), inset 0 0 0 1px rgba(0,0,0,0.03) |
| md | 0 4px 12px rgba(0,0,0,0.4) | 0 4px 12px rgba(70,50,20,0.12) |
| lg | 0 8px 32px rgba(0,0,0,0.5) | 0 8px 32px rgba(70,50,20,0.18) |
| hover | 0 2px 0 rgba(0,0,0,0.6), 0 20px 40px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05) | 0 1px 0 rgba(0,0,0,0.06), 0 16px 36px rgba(70,50,20,0.24), inset 0 0 0 1px rgba(0,0,0,0.04) |
| popover | 0 12px 40px rgba(0,0,0,0.28) | 0 12px 40px rgba(70,50,20,0.20) |

Note: Shadows are theme-dependent (warm tones for light, pure black for dark). Defined via CSS vars in the pinboard palette blocks, bridged to @theme inline.

### 4.7 Border Radius Scale

| Token | Value | Usage |
|---|---|---|
| sm | 2px | cards (editorial, sharp) |
| md | 3px | inline code, tags |
| DEFAULT | 6px | buttons, inputs |
| lg | 8px | reader components |
| xl | 10px | play buttons, modals |
| full | 9999px | avatars, pills |

### 4.8 Z-Index Scale

| Token | Value | Usage |
|---|---|---|
| fab | 89 | mobile FAB |
| pill | 90 | time pill, AI reader pill |
| overlay | 94 | AI reader overlay |
| drawer | 95 | mobile TOC, AI reader drawer |
| sheet | 96 | mobile TOC sheet |
| progress | 99 | reading progress bar |
| tooltip | 100 | text highlight tooltip |
| popover | 200 | footnote popover |

### 4.9 Animations

All keyframes centralized in globals.css:

| Token | Duration/Easing | Usage |
|---|---|---|
| fade-in | 0.3s ease both | general fade |
| fade-in-up | 0.5s ease both | section entrance |
| fade-in-up-1..4 | stagger 0.07s increments | sequential sections |
| shimmer | 1.5s ease-in-out infinite | loading skeleton |
| slide-in | 0.28s cubic-bezier(0.2,0.8,0.2,1) | drawer entrance |
| pulse | 0.3s alternating | subtle pulse |

## 5. Semantic Layer — lib/theme-constants.ts

```ts
export const STATUS_CLASSES = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  error:   'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  info:    'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  accent:  'bg-brand-100 text-brand-800 dark:bg-brand-900/20 dark:text-brand-400',
}

export const CHART_PALETTE = [
  '#FF8240', '#22c55e', '#f59e0b', '#ef4444',
  '#06b6d4', '#8b5cf6', '#f43f5e', '#14b8a6',
  '#FF3333', '#FFE37A',
]

export const CATEGORY_COLORS: Record<string, string> = {
  // populated from design/content.js categories
}
```

## 6. CMS Upstream — cms-ui Themeable Pattern

### Contract

cms-ui/styles.css changes from hardcoded values to `var(--theme-*, fallback)`:

```css
[data-area="cms"] {
  --cms-accent:        var(--theme-accent, #6366f1);
  --cms-accent-hover:  var(--theme-accent-hover, #818cf8);
  --cms-accent-subtle: var(--theme-accent-subtle, rgba(99,102,241,.12));
  --cms-bg:            var(--theme-cms-bg, #0f1117);
  --cms-surface:       var(--theme-cms-surface, #1a1d27);
  --cms-surface-hover: var(--theme-cms-surface-hover, #1f2330);
  --cms-border:        var(--theme-cms-border, #2a2d3a);
  --cms-border-subtle: var(--theme-cms-border-subtle, #22252f);
  --cms-text:          var(--theme-cms-text, #e4e4e7);
  --cms-text-muted:    var(--theme-cms-text-muted, #71717a);
  --cms-text-dim:      var(--theme-cms-text-dim, #52525b);
  --cms-radius:        var(--theme-radius, 8px);
  --cms-shadow-dropdown: var(--theme-shadow-popover, 0 8px 24px rgba(0,0,0,.4));
  --cms-green:         var(--theme-success, #22c55e);
  --cms-amber:         var(--theme-warning, #f59e0b);
  --cms-red:           var(--theme-danger, #ef4444);
  --cms-cyan:          var(--theme-info, #06b6d4);
  --cms-rose:          var(--theme-rose, #f43f5e);
  --cms-purple:        var(--theme-purple, #8b5cf6);
  /* subtle variants: same pattern */
}
```

### Host Provider (bythiagofigueiredo)

globals.css provides `--theme-*` tokens for dark and light, using Brand Guide v6 warm palette. CMS surfaces align with pinboard colors for visual cohesion.

### Backward Compatibility

Standalone consumers of cms-ui see no change — fallback values match current defaults exactly.

## 7. Files Changed

| File | Action |
|---|---|
| `apps/web/src/app/globals.css` | Rewrite @theme + @theme inline + pinboard vars (Brand Guide v6) + theme provider + print overrides |
| `apps/web/tailwind.config.ts` | Strip to minimal (darkMode + content paths) |
| `apps/web/src/styles/reader-pinboard.css` | Replace 14 hardcoded hex → var(--pb-*) |
| `apps/web/src/app/(public)/ad-theme.css` | Update to use canonical token names |
| `apps/web/lib/theme-constants.ts` | NEW — semantic layer |
| `@tn-figueiredo/cms-ui/styles.css` | Update to var(--theme-*, fallback) pattern |
| `@tn-figueiredo/cms-admin/styles.css` | Inherits from cms-ui (may need alignment check) |

## 8. Migration Strategy

1. Update globals.css with all canonical @theme tokens + Brand Guide v6 pinboard values
2. Fix reader-pinboard.css hardcoded hex → var()
3. Strip tailwind.config.ts to minimal
4. Create lib/theme-constants.ts
5. Update ad-theme.css
6. Update cms-ui upstream (separate PR to TN-Figueiredo/cms repo)
7. Bump cms-ui version in bythiagofigueiredo

Steps 1-5 are internal (single PR). Step 6-7 is external (separate PR).

## 9. Verification

- All hardcoded hex eliminated from CSS (except print override block)
- `npm run test:web` passes
- Dev server renders correctly in dark + light mode
- CMS area renders with brand-aligned warm palette
- Print preview uses tokenized values
- Tailwind IntelliSense shows all custom tokens (bg-brand-400, text-body, shadow-card, etc.)
