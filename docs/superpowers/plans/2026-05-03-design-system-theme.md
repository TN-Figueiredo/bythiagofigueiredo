# Design System Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all design tokens into Tailwind v4 native `@theme` blocks, align to Brand Guide v6, tokenize all hardcoded values, add fontSize/shadow/radius/z-index/letterSpacing/animation scales, create semantic theme-constants layer, and make cms-ui themeable.

**Architecture:** globals.css becomes the single source of truth via `@theme` (canonical tokens) + `@theme inline` (CSS var bridges). Pinboard palette updated to Brand Guide v6 with dark/light/print overrides. tailwind.config.ts stripped to minimal. reader-pinboard.css purged of hardcoded hex. New `lib/theme-constants.ts` for semantic class maps. cms-ui upstream updated to `var(--theme-*, fallback)` pattern.

**Tech Stack:** Tailwind CSS v4 (`@theme`/`@theme inline`), Next.js 15, CSS custom properties, TypeScript

---

## Parallelization Map

```
Task 1 (globals.css)  ──┐
Task 2 (config.ts)    ──┤── can run in parallel (no cross-deps)
Task 3 (pinboard.css) ──┤
Task 4 (ad-theme.css) ──┤
Task 5 (constants.ts) ──┘
Task 6 (cms-ui)       ──── fully independent (external repo)
Task 7 (verification) ──── runs after all above complete
```

---

### Task 1: Rewrite globals.css — canonical @theme + Brand Guide v6

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Replace the entire globals.css with the canonical theme**

Replace the full content of `apps/web/src/app/globals.css` with:

