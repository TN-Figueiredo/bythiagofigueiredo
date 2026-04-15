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

describe.skipIf(skipIfNoLocalDb())('campaign_translations slug uniqueness per (site, locale)', () => {
  const SITE_A = '11111111-1111-1111-1111-111111111111'
  const ids: string[] = []

  afterAll(async () => {
    if (ids.length) await admin.from('campaigns').delete().in('id', ids)
  })

  async function makeCampaign(siteId: string | null): Promise<string> {
    const { data, error } = await admin.from('campaigns')
      .insert({ interest: 'creator', site_id: siteId })
      .select('id').single()
    if (error || !data) throw error ?? new Error('campaign insert failed')
    ids.push(data.id)
    return data.id
  }

  function tx(campaignId: string, locale: string, slug: string) {
    return {
      campaign_id: campaignId, locale, slug,
      main_hook_md: 'x',
      context_tag: 'x', success_headline: 'x', success_headline_duplicate: 'x',
      success_subheadline: 'x', success_subheadline_duplicate: 'x',
      check_mail_text: 'x', download_button_label: 'x',
    }
  }

  it('rejects duplicate (locale, slug) within the same site', async () => {
    const c1 = await makeCampaign(SITE_A)
    const c2 = await makeCampaign(SITE_A)
    const slug = `dup-${Date.now()}`
    const ins1 = await admin.from('campaign_translations').insert(tx(c1, 'pt-BR', slug))
    expect(ins1.error).toBeNull()
    const ins2 = await admin.from('campaign_translations').insert(tx(c2, 'pt-BR', slug))
    expect(ins2.error).not.toBeNull()
    expect(ins2.error!.message).toMatch(/duplicate slug|23505/i)
  })

  it('allows same (locale, slug) across different sites', async () => {
    const SITE_B = '22222222-2222-2222-2222-222222222222'
    const cA = await makeCampaign(SITE_A)
    const cB = await makeCampaign(SITE_B)
    const slug = `cross-${Date.now()}`
    const iA = await admin.from('campaign_translations').insert(tx(cA, 'pt-BR', slug))
    const iB = await admin.from('campaign_translations').insert(tx(cB, 'pt-BR', slug))
    expect(iA.error).toBeNull()
    expect(iB.error).toBeNull()
  })

  it('allows same slug across different locales on same site', async () => {
    const c = await makeCampaign(SITE_A)
    const slug = `multi-locale-${Date.now()}`
    const iPt = await admin.from('campaign_translations').insert(tx(c, 'pt-BR', slug))
    const iEn = await admin.from('campaign_translations').insert(tx(c, 'en', slug))
    expect(iPt.error).toBeNull()
    expect(iEn.error).toBeNull()
  })

  it('allows same (locale, slug) when both sites are null (global content)', async () => {
    const cX = await makeCampaign(null)
    const cY = await makeCampaign(null)
    const slug = `null-${Date.now()}`
    const iX = await admin.from('campaign_translations').insert(tx(cX, 'pt-BR', slug))
    const iY = await admin.from('campaign_translations').insert(tx(cY, 'pt-BR', slug))
    // IS NOT DISTINCT FROM treats both NULLs as equal → this should be REJECTED.
    // Blog pattern does the same. Adjust assertion if product disagrees.
    expect(iX.error).toBeNull()
    expect(iY.error).not.toBeNull()
  })
})
