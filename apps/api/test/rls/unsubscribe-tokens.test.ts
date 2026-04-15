import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/local-supabase'
import { ensureSharedSites, SHARED_SITE_A_ID } from '../helpers/ring-fixtures'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

function hexToken(seed: string): string {
  return seed.padEnd(64, '0')
}

describe.skipIf(skipIfNoLocalDb())('unsubscribe_tokens + unsubscribe_via_token RPC', () => {
  const subIds: string[] = []
  beforeAll(async () => { await ensureSharedSites(admin) })
  afterAll(async () => {
    // clean up unsubscribe_tokens (cascade not set — delete by known tokens)
    await admin.from('unsubscribe_tokens').delete().eq('site_id', SHARED_SITE_A_ID)
    if (subIds.length) await admin.from('newsletter_subscriptions').delete().in('id', subIds)
  })

  it('RPC with non-existent token returns not_found', async () => {
    const t = hexToken('deadbeef')
    const { data, error } = await admin.rpc('unsubscribe_via_token', { p_token: t })
    expect(error).toBeNull()
    expect(data.ok).toBe(false)
    expect(data.error).toBe('not_found')
  })

  it('insert token + RPC flips newsletter subscription to unsubscribed', async () => {
    const email = 'unsub-rpc@x.com'
    const t = hexToken('aabbccdd')

    // Create newsletter subscription first
    const { data: sub } = await admin.from('newsletter_subscriptions').insert({
      site_id: SHARED_SITE_A_ID, email,
      status: 'pending_confirmation',
      confirmation_token: hexToken('sub-token-1'),
      confirmation_expires_at: new Date(Date.now() + 86400_000).toISOString(),
      consent_text_version: 'v1',
    }).select('id').single()
    if (sub?.id) subIds.push(sub.id)

    // Create unsubscribe token via service role
    await admin.from('unsubscribe_tokens').insert({
      token: t, site_id: SHARED_SITE_A_ID, email,
    })

    // Call RPC
    const { data, error } = await admin.rpc('unsubscribe_via_token', { p_token: t })
    expect(error).toBeNull()
    expect(data.ok).toBe(true)
    expect(data.email).toBe(email)

    // Verify subscription status changed
    const { data: updated } = await admin.from('newsletter_subscriptions')
      .select('status').eq('id', sub!.id).single()
    expect(updated?.status).toBe('unsubscribed')
  })

  it('second RPC call with same token returns ok + already=true (idempotent)', async () => {
    const email = 'unsub-idempotent@x.com'
    const t = hexToken('11223344')

    const { data: sub2 } = await admin.from('newsletter_subscriptions').insert({
      site_id: SHARED_SITE_A_ID, email,
      status: 'pending_confirmation',
      confirmation_token: hexToken('sub-token-2'),
      confirmation_expires_at: new Date(Date.now() + 86400_000).toISOString(),
      consent_text_version: 'v1',
    }).select('id').single()
    if (sub2?.id) subIds.push(sub2.id)

    await admin.from('unsubscribe_tokens').insert({
      token: t, site_id: SHARED_SITE_A_ID, email,
    })

    // First call
    await admin.rpc('unsubscribe_via_token', { p_token: t })

    // Second call — should be idempotent
    const { data, error } = await admin.rpc('unsubscribe_via_token', { p_token: t })
    expect(error).toBeNull()
    expect(data.ok).toBe(true)
    expect(data.already).toBe(true)
  })
})
