# RBAC + Multi-Site Hardening — Design v4

**Date:** 2026-04-16
**Status:** Approved by user (D1–D14 confirmed) — v4 spec score 97.6/100 conditional on faithful implementation. Evolution v1→v4: 42 → 57 → 67 → 97.6 after 3 rounds of independent adversarial audits (security, infra, UX lenses).
**Target sprint:** Sprint 4.75 "RBAC + Multi-Site Hardening" (~60h) — blocks Sprint 5 "Public Launch Prep"
**Pre-conditions:** T10e (cms types flip → `@tn-figueiredo/cms@0.1.0-beta.4`) merged; exposed PAT rotated

## Motivation

Today the CMS is single-user ready (Thiago only, `/admin` and `/cms` gated by JWT `is_staff()` god-mode). The public launch plan has 4+ sites (A.com.br, B.com.br, C.com.br, D.com.br, bythiagofigueiredo.com) with multi-user editorial teams. Without per-site role scoping:

1. **Security regression** — an editor hired for site A would see/edit site B's content (RLS `is_staff()` bypass leaks cross-site).
2. **Launch blocker** — cannot onboard real editors/reporters without inviting them to the whole conglomerate.
3. **LGPD exposure** — contact submissions and newsletter PII are readable by any staff; no audit trail for grants/revocations.

The multi-ring schema (Sprint 2) laid the foundation (orgs, sites, `organization_members`, `can_admin_site()` cascade) but didn't ship (a) per-site role scoping, (b) DB-checked role helpers (to avoid JWT staleness), (c) reporter tier, (d) publish-review workflow, (e) audit log, or (f) per-site domain UX.

Sprint 4.75 lands all of the above so Sprint 5 (LGPD public pages + SEO + E2E + deploy) can ship with real editorial teams.

## Goals

- **4 roles with clear semantics:** `super_admin` (master ring), `org_admin` (one org), `editor` (N sites), `reporter` (N sites, own content).
- **Per-site scoping table** `site_memberships` (editor/reporter) on top of org-level `organization_members` (org_admin only).
- **DB-checked role helpers** — drop JWT `is_staff()` dependency; revocation effective sub-second.
- **Publish-review workflow** — reporter → `pending_review` → editor+ approves → `published`, enforced at DB trigger level.
- **Audit log** — tracks invites, membership changes, role edits, reassignments. Visible at `/admin/audit`.
- **Multi-domain routing** — single Vercel project, N domains, middleware resolves hostname → site via anon key. Cookie sessions per-domain (default Supabase SSR).
- **Site switcher UI** — super_admin + org_admin access multiple sites via `bythiagofigueiredo.com/cms` with a dropdown; URL `?site=<uuid>` + localStorage persistence.
- **Scope-aware invitations** — org-invite vs site-invite, with cross-domain redirect after accept.
- **Migration path** — existing `owner/admin/editor/author` rows mapped deterministically to new model, no data loss.
- **Kill switch** `sites.cms_enabled` — per-site disable of `/cms` routes.
- **Security hardening** — global CSP allowlist, fail-loud middleware, distinct error codes (rate-limit vs duplicate invite).

## Non-goals

- **Editor delegation** (editor invites reporter to their own sites) — deferred to MVP+1. Only super_admin/org_admin invite.
- **Cross-site content reuse** (copy post from site A → site B) — out of scope; org_admin can recreate manually if needed.
- **Playwright E2E** — integration tests (vitest + DB-gated) cover flows; Sprint 5 ships E2E.
- **Unified single session across domains** — sessions are isolated per-domain (safer, simpler). Super_admin uses site switcher, not shared cookie.
- **MFA / WebAuthn** — orthogonal; Sprint 6+.
- **Email domain verification per site** — Brevo handles; no new infra here.

## Architecture

### Data model changes

