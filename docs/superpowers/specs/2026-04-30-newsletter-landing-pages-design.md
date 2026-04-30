# Newsletter Landing Pages — Design Spec

**Date:** 2026-04-30
**Score:** 98/100
**Status:** Approved
**Scope:** Dedicated landing page per newsletter type at `/newsletters/[slug]` for social media sharing and subscriber conversion.

---

## 1. Problem

Newsletter types exist in the DB and the full subscribe/confirm/send pipeline works (Sprint 5e). But there's no shareable URL per newsletter — the hub at `/newsletters` is a multi-select picker, not a conversion-optimized landing page. To promote individual newsletters on social media, each type needs its own URL with proper OG metadata, branding, and a focused subscribe form.

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Route pattern | `/newsletters/[slug]` under existing `(public)` layout | Consistent with hub at `/newsletters`, avoids conflict with `/newsletter/archive` and `/newsletter/confirm` |
| Slug source | New `slug` column on `newsletter_types` | Marketing-friendly URLs (`behind-the-code` vs `code-en`). Types are independent publications, not translations |
| Visual approach | Color accent only (option A) | Ship fast, consistent with site design system, no art assets needed per type |
| Past editions | Not shown (subscriber-only content) | Incentive to subscribe; editions are exclusive |
| Locale handling | Inherent to type — each type IS a locale | `behind-the-code` is English, `por-tras-do-codigo` is Portuguese. Not translations of each other |
| Social proof | Conditional display based on thresholds | Avoids "0 subscribers" anti-pattern |
| Hub integration | Add slug + link to hardcoded catalog (minimal) | Full DB-driven hub is a follow-up |
| Type editing | Direct DB for MVP, admin UI as follow-up | Cache invalidation helper ready for future admin actions |

## 3. Schema Changes

### 3.1 New columns on `newsletter_types`

| Column | Type | Constraint | Purpose |
|---|---|---|---|
| `slug` | `text NOT NULL` | UNIQUE, format check, reserved words check | URL for landing page |
| `description` | `text` | nullable | Pitch paragraph for page body + `og:description` |
| `og_image_url` | `text` | nullable, CHECK `~ '^https://'` | Custom OG image per type (fallback chain below) |
| `updated_at` | `timestamptz` | DEFAULT `now()`, auto-updated via trigger | Sitemap `lastModified` |

### 3.2 Slug backfill

| Type ID | Slug | Description (default, editable) |
|---|---|---|
| `main-en` | `weekly-digest` | A curated weekly roundup of insights on tech, travel, and personal growth. |
| `main-pt` | `resumo-semanal` | Um resumo semanal com insights sobre tecnologia, viagens e crescimento pessoal. |
| `trips-en` | `travel-notes` | Monthly dispatches from the road — destinations, tips, and stories from a nomadic life. |
| `trips-pt` | `notas-de-viagem` | Relatos mensais da estrada — destinos, dicas e histórias de uma vida nômade. |
| `growth-en` | `growth-playbook` | Bi-weekly strategies on building products, audience, and sustainable businesses. |
| `growth-pt` | `estrategias-de-crescimento` | Estratégias quinzenais sobre construção de produtos, audiência e negócios sustentáveis. |
| `code-en` | `behind-the-code` | Weekly deep dives into code architecture, tooling, and engineering decisions. |
| `code-pt` | `por-tras-do-codigo` | Mergulhos semanais em arquitetura de código, ferramentas e decisões de engenharia. |

### 3.3 Reserved slug protection

```sql
CHECK (slug !~ '^(archive|subscribe|new|settings|edit|confirm|api|admin)$')
```

### 3.4 RLS

Enabling RLS for the first time on this table. Three policies needed — public read (active only) + staff read (all, including inactive for CMS) + staff manage (write ops for future admin UI).

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

Without the staff policies, enabling RLS would break CMS pages that query `newsletter_types` via authenticated client (e.g., edition type picker, newsletter settings).