```css
@import '@tn-figueiredo/cms-ui/styles.css' layer(packages);
@import '@tn-figueiredo/cms-admin/styles.css' layer(packages);
@import '../styles/reader-pinboard.css';
@import "tailwindcss";

@source "../components";
@source "../../lib";

/* ══════════════════════════════════════════════════════════════
   CANONICAL TOKENS — single source of truth
   ══════════════════════════════════════════════════════════════ */

@theme {
  /* ─── Brand palette (orange scale) ─── */
  --color-brand-50:  #FFF4ED;
  --color-brand-100: #FFE4D0;
  --color-brand-200: #FFC49E;
  --color-brand-300: #FFA06C;
  --color-brand-400: #FF8240;
  --color-brand-500: #E0651E;
  --color-brand-600: #B84D14;
  --color-brand-700: #8F3A0F;
  --color-brand-800: #6B2C0C;
  --color-brand-900: #4A1E08;

  /* ─── Backward compat: primary-* aliases → brand-* ─── */
  --color-primary-50:  #FFF4ED;
  --color-primary-100: #FFE4D0;
  --color-primary-200: #FFC49E;
  --color-primary-300: #FFA06C;
  --color-primary-400: #FF8240;
  --color-primary-500: #E0651E;
  --color-primary-600: #B84D14;
  --color-primary-700: #8F3A0F;
  --color-primary-800: #6B2C0C;
  --color-primary-900: #4A1E08;

  /* ─── YouTube / Marker (constant across themes) ─── */
  --color-yt:     #FF3333;
  --color-marker: #FFE37A;

  /* ─── Font families ─── */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;

  /* ─── Typography scale ─── */
  --font-size-4xs: 9px;
  --font-size-4xs--line-height: 12px;
  --font-size-3xs: 10px;
  --font-size-3xs--line-height: 14px;
  --font-size-2xs: 11px;
  --font-size-2xs--line-height: 15px;
  --font-size-xs: 12px;
  --font-size-xs--line-height: 16px;
  --font-size-sm: 13px;
  --font-size-sm--line-height: 18px;
  --font-size-base: 14px;
  --font-size-base--line-height: 20px;
  --font-size-md: 17px;
  --font-size-md--line-height: 26px;
  --font-size-body: 19px;
  --font-size-body--line-height: 32px;
  --font-size-lg: 22px;
  --font-size-lg--line-height: 28px;
  --font-size-xl: clamp(1.5rem, 2vw + 0.5rem, 2rem);
  --font-size-xl--line-height: 1.15;
  --font-size-display: clamp(2.25rem, 4vw + 1rem, 4rem);
  --font-size-display--line-height: 1.1;

  /* ─── Letter spacing ─── */
  --letter-spacing-tighter: -0.03em;
  --letter-spacing-tight: -0.015em;
  --letter-spacing-normal: 0em;
  --letter-spacing-wide: 0.04em;
  --letter-spacing-wider: 0.08em;
  --letter-spacing-widest: 0.14em;
  --letter-spacing-ultra: 0.18em;

  /* ─── Border radius ─── */
  --radius-sm: 2px;
  --radius-md: 3px;
  --radius-DEFAULT: 6px;
  --radius-lg: 8px;
  --radius-xl: 10px;
  --radius-full: 9999px;

  /* ─── Z-index scale ─── */
  --z-index-fab: 89;
  --z-index-pill: 90;
  --z-index-overlay: 94;
  --z-index-drawer: 95;
  --z-index-sheet: 96;
  --z-index-progress: 99;
  --z-index-tooltip: 100;
  --z-index-popover: 200;

  /* ─── Animations ─── */
  --animate-fade-in: fade-in 0.3s ease both;
  --animate-fade-in-up: fade-in-up 0.5s ease both;
  --animate-fade-in-up-1: fade-in-up 0.5s ease 0.07s both;
  --animate-fade-in-up-2: fade-in-up 0.5s ease 0.14s both;
  --animate-fade-in-up-3: fade-in-up 0.5s ease 0.21s both;
  --animate-fade-in-up-4: fade-in-up 0.5s ease 0.28s both;
  --animate-shimmer: shimmer 1.5s ease-in-out infinite;
  --animate-slide-in: slide-in 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  --animate-pulse-subtle: pulse-subtle 2s ease-in-out infinite;
}

/* ─── Dynamic bridges: CSS vars → Tailwind classes ─── */
@theme inline {
  /* Font vars from Next.js Google Fonts (set on <html>) */
  --font-fraunces:     var(--font-fraunces-var);
  --font-jetbrains:    var(--font-jetbrains-var);
  --font-caveat:       var(--font-caveat-var);
  --font-source-serif: var(--font-source-serif-var);

  /* Pinboard palette (switches via data-theme) */
  --color-pb-bg:          var(--pb-bg);
  --color-pb-paper:       var(--pb-paper);
  --color-pb-paper2:      var(--pb-paper2);
  --color-pb-ink:         var(--pb-ink);
  --color-pb-muted:       var(--pb-muted);
  --color-pb-faint:       var(--pb-faint);
  --color-pb-line:        var(--pb-line);
  --color-pb-accent:      var(--pb-accent);
  --color-pb-accent-deep: var(--pb-accent-deep);
  --color-pb-yt:          var(--pb-yt);
  --color-pb-marker:      var(--pb-marker);
  --color-pb-code-bg:     var(--pb-code-bg);

  /* Shadows (switch via data-theme) */
  --shadow-sm:      var(--pb-shadow-sm);
  --shadow-card:    var(--pb-shadow-card);
  --shadow-md:      var(--pb-shadow-md);
  --shadow-lg:      var(--pb-shadow-lg);
  --shadow-hover:   var(--pb-shadow-hover);
  --shadow-popover: var(--pb-shadow-popover);

  /* CMS design system colors (from @tn-figueiredo/cms-ui) */
  --color-cms-bg:            var(--cms-bg);
  --color-cms-surface:       var(--cms-surface);
  --color-cms-surface-hover: var(--cms-surface-hover);
  --color-cms-border:        var(--cms-border);
  --color-cms-border-subtle: var(--cms-border-subtle);
  --color-cms-text:          var(--cms-text);
  --color-cms-text-muted:    var(--cms-text-muted);
  --color-cms-text-dim:      var(--cms-text-dim);
  --color-cms-accent:        var(--cms-accent);
  --color-cms-accent-hover:  var(--cms-accent-hover);
  --color-cms-accent-subtle: var(--cms-accent-subtle);
  --color-cms-green:         var(--cms-green);
  --color-cms-green-subtle:  var(--cms-green-subtle);
  --color-cms-amber:         var(--cms-amber);
  --color-cms-amber-subtle:  var(--cms-amber-subtle);
  --color-cms-red:           var(--cms-red);
  --color-cms-red-subtle:    var(--cms-red-subtle);
  --color-cms-cyan:          var(--cms-cyan);
  --color-cms-cyan-subtle:   var(--cms-cyan-subtle);
  --color-cms-rose:          var(--cms-rose);
  --color-cms-rose-subtle:   var(--cms-rose-subtle);
  --color-cms-purple:        var(--cms-purple);
  --color-cms-purple-subtle: var(--cms-purple-subtle);
}

/* ══════════════════════════════════════════════════════════════
   PINBOARD PALETTE — dark/light via data-theme + THEME PROVIDER
   ══════════════════════════════════════════════════════════════ */

:root,
[data-theme="dark"] {
  /* Pinboard — Brand Guide v6 dark */
  --pb-bg:          #1A1714;
  --pb-paper:       #221E1A;
  --pb-paper2:      #2A251F;
  --pb-ink:         #F5EFE6;
  --pb-muted:       #958A75;
  --pb-faint:       #6B634F;
  --pb-line:        #332D25;
  --pb-accent:      #FF8240;
  --pb-accent-deep: #E0651E;
  --pb-yt:          #FF3333;
  --pb-marker:      #FFE37A;
  --pb-tape:        rgba(255, 226, 140, 0.42);
  --pb-tape2:       rgba(209, 224, 255, 0.36);
  --pb-tapeR:       rgba(255, 120, 120, 0.40);
  --pb-code-bg:     #141210;

  /* Shadows — dark */
  --pb-shadow-sm:      0 1px 2px rgba(0,0,0,0.3);
  --pb-shadow-card:    0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03);
  --pb-shadow-md:      0 4px 12px rgba(0,0,0,0.4);
  --pb-shadow-lg:      0 8px 32px rgba(0,0,0,0.5);
  --pb-shadow-hover:   0 2px 0 rgba(0,0,0,0.6), 0 20px 40px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05);
  --pb-shadow-popover: 0 12px 40px rgba(0,0,0,0.28);

  /* Theme provider for cms-ui */
  --theme-accent:            #FF8240;
  --theme-accent-hover:      #FF9A60;
  --theme-accent-subtle:     rgba(255, 130, 64, 0.12);
  --theme-cms-bg:            #1A1714;
  --theme-cms-surface:       #221E1A;
  --theme-cms-surface-hover: #2A251F;
  --theme-cms-border:        #332D25;
  --theme-cms-border-subtle: #2A251F;
  --theme-cms-text:          #F5EFE6;
  --theme-cms-text-muted:    #958A75;
  --theme-cms-text-dim:      #6B634F;
  --theme-radius:            2px;
  --theme-shadow-popover:    0 12px 40px rgba(0,0,0,0.28);
  --theme-success:           #22c55e;
  --theme-warning:           #f59e0b;
  --theme-danger:            #ef4444;
  --theme-info:              #06b6d4;
  --theme-rose:              #f43f5e;
  --theme-purple:            #8b5cf6;

  /* Backward compat aliases for components using old generic vars */
  --bg:               var(--pb-bg);
  --bg-surface:       var(--pb-paper);
  --bg-surface-hover: var(--pb-paper2);
  --bg-subtle:        var(--pb-paper2);
  --text:             var(--pb-ink);
  --text-secondary:   var(--pb-muted);
  --text-tertiary:    var(--pb-faint);
  --border:           var(--pb-line);
  --border-light:     var(--pb-line);
  --ring:             rgba(255, 130, 64, 0.3);
  --accent:           var(--pb-accent);
}

[data-theme="light"] {
  /* Pinboard — Brand Guide v6 light */
  --pb-bg:          #F7F1E8;
  --pb-paper:       #FBF6EC;
  --pb-paper2:      #F5EDD6;
  --pb-ink:         #1F1B17;
  --pb-muted:       #6A5F48;
  --pb-faint:       #9C9178;
  --pb-line:        #CEBFA0;
  --pb-accent:      #E0651E;
  --pb-accent-deep: #C14513;
  --pb-yt:          #FF3333;
  --pb-marker:      #FFE37A;
  --pb-tape:        rgba(255, 226, 140, 0.75);
  --pb-tape2:       rgba(200, 220, 255, 0.70);
  --pb-tapeR:       rgba(255, 150, 150, 0.70);
  --pb-code-bg:     #EDE5D2;

  /* Shadows — light (warm tones) */
  --pb-shadow-sm:      0 1px 2px rgba(70,50,20,0.08);
  --pb-shadow-card:    0 1px 0 rgba(0,0,0,0.04), 0 8px 20px rgba(70,50,20,0.16), inset 0 0 0 1px rgba(0,0,0,0.03);
  --pb-shadow-md:      0 4px 12px rgba(70,50,20,0.12);
  --pb-shadow-lg:      0 8px 32px rgba(70,50,20,0.18);
  --pb-shadow-hover:   0 1px 0 rgba(0,0,0,0.06), 0 16px 36px rgba(70,50,20,0.24), inset 0 0 0 1px rgba(0,0,0,0.04);
  --pb-shadow-popover: 0 12px 40px rgba(70,50,20,0.20);

  /* Theme provider for cms-ui — light */
  --theme-accent-hover:      #C14513;
  --theme-accent-subtle:     rgba(224, 101, 30, 0.10);
  --theme-cms-bg:            #F7F1E8;
  --theme-cms-surface:       #FBF6EC;
  --theme-cms-surface-hover: #F5EDD6;
  --theme-cms-border:        #CEBFA0;
  --theme-cms-border-subtle: #DDD4BE;
  --theme-cms-text:          #1F1B17;
  --theme-cms-text-muted:    #6A5F48;
  --theme-cms-text-dim:      #9C9178;
  --theme-shadow-popover:    0 12px 40px rgba(70,50,20,0.20);

  /* Backward compat aliases — light overrides */
  --ring: rgba(224, 101, 30, 0.3);
}

/* ─── Print palette ─── */
@media print {
  :root, [data-theme="dark"], [data-theme="light"] {
    --pb-bg:          #ffffff;
    --pb-paper:       #ffffff;
    --pb-paper2:      #f5f5f5;
    --pb-ink:         #1a1a1a;
    --pb-muted:       #666666;
    --pb-faint:       #999999;
    --pb-line:        #cccccc;
    --pb-accent:      #1a1a1a;
    --pb-accent-deep: #1a1a1a;
    --pb-marker:      #FFD666;
    --pb-code-bg:     #f5f5f5;
    --pb-shadow-sm:      none;
    --pb-shadow-card:    none;
    --pb-shadow-md:      none;
    --pb-shadow-lg:      none;
    --pb-shadow-hover:   none;
    --pb-shadow-popover: none;
  }
}

/* ══════════════════════════════════════════════════════════════
   BASE STYLES
   ══════════════════════════════════════════════════════════════ */

html {
  scroll-behavior: smooth;
  background-color: var(--pb-bg);
}

body {
  background-color: var(--pb-bg);
  color: var(--pb-ink);
  font-family: var(--font-sans);
  transition: background-color 0.3s, color 0.3s;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ─── Header focus-visible ─── */
header a:focus-visible,
header button:focus-visible {
  outline: 2px solid var(--pb-accent);
  outline-offset: 3px;
}

/* ─── Scroll-driven fade-in ─── */
@supports (animation-timeline: view()) {
  .animate-on-scroll {
    animation: fade-in-up linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 30%;
  }
}

@supports not (animation-timeline: view()) {
  .animate-on-scroll {
    animation: fade-in-up 0.6s ease-out both;
  }
}

/* ─── Staggered section entrance ─── */
.pb-fade-in { animation: fade-in 0.4s ease both; }
.pb-section { animation: fade-in-up 0.5s ease both; }
.pb-section:nth-child(2) { animation-delay: 0.07s; }
.pb-section:nth-child(3) { animation-delay: 0.14s; }
.pb-section:nth-child(4) { animation-delay: 0.21s; }
.pb-section:nth-child(5) { animation-delay: 0.28s; }

/* Semantic marker for paper cards — no visual effect */
.pb-rotate {}

/* ─── DualHero card hover ─── */
.dh-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.dh-card:hover {
  transform: rotate(-0.8deg) translateY(-3px) !important;
}
.dh-card-video:hover {
  transform: rotate(0.8deg) translateY(-3px) !important;
}
[data-theme="dark"] .dh-card:hover,
:root .dh-card:hover {
  box-shadow: var(--pb-shadow-hover) !important;
}
[data-theme="light"] .dh-card:hover {
  box-shadow: var(--pb-shadow-hover) !important;
}

@media (prefers-reduced-motion: reduce) {
  .pb-tape   { display: none !important; }
  .pb-section { animation: none !important; }
}

/* ══════════════════════════════════════════════════════════════
   KEYFRAMES (centralized)
   ══════════════════════════════════════════════════════════════ */

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes slide-in {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

@keyframes pulse-subtle {
  0%, 100% { opacity: 0.3; }
  50%      { opacity: 1; }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx next build --experimental-build-mode compile 2>&1 | head -30`

