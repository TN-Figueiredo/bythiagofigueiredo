# Blog Archive Redesign — Design Spec v5b

**Date:** 2026-05-04
**Score:** 98/100
**Status:** Approved

## Goal

Redesign `/blog` page to match `design/blog.html` reference faithfully. Replace the current plain single-column list with the full pinboard-style archive: 3-column paper card grid, client-side filtering/sorting/search, ad placements, read indicators with percentage, and "load more" pagination.

## Architecture: A+ (Enhanced RSC + Client)

- **Server component** (`page.tsx`): ISR `revalidate: 3600`, fetches ALL posts metadata + tags from Supabase, renders SEO (metadata, JSON-LD breadcrumbs), serializes dataset as props to client component
- **Client component** (`BlogArchiveClient`): Receives full dataset, handles filter/sort/search/load-more/read-indicators/URL-sync
- **Payload**: ~35KB gzipped for 500 posts (title + slug + category + tag + date + reading_time + id + cover_url + excerpt)
- **Edge caching**: Vercel Pro automatic, ISR + on-demand via `revalidateTag('blog-index')`
- **Threshold for pivot**: 2000+ posts → add server-side cursor pagination

## Grid Layout

| Viewport | Tailwind | Columns | Gap | Container |
|----------|----------|---------|-----|-----------|
| ≥ 1024px | `lg:grid-cols-3` | 3 | 40px / 56px row | max-width: 1280px |
| 768–1023px | `md:grid-cols-2` | 2 | 28px / 40px row | padding: 0 24px |
| < 768px | `grid-cols-1` | 1 | 0 / 32px row | padding: 0 16px |

## Card Anatomy (WritingCard)