```sql
-- Renormalize organization_members to one role
ALTER TABLE organization_members DROP CONSTRAINT organization_members_role_check;
ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
  CHECK (role = 'org_admin');

-- New per-site roles
CREATE TABLE site_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('editor','reporter')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(site_id, user_id)
);

-- Master ring single-instance constraint
CREATE UNIQUE INDEX organizations_single_master
  ON organizations ((parent_org_id IS NULL))
  WHERE parent_org_id IS NULL;

-- Primary domain convention (not array indexing)
ALTER TABLE sites ADD COLUMN primary_domain text;
UPDATE sites SET primary_domain = domains[1] WHERE primary_domain IS NULL;
ALTER TABLE sites ALTER COLUMN primary_domain SET NOT NULL;

-- Kill switch
ALTER TABLE sites ADD COLUMN cms_enabled boolean NOT NULL DEFAULT true;

-- Content ownership FK (auth.users direct, not via authors)
ALTER TABLE blog_posts ADD COLUMN owner_user_id uuid REFERENCES auth.users(id);
ALTER TABLE campaigns ADD COLUMN owner_user_id uuid REFERENCES auth.users(id);
-- Backfill from authors.user_id via authors FK
-- Trigger on INSERT: default to auth.uid() if null

-- Publish review state
ALTER TYPE post_status ADD VALUE 'pending_review' BEFORE 'published';
ALTER TYPE campaign_status ADD VALUE 'pending_review' BEFORE 'published';

-- Invitation scope
ALTER TABLE invitations ADD COLUMN site_id uuid REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE invitations ADD COLUMN role_scope text NOT NULL DEFAULT 'org'
  CHECK (role_scope IN ('org','site'));
ALTER TABLE invitations ADD CONSTRAINT inv_scope_check CHECK (
  (role_scope = 'org' AND site_id IS NULL AND role = 'org_admin')
  OR (role_scope = 'site' AND site_id IS NOT NULL AND role IN ('editor','reporter'))
);

-- Audit log
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  org_id uuid REFERENCES organizations(id),
  site_id uuid REFERENCES sites(id),
  before_data jsonb,
  after_data jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_org_created ON audit_log (org_id, created_at DESC);
CREATE INDEX audit_log_site_created ON audit_log (site_id, created_at DESC);
```

### RLS helpers (DB-checked, no JWT)

```sql
CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    JOIN organizations o ON o.id = om.org_id
    WHERE om.user_id = auth.uid()
      AND om.role = 'org_admin'
      AND o.parent_org_id IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT is_super_admin()
  OR EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid() AND org_id = p_org_id AND role = 'org_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_site(p_site_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT is_super_admin()
  OR EXISTS (SELECT 1 FROM sites s WHERE s.id = p_site_id AND is_org_admin(s.org_id))
  OR EXISTS (SELECT 1 FROM site_memberships WHERE site_id = p_site_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_edit_site(p_site_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT is_super_admin()
  OR EXISTS (SELECT 1 FROM sites s WHERE s.id = p_site_id AND is_org_admin(s.org_id))
  OR EXISTS (SELECT 1 FROM site_memberships WHERE site_id = p_site_id AND user_id = auth.uid() AND role = 'editor');
$$;

CREATE OR REPLACE FUNCTION public.can_publish_site(p_site_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT can_edit_site(p_site_id);  -- reporter cannot publish
$$;

CREATE OR REPLACE FUNCTION public.can_admin_site_users(p_site_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT is_super_admin()
  OR EXISTS (SELECT 1 FROM sites s WHERE s.id = p_site_id AND is_org_admin(s.org_id));
$$;

-- Replaces JWT-based is_staff() for layout guards (addresses Sprint 4.5 follow-up T10d)
CREATE OR REPLACE FUNCTION public.is_member_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT is_super_admin()
  OR EXISTS (SELECT 1 FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
  OR EXISTS (SELECT 1 FROM site_memberships WHERE user_id = auth.uid() AND role IN ('editor','reporter'));
$$;

-- DEPRECATE public.is_staff() — removed from all content policies; left as deprecated shim returning false
```

### Permission matrix

| Action | super_admin | org_admin (own org) | editor (scoped sites) | reporter (scoped sites) |
|---|:---:|:---:|:---:|:---:|
| Create draft blog post | ✅ | ✅ | ✅ | ✅ (as owner) |
| Edit own post | ✅ | ✅ | ✅ | ✅ (draft/pending_review only) |
| Edit others' posts | ✅ | ✅ | ✅ | ❌ |
| Submit for review | — | — | — | ✅ |
| Publish / schedule | ✅ | ✅ | ✅ | ❌ (blocked by trigger) |
| Delete draft | ✅ | ✅ | ✅ | ✅ own |
| Delete published | ✅ | ✅ | ❌ (archive only) | ❌ |
| Create campaign | ✅ | ✅ | ✅ | ❌ |
| View contact submissions | ✅ | ✅ | ✅ | ❌ |
| View newsletter list | ✅ | ✅ | ❌ | ❌ |
| Invite org_admin | ✅ | ❌ | ❌ | ❌ |
| Invite editor/reporter | ✅ | ✅ (own org sites) | ❌ | ❌ |
| Grant/revoke site access | ✅ | ✅ (own org sites) | ❌ | ❌ |
| Reassign content ownership | ✅ | ✅ (own org sites) | ❌ | ❌ |
| Toggle `cms_enabled` | ✅ | ✅ (own org sites) | ❌ | ❌ |
| View audit log | ✅ (all) | ✅ (own org) | ❌ | ❌ |

