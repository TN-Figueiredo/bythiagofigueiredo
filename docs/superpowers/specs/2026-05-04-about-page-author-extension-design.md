# About Page + Author Extension — Design Spec

**Date:** 2026-05-04
**Status:** Draft
**Scope:** Public `/about` page + CMS Author "About Page" tab + DB schema extension

---

## Overview

This spec covers three interrelated deliverables:

1. **Database schema** — 8 new columns on the `authors` table for about page content
2. **Public `/about` page** — Narrative-first, polaroid-led page following the site's paper-and-tape visual language
3. **CMS Author UI** — New "About Page" tab in the author detail drawer for editing all about-related fields

The about page content is fully DB-driven and editable via the CMS. No MDX files, no hardcoded content. The page renders data from the site's default author.

---

## 1. Database Schema

### Migration — `authors` table extension

A single migration adds 8 nullable columns to the existing `authors` table. No new tables, no new policies, no new triggers.

### New columns

| Column | Type | Constraint | Purpose |
|---|---|---|---|
| `headline` | `text` | — | Hero text for the about page, e.g. `"eu sou \|Thiago."` — the pipe `\|` marks where the yellow highlight begins |
| `subtitle` | `text` | — | Italic tagline displayed next to the photo, e.g. `"37 anos, brasileiro, escrevendo daqui de [Toronto]..."` |
| `about_md` | `text` | — | Long-form MDX source (chapters, free formatting) |
| `about_compiled` | `text` | — | Pre-compiled MDX output — follows the compile-on-save pattern used by blog posts (`content_compiled` column) |
| `about_photo_url` | `text` | `~ '^https://'` | URL of the about page photo — distinct from `avatar_url`, which remains for circular blog-card avatars; about photo renders as a 1:1 polaroid |
| `photo_caption` | `text` | — | Handwriting-style caption rendered below the photo, e.g. `"CN Tower, fev/2018"` |
| `photo_location` | `text` | — | Uppercase monospace label, e.g. `"TORONTO · 2018"` |
| `about_cta_links` | `jsonb` | structural CHECK (see below) | CTA block configuration: links array, kicker line, and signature text |

### Existing columns leveraged (no schema change)

- **`social_links jsonb`** — already exists. The CMS will expose editing via 4 named fields (X, Instagram, YouTube, LinkedIn). Expected runtime shape: `{"x": "https://x.com/...", "instagram": "https://instagram.com/...", "youtube": "https://youtube.com/...", "linkedin": "https://linkedin.com/in/..."}`. The `about_cta_links` social entries resolve their URL by looking up `social_links[key]`.
- **`avatar_url text`** — unchanged. Remains for circular avatar in blog cards and CMS author list. Entirely separate from `about_photo_url`.

### `about_cta_links` JSONB schema

Expected shape:

```json
{
  "kicker": "Vem junto",
  "signature": "obrigado por estar aqui — tf",
  "links": [
    { "type": "internal", "key": "blog",        "label": "blog" },
    { "type": "internal", "key": "newsletters", "label": "newsletters" },
    { "type": "social",   "key": "youtube",     "label": "vídeos" },
    { "type": "social",   "key": "instagram",   "label": "instagram" }
  ]
}
```

CHECK constraint applied in migration:

```sql
CONSTRAINT authors_about_cta_links_valid
  CHECK (
    about_cta_links IS NULL
    OR (
      about_cta_links ? 'links'
      AND jsonb_typeof(about_cta_links->'links') = 'array'
    )
  )
```

Resolution rules:
- `type: "internal"` — `key` maps to a known app route (`"blog"` → `/blog`, `"newsletters"` → `/newsletters`).
- `type: "social"` — `key` is a property name in `social_links`; if the key is absent or `social_links` is null, the link is omitted from render.

### Storage

Reuses the existing `author-avatars` bucket (public read, staff write, JPEG/PNG/WebP, 2 MB limit). About photo uploads follow the path convention `{author_id}/about.{ext}` to distinguish them from avatar uploads.

### RLS

No changes required. The existing `authors` table policies already provide public read and staff write access. All new nullable columns inherit these policies automatically.

### Cache invalidation

A new revalidation tag `about:{siteId}` is introduced. It is revalidated whenever the CMS saves any about-related field for an author. The `/about` page uses `unstable_cache` keyed on `[siteId]` and tagged with `about:{siteId}`.

### SEO integration

- **JSON-LD**: `BreadcrumbList` (Home → About) + `AboutPage` schema node, composed via the existing `composeGraph` pipeline in `lib/seo/jsonld/graph.ts`.
- **Sitemap**: `/about` is added as a static route in `enumerateSiteRoutes` — only included when the default author has at least one about field populated.
- **OG image**: `about_photo_url` is used as `og:image` when present; falls back to the standard precedence chain (`sites.seo_default_og_image` → `/og-default.png`).

