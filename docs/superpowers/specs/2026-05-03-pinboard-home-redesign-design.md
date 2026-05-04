# Pinboard Home Redesign — Design Spec

**Date:** 2026-05-03
**Status:** Approved
**Reference:** `design/Pinboard.html` + `design/pinboard.jsx`

## Summary

Redesign the Next.js home page (`apps/web/src/app/(public)/page.tsx`) to match the `design/Pinboard.html` reference. Key changes: separate Blog and Video sections (replace UnifiedFeed), add Most Read + Tag grid, add Newsletter+YouTube subscribe pair, add ad slot placeholders, rename "Writing"→"Blog", remove "Site dev" from nav, consolidate `blog_tags` as the sole taxonomy (deprecate legacy `category` column), handle empty states gracefully. Start with mocked data for visual approval before connecting real DB queries.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tags vs Categories | **Consolidate** — `blog_tags` is the single system | Migration `20260503000002` already backfilled categories→tags. Tags are per-site, have colors, editable via admin. Legacy `category` column is redundant. |
| Videos | **Placeholder/mock data** | YouTube API integration is a separate spec. Keep `SAMPLE_VIDEOS` from `videos-data.ts`. |
| Most Read | **Mock deterministic** | No view tracking exists. Pseudo-random pick seeded by day-of-year. Follow-up sprint adds real analytics. |
| Ads | **Slot containers only** | Render ad components with `null` data → nothing visible. Admin wires real campaigns later. |
| CSS approach | **`--pb-*` variables + Tailwind utilities** | Inline styles only for dynamic values (rotation, transforms). New CSS classes in `globals.css`. |
| Nav rename | **"Writing"→"Blog"** in both locales | User explicit request. href already points to `/blog`. |
| Nav removal | **Remove "Site dev"** | User explicit request. |

---

## Architecture

### CSS Variables (existing, no changes)

All colors reference `--pb-*` custom properties from `globals.css` (lines 168-271). Dark/light switch via `data-theme` attribute on `<html>`.

```
--pb-bg, --pb-paper, --pb-paper2, --pb-ink, --pb-muted, --pb-faint,
--pb-line, --pb-accent, --pb-yt, --pb-marker, --pb-code-bg
--pb-shadow-sm, --pb-shadow-card, --pb-shadow-md
```

### Component Reuse

- **Keep:** `PaperCard`, `Tape`, `PinboardFooter`, `DualHero` (adjust), `ChannelStrip` (adjust)
- **Delete:** `UnifiedFeed` (replaced by `BlogGrid` + `VideoGrid`), `NewsletterInline` (replaced by `SubscribePair`)
- **Create:** `BlogGrid`, `VideoGrid`, `MostReadSidebar`, `TagCategoryGrid`, `SubscribePair`, `StatsStrip`, `SectionHeader`

### Data Flow

```
PinboardHome (server component)
├── getFeaturedPost(locale)          → existing query
├── getLatestPosts(locale, 6)        → existing query
├── getNewslettersForLocale(locale)  → existing query
├── getTopTags(locale, 4)            → NEW query
├── getPostsByTag(locale, tagId, 2)  → NEW query (per tag)
├── getMostReadPosts(locale, 5)      → NEW (mock: deterministic shuffle)
├── getPostCount(locale)             → NEW query
├── SAMPLE_VIDEOS                    → existing static data
└── YOUTUBE_CHANNELS                 → existing static data
```

### New Type

```typescript
type HomeTag = {
  id: string
  name: string
  slug: string
  color: string
  colorDark: string | null
  postCount: number
}
```

---

## Sections (top → bottom)

### AD: Doorman Banner

- **Position:** Above everything, below top strip
- **Default:** OFF (not rendered unless ad data provided)
- **Component:** Reuse `doorman-ad.tsx` from `src/components/blog/ads/`
- **Behavior:** Dismissable via localStorage, `aria-label="Fechar anúncio"`
- **Empty state:** null ad → nothing renders

### Stats Strip

- **Position:** Below header, above Dual Hero
- **Content:** `▸ {subs} inscritos | {posts} posts | {videos} vídeos`
- **Font:** JetBrains Mono 12px, color `--pb-faint`
- **Border:** bottom dashed `--pb-line`
- **Data:** Post count from real query, subs/videos from mock constants
- **Max-width:** 1280px centered, padding `10px 28px`
- **Layout:** flex, justify-end, gap 18

### §1 Dual Hero — "destaque da semana"

- **Component:** `DualHero.tsx` (adjust existing)
- **Header:** Caveat handwriting "★ o destaque da semana" + divider line + "SEM {n} · {year}"
- **Layout:** 2-column grid (1fr 1fr), gap 40px

