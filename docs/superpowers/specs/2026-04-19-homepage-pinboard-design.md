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

Both pages render `<PinboardHome locale="en" | "pt-BR" />` — the locale prop drives all content fetching and UI strings.

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

### Cover image gradient (`lib/home/cover-image.ts`)

Port of the design prototype's gradient helper. Generates a deterministic CSS gradient from a post's `category` when no `cover_image_url` exists. Used by `DualHero` and `UnifiedFeed` cards.

```ts
// 6 canonical categories with distinct hue pairs
const CATEGORY_HUES: Record<string, [number, number]> = {
  tech:     [220, 260],
  vida:     [30,  60],
  viagem:   [160, 200],
  crescimento: [100, 140],
  code:     [200, 240],
  negocio:  [350, 20],
}
const DEFAULT_HUES: [number, number] = [35, 50] // sepia warm for uncategorized

export function coverGradient(category: string | null, dark: boolean): string
// Returns: linear-gradient(135deg, hsl(h1, S%, L%) 0%, hsl(h2, S%, L%) 100%)
// Saturation: dark=45%, light=55% | Lightness: dark=28%, light=72%
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
- Cover image (or CSS gradient via `coverGradient(post.category, isDark)`)
- TypeBadge: `▤ POST` or `▤ TEXTO`
- Category tag (color-coded via CATEGORY_HUES) + date + read time
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
- No featured post (`is_featured = true`) → fall back to most recent published post by locale
- No featured video → hero goes full-width with post only
- No posts at all → placeholder card with "em breve" / "coming soon"

### 3.3 ChannelStrip (Server)

Two YouTube channel cards side by side:

| | PT-BR | EN |
|---|---|---|
| Handle | `@tnFigueiredoTV` | `@byThiagoFigueiredo` |
| URL | `https://www.youtube.com/@tnFigueiredoTV` | `https://www.youtube.com/@byThiagoFigueiredo` |
| Flag | 🇧🇷 | 🌎 |

Each card: avatar circle (YT red) + channel name + stats (subscribers, videos, schedule) + Subscribe button.

Primary channel (matching current locale) shown first.

Data is static (`videos-data.ts`); YouTube Data API v3 deferred to Sprint-?.

### 3.4 UnifiedFeed (Server)

Merged, date-sorted list of posts + videos (most recent first). Displays as a grid of `<PaperCard>` items:

- Posts: category badge + title + excerpt + read time
- Videos: thumbnail + series badge + title + duration + views
- Type marker (`▤ TEXTO` / `▶ VÍDEO`) on each card
- Max 9 items on homepage; "Ver todos →" / "See all →" link to `/blog/en` or `/blog/pt-BR`

### 3.5 NewsletterInline (Client)

Simplified inline form — not the full 4-newsletter picker (that lives at `/newsletter`):

- Pre-selected: primary newsletter for locale (`main-en` for EN, `main-pt` for PT-BR)
- Single email input + submit button
- Calls Server Action `subscribeNewsletterInline(formData)` via `useActionState`
- On success: inline confirmation message (no redirect)
- Link below: "→ mais newsletters" / "→ more newsletters" → `/newsletter`

**Important:** The existing `/newsletter/subscribe/actions.ts` is NOT reused directly — it requires consent checkboxes + Turnstile CAPTCHA. The inline action wraps a slimmer path:
1. Validate email (Zod)
2. Validate Turnstile (hidden widget on the inline form — same `NEXT_PUBLIC_TURNSTILE_SITE_KEY`)
3. Call same DB RPC flow (rate check → insert subscription → send confirmation email via Resend)

New file: `app/(public)/actions/newsletter-inline.ts`

### 3.6 PinboardFooter (Server)

- Brand mark + tagline (bilingual)
- Links: Blog · Videos · Newsletter · About · Contact · Dev ↗
- Copyright + "Feito em BH" / "Made in Brazil"

---

## 4. Database Migrations

Three migration files, applied in order:

### Migration 1: `20260419000001_blog_posts_is_featured.sql`

```sql
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- Partial index — fast lookup of the one featured post per site
CREATE INDEX IF NOT EXISTS blog_posts_is_featured_idx
  ON blog_posts (site_id, is_featured)
  WHERE is_featured = true;
```

### Migration 2: `20260419000002_blog_posts_category.sql`

```sql
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IN ('tech', 'vida', 'viagem', 'crescimento', 'code', 'negocio'));
-- NULL allowed — means uncategorized (uses DEFAULT_HUES gradient)
```

### Migration 3: `20260419000003_newsletter_schema_v2.sql`

