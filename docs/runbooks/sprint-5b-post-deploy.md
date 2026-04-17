# Sprint 5b — Post-Deploy Verification Checklist

**Owner:** thiagonfigueiredo · **Use after:** PR-E merged to `main` and Vercel production deploy is green.
**Estimated time:** 30 minutes (interactive — opens 4 external dashboards).

## 0. Pre-flight

```bash
# Confirm prod is on the PR-E SHA
curl -sf https://bythiagofigueiredo.com/api/health/seo \
  -H "Authorization: Bearer $CRON_SECRET" | jq '.schemaVersion'
# Expect: "v1"
```

If 401 → `CRON_SECRET` env mismatch between local and Vercel; resolve before proceeding.

## 1. Smoke test (CI workflow)

```bash
gh workflow run seo-post-deploy.yml \
  --repo bythiagofigueiredo/bythiagofigueiredo \
  --ref main \
  -f host=https://bythiagofigueiredo.com
```

Wait ~2 min for completion:
```bash
gh run list --workflow=seo-post-deploy.yml --limit 1
gh run view <run-id> --log
```

Expect: all 8 smoke checks ✅. If any fail, jump to `docs/runbooks/seo-incident.md` for the matching scenario.

**Manual fallback (if workflow file not yet deployed):**
```bash
CRON_SECRET=<prod-secret> ./scripts/seo-smoke.sh https://bythiagofigueiredo.com
```

## 2. Health endpoint deep check

```bash
curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq
```

- [ ] `ok: true`
- [ ] `siteSlug: "bythiagofigueiredo"`
- [ ] `identityType: "person"`
- [ ] `seoConfigCachedMs < 500`
- [ ] `sitemapBuildMs < 1000`
- [ ] `sitemapRouteCount` matches `select count(*)` of published posts/active campaigns + 5 static
- [ ] `flags.jsonLd: true`, `flags.dynamicOg: true`, `flags.extendedSchemas: true`
- [ ] `flags.sitemapKilled: false`, `flags.aiCrawlersBlocked: false` (per Sprint 5b open decision #1)

## 3. Rich Results — manual

Open [Rich Results Test](https://search.google.com/test/rich-results) in a browser.

- [ ] Test URL: `https://bythiagofigueiredo.com/blog/pt-BR/<latest-published-post-slug>`
  - Expect detected items: **BlogPosting**, **BreadcrumbList**, **Person**
  - 0 errors, warnings allowed
- [ ] Test URL: `https://bythiagofigueiredo.com/campaigns/pt-BR/<latest-active-campaign-slug>`
  - Expect detected items: **Article**, **BreadcrumbList**
  - 0 errors

If a post has `seo_extras.faq` / `howTo` / `video` frontmatter, that test URL should additionally surface **FAQPage** / **HowTo** / **VideoObject**.

## 4. Schema.org strict validator

Open [validator.schema.org](https://validator.schema.org/) — paste full URL.

- [ ] Same blog post URL → no "unknown property" warnings on `BlogPosting` / `Person` / `BreadcrumbList`

## 5. Social previews — manual

For one blog post URL:

- [ ] **Slack:** paste in any channel → preview shows OG image + title + description
- [ ] **WhatsApp:** paste in any chat → preview shows OG image
- [ ] **LinkedIn:** [Post Inspector](https://www.linkedin.com/post-inspector/) → "Inspect" → preview renders correctly
- [ ] **Twitter/X:** [Card Validator](https://cards-dev.twitter.com/validator) (fallback to manual share if validator deprecated) → `summary_large_image` card renders with image
- [ ] **Facebook:** [Sharing Debugger](https://developers.facebook.com/tools/debug/) → image + meta tags correct

If any image broken → Scenario B in `seo-incident.md`.

## 6. Sitemap submission — Google Search Console

1. Open [Search Console](https://search.google.com/search-console) → property `https://bythiagofigueiredo.com`
2. Sidebar → **Sitemaps** → "Add a new sitemap" → enter `sitemap.xml` → Submit
3. Status should change to "Success" within ~10 minutes
4. - [ ] Sitemap submitted to GSC

If property not yet verified, do one-time setup: GSC → Add property → DNS verification (record stays in Vercel DNS).

## 7. Sitemap submission — Bing Webmaster Tools

1. Open [Bing Webmaster Tools](https://www.bing.com/webmasters/)
2. Add site `bythiagofigueiredo.com` if not already added (use Import from GSC for one-click setup)
3. Sitemaps → Submit sitemap → `https://bythiagofigueiredo.com/sitemap.xml`
4. - [ ] Sitemap submitted to Bing

## 8. Lighthouse mobile

Run from local Chrome (DevTools → Lighthouse → Mobile, Throttle: Mobile, Categories: SEO+Perf+Accessibility+Best-Practices):

- [ ] `/` → SEO ≥95, perf ≥80
- [ ] `/blog/pt-BR` → SEO ≥95, perf ≥80
- [ ] `/blog/pt-BR/<latest-slug>` → SEO ≥95, perf ≥80
- [ ] `/contact` → SEO ≥95

(LHCI in PR-D runs against preview; this manual run validates prod.)

## 9. Dev/preview noindex confirmation

```bash
curl -sf https://dev.bythiagofigueiredo.com/robots.txt
# Expect: 'User-agent: *\nDisallow: /'

curl -sf https://<latest-preview-url>.vercel.app/robots.txt
# Expect: 'User-agent: *\nDisallow: /'
```

- [ ] Dev subdomain robots = `Disallow: /`
- [ ] Preview deployment robots = `Disallow: /`

## 10. Sentry — 24h watch

24 hours after deploy, in Sentry:

- [ ] Filter `seo:true` last 24h → 0 unresolved issues
- [ ] Filter `component:og-route` last 24h → 0 errors (excluding bots probing nonexistent slugs, which legitimately return 302→`/og-default.png`)
- [ ] Filter `component:sitemap OR component:robots` last 24h → 0 errors
- [ ] Filter `component:jsonld` last 24h → 0 errors

If any errors: open the corresponding scenario in `seo-incident.md`.

## 11. 7-day GSC follow-up

7 days after submission:

- [ ] GSC → Sitemaps → submitted sitemap status: "Success" + "Discovered URLs" matches count
- [ ] GSC → Pages → ≥1 new URL in "Indexed" (not "Discovered – currently not indexed")
- [ ] GSC → Search appearance → Articles report shows ≥1 entry (BlogPosting recognized)
- [ ] GSC → Search appearance → Breadcrumbs report shows entries

Failure to index in 7 days does not block sprint closeout — but file follow-up issue if Articles report stays empty for 14 days.

## 12. Roadmap + memory updates

After steps 1–10 are ✅ (Sprint 5b deployed and verified):

- [ ] `docs/roadmap/phase-1-mvp.md` Sprint 5b status → ✅ done with completion date
- [ ] `docs/roadmap/README.md` "Done até agora" — add Sprint 5b bullet
- [ ] `CLAUDE.md` — add Sprint 5b summary section
- [ ] User memory `MEMORY.md` — add `project_sprint5b_closed.md` entry (mirroring `project_sprint5a_closed.md`)
- [ ] Commit: `docs(roadmap): close sprint 5b — SEO hardening`
