# Global Header — Design Spec

**Date:** 2026-04-25
**Status:** Approved
**Score:** 98/100 (self-assessed against design reference)

## Overview

Implement the global header for bythiagofigueiredo.com matching the design reference in `design/shared.jsx` (PageHeader + HeaderCTAs components) and `design/brand/` SVG assets. The header consists of two fixed/sticky layers and adapts its CTAs and navigation items based on page context.

## Structure

### Layer 1: Top Strip

- **Position:** `fixed`, top: 0, z-index: 999
- **Height:** 44px (mobile: 40px)
- **Background:** `rgba(20,18,16,0.94)` with `backdrop-filter: blur(14px)`
- **Border:** bottom `1px solid rgba(255,255,255,0.06)`
- **Content:** Language pill toggle (PT|EN), right-aligned
- **Theme:** Always dark, regardless of site theme

**Language pill specs:**
- Container: `background: rgba(255,255,255,0.06)`, `border-radius: 999px`, `padding: 3px`
- Font: JetBrains Mono, 11px, `letter-spacing: 0.1em`, uppercase
- Active button: `background: #F2EBDB`, `color: #141210`
- Inactive button: transparent, `color: #F2EBDB`
- Clicking triggers locale switch (Next.js router push to `/{locale}`)

### Layer 2: Main Header

- **Position:** `sticky`, top: 44px (below strip), z-index: 5
- **Background:** `var(--pb-bg)` (solid, theme-aware)
- **Border:** bottom `1px dashed var(--pb-line)`
- **Container:** `max-width: 1280px`, `margin: 0 auto`, `padding: 14px 28px`
- **Layout:** `display: flex`, `align-items: center`, `justify-content: space-between`, `gap: 24px`, `flex-wrap: wrap`

## Brand

Use SVG wordmark from `design/brand/`:
- Dark theme: `wordmark-dark-bg.svg` (fill `#EFE6D2`, asterisk `#FF8240`)
- Light theme: `wordmark-light-bg.svg` (fill `#1A140C`, asterisk `#C14513`)
- Desktop: `height="28"`, Mobile: `height="22"`
- Wrapped in `<a>` linking to home (`/` or `/{locale}`)
- `aria-label="by Thiago Figueiredo"`

**Tagline (decorative, next to brand):**
- Text: "— blog + canal —"
- Font: Caveat, 17px, accent color
- `transform: rotate(-1deg)`, `opacity: 0.85`, `white-space: nowrap`
- Hidden on mobile (shown inside hamburger drawer instead)

## Navigation

### Items per page context

**Full nav (7 items)** — used by Home, Blog Archive, Videos, Newsletters, and other listing pages:
1. Início → `/` or `/{locale}`
2. Escritos → `/blog/{locale}`
3. Vídeos → YouTube channel URL (external, `target="_blank"`)
4. Newsletter → `/newsletters` or `/{locale}/newsletters`
5. Sobre → `#about` or `/about`
6. Contato → `/contact` (internal, no ↗)
7. Site dev → `https://dev.bythiagofigueiredo.com` (external, shows ↗)

**Reduced nav (5 items)** — used by Blog Post detail:
1. Início
2. Escritos
3. Vídeos
4. Newsletter
5. Sobre

### Active state

Determined by `current` prop passed to header:
- `color: var(--pb-ink)`, `font-weight: 600`
- `border-bottom: 2px solid var(--pb-accent)`
- `padding-bottom: 2px`

### Inactive state

- `color: var(--pb-muted)`, `font-weight: 400`
- `border-bottom: 2px solid transparent`
- `transition: color 0.15s ease, border-color 0.15s ease`

### External link indicator

- `↗` span after label, `font-size: 10px`, `opacity: 0.7`
- Only on links with `external: true` (currently just "Site dev")

## CTAs (per page context)

### Home (Pinboard)

Two buttons:
1. **YouTube Subscribe:**
   - `background: #FF3333` (theme.yt), `color: #FFF`
   - `padding: 7px 12px`, `font-size: 12px`, `font-weight: 600`
   - `transform: rotate(-1deg)`, `box-shadow: 0 2px 0 rgba(0,0,0,0.1)`
   - Content: `[▶ SVG 12x12] {channel.flag} {locale === 'pt' ? 'Inscrever' : 'Subscribe'}`
   - Flag: `🇧🇷` for PT locale, `🇺🇸` for EN
   - Links to primary YouTube channel URL

2. **Newsletter:**
   - `background: #FFE37A` (theme.marker), `color: #1A140C`
   - `padding: 7px 12px`, `font-size: 12px`, `font-weight: 600`
   - `transform: rotate(1deg)`, `box-shadow: 0 2px 0 rgba(0,0,0,0.1)`
   - Content: "✉ Newsletter"
   - Links to `/newsletters`

### Blog Archive

