# Newsletter Landing Pages — Design Spec (v2)

**Date:** 2026-05-01
**Score:** 100/100
**Status:** Approved
**Scope:** Dedicated landing page per newsletter type at `/newsletters/[slug]` for social media sharing and subscriber conversion. Visual reference: `design/newsletter-landing-v3.html`.
**Supersedes:** `2026-04-30-newsletter-landing-pages-design.md` (v1, visual approach changed from "color accent only" to full pinboard aesthetic matching prototype)

---

## 1. Problem

Newsletter types exist in the DB and the full subscribe/confirm/send pipeline works (Sprint 5e). But there's no shareable URL per newsletter — the hub at `/newsletters` is a multi-select picker, not a conversion-optimized landing page. To promote individual newsletters on social media, each type needs its own URL with proper OG metadata, branding, and a focused subscribe form.

A design prototype at `design/newsletter-landing-v3.html` defines the complete visual reference: pinboard aesthetic (Paper/Tape components), 2-column hero+form layout, 3-phase double opt-in subscribe flow, sample issues from DB, collapsible FAQ, author section, and mobile sticky CTA. This spec adapts that prototype to the production codebase, replacing hardcoded values with DB queries and CSS variables.

## 2. Scope

**In scope (MVP):**

- Landing page per newsletter type at `/newsletters/[slug]`
- 2-column hero + sticky subscribe form layout
- 3-phase subscribe form (idle → pending double opt-in → confirmed)
- Sample issues section (from `newsletter_editions`, hidden when none exist)
- FAQ accordion (from i18n, same questions for all types)
- Author section (identity from existing Sprint 5b infrastructure)
- Final CTA banner with scroll-to-form
- Mobile sticky CTA (scroll-aware)
- Dynamic OG image route
- Sitemap integration
- Schema migration (slug, description, color_dark, cadence_label, badge, landing_content, og_image_url, updated_at)
- Paper/Tape shared component extraction from hub
- Full i18n (55 new keys, pt-BR + en)
- Graceful degradation for 0/1/2/3+ newsletter types and 0/1/2/3+ editions

**Out of scope (follow-up):**

- Tier system (guest/subscriber/collaborator)
- Cross-promotion section (other newsletters)
- Testimonial section
- Upgrade/payment flow
- Hub migration to DB-driven
- Admin UI for type editing
- Staff preview for inactive types

## 3. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Route pattern | `/newsletters/[slug]` under existing `(public)` layout | Consistent with hub, avoids conflict with `/newsletter/archive` and `/newsletter/confirm` |
| Slug source | New `slug` column on `newsletter_types` | Marketing-friendly URLs. Types are independent publications, not translations |
| Visual approach | Pinboard aesthetic matching prototype | Consistent with site design system, reuses Paper/Tape from hub |
| Data source | All from DB, zero hardcoded | Future-proof, eliminates drift, admin-editable via SQL |
| Sample issues | Query `newsletter_editions` (sent), hide section when none | Real data, zero maintenance, section appears as editions accumulate |
| FAQ source | i18n locale dicts (same for all types) | Generic questions about the service, not per-type. Static content, not data |
| Author data | Identity profiles from Sprint 5b + i18n for role/bio | Reuses existing infrastructure, no new DB schema for author |
| Locale handling | Each type IS a locale | `behind-the-code` is English, `por-tras-do-codigo` is Portuguese. Not translations |
| Query clients | Anon for public reads (type, editions), service-role for subscriber count | RLS auto-filters inactive types; subscriber data not publicly accessible |
| Theme integration | CSS variables (`--pb-*` for pinboard, `--nl-accent` for per-type color) | Zero hardcoded colors, theme-aware, consistent with existing system |
| Paper/Tape reuse | Extract shared components from hub into `components/pinboard/` | Eliminates duplication, hub refactored to import from shared |
| i18n interpolation | `.replace('{key}', value)` pattern | Follows existing project convention (no i18n library) |

## 4. Schema Changes

### 4.1 New columns on `newsletter_types`

| Column | Type | Constraint | Purpose |
|---|---|---|---|
| `slug` | `text NOT NULL` | UNIQUE, format CHECK (`^[a-z0-9][a-z0-9-]*[a-z0-9]$`), length CHECK (3–80), reserved words CHECK | URL-safe slug for landing page |
| `description` | `text` | nullable | Pitch paragraph for page body + `og:description` |
| `og_image_url` | `text` | nullable, CHECK `~ '^https://'` | Custom OG image per type (fallback chain below) |
| `updated_at` | `timestamptz` | DEFAULT `now()`, auto-updated via trigger | Sitemap `lastModified` |
| `color_dark` | `text` | nullable, CHECK `~ '^#[0-9a-fA-F]{6}$'` | Dark-mode accent color (fallback: `color`) |
| `badge` | `text` | nullable | Optional label badge next to slug ("principal", "novo") |
| `cadence_label` | `text` | nullable | Human-readable cadence text ("1× por semana, sextas"). Each type IS a locale |
| `landing_content` | `jsonb` | DEFAULT `'{}'`, structural CHECK | Per-type landing content: `{promise: string[]}` |

### 4.2 Structural CHECK on `landing_content`