If Tailwind reports errors about unknown theme keys, check the `@theme` token naming against Tailwind v4 docs. The `--font-size-*--line-height` convention is Tailwind v4 native.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(theme): rewrite globals.css with canonical @theme tokens + Brand Guide v6"
```

---

### Task 2: Strip tailwind.config.ts to minimal

**Files:**
- Modify: `apps/web/tailwind.config.ts`

- [ ] **Step 1: Replace tailwind.config.ts with minimal config**

Replace the full content of `apps/web/tailwind.config.ts` with:

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
}

export default config
```

All fontFamily, animation, and keyframes definitions are now in `@theme` blocks in globals.css.

- [ ] **Step 2: Commit**

```bash
git add apps/web/tailwind.config.ts
git commit -m "chore(theme): strip tailwind.config.ts — tokens moved to @theme"
```

---

### Task 3: Fix reader-pinboard.css — eliminate hardcoded hex

**Files:**
- Modify: `apps/web/src/styles/reader-pinboard.css`

There are 14 hardcoded hex values that must become `var(--pb-*)` references.

- [ ] **Step 1: Replace hardcoded hex values**

Make these exact replacements in `apps/web/src/styles/reader-pinboard.css`:

**Line 156** — blockquote background:
```css
/* OLD */ background: #2a241a;
/* NEW */ background: var(--pb-paper);
```

