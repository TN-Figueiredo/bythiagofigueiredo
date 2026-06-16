import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, ANON_KEY, seedSite, signUserJwt } from '../helpers/db-seed'

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('audit_log append-only RLS', () => {
  let rowId: string

  beforeAll(async () => {
    const { siteId, orgId } = await seedSite(svc)
    const { data, error } = await svc
      .from('audit_log')
      .insert({
        actor_user_id: null,
        action: 'test_seed',
        resource_type: 'test',
        resource_id: null,
        org_id: orgId,
        site_id: siteId,
        after_data: { seeded: true },
      })
      .select('id')
      .single()
    if (error || !data) throw error ?? new Error('audit_log seed failed')
    rowId = data.id
  })

  it('authenticated editor cannot UPDATE an audit_log row (no UPDATE policy)', async () => {
    const { jwt } = signUserJwt(undefined, 'editor')
    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data, error } = await authed
      .from('audit_log')
      .update({ action: 'tampered' })
      .eq('id', rowId)
      .select('id')
    // RLS blocks the update — expect 0 rows back and no error (PostgREST silently filters)
    expect(error).toBeNull()
    expect((data ?? []).length).toBe(0)
    // Verify the row truly wasn't mutated (not just filtered from the update response)
    const { data: row } = await svc.from('audit_log').select('action').eq('id', rowId).single()
    expect(row?.action).toBe('test_seed')
  })

  it('authenticated editor cannot DELETE an audit_log row (no DELETE policy)', async () => {
    const { jwt } = signUserJwt(undefined, 'editor')
    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data, error } = await authed
      .from('audit_log')
      .delete()
      .eq('id', rowId)
      .select('id')
    // RLS blocks the delete — expect 0 rows back and no error
    expect(error).toBeNull()
    expect((data ?? []).length).toBe(0)
    // Verify the row truly still exists (not just filtered from the delete response)
    const { data: row } = await svc.from('audit_log').select('action').eq('id', rowId).single()
    expect(row?.action).toBe('test_seed')
  })
})