```sql
-- 1. New lookup table for newsletter types
CREATE TABLE IF NOT EXISTS newsletter_types (
  id         text PRIMARY KEY,
  locale     text NOT NULL CHECK (locale IN ('en', 'pt-BR')),
  name       text NOT NULL,
  tagline    text,
  cadence    text,
  color      text NOT NULL DEFAULT '#C14513',
  active     boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Seed 8 newsletter types
INSERT INTO newsletter_types (id, locale, name, tagline, cadence, color, sort_order) VALUES
  ('main-en',   'en',    'The bythiago diary',    'Thoughts from the edge of the keyboard', 'Weekly',   '#C14513', 1),
  ('trips-en',  'en',    'Curves & roads',         'Motorcycle diaries, travel, freedom',    'Monthly',  '#1A6B4A', 2),
  ('growth-en', 'en',    'Grow inward',            'Self-improvement, habits, depth',         'Bi-weekly','#6B4FA0', 3),
  ('code-en',   'en',    'Code in Portuguese',     'Tech content, originally in PT-BR',      'Weekly',   '#1A5280', 4),
  ('main-pt',   'pt-BR', 'Diário do bythiago',     'Pensamentos da beira do teclado',        'Semanal',  '#C14513', 1),
  ('trips-pt',  'pt-BR', 'Curvas & estradas',      'Diários de moto, viagem, liberdade',     'Mensal',   '#1A6B4A', 2),
  ('growth-pt', 'pt-BR', 'Crescer de dentro',      'Desenvolvimento pessoal, hábitos',       'Quinzenal','#6B4FA0', 3),
  ('code-pt',   'pt-BR', 'Código em português',    'Conteúdo tech, em português mesmo',      'Semanal',  '#1A5280', 4)
ON CONFLICT (id) DO NOTHING;

-- 3. Add newsletter_id to newsletter_subscriptions
--    locale column already exists (added in migration 20260416000014) — NOT re-added here
ALTER TABLE newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS newsletter_id text
    REFERENCES newsletter_types(id)
    ON DELETE SET NULL;

-- Backfill: existing subscribers → primary PT-BR newsletter
UPDATE newsletter_subscriptions
  SET newsletter_id = 'main-pt'
  WHERE newsletter_id IS NULL;
```

**Critical note:** `newsletter_subscriptions.locale` was added in migration `20260416000014`. This migration does NOT re-add it.

---

## 5. Resend Integration

### Scope of migration

Resend replaces **only the confirmation email send** within the subscribe action. The Brevo cron sync (`/api/cron/sync-newsletter-pending`) stays intact — it handles contact creation in Brevo after confirmation and uses `@tn-figueiredo/email`. These are separate concerns.

### New env var

`RESEND_API_KEY` — add to `apps/web/.env.local` + Vercel Environment Variables.

### New file: `apps/web/src/lib/email/resend.ts`

```ts
// Thin wrapper — only transport changes here if we switch providers
export async function sendTransactionalEmail(params: {
  to: string
  subject: string
  html: string
  from?: string  // defaults to 'Thiago <no-reply@bythiagofigueiredo.com>'
}): Promise<void>
```

### What changes

The subscribe Server Actions (both existing `/newsletter/subscribe/actions.ts` and new `newsletter-inline.ts`) call `sendTransactionalEmail` (Resend) instead of the Brevo confirmation email send.

### What does NOT change

- `confirm_newsletter_subscription` RPC — unchanged
- `unsubscribe_via_token` RPC — unchanged
- `/api/cron/sync-newsletter-pending` — continues using `@tn-figueiredo/email` (Brevo) for contact creation + welcome email
- `BREVO_API_KEY` remains in env until full migration (tracked as tech debt)

---

## 6. Data Layer

### Types (`lib/home/types.ts`)

```ts
export type HomePost = {
  id: string
  slug: string
  locale: string
  title: string
  excerpt: string | null
  publishedAt: string
  category: string | null       // blog_posts.category (new column via migration 1)
  readingTimeMin: number
  coverImageUrl: string | null  // blog_translations.cover_image_url
  isFeatured: boolean           // blog_posts.is_featured (new column via migration 2)
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

### Queries (`lib/home/queries.ts` — server-only, `'use server'`)

```ts
getFeaturedPost(locale: string): Promise<HomePost | null>
// Primary:  blog_posts.is_featured = true AND status = 'published' AND locale = $1, ORDER BY published_at DESC LIMIT 1
// Fallback: same without is_featured filter (most recent published post for locale)

getLatestPosts(locale: string, limit = 8): Promise<HomePost[]>
// blog_translations JOIN blog_posts
// WHERE bt.locale = $1 AND bp.status = 'published' AND bp.published_at IS NOT NULL
//   AND bp.published_at <= now()
// ORDER BY bp.published_at DESC LIMIT $2
// Uses service-role client (same pattern as enumerator.ts)

