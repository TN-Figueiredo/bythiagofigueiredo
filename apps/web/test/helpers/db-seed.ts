/**
 * Reusable seed helpers for DB-gated integration tests (Sprint 4 / Epic 8).
 *
 * All helpers expect a service-role Supabase client (RLS bypass) — they write
 * directly and return the ids so tests can assert post-conditions.
 *
 * Tokens are hashed with sha256 hex (lowercase), matching app-code conventions:
 *   crypto.createHash('sha256').update(raw).digest('hex')
 */
import { createHash, randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import { getLocalJwtSecret } from './db-skip'

// ─────────────────────────────────────────────────────────────────────────────
// Local Supabase CLI default constants (not secrets — published defaults).
// ─────────────────────────────────────────────────────────────────────────────
export const SUPABASE_URL = 'http://127.0.0.1:54321'
export const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
export const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

export function sha256Hex(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export interface SeedSiteOpts {
  orgName?: string
  orgSlug?: string
  parentOrgId?: string | null
  siteName?: string
  siteSlug?: string
  domains?: string[]
  defaultLocale?: string
  brevoNewsletterListId?: number | null
}

/**
 * Seeds a fresh organization + site. Returns both ids so tests can thread them
 * through downstream seed calls and cleanup.
 */
export async function seedSite(
  db: SupabaseClient,
  opts: SeedSiteOpts = {},
): Promise<{ siteId: string; orgId: string }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // RBAC v3 (migration 20260420000001) enforces a single master ring via
  // `organizations_single_master` unique index. When a test calls seedSite()
  // without an explicit parentOrgId, we reuse the existing master ring instead
  // of creating a new one (which would violate the uniqueness constraint and
  // break legacy tests like rpc-confirm-newsletter, rpc-unsubscribe, etc.).
  const wantsMasterRing = opts.parentOrgId === null || opts.parentOrgId === undefined

  let orgId: string
  if (wantsMasterRing) {
    const { data: existingMaster } = await db
      .from('organizations')
      .select('id')
      .is('parent_org_id', null)
      .limit(1)
      .maybeSingle()

    if (existingMaster) {
      orgId = existingMaster.id
    } else {
      const { data: org, error: orgErr } = await db
        .from('organizations')
        .insert({
          name: opts.orgName ?? `Seed Master ${suffix}`,
          slug: opts.orgSlug ?? `seed-master-${suffix}`,
          parent_org_id: null,
        })
        .select('id')
        .single()
      if (orgErr || !org) throw orgErr ?? new Error('seedSite: master org insert failed')
      orgId = org.id
    }
  } else {
    // Child ring — always create fresh (no uniqueness on non-null parent_org_id).
    const { data: org, error: orgErr } = await db
      .from('organizations')
      .insert({
        name: opts.orgName ?? `Seed Org ${suffix}`,
        slug: opts.orgSlug ?? `seed-org-${suffix}`,
        parent_org_id: opts.parentOrgId,
      })
      .select('id')
      .single()
    if (orgErr || !org) throw orgErr ?? new Error('seedSite: child org insert failed')
    orgId = org.id
  }

  // sites.primary_domain became NOT NULL in RBAC v3 migration 8.
  // Always supply a value; use first domain or a synthetic default.
  const domains = opts.domains ?? [`seed-${suffix}.test`]
  const primaryDomain = domains[0] ?? `seed-${suffix}.test`

  const { data: site, error: siteErr } = await db
    .from('sites')
    .insert({
      org_id: orgId,
      name: opts.siteName ?? `Seed Site ${suffix}`,
      slug: opts.siteSlug ?? `seed-site-${suffix}`,
      domains,
      primary_domain: primaryDomain,
      default_locale: opts.defaultLocale ?? 'pt-BR',
      supported_locales: [opts.defaultLocale ?? 'pt-BR'],
      brevo_newsletter_list_id: opts.brevoNewsletterListId ?? null,
    })
    .select('id')
    .single()
  if (siteErr || !site) throw siteErr ?? new Error('seedSite: sites insert failed')

  return { siteId: site.id, orgId }
}

export type StaffRole = 'owner' | 'admin' | 'editor'
// Full org role union (Sprint 2 schema `organization_members.role check`).
export type OrgMemberRole = StaffRole | 'author'
// JWT `app_metadata.role` string accepted by `is_staff()` / `is_admin()`
// (migration 20260414000004) — includes `super_admin` which has no org_members
// row requirement. Kept separate so tests can seed stale/elevated JWTs.
export type JwtAreaRole = OrgMemberRole | 'super_admin' | 'user'

/**
 * Seeds an `organization_members` row for a synthetic user and returns a JWT
 * signed with the local Supabase CLI's default JWT secret. The JWT carries
 * `role: 'authenticated'` + `sub: <userId>` — PostgREST will expose the uid to
 * `auth.uid()` inside RPCs.
 *
 * NOTE: We skip creating an `auth.users` row. The `organization_members.user_id`
 * FK references `auth.users(id)` with `on delete cascade`, so a synthetic uid
 * will violate the FK. Tests that need the membership row must either:
 *   (a) create an auth user via `admin.auth.admin.createUser()` first, or
 *   (b) deliberately seed a membership referencing an existing auth user.
 * The helper below takes the optional `userId` parameter to accommodate (b).
 *
 * The `app_metadata.role` baked into the JWT defaults to the `role` param so
 * `is_staff()` / `is_admin()` — which read from `request.jwt.claims` — see a
 * consistent value. Pass `opts.jwtAppRole` to simulate a stale JWT (e.g. role
 * was demoted in DB but the signed claim still says `editor`).
 */
export async function seedStaffUser(
  db: SupabaseClient,
  orgId: string,
  role: OrgMemberRole = 'admin',
  opts: { userId?: string; email?: string; jwtAppRole?: JwtAreaRole } = {},
): Promise<{ userId: string; jwt: string }> {
  let userId = opts.userId
  if (!userId) {
    const email = opts.email ?? `seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
    // createUser requires admin privileges (service-role client).
    const authAdmin = (db as unknown as {
      auth: { admin: { createUser: (a: { email: string; password: string; email_confirm: boolean }) => Promise<{ data: { user: { id: string } | null }; error: unknown }> } }
    }).auth.admin
    const { data, error } = await authAdmin.createUser({ email, password: 'seed-pw-12345678', email_confirm: true })
    if (error || !data.user) throw error ?? new Error('seedStaffUser: createUser failed')
    userId = data.user.id
  }

  const { error: memberErr } = await db.from('organization_members').insert({
    org_id: orgId,
    user_id: userId,
    role,
  })
  if (memberErr) throw memberErr

  const token = jwt.sign(
    { role: 'authenticated', sub: userId, app_metadata: { role: opts.jwtAppRole ?? role } },
    getLocalJwtSecret(),
    { expiresIn: '1h' },
  )

  return { userId, jwt: token }
}

/**
 * Signs an expired JWT for the given user. Used to exercise the "cookie
 * expired mid-request" middleware branch — Supabase `auth.getUser()` will
 * reject the token server-side and the middleware will treat the request as
 * anonymous (redirect to the area sign-in path).
 */
export function signExpiredUserJwt(userId: string = randomUUID(), role: string = 'editor'): { userId: string; jwt: string } {
  const nowSec = Math.floor(Date.now() / 1000)
  const token = jwt.sign(
    { role: 'authenticated', sub: userId, app_metadata: { role }, iat: nowSec - 7200, exp: nowSec - 3600 },
    getLocalJwtSecret(),
  )
  return { userId, jwt: token }
}

/**
 * Signs a JWT for a synthetic non-member user. No `auth.users` row is created —
 * safe to use against tables that don't FK into `auth.users`.
 */
export function signUserJwt(userId: string = randomUUID(), role: string = 'user'): { userId: string; jwt: string } {
  const token = jwt.sign(
    { role: 'authenticated', sub: userId, app_metadata: { role } },
    getLocalJwtSecret(),
    { expiresIn: '1h' },
  )
  return { userId, jwt: token }
}

export interface SeedPendingSubOpts {
  consentTextVersion?: string
  expiresInMinutes?: number
  locale?: string | null
}

/**
 * Seeds a `pending_confirmation` newsletter subscription. The caller passes a
 * `rawToken` — we hash + store it. Use the same `rawToken` to compute the hash
 * the RPC expects.
 */
export async function seedPendingNewsletterSub(
  db: SupabaseClient,
  siteId: string,
  email: string,
  rawToken: string,
  opts: SeedPendingSubOpts = {},
): Promise<{ subId: string; tokenHash: string }> {
  const tokenHash = sha256Hex(rawToken)
  const expiresAt = new Date(Date.now() + (opts.expiresInMinutes ?? 60) * 60_000).toISOString()

  const { data, error } = await db
    .from('newsletter_subscriptions')
    .insert({
      site_id: siteId,
      email,
      status: 'pending_confirmation',
      confirmation_token_hash: tokenHash,
      confirmation_expires_at: expiresAt,
      consent_text_version: opts.consentTextVersion ?? 'v1',
      locale: opts.locale ?? null,
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('seedPendingNewsletterSub: insert failed')

  return { subId: data.id, tokenHash }
}

/**
 * Seeds an `unsubscribe_tokens` row — hash-only storage, per 20260416000014.
 * Optionally seeds a companion `newsletter_subscriptions` row in `confirmed`
 * state so the RPC's status flip has something to act on.
 */
export async function seedUnsubscribeToken(
  db: SupabaseClient,
  siteId: string,
  email: string,
  rawToken: string,
  opts: { seedConfirmedSub?: boolean } = {},
): Promise<{ tokenHash: string; subId?: string }> {
  const tokenHash = sha256Hex(rawToken)

  const { error } = await db.from('unsubscribe_tokens').insert({
    token_hash: tokenHash,
    site_id: siteId,
    email,
  })
  if (error) throw error

  let subId: string | undefined
  if (opts.seedConfirmedSub) {
    const { data, error: subErr } = await db
      .from('newsletter_subscriptions')
      .insert({
        site_id: siteId,
        email,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        consent_text_version: 'v1',
        brevo_contact_id: 'brevo-seed-1',
      })
      .select('id')
      .single()
    if (subErr || !data) throw subErr ?? new Error('seedUnsubscribeToken: sub insert failed')
    subId = data.id
  }

  return { tokenHash, subId }
}

export interface SeedCampaignOverrides {
  interest?: string
  status?: 'draft' | 'scheduled' | 'published' | 'archived'
  pdfStoragePath?: string | null
  brevoListId?: number | null
  brevoTemplateId?: number | null
  formFields?: unknown[]
}

export async function seedCampaign(
  db: SupabaseClient,
  siteId: string | null,
  overrides: SeedCampaignOverrides = {},
): Promise<{ campaignId: string }> {
  const { data, error } = await db
    .from('campaigns')
    .insert({
      site_id: siteId,
      interest: overrides.interest ?? 'creator',
      status: overrides.status ?? 'draft',
      pdf_storage_path: overrides.pdfStoragePath ?? null,
      brevo_list_id: overrides.brevoListId ?? null,
      brevo_template_id: overrides.brevoTemplateId ?? null,
      form_fields: overrides.formFields ?? [],
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('seedCampaign: insert failed')
  return { campaignId: data.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// RBAC v3 scenario (Sprint 4.75 Track A)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seeds the canonical RBAC v3 test matrix:
 *   - master org (no parent) + child org (parent = master)
 *   - siteA + siteB (both under child org, distinct primary_domain)
 *   - super_admin: org_admin on master → can see/edit everything
 *   - org_admin:   org_admin on child  → can see/edit sites A + B
 *   - editor_a:    site_memberships role=editor on siteA
 *   - reporter_a:  site_memberships role=reporter on siteA
 *   - random:      auth user with zero memberships
 *
 * Returns ids so tests can thread them through assertions. Use together with
 * `signUserJwt(userId)` to mint per-role JWTs and exercise RLS.
 *
 * The helper pushes all created ids into `cleanup` so the caller's afterAll
 * can drop them in a single batch (sites first, then orgs, then users).
 */
export interface RbacScenario {
  orgMasterId: string
  orgChildId: string
  siteAId: string
  siteBId: string
  superAdminId: string
  orgAdminId: string
  editorAId: string
  reporterAId: string
  randomId: string
  /** Per-user author_id — blog_posts.author_id is NOT NULL, so every user that
   * may create posts needs a matching authors row. */
  authorsByUser: Record<string, string>
  cleanup: {
    userIds: string[]
    siteIds: string[]
    orgIds: string[]
    authorIds: string[]
  }
}

export async function seedRbacScenario(admin: SupabaseClient): Promise<RbacScenario> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // NOTE: A unique index enforces a single master ring (parent_org_id IS NULL)
  // across the whole DB. Reuse the existing master if present; otherwise create.
  let orgMasterId: string
  const { data: existingMaster } = await admin
    .from('organizations')
    .select('id')
    .is('parent_org_id', null)
    .limit(1)
    .maybeSingle()
  if (existingMaster) {
    orgMasterId = existingMaster.id
  } else {
    const { data: m, error: mErr } = await admin
      .from('organizations')
      .insert({ name: `RBAC Master ${suffix}`, slug: `rbac-master-${suffix}` })
      .select('id')
      .single()
    if (mErr || !m) throw mErr ?? new Error('seedRbacScenario: master insert failed')
    orgMasterId = m.id
  }

  const { data: child, error: childErr } = await admin
    .from('organizations')
    .insert({
      name: `RBAC Child ${suffix}`,
      slug: `rbac-child-${suffix}`,
      parent_org_id: orgMasterId,
    })
    .select('id')
    .single()
  if (childErr || !child) throw childErr ?? new Error('seedRbacScenario: child insert failed')

  const { data: siteA, error: sAErr } = await admin
    .from('sites')
    .insert({
      org_id: child.id,
      name: `Site A ${suffix}`,
      slug: `site-a-${suffix}`,
      domains: [`a-${suffix}.test`],
      primary_domain: `a-${suffix}.test`,
      default_locale: 'pt-BR',
      supported_locales: ['pt-BR'],
    })
    .select('id')
    .single()
  if (sAErr || !siteA) throw sAErr ?? new Error('seedRbacScenario: siteA insert failed')

  const { data: siteB, error: sBErr } = await admin
    .from('sites')
    .insert({
      org_id: child.id,
      name: `Site B ${suffix}`,
      slug: `site-b-${suffix}`,
      domains: [`b-${suffix}.test`],
      primary_domain: `b-${suffix}.test`,
      default_locale: 'pt-BR',
      supported_locales: ['pt-BR'],
    })
    .select('id')
    .single()
  if (sBErr || !siteB) throw sBErr ?? new Error('seedRbacScenario: siteB insert failed')

  const authAdmin = (admin as unknown as {
    auth: {
      admin: {
        createUser: (a: {
          email: string
          password: string
          email_confirm: boolean
        }) => Promise<{ data: { user: { id: string } | null }; error: unknown }>
      }
    }
  }).auth.admin

  async function createUser(prefix: string): Promise<string> {
    const email = `${prefix}-${suffix}@example.test`
    const { data, error } = await authAdmin.createUser({
      email,
      password: 'seed-pw-12345678',
      email_confirm: true,
    })
    if (error || !data.user) throw error ?? new Error(`seedRbacScenario: createUser(${prefix}) failed`)
    return data.user.id
  }

  const superAdminId = await createUser('su')
  const orgAdminId = await createUser('oa')
  const editorAId = await createUser('ea')
  const reporterAId = await createUser('ra')
  const randomId = await createUser('rn')

  const { error: omMasterErr } = await admin.from('organization_members').insert({
    org_id: orgMasterId,
    user_id: superAdminId,
    role: 'org_admin',
  })
  if (omMasterErr) throw omMasterErr

  const { error: omChildErr } = await admin.from('organization_members').insert({
    org_id: child.id,
    user_id: orgAdminId,
    role: 'org_admin',
  })
  if (omChildErr) throw omChildErr

  const { error: smEditErr } = await admin.from('site_memberships').insert({
    site_id: siteA.id,
    user_id: editorAId,
    role: 'editor',
  })
  if (smEditErr) throw smEditErr

  const { error: smReptErr } = await admin.from('site_memberships').insert({
    site_id: siteA.id,
    user_id: reporterAId,
    role: 'reporter',
  })
  if (smReptErr) throw smReptErr

  // Seed `authors` row per user (blog_posts.author_id is NOT NULL; unique on user_id).
  const authorsByUser: Record<string, string> = {}
  const authorIds: string[] = []
  for (const [label, uid] of [
    ['su', superAdminId],
    ['oa', orgAdminId],
    ['ea', editorAId],
    ['ra', reporterAId],
    ['rn', randomId],
  ] as const) {
    const { data: a, error: aErr } = await admin
      .from('authors')
      .insert({ user_id: uid, name: `${label}-${suffix}`, slug: `${label}-${suffix}` })
      .select('id')
      .single()
    if (aErr || !a) throw aErr ?? new Error(`seedRbacScenario: authors insert ${label} failed`)
    authorsByUser[uid] = a.id
    authorIds.push(a.id)
  }

  return {
    orgMasterId,
    orgChildId: child.id,
    siteAId: siteA.id,
    siteBId: siteB.id,
    superAdminId,
    orgAdminId,
    editorAId,
    reporterAId,
    randomId,
    authorsByUser,
    cleanup: {
      userIds: [superAdminId, orgAdminId, editorAId, reporterAId, randomId],
      siteIds: [siteA.id, siteB.id],
      // Only drop orgs we created — never the shared master.
      orgIds: [child.id],
      authorIds,
    },
  }
}

/**
 * Tears down a scenario created by `seedRbacScenario`. Deletes dependent rows
 * (blog_posts, campaigns, site_memberships, organization_members, invitations,
 * audit_log) before sites/orgs/users so FKs don't block cleanup.
 */
export async function cleanupRbacScenario(
  admin: SupabaseClient,
  scenario: RbacScenario,
): Promise<void> {
  const { cleanup } = scenario
  if (cleanup.siteIds.length) {
    await admin.from('blog_posts').delete().in('site_id', cleanup.siteIds)
    await admin.from('campaigns').delete().in('site_id', cleanup.siteIds)
    await admin.from('site_memberships').delete().in('site_id', cleanup.siteIds)
    await admin.from('contact_submissions').delete().in('site_id', cleanup.siteIds)
    await admin.from('newsletter_subscriptions').delete().in('site_id', cleanup.siteIds)
    await admin.from('audit_log').delete().in('site_id', cleanup.siteIds)
  }
  if (cleanup.authorIds?.length) {
    await admin.from('authors').delete().in('id', cleanup.authorIds)
  }
  if (cleanup.orgIds.length) {
    await admin.from('invitations').delete().in('org_id', cleanup.orgIds)
    await admin.from('organization_members').delete().in('org_id', cleanup.orgIds)
    await admin.from('audit_log').delete().in('org_id', cleanup.orgIds)
  }
  // Users must be deleted via auth admin (cascades auth.users rows).
  const authAdmin = (admin as unknown as {
    auth: {
      admin: { deleteUser: (id: string) => Promise<{ error: unknown }> }
    }
  }).auth.admin
  for (const uid of cleanup.userIds) {
    try {
      await authAdmin.deleteUser(uid)
    } catch {
      /* best-effort — other tests' teardown may race. */
    }
  }
  if (cleanup.siteIds.length) {
    await admin.from('sites').delete().in('id', cleanup.siteIds)
  }
  if (cleanup.orgIds.length) {
    await admin.from('organizations').delete().in('id', cleanup.orgIds)
  }
}
