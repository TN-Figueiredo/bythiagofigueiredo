import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, ANON_KEY } from '../helpers/local-supabase'
import { makeCampaign, type CampaignFixtureOptions } from '../helpers/campaign-fixtures'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const anon = createClient(SUPABASE_URL, ANON_KEY)

describe.skipIf(skipIfNoLocalDb())('campaign_submissions anon insert requires published campaign', () => {
  const campaignIds: string[] = []
  afterAll(async () => {
    if (campaignIds.length) await admin.from('campaigns').delete().in('id', campaignIds)
  })

  const makeCampaignHere = (overrides: CampaignFixtureOptions = {}) =>
    makeCampaign(admin, campaignIds, overrides)

  it('anon insert rejected when campaign is draft', async () => {
    const cid = await makeCampaignHere({ status: 'draft' })
    const { error } = await anon.from('campaign_submissions').insert({
      campaign_id: cid, email: `d${Date.now()}@x.com`, locale: 'pt-BR',
      consent_marketing: true, consent_text_version: 'v1',
    })
    expect(error).not.toBeNull()
  })

  it('anon insert rejected when campaign is scheduled in the future', async () => {
    const cid = await makeCampaignHere({
      status: 'scheduled',
      scheduled_for: new Date(Date.now() + 60_000).toISOString(),
    })
    const { error } = await anon.from('campaign_submissions').insert({
      campaign_id: cid, email: `s${Date.now()}@x.com`, locale: 'pt-BR',
      consent_marketing: true, consent_text_version: 'v1',
    })
    expect(error).not.toBeNull()
  })

  it('anon insert rejected when published_at is in the future', async () => {
    const cid = await makeCampaignHere({
      status: 'published',
      published_at: new Date(Date.now() + 60_000).toISOString(),
    })
    const { error } = await anon.from('campaign_submissions').insert({
      campaign_id: cid, email: `f${Date.now()}@x.com`, locale: 'pt-BR',
      consent_marketing: true, consent_text_version: 'v1',
    })
    expect(error).not.toBeNull()
  })

  it('anon insert accepted when campaign is published in the past', async () => {
    const cid = await makeCampaignHere({
      status: 'published',
      published_at: new Date(Date.now() - 60_000).toISOString(),
    })
    const { error } = await anon.from('campaign_submissions').insert({
      campaign_id: cid, email: `p${Date.now()}@x.com`, locale: 'pt-BR',
      consent_marketing: true, consent_text_version: 'v1',
    })
    expect(error).toBeNull()
  })
})

describe.skipIf(skipIfNoLocalDb())('consent trigger covers UPDATE', () => {
  const campaignIds: string[] = []
  const submissionIds: string[] = []
  afterAll(async () => {
    if (submissionIds.length) await admin.from('campaign_submissions').delete().in('id', submissionIds)
    if (campaignIds.length) await admin.from('campaigns').delete().in('id', campaignIds)
  })

  it('rejects UPDATE that sets consent_marketing=false', async () => {
    const { data: c } = await admin.from('campaigns').insert({
      interest: 'creator', status: 'published',
      published_at: new Date(Date.now() - 60_000).toISOString(),
    }).select('id').single()
    campaignIds.push(c!.id)

    const { data: s, error: e1 } = await admin.from('campaign_submissions').insert({
      campaign_id: c!.id, email: `u${Date.now()}@x.com`, locale: 'pt-BR',
      consent_marketing: true, consent_text_version: 'v1',
    }).select('id').single()
    expect(e1).toBeNull()
    submissionIds.push(s!.id)

    const { error } = await admin.from('campaign_submissions')
      .update({ consent_marketing: false })
      .eq('id', s!.id)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/consent/i)
  })
})