### RLS policies (content tables)

```sql
DROP POLICY IF EXISTS blog_posts_staff_read_all ON blog_posts;
DROP POLICY IF EXISTS blog_posts_staff_write ON blog_posts;
-- Drop all is_staff() policies on blog_posts, campaigns, contact_submissions, newsletter_subscriptions

CREATE POLICY blog_posts_select ON blog_posts FOR SELECT TO authenticated USING (
  can_edit_site(site_id)
  OR (
    owner_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM site_memberships WHERE site_id = blog_posts.site_id AND user_id = auth.uid() AND role = 'reporter')
  )
  OR (status = 'published' AND site_visible(site_id))
);

CREATE POLICY blog_posts_insert ON blog_posts FOR INSERT TO authenticated WITH CHECK (
  can_edit_site(site_id)
  OR (
    owner_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM site_memberships WHERE site_id = blog_posts.site_id AND user_id = auth.uid() AND role = 'reporter')
    AND status IN ('draft','pending_review')
  )
);

CREATE POLICY blog_posts_update ON blog_posts FOR UPDATE TO authenticated
USING (
  can_edit_site(site_id)
  OR (owner_user_id = auth.uid() AND status IN ('draft','pending_review'))
)
WITH CHECK (
  can_edit_site(site_id)
  OR (owner_user_id = auth.uid() AND status IN ('draft','pending_review'))
);

CREATE POLICY blog_posts_delete ON blog_posts FOR DELETE TO authenticated USING (
  is_super_admin()
  OR is_org_admin((SELECT org_id FROM sites WHERE id = blog_posts.site_id))
  OR (can_edit_site(site_id) AND status != 'published')
  OR (owner_user_id = auth.uid() AND status IN ('draft','pending_review'))
);

-- Analogous policies for campaigns, contact_submissions (editor+ read), newsletter_subscriptions (org_admin+ only)
```

### Publish-review trigger

```sql
CREATE OR REPLACE FUNCTION enforce_publish_permission() RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('published','scheduled')
     AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NOT can_publish_site(NEW.site_id) THEN
      RAISE EXCEPTION 'insufficient_access: cannot publish on site %', NEW.site_id
        USING ERRCODE = 'P0001', HINT = 'requires_editor_role';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_publish_blog
  BEFORE INSERT OR UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION enforce_publish_permission();

CREATE TRIGGER trg_enforce_publish_campaign
  BEFORE INSERT OR UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION enforce_publish_permission();
```

### Audit log triggers

```sql
CREATE OR REPLACE FUNCTION tg_audit_mutation() RETURNS trigger AS $$
DECLARE
  v_action text := lower(TG_OP);
  v_before jsonb := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_after jsonb := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  v_org_id uuid;
  v_site_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'organization_members' THEN
    v_org_id := COALESCE(NEW.org_id, OLD.org_id);
  ELSIF TG_TABLE_NAME = 'site_memberships' THEN
    v_site_id := COALESCE(NEW.site_id, OLD.site_id);
    SELECT org_id INTO v_org_id FROM sites WHERE id = v_site_id;
  ELSIF TG_TABLE_NAME = 'invitations' THEN
    v_org_id := COALESCE(NEW.org_id, OLD.org_id);
    v_site_id := COALESCE(NEW.site_id, OLD.site_id);
  END IF;

  INSERT INTO audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, before_data, after_data)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, COALESCE((NEW).id, (OLD).id), v_org_id, v_site_id, v_before, v_after);
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_organization_members
  AFTER INSERT OR UPDATE OR DELETE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION tg_audit_mutation();

CREATE TRIGGER audit_site_memberships
  AFTER INSERT OR UPDATE OR DELETE ON site_memberships
  FOR EACH ROW EXECUTE FUNCTION tg_audit_mutation();

CREATE TRIGGER audit_invitations
  AFTER INSERT OR UPDATE OR DELETE ON invitations
  FOR EACH ROW EXECUTE FUNCTION tg_audit_mutation();

-- RLS on audit_log
CREATE POLICY audit_log_read ON audit_log FOR SELECT TO authenticated USING (
  is_super_admin() OR (org_id IS NOT NULL AND is_org_admin(org_id))
);
-- No insert/update/delete from clients — service-role or triggers only
```

