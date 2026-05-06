# Links Engine: go.{domain} Subdomain Setup

This runbook configures the `go.bythiagofigueiredo.com` subdomain that serves
short-link redirects for the links engine (`/go/[code]/route.ts`).

## Prerequisites

- Access to the Cloudflare DNS dashboard for `bythiagofigueiredo.com`
- Access to the Vercel project for `apps/web`
- `LINKS_SHORT_DOMAIN` env var ready to set in Vercel

---

## Step 1 -- Add the CNAME in Cloudflare

1. Open Cloudflare dashboard -> **bythiagofigueiredo.com** -> **DNS** -> **Records**.
2. Click **Add record**.
3. Fill in:
   - **Type:** `CNAME`
   - **Name:** `go`
   - **Target:** `cname.vercel-dns.com`
   - **Proxy status:** Proxied (orange cloud ON)
   - **TTL:** Auto
4. Click **Save**.

> Why proxied? Cloudflare proxying is required for Vercel custom domains that
> serve from a CNAME. Vercel presents its own TLS certificate; Cloudflare
> terminates the edge TLS and forwards to Vercel over HTTPS. If you set it to
> DNS-only (grey cloud) you must also enable Vercel's SSL challenge -- skip this
> complexity by keeping it proxied.

---

## Step 2 -- Add the custom domain in Vercel

1. Open Vercel dashboard -> **bythiagofigueiredo (web project)** -> **Settings** -> **Domains**.
2. Click **Add domain**.
3. Enter `go.bythiagofigueiredo.com` and click **Add**.
4. Vercel will show a validation status. Because the CNAME is already set to
   `cname.vercel-dns.com` it should validate within 1-5 minutes.
5. Wait until the status shows **Valid Configuration** with a green check.

---

## Step 3 -- Set environment variables in Vercel

1. Vercel -> Project -> **Settings** -> **Environment Variables**.
2. Add (for **Production** and **Preview** environments):
   ```
   LINKS_SHORT_DOMAIN=go.bythiagofigueiredo.com
   ```
3. Redeploy the project: Vercel -> **Deployments** -> latest deployment -> **Redeploy**.

---

## Step 4 -- Verify the subdomain

Run the first two checks from `scripts/links-smoke.sh` against a known code:

```bash
# After at least one tracked_link row exists in DB:
curl -I https://go.bythiagofigueiredo.com/<code>
# Expected: HTTP/2 302 with Location: <destination_url>

curl -I https://go.bythiagofigueiredo.com/nonexistent
# Expected: HTTP/2 404
```

If you see a Cloudflare `ERR_TOO_MANY_REDIRECTS` error:
- Disable the Cloudflare proxy (grey cloud) on the `go` CNAME temporarily.
- This usually means Cloudflare's SSL mode is **Full (strict)** but Vercel's
  domain isn't yet validated. Switch Cloudflare SSL to **Full** (not strict)
  while Vercel validates, then re-enable strict after validation.

---

## Step 5 -- Enable newsletter link rewriting (optional)

Once the subdomain serves redirects correctly, flip the feature flag:

```bash
# In Vercel -> Environment Variables:
LINKS_NEWSLETTER_REWRITE_ENABLED=true
```

Redeploy. The next newsletter edition sent by the cron will use the go.domain
URLs in every `<a href>`. Existing sent editions are unaffected.

---

## Rollback

To revert:
1. Set `LINKS_NEWSLETTER_REWRITE_ENABLED=false` in Vercel and redeploy.
2. The legacy inline tracking path resumes immediately for new sends.
3. DNS CNAME and Vercel custom domain can remain in place -- they are inert when
   the feature flag is off.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `go.domain` returns Vercel 404 | Custom domain not added to Vercel | Step 2 |
| `ERR_TOO_MANY_REDIRECTS` | Cloudflare SSL mode mismatch | Switch to Full (not strict) |
| `LINKS_SHORT_DOMAIN` is empty | Env var not set / not redeployed | Step 3 + redeploy |
| Click not recorded in DB | `LINKS_NEWSLETTER_REWRITE_ENABLED` still false | Step 5 |
| Redirect works but UTM missing | Destination already has `utm_source` | Expected behaviour (no double-append) |