**Line 164** — blockquote color:
```css
/* OLD */ color: #efe6d2;
/* NEW */ color: var(--pb-ink);
```

**Line 230** — code block background:
```css
/* OLD */ background: #1A140C;
/* NEW */ background: var(--pb-code-bg);
```

**Line 231** — code block color:
```css
/* OLD */ color: #F2EBDB;
/* NEW */ color: var(--pb-ink);
```

**Line 236** — code block border:
```css
/* OLD */ border: 1px solid rgba(26, 20, 12, 0.9);
/* NEW */ border: 1px solid var(--pb-line);
```

**Line 244** — code span color:
```css
/* OLD */ color: #F2EBDB;
/* NEW */ color: var(--pb-ink);
```

**Lines 304-305** — callout borders:
```css
/* OLD */ border-top: 2px solid #ff8240;
/* OLD */ border-bottom: 2px solid #ff8240;
/* NEW */ border-top: 2px solid var(--pb-accent);
/* NEW */ border-bottom: 2px solid var(--pb-accent);
```

**Line 306** — callout background:
```css
/* OLD */ background: #312a1e;
/* NEW */ background: var(--pb-paper2);
```

**Line 314** — callout color:
```css
/* OLD */ color: #efe6d2;
/* NEW */ color: var(--pb-ink);
```

