import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/local-supabase'
import { ensureSharedSites, SHARED_RING_ORG_ID } from '../helpers/ring-fixtures'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const SEED_USER = '00000000-0000-0000-0000-000000000001'

describe.skipIf(skipIfNoLocalDb())('invitations schema + RPCs', () => {
  const inviteIds: string[] = []
  beforeAll(async () => { await ensureSharedSites(admin) })
  afterAll(async () => {
    if (inviteIds.length) await admin.from('invitations').delete().in('id', inviteIds)
  })

  it('insert minimal invitation', async () => {
    const token = 'a'.repeat(64)
    const { data, error } = await admin.from('invitations').insert({
      email: 'invitee@example.com', org_id: SHARED_RING_ORG_ID,
      role: 'editor', token, invited_by: SEED_USER,
    }).select().single()
    expect(error).toBeNull()
    expect(data?.expires_at).toBeTruthy()
    if (data?.id) inviteIds.push(data.id)
  })

  it('rejects malformed token (not 64 hex chars)', async () => {
    const { error } = await admin.from('invitations').insert({
      email: 'x@y.com', org_id: SHARED_RING_ORG_ID,
      role: 'editor', token: 'short', invited_by: SEED_USER,
    })
    expect(error).not.toBeNull()
  })

  it('rejects invalid role', async () => {
    const token = 'b'.repeat(64)
    const { error } = await admin.from('invitations').insert({
      email: 'x@y.com', org_id: SHARED_RING_ORG_ID,
      role: 'nonexistent', token, invited_by: SEED_USER,
    })
    expect(error).not.toBeNull()
  })

  it('partial unique on (org_id, email) WHERE pending', async () => {
    const t1 = 'c'.repeat(64), t2 = 'd'.repeat(64)
    const a = await admin.from('invitations').insert({
      email: 'dup@example.com', org_id: SHARED_RING_ORG_ID,
      role: 'editor', token: t1, invited_by: SEED_USER,
    }).select('id').single()
    if (a.data?.id) inviteIds.push(a.data.id)
    expect(a.error).toBeNull()
    const b = await admin.from('invitations').insert({
      email: 'dup@example.com', org_id: SHARED_RING_ORG_ID,
      role: 'editor', token: t2, invited_by: SEED_USER,
    })
    expect(b.error).not.toBeNull()
  })

  it('get_invitation_by_token RPC returns minimal info', async () => {
    const token = 'e'.repeat(64)
    const ins = await admin.from('invitations').insert({
      email: 'rpc@example.com', org_id: SHARED_RING_ORG_ID,
      role: 'author', token, invited_by: SEED_USER,
    }).select('id').single()
    if (ins.data?.id) inviteIds.push(ins.data.id)
    const { data, error } = await admin.rpc('get_invitation_by_token', { p_token: token })
    expect(error).toBeNull()
    expect(data?.email).toBe('rpc@example.com')
    expect(data?.role).toBe('author')
    expect(data?.expired).toBe(false)
  })

  it('get_invitation_by_token returns expired=true for past expires_at', async () => {
    const token = 'f'.repeat(64)
    const ins = await admin.from('invitations').insert({
      email: 'expired@example.com', org_id: SHARED_RING_ORG_ID,
      role: 'editor', token, invited_by: SEED_USER,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    }).select('id').single()
    if (ins.data?.id) inviteIds.push(ins.data.id)
    const { data } = await admin.rpc('get_invitation_by_token', { p_token: token })
    expect(data?.expired).toBe(true)
  })
})

describe.skipIf(skipIfNoLocalDb())('invitations rate limit', () => {
  const inviteIds: string[] = []
  afterAll(async () => {
    if (inviteIds.length) await admin.from('invitations').delete().in('id', inviteIds)
  })

  it('rejects 21st invite within 1 hour from same admin', async () => {
    // Create 20 first
    for (let i = 0; i < 20; i++) {
      const token = (i.toString(16).padStart(2, '0')).repeat(32)
      const { data } = await admin.from('invitations').insert({
        email: `bulk${i}@example.com`, org_id: SHARED_RING_ORG_ID,
        role: 'editor', token, invited_by: SEED_USER,
      }).select('id').single()
      if (data?.id) inviteIds.push(data.id)
    }
    // 21st should fail
    const token = '21212121'.repeat(8)
    const { error } = await admin.from('invitations').insert({
      email: 'overflow@example.com', org_id: SHARED_RING_ORG_ID,
      role: 'editor', token, invited_by: SEED_USER,
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/rate_limit/i)
  })
})
