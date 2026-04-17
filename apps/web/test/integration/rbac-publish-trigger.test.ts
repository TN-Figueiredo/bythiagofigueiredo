/**
 * DB-gated integration tests for the enforce_publish_permission trigger
 * (Sprint 4.75 Track A / Task A10).
 *
 * The trigger fires BEFORE INSERT/UPDATE on blog_posts + campaigns and raises
 * P0001 with HINT='requires_editor_role' when a caller lacking
 * public.can_publish_site(site_id) tries to set status in ('published','scheduled').
 *
 * Note: blog_posts.author_id is NOT NULL and has no title/slug column in
 * this codebase — see rbac-matrix.test.ts for the schema caveat.
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

describe.skipIf(skipIfNoLocalDb())('RBAC v3 publish-permission trigger', () => {
  let admin: SupabaseClient
  let s: RbacScenario

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    s = await seedRbacScenario(admin)
  })

  afterAll(async () => {
    await cleanupRbacScenario(admin, s)
  })

  it('reporter INSERT with status=published is blocked', async () => {
    const c = clientFor(s.reporterAId)
    const { error } = await c.from('blog_posts').insert({
      site_id: s.siteAId,
      author_id: s.authorsByUser[s.reporterAId],
      status: 'published',
      published_at: new Date().toISOString(),
      owner_user_id: s.reporterAId,
    })
    expect(error).not.toBeNull()
    // Either RLS (42501) OR trigger (P0001) fires; both are correct fail-closed.
    expect(['P0001', '42501']).toContain(error!.code)
  })

  it('editor UPDATE draft → published is allowed', async () => {
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
  })

  it('super_admin bypass: INSERT status=published succeeds on any site', async () => {
    const c = clientFor(s.superAdminId)
    const ins = await c.from('blog_posts').insert({
      site_id: s.siteBId,
      author_id: s.authorsByUser[s.superAdminId],
      status: 'published',
      published_at: new Date().toISOString(),
    })
    expect(ins.error).toBeNull()
  })

  it('reporter UPDATE draft → draft (no status change) is not blocked', async () => {
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
      .update({ cover_image_url: 'https://example.test/x.png' })
      .eq('id', ins.data!.id)
    expect(upd.error).toBeNull()
  })

  it('status=scheduled is also blocked for reporters', async () => {
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
    await c
      .from('blog_posts')
      .update({ status: 'scheduled', scheduled_for: new Date(Date.now() + 86400000).toISOString() })
      .eq('id', ins.data!.id)
    // Either RLS filtered out the row (no-op) or trigger raised; DB must still say draft.
    const { data: after } = await admin
      .from('blog_posts')
      .select('status')
      .eq('id', ins.data!.id)
      .single()
    expect(after!.status).toBe('draft')
  })

  it('draft → pending_review allowed for reporter (owned)', async () => {
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
      .update({ status: 'pending_review' })
      .eq('id', ins.data!.id)
    expect(upd.error).toBeNull()
    const { data: after } = await admin
      .from('blog_posts')
      .select('status')
      .eq('id', ins.data!.id)
      .single()
    expect(after!.status).toBe('pending_review')
  })

  it('editor direct INSERT status=published on siteA is allowed', async () => {
    const c = clientFor(s.editorAId)
    const ins = await c.from('blog_posts').insert({
      site_id: s.siteAId,
      author_id: s.authorsByUser[s.editorAId],
      status: 'published',
      published_at: new Date().toISOString(),
    })
    expect(ins.error).toBeNull()
  })
})