**Line 397** — newsletter CTA color:
```css
/* OLD */ color: #1A140C;
/* NEW */ color: var(--pb-ink);
```

- [ ] **Step 2: Fix print styles to use var()**

Replace the print `pre` block (lines 479-486) with:

```css
  .reader-article .blog-body pre {
    background: var(--pb-paper2) !important;
    color: var(--pb-ink) !important;
    border: 1px solid var(--pb-line) !important;
    white-space: pre-wrap;
    word-break: break-all;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
```

Replace the print `mark.btf-hl` block (lines 487-490) with:

```css
  mark.btf-hl {
    background: var(--pb-marker) !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
```

Replace the print link color (line 476) with:

```css
/* OLD */ color: #666;
/* NEW */ color: var(--pb-muted);
```

- [ ] **Step 3: Update keyframe names to match centralized names**

Replace (lines 434-447):

```css
/* OLD */
@keyframes btfFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes btfSlideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes btfPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
```

With:

```css
@keyframes btfFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

Keep only `btfFadeIn` since it's referenced by name in `.blog-fn-popover` (line 290) and `.blog-time-pill` (line 369). The other two (`btfSlideIn`, `btfPulse`) are now centralized in globals.css as `slide-in` and `pulse-subtle`. If any component references them by the old name, update that reference.

Verify no references to `btfSlideIn` or `btfPulse` exist:

```bash
grep -rn "btfSlideIn\|btfPulse" apps/web/src/ --include="*.tsx" --include="*.css"
```

- [ ] **Step 4: Update shadow references in reader-pinboard.css**

Replace the hardcoded shadow in `.blog-fn-popover` (line 284):

```css
/* OLD */ box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
/* NEW */ box-shadow: var(--pb-shadow-popover);
```

Replace the hardcoded shadow in `.ai-reader-drawer` (line 414):

```css
/* OLD */ box-shadow: -20px 0 60px rgba(0,0,0,0.25);
/* NEW */ box-shadow: -20px 0 60px rgba(0,0,0,0.25);
```

Keep the AI reader drawer shadow as-is — it's a directional shadow specific to the drawer, not a generic token.

- [ ] **Step 5: Verify zero hardcoded hex remain (except print override block in globals.css)**

Run:

```bash
grep -n '#[0-9a-fA-F]\{3,8\}' apps/web/src/styles/reader-pinboard.css | grep -v 'var(' | grep -v '^\s*/\*'
```

Expected: Zero results (or only the `mark.btf-hl` gradient which uses `rgba()` not hex).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/styles/reader-pinboard.css
git commit -m "fix(theme): replace 14 hardcoded hex in reader-pinboard.css with var(--pb-*)"
```

