/**
 * DB-gated integration tests: RBAC v3 matrix (Sprint 4.75 Track A / Task A9).
 *
 * Covers role × operation × site interactions for the new RBAC model:
 *   - super_admin (org_admin on master ring)
 *   - org_admin   (org_admin on child org — governs siteA + siteB)
 *   - editor_a    (site_memberships role=editor on siteA only)
 *   - reporter_a  (site_memberships role=reporter on siteA only)
 *   - random user (zero memberships)
 *
 * All assertions are against blog_posts/campaigns/contact_submissions/
 * newsletter_subscriptions behind the new DB-level policies.
 *
 * Note: blog_posts.author_id is NOT NULL in this codebase (legacy Sprint 2
 * schema). seedRbacScenario seeds one `authors` row per user and exposes
 * authorsByUser[user_id] for tests to thread into inserts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  ANON_KEY,
  SERVICE_KEY,
  seedRbacScenario,
  cleanupRbacScenario,
  signUserJwt,
  type RbacScenario,
} from '../helpers/db-seed'

function clientFor(userId: string): SupabaseClient {
  const { jwt } = signUserJwt(userId)
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}

describe.skipIf(skipIfNoLocalDb())('RBAC v3 matrix', () => {
  let admin: SupabaseClient
  let s: RbacScenario

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    s = await seedRbacScenario(admin)
  })

  afterAll(async () => {
    await cleanupRbacScenario(admin, s)
  })

  // ── Reporter scope ──────────────────────────────────────────────
  it('reporter-A can create draft on site A', async () => {
    const c = clientFor(s.reporterAId)
    const { error } = await c.from('blog_posts').insert({
      site_id: s.siteAId,
      author_id: s.authorsByUser[s.reporterAId],
      status: 'draft',
      owner_user_id: s.reporterAId,
    })
    expect(error).toBeNull()
  })

  it('reporter-A CANNOT create on site B', async () => {
    const c = clientFor(s.reporterAId)
    const { error } = await c.from('blog_posts').insert({
      site_id: s.siteBId,
      author_id: s.authorsByUser[s.reporterAId],
      status: 'draft',
      owner_user_id: s.reporterAId,
    })
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  it('reporter-A CANNOT publish own draft (RLS/trigger blocks)', async () => {
    const c = clientFor(s.reporterAId)
    const ins = await c
      .from('blog_posts')
      .insert({
        site_id: s.siteAId,
        author_id: s.authorsByUser[s.reporterAId],
        status: 'draft',
        owner_user_id: s.reporterAId,
      })
      .select('id')
      .single()
    expect(ins.error).toBeNull()
    const upd = await c
      .from('blog_posts')
      .update({ status: 'published' })
      .eq('id', ins.data!.id)
    // Either RLS filtered WHERE (0 rows updated, error null) or trigger raised.
    const { data: after } = await admin
      .from('blog_posts')
      .select('status')
      .eq('id', ins.data!.id)
      .single()
    expect(after!.status).toBe('draft')
    if (upd.error) expect(['P0001', '42501']).toContain(upd.error.code)
  })

  it('reporter-A cannot INSERT with status=published directly', async () => {
    const c = clientFor(s.reporterAId)
    const { error } = await c.from('blog_posts').insert({
      site_id: s.siteAId,
      author_id: s.authorsByUser[s.reporterAId],
      status: 'published',
      published_at: new Date().toISOString(),
      owner_user_id: s.reporterAId,
    })
    expect(error).not.toBeNull()
    expect(['P0001', '42501']).toContain(error!.code)
  })

  // ── Editor scope ────────────────────────────────────────────────
  it('editor-A can publish on site A', async () => {
    const c = clientFor(s.editorAId)
    const ins = await c
      .from('blog_posts')
      .insert({
        site_id: s.siteAId,
        author_id: s.authorsByUser[s.editorAId],
        status: 'draft',
      })
      .select('id')
      .single()
    expect(ins.error).toBeNull()
    const upd = await c
      .from('blog_posts')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', ins.data!.id)
    expect(upd.error).toBeNull()
    const { data: after } = await admin
      .from('blog_posts')
      .select('status')
      .eq('id', ins.data!.id)
      .single()
    expect(after!.status).toBe('published')
  })

  it('editor-A CANNOT read/write site B drafts', async () => {
    const { data: draft } = await admin
      .from('blog_posts')
      .insert({
        site_id: s.siteBId,
        author_id: s.authorsByUser[s.orgAdminId],
        status: 'draft',
      })
      .select('id')
      .single()
    const c = clientFor(s.editorAId)
    const { data, error } = await c.from('blog_posts').select('id').eq('id', draft!.id)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  // ── Org admin scope (child ring) ────────────────────────────────
  it('org_admin (child) can edit drafts on both site A and site B', async () => {
    const c = clientFor(s.orgAdminId)
    for (const siteId of [s.siteAId, s.siteBId]) {
      const ins = await c
        .from('blog_posts')
        .insert({
          site_id: siteId,
          author_id: s.authorsByUser[s.orgAdminId],
          status: 'draft',
        })
        .select('id')
        .single()
      expect(ins.error).toBeNull()
    }
  })

  it('org_admin can delete published posts in own org', async () => {
    const c = clientFor(s.editorAId)
    const ins = await c
      .from('blog_posts')
      .insert({
        site_id: s.siteAId,
        author_id: s.authorsByUser[s.editorAId],
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    expect(ins.error).toBeNull()
    const oa = clientFor(s.orgAdminId)
    const del = await oa.from('blog_posts').delete().eq('id', ins.data!.id)
    expect(del.error).toBeNull()
    const { data: gone } = await admin
      .from('blog_posts')
      .select('id')
      .eq('id', ins.data!.id)
      .maybeSingle()
    expect(gone).toBeNull()
  })

  // ── Super admin (master ring) ───────────────────────────────────
  it('super_admin can publish on any site', async () => {
    const c = clientFor(s.superAdminId)
    const ins = await c
      .from('blog_posts')
      .insert({
        site_id: s.siteBId,
        author_id: s.authorsByUser[s.superAdminId],
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    expect(ins.error).toBeNull()
  })

  // ── Public / anonymous reads ────────────────────────────────────
  it('random user sees only published posts', async () => {
    await admin.from('blog_posts').insert([
      {
        site_id: s.siteAId,
        author_id: s.authorsByUser[s.orgAdminId],
        status: 'draft',
      },
      {
        site_id: s.siteAId,
        author_id: s.authorsByUser[s.orgAdminId],
        status: 'published',
        published_at: new Date().toISOString(),
      },
    ])
    const c = clientFor(s.randomId)
    const { data, error } = await c
      .from('blog_posts')
      .select('status')
      .eq('site_id', s.siteAId)
    expect(error).toBeNull()
    for (const row of data ?? []) {
      expect(row.status).toBe('published')
    }
  })

  // ── Delete guards ───────────────────────────────────────────────
  it('reporter-A cannot delete published posts', async () => {
    const ec = clientFor(s.editorAId)
    const ins = await ec
      .from('blog_posts')
      .insert({
        site_id: s.siteAId,
        author_id: s.authorsByUser[s.editorAId],
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    expect(ins.error).toBeNull()
    const rp = clientFor(s.reporterAId)
    await rp.from('blog_posts').delete().eq('id', ins.data!.id)
    const { data: still } = await admin
      .from('blog_posts')
      .select('id')
      .eq('id', ins.data!.id)
      .maybeSingle()
    expect(still?.id).toBe(ins.data!.id)
  })

  // ── Contact submissions ─────────────────────────────────────────
  it('contact_submissions visible to editor-A on site A but not site B', async () => {
    const now = Date.now()
    const { error: insErr } = await admin.from('contact_submissions').insert([
      {
        site_id: s.siteAId,
        name: 'Name A',
        email: `ca-${now}@example.test`,
        message: 'hello site A this is a long enough message',
        consent_processing: true,
        consent_processing_text_version: 'v1',
        consent_marketing: false,
      },
      {
        site_id: s.siteBId,
        name: 'Name B',
        email: `cb-${now}@example.test`,
        message: 'hello site B this is a long enough message',
        consent_processing: true,
        consent_processing_text_version: 'v1',
        consent_marketing: false,
      },
    ])
    expect(insErr).toBeNull()
    const c = clientFor(s.editorAId)
    const { data, error } = await c
      .from('contact_submissions')
      .select('site_id')
      .in('site_id', [s.siteAId, s.siteBId])
    expect(error).toBeNull()
    const sites = new Set((data ?? []).map((r) => r.site_id))
    expect(sites.has(s.siteAId)).toBe(true)
    expect(sites.has(s.siteBId)).toBe(false)
  })

  // ── Newsletter subscriptions ────────────────────────────────────
  it('newsletter_subscriptions not visible to editor (org_admin only)', async () => {
    const { error: insErr } = await admin.from('newsletter_subscriptions').insert({
      site_id: s.siteAId,
      email: `nl-${Date.now()}@example.test`,
      status: 'confirmed',
      consent_text_version: 'v1',
      confirmed_at: new Date().toISOString(),
    })
    expect(insErr).toBeNull()
    const c = clientFor(s.editorAId)
    const { data, error } = await c
      .from('newsletter_subscriptions')
      .select('id')
      .eq('site_id', s.siteAId)
    expect(error).toBeNull()
    expect(data).toEqual([])
    const oa = clientFor(s.orgAdminId)
    const { data: oaData, error: oaErr } = await oa
      .from('newsletter_subscriptions')
      .select('id')
      .eq('site_id', s.siteAId)
    expect(oaErr).toBeNull()
    expect((oaData ?? []).length).toBeGreaterThan(0)
  })

  it('campaigns: editor-A can create on siteA, reporter-A cannot', async () => {
    const ec = clientFor(s.editorAId)
    const editorIns = await ec.from('campaigns').insert({
      site_id: s.siteAId,
      interest: 'creator',
      status: 'draft',
    })
    expect(editorIns.error).toBeNull()

    const rp = clientFor(s.reporterAId)
    const reporterIns = await rp.from('campaigns').insert({
      site_id: s.siteAId,
      interest: 'creator',
      status: 'draft',
    })
    expect(reporterIns.error).not.toBeNull()
    expect(['42501', 'P0001']).toContain(reporterIns.error!.code)
  })
})