**Post card:**
- Paper card, rotation -0.8deg, shadow `--pb-shadow-card`
- 2 tapes (yellow `--pb-tape` + blue `--pb-tape2`)
- Cover gradient via `coverGradient(tag, isDark)` — use tag slug for hue mapping
- TypeBadge "▤ post" / "texto" (bg `--pb-ink`, white text)
- Tag name (color from `blog_tags.color`/`color_dark`) + date + reading time
- Title: Fraunces `clamp(24px, 2.8vw, 34px)`, weight 500
- Excerpt: 14.5px, muted, 3-line clamp
- Handwriting annotation: "← leitura obrigatória" / "← must-read"

**Video card:**
- Paper card, rotation +0.8deg
- 2 tapes (red `--pb-tapeR` + yellow `--pb-tape`)
- Thumbnail: aspect 16/9, gradient bg + play button overlay (68×48 red rounded rect)
- "▶ YouTube" badge top-left (red bg), duration badge bottom-right (black bg)
- Series badge (red bg) + views + date
- Title + description (same sizing as post card)
- Handwriting: "novo no canal →" / "fresh on the channel →"

**Empty states:**
- 0 posts + 0 videos → section hidden, show minimal hero with brand + tagline + newsletter CTA
- 0 posts, ≥1 video → video card full-width (`grid-cols-1`)
- ≥1 post, 0 videos → post card full-width (`grid-cols-1`)

### §2 Channel Strip

- **Component:** `ChannelStrip.tsx` (adjust existing)
- **Header:** Caveat handwriting "▶ dois canais, dois idiomas" + divider + "INSCREVA-SE EM UM OU NOS DOIS"
- **Layout:** 2-column grid, gap 28
- **Cards:** Paper card with red border (`2px solid --pb-yt`), tint warm (`--pb-paper` variant)
  - Channel avatar (56px circle, red bg, play icon, flag badge bottom-right)
  - Channel name (Fraunces 20px) + handle + subs count + schedule
  - Subscribe CTA button (red bg, white text)
- **Data:** `YOUTUBE_CHANNELS` from `videos-data.ts`
- **Empty state:** 0 channels → section hidden

### §3 Blog — 6 latest posts

- **Component:** `BlogGrid.tsx` (NEW, replaces UnifiedFeed for posts)
- **Section header:**
  - `§ 02 · blog` (JetBrains Mono 11px, accent color, uppercase)
  - "Últimos escritos" / "Latest writing" (Fraunces 42px, marker underline highlight)
  - Subtitle: "ensaios, código, diário — os 6 mais recentes"
  - Right: Caveat link "ver arquivo completo →" (accent color)

- **Layout:** 3-column grid, gap 40, rowGap 56
- **Cards:** PaperCard with tape, per the design:
  - Alternate tint: `index % 3 === 1 ? paper2 : paper`
  - Rotation: `((i * 37) % 7 - 3) * 0.5` deg
  - Y offset: `((i * 53) % 5 - 2) * 2` px
  - Cover gradient (by tag), aspect 16/10
  - TypeBadge "▤ post"
  - Tag badge (color from `blog_tags.color`/`color_dark`) + date
  - Title (Fraunces 19px)
  - Reading time (mono 12px)
  - Tag hashtags: up to 3, mono 9.5px, `#tag` format
  - First card: handwriting "⭐ top!" annotation

- **CTA:** "Ver todos os artigos →" centered button (mono, border `--pb-line`)

- **Empty states:**
  - 0 posts → Paper card with handwriting "ainda sem textos — mas vem coisa boa" + mini newsletter CTA
  - 1-2 posts → 1-2 columns, cards centered
  - 3-5 posts → grid with empty slots (no stretch)
  - 6+ → full 3×2 grid

### AD: Bookmark (inline sponsor)

- **Position:** Between Blog and Videos
- **Component:** Reuse `bookmark-ad.tsx`
- **Max-width:** 760px centered
- **Empty state:** null ad → nothing renders

### §4 Videos — 3 latest

- **Component:** `VideoGrid.tsx` (NEW)
- **Section header:**
  - `§ 03 · do canal` / `from the channel` (JetBrains Mono 11px, `--pb-yt` color)
  - "Últimos vídeos" / "Latest videos" (Fraunces 42px)
  - Subtitle: "live-coding, setup, bugs — os 3 mais recentes"
  - Right: Caveat link "ver todos os vídeos →" (`--pb-yt` color)
- **Separator:** `border-top: 1px dashed --pb-line`, marginTop 32
- **Layout:** 3-column grid, gap 32, rowGap 48

