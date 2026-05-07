# Feature Flag Cleanup + Link Form Tags Fix

**Date:** 2026-05-07
**Status:** Approved
**Scope:** Remove 15 boolean feature flags, fix link form tag input behavior

---

## Problem

The codebase has 21 boolean environment variables acting as feature flags. Most just show/hide features that are fully implemented and ready. This creates:

- Deploy friction (must remember to set env vars per environment)
- False sense of control (flags aren't wired to an admin UI)
- LGPD compliance features disabled in production despite being required by law
- Links not visible in production CMS sidebar (missing env var)

Additionally, the link form tag input only accepts Enter to add tags, while the blog post hashtag input already splits on comma/space/paste.

## Decisions

### 15 flags to REMOVE (hardcode as enabled)

| # | Flag | Current prod value | Behavior change |
|---|------|-------------------|-----------------|
| 1 | `NEXT_PUBLIC_LINKS_ENABLED` | missing (=disabled) | Links appears in CMS sidebar |
| 2 | `LINKS_AI_INSIGHTS_ENABLED` | true | None |
| 3 | `LINKS_LIVE_PULSE_ENABLED` | true | None |
| 4 | `LINKS_REVENUE_TRACKING_ENABLED` | false | None (dead flag, no code uses it) |
| 5 | `LINKS_NEWSLETTER_REWRITE_ENABLED` | false | Newsletter tracking uses unified `link_clicks` table |
| 6 | `NEXT_PUBLIC_MEDIA_GALLERY_ENABLED` | true | None |
| 7 | `MEDIA_BLOB_UPLOAD_ENABLED` | true | None (removes ~150 lines of Supabase Storage fallback dead code) |
| 8 | `MEDIA_MIGRATION_ENABLED` | true | None (only read in health check) |
| 9 | `NEXT_PUBLIC_SEO_JSONLD_ENABLED` | true | None |
| 10 | `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED` | true | None |
| 11 | `NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED` | true | None |
| 12 | `SEO_SITEMAP_KILLED` | false | None (only read in health check) |
| 13 | `NEXT_PUBLIC_LGPD_BANNER_ENABLED` | false | LGPD banner visible to visitors |
| 14 | `NEXT_PUBLIC_ACCOUNT_DELETE_ENABLED` | false | Account deletion enabled |
| 15 | `NEXT_PUBLIC_ACCOUNT_EXPORT_ENABLED` | false | Account data export enabled |
| — | `AD_ENGINE_ENABLED` | not set | None (dead export, no imports) |

### 6 flags to KEEP

| Flag | Reason |
|------|--------|
| `SEO_AI_CRAWLERS_BLOCKED` | Operational decision — actively changes robots.txt |
| `LGPD_CRON_SWEEP_ENABLED` | Safety valve — cron that irreversibly deletes user data |
| `AD_GOOGLE_ENABLED` | Requires external Google AdSense setup |
| `AD_TRACKING_ENABLED` | Safety valve for ad event aggregation cron |
| `AD_REVENUE_SYNC_ENABLED` | Requires external Google AdSense setup |
| `LINKS_SHORT_DOMAIN` / `LINKS_GEO_PROVIDER` | String config values, not boolean flags |

## Implementation Details

### Category 1: LGPD (3 flags)

**Files:**
- `apps/web/src/app/(public)/layout.tsx` — remove `lgpdBannerEnabled` const and conditional guard
- `apps/web/src/app/account/(authed)/settings/page.tsx` — remove `deleteEnabled`/`exportEnabled` checks
- `apps/web/src/app/account/(authed)/delete/page.tsx` — remove redirect when flag is false
- `apps/web/src/app/account/(authed)/export/page.tsx` — remove redirect when flag is false

**Behavior change:** All three LGPD features go live in production. Features are fully implemented (no TODOs/FIXMEs found). This is legally required.

### Category 2: SEO (3 flags + 1 dead flag)

**Files:**
- `apps/web/src/app/og/[type]/route.tsx` — remove `!== 'false'` check
- `apps/web/src/app/og/blog/[locale]/[slug]/route.tsx` — remove check
- `apps/web/src/app/og/campaigns/[locale]/[slug]/route.tsx` — remove check
- `apps/web/src/app/og/newsletter/[slug]/route.tsx` — remove check
- `apps/web/src/app/cms/(authed)/settings/page.tsx` — remove flag display for removed flags
- `apps/web/src/app/api/health/seo/route.ts` — remove `jsonLd`, `dynamicOg`, `extendedSchemas`, `sitemapKilled` from flags object; keep `aiCrawlersBlocked`

### Category 3: Media (3 flags)

**Files:**
- `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts` — remove `MEDIA_GALLERY_ENABLED` conditional
- `apps/web/src/app/cms/(authed)/blog/new/post-edition-editor.tsx` — remove gallery-enabled conditional
- `apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx` — remove gallery-enabled conditional
- `apps/web/src/app/cms/(authed)/newsletters/_components/type-drawer.tsx` — remove conditional
- `apps/web/src/app/cms/(authed)/newsletters/[id]/edit/edition-editor.tsx` — remove conditional
- `apps/web/src/app/cms/(authed)/authors/authors-connected.tsx` — remove conditional
- `apps/web/src/app/admin/(authed)/sites/gallery-url-field.tsx` — remove conditional
- `apps/web/src/app/admin/(authed)/ads/_components/slot-form.tsx` — remove conditional

**MEDIA_BLOB_UPLOAD_ENABLED removal (~150 lines of dead code):**
- `apps/web/src/app/cms/(authed)/authors/actions.ts` — remove 2 Supabase Storage fallback paths (~60 lines)
- `apps/web/src/app/cms/(authed)/newsletters/actions.ts` — remove 2 fallback paths (~50 lines)
- `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` — remove 1 fallback path (~10 lines)
- `apps/web/src/app/cms/(authed)/links/actions.ts` — remove 1 fallback path (~15 lines)
- `apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts` — remove 1 fallback path (~20 lines)

**MEDIA_MIGRATION_ENABLED:** Remove from `health/media/route.ts` flags object.

### Category 4: Links (4 flags + newsletter rewrite)

**Files:**
- `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts` — remove `LINKS_ENABLED` conditional
- `apps/web/src/app/cms/(authed)/links/layout.tsx` — remove redirect guard
- `apps/web/src/app/cms/(authed)/links/actions.ts` — remove `AI_INSIGHTS_ENABLED === 'false'` check
- `apps/web/src/app/cms/(authed)/links/[id]/page.tsx` — remove `LIVE_PULSE_ENABLED === 'false'` check
- `apps/web/src/app/api/links/[id]/pulse/route.ts` — remove flag check
- `apps/web/src/app/api/cron/send-scheduled-newsletters/route.ts` — hardcode `rewriteEnabled = true`
- `apps/web/src/lib/links/newsletter-compat.ts` — hardcode rewrite as enabled

**Newsletter rewrite safety:** The `newsletter_click_events_unified` view already exists in the DB schema and unions both tables. The compat layer's fallback logic (if view doesn't exist, use legacy table) can remain as a safety net.