### i18n

All text fields are single-locale (pt-BR) in this version. The upgrade path is to convert these columns to `jsonb` keyed by locale in a future migration.

### Graceful degradation

- If the default author has no about fields populated, `/about` returns a 404.
- Individual empty fields are omitted silently: no empty caption element, no CTA block if `about_cta_links` is null or its `links` array is empty.

### Migration SQL

```sql
-- Migration: 20260504000001_authors_about_extension.sql
ALTER TABLE authors
  ADD COLUMN IF NOT EXISTS headline          text,
  ADD COLUMN IF NOT EXISTS subtitle          text,
  ADD COLUMN IF NOT EXISTS about_md          text,
  ADD COLUMN IF NOT EXISTS about_compiled    text,
  ADD COLUMN IF NOT EXISTS about_photo_url   text CHECK (about_photo_url IS NULL OR about_photo_url ~ '^https://'),
  ADD COLUMN IF NOT EXISTS photo_caption     text,
  ADD COLUMN IF NOT EXISTS photo_location    text,
  ADD COLUMN IF NOT EXISTS about_cta_links   jsonb
    CONSTRAINT authors_about_cta_links_valid CHECK (
      about_cta_links IS NULL
      OR (
        about_cta_links ? 'links'
        AND jsonb_typeof(about_cta_links->'links') = 'array'
      )
    );
```

---

## 2. Public About Page

### 2.1 Route & File Structure

**Route:** `/about`

**Entry point:** `apps/web/src/app/(public)/about/page.tsx` — a Server Component inside the existing `(public)` layout group. It inherits the global site header and footer from `layout.tsx` with no custom nav or footer overrides.

**Component tree:**

```
app/(public)/about/
├── page.tsx                 Server component — data fetch + metadata generation
└── components/
    ├── AboutHero.tsx        Kicker ("§ OLÁ") + headline with marker highlight
    ├── AboutMain.tsx        Grid layout: Polaroid column + content column
    ├── Polaroid.tsx         Photo frame with tape decorations, caption, location
    ├── AboutContent.tsx     Subtitle (tagline) + MDX-rendered chapters
    ├── CtaBlock.tsx         Paper card with tape, chips grid, signoff
    └── CtaChip.tsx          Individual chip: number + label + arrow
```

### 2.2 Design Reference

The page follows the site's established "paper and tape" visual language — the same aesthetic used by the Pinboard homepage. The design is narrative-first and polaroid-led, giving the author a warm, editorial presence.

The reference implementation lives at `design/about.html` / `design/about.jsx`.

### 2.3 Data Fetching

The page fetches the default author for the current site:

```sql
SELECT
  headline, subtitle, about_md, about_compiled, about_photo_url,
  photo_caption, photo_location, about_cta_links, social_links, display_name
FROM authors
WHERE site_id = :siteId AND is_default = true
LIMIT 1
```

**404 condition:** If no default author exists, or if all about-specific fields (`headline`, `subtitle`, `about_md`, `about_compiled`, `about_photo_url`) are null, the page calls `notFound()`.

**Caching:** `unstable_cache` with key `['about', siteId]` and tag `about:{siteId}`.

### 2.4 Component Specifications

#### `AboutHero.tsx`

- **Kicker:** `§ OLÁ` — JetBrains Mono, 11px, `letter-spacing: 0.22em`, accent color `#FF8240`
- **Headline:** Fraunces serif, `clamp(56px, 10vw, 132px)`, `line-height: 0.92`, `letter-spacing: -0.04em`, weight 500
- **Marker highlight:** Pipe `|` in headline text marks where highlight starts. Everything after the pipe gets a yellow marker: `height: 0.26em`, `background: rgba(255, 227, 122, 0.78)`, `transform: skew(-3deg) rotate(-0.6deg)`. Pipe is stripped from output.

#### `AboutMain.tsx`

- CSS Grid: `grid-template-columns: auto 1fr`, gap 56px, max-width 1080px
- At `≤760px`: collapses to single column, Polaroid centered above content

#### `Polaroid.tsx`

- Frame: background `#F2EBDB` (dark) / `#FFFEF8` (light), padding `14px 14px 18px`
- Width: 320px (260px at ≤480px), photo 1:1 aspect ratio
- Rotation: `-2.4deg`
- Shadow: `0 3px 0 rgba(0,0,0,0.6), 0 18px 36px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.08)`
- Tape: yellow (78px, -5deg, left 30px) + blue (64px, 4deg, right 24px)
- Caption: Caveat 22px, `#1A1410`, centered — from `photo_caption`
- Date: JetBrains Mono 9px, `0.18em` tracking, `#9C8E70`, uppercase — from `photo_location`

