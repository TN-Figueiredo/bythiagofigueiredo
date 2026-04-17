# SEO Incident Runbook (Sprint 5b)

**Owner:** thiagonfigueiredo · **Last updated:** 2026-04-16 · **Sprint:** 5b
**Stack:** Next.js 15 App Router + Vercel + Supabase + `@tn-figueiredo/seo@0.1.0` wrapper in `apps/web/lib/seo/`.

## Quick reference — feature flags

| Symptom | Flag (Vercel env) | Effect | TTR |
|---|---|---|:-:|
| JSON-LD validator failures | `NEXT_PUBLIC_SEO_JSONLD_ENABLED=false` | `<JsonLdScript>` returns null | <60s |
| FAQ/HowTo/Video schema penalty | `NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED=false` | extras nodes skipped from `@graph` | <60s |
| OG image broken in social shares | `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED=false` | falls through precedence chain to static `/og-default.png` | <60s |
| Drafts in sitemap | `SEO_SITEMAP_KILLED=true` | `app/sitemap.ts` returns `[]` | <60s |
| AI crawler load spike | `SEO_AI_CRAWLERS_BLOCKED=true` | adds GPTBot/CCBot/anthropic-ai/Google-Extended Disallow rules | <60s |

**To flip:** Vercel Dashboard → bythiagofigueiredo (web) → Settings → Environment Variables → edit → "Save and Redeploy" (Production). Vercel triggers an instant edge config update + new deployment build — env-only change ships in ~30–60s.

**Always run after any flag flip:**

```bash
curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq .flags
```

Confirm the changed flag reflects the new value.

---

## Scenario A — Sitemap returns empty in prod

**Symptom:**
- `curl https://bythiagofigueiredo.com/sitemap.xml` returns `<urlset></urlset>` (no `<url>` children)
- Google Search Console reports "0 URLs discovered" or sudden drop
- Sentry: spike in `component: 'sitemap'` events

**Diagnose (in order):**

1. **Confirm site resolves at the host.**
   ```bash
   curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq '.ok, .siteId, .sitemapRouteCount'
   ```
   - `ok: false` + `error: 'site_not_resolved'` → DNS/Host header issue or `sites.primary_domain` mismatch. Check `select primary_domain from sites where slug='bythiagofigueiredo';` in Supabase SQL editor.
   - `sitemapRouteCount: 0` but `ok: true` → site resolves but enumerator returns nothing → continue to step 2.

2. **Check kill-switch flag.**
   ```bash
   curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq '.flags.sitemapKilled'
   ```
   - `true` → someone toggled emergency kill. Decide whether to keep killed or restore (`SEO_SITEMAP_KILLED=false`).

3. **Check enumerator output directly via SQL.**
   ```sql
   select count(*) from blog_posts
     where site_id = '<site-uuid>'
       and status = 'published'
       and published_at <= now()
       and published_at is not null;
   ```
   - 0 rows → no published posts (data issue, not a bug — sitemap is correct).
   - >0 rows but sitemap empty → enumerator query mismatch with RLS mirror; check Supabase logs for query errors.

4. **Check Vercel cache.**
   - `app/sitemap.ts` is `force-dynamic` so should not cache, but if `revalidateTag('sitemap:${siteId}')` invalidations are stuck, force a rebuild: redeploy from Vercel Dashboard → Deployments → ⋯ → Redeploy.

**Recover:**
- If kill-switch was on intentionally: leave as-is; document reason in this runbook.
- If accidental: set `SEO_SITEMAP_KILLED=false` → redeploy → re-run health check.
- If data issue: confirm content team intent; no code change needed.
- If enumerator bug: revert PR-B/C with `vercel rollback` to last-known-good deployment URL while diagnosing.

**Post-recovery:**
- Re-submit sitemap to GSC (Sitemaps page → ⋯ → Resubmit) to force re-crawl.
- Run `scripts/seo-smoke.sh https://bythiagofigueiredo.com` → all 8 checks should pass.

---

## Scenario B — OG image broken in social previews

**Symptom:**
- Sharing blog/campaign URL on Slack/WhatsApp/Twitter/LinkedIn shows no image, broken-image icon, or wrong image
- Sentry: spike in `component: 'og-route'` exception events

**Diagnose (in order):**