---

### Task 4: Update ad-theme.css

**Files:**
- Modify: `apps/web/src/app/(public)/ad-theme.css`

- [ ] **Step 1: Replace ad-theme.css content**

Replace `apps/web/src/app/(public)/ad-theme.css` with:

```css
:root {
  --ad-bg: var(--pb-paper2);
  --ad-bg-alt: var(--pb-paper);
  --ad-text: var(--pb-ink);
  --ad-text-muted: var(--pb-muted);
  --ad-accent: var(--pb-accent);
  --ad-border: var(--pb-line);
  --ad-font-body: var(--font-source-serif);
  --ad-font-heading: var(--font-fraunces);
  --ad-font-mono: var(--font-jetbrains);
}
```

The change: `--ad-font-body` was `var(--font-inter)` (wrong — body should be Source Serif per Brand Guide), `--ad-font-heading` was `var(--font-source-serif)` (wrong — headings should be Fraunces per Brand Guide). Fixed to match brand typography stack.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/(public)/ad-theme.css
git commit -m "fix(theme): align ad-theme.css fonts with Brand Guide v6 typography stack"
```

---

### Task 5: Create lib/theme-constants.ts

**Files:**
- Create: `apps/web/lib/theme-constants.ts`

- [ ] **Step 1: Create the semantic theme constants file**

Create `apps/web/lib/theme-constants.ts`:

```ts
export const STATUS_CLASSES = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  accent: 'bg-brand-100 text-brand-800 dark:bg-brand-900/20 dark:text-brand-400',
} as const

export type StatusVariant = keyof typeof STATUS_CLASSES

export const CHART_PALETTE = [
  '#FF8240',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#8b5cf6',
  '#f43f5e',
  '#14b8a6',
  '#FF3333',
  '#FFE37A',
] as const

export const CATEGORY_COLORS: Record<string, string> = {
  code: '#D65B1F',
  product: '#2F6B22',
  essay: '#1E4D7A',
  diary: '#8A4A8F',
  tools: '#B87333',
  career: '#5B6E2B',
}

export const ICON_BG = {
  brand: 'bg-brand-100 dark:bg-brand-900/20',
  green: 'bg-green-100 dark:bg-green-900/20',
  amber: 'bg-amber-100 dark:bg-amber-900/20',
  red: 'bg-red-100 dark:bg-red-900/20',
  blue: 'bg-blue-100 dark:bg-blue-900/20',
  purple: 'bg-purple-100 dark:bg-purple-900/20',
} as const
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/theme-constants.ts
git commit -m "feat(theme): add lib/theme-constants.ts semantic layer"
```

---

### Task 6: Update cms-ui upstream to var(--theme-*, fallback) pattern

**Files:**
- Modify: `/Users/figueiredo/Workspace/tnf-ecosystem/packages/cms-ui/src/styles.css`

This task runs in the separate `tnf-ecosystem` repo.

- [ ] **Step 1: Replace cms-ui styles.css with themeable pattern**

Replace the content of `/Users/figueiredo/Workspace/tnf-ecosystem/packages/cms-ui/src/styles.css` with:

```css
/* @tn-figueiredo/cms-ui — Design System Tokens + Utilities
   Import this file once in your app: @import '@tn-figueiredo/cms-ui/styles.css'
   
   Host apps can provide --theme-* CSS custom properties to override defaults.
   Without --theme-* vars, falls back to the original indigo/gray palette. */

@import "tailwindcss/utilities";

@source "./shell/**/*.tsx";
@source "./ui/**/*.tsx";