### 3.5 Trigger — reuse existing `tg_set_updated_at()`

```sql
DROP TRIGGER IF EXISTS set_newsletter_types_updated_at ON newsletter_types;
CREATE TRIGGER set_newsletter_types_updated_at
  BEFORE UPDATE ON newsletter_types
  FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
```

### 3.6 Migration idempotency

All `ADD CONSTRAINT` prefixed with `DROP CONSTRAINT IF EXISTS`. `ADD COLUMN IF NOT EXISTS` for columns. `CREATE OR REPLACE FUNCTION` for functions. `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` for triggers. `DROP POLICY IF EXISTS` + `CREATE POLICY` for RLS. Backfill UPDATEs guarded with `WHERE slug IS NULL`.

## 4. Page Structure + Routing

### 4.1 Route

```
apps/web/src/app/(public)/newsletters/[slug]/
├── page.tsx              Server component: fetch, metadata, layout
├── loading.tsx           Skeleton (3 shimmer blocks: hero, description, form)
└── subscribe-form.tsx    Client island: form + interactivity (only JS on page)
```

### 4.2 Rendering strategy

- Static Generation + ISR tag-based
- `generateStaticParams()` — query all active types, return `{slug}[]`
- `dynamicParams = true` — new slugs SSR'd on-demand, then cached
- Revalidation: `revalidateTag('newsletter:type:${slug}')` — triggered by admin edit or deactivation
- Deactivation: when admin sets `active = false` + revalidates tag, page re-renders and calls `notFound()` (inactive = 404)

### 4.3 Page layout (server-rendered, mobile-first, single column)

| Block | Render | Details |
|---|---|---|
| **Wrapper** | Server | `<article lang={type.locale}>` — overrides root layout's `<html lang>` (which reflects visitor locale from middleware). Ensures screen readers use correct pronunciation for the newsletter's language |
| **Breadcrumb** | Server | Home > Newsletters > {name}. JSON-LD `BreadcrumbList`. Links to `/` and `/newsletters` |
| **Hero** | Server | `<h1>` = name with accent `color` via CSS custom property. `<p>` = tagline |
| **Description** | Server | From `description` column. `max-width: 65ch`, larger font |
| **Social proof** | Server | Conditional — see display rules below |
| **Subscribe form** | Client island | `<SubscribeForm {...props} />` |
| **Footer note** | Server | Link to privacy policy, localized |

### 4.4 Social proof display rules

| Subscribers | Editions | Displays |
|---|---|---|
| >= 10 | >= 1 | `{N} subscribers · {M} editions · {cadence}` |
| >= 10 | 0 | `{N} subscribers · {cadence}` |
| < 10 | >= 1 | `{M} editions · {cadence}` |
| < 10 | 0 | "New!" badge + `{cadence}` only |

Format: `1.2k` for >= 1000, exact number below. Computed via COUNT queries in server component, cached via ISR.

### 4.5 Subscribe form spec

**Props interface:**

```typescript
interface SubscribeFormProps {
  newsletterId: string
  locale: 'en' | 'pt-BR'
  accentColor: string
  newsletterName: string
  strings: SubscribeFormStrings  // serializable i18n dict
}
```