1. **Reproduce the failing URL.**
   - Get the affected page's OG URL from page source: `view-source:https://bythiagofigueiredo.com/blog/pt-BR/<slug>` → search `og:image`
   - `curl -I "$OG_URL"` — expect `HTTP/2 200` + `content-type: image/png`
   - If 302 → redirect to `/og-default.png` was triggered by the route's catch handler → bug in render path. Check Sentry stack trace.
   - If 404 → site/post not resolved; verify `slug` + `locale` in URL match DB.
   - If 500 → unhandled exception in `ImageResponse` rendering; Sentry should have full trace tagged `component: 'og-route'`.

2. **Check Sentry tag filter.**
   - Sentry dashboard → Issues → filter `component:og-route` last 24h.
   - Common causes: font fetch failure (Inter subset 404), missing `sites.primary_color`, `post.translation.title` undefined for given locale.

3. **Check the OG route via API health check.**
   ```bash
   curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq '.flags.dynamicOg'
   ```
   - Confirm flag state matches expectation.

**Recover (degrade gracefully):**

```
Vercel → Settings → Environment Variables → set:
  NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED=false
→ Save → Redeploy
```

This drops the dynamic OG step from the precedence chain. Pages now resolve OG images via:
1. `seo_extras.og_image_url` (per-post frontmatter override)
2. `cover_image_url` from `blog_translations`
3. ~~Dynamic OG~~ (skipped while flag off)
4. `sites.seo_default_og_image`
5. `/og-default.png` (static)