@theme {
  --color-cms-bg: var(--cms-bg);
  --color-cms-surface: var(--cms-surface);
  --color-cms-surface-hover: var(--cms-surface-hover);
  --color-cms-border: var(--cms-border);
  --color-cms-border-subtle: var(--cms-border-subtle);
  --color-cms-text: var(--cms-text);
  --color-cms-text-muted: var(--cms-text-muted);
  --color-cms-text-dim: var(--cms-text-dim);
  --color-cms-accent: var(--cms-accent);
  --color-cms-accent-hover: var(--cms-accent-hover);
  --color-cms-accent-subtle: var(--cms-accent-subtle);
  --color-cms-green: var(--cms-green);
  --color-cms-green-subtle: var(--cms-green-subtle);
  --color-cms-amber: var(--cms-amber);
  --color-cms-amber-subtle: var(--cms-amber-subtle);
  --color-cms-red: var(--cms-red);
  --color-cms-red-subtle: var(--cms-red-subtle);
  --color-cms-cyan: var(--cms-cyan);
  --color-cms-cyan-subtle: var(--cms-cyan-subtle);
  --color-cms-rose: var(--cms-rose);
  --color-cms-rose-subtle: var(--cms-rose-subtle);
  --color-cms-purple: var(--cms-purple);
  --color-cms-purple-subtle: var(--cms-purple-subtle);
  --shadow-cms-dropdown: var(--cms-shadow-dropdown);
}