- **Cards:** PaperCard with red tape:
  - Tint: paper, pad 12px 12px 18px
  - Rotation: `rot(i + 11)`, Y: `lift(i + 11)`
  - Thumbnail: aspect 4/3, gradient bg + play button overlay (52×36)
  - "▶ YouTube" badge + duration badge
  - Series badge (red bg, mono 9px) + date
  - Title (Fraunces 19px) + description (2-line clamp)
  - Duration · views footer (mono 11px)

- **CTA:** "▶ inscreve no canal" / "subscribe on yt" (red bg, mono, uppercase)
- **Data:** `SAMPLE_VIDEOS` from `videos-data.ts`

- **Empty states:**
  - 0 videos → section completely hidden
  - 1-2 videos → grid adapts (1-2 columns)
  - 3+ → full 3-column grid

### AD: Anchor (horizontal sponsor)

- **Position:** Between Videos and Most Read + Tags
- **Component:** Reuse `anchor-ad.tsx`
- **Max-width:** 1280px
- **Empty state:** null ad → nothing renders

### §5 Most Read + By Tag (sidebar layout)

- **Components:** `MostReadSidebar.tsx` + `TagCategoryGrid.tsx` (both NEW)
- **Layout:** `grid-template-columns: 1fr 2fr`, gap 56

**Most Read (left sidebar):**
- Paper2 card, rotation +0.5deg, tape yellow
- Header: "★ MAIS LIDOS" (mono, accent) + Caveat "mais lidos do mês"
- Ordered list `<ol>` 1-5:
  - Number in Caveat 30px accent
  - Tag badge (from `blog_tags.color`)
  - Title (Fraunces 15px, 2-line clamp)
  - Dashed dividers between items
- Data: `getMostReadPosts()` — mock deterministic (seeded by day)
- Below sidebar: Marginalia ad slot (house ad, reuse `marginalia-ad.tsx`)

**By Tag (right grid):**
- Header: "§ 04" + "Por tag" / "By tag" (Fraunces 32px, italic)
- Grid: `repeat(2, 1fr)`, gap 28
- Each card: Paper card with colored tag header badge
  - Tag name badge: colored bg (from `blog_tags.color`), white text, mono 11px
  - 2 posts per tag: title (Fraunces 15px) + date + reading time
  - Dashed divider between posts
- Data: `getTopTags(locale, 4)` + `getPostsByTag(locale, tagId, 2)` per tag

**Empty states:**
- 0 posts total → entire section hidden
- <5 posts (Most Read) → show as many as available (1-4)
- 0 tags with posts → "By Tag" hidden, Most Read expands full-width
- 1-3 tags → grid adapts (1-3 cards)
- Tag with 0 posts → card omitted
- Tag with 1 post → single post, no divider

### AD: Bowtie (newsletter-style house card)

- **Position:** Above Newsletter+YT pair
- **Max-width:** 920px centered
- **Empty state:** null ad → nothing renders

### §6 Newsletter + YouTube Subscribe Pair

- **Component:** `SubscribePair.tsx` (NEW, replaces NewsletterInline)
- **Header:** Caveat "duas formas de acompanhar" centered + Fraunces italic 44px "Escolhe o teu canal"
- **Layout:** 2-column grid, gap 40

**Newsletter card (left):**
- Paper card, rotation -0.6deg, 2 tapes (yellow + blue)
- "✉ NEWSLETTER" kicker (mono, accent)
- Title: "Caderno de Campo" / "Field Notes" (Fraunces 38px, italic)
- Subtitle describing the newsletter
- Email form: `<input>` (dashed border) + subscribe button (ink bg)
- Handwriting footnote: "1.427 leitores · 62% open rate"
- Data: primary newsletter from `getNewslettersForLocale()`

**YouTube card (right):**
- Paper card, rotation +0.6deg, red tape, red border
- "▶ YouTube" kicker (mono, red)
- Title: "Canal ao vivo" / "On the channel" (Fraunces 38px, italic)
- Subtitle about the channel content
- 2 channel rows (PT + EN): avatar + name + subs + subscribe button
- Handwriting: "quinta que vem: vídeos novos nos dois canais"
- Data: `YOUTUBE_CHANNELS` from `videos-data.ts`

**Empty states:**
- 0 newsletters → newsletter card hidden, YT card full-width
- 0 channels → YT card hidden, newsletter full-width
- Both 0 → section hidden

### §7 Footer

- **Component:** `PinboardFooter.tsx` (keep as-is)
- Handwriting "— feito à mão em BH, {year} —"
- Border-top dashed

---

## Header Changes

### Remove
- `nav.devSite` key from both locale JSON files
- `devSite` nav item from `header-types.ts` `buildNavItems()`