#### `AboutContent.tsx`

- Container: max-width 620px, `padding-top: 8px`
- Tagline: Fraunces italic, 22px, 1.4 line-height, muted color `#958A75`
- MDX body: via `MdxRunner` from `@tn-figueiredo/cms`. Uses `about_compiled` when available; falls back to runtime `compileMdx(about_md)`. Fraunces 19px, 1.6 line-height.

#### `CtaBlock.tsx`

- Paper card: background `#312A1E`, rotation -0.3deg
- Shadow: `0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03)`
- Tape: yellow at left 26%, blue at right 30%
- Kicker: `◉ {text}`, JetBrains Mono 11px, accent color, 700 weight
- Chips grid: 4-column (2-column ≤760px, 1-column ≤480px), `1px dashed #2E2718`, hover: `translateY(-1px) + border-color: #FF8240`
- Signoff: Caveat 22px, accent color

#### `CtaChip.tsx`

- Number: JetBrains Mono, zero-padded (01, 02...) — derived from visible order
- Label: Fraunces serif, `letter-spacing: -0.005em`
- Arrow: `→` in accent color
- Renders as `<a>` with resolved URL. Hidden if URL is empty.

### 2.5 Color Palette (dark mode)

| Token | Value | Usage |
|---|---|---|
| Background | `#14110B` | Page background |
| BG gradient 1 | `rgba(255,130,64,0.04)` at `12% 18%` | Radial overlay |
| BG gradient 2 | `rgba(255,255,255,0.012)` at `88% 78%` | Radial overlay |
| Ink | `#EFE6D2` | Body text |
| Muted | `#958A75` | Secondary text (tagline) |
| Faint | `#6B634F` | Tertiary (chip numbers, date) |
| Accent | `#FF8240` | Kickers, arrows, signoff, hover |
| Marker | `rgba(255,227,122,0.78)` | Headline highlight |
| Line | `#2E2718` | Dashed borders |
| Paper | `#312A1E` | CTA block background |
| Tape yellow | `rgba(255,226,140,0.42)` | Decorative tape |
| Tape blue | `rgba(209,224,255,0.36)` | Decorative tape |
| Polaroid (dark) | `#F2EBDB` | Polaroid frame |
| Polaroid (light) | `#FFFEF8` | Polaroid frame |

### 2.6 CTA Link Resolution

**Internal links** (`type: "internal"`) map via a known route table:

```typescript
const INTERNAL_ROUTES: Record<string, string> = {
  blog:        '/blog',
  newsletters: '/newsletters',
  videos:      '/videos',
}
```

**Social links** (`type: "social"`) resolve to `social_links[key]`. If the social link URL is empty/absent, the chip is not rendered. Chips are numbered sequentially based on visible order.

### 2.7 MDX Rendering

Uses compile-on-save pattern:
1. `about_compiled IS NOT NULL` → `MdxRunner` with compiled source
2. `about_compiled IS NULL` → runtime `compileMdx(about_md)` fallback

### 2.8 Theme Support

Supports dark/light via existing theme system. Color tokens have light-mode counterparts defined in the reference `about.jsx`.

### 2.9 SEO

| Field | Value |
|---|---|
| `title` | `"About — {siteName}"` |
| `description` | `subtitle` field |
| `canonical` | `{siteUrl}/about` |
| OG image | `about_photo_url` → fallback chain |

JSON-LD: `BreadcrumbList` (Home → About), inheriting `WebSite` + `Person` nodes from root layout.

### 2.10 Responsive

| Breakpoint | Changes |
|---|---|
| `≤760px` | Grid → single column, Polaroid centered, CTA chips 2-column |
| `≤480px` | CTA chips 1-column, Polaroid 260px, reduced paddings |

---

## 3. CMS Author UI

The existing CMS Author detail drawer (`apps/web/src/app/cms/(authed)/authors/authors-connected.tsx`) is extended with a tab system. Existing fields migrate to a "Profile" tab; all about-page authoring lives in a new "About Page" tab.

### 3.1 Tab Structure

| Tab | Contents |
|-----|----------|
| **Profile** | Display Name, Bio, Avatar upload, Avatar Color, Save Changes (unchanged) |
| **About Page** | All fields described in §3.2 |

### 3.2 About Page Tab — Field Groups

#### Group 1: Headline & Subtitle

| Field | Control | Notes |
|-------|---------|-------|
| **Headline** | `<input type="text">` | Example: `"eu sou \|Thiago."`. Hint: *"Pipe character \| marks where the yellow highlight starts"* |
| **Subtitle** | `<textarea rows={2}>` | Hint: *"Italic text displayed next to the photo"* |

#### Group 2: Photo

