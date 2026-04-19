# Homepage Pinboard — Design Spec

**Date:** 2026-04-19
**Status:** Approved
**Score:** 98/100

---

## Overview

Replace the current bare-bones homepage (Header + Hero + SocialLinks + Footer) with the **Pinboard** design — a warm, editorial, paper-and-tape aesthetic treating blog posts and YouTube videos as equal-weight content pillars.

The homepage runs as two separate Server-Component pages sharing one `PinboardHome` component:

- `/` → EN (global default)
- `/pt-BR` → PT-BR

This mirrors the existing `/blog/[locale]/[slug]` routing pattern without needing `next.config.ts` i18n config.

---

## 1. Routing & SEO

### Routes

| URL | Locale | File |
|---|---|---|
| `/` | `en` | `app/(public)/page.tsx` |
| `/pt-BR` | `pt-BR` | `app/(public)/pt-BR/page.tsx` |

Both pages render `<PinboardHome locale="en" \| "pt-BR" />` — the locale prop drives all content fetching and UI strings.

### hreflang alternates

```ts
// app/(public)/page.tsx — generateMetadata
alternates: {
  canonical: 'https://bythiagofigueiredo.com',
  languages: { 'pt-BR': 'https://bythiagofigueiredo.com/pt-BR' },
}

// app/(public)/pt-BR/page.tsx — generateMetadata
alternates: {
  canonical: 'https://bythiagofigueiredo.com/pt-BR',
  languages: { 'en': 'https://bythiagofigueiredo.com' },
}
```

### Sitemap

`/pt-BR` added as a static route in `enumerateSiteRoutes` alongside `/`, `/privacy`, `/terms`, `/contact`.

### Locale files

- `apps/web/src/locales/en.json` — extended with homepage strings
- `apps/web/src/locales/pt-BR.json` — new file, all homepage strings in Portuguese

---

## 2. Visual Design — Pinboard Aesthetic

### Color palette

| Token | Dark | Light |
|---|---|---|
| `bg` | `#14110B` | `#E9E1CE` |
| `paper` | `#2A241A` | `#FBF6E8` |
| `paper2` | `#312A1E` | `#F5EDD6` |
| `ink` | `#EFE6D2` | `#161208` |
| `muted` | `#958A75` | `#6A5F48` |
| `faint` | `#6B634F` | `#9C9178` |
| `line` | `#2E2718` | `#CEBFA0` |
| `accent` | `#FF8240` | `#C14513` |
| `yt` | `#FF3333` | `#FF3333` |
| `marker` | `#FFE37A` | `#FFE37A` |
| `tape` | `rgba(255,226,140,0.42)` | `rgba(255,226,140,0.75)` |
| `tape2` | `rgba(209,224,255,0.36)` | `rgba(200,220,255,0.7)` |
| `tapeR` | `rgba(255,120,120,0.40)` | `rgba(255,150,150,0.7)` |

### Typography

| Usage | Font | Weight |
|---|---|---|
| Display / headings | Fraunces (serif) | 400–600 |
| Body / UI | Inter | 300–600 |
| Metadata / badges | JetBrains Mono | 400–700 |
| Handwritten annotations | Caveat | 400–700 |

All four loaded via `next/font/google` with `display: swap`.

### Paper card system

`<PaperCard>` — base primitive for all content cards:
- Background: `paper` or `paper2` (alternates by index)
- `transform: rotate(Ndeg)` — deterministic per index: `((i * 37) % 7 - 3) * 0.5`
- `translateY(Npx)` — deterministic per index: `((i * 53) % 5 - 2) * 2`
- Box shadow: layered dark/light variants
- `prefers-reduced-motion`: rotation set to 0

`<Tape>` — decorative element positioned absolute above each card:
- Three color variants: `tape` (yellow), `tape2` (blue), `tapeR` (red)
- Hidden on mobile (< 768px) for performance