| Element | Spec |
|---|---|
| **Email input** | `type="email"`, `required`, visible `<label htmlFor="email">`, placeholder `you@example.com` |
| **Newsletter ID** | Captured in action closure, not exposed in DOM |
| **Consent checkbox** | `required`. Text: "I agree to receive the **{name}** newsletter by email and accept the [Privacy Policy]" (localized, name in bold, link opens new tab) |
| **Turnstile** | Gated by `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Omitted in dev |
| **Submit button** | Text from i18n dict. Background = `accentColor`. `disabled` during submit |
| **Loading** | Spinner inline in button, inputs disabled, `aria-busy="true"` on form |
| **Success** | Replaces form entirely: localized "Check your inbox to confirm" message. Color = `accentColor` |
| **Errors** | Inline below form in `<div role="alert" aria-live="polite">`. Messages: rate limited, already subscribed, invalid email, server error — all localized |

**Focus management:** after submit, focus moves to success message or first error via `ref.focus()`.

**Action:** reuses `subscribeToNewsletters(email, [newsletterId], locale, turnstileToken)` — single-element array. Zero duplication.

### 4.6 Accessibility

- Explicit `<label htmlFor>` for email input
- Errors linked via `aria-describedby`
- Success/error in `role="alert"` + `aria-live="polite"`
- Focus managed via ref after submit
- Touch targets >= 44px
- Accent color: button uses `accentColor` as background + white text. If contrast ratio < 4.5:1, fallback to dark text

### 4.7 404 handling

`notFound()` from `next/navigation` when:
- Slug doesn't exist in DB
- Type has `active = false`

No staff preview for inactive types — out of scope.

### 4.8 i18n

Add keys to existing global locale dicts (`apps/web/src/locales/en.json`, `apps/web/src/locales/pt-BR.json`):

```
newsletter.landing.subscribe
newsletter.landing.consent (with {name} interpolation)
newsletter.landing.successTitle
newsletter.landing.successBody
newsletter.landing.errorRateLimit
newsletter.landing.errorAlreadySubscribed
newsletter.landing.errorInvalid
newsletter.landing.errorServer
newsletter.landing.subscriberCount
newsletter.landing.editionCount
newsletter.landing.new
newsletter.landing.defaultDescription
newsletter.landing.learnMore
```

Server component loads the dict based on `type.locale` (not visitor locale — the page language matches the newsletter's language). Serializable subset passed as prop to client island.

## 5. SEO + OG Metadata

### 5.1 `generateMetadata`

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
    // NO hreflang — these are independent publications, not translations
  },
}
```

### 5.2 JSON-LD

`WebPage` + `BreadcrumbList` via `<JsonLdScript>` — same Sprint 5b pattern. Nodes added to layout root's `@graph`.

### 5.3 OG image precedence chain

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

## 6. Dynamic OG Image Route

### 6.1 Route

`apps/web/src/app/og/newsletter/[slug]/route.tsx` — Node runtime (Satori requires font loading).

### 6.2 Template (1200x630px)

```
┌──────────────────────────────────────────────────┐
│ ████████████████████████████████████████████████ │  accent color bar (6px)
│                                                  │
│  NEWSLETTER                                      │  small caps, #888, 16px
│                                                  │
│  Behind the Code                                 │  Inter Bold, 56px, #111, max 2 lines
│                                                  │
│  Weekly deep dives into code architecture,       │  Inter Regular, 24px, #555, max 3 lines
│  tooling, and engineering decisions.             │  (type.description ?? type.tagline, omit if null)
│                                                  │
│  ┌──────────┐                                    │
│  │ ⟳ Weekly │                                    │  cadence badge (contrast-aware, see 6.3)
│  └──────────┘                                    │  (omit if cadence null)
│                                                  │
│  ──────────────────────────────────────────────  │  divider, #eee
│  Thiago Figueiredo    bythiagofigueiredo.com     │  18px, #888, space-between
└──────────────────────────────────────────────────┘
```

Padding: 60px horizontal, 50px vertical. Background: `#fafafa`.

### 6.3 Badge contrast logic

```typescript
const luminance = relativeLuminance(type.color)
const badgeStyle = luminance > 0.5
  ? { background: type.color, color: '#fff' }            // light accent: solid bg + white text
  : { background: `${type.color}22`, color: type.color }  // dark accent: subtle bg + accent text
```

Accent bar: if very light (luminance > 0.7), add `border-bottom: 1px solid rgba(0,0,0,0.1)`.

### 6.4 Font