```sql
CHECK (
  landing_content IS NULL
  OR (
    jsonb_typeof(landing_content) = 'object'
    AND (
      landing_content->'promise' IS NULL
      OR jsonb_typeof(landing_content->'promise') = 'array'
    )
  )
)
```

### 4.3 Reserved slug protection

```sql
CHECK (slug !~ '^(archive|subscribe|new|settings|edit|confirm|api|admin|hub|rss|feed)$')
```

### 4.4 Slug length constraint

```sql
CHECK (char_length(slug) >= 3 AND char_length(slug) <= 80)
```

### 4.5 RLS

Enabling RLS on `newsletter_types` (if not already enabled from Sprint 5e). Three policies:

```sql
ALTER TABLE newsletter_types ENABLE ROW LEVEL SECURITY;

-- Public: only active types visible (landing pages, subscribe action)
DROP POLICY IF EXISTS "public_read_active_types" ON newsletter_types;
CREATE POLICY "public_read_active_types" ON newsletter_types
  FOR SELECT USING (active = true);

-- Staff: read ALL types including inactive (CMS settings, edition editor, reactivation)
DROP POLICY IF EXISTS "staff_read_all_types" ON newsletter_types;
CREATE POLICY "staff_read_all_types" ON newsletter_types
  FOR SELECT USING (is_member_staff());

-- Staff: manage types (insert, update, delete — for future admin UI)
DROP POLICY IF EXISTS "staff_manage_types" ON newsletter_types;
CREATE POLICY "staff_manage_types" ON newsletter_types
  FOR ALL USING (is_member_staff())
  WITH CHECK (is_member_staff());
```

### 4.6 Trigger — reuse existing `tg_set_updated_at()`

```sql
DROP TRIGGER IF EXISTS set_newsletter_types_updated_at ON newsletter_types;
CREATE TRIGGER set_newsletter_types_updated_at
  BEFORE UPDATE ON newsletter_types
  FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
```

### 4.7 Slug backfill

UPDATE existing 8 types with slug, description, color_dark, cadence_label, badge, and landing_content. All guarded with `WHERE slug IS NULL`. Values sourced from the design prototype's `content.js`.

Example for main-pt:

```sql
UPDATE newsletter_types SET
  slug = 'diario-do-bythiago',
  description = 'Toda sexta, eu paro e escrevo o que aconteceu na semana — o post novo do blog, o vídeo do canal, o bug que me derrubou, o livro que tô lendo. É a newsletter principal, a que junta tudo num lugar só. Não é resumo formal: é mais carta pra um amigo que tá longe.',
  color_dark = '#FF8240',
  cadence_label = '1× por semana, sextas',
  badge = 'principal',
  landing_content = '{"promise":["o post mais recente, com nota pessoal de bastidor","o vídeo da semana, com o que eu cortei e por quê","3–5 links que eu salvei pra ler depois","uma coisa pequena que aprendi (ou quebrei)"]}'
WHERE id = 'main-pt' AND slug IS NULL;
```

### 4.8 Migration idempotency

All `ADD CONSTRAINT` prefixed with `DROP CONSTRAINT IF EXISTS`. `ADD COLUMN IF NOT EXISTS`. `CREATE OR REPLACE FUNCTION`. `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`. `DROP POLICY IF EXISTS` + `CREATE POLICY`. Backfill UPDATEs guarded with `WHERE slug IS NULL`.

## 5. Page Structure + Routing

### 5.1 File structure

```
apps/web/src/app/(public)/newsletters/[slug]/
├── page.tsx                 Server component: queries, metadata, layout
├── loading.tsx              Shimmer skeleton matching 2-col layout
├── not-found.tsx            Styled 404 with links to existing types
├── subscribe-form.tsx       Client island: 3-phase form
├── faq-accordion.tsx        Client island: collapsible questions
├── mobile-sticky-cta.tsx    Client island: scroll-aware bottom bar
└── newsletter-landing.css   Page-specific styles + animations

apps/web/src/components/pinboard/
├── paper.tsx                Shared Paper card (extracted from hub)
├── tape.tsx                 Shared Tape decoration (extracted from hub)
└── index.ts                 Re-exports

apps/web/src/lib/newsletter/
├── cache-invalidation.ts    revalidateNewsletterType(slug)
├── queries.ts               getNewsletterTypeBySlug, getNewsletterStats, getRecentEditions, getActiveTypeCount
└── format.ts                formatSubscriberCount, formatDaysAgo, resolveAccentTextColor

apps/web/src/app/og/newsletter/[slug]/
└── route.tsx                Dynamic OG image (Node runtime, Satori)
```

### 5.2 Rendering strategy

- Static Generation + ISR tag-based
- `generateStaticParams()` — query all active types, return `{slug}[]`
- `dynamicParams = true` — new slugs SSR'd on-demand, then cached
- Revalidation tags: `newsletter:type:${slug}`, `newsletter:editions:${typeId}`, `newsletter:types:count`
- Deactivation: when type set to `active = false` + tag revalidated, page re-renders and calls `notFound()`

### 5.3 Data flow — parallel queries