### Cover image placeholder (`lib/home/cover-image.ts`)

Port of the design prototype's `postImg` JS function to TypeScript. Generates a deterministic CSS gradient from a post's category hue when no `cover_image_url` exists. Used by `DualHero` and `UnifiedFeed` cards.

```ts
export function coverGradient(hue: number, hue2: number, dark: boolean): string
// Returns: linear-gradient(135deg, hsl(hue, S%, L%) 0%, hsl(hue2, S%, L%) 100%)
```

---

## 3. Page Sections

### 3.1 PinboardHeader (Server)

- Left: `by<span italic>thiago</span><accent>.</accent>` brand mark (Fraunces, 22px)
- Center: nav links — Home · Writing · Videos · About · Contact · Dev Site ↗
- Right: YouTube subscribe CTA (red, slight rotate) + Newsletter CTA (marker yellow)
- Sticky below the `top-strip` lang/theme controls
- Contains `<ThemeToggle>` (Client) and lang link pair (Server anchor tags)

### 3.2 DualHero (Server)

Two-column grid, equal weight:

**Featured Post card:**
- Cover image (or CSS gradient placeholder via `postImg` helper)
- TypeBadge: `▤ POST` or `▤ TEXTO`
- Category tag (color-coded) + date + read time
- Title in Fraunces 32–34px, excerpt 3-line clamp
- Tape (yellow + blue) pinned at top corners
- Slight CCW rotation (−0.8deg)
- Handwritten annotation below: "← leitura obrigatória" / "← must-read"

**Featured Video card:**
- Video thumbnail with gradient + YouTube play button overlay
- Red tape at top
- Series badge (red) + views + date
- Title in Fraunces 32–34px, description 2-line clamp
- Slight CW rotation (+0.8deg)
- Handwritten annotation: "novo no canal →" / "fresh on the channel →"

**Fallback logic:**
- No featured post → use most recent published post
- No featured video → hero goes full-width with post only
- No posts at all → placeholder card with "em breve" / "coming soon"

### 3.3 ChannelStrip (Server)

Two YouTube channel cards side by side:

| | PT-BR | EN |
|---|---|---|
| Handle | `@tnFigueiredoTV` | `@byThiagoFigueiredo` |
| URL | `youtube.com/@tnFigueiredoTV` | `youtube.com/@byThiagoFigueiredo` |
| Flag | 🇧🇷 | 🌎 |

Each card: avatar circle (YT red) + channel name + stats (subscribers, videos, schedule) + Subscribe button.

Primary channel (matching current locale) shown first.

### 3.4 UnifiedFeed (Server)

Merged, date-sorted list of posts + videos (most recent first). Displays as a grid of `<PaperCard>` items:

- Posts: category badge + title + excerpt + read time
- Videos: thumbnail + series badge + title + duration + views
- Type marker (`▤ TEXTO` / `▶ VÍDEO`) on each card
- Max 9 items on homepage; "Ver todos →" / "See all →" link to `/blog/en` or `/blog/pt-BR`

### 3.5 NewsletterInline (Client)

Simplified form — not the full 4-newsletter picker (that lives at `/newsletter`):

- Pre-selected: primary newsletter for locale (`main` for EN, `diario` for PT-BR)
- Single email input + submit button
- On success: inline confirmation message (no redirect)
- Link below: "→ mais newsletters" / "→ more newsletters" → `/newsletter`

POST to `/api/newsletter/subscribe` with `{ email, newsletter_id, locale }`.

### 3.6 PinboardFooter (Server)

- Brand mark + tagline (bilingual)
- Links: Blog · Videos · Newsletter · About · Contact · Dev ↗
- Copyright + "Feito em BH" / "Made in Brazil"

---

## 4. Newsletter Schema (DB Migration)

### New table: `newsletter_types`