### Category 5: Ads (1 dead flag)

**Files:**
- `apps/web/src/lib/ads/flags.ts` — remove `AD_ENGINE_ENABLED` export (no importers)

### Category 6: Link Form Tags Fix

**Files:**
- `packages/links-admin/src/components/link-form.tsx` lines 235-250 — add onKeyDown (comma, space) and onPaste handlers
- `packages/links-admin/src/hooks/use-link-form.ts` — add `addTags(tags: string[])` for batch processing

Behavior to match blog's `HashtagInput`:
- Enter: add current input as tag
- Comma: split and add
- Space: split and add
- Paste with comma/space/newline: split into multiple tags
- Strip `#` prefix
- Deduplicate

### Category 7: Cleanup

**`.env.local`:** Remove all 15 flag entries.
**`CLAUDE.md`:** Update "All feature flags" section — remove deleted flags, keep the 6 retained ones.
**Health checks:** Simplify flag objects (remove dead entries, keep operational ones).
**Vercel Dashboard:** Remove obsolete env vars after successful deploy.

### Test Files Impacted (10 files)

| Test file | Changes |
|-----------|---------|
| `test/cms/links-sidebar.test.ts` | Rewrite — Links always in sidebar, remove flag permutations |
| `test/api/links-pulse.test.ts` | Remove flag=false 404 test |
| `test/app/api/health-seo.test.ts` | Remove flag assertions for deleted flags, keep `aiCrawlersBlocked` |
| `test/app/og/generic-route.test.ts` | Remove flag=false redirect test |
| `test/app/og/blog-route.test.ts` | Remove flag=false redirect test |
| `test/app/og/campaign-route.test.ts` | Remove flag=false redirect test |
| `test/components/lgpd/account-delete-wizard.test.tsx` | Remove disabled-stub test |
| `test/lib/ads-flags.test.ts` | Remove `AD_ENGINE_ENABLED` test, keep other 3 |
| `test/lib/links/newsletter-compat.test.ts` | Remove flag toggle tests, test unified path only |
| `test/lib/seo/jsonld/render.test.tsx` | Remove disabled-state test |

## Deploy Strategy

1. All changes on `staging` branch
2. Run `npm test` — zero failures required
3. Test LGPD features on localhost (banner, delete, export) — they go live with this deploy
4. Merge to `main` → production deploy
5. Post-deploy: remove obsolete env vars from Vercel Dashboard
6. Post-deploy: verify Links appears in prod CMS sidebar

## Rollback

Low risk — all features are existing, tested code. If issues arise:
- Git revert of the cleanup commit restores all guards
- LGPD features: simple JSX/CSS, revert resolves instantly
- Newsletter tracking: unified view does union of both tables, compat layer fallback stays as safety net