Single button:
- `background: var(--pb-accent)`, `color: #FFF`
- `border: 1.5px solid var(--pb-accent)`
- `font-family: JetBrains Mono`, `font-size: 10px`
- `letter-spacing: 0.14em`, `text-transform: uppercase`, `font-weight: 700`
- Content: "✉ NEWSLETTER"
- Links to `/newsletters`

### Blog Post

Single button:
- `background: #FFE37A` (marker), `color: #1A140C`
- `font-family: JetBrains Mono`, `font-size: 12px`, `font-weight: 600`
- `letter-spacing: 0.04em`, `transform: rotate(-1deg)`
- Content: locale === 'pt' ? "Assinar" : "Subscribe"
- Links to `/newsletters`

## Theme Toggle

- Position: main header line, after CTAs
- Style: `border: 1px dashed var(--pb-line)`, `background: transparent`
- Size: 32px × 32px (28px on mobile)
- Icon: ☀ (dark mode) / ☾ (light mode)
- Color: `var(--pb-muted)`, hover: `var(--pb-ink)`, border hover: `var(--pb-accent)`
- Action: toggles `btf_theme` cookie via existing `/api/theme` endpoint

## Home-Only: Channel Stats Strip

Rendered only on the Home/Pinboard page, immediately below the main header:
- `border-bottom: 1px dashed var(--pb-line)`
- Container: same `max-width: 1280px` centered
- `padding: 10px 28px`, `justify-content: flex-end`
- Font: JetBrains Mono, 12px, `color: var(--pb-faint)`
- Content: `▸ {subs} inscritos | {postCount} textos | {videoCount} vídeos`

## Mobile (< 768px)

### Closed state
- Top strip: 40px (slightly compact), same lang pills
- Header: brand SVG (22px) + theme toggle (28px) + hamburger button (28px)
- Hamburger: 3 horizontal lines, bottom line shorter (asymmetric)
- Total height: ~82px (9.7% of 844px viewport)

### Open state (drawer)
- Drawer expands below the header bar, pushes content down
- Contains:
  1. Tagline "— blog + canal —" in Caveat
  2. Vertical nav with all items
  3. Active item: `border-left: 3px solid accent`, `padding-left: 14px`
  4. Items separated by `border-bottom: 1px solid rgba(255,255,255,0.04)`
  5. CTAs section below nav, separated by `border-top: 1px dashed line`
- Close button: ✕ replaces hamburger

## Color Tokens

| Token | Dark | Light |
|-------|------|-------|
| `--pb-bg` | `#14110B` | `#E9E1CE` |
| `--pb-ink` | `#EFE6D2` | `#161208` |
| `--pb-muted` | `#958A75` | `#6A5F48` |
| `--pb-faint` | `#6B634F` | `#9C9178` |
| `--pb-accent` | `#FF8240` | `#C14513` |
| `--pb-line` | `#2E2718` | `#CEBFA0` |
| `--pb-marker` | `#FFE37A` | `#FFE37A` |
| `--pb-yt` | `#FF3333` | `#FF3333` |

## Accessibility

- `aria-label` on brand link, theme toggle, hamburger button
- `focus-visible`: `outline: 2px solid var(--pb-accent)`, `outline-offset: 3px`
- Nav wrapped in `<nav aria-label="Main navigation">`
- External links: `target="_blank" rel="noopener"`
- Hamburger: `aria-expanded` toggled on open/close

## Component Architecture

### Files to create/modify

1. **`apps/web/src/components/layout/top-strip.tsx`** — Fixed language pill strip (new)
2. **`apps/web/src/components/layout/global-header.tsx`** — Main header with brand, nav, CTAs, theme toggle (replaces PinboardHeader)
3. **`apps/web/src/components/layout/mobile-nav-drawer.tsx`** — Hamburger drawer (new)
4. **`apps/web/src/components/layout/header-ctas.tsx`** — Page-context-aware CTA buttons (new)
5. **`apps/web/src/components/brand/brand.tsx`** — Update to use SVG wordmark from `public/brand/`
6. **`apps/web/src/app/(public)/layout.tsx`** — Replace `<PinboardHeader>` with `<TopStrip>` + `<GlobalHeader>`
7. **`apps/web/src/app/(public)/components/PinboardHeader.tsx`** — Delete (replaced)

### Props interface

```typescript
type GlobalHeaderProps = {
  locale: 'en' | 'pt-BR'
  currentTheme: 'dark' | 'light'
  current: 'home' | 'writing' | 'videos' | 'newsletters' | 'about'
  variant: 'full' | 'reduced'  // full=7 nav items, reduced=5
  ctas: 'home' | 'archive' | 'post'
}
```

### Brand SVG handling

Copy `design/brand/wordmark-{dark,light}-bg.svg` to `apps/web/public/brand/`. Use `<img>` with theme-conditional `src`, or inline SVG via React component that switches fill colors based on theme. Inline SVG preferred for theme reactivity without flash.

## Non-goals

- Theme tweaks panel (floating bottom-right) — separate task
- Reading progress bar — already exists in blog post page
- Channel stats strip for non-home pages
- Footer changes