```typescript
const [type, stats, editions, otherTypesCount] = await Promise.all([
  getNewsletterTypeBySlug(slug),       // anon client, RLS filters active
  getNewsletterStats(slug),            // service-role (subscriber data)
  getRecentEditions(slug, 3),          // anon client, sent editions only
  getActiveTypeCount(),                // service-role, cached
])
if (!type) notFound()
```

### 5.4 Query client rationale

| Query | Client | Rationale |
|---|---|---|
| `getNewsletterTypeBySlug` | Anon | RLS auto-filters `active=true`. Zero risk of leaking inactive types |
| `getNewsletterStats` | Service-role | Subscriber count not publicly accessible via RLS |
| `getRecentEditions` | Anon | Sent editions are public content |
| `getActiveTypeCount` | Service-role | Cross-type count, cached separately |

### 5.5 Error handling

```typescript
try {
  const [type, stats, editions, otherCount] = await Promise.all([...])
  if (!type) notFound()
} catch (err) {
  Sentry.captureException(err, {
    tags: { component: 'newsletter-landing', seo: true },
    extra: { slug },
  })
  throw err  // Next.js error boundary handles
}
```

## 6. Page Layout

### 6.1 Wrapper

```tsx
<article
  lang={type.locale === 'pt-BR' ? 'pt-BR' : 'en'}
  className="nl-landing"
  style={{
    '--nl-accent-light': type.color,
    '--nl-accent-dark': type.color_dark ?? type.color,
    '--nl-accent-text': resolveAccentTextColor(type.color),
  } as React.CSSProperties}
>
```

### 6.2 Locale boundary

| Element | Locale source | Rationale |
|---|---|---|
| `<article lang>` attribute | Type locale | Screen reader pronunciation |
| Hero, description, promise, form labels, FAQ | Type locale | Content is in the newsletter's language |
| `<GlobalHeader>`, `<PinboardFooter>` | Visitor locale (middleware) | Site-wide navigation follows visitor |
| 404 page | Visitor locale | No type available |
| Breadcrumb labels | Type locale | Inside `<article>`, consistent with content |
| OG metadata `locale` | Type locale | Social share shows newsletter's language |

### 6.3 Section breakdown

| Section | Content | Responsive behavior |
|---|---|---|
| **Breadcrumb** | `<nav aria-label="Breadcrumb">` Home > Newsletters > `{slug}`. "Newsletters" hidden when `otherTypesCount === 0` | Single row, wraps |
| **Hero + Form** | 2-col grid `1.4fr 1fr`. Left: slug badge + recency dot + title (marker underline) + tagline (Fraunces italic) + description + stat row + promise list. Right: sticky form | 1-col at ≤920px |
| **Samples** | Section header + grid of Paper issue cards. Each: envelope header, subject, preview, "read full" link | 3→2→1 col at breakpoints |
| **Author** | Avatar (next/image or initials fallback) + name + role + bio (2 sentences) + links (/about, /now) | Horizontal, wraps |
| **FAQ** | Collapsible accordion, first open. Fraunces questions, body answers. Max-width 880px | Full width |
| **Final CTA** | Accent-bg banner. Name, cadence, subscriber count (conditional). CTA scrolls to form | 2→1 col at ≤920px |
| **Footer** | Trust microcopy + links. "All newsletters" hidden when `otherTypesCount === 0` | Center-aligned |

### 6.4 "Back to hub" link below form

Below the sticky form card, centered:

- `otherTypesCount === 0`: hidden
- `otherTypesCount >= 1`: "ou ver todas as newsletters →" / "or see all newsletters →"

JetBrains Mono 11px, faint color, link muted with underline. Links to `/newsletters`.

### 6.5 Stat row — conditional columns

| Condition | Grid columns shown |
|---|---|
| subscribers ≥ 10 AND editions ≥ 1 | cadence · subscribers · editions (3 cols) |
| subscribers ≥ 10 AND editions === 0 | cadence · subscribers (2 cols) |
| subscribers < 10 AND editions ≥ 1 | cadence · editions (2 cols) |
| subscribers < 10 AND editions === 0 | cadence only (1 col) |

Format: `1.2k` for ≥ 1000, exact number below. Each stat card: JetBrains Mono label + Fraunces value, separated by dashed border-left.

### 6.6 Recency indicator

