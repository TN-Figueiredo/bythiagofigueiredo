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
import { Client } from 'pg'
import jwt from 'jsonwebtoken'
import { getLocalJwtSecret } from './db-skip'
import { getSupabaseServiceClient } from '../../lib/supabase/service'

// Direct postgres URL — matches supabase start local defaults.
// Used instead of auth.admin.createUser/deleteUser because CI excludes GoTrue.
const PG_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/**
 * Inserts a row directly into auth.users (bypasses GoTrue, which is excluded
 * in CI via `--exclude gotrue`). Returns the new user's id.
 */
export async function insertAuthUser(email: string, id: string = randomUUID()): Promise<string> {
  const client = new Client({ connectionString: PG_URL })
  await client.connect()
  try {
    await client.query(
      `INSERT INTO auth.users
         (id, instance_id, email, encrypted_password, email_confirmed_at,
          aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       VALUES ($1, '00000000-0000-0000-0000-000000000000', $2, '', now(),
               'authenticated', 'authenticated', '{}', '{}', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [id, email],
    )
  } finally {
    await client.end()
  }
  return id
}

/**
 * Deletes a row directly from auth.users (bypasses GoTrue).
 */
export async function deleteAuthUser(id: string): Promise<void> {
  const client = new Client({ connectionString: PG_URL })
  await client.connect()
  try {
    await client.query('DELETE FROM auth.users WHERE id = $1', [id])
  } finally {
    await client.end()
  }
}

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
 * Creates a real auth user, optionally inserts an organization_members row
 * (RBAC v3: only 'admin'/'owner' map to 'org_admin'; 'editor'/'reporter'/
 * 'author' have no org-level row — they use site_memberships or JWT claims
 * only), and returns a signed JWT for the new user.
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
    userId = await insertAuthUser(email)
  }

  // RBAC v3: organization_members only accepts role='org_admin'. Map legacy
  // roles: admin/owner → org_admin (insert row); editor/reporter/author →
  // no org-level row (site_memberships or JWT-claim-only as needed by the test).
  if (role === 'admin' || role === 'owner') {
    const { error: memberErr } = await db.from('organization_members').insert({
      org_id: orgId,
      user_id: userId,
      role: 'org_admin',
    })
    if (memberErr) throw memberErr
  }

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
  brevoContactId?: string
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

  // brevo_contact_id must be non-null when status flips to 'confirmed'
  // (newsletter_subscriptions_check constraint). Seed with a CI placeholder so
  // confirm_newsletter_subscription can transition without a constraint violation.
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
      brevo_contact_id: opts.brevoContactId ?? 'ci-brevo-placeholder',
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

  async function createUser(prefix: string): Promise<string> {
    const email = `${prefix}-${suffix}@example.test`
    return insertAuthUser(email)
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
  // Delete users directly from auth.users (GoTrue excluded in CI).
  for (const uid of cleanup.userIds) {
    try {
      await deleteAuthUser(uid)
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

// ─────────────────────────────────────────────────────────────────────────────
// LGPD scenario (Sprint 5a Track A)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seeds an LGPD scenario on top of the RBAC v3 scenario. Optionally creates:
 *   - Authed user consents (reporter_a)  — functional granted, analytics denied
 *   - Anonymous consents (random UUID v4) — functional granted
 *   - Pending deletion request for reporter_a
 *   - Pending export request for editor_a
 */
export async function seedLgpdScenario(admin: SupabaseClient, opts?: {
  userWithConsents?: boolean;
  anonymousWithConsents?: boolean;
  pendingDeletion?: boolean;
  pendingExport?: boolean;
}) {
  const rbac = await seedRbacScenario(admin)
  const suffix = randomUUID().slice(0, 8)
  const anonId = randomUUID()

  if (opts?.userWithConsents) {
    await admin.from('consents').insert([
      { user_id: rbac.reporterAId, category: 'cookie_functional', consent_text_id: 'cookie_functional_v1_pt-BR', granted: true },
      { user_id: rbac.reporterAId, category: 'cookie_analytics', consent_text_id: 'cookie_analytics_v1_pt-BR', granted: false },
    ])
  }
  if (opts?.anonymousWithConsents) {
    await admin.from('consents').insert([
      { anonymous_id: anonId, category: 'cookie_functional', consent_text_id: 'cookie_functional_v1_pt-BR', granted: true },
    ])
  }
  let deletionRequestId: string | undefined
  if (opts?.pendingDeletion) {
    const { data } = await admin.from('lgpd_requests').insert({
      user_id: rbac.reporterAId,
      type: 'account_deletion',
      status: 'pending',
      confirmation_token_hash: `test-${suffix}`,
    }).select('id').single()
    deletionRequestId = data?.id
  }
  let exportRequestId: string | undefined
  if (opts?.pendingExport) {
    const { data } = await admin.from('lgpd_requests').insert({
      user_id: rbac.editorAId,
      type: 'data_export',
      status: 'pending',
    }).select('id').single()
    exportRequestId = data?.id
  }
  return { ...rbac, lgpd: { anonymousId: anonId, deletionRequestId, exportRequestId } }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 5b PR-B Phase 2 — blog-post helpers used by enumerator integration test
// (B.14). Unlike the older helpers above (which take an explicit `db` client),
// these instantiate the service-role client internally so the call sites in the
// SEO enumerator test stay terse. RLS-bypass is intentional — the enumerator
// itself uses the service client for the same reason (reads cross-site).
// ─────────────────────────────────────────────────────────────────────────────

export async function seedPublishedPost(
  siteId: string,
  opts: { slug: string; locale: string; title?: string; ownerUserId?: string },
): Promise<{ postId: string; translationId: string }> {
  const supabase = getSupabaseServiceClient()
  const { data: post, error: pe } = await supabase
    .from('blog_posts')
    .insert({
      site_id: siteId,
      status: 'published',
      published_at: new Date(Date.now() - 1000).toISOString(),
      owner_user_id: opts.ownerUserId ?? null,
    })
    .select('id')
    .single()
  if (pe || !post) throw new Error(`seedPublishedPost: ${pe?.message}`)
  const { data: tx, error: te } = await supabase
    .from('blog_translations')
    .insert({
      post_id: post.id,
      locale: opts.locale,
      slug: opts.slug,
      title: opts.title ?? `Post ${opts.slug}`,
      content_mdx: '# Body',
      excerpt: 'excerpt',
      reading_time_min: 1,
      content_toc: [],
    })
    .select('id')
    .single()
  if (te || !tx) throw new Error(`seedPublishedPost translation: ${te?.message}`)
  return { postId: post.id, translationId: tx.id }
}

export async function seedDraftPost(
  siteId: string,
  opts: { slug: string; locale: string; ownerUserId?: string },
): Promise<{ postId: string }> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      site_id: siteId,
      status: 'draft',
      published_at: null,
      owner_user_id: opts.ownerUserId ?? null,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedDraftPost: ${error?.message}`)
  await supabase.from('blog_translations').insert({
    post_id: data.id,
    locale: opts.locale,
    slug: opts.slug,
    title: 'Draft',
    content_mdx: '# Body',
    excerpt: 'x',
    reading_time_min: 1,
    content_toc: [],
  })
  return { postId: data.id }
}

export async function seedFutureScheduledPost(
  siteId: string,
  opts: { slug: string; locale: string; ownerUserId?: string },
): Promise<{ postId: string }> {
  const supabase = getSupabaseServiceClient()
  const future = new Date(Date.now() + 7 * 86400_000).toISOString()
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      site_id: siteId,
      status: 'scheduled',
      published_at: future,
      owner_user_id: opts.ownerUserId ?? null,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedFutureScheduledPost: ${error?.message}`)
  await supabase.from('blog_translations').insert({
    post_id: data.id,
    locale: opts.locale,
    slug: opts.slug,
    title: 'Future',
    content_mdx: '# Body',
    excerpt: 'x',
    reading_time_min: 1,
    content_toc: [],
  })
  return { postId: data.id }
}