Inter latin subset (~35KB), same file used by existing OG routes (`og/blog/`, `og/campaigns/`). Loaded via `fetch` + `arrayBuffer()`, cached in process memory.

### 6.5 Cache

```typescript
headers: {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
}
```

Cache invalidation tag: `og:newsletter:${slug}`.

### 6.6 Error handling

```typescript
try {
  const type = await getNewsletterTypeBySlug(slug)
  if (!type) return redirect302('/og-default.png')
  return new ImageResponse(/* template */, { width: 1200, height: 630 })
} catch (err) {
  Sentry.captureException(err, {
    tags: { seo: true, component: 'og-route', type: 'newsletter' },
    extra: { slug },
  })
  return redirect302('/og-default.png')
}
```

Redirect 302 (not 301) — allows retry after fix. Feature gate: returns redirect when `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED !== 'true'` (defense in depth).

## 7. Cache Invalidation

### 7.1 Tags

| Tag | Invalidates | Triggered by |
|---|---|---|
| `newsletter:type:${slug}` | Landing page ISR cache | Admin edit of type (name, description, slug, color, active, og_image_url) |
| `og:newsletter:${slug}` | OG image route cache | Same admin actions |

### 7.2 Helper

```typescript
// apps/web/src/lib/newsletter/cache-invalidation.ts
import { revalidateTag } from 'next/cache'

export function revalidateNewsletterType(slug: string) {
  revalidateTag(`newsletter:type:${slug}`)
  revalidateTag(`og:newsletter:${slug}`)
}
```

### 7.3 MVP path (no admin UI)

1. Edit type via SQL (Supabase Dashboard or migration)
2. `updated_at` trigger fires automatically
3. Cache bust: redeploy on Vercel (static cache rebuilds)

Follow-up: admin page for editing newsletter types calls `revalidateNewsletterType(slug)` on save.

## 8. Sitemap Integration

### 8.1 Enumerator change

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

### 8.2 Robots

No changes. `/newsletters/[slug]` is public, indexable. Not in `NOINDEX_PATTERNS` or `PROTECTED_DISALLOW_PATHS`.

## 9. Hub Integration

### 9.1 Minimal change

Add `slug` field to each entry in the hardcoded `CATALOG` array in `NewslettersHub.tsx`. Each card gains a "Learn more" / "Saiba mais" link pointing to `/newsletters/{slug}`.

### 9.2 Known risk

Hardcoded slugs can diverge from DB if edited via SQL. Mitigation: landing page resolves by slug in DB — stale link results in 404 (detectable via E2E test). Impact is low (hub multi-select subscribe still works).

### 9.3 Follow-up

Migrate hub to DB-driven, reusing the same query as the landing page. Eliminates drift risk. Separate task post-launch.

## 10. Known Limitations

1. **`newsletter_types` has no `site_id`** — all types are global. Multi-ring scoping requires adding this column in a future sprint. Not in scope.
2. **No staff preview for inactive types** — inactive = 404 for everyone. Admin preview is a follow-up.
3. **Hub remains hardcoded** — slug links added but catalog not migrated to DB. Follow-up.
4. **Type editing via SQL only** — no admin UI for newsletter type metadata. Cache busted by redeploy. Follow-up.

## 11. File Inventory

