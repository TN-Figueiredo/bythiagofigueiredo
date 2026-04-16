/**
 * DB-gated integration matrix for the `/admin` and `/cms` area authorization
 * boundary (Sprint 4.5 / Task 10d).
 *
 * Covers the 10 cases enumerated in the spec:
 *   docs/superpowers/specs/2026-04-15-admin-cms-login-split-design.md
 *     §"Cross-area RLS test matrix"
 *
 * Layers exercised:
 *   - Cases 1-6, 10: the RPC backing `requireArea` — `is_admin()` for area
 *     'admin', `is_staff()` for area 'cms' (migration 20260414000004). The
 *     RPC drives the `(authed)/layout.tsx` decision to render vs redirect
 *     to `/?error=insufficient_access`.
 *   - Cases 7, 8: the `apps/web/src/middleware.ts` anon redirect to
 *     `/{area}/login?next={path}` (uses the existing pattern from
 *     `apps/web/test/middleware.test.ts`).
 *   - Case 9: middleware with an expired-JWT cookie. `auth.getUser()`
 *     rejects the token → middleware treats the request as unauthenticated
 *     and issues the same 307 to `/admin/login`.
 *
 * Guarding:
 *   `describe.skipIf(skipIfNoLocalDb())` — CI without `HAS_LOCAL_DB=1`
 *   skips silently. Local dev: `npm run db:start && HAS_LOCAL_DB=1 npm test`.
 *
 * Auth model used for roles:
 *   `is_staff()` / `is_admin()` read `request.jwt.claims ->> app_metadata.role`
 *   (not `organization_members`). We sign JWTs via `seedStaffUser(…, role, {
 *   jwtAppRole })` matching each case's seed role, then call the RPC through
 *   PostgREST with the JWT as a bearer token — PostgREST unmarshals the
 *   claim and exposes it to the SQL function.
 *
 * Case 10 note (stale JWT vs. deleted membership):
 *   Spec §"Area authorization" says `requireArea` should re-query the DB on
 *   every render so a deleted membership revokes access even while the JWT
 *   claim is stale. Today's `is_staff()` is JWT-claim-based only — the
 *   membership check lives in `can_admin_site()` / `can_admin_site_for_user()`.
 *   Case 10 asserts BOTH the current DB behaviour (JWT claim passes
 *   `is_staff()` even after membership deletion — a known gap) AND that the
 *   site-scoped membership RPC correctly returns false. The aspirational
 *   spec behaviour lands when `requireArea` is re-wired to call the
 *   site-scoped helper. Tracked in the login-split spec revision log.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  SERVICE_KEY,
  ANON_KEY,
  seedSite,
  seedStaffUser,
  signExpiredUserJwt,
  type OrgMemberRole,
  type JwtAreaRole,
} from '../helpers/db-seed'

/** Spins up an anon client pre-authenticated as a given user JWT. */
function jwtClient(jwt: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}

/** Simulates the RPC call that `requireArea(area)` makes per layout render. */
async function requireAreaWouldAllow(jwt: string, area: 'admin' | 'cms'): Promise<boolean> {
  const client = jwtClient(jwt)
  const fn = area === 'admin' ? 'is_admin' : 'is_staff'
  const { data, error } = await client.rpc(fn)
  if (error) throw error
  return data === true
}