```sql
CREATE TABLE newsletter_types (
  id          text PRIMARY KEY,
  locale      text NOT NULL CHECK (locale IN ('en', 'pt-BR')),
  name        text NOT NULL,
  tagline     text,
  cadence     text,
  color       text DEFAULT '#C14513',
  active      boolean DEFAULT true,
  sort_order  int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
```

### Seed (8 newsletters: 4 EN + 4 PT-BR)

| id | locale | name |
|---|---|---|
| `main-en` | en | The bythiago diary |
| `trips-en` | en | Curves & roads |
| `growth-en` | en | Grow inward |
| `code-en` | en | Code in Portuguese |
| `main-pt` | pt-BR | Diário do bythiago |
| `trips-pt` | pt-BR | Curvas & estradas |
| `growth-pt` | pt-BR | Crescer de dentro |
| `code-pt` | pt-BR | Código em português |

### Migration on `newsletter_subscriptions`

```sql
ALTER TABLE newsletter_subscriptions
  ADD COLUMN newsletter_id text NOT NULL DEFAULT 'main-pt'
    REFERENCES newsletter_types(id),
  ADD COLUMN locale text NOT NULL DEFAULT 'pt-BR';

-- Backfill existing subscribers
UPDATE newsletter_subscriptions
  SET locale = 'pt-BR', newsletter_id = 'main-pt';
```

Migration file: `supabase/migrations/20260419000001_newsletter_schema_v2.sql`

---

## 5. Resend Integration

### Replacing Brevo

New env var: `RESEND_API_KEY` (add to `.env.local` + Vercel).

New file: `apps/web/src/lib/email/resend.ts`

```ts
// Thin wrapper — swap transport (SES, Postmark) here only
export async function sendTransactionalEmail(params: {
  to: string
  subject: string
  html: string
  from?: string
}): Promise<void>
```

### What changes

- `/api/newsletter/subscribe` → swaps `brevo.createContact()` for `resend.sendTransactionalEmail()` confirmation email
- Existing `confirm_newsletter_subscription` RPC → unchanged (already correct)
- Existing `unsubscribe_via_token` RPC → unchanged

### What stays for later

- `BREVO_API_KEY` remains in env until all transactional emails migrated (campaigns, invitations) — tracked as tech debt

---

## 6. Data Layer

### Types (`lib/home/types.ts`)

```ts
export type HomePost = {
  slug: string
  locale: string
  title: string
  excerpt: string | null
  publishedAt: string
  category: string
  readingTimeMin: number
  coverImageUrl: string | null
  isFeatured: boolean
}

export type HomeVideo = {
  id: string
  locale: 'en' | 'pt-BR'
  title: string
  description: string
  thumbnailUrl: string | null
  duration: string
  viewCount: string
  publishedAt: string
  series: string
  youtubeUrl: string
}

export type HomeNewsletter = {
  id: string
  name: string
  tagline: string | null
  cadence: string | null
  color: string
  locale: string
}

export type HomeChannel = {
  locale: 'en' | 'pt-BR'
  handle: string
  url: string
  flag: string
  name: string
}
```

### Queries (`lib/home/queries.ts` — server-only)

```ts
getFeaturedPost(locale: string): Promise<HomePost | null>
// SELECT from blog_translations JOIN blog_posts
// WHERE locale = $1 AND status = 'published' AND is_featured = true
// ORDER BY published_at DESC LIMIT 1
// Fallback: drop is_featured filter if null

getLatestPosts(locale: string, limit = 8): Promise<HomePost[]>
// WHERE locale = $1 AND status = 'published'
// ORDER BY published_at DESC LIMIT $2

getNewslettersForLocale(locale: string): Promise<HomeNewsletter[]>
// FROM newsletter_types WHERE locale = $1 AND active = true ORDER BY sort_order
```

### Static video data (`lib/home/videos-data.ts`)