| Action | File |
|---|---|
| **New migration** | `supabase/migrations/YYYYMMDD_newsletter_types_landing.sql` |
| **New page** | `apps/web/src/app/(public)/newsletters/[slug]/page.tsx` |
| **New loading** | `apps/web/src/app/(public)/newsletters/[slug]/loading.tsx` |
| **New client island** | `apps/web/src/app/(public)/newsletters/[slug]/subscribe-form.tsx` |
| **New OG route** | `apps/web/src/app/og/newsletter/[slug]/route.tsx` |
| **New OG template** | `apps/web/src/lib/seo/og/template.tsx` (add `NewsletterOgTemplate`) |
| **New cache helper** | `apps/web/src/lib/newsletter/cache-invalidation.ts` |
| **New color utility** | `apps/web/src/lib/seo/og/color-utils.ts` (`relativeLuminance`) |
| **Edit enumerator** | `apps/web/src/lib/seo/enumerator.ts` (add newsletter types query) |
| **Edit hub** | `apps/web/src/app/(public)/newsletters/components/NewslettersHub.tsx` (add slug + link) |
| **Edit locale dicts** | `apps/web/src/locales/en.json` + `apps/web/src/locales/pt-BR.json` (add `newsletter.landing.*` keys) |
| **Edit seo cache** | `apps/web/src/lib/seo/cache-invalidation.ts` (document `newsletter:type:*` tag) |

## 12. Tests

### 12.1 Unit tests (vitest)

| Test | File | Validates |
|---|---|---|
| Social proof display logic | `test/unit/newsletter/social-proof.test.ts` | 4 threshold scenarios from display rules table. Pure function, no DB |
| OG image precedence chain | `test/unit/newsletter/og-precedence.test.ts` | 4 steps: custom URL, dynamic, site default, fallback. Env var mocks |
| Badge contrast logic | `test/unit/newsletter/badge-contrast.test.ts` | Luminance > 0.5 = solid bg. Luminance <= 0.5 = subtle bg. Edge: white, black, yellow |
| Cache invalidation helper | `test/unit/newsletter/cache-invalidation.test.ts` | `revalidateNewsletterType(slug)` calls `revalidateTag` with both correct tags |
| Slug validation | `test/unit/newsletter/slug-validation.test.ts` | Regex + reserved words. Valid: `behind-the-code`. Invalid: `archive`, `admin`, `-bad`, `bad-` |
| Subscribe form | `test/unit/newsletter/landing-form.test.tsx` | Render, submit success, submit error states, consent required, loading state, a11y (labels, aria) |
| i18n completeness | `test/unit/newsletter/landing-i18n.test.ts` | Both locales have all `newsletter.landing.*` keys, no empty values |
| Page server component | `test/unit/newsletter/landing-page.test.tsx` | `notFound()` for invalid slug. `notFound()` for inactive type. Correct props to SubscribeForm. Social proof conditional. Metadata (title, og:locale, canonical) |
| OG route handler | `test/unit/newsletter/og-route.test.ts` | Valid slug = 200 + image/png. Invalid = 302. Feature gate off = 302. Inactive = 302. Sentry called on error. Cache-Control headers |
| Hub landing links | `test/unit/newsletter/hub-links.test.tsx` | Every catalog card has `slug` defined. Links point to `/newsletters/{slug}` |

### 12.2 Integration tests (DB-gated)

| Test | File | Validates |
|---|---|---|
| Migration schema | `test/integration/newsletter-types-schema.test.ts` | `slug`, `description`, `og_image_url`, `updated_at` exist with correct types. UNIQUE violation. Format CHECK. Reserved words CHECK. HTTPS CHECK |
| RLS policy | same file | Anon client sees only `active = true`. Inactive types invisible |
| Sitemap enumerator | `test/integration/newsletter-sitemap.test.ts` | Active types in sitemap, inactive not |

### 12.3 E2E (Playwright)

| Test | File | Validates |
|---|---|---|
| Landing page render | `e2e/newsletter-landing.spec.ts` | Navigate `/newsletters/{slug}`, see name + tagline + form |
| Subscribe flow | same file | Fill email, check consent, submit, see success message |
| 404 for invalid slug | same file | `/newsletters/nonexistent` shows 404 |
| Hub to landing link | same file | Hub card "Learn more" navigates to correct landing |
| OG image smoke | same file | `fetch('/og/newsletter/{slug}')` returns 200 + content-type image/png |
| A11y | same file | AxeBuilder scan on landing page, zero violations |

**Total: ~14 files new/edited + 11 test files + 1 E2E spec.**