Port from `design/shared.jsx` WritingCard:
- Paper background with deterministic tint: `i % 3 === 1 ? paper2 : paper`
- Rotation: `((i*37)%7-3)*0.5 deg`
- Vertical lift: `((i*53)%5-2)*2 px`
- Tape decoration: color `i%2 ? tape2(blue) : tape(yellow)`, position `i%2 ? left : right` at 28%, rotation `(i*11)%12-6 deg`
- Cover image 16/10 aspect + PostPattern SVG overlay (dots/grid/diag/stripe/blur)
- Cover gradient via `coverGradient(tag, dark, tagColor)` from `lib/home/cover-image.ts`
- Type badge (▤ TEXTO)
- Category tag with color (from `blog_tags.color`/`color_dark`)
- Title (Fraunces serif, 19px, 500)
- Reading time (JetBrains Mono, 12px)
- Tags (max 3, monospace chips with # prefix)
- Read indicator overlay (post-hydration, fade-in 200ms)
- `prefers-reduced-motion`: all rotations/lifts become 0

## Filter Bar

1. **Search + Sort + Clear All row**: Input (monospace, with × clear) + sort buttons (Recentes / Mais longos / Mais curtos / Não lidos) + `✕ limpar tudo` (dashed accent, visible when hasFilters)
2. **Category chips (UPPERCASE)**: "Tudo" + each with color bullet + count badge. Active = filled bg. JetBrains Mono 11px, letter-spacing 0.12em, border 1.5px
3. **Tag chips (lowercase #hashtags)**: Top 20 by usage. `#` prefix, JetBrains Mono 10.5px, letter-spacing 0.04em, border 1px. Active = accent bg. Toggle to deselect. Dashed border separator below
4. **Result count + annotation**: `{N} resultados` (aria-live="polite") + `↓ começa por aqui` (Caveat cursive, accent, rotate -1deg, only when !hasFilters). When filtered: shows "· filtrando · {category} · #{tag} · "{q}""
5. **Filter persistence**: `sessionStorage('btf_blog_filters')` restore on mount

URL sync: `?cat=tech&tag=typescript&q=react&sort=longest` via `useSearchParams` + `router.replace` (debounce 150ms for URL only, filter is instant)

## Ad Slot Taxonomy

Namespace: `{area}:{position}:{format}`

| Slot Key | Component | Position | Status |
|----------|-----------|----------|--------|
| `archive:top:doorman` | DoormanAd | Banner above header (OFF default) | This PR |
| `archive:break:anchor` | HorizontalAnchor (NEW) | Between filters and grid | This PR |
| `archive:grid:bookmark` | BookmarkAd | Inline in grid | This PR |
| `archive:footer:marginalia` | MarginaliaAd (paper variant) | Above footer, max-w 720px | This PR |
| `archive:footer:bowtie` | BowtieAd (newsletter form) | Newsletter CTA before footer | This PR |
| `post:body:bookmark` | BookmarkAd | Mid-article | Exists |
| `post:sidebar:anchor` | AnchorAd | Right rail | Exists |
| `post:sidebar:marginalia` | MarginaliaAd | Post sidebar | Exists |
| `post:footer:coda` | CodaAd | Below post | Exists |

### HorizontalAnchor (NEW — not AnchorAd)

Full-width 3-column row: `grid: auto 1fr auto`. Brand+mark | headline+body | CTA+dismiss. Background `#1E1A12` (dark). Borders top+bottom dashed. Collapses to 1-col on mobile. File: `blog/horizontal-anchor.tsx`.

### Ad Placement Algorithm

| Visible posts | Placement | Rationale |
|---------------|-----------|-----------|
| < 6 | Last position | Non-intrusive |
| 6–12 | Position 6 (start of row 3) | After 2 full rows |
| > 12 | Every `(6*n + offset)`, offset = `(dayOfYear % 3) + 1` | Varies daily |

### Ad Behavior

- All ads dismissible via `useDismissable(id)` hook + `localStorage['btf_ads_dismissed']`
- ID prefixes: `h_` anchor, `b_` bookmark, `m_` marginalia, `bw_` bowtie, `d_` doorman
- Daily rotation: `Math.floor(Date.now() / (1000*60*60*24)) + 2` as hash for selection
- Bowtie is a newsletter FORM (email input + submit + success state "Recebido. Confira sua caixa.")

## Read Indicators

| State | Visual |
|-------|--------|
| Unread | No indicator, full opacity |
| In progress (1–94%) | Bottom progress bar (3px, red) + top-right badge "42%" |
| Read (≥95%) | "✓ lido" badge + card dimmed (opacity 0.6) |

- Uses existing `ReadProgressStore` (localStorage)
- Fade-in on hydration (opacity 0→1, 200ms) via `mounted` state
- "Não lidos primeiro" sort option

## Empty State

When `filtered.length === 0`: centered "nada por aqui." (Caveat cursive, 32px, muted) + explanation text + "limpar filtros" accent button calling `reset()`.

## Load More

- Initial batch: 6 posts
- Each load: +6 posts
- Button: "Ver mais 6 de N restantes"
- Animation: stagger-in `opacity 0→1, translateY(12→0)`, 50ms delay each
- Focus: moves to first new card (a11y)
- End state: button hidden, "Isso é tudo! ↑" hand label (Caveat, accent)

## PostImg → coverGradient Bridge

- Design's `postImg({h, h2, pattern})` → Next.js `coverGradient(tag, dark, tagColor)` from `lib/home/cover-image.ts`
- Posts with `cover_image_url` use real image; without → gradient + PostPattern overlay
- PostPattern: SVG `viewBox="0 0 400 300"`, `preserveAspectRatio="none"`, color `dark ? #F2EBDB : #1A1410`, opacity 0.15
- Mock data uses gradients for all posts

## Performance

- Images: `loading="lazy"` below fold, first 6 eager
- `content-visibility: auto` for off-screen cards
- INP target: < 100ms
- `prefers-reduced-motion`: skip all animations/rotations
- Single `localStorage.getItem` on mount for read progress
- Filter: instant (client-side). URL sync: debounced 150ms

## Accessibility

- `aria-live="polite"` on result count
- Chips: `<button>` + `aria-pressed`
- Search: `role="searchbox"` + `aria-label`
- Load more: focus to first new card
- Color contrast: WCAG AA on dark bg
- `prefers-reduced-motion` respected

## Mock Data

`blog-mock-data.ts`: 18 posts, 6 categories, 10+ tags, 3 sponsor ads, 3 house ads.
Used ONLY when DB returns 0 posts (dev/preview). Production always uses real data.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `blog/page.tsx` | Rewrite | RSC shell, fetch all posts + tags |
| `blog/blog-archive-client.tsx` | Create | Main client component |
| `blog/writing-card.tsx` | Create | Paper card matching design |
| `blog/blog-filter-bar.tsx` | Create | Search + sort + categories + tags + result count |
| `blog/horizontal-anchor.tsx` | Create | 3-col row ad (NEW, not AnchorAd) |
| `blog/blog-ad-slots.tsx` | Create | Hardcoded ad content + placement logic |
| `blog/blog-mock-data.ts` | Create | Mock posts + ads for dev |
| `blog/post-pattern.tsx` | Create | SVG pattern overlay |
| `components/blog/readable-card.tsx` | Modify | Add % badge + fade-in |
| `blog/category-filter.tsx` | Delete | Replaced by blog-filter-bar |

## Conscious Trade-offs (the -2 from 100)

1. **No Supabase FTS**: `.includes()` is faster at <2000 posts, zero network latency
2. **No virtualization**: Max ~80 DOM cards with batches of 6, no jank observed