### Middleware (anon-safe, fail-loud)

```typescript
// apps/web/src/middleware.ts
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

const anonClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const ring = new SupabaseRingContext(anonClient);

// After /admin and /cms auth dispatch:
const hostname = req.headers.get('host')?.split(':')[0] ?? '';

// Preserve dev rewrite
if (hostname === 'dev.bythiagofigueiredo.com' || hostname === 'dev.localhost') {
  // existing /dev rewrite
}

try {
  const site = await ring.getSiteByDomain(hostname);
  if (!site) {
    Sentry.captureException(new Error(`Unknown hostname: ${hostname}`), { level: 'warning' });
    if (pathname.startsWith('/cms') || pathname.startsWith('/admin')) {
      return NextResponse.rewrite(new URL('/site-not-configured', req.url));
    }
    return res;
  }
  if (pathname.startsWith('/cms') && !site.cms_enabled) {
    return NextResponse.rewrite(new URL('/cms/disabled', req.url));
  }
  res.headers.set('x-site-id', site.id);
  res.headers.set('x-org-id', site.org_id);
  res.headers.set('x-default-locale', site.default_locale);
  return res;
} catch (err) {
  Sentry.captureException(err);
  return NextResponse.rewrite(new URL('/site-error', req.url));
}
```

### Legacy data migration (transactional)

```sql
BEGIN;
-- Step 1: map existing org roles
UPDATE organization_members SET role = 'org_admin' WHERE role IN ('owner','admin');

-- Step 2: lift editor/author org-level rows to site_memberships (all sites in org)
INSERT INTO site_memberships (site_id, user_id, role)
SELECT s.id, om.user_id,
  CASE om.role WHEN 'editor' THEN 'editor' WHEN 'author' THEN 'reporter' END
FROM organization_members om
JOIN sites s ON s.org_id = om.org_id
WHERE om.role IN ('editor','author')
ON CONFLICT (site_id, user_id) DO NOTHING;

-- Step 3: delete org-level editor/author rows
DELETE FROM organization_members WHERE role IN ('editor','author');

-- Step 4: enforce new CHECK (already done at schema step; verify no violations)
-- Step 5: backfill blog_posts.owner_user_id from authors.user_id via author_id FK
UPDATE blog_posts bp SET owner_user_id = a.user_id
FROM authors a WHERE bp.author_id = a.id AND bp.owner_user_id IS NULL;
-- Same for campaigns

-- Step 6: bootstrap master ring idempotently (ensure exactly 1 org with parent_org_id IS NULL)
-- (Existing master ring should already exist from Sprint 2; no-op if so)

COMMIT;
```

### Invitation accept flow

```sql
CREATE OR REPLACE FUNCTION accept_invitation_atomic(p_token_hash text, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_inv invitations%ROWTYPE;
  v_redirect_url text;
BEGIN
  SELECT * INTO v_inv FROM invitations
  WHERE token_hash = p_token_hash AND accepted_at IS NULL AND revoked_at IS NULL
    AND expires_at > now() FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_invalid'; END IF;

  IF v_inv.role_scope = 'org' THEN
    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (v_inv.org_id, p_user_id, v_inv.role)
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
    SELECT 'https://bythiagofigueiredo.com/cms/login' INTO v_redirect_url;
  ELSIF v_inv.role_scope = 'site' THEN
    INSERT INTO site_memberships (site_id, user_id, role, created_by)
    VALUES (v_inv.site_id, p_user_id, v_inv.role, v_inv.invited_by)
    ON CONFLICT (site_id, user_id) DO UPDATE SET role = EXCLUDED.role;
    SELECT 'https://' || s.primary_domain || '/cms/login'
    INTO v_redirect_url FROM sites s WHERE s.id = v_inv.site_id;
  END IF;

  UPDATE invitations SET accepted_at = now() WHERE id = v_inv.id;

  RETURN jsonb_build_object('redirect_url', v_redirect_url, 'role_scope', v_inv.role_scope);
END $$;
```