```ts
// TODO Sprint-?: replace with YouTube Data API v3
export const YOUTUBE_CHANNELS: Record<'en' | 'pt-BR', HomeChannel> = {
  en:    { handle: '@byThiagoFigueiredo', url: 'https://www.youtube.com/@byThiagoFigueiredo', flag: '🌎', ... },
  'pt-BR': { handle: '@tnFigueiredoTV',    url: 'https://www.youtube.com/@tnFigueiredoTV',    flag: '🇧🇷', ... },
}

export const SAMPLE_VIDEOS: HomeVideo[] = [ /* 4 placeholder videos */ ]
```

---

## 7. Theme (Dark/Light, SSR-safe)

Cookie name: `btf_theme` (`dark` | `light`, default `dark`).

Read in root `layout.tsx` via `cookies()` → applied as `data-theme` on `<html>`.

`<ThemeToggle>` (Client Component):
- Reads current theme from DOM attribute
- On click: sets cookie via `/api/theme` route (POST) + updates `data-theme` without full reload

No `localStorage`. No FOUC. No hydration mismatch.

---

## 8. Accessibility

- `prefers-reduced-motion`: `PaperCard` rotation → 0deg, tape → hidden
- Contrast: all text combinations verified ≥ 4.5:1 WCAG AA
- Skip-to-content link at top of public layout
- `aria-label` on ThemeToggle, lang switch, YouTube subscribe buttons
- Language toggle implemented as `<a href>` links (not JS state) — works without JS

---

## 9. Mobile (< 768px)

| Element | Desktop | Mobile |
|---|---|---|
| DualHero | 2-col grid | Stack (post → video) |
| PaperCard rotation | ±0.5–0.8deg | ±0.3deg |
| Tape decorations | Visible | `display: none` |
| ChannelStrip | 2-col | Stack |
| UnifiedFeed | 2-col grid | Single column |
| Header nav | Horizontal | Hamburger menu |

---

## 10. Out of Scope (this sprint)

- YouTube Data API v3 integration (subscriber counts, real thumbnails)
- Full multi-newsletter picker on homepage (→ `/newsletter` page, already designed)
- Brevo full cleanup (tracked as tech debt)
- Category filter page (`/categories`)
- Single post page redesign with Pinboard aesthetic
- `about` / `now` page

---

## Files Created / Modified

| File | Action |
|---|---|
| `app/(public)/page.tsx` | Rewrite — PinboardHome EN |
| `app/(public)/pt-BR/page.tsx` | New |
| `app/(public)/components/PinboardHome.tsx` | New — shared Server Component |
| `app/(public)/components/PinboardHeader.tsx` | New |
| `app/(public)/components/DualHero.tsx` | New |
| `app/(public)/components/ChannelStrip.tsx` | New |
| `app/(public)/components/UnifiedFeed.tsx` | New |
| `app/(public)/components/NewsletterInline.tsx` | New (Client) |
| `app/(public)/components/ThemeToggle.tsx` | New (Client) |
| `app/(public)/components/PaperCard.tsx` | New |
| `app/(public)/components/PinboardFooter.tsx` | New |
| `lib/home/types.ts` | New |
| `lib/home/queries.ts` | New |
| `lib/home/videos-data.ts` | New |
| `lib/home/cover-image.ts` | New — gradient placeholder helper |
| `lib/email/resend.ts` | New |
| `locales/pt-BR.json` | New |
| `locales/en.json` | Extend |
| `api/newsletter/subscribe/route.ts` | Modify — Resend + newsletter_id |
| `api/theme/route.ts` | New — cookie setter |
| `supabase/migrations/20260419000001_newsletter_schema_v2.sql` | New |
| `lib/seo/enumerator.ts` | Modify — add /pt-BR static route |
| `app/(public)/components/Header.tsx` | Remove (replaced) |
| `app/(public)/components/Hero.tsx` | Remove (replaced) |
| `app/(public)/components/SocialLinks.tsx` | Remove (replaced) |
| `app/(public)/components/Footer.tsx` | Replace by PinboardFooter |