Shown when `editions >= 1`. Green dot (#3CB371) when `daysSinceLast < 14`, amber dot (#D9A441) otherwise. Dot is `aria-hidden="true"`, text "last shipped X days ago" is accessible content. JetBrains Mono 10px, muted color, background subtle.

## 7. Subscribe Form — 3-Phase Client Island

### 7.1 Props interface

```typescript
interface SubscribeFormProps {
  newsletterId: string
  locale: 'en' | 'pt-BR'
  accentColor: string
  newsletterName: string
  strings: SubscribeFormStrings  // serializable i18n subset
  privacyHref: string           // locale-aware: '/privacidade' or '/privacy'
  turnstileSiteKey?: string     // undefined = omit widget
}
```

### 7.2 Phase state machine

`idle → loading → pending | error`, then `pending → confirmed`, `error → idle` (retry).

| Phase | UI | Focus target |
|---|---|---|
| **idle** | Step badge "STEP 1/2". Email input with visible label + consent checkbox + submit button + trust microcopy grid (3 icons: no spam / no pitch / 1-click leave) | — |
| **loading** | Inputs disabled, button shows `↻ sending…`, `aria-busy="true"` on form | — |
| **pending** | Replaces form content. Step badge "STEP 2/2". Title + body with email interpolation. 3-step indicator (step 1 done, step 2 active with pulse, step 3 pending). Email display box. Spam tip. Resend + change-email buttons | H3 heading via ref |
| **confirmed** | All 3 steps done. Checkmark + "valeu!"/"thanks!" in Caveat. Success title + body. "Subscribe another email" button | H3 heading via ref |
| **error** | Form stays visible. Inline error in `<div role="alert" aria-live="polite">`. Email input border turns error color. Error below submit, above trust microcopy | Error div via ref |

### 7.3 Step indicator component

| Step state | Bullet | Circle (22×22px) | Label |
|---|---|---|---|
| **done** | ✓ | Filled `var(--nl-accent)`, white text | Uppercase, bold, accent color |
| **active** | ● | Border `1.5px solid var(--pb-ink)` + `pulse` animation | Uppercase, bold, ink color |
| **pending** | ○ | Border `1.5px solid var(--pb-faint)` | Uppercase, normal, faint, `opacity: 0.5` |

Steps separated by `border-top: 1px dashed var(--pb-line)`. Last step has no top border. Vertical layout (stacked).

### 7.4 Email display box (pending phase)

Below step indicator. Monospace box with submitted email:

- `border-left: 2px dashed var(--nl-accent)`
- Background: `rgba(0,0,0,0.25)` dark / `rgba(0,0,0,0.04)` light
- JetBrains Mono 12px, `word-break: break-all`
- Prefix: ✉ icon before email in bold

### 7.5 Resend cooldown

After clicking "resend": button text changes to `✓ reenviado!` / `✓ resent!` in accent color for 2.2 seconds, then reverts. Button disabled during cooldown. MVP: visual-only (action already sent email on first submit). Follow-up: wire to actual resend server action.

### 7.6 Error types

| Error key | PT | EN |
|---|---|---|
| `rate` | "Devagar aí. Tenta de novo em alguns minutos." | "Easy there. Try again in a few minutes." |
| `dup` | "Esse email já está inscrito. Valeu!" | "You're already subscribed. Thanks!" |
| `invalid` | "Email não parece válido." | "That email doesn't look right." |
| `server` | "Algo deu errado. Tenta de novo?" | "Something broke. Try again?" |

Error display: `padding: 10px 12px`, background `rgba(193,69,19,0.1)`, `border-left: 3px solid #C14513`, font 13px.

### 7.7 Client-side validation

Button disabled when `!email.includes('@') || !consent || phase === 'loading'`. HTML5 `type="email"` + `required` on input. Server validates with Zod.

### 7.8 Action reuse

Reuses `subscribeToNewsletters(email, [newsletterId], locale, turnstileToken)` from `apps/web/src/app/(public)/actions/subscribe-newsletters.ts`. Single-element array. Maps action response `{success, error}` to phase transition.

### 7.9 Turnstile

Loaded via `next/script strategy="lazyOnload"`. Widget renders inside form only when `turnstileSiteKey` is set (env `NEXT_PUBLIC_TURNSTILE_SITE_KEY`). Token captured in hidden ref, passed to action. Omitted in dev.

### 7.10 Consent checkbox

Required. Label text: `{consentPrefix}<strong>{newsletterName}</strong>{consentSuffix}<a href={privacyHref} target="_blank" rel="noopener">{privacyLabel}</a>.`

Privacy link locale-aware: PT type → `/privacidade`, EN type → `/privacy`. Opens in new tab.

## 8. Styled 404 (not-found.tsx)

When slug doesn't exist or type is inactive:

- Pinboard background (`var(--pb-bg)`)
- Handwritten exclamation: "epa." / "huh." (Caveat font, `var(--pb-accent)`, `rotate(-3deg)`, 56px)
- Fraunces heading: "Essa newsletter não existe." / "That newsletter doesn't exist." (44px, weight 500)
- Body: "Talvez o link tenha quebrado. Aqui estão as que existem agora:" / "Maybe the link broke. Here are the ones that exist now:" (17px, muted)
- Grid of active types from DB: each card with accent `border-left: 4px solid`, name (Fraunces 18px), tagline (13px muted). Links to `/newsletters/{slug}`
- When 0 other types: shows only "Go to homepage" / "Ir pra home" link

Locale detection: visitor locale from middleware `x-locale` header (not newsletter locale, since no type resolved).

Query: service-role fetch all active types with slug + name + tagline + color + locale. Light query, not cached (404 pages are rare).

## 9. Theme Integration

### 9.1 CSS variable strategy

| Token | Source | Usage |
|---|---|---|
| `--pb-bg`, `--pb-paper`, `--pb-paper2`, `--pb-ink`, `--pb-muted`, `--pb-faint`, `--pb-line`, `--pb-accent`, `--pb-marker`, `--pb-tape`, `--pb-tape2` | `globals.css` pinboard palette, theme-aware via `[data-theme]` | Background, paper tint, text, borders, tape |
| `--nl-accent` | Set in `newsletter-landing.css` from `--nl-accent-light` / `--nl-accent-dark` inline styles | Per-newsletter accent color |
| `--nl-accent-text` | Computed server-side via `resolveAccentTextColor()` | Submit button text (white or dark) |

### 9.2 `newsletter-landing.css`

```css
.nl-landing {
  --nl-accent: var(--nl-accent-light);
}
[data-theme="dark"] .nl-landing {
  --nl-accent: var(--nl-accent-dark);
}
```

### 9.3 Marker color

The accent underline behind the hero title always uses `var(--pb-marker)` (`#FFE37A`). This is the yellow highlighter from the pinboard palette, consistent across the site. The form title uses `var(--nl-accent)` for its underline.

### 9.4 Accent contrast

```typescript
function resolveAccentTextColor(accentHex: string): string {
  const r = parseInt(accentHex.slice(1, 3), 16) / 255
  const g = parseInt(accentHex.slice(3, 5), 16) / 255
  const b = parseInt(accentHex.slice(5, 7), 16) / 255
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}
```

Used for submit button text and final CTA banner text.

## 10. Paper/Tape Shared Components

### 10.1 Extraction from hub

Extract inline Paper/Tape patterns from `NewslettersHub.tsx` into shared components:

```typescript
// components/pinboard/paper.tsx
interface PaperProps {
  children: React.ReactNode
  tint?: string          // CSS variable or color, default 'var(--pb-paper)'
  padding?: string       // default '20px'
  rotation?: number      // degrees, default 0
  translateY?: number    // px, default 0
  shadow?: boolean       // default true
  className?: string
  style?: React.CSSProperties
}

// components/pinboard/tape.tsx
interface TapeProps {
  color?: string         // default 'var(--pb-tape)'
  className?: string
  style?: React.CSSProperties
}
```

### 10.2 Deterministic rotation/lift

```typescript
const rot = (i: number) => ((i * 37) % 7 - 3) * 0.5  // degrees
const lift = (i: number) => ((i * 53) % 5 - 2) * 2    // px
```

Same formula as prototype. Produces subtle, varied rotations per card index.

### 10.3 Hub refactoring

`NewslettersHub.tsx` refactored to import `Paper` and `Tape` from `components/pinboard/`. No visual change. Reduces hub file size by ~30 lines.

## 11. Accessibility

| Element | Implementation |
|---|---|
| **Wrapper** | `<article lang={type.locale}>` — screen reader pronunciation switch |
| **Skip link** | Hidden "Skip to subscribe form" link, visible on `:focus-visible`, targets `#form-hero` |
| **Breadcrumb** | `<nav aria-label="Breadcrumb">`, `<ol>` with `<li>`, `aria-current="page"` on last item |
| **Form labels** | `<label htmlFor="nl-email">` for email input, visible label text above input |
| **Form errors** | `<div role="alert" aria-live="polite" id="form-error">`, input `aria-describedby="form-error"` when error present |
| **Form loading** | `aria-busy="true"` on `<form>` during loading phase |
| **Focus management** | After submit: focus moves to pending/confirmed heading via `ref.focus()`, or error div. Targets have `tabIndex={-1}` |
| **Consent checkbox** | Visible label with interpolated newsletter name (bold) + privacy link (new tab) |
| **FAQ accordion** | `<button aria-expanded={open} aria-controls={panelId} id={buttonId}>`. Panel: `<div id={panelId} role="region" aria-labelledby={buttonId}>`. First item open by default |
| **Touch targets** | All interactive elements ≥ 44×44px tap area (padding/min-height) |
| **Reduced motion** | `@media (prefers-reduced-motion: reduce)` disables all animations (pulse, fadeIn) and transitions |
| **Recency dot** | `aria-hidden="true"` on dot element. "Last shipped X days ago" text is accessible |
| **Focus visibility** | `a:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid currentColor; outline-offset: 2px }` |
| **Accent contrast** | `resolveAccentTextColor()` ensures submit button text meets WCAG AA 4.5:1 ratio |

## 12. Animations & Transitions

| Animation | Where | Duration | Easing | Reduced-motion |
|---|---|---|---|---|
| `fadeIn` | FAQ answer expand | 0.2s | ease-out | Disabled (duration: 0s) |
| `pulse` | Active step indicator (pending phase) | 1.6s | ease-in-out, infinite | Disabled |
| Form phase crossfade | Opacity transition between idle/pending/confirmed | 0.15s | ease | Duration: 0s |
| Mobile CTA slide | `translateY(0)` ↔ `translateY(120%)` | 0.32s | cubic-bezier(.2,.8,.2,1) | Duration: 0s |
| Paper rotation/lift | Inline `transform` per card index | Static | N/A | N/A (no animation) |
| Accent underline (hero) | `<span>` behind title, `skew(-2deg)`, marker color, `opacity: 0.16` | Static | N/A | N/A |
| Accent underline (form) | `<span>` behind form title, `skew(-2deg)`, accent color, `opacity: 0.85` | Static | N/A | N/A |

```css
@media (prefers-reduced-motion: reduce) {
  .nl-landing *,
  .nl-landing *::before,
  .nl-landing *::after {
    animation-duration: 0s !important;
    transition-duration: 0s !important;
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

## 13. SEO + OG Metadata

### 13.1 `generateMetadata`

```typescript
{
  title: `${type.name} — Newsletter`,
  description: type.description ?? type.tagline ?? t.defaultDescription,
  openGraph: {
    title: type.name,
    description: type.description ?? type.tagline ?? t.defaultDescription,
    type: 'website',
    locale: type.locale === 'pt-BR' ? 'pt_BR' : 'en_US',
    url: `https://bythiagofigueiredo.com/newsletters/${type.slug}`,
    images: [resolvedOgImageUrl],
    siteName: 'Thiago Figueiredo',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@tnFigueiredo',
  },
  alternates: {
    canonical: `https://bythiagofigueiredo.com/newsletters/${type.slug}`,
    // NO hreflang — independent publications, not translations
  },
}
```

### 13.2 JSON-LD

`WebPage` + `BreadcrumbList` via existing `<JsonLdScript>` pattern from Sprint 5b. Nodes added to layout root's `@graph`.

### 13.3 OG image precedence chain

1. `newsletter_types.og_image_url` (explicit per-type override)
2. Dynamic OG via `/og/newsletter/[slug]` (gated by `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED`)
3. `sites.seo_default_og_image` (site-wide fallback)
4. `/og-default.png` (last-resort)

```typescript
function resolveOgImage(type: NewsletterType, siteConfig: SiteConfig): string {
  if (type.og_image_url) return type.og_image_url
  if (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED === 'true')
    return `${siteConfig.baseUrl}/og/newsletter/${type.slug}`
  if (siteConfig.seoDefaultOgImage) return siteConfig.seoDefaultOgImage
  return `${siteConfig.baseUrl}/og-default.png`
}
```

### 13.4 Dynamic OG image route

Route: `apps/web/src/app/og/newsletter/[slug]/route.tsx` — Node runtime (Satori).

Template (1200×630px):

```
┌──────────────────────────────────────────────────┐
│ ████████████████████████████████████████████████ │  accent color bar (6px)
│                                                  │
│  NEWSLETTER                                      │  small caps, #888, 16px
│                                                  │
│  Behind the Code                                 │  Inter Bold, 56px, max 2 lines
│                                                  │
│  Weekly deep dives into code architecture,       │  Inter Regular, 24px, max 3 lines
│  tooling, and engineering decisions.             │  (description ?? tagline, omit if null)
│                                                  │
│  ┌──────────┐                                    │
│  │ ⟳ Weekly │                                    │  cadence badge (contrast-aware)
│  └──────────┘                                    │  (omit if cadence_label null)
│                                                  │
│  ──────────────────────────────────────────────  │  divider, #eee
│  Thiago Figueiredo    bythiagofigueiredo.com     │  18px, #888, space-between
└──────────────────────────────────────────────────┘
```

Padding: 60px horizontal, 50px vertical. Background: `#fafafa`.

Badge contrast logic:

```typescript
const luminance = relativeLuminance(type.color)
const badgeStyle = luminance > 0.5
  ? { background: `${type.color}22`, color: type.color }   // light accent → tinted bg + colored text
  : { background: type.color, color: '#fff' }               // dark accent → solid bg + white text
```

Font: Inter latin subset (~35KB), same file used by existing OG routes.

Cache: `public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`. Tag: `og:newsletter:${slug}`.

Error: slug not found → redirect 302 to `/og-default.png`. Feature gate off → redirect. Sentry capture with `tags: { seo: true, component: 'og-route', type: 'newsletter' }`.

### 13.5 Sitemap integration

Add to `enumerateSiteRoutes()` in `apps/web/src/lib/seo/enumerator.ts`:

```typescript
const { data: newsletterTypes } = await supabase
  .from('newsletter_types')
  .select('slug, updated_at')
  .eq('active', true)

for (const type of newsletterTypes ?? []) {
  routes.push({
    url: `/newsletters/${type.slug}`,
    lastModified: type.updated_at,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  })
}
```

No robots changes. `/newsletters/[slug]` is public, indexable.

## 14. i18n — Full Key List

**55 new keys** in `en.json` and `pt-BR.json` under `newsletter.landing.*`:

```
── Navigation ──
crumbHome, crumbHub

── Hero ──
newBadge, subsLabel, issuesLabel, sentLabel,
daysAgo.today, daysAgo.yesterday, daysAgo.n (with {n})

── Promise ──
sectionWhat

── Form (idle) ──
stepLabel, formTitle, formSubtitle,
emailLabel, emailPlaceholder,
consentPrefix, consentSuffix, privacy,
submit, submitting,
noSpam, noPitch, oneClickLeave

── Form (pending) ──
pendingTitle, pendingBody (with {email}),
pendingStep1, pendingStep2, pendingStep3,
pendingTip, pendingResend, pendingResent, pendingChangeEmail

── Form (confirmed) ──
confirmedTitle, confirmedBody, confirmedExclamation, successAgain

── Form (errors) ──
errorRateLimit, errorAlreadySubscribed, errorInvalid, errorServer

── Samples ──
sectionSamples, sampleSubject, sampleReadFull

── Author ──
sectionAuthor, authorRole, authorBio, authorMore, authorNow

── FAQ ──
sectionFaq, faq (array of 5 {q, a} objects)

── Final CTA ──
finalKicker, finalTitle (with {name}), finalSub (with {cadence}),
finalSubscribers (with {count}), backToTopForm

── Footer ──
footerNote, footerSub, backToHome, allNewsletters, backToHub

── 404 ──
notFoundExclamation, notFoundTitle, notFoundBody, goHome
```

Interpolation uses `.replace('{key}', value)` — follows existing project convention.

Locale dict loaded server-side based on `type.locale`. Serializable subset passed as props to client islands (`SubscribeFormStrings`, `FaqStrings`).

## 15. Graceful Degradation

| Condition | Affected elements | Behavior |
|---|---|---|
| **0 other active types** | Breadcrumb "Newsletters" link, "back to hub" link, footer "all newsletters", 404 grid | Breadcrumb: Home > `{slug}` only. Hub/footer links hidden. 404: "Go home" only |
| **1+ other active types** | Same elements | Full breadcrumb, hub link, footer link. 404: grid of other types |
| **0 sent editions** | Samples section | Entirely hidden |
| **1 sent edition** | Samples grid | Single card, full width |
| **2 sent editions** | Samples grid | 2-column grid |
| **3+ sent editions** | Samples grid | 3-column grid, top 3 shown |
| **< 10 subscribers** | Stat row subscriber column, final CTA count | Column hidden, CTA omits count |
| **≥ 10 subscribers** | Stat row, final CTA | Column shown, CTA shows count |
| **0 published editions** | Stat row editions column | Column hidden |
| **No `description`** | Hero description, OG | Falls back to `tagline`, then i18n default |
| **No `color_dark`** | Dark mode accent | Falls back to `color` value |
| **No `cadence_label`** | Stat row cadence | Derives from `cadence_days`: 7→Weekly/Semanal, 14→Bi-weekly/Quinzenal, 30→Monthly/Mensal, else hidden |
| **No `badge`** | Hero slug line | Badge not rendered |
| **Empty `promise` array or null** | Promise section | Section hidden |
| **No `og_image_url`** | OG image | Precedence chain fallback |
| **Turnstile key not set** | Form widget | Widget omitted, token not required |

## 16. Responsive Design

Three breakpoints matching prototype:

### Desktop (>920px)

- Hero: 2-col grid `1.4fr 1fr`, gap 56px
- Form: `position: sticky; top: 110px`
- Samples: 3-col grid (or auto-fit for < 3)
- Final CTA: 2-col grid `1.5fr 1fr`
- Author: horizontal flex
- Mobile CTA: hidden

### Tablet (621–920px)

- Hero: 1-col, form below content
- Form: static (not sticky)
- Samples: 2-col grid
- Final CTA: 1-col
- Author: horizontal flex, wraps
- Mobile CTA: hidden

### Mobile (≤620px)

- Everything: 1-col
- Samples: 1-col
- Hero title: 48px (down from 76px)
- Section horizontal padding: 18px (down from 28px)
- Mobile CTA: visible (sticky bottom bar)

Mobile sticky CTA:

- Fixed bottom, full-width
- Gradient background (transparent → dark)
- Accent-colored button: "↑ ir pro formulário" / "↑ go to form"
- Shows only when form is out of viewport AND phase === 'idle'
- Slide in/out with `translateY` + cubic-bezier transition
- `display: none` on desktop, `display: block` on mobile via CSS media query

## 17. Security

- **Turnstile CAPTCHA** on form submit (gated by `NEXT_PUBLIC_TURNSTILE_SITE_KEY`)
- **Rate limiting** via existing `newsletter_rate_check` RPC
- **Email validation** — client (HTML5 `type="email"` + `@` check) + server (Zod)
- **Newsletter ID** not exposed in DOM — captured in server action closure
- **CSRF** — Next.js server actions built-in CSRF protection
- **Consent** — `required` checkbox, LGPD-compliant text with privacy link
- **Privacy link** — locale-aware: PT type → `/privacidade`, EN type → `/privacy`, `target="_blank" rel="noopener"`

## 18. Performance

- **Client JS budget:** ~5KB gzipped total (form ~3KB, FAQ ~1KB, mobile CTA ~1KB). No heavy dependencies
- **Author avatar:** `next/image` with `width={72} height={72}` for `/identity/thiago.jpg` from Sprint 5b. Fallback to initials div if image missing
- **Subscriber count is ISR-cached**, not live. Updated when `revalidateTag('newsletter:type:${slug}')` fires
- **Fonts:** All 4 fonts (Inter, Fraunces, JetBrains Mono, Caveat) already loaded in public layout. No additional font requests
- **Turnstile:** Loaded via `next/script strategy="lazyOnload"`, only when env var is set

## 19. Tests

### 19.1 Unit tests (vitest) — 12 files

| Test | File | Validates |
|---|---|---|
| Social proof display | `test/unit/newsletter/social-proof.test.ts` | 4 threshold scenarios (< 10, 10–999, 1k+, combined) |
| Cadence format | `test/unit/newsletter/cadence-format.test.ts` | Label present → use it. Absent → derive from days. Null → hidden |
| Subscriber count format | `test/unit/newsletter/format-count.test.ts` | `1240 → "1.2k"`, `408 → "408"`, `5 → hidden` |
| Days ago format | `test/unit/newsletter/days-ago.test.ts` | 0 → today, 1 → yesterday, 5 → "5 days ago", locale variants |
| Accent contrast | `test/unit/newsletter/accent-contrast.test.ts` | White bg → dark text, dark bg → white text, edge: yellow, black |
| OG precedence | `test/unit/newsletter/og-precedence.test.ts` | 4 fallback steps |
| Cache invalidation | `test/unit/newsletter/cache-invalidation.test.ts` | Both tags revalidated |
| Subscribe form | `test/unit/newsletter/landing-form.test.tsx` | 3 phases, error states, consent required, focus management, a11y |
| FAQ accordion | `test/unit/newsletter/faq-accordion.test.tsx` | Expand/collapse, aria-expanded, keyboard Enter/Space, first-open default |
| i18n completeness | `test/unit/newsletter/landing-i18n.test.ts` | Both locales have all 55 keys, no empty values, FAQ arrays same length |
| Page component | `test/unit/newsletter/landing-page.test.tsx` | notFound for invalid/inactive slug. Props passed correctly. Metadata correct |
| Graceful degradation | `test/unit/newsletter/graceful-degradation.test.ts` | All 16 conditions from matrix |

### 19.2 Integration tests (DB-gated) — 2 files

| Test | Validates |
|---|---|
| Migration schema | Columns exist, types correct. UNIQUE on slug. Format CHECK. Reserved words. HTTPS. Length 3–80. jsonb structural CHECK |
| RLS policies | Anon sees only active. Staff sees all including inactive. Service role bypasses |

### 19.3 E2E (Playwright) — 1 spec file

| Test | Validates |
|---|---|
| Landing page render | Navigate `/newsletters/{slug}`, see name + tagline + form |
| Subscribe flow | Fill email, check consent, submit, see pending state |
| 404 for invalid slug | Shows styled 404 with existing types grid |
| Mobile responsive | 1-col layout, sticky CTA visible |
| A11y | AxeBuilder scan, zero violations |
| OG image | `fetch('/og/newsletter/{slug}')` returns 200 + image/png |

### 19.4 Paper/Tape components — 1 file

| Test | Validates |
|---|---|
| Paper render | Tint, rotation, shadow, padding applied correctly |
| Tape render | Color, positioning via style prop |
| Hub still works | Render test after refactoring hub to use shared components |

## 20. Known Limitations

1. **Slug change = broken old URL.** No redirect table for MVP. Impact low (slugs set once).
2. **No staff preview for inactive types.** `active=false` → 404 for everyone. Follow-up.
3. **Hub remains hardcoded.** Slug links added but catalog not migrated to DB. Follow-up.
4. **Type editing via SQL only.** Cache busted by redeploy. Follow-up: admin page calls `revalidateNewsletterType(slug)`.
5. **No hreflang.** Types are independent publications, not translations.
6. **Subscriber count is ISR-cached**, not live. Updated on tag revalidation. Acceptable for marketing page.
7. **Resend button is visual-only in MVP.** Shows "resent!" but doesn't call backend. Follow-up: wire to resend action.
8. **No real-time confirmation detection.** Pending phase can't detect when user clicks confirmation email in another tab. User must revisit or subscribe again.

## 21. File Inventory

| Action | File |
|---|---|
| **New migration** | `supabase/migrations/YYYYMMDD_newsletter_types_landing.sql` |
| **New page** | `apps/web/src/app/(public)/newsletters/[slug]/page.tsx` |
| **New loading** | `apps/web/src/app/(public)/newsletters/[slug]/loading.tsx` |
| **New not-found** | `apps/web/src/app/(public)/newsletters/[slug]/not-found.tsx` |
| **New client island** | `apps/web/src/app/(public)/newsletters/[slug]/subscribe-form.tsx` |
| **New client island** | `apps/web/src/app/(public)/newsletters/[slug]/faq-accordion.tsx` |
| **New client island** | `apps/web/src/app/(public)/newsletters/[slug]/mobile-sticky-cta.tsx` |
| **New CSS** | `apps/web/src/app/(public)/newsletters/[slug]/newsletter-landing.css` |
| **New shared** | `apps/web/src/components/pinboard/paper.tsx` |
| **New shared** | `apps/web/src/components/pinboard/tape.tsx` |
| **New shared** | `apps/web/src/components/pinboard/index.ts` |
| **New queries** | `apps/web/src/lib/newsletter/queries.ts` |
| **New format** | `apps/web/src/lib/newsletter/format.ts` |
| **New cache** | `apps/web/src/lib/newsletter/cache-invalidation.ts` |
| **New OG route** | `apps/web/src/app/og/newsletter/[slug]/route.tsx` |
| **Edit enumerator** | `apps/web/src/lib/seo/enumerator.ts` (add newsletter types query) |
| **Edit hub** | `apps/web/src/app/(public)/newsletters/components/NewslettersHub.tsx` (import Paper/Tape from shared) |
| **Edit locale dicts** | `apps/web/src/locales/en.json` + `apps/web/src/locales/pt-BR.json` (55 new keys) |

**Total: 15 files new + 4 files edited + 16 test files.**