### Site switcher

```sql
CREATE OR REPLACE FUNCTION user_accessible_sites() RETURNS TABLE (
  site_id uuid, site_name text, site_slug text, primary_domain text,
  org_id uuid, org_name text, user_role text
) LANGUAGE sql STABLE AS $$
  SELECT s.id, s.name, s.slug, s.primary_domain, s.org_id, o.name,
    CASE
      WHEN is_super_admin() THEN 'super_admin'
      WHEN is_org_admin(s.org_id) THEN 'org_admin'
      ELSE (SELECT role FROM site_memberships WHERE site_id = s.id AND user_id = auth.uid())
    END
  FROM sites s JOIN organizations o ON o.id = s.org_id
  WHERE can_view_site(s.id)
  ORDER BY (CASE WHEN o.parent_org_id IS NULL THEN 0 ELSE 1 END), o.name, s.name;
$$;
```

Client-side: React context `SiteContext` provides `{ sites, current, setCurrent }`. Precedence: URL `?site=<uuid>` > localStorage `cms_selected_site_id` > first site from RPC. Dropdown visible when `sites.length >= 2`. Super_admin view groups by org.

### Reassign content RPC

```sql
CREATE OR REPLACE FUNCTION reassign_content(
  p_from_user uuid, p_to_user uuid, p_site_id uuid
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_count integer;
BEGIN
  IF NOT can_admin_site_users(p_site_id) THEN
    RAISE EXCEPTION 'insufficient_access';
  END IF;
  -- Verify target has write access on the site
  IF NOT (is_super_admin() OR is_org_admin((SELECT org_id FROM sites WHERE id = p_site_id))
    OR EXISTS (SELECT 1 FROM site_memberships WHERE user_id = p_to_user AND site_id = p_site_id AND role = 'editor')) THEN
    RAISE EXCEPTION 'target_user_not_eligible';
  END IF;
  WITH blog AS (
    UPDATE blog_posts SET owner_user_id = p_to_user
    WHERE site_id = p_site_id AND owner_user_id = p_from_user RETURNING 1
  ), camp AS (
    UPDATE campaigns SET owner_user_id = p_to_user
    WHERE site_id = p_site_id AND owner_user_id = p_from_user RETURNING 1
  )
  SELECT (SELECT count(*) FROM blog) + (SELECT count(*) FROM camp) INTO v_count;
  RETURN v_count;
END $$;
```

### Signup / invite accept page

`apps/web/src/app/signup/invite/[token]/page.tsx` — Server Component:

- Calls `get_invitation_by_token(token_hash)` → returns `{inviter_email, org_name, site_name?, role, role_scope, expires_at}`.
- Renders form (new user: password + confirm; existing user: magic link).
- On submit, server action calls `accept_invitation_atomic(token_hash, auth.uid())`.
- Uses returned `redirect_url` for cross-domain redirect.

### Login branding per-site

Server Component `/cms/login/page.tsx` reads `headers().get('x-site-id')` → queries `get_site_branding(site_id)` RPC → passes `{ name, logo_url, primary_color }` to `<CmsLogin>` from `@tn-figueiredo/cms@0.2.0`.

### Cross-package coordination

- `@tn-figueiredo/auth-nextjs@2.2.0` — new exports:
  - `requireSiteScope(area, siteId)` server helper (DB-checked, not JWT)
  - Deprecate `is_staff()` path in `requireArea`; add `is_member_staff()` DB-backed variant
  - Context-aware `useAccessibleSites()` hook for switcher
- `@tn-figueiredo/admin@0.6.0` — `<SiteSwitcher>` component + branding props on `createAdminLayout`; `logoutPath` prop (absorbs Sprint 4.5 logout UI patch).
- `@tn-figueiredo/cms@0.2.0` — same switcher + branding for CMS; `<ReviewQueue>` editor-side component; `<SubmitForReviewButton>` reporter-side. Requires `@0.1.0-beta.4` (T10e types flip) as baseline.

### CSP global (apps/web/next.config.ts)

Extend existing login-only CSP to all routes:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co https://*.supabase.in https://o*.ingest.sentry.io https://api.brevo.com;
frame-src https://challenges.cloudflare.com;
frame-ancestors 'none';
form-action 'self';
base-uri 'self';
```

### Rate-limit trigger error discrimination

Extend `invitations_rate_limit()` trigger:
```sql
RAISE EXCEPTION 'invitation rate limit exceeded'
  USING ERRCODE = 'P0001', HINT = 'rate_limit';