### Rename
- `nav.writing` → `nav.blog` in both locale JSON files
- PT: "Textos" → "Blog"
- EN: "Writing" → "Blog"
- Nav item key: `writing` → `blog`
- href unchanged: `/blog` (already correct)

### Add: Stats Strip
- Thin bar below header: `▸ {subs} inscritos | {posts} posts | {videos} vídeos`
- JetBrains Mono 12px, color `--pb-faint`
- Border-bottom dashed `--pb-line`
- Max-width 1280px, justify-end

---

## Responsive Behavior

| Breakpoint | Blog Grid | Video Grid | Hero | Most Read + Tags | Newsletter Pair |
|---|---|---|---|---|---|
| ≥1024px (lg) | 3 cols | 3 cols | 2 cols | 1fr + 2fr sidebar | 2 cols |
| 768-1023px (md) | 2 cols | 2 cols | 2 cols | stack (full-width each) | 2 cols |
| <768px (sm) | 1 col | 1 col | 1 col (stack) | stack (full-width each) | 1 col (stack) |

### Mobile specifics
- Section padding: `56px 28px` → `40px 18px`
- Paper rotations: halved on `<768px`
- Tape widths: 80px → 60px
- Stats strip: font-size 10px, gap reduced
- Handwriting annotations: reduced font-size

---

## Accessibility

### Semantics
- `<main id="main-content">` wrapping all sections
- `<section aria-labelledby="...">` per section with unique IDs
- `<h2>` per section, `<h3>` per card title
- `<nav aria-label="...">` in header
- `<ol>` for Most Read (semantically ordered)
- Ad slots: `role="complementary" aria-label="Sponsored"`

### Interaction
- Focus-visible outline with accent color for all links/buttons
- Skip link → `#main-content` (already exists)
- Tapes/rotations: `aria-hidden="true"` (decorative only)
- External links: `target="_blank" rel="noopener"` + "↗" indicator
- Newsletter form: `<label>` associated to input
- Doorman dismiss: `aria-label="Fechar anúncio"`
- `prefers-reduced-motion: reduce` → disable all transforms and animations

---

## File Inventory

| File | Action | Description |
|---|---|---|
| `src/app/(public)/components/PinboardHome.tsx` | Refactor | Orchestrate all sections, data fetching |
| `src/app/(public)/components/UnifiedFeed.tsx` | Delete | Replaced by BlogGrid + VideoGrid |
| `src/app/(public)/components/BlogGrid.tsx` | Create | 6 posts, 3-col grid with paper cards |
| `src/app/(public)/components/VideoGrid.tsx` | Create | 3 videos, 3-col grid |
| `src/app/(public)/components/MostReadSidebar.tsx` | Create | Top 5 ranked list + marginalia ad slot |
| `src/app/(public)/components/TagCategoryGrid.tsx` | Create | 2×2 grid grouped by tag |
| `src/app/(public)/components/SubscribePair.tsx` | Create | Newsletter + YT subscribe cards |
| `src/app/(public)/components/StatsStrip.tsx` | Create | Channel/post/video counts bar |
| `src/app/(public)/components/SectionHeader.tsx` | Create | Reusable § numbered section header |
| `src/app/(public)/components/NewsletterInline.tsx` | Delete | Replaced by SubscribePair |
| `src/app/(public)/components/DualHero.tsx` | Adjust | Empty states, tag badge, match design |
| `src/app/(public)/components/ChannelStrip.tsx` | Adjust | Handwriting header, red border, match design |
| `lib/home/queries.ts` | Expand | +getPostsByTag, +getTopTags, +getMostReadPosts, +getPostCount |
| `lib/home/types.ts` | Expand | +HomeTag type |
| `src/locales/pt-BR.json` | Edit | nav.writing→nav.blog, remove nav.devSite, +new keys |
| `src/locales/en.json` | Edit | nav.writing→nav.blog, remove nav.devSite, +new keys |
| `src/components/layout/header-types.ts` | Edit | Remove devSite, rename writing→blog |
| `src/app/globals.css` | Expand | +section-header, +blog-grid, +video-grid CSS classes |

---

## Out of Scope

- **YouTube API integration** — separate spec, videos stay as static mock data
- **View tracking / real "Most Read"** — requires analytics table + tracking endpoint, follow-up sprint
- **Ad admin wiring** — ad slot containers render but with null data (invisible). Admin connects campaigns later.
- **Deprecating `blog_posts.category` column** — cleanup migration in future sprint, no breaking change now
- **Light theme testing** — design targets dark mode first, light mode follows same `--pb-*` variables