Section divider: **Photo**. Layout: photo preview left (140 × 140 px), caption + location fields stacked right.

| Field | Control | Notes |
|-------|---------|-------|
| **About Photo** | Click-to-upload area, 140 × 140 px, 1:1 | JPEG/PNG/WebP, max 2 MB. Shows uploaded photo with "Change photo" overlay on hover. Uploads to `author-avatars/{author_id}/about.{ext}` |
| **Caption** | `<input type="text">` | Hint: *"Handwriting style (Caveat font)"* |
| **Location · Date** | `<input type="text">` | Hint: *"Uppercase mono text below caption"* |

#### Group 3: About Text

Section divider: **About Text**

| Field | Control | Notes |
|-------|---------|-------|
| **Content (MDX)** | `<textarea rows={12}>`, JetBrains Mono 11.5px | Write/Preview toggle. Hint: *"Supports \*\*bold\*\*, \*italic\*, [links](url), headings. Compiled on save."* Preview renders via `MdxRunner`. |

#### Group 4: Social Links

Section divider: **Social Links**. Four named input rows with colored platform badge, URL input, and clear button (visible only when field has value).

| Platform | Badge color | Placeholder |
|----------|-------------|-------------|
| X | Gray | `https://x.com/username` |
| Instagram | `#e1306c` | `https://instagram.com/username` |
| YouTube | `#ff4444` | `https://youtube.com/@handle` |
| LinkedIn | `#0a66c2` | `https://linkedin.com/in/username` |

Persisted to existing `social_links` JSONB column.

#### Group 5: CTA Block

Section divider: **CTA Block**

| Field | Control | Notes |
|-------|---------|-------|
| **Kicker** | `<input>` | e.g. `"Vem junto"` |
| **Sign-off** | `<input>` | e.g. `"obrigado por estar aqui — tf"`. Hint: *"Displayed in handwriting font (Caveat)"* |
| **Links** | Drag-and-drop checklist | See below |

**Links checklist:**
- Hint: *"Drag to reorder · Check to show · Edit display label"*
- Each row: drag handle (⠿) · checkbox · type tag (`route` green / `social` yellow) · source key · editable label input
- Available rows auto-populated from internal routes + filled `social_links` keys
- Unchecked rows: `opacity: 0.35`, label input disabled
- Checked rows define what appears on the public `/about` CTA block

### 3.3 Save Action — `updateAuthorAbout`

Located in `apps/web/src/app/cms/(authed)/authors/actions.ts`.

1. Validate payload against Zod schema (§3.5)
2. If `about_md` changed: `compileMdx(about_md)` → save both `about_md` + `about_compiled`
3. Persist all about fields atomically
4. `revalidateTag('about:' + siteId)`
5. `revalidatePath('/about')`

### 3.4 Photo Upload Action

Reuses existing `uploadAuthorAvatar` pattern:

1. Validate MIME type + file size (≤ 2 MB)
2. Upload to `author-avatars/{authorId}/about.{ext}`
3. Get public URL → `UPDATE authors SET about_photo_url = <url>`
4. Revalidate cache

### 3.5 Zod Validation Schema

```typescript
const aboutSchema = z.object({
  headline:      z.string().max(200).optional(),
  subtitle:      z.string().max(500).optional(),
  aboutMd:       z.string().max(50000).optional(),
  photoCaption:  z.string().max(200).optional(),
  photoLocation: z.string().max(100).optional(),
  aboutCtaLinks: z.object({
    kicker:    z.string().max(100),
    signature: z.string().max(200),
    links: z.array(z.object({
      type:  z.enum(['internal', 'social']),
      key:   z.string(),
      label: z.string().max(50),
    })).max(10),
  }).optional(),
  socialLinks: z.record(z.string().url()).optional(),
})
```

### 3.6 Files Modified

| File | Change |
|------|--------|
| `authors-connected.tsx` | Add two-tab system; move existing fields to "Profile" tab; implement "About Page" tab with all five field groups |
| `actions.ts` | Add `updateAuthorAbout` server action; add `uploadAuthorAboutPhoto` for the about photo path |
| `page.tsx` | No changes — existing data fetch already returns all author columns |

### 3.7 Preview Link

**"↗ Preview /about"** anchor at the bottom of the About Page tab, opens `/about` in a new tab.

---

## 4. Open Decisions

None — all decisions resolved during brainstorming.

## 5. Out of Scope

- **i18n for about fields** — Single-locale (pt-BR) for now. JSONB locale-keyed upgrade path documented.
- **Light mode CSS values** — Reference `about.jsx` has full light palette; implementation follows same tokens.
- **Now page** — Separate future spec if needed.
- **Custom about page footer** — Uses global layout footer.
- **Email display on about page** — Removed; contact form at `/contact` serves this purpose.
