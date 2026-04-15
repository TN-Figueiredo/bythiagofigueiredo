import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/local-supabase'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

// Track inserted campaign IDs for cleanup so this suite leaves no shared state.
const createdCampaignIds: string[] = []

describe.skipIf(skipIfNoLocalDb())('campaigns table schema', () => {
  afterAll(async () => {
    if (createdCampaignIds.length > 0) {
      await admin.from('campaigns').delete().in('id', createdCampaignIds)
    }
  })

  it('insert minimal row', async () => {
    const { data, error } = await admin
      .from('campaigns')
      .insert({ interest: 'creator' })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data?.status).toBe('draft')
    expect(data?.form_fields).toEqual([])
    if (data?.id) createdCampaignIds.push(data.id)
  })

  it('reuses post_status enum from Sprint 1a', async () => {
    const { data, error } = await admin
      .from('campaigns')
      .insert({ interest: 'fitness', status: 'scheduled', scheduled_for: new Date().toISOString() })
      .select('id')
      .single()
    expect(error).toBeNull()
    if (data?.id) createdCampaignIds.push(data.id)
  })

  it('rejects invalid status value', async () => {
    const { error } = await admin
      .from('campaigns')
      .insert({ interest: 'style', status: 'bogus' as never })
    expect(error).not.toBeNull()
  })
})