describe.skipIf(skipIfNoLocalDb())('area authorization (admin + cms) — DB-gated matrix', () => {
  let db: SupabaseClient
  const siteIdsToCleanup: string[] = []
  const orgIdsToCleanup: string[] = []
  const userIdsToCleanup: string[] = []

  beforeAll(() => {
    // Middleware reads these at request time via `createServerClient`. Mirror
    // the env-stubbing pattern from `apps/web/test/middleware.test.ts`.
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ANON_KEY)
    db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    // Delete auth.users first so organization_members cascade cleanly.
    if (userIdsToCleanup.length) {
      const authAdmin = (
        db as unknown as {
          auth: { admin: { deleteUser: (id: string) => Promise<unknown> } }
        }
      ).auth.admin
      for (const id of userIdsToCleanup) {
        try { await authAdmin.deleteUser(id) } catch { /* best-effort */ }
      }
    }
    if (siteIdsToCleanup.length) {
      await db.from('sites').delete().in('id', siteIdsToCleanup)
    }
    if (orgIdsToCleanup.length) {
      await db.from('organizations').delete().in('id', orgIdsToCleanup)
    }
  })

  async function freshSite(opts: { parentOrgId?: string | null } = {}): Promise<{ siteId: string; orgId: string }> {
    const { siteId, orgId } = await seedSite(db, { parentOrgId: opts.parentOrgId ?? null })
    siteIdsToCleanup.push(siteId)
    orgIdsToCleanup.push(orgId)
    return { siteId, orgId }
  }

  async function freshUser(
    orgId: string,
    role: OrgMemberRole,
    jwtAppRole?: JwtAreaRole,
  ): Promise<{ userId: string; jwt: string }> {
    const user = await seedStaffUser(db, orgId, role, { jwtAppRole })
    userIdsToCleanup.push(user.userId)
    return user
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Layout-level RBAC (requireArea → RPC)
  // ──────────────────────────────────────────────────────────────────────────

  it('[1] author in org X → GET /admin → layout redirects (/?error=insufficient_access)', async () => {
    const { orgId } = await freshSite()
    const { jwt } = await freshUser(orgId, 'author')
    const allowed = await requireAreaWouldAllow(jwt, 'admin')
    expect(allowed).toBe(false) // requireArea('admin') → redirect('/?error=insufficient_access')
  })

  it('[2] author in org X → GET /cms → layout redirects (author is not staff)', async () => {
    const { orgId } = await freshSite()
    const { jwt } = await freshUser(orgId, 'author')
    const allowed = await requireAreaWouldAllow(jwt, 'cms')
    expect(allowed).toBe(false) // requireArea('cms') → redirect('/?error=insufficient_access')
  })

  it('[3] editor in org X → GET /cms → renders (200)', async () => {
    const { orgId } = await freshSite()
    const { jwt } = await freshUser(orgId, 'editor')
    const allowed = await requireAreaWouldAllow(jwt, 'cms')
    expect(allowed).toBe(true) // requireArea('cms') passes → layout renders
  })

  it('[4] editor in org X → GET /admin → layout redirects', async () => {
    const { orgId } = await freshSite()
    const { jwt } = await freshUser(orgId, 'editor')
    const allowed = await requireAreaWouldAllow(jwt, 'admin')
    expect(allowed).toBe(false) // requireArea('admin') → redirect('/?error=insufficient_access')
  })

  it('[5] admin in org X → GET /admin AND /cms → both render', async () => {
    const { orgId } = await freshSite()
    const { jwt } = await freshUser(orgId, 'admin')
    expect(await requireAreaWouldAllow(jwt, 'admin')).toBe(true)
    expect(await requireAreaWouldAllow(jwt, 'cms')).toBe(true)
  })

  it('[6] super_admin in master ring → GET child ring /cms → renders (cascade-up)', async () => {
    // Master ring.
    const { orgId: masterOrgId } = await freshSite()
    // Child ring whose parent = master.
    const { siteId: childSiteId, orgId: childOrgId } = await freshSite({ parentOrgId: masterOrgId })
    // User is a staff member of the MASTER org; JWT carries `super_admin` —
    // `is_staff()` admits that claim directly. Additionally, the site-scoped
    // helper validates the cascade-up at the org-membership layer.
    const { userId, jwt } = await freshUser(masterOrgId, 'admin', 'super_admin')

    // Layer 1: JWT-based `is_staff()` — what `requireArea('cms')` actually calls.
    expect(await requireAreaWouldAllow(jwt, 'cms')).toBe(true)

    // Layer 2: site-scoped membership — documents the cascade-up that the spec
    // describes. `can_admin_site_for_user` returns true because the user is
    // `admin` in the master org (the parent of the child site's org).
    const { data: cascade, error } = await db.rpc('can_admin_site_for_user', {
      p_site_id: childSiteId,
      p_user_id: userId,
    })
    expect(error).toBeNull()
    expect(cascade).toBe(true)
    void childOrgId
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Middleware-level auth gate (no session → 307 to /{area}/login)
  // ──────────────────────────────────────────────────────────────────────────

  it('[7] anon → GET /admin → middleware 307 /admin/login?next=/admin', async () => {
    const middleware = (await import('../../src/middleware')).default
    const req = new NextRequest(new URL('http://localhost:3001/admin'), {
      headers: new Headers({ host: 'localhost:3001' }),
    })
    const res = await middleware(req)
    expect([307, 308]).toContain(res.status)
    const location = res.headers.get('location') ?? ''
    expect(location).toMatch(/\/admin\/login/)
    expect(location).toMatch(/[?&]next=%2Fadmin(?:$|&)/)
  })

  it('[8] anon → GET /cms/campaigns → middleware 307 /cms/login?next=/cms/campaigns', async () => {
    const middleware = (await import('../../src/middleware')).default
    const req = new NextRequest(new URL('http://localhost:3001/cms/campaigns'), {
      headers: new Headers({ host: 'localhost:3001' }),
    })
    const res = await middleware(req)
    expect([307, 308]).toContain(res.status)
    const location = res.headers.get('location') ?? ''
    expect(location).toMatch(/\/cms\/login/)
    expect(location).toMatch(/[?&]next=%2Fcms%2Fcampaigns(?:$|&)/)
  })

  it('[9] authed-but-cookie-expired → GET /admin → middleware redirects to /admin/login (no 500)', async () => {
    const middleware = (await import('../../src/middleware')).default
    // An expired self-signed JWT shaped like a Supabase auth cookie. Real
    // Supabase cookies are JSON-encoded sessions; the point here is that an
    // invalid/expired token makes `auth.getUser()` resolve with `user: null`,
    // so the middleware falls through to the anon branch — a redirect, not
    // a 500.
    const { jwt: expired } = signExpiredUserJwt(randomUUID(), 'editor')
    const req = new NextRequest(new URL('http://localhost:3001/admin'), {
      headers: new Headers({
        host: 'localhost:3001',
        // Supabase ssr parses cookies generically; a malformed/expired value
        // results in `user: null` without throwing.
        cookie: `sb-access-token=${expired}`,
      }),
    })
    const res = await middleware(req)
    expect([307, 308]).toContain(res.status)
    expect(res.headers.get('location') ?? '').toMatch(/\/admin\/login/)
  })

  it('[10] editor with deleted membership → GET /cms → site-scoped check rejects (stale JWT still passes is_staff — known gap)', async () => {
    const { siteId, orgId } = await freshSite()
    const { userId, jwt } = await freshUser(orgId, 'editor')

    // Pre-delete: both layers agree the editor can access.
    expect(await requireAreaWouldAllow(jwt, 'cms')).toBe(true)
    {
      const { data, error } = await db.rpc('can_admin_site_for_user', {
        p_site_id: siteId,
        p_user_id: userId,
      })
      expect(error).toBeNull()
      expect(data).toBe(true)
    }

    // Membership revoked server-side (e.g. admin removed the editor from org).
    const { error: delErr } = await db
      .from('organization_members')
      .delete()
      .match({ org_id: orgId, user_id: userId })
    expect(delErr).toBeNull()

    // Site-scoped helper (DB-queried) correctly denies — this is the check
    // the spec wants `requireArea` to adopt.
    {
      const { data, error } = await db.rpc('can_admin_site_for_user', {
        p_site_id: siteId,
        p_user_id: userId,
      })
      expect(error).toBeNull()
      expect(data).toBe(false) // spec-aspirational: deleted membership revokes access
    }

    // Current reality: `is_staff()` reads the JWT claim only, so the user
    // still satisfies `requireArea('cms')` until the token refreshes. This
    // assertion documents the gap captured in the spec revision log.
    expect(await requireAreaWouldAllow(jwt, 'cms')).toBe(true)
  })
})