/* ===== Dark theme (default) ===== */
[data-area="cms"] {
  --cms-bg:             var(--theme-cms-bg, #0f1117);
  --cms-surface:        var(--theme-cms-surface, #1a1d27);
  --cms-surface-hover:  var(--theme-cms-surface-hover, #1f2330);
  --cms-border:         var(--theme-cms-border, #2a2d3a);
  --cms-border-subtle:  var(--theme-cms-border-subtle, #22252f);
  --cms-text:           var(--theme-cms-text, #e4e4e7);
  --cms-text-muted:     var(--theme-cms-text-muted, #71717a);
  --cms-text-dim:       var(--theme-cms-text-dim, #52525b);
  --cms-accent:         var(--theme-accent, #6366f1);
  --cms-accent-hover:   var(--theme-accent-hover, #818cf8);
  --cms-accent-subtle:  var(--theme-accent-subtle, rgba(99,102,241,.12));
  --cms-green:          var(--theme-success, #22c55e);
  --cms-green-subtle:   rgba(from var(--cms-green) r g b / .12);
  --cms-amber:          var(--theme-warning, #f59e0b);
  --cms-amber-subtle:   rgba(from var(--cms-amber) r g b / .12);
  --cms-red:            var(--theme-danger, #ef4444);
  --cms-red-subtle:     rgba(from var(--cms-red) r g b / .12);
  --cms-cyan:           var(--theme-info, #06b6d4);
  --cms-cyan-subtle:    rgba(from var(--cms-cyan) r g b / .12);
  --cms-rose:           var(--theme-rose, #f43f5e);
  --cms-rose-subtle:    rgba(from var(--cms-rose) r g b / .12);
  --cms-purple:         var(--theme-purple, #8b5cf6);
  --cms-purple-subtle:  rgba(from var(--cms-purple) r g b / .12);
  --cms-radius:         var(--theme-radius, 8px);
  --cms-shadow-dropdown: var(--theme-shadow-popover, 0 8px 24px rgba(0,0,0,.4));
  --cms-sidebar-w: 230px;
}

/* ===== Light theme overrides ===== */
[data-theme="light"] [data-area="cms"] {
  --cms-bg:             var(--theme-cms-bg-light, var(--theme-cms-bg, #f8f9fb));
  --cms-surface:        var(--theme-cms-surface-light, var(--theme-cms-surface, #ffffff));
  --cms-surface-hover:  var(--theme-cms-surface-hover-light, var(--theme-cms-surface-hover, #f3f4f6));
  --cms-border:         var(--theme-cms-border-light, var(--theme-cms-border, #e5e7eb));
  --cms-border-subtle:  var(--theme-cms-border-subtle-light, var(--theme-cms-border-subtle, #f0f0f3));
  --cms-text:           var(--theme-cms-text-light, var(--theme-cms-text, #1f2937));
  --cms-text-muted:     var(--theme-cms-text-muted-light, var(--theme-cms-text-muted, #6b7280));
  --cms-text-dim:       var(--theme-cms-text-dim-light, var(--theme-cms-text-dim, #9ca3af));
  --cms-accent:         var(--theme-accent, #6366f1);
  --cms-accent-hover:   var(--theme-accent-hover-light, var(--theme-accent-hover, #4f46e5));
  --cms-accent-subtle:  var(--theme-accent-subtle-light, var(--theme-accent-subtle, rgba(99,102,241,.08)));
  --cms-green-subtle:   rgba(from var(--cms-green) r g b / .08);
  --cms-amber-subtle:   rgba(from var(--cms-amber) r g b / .08);
  --cms-red-subtle:     rgba(from var(--cms-red) r g b / .08);
  --cms-cyan-subtle:    rgba(from var(--cms-cyan) r g b / .08);
  --cms-rose-subtle:    rgba(from var(--cms-rose) r g b / .08);
  --cms-purple-subtle:  rgba(from var(--cms-purple) r g b / .08);
  --cms-shadow-dropdown: var(--theme-shadow-popover-light, var(--theme-shadow-popover, 0 8px 24px rgba(0,0,0,.12)));
}

/* ===== Keyframes ===== */
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@utility animate-shimmer {
  animation: shimmer 1.5s linear infinite;
}
```

Note: The `rgba(from var(...) r g b / .12)` syntax is the CSS relative color syntax supported in modern browsers and Tailwind v4. It auto-derives subtle variants from the base color, eliminating the need for separate subtle color vars from the host.

- [ ] **Step 2: Build and test**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem/packages/cms-ui
npm run build
```

Expected: Build succeeds, `dist/styles.css` contains the updated token structure.

- [ ] **Step 3: Bump version**

In `/Users/figueiredo/Workspace/tnf-ecosystem/packages/cms-ui/package.json`, bump version from `0.1.3` to `0.2.0` (minor bump — new theming API is backward compatible but changes behavior when `--theme-*` vars are present).

- [ ] **Step 4: Commit and publish**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
git add packages/cms-ui/
git commit -m "feat(cms-ui): make theme tokens overridable via --theme-* CSS custom properties"
npm publish -w packages/cms-ui
```

- [ ] **Step 5: Update bythiagofigueiredo to consume new version**

Back in bythiagofigueiredo:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm install @tn-figueiredo/cms-ui@0.2.0
git add package.json package-lock.json
git commit -m "chore: bump @tn-figueiredo/cms-ui to 0.2.0 (themeable tokens)"
```

---

### Task 7: Verification

**Files:** None (read-only verification)

- [ ] **Step 1: Run tests**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run test:web
```

Expected: All tests pass.

- [ ] **Step 2: Verify zero hardcoded hex in CSS (except print override)**

```bash
grep -rn '#[0-9a-fA-F]\{3,8\}' apps/web/src/styles/reader-pinboard.css | grep -v 'var(' | grep -v '^\s*/\*'
```

Expected: Zero results.

```bash
grep -rn '#[0-9a-fA-F]\{3,8\}' apps/web/src/app/globals.css | grep -v '@theme' | grep -v 'var(' | grep -v '^\s*/\*' | grep -v '@media print' -A 20
```

Expected: Only hex values inside `@theme {}` blocks and the `@media print` override block. No loose hardcoded hex elsewhere.

- [ ] **Step 3: Verify Tailwind IntelliSense tokens**

Start dev server and check that these Tailwind classes resolve:

- `bg-brand-400` → `#FF8240`
- `text-body` → `19px` font-size with `32px` line-height
- `shadow-card` → card shadow value
- `rounded-sm` → `2px`
- `z-popover` → `200`
- `tracking-widest` → `0.14em`
- `font-fraunces` → Fraunces font stack
- `bg-pb-bg` → pinboard background (dynamic)
- `text-pb-ink` → pinboard ink (dynamic)
- `animate-fade-in` → fade-in animation

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run dev -- --port 3099 &
sleep 5
curl -s http://localhost:3099 | grep -c 'pb-bg\|pb-ink\|brand-400' || echo "Check manually"
kill %1
```

- [ ] **Step 4: Visual check — dark + light mode**

Start dev server and verify in browser:
1. Dark mode (default): warm brown tones matching Brand Guide v6
2. Light mode: warm cream/beige matching Brand Guide v6
3. CMS area: accent is orange (#FF8240) not indigo
4. Blog post: no hardcoded colors leaking through
5. Print preview (Cmd+P): clean black/white, no colored shadows

- [ ] **Step 5: Commit verification notes**

No commit needed — this is a verification-only task.
