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

describe.skipIf(skipIfNoLocalDb())('campaign_translations FK cascade', () => {
  it('deleting a campaign cascades to its translations', async () => {
    const { data: c, error: cErr } = await admin
      .from('campaigns').insert({ interest: 'creator' }).select('id').single()
    expect(cErr).toBeNull()

    const baseTx = {
      campaign_id: c!.id, locale: 'pt-BR', slug: `cascade-${Date.now()}`,
      main_hook_md: '# hi',
      context_tag: 'OK', success_headline: 'a', success_headline_duplicate: 'b',
      success_subheadline: 'c', success_subheadline_duplicate: 'd',
      check_mail_text: 'e', download_button_label: 'f',
    }
    const { data: t, error: tErr } = await admin
      .from('campaign_translations').insert(baseTx).select('id').single()
    expect(tErr).toBeNull()
    const translationId = t!.id

    // Delete the parent campaign.
    const { error: delErr } = await admin.from('campaigns').delete().eq('id', c!.id)
    expect(delErr).toBeNull()

    // The translation must be gone.
    const { data: after, error: afterErr } = await admin
      .from('campaign_translations').select('id').eq('id', translationId)
    expect(afterErr).toBeNull()
    expect(after).toEqual([])
  })
})