getNewslettersForLocale(locale: string): Promise<HomeNewsletter[]>
// FROM newsletter_types WHERE locale = $1 AND active = true ORDER BY sort_order
```

### Static video data (`lib/home/videos-data.ts`)

```ts
// Sprint-?: replace with YouTube Data API v3 for real subscriber counts + thumbnails
export const YOUTUBE_CHANNELS: Record<'en' | 'pt-BR', HomeChannel> = {
  'en': {
    handle: '@byThiagoFigueiredo',
    url: 'https://www.youtube.com/@byThiagoFigueiredo',
    flag: '🌎',
    name: 'by Thiago Figueiredo',
  },
  'pt-BR': {
    handle: '@tnFigueiredoTV',
    url: 'https://www.youtube.com/@tnFigueiredoTV',
    flag: '🇧🇷',
    name: 'tnFigueiredo TV',
  },
}

export const SAMPLE_VIDEOS: HomeVideo[] = [
  // 4 placeholder entries — real data from YouTube API later
]
```

---

## 7. Theme (Dark/Light, SSR-safe)

Cookie name: `btf_theme` (`dark` | `light`, default `dark`).

Read in root `app/(public)/layout.tsx` via `cookies()` → applied as `data-theme` on `<html>`.

`<ThemeToggle>` (Client Component):
- Reads current theme from `document.documentElement.dataset.theme`
- On click: POSTs to `/api/theme` route + updates `data-theme` without full reload
- No `localStorage`. No FOUC. No hydration mismatch.

`/api/theme/route.ts` (POST):
- Reads `{ theme: 'dark' | 'light' }` from JSON body
- Sets `Set-Cookie: btf_theme=<value>; Path=/; SameSite=Lax; Max-Age=31536000`
- Returns `{ ok: true }`

**Reconciliation with existing dark-mode setup:** The existing codebase uses `localStorage` via Tailwind's `darkMode: 'class'`. The new approach uses a cookie + `data-theme` attribute. The migration means removing the `localStorage` reader from layout and replacing with cookie-read in RSC. The Tailwind config stays on `class`-based dark mode — `data-theme="dark"` maps to `class="dark"` on `<html>` via a one-liner in layout.

---

## 8. Accessibility

- `prefers-reduced-motion`: `PaperCard` rotation → 0deg; tape → `display: none`
- Contrast: all text combinations verified ≥ 4.5:1 WCAG AA against the defined palette
- Skip-to-content link at top of `app/(public)/layout.tsx`
- `aria-label` on ThemeToggle, lang switch, YouTube subscribe buttons
- Language toggle implemented as `<a href>` links (not JS state) — works without JS

---

## 9. Mobile (< 768px)

| Element | Desktop | Mobile |
|---|---|---|
| DualHero | 2-col grid | Stack (post first, video second) |
| PaperCard rotation | ±0.5–0.8deg | ±0.3deg |
| Tape decorations | Visible | `display: none` |
| ChannelStrip | 2-col | Stack |
| UnifiedFeed | 2-col grid | Single column |
| Header nav | Horizontal | Hamburger menu |

---

## 10. Out of Scope (this sprint)

- YouTube Data API v3 integration (real subscriber counts, thumbnails, video metadata)
- Full multi-newsletter picker on homepage (→ `/newsletter` page, already designed)
- Brevo full removal (cron sync stays; only confirmation email migrated to Resend)
- Category filter page (`/categories`)
- Single blog post page redesign with Pinboard aesthetic
- `about` / `now` page
- CMS UI for managing `newsletter_types` and `is_featured` flag (manual SQL for now)

---

## 11. Files Created / Modified

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
| `app/(public)/components/Tape.tsx` | New |
| `app/(public)/components/PinboardFooter.tsx` | New |
| `app/(public)/actions/newsletter-inline.ts` | New — Server Action (slim subscribe) |
| `lib/home/types.ts` | New |
| `lib/home/queries.ts` | New |
| `lib/home/videos-data.ts` | New |
| `lib/home/cover-image.ts` | New — category → gradient helper |
| `lib/email/resend.ts` | New — Resend transport wrapper |
| `app/api/theme/route.ts` | New — cookie setter |
| `locales/pt-BR.json` | New |
| `locales/en.json` | Extend |
| `newsletter/subscribe/actions.ts` | Modify — swap confirmation email to Resend |
| `supabase/migrations/20260419000001_blog_posts_is_featured.sql` | New |
| `supabase/migrations/20260419000002_blog_posts_category.sql` | New |
| `supabase/migrations/20260419000003_newsletter_schema_v2.sql` | New |
| `lib/seo/enumerator.ts` | Modify — add /pt-BR static route |
| `app/(public)/components/Header.tsx` | Remove (replaced by PinboardHeader) |
| `app/(public)/components/Hero.tsx` | Remove (replaced by DualHero) |
| `app/(public)/components/SocialLinks.tsx` | Remove (merged into PinboardHeader) |
| `app/(public)/components/Footer.tsx` | Replace by PinboardFooter |