**Verify recovery:**
- Use [opengraph.xyz](https://www.opengraph.xyz/) or LinkedIn Post Inspector to fetch a previously-broken URL.
- Re-share on Slack/WhatsApp — preview should now show the static or DB-uploaded fallback.
- Once Sentry investigation identifies root cause, fix in code, re-enable flag.

**LinkedIn cache note:** LinkedIn caches OG previews for ~7 days. Use [Post Inspector](https://www.linkedin.com/post-inspector/) to force re-crawl.

---

## Scenario C — Google Rich Results validator fails

**Symptom:**
- Rich Results Test ([rich-results-test](https://search.google.com/test/rich-results)) on a blog post URL reports "Page is not eligible for rich results" or specific schema errors
- Search Console → Enhancements → "Articles" or "Breadcrumbs" report shows new errors after deploy
- Sentry: any `component: 'jsonld'` events (rare — most failures are silent)

**Diagnose (in order):**

1. **Capture the rendered JSON-LD.**
   ```bash
   curl -sf https://bythiagofigueiredo.com/blog/pt-BR/<slug> | grep -A 200 'application/ld+json' | head -200
   ```
   Copy the JSON between `<script type="application/ld+json">…</script>`.

2. **Validate manually.**
   - Paste into [Schema.org Validator](https://validator.schema.org/)
   - Paste into [Rich Results Test](https://search.google.com/test/rich-results)
   - Note: the two validators are stricter than necessary in different ways. Schema.org validator rejects unknown properties; Rich Results focuses on Google's eligibility rules.

3. **Common failure modes (in order of likelihood):**
   - `BlogPosting.image` missing or 404 — often the OG image URL is broken; check Scenario B.
   - `BlogPosting.author` is bare object instead of `{'@id': '...#person'}` — `composeGraph` `@id` linking regression
   - `BreadcrumbList.itemListElement[N].item` not absolute URL — config `siteUrl` missing protocol
   - `FAQPage.mainEntity` empty array — frontmatter `seo_extras.faq` had `[]`; should be missing-or-non-empty per Zod schema
   - `Person.sameAs` URL 404 — broken social link in `identity-profiles.ts`

4. **Check schema-dts test gate.**
   ```bash
   cd apps/web && npx vitest run lib/seo/jsonld/__tests__/builders.test.ts
   ```
   - Should still be green (compile-time guard). If it's red, the regression slipped past CI — fix urgently.

**Recover (immediate):**

```
Vercel → Environment Variables:
  NEXT_PUBLIC_SEO_JSONLD_ENABLED=false   # disables ALL JSON-LD
  -- OR (preferred, narrower scope) --
  NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED=false   # keeps base nodes, drops FAQ/HowTo/Video
→ Save → Redeploy
```

Prefer the narrower flag if the failure is in `seo_extras` schemas; Google still rewards `BlogPosting + BreadcrumbList + Person` even without rich extras.

**Verify recovery:**
- Re-run Rich Results Test on the previously-failing URL → should at least pass `BlogPosting` if base flag is left on, or skip JSON-LD entirely if both flags are off.
- Run `scripts/seo-smoke.sh` → check 4 (`@graph` present) will fail if `NEXT_PUBLIC_SEO_JSONLD_ENABLED=false` — that is expected during incident.

**Post-recovery:**
- Fix root cause (likely a builder in `lib/seo/jsonld/builders.ts`).
- Add a regression snapshot test capturing the failing case.
- Re-enable flag; redeploy.

---

## Scenario D — Hreflang shows wrong alternates

**Symptom:**
- Search Console → Legacy tools → International targeting reports hreflang errors
- Page's `<link rel="alternate" hreflang="en" href="...">` points to a non-existent `en` translation
- One locale's blog index lists posts missing in the other locale (cache desync)

**Diagnose (in order):**

1. **Check rendered alternates on a sample page.**
   ```bash
   curl -sf https://bythiagofigueiredo.com/blog/pt-BR/<slug> | grep -E 'rel="alternate" hreflang'
   ```
   Expect: one line per supported locale + one `x-default`.

2. **Check translation availability in DB.**
   ```sql
   select locale, slug, status from blog_translations bt
     join blog_posts bp on bp.id = bt.post_id
     where bp.slug_root = '<post-slug-root>'
       and bp.status = 'published';
   ```
   - If `en` row has `status='draft'` or doesn't exist → page should NOT emit `hreflang="en"` for it. If it does, that's an enumerator/factory bug.

3. **Verify enumerator output for sitemap.**
   ```bash
   curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq '.sitemapRouteCount'
   ```
   - Compare against expected count: `select count(*) from blog_translations bt join blog_posts bp on bp.id=bt.post_id where bp.site_id=$site and bp.status='published'`.

4. **Check `sites.supported_locales`.**
   ```sql
   select slug, supported_locales from sites where slug='bythiagofigueiredo';
   ```
   - Must be `{pt-BR, en}` post-migration `…000003`. If still `{pt-BR}`, the `en` alternate would never emit even when translations exist.

**Recover:**

1. **Force cache invalidation** (revalidateTag may have stuck):
   - In Vercel Dashboard → Deployments → ⋯ → Redeploy (rebuilds full edge cache).
   - Or programmatically via admin action: trigger any `savePost` on the affected post (calls `revalidateBlogPostSeo`).

2. **If enumerator bug confirmed:** revert PR-B's `enumerator.ts` change, redeploy.

3. **If `sites.supported_locales` wrong:** run idempotent backfill again:
   ```sql
   update sites set supported_locales = array['pt-BR','en']
     where slug='bythiagofigueiredo';
   ```

**Verify recovery:**
- Re-fetch sample page, check alternates match DB reality.
- Submit sitemap to GSC, wait 24–72h for re-crawl, recheck Hreflang report.

---

## Scenario E — AI crawler causing load spike

**Symptom:**
- Vercel Analytics shows sudden 5–10× spike in non-Googlebot traffic
- User-Agent breakdown reveals high volume from `GPTBot`, `CCBot`, `anthropic-ai`, `Google-Extended`, `PerplexityBot`, `ClaudeBot`
- Vercel Hobby invocation limits at risk (or already throttled)

**Diagnose:**

1. **Identify the crawler.**
   - Vercel Dashboard → Analytics → Top User Agents (last 1h, 24h)
   - Check for any `*Bot` UA outside Googlebot/Bingbot/SocialBot list

2. **Check current robots stance.**
   ```bash
   curl -sf https://bythiagofigueiredo.com/robots.txt | grep -A 1 -E 'GPTBot|CCBot|anthropic-ai|Google-Extended'
   ```
   - If no Disallow rules for these UAs → flag is currently OFF (default permit).

3. **Confirm health endpoint flag state.**
   ```bash
   curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq '.flags.aiCrawlersBlocked'
   ```

**Recover:**

```
Vercel → Environment Variables:
  SEO_AI_CRAWLERS_BLOCKED=true
→ Save → Redeploy
```

Effect: `buildRobotsRules` adds Disallow rules for `GPTBot`, `CCBot`, `anthropic-ai`, `Google-Extended`, `PerplexityBot`, `ClaudeBot`, `Bytespider`, `Amazonbot` (full list in `lib/seo/robots-config.ts`).

**Verify recovery:**
- Re-fetch `/robots.txt` and confirm new Disallow lines present.
- Monitor Vercel Analytics over next 1–2 hours — load should drop. (Note: well-behaved bots respect robots within ~1h; misbehaving bots ignore — escalate to Cloudflare WAF rule if needed.)

**Policy note:** Default stance is **permit** (decision logged in spec Section "Open decisions" #1). Re-enabling permit later requires conscious choice — leave the flag ON until next AI policy review.

---

## Scenario F — Drafts leaked into sitemap (CRITICAL)

**Symptom:**
- Sitemap contains URLs for posts where `status != 'published'` or `published_at > now()`
- Search Console indexes a "Coming Soon" or unpublished URL
- Editor reports a post they didn't publish appearing in Google search

**This is a data leak. Treat as P0.**

**Recover (FIRST, before diagnosing):**

```
Vercel → Environment Variables:
  SEO_SITEMAP_KILLED=true
→ Save → Redeploy
```

`app/sitemap.ts` immediately starts returning `[]`. Crawlers hitting `/sitemap.xml` see empty urlset; existing crawled URLs remain in Google's index but no new leak.

**Verify kill switch:**
```bash
curl -sf https://bythiagofigueiredo.com/sitemap.xml | grep -c '<url>'   # expect: 0
```

**Then diagnose:**

1. **Audit RLS mirror in `enumerator.ts`.**
   - Read `apps/web/lib/seo/enumerator.ts` — confirm WHERE clause has:
     - `status = 'published'`
     - `published_at <= now()`
     - `published_at is not null`
   - Compare against the actual RLS policy: `\d+ blog_posts` in psql → look at `blog_posts_public_read_published`.

2. **Audit recent migrations.**
   ```bash
   ls -t supabase/migrations | head -10
   ```
   - Did anything change `blog_posts.status` enum or RLS policies recently?

3. **Force-purge leaked URLs from Google.**
   - Search Console → Removals → New request → "Temporarily remove URL" → submit each leaked URL.
   - Lasts ~6 months; permanent removal requires the URL to 404 or noindex.

**Fix root cause:**
- Patch the enumerator query.
- Add a regression test in `lib/seo/__tests__/enumerator.integration.test.ts` (DB-gated) that creates a draft + scheduled-future post and asserts neither appears in `enumerateSiteRoutes` output.
- Land fix → flip `SEO_SITEMAP_KILLED=false` → redeploy.

**Verify full recovery:**
- `curl /sitemap.xml | xmllint --noout -` (valid XML)
- `curl /sitemap.xml | grep -c '<url>'` matches expected count from SQL count
- Manually scan first 20 URLs; cross-reference each with `select status, published_at from blog_posts where slug=...` — every URL must be `status='published'` AND `published_at <= now()`.

---

## Health endpoint reference

```bash
curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq
```

Response shape:
```json
{
  "ok": true,
  "siteId": "uuid",
  "siteSlug": "bythiagofigueiredo",
  "identityType": "person",
  "seoConfigCachedMs": 12,
  "sitemapBuildMs": 245,
  "sitemapRouteCount": 17,
  "schemaVersion": "v1",
  "flags": {
    "jsonLd": true,
    "dynamicOg": true,
    "extendedSchemas": true,
    "aiCrawlersBlocked": false,
    "sitemapKilled": false
  }
}
```

| Field | Healthy range | Investigate when |
|---|---|---|
| `ok` | `true` | `false` → check `error` field |
| `seoConfigCachedMs` | <50 (cached), <500 (cold) | >1000 → DB connection issue |
| `sitemapBuildMs` | <500 | >2000 → enumerator query slow |
| `sitemapRouteCount` | matches DB count | drops >20% sudden → leak or kill switch |

## Sentry tag conventions (Sprint 5b)

All SEO-layer exceptions tagged with `seo: true` plus `component`:
- `component: 'sitemap'`
- `component: 'robots'`
- `component: 'og-route'` (further sub-tagged `type: 'blog' | 'campaign' | 'generic'`)
- `component: 'jsonld'`
- `component: 'seo-config'`

Filter Sentry: `seo:true component:og-route last:24h`.

## Escalation

- **Owner unreachable:** revert to last-known-good Vercel deployment via Dashboard → Deployments → ⋯ → "Promote to Production" on the previous green build.
- **Total SEO outage (multiple flags failing):** `vercel rollback` to pre-Sprint-5b deployment SHA. SEO regresses to Sprint 5a baseline (no sitemap, no JSON-LD, no dynamic OG) but site stays up.