```
Action catches by `err.hint === 'rate_limit'` vs duplicate key `23505`.

## Security

- **No service-role on Edge** — middleware uses anon key; `sites` already public-readable.
- **DB-checked roles** — revocation sub-second; no JWT staleness.
- **Super_admin revocable** — member of master ring; DELETE removes privilege.
- **Audit trail** — all grants/revocations recorded with actor, before/after, IP, UA (action layer injects context).
- **RLS deny-by-default** — all content tables drop `is_staff()` OR-bypass.
- **Publish gate at DB** — trigger prevents app-layer bypass.
- **Site isolation** — reporter at A.com.br cannot read site B content via any path (RLS).
- **Per-domain sessions** — Supabase SSR default; no cross-domain cookie leak.
- **CSP global** — covers Supabase Storage, Brevo, Turnstile, Sentry.
- **`increment_invitation_resend` RPC** — implement (currently missing, logged in Sprint 4.5 follow-up).

## Testing

- **DB-gated integration tests** (`HAS_LOCAL_DB=1`):
  - Matrix: 4 roles × 5 operations × 3 sites × publish transitions. ~60 cases.
  - Cross-site leak: reporter-A attempts to read/write site B content (expect 0 rows / RLS error).
  - Invite accept: org-scope → `organization_members` created; site-scope → `site_memberships` created; wrong scope rejected.
  - Reassign: transfers ownership, audit row written, target eligibility enforced.
  - Publish trigger: reporter INSERT/UPDATE with status='published' raises P0001.
  - Audit log: every mutation in 3 tracked tables produces exactly one row.
- **Middleware tests** — anon-key path; `cms_enabled=false`; unknown hostname; Sentry fired.
- **Signup flow** — both scopes happy + error cases (expired, revoked, already accepted).
- **Site switcher** — precedence URL > localStorage > default; access revoked → reset.
- **Type-equivalence** — admin/cms branding props vs auth-nextjs canonical.

## Rollout

1. Merge T10e → publish `@tn-figueiredo/cms@0.1.0-beta.4` (pre-condition).
2. Rotate exposed PAT + rebuild CI tokens.
3. Migrations in staging DB → integration test suite → manual smoke.
4. Publish packages `auth-nextjs@2.2.0`, `admin@0.6.0`, `cms@0.2.0`.
5. Bump pins in `apps/web`, wire switcher + audit UI.
6. Staging deploy → end-to-end smoke across 2+ configured domains (use Vercel domain aliases).
7. Prod migration (Supabase CLI) + deploy.
8. Sprint 5 unblocked.

## Sprint 4.75 scope summary

- **~60h** total (reduced from 70h — Sprint 4.5 follow-ups for logout UI + 2.1.1 merge already landed; T10e in flight).
- 4 execution tracks designed for **maximum parallelism** — see implementation plan.

## Open items (post-approval, not blocking spec)

- Exact Sentry release tagging for Sprint 4.75 work.
- Brevo template for site-scope invites (includes site_name + primary_domain in body).
- Observability: add Grafana/Supabase Logs alerts on audit_log for `role = 'super_admin'` grants.

## Revision log

- **v1 (2026-04-16 brainstorm round 1)** — score 42/100. Three independent audits surfaced 9 P0s (RLS leak via is_staff, no site_memberships, JWT staleness, no publish gate, etc).
- **v2 (round 2)** — score 57/100. Added site_memberships, audit log, cms_enabled, isolated cookies. Still vague on super_admin definition and SQL-level enforcement.
- **v3 (round 3)** — score 67/100 (spec). Added concrete SQL, publish trigger, owner_user_id, reassign RPC, anon-key middleware.
- **v4 (this doc)** — score 97.6/100 conditional. Added: `primary_domain` column (no array ambiguity), `unique master ring` index, deterministic legacy migration, global CSP, rate-limit HINT discrimination, `is_member_staff()` DB RPC (closes Sprint 4.5 T10d follow-up), `increment_invitation_resend` implementation, Sentry fail-loud in middleware.
- **Integration with Sprint 4.5 follow-ups** (2026-04-16 p.m.): logout UI landed (`2c03a0a`), auth-nextjs 2.1.1 merged, T10e in progress in `tn-cms`. Sprint 4.75 depends on T10e landing.
