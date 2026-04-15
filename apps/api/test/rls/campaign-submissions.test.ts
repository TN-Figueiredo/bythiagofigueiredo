import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/local-supabase'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

describe.skipIf(skipIfNoLocalDb())('citext extension', () => {
  it('pg_typeof_citext_probe returns "citext"', async () => {
    const { data, error } = await admin.rpc('pg_typeof_citext_probe')
    expect(error).toBeNull()
    expect(data).toBe('citext')
  })
})

describe.skipIf(skipIfNoLocalDb())('campaign_submissions schema', () => {
  const createdCampaignIds: string[] = []
  const createdSubmissionIds: string[] = []

  afterAll(async () => {
    if (createdSubmissionIds.length > 0) {
      await admin.from('campaign_submissions').delete().in('id', createdSubmissionIds)
    }
    if (createdCampaignIds.length > 0) {
      await admin.from('campaigns').delete().in('id', createdCampaignIds)
    }
  })

  async function makeCampaign(): Promise<string> {
    const { data, error } = await admin
      .from('campaigns')
      .insert({ interest: 'creator' })
      .select('id')
      .single()
    if (error || !data) throw error ?? new Error('campaign insert failed')
    createdCampaignIds.push(data.id)
    return data.id
  }

  it('accepts a minimal submission', async () => {
    const cid = await makeCampaign()
    const { data, error } = await admin
      .from('campaign_submissions')
      .insert({
        campaign_id: cid,
        email: 'Foo@Bar.com',
        locale: 'pt-BR',
        consent_marketing: true,
        consent_text_version: 'v1-2026-04',
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    if (data?.id) createdSubmissionIds.push(data.id)
  })

  it('email is citext (case-insensitive unique)', async () => {
    const cid = await makeCampaign()
    const { data: r1, error: e1 } = await admin
      .from('campaign_submissions')
      .insert({
        campaign_id: cid,
        email: 'Same@X.com',
        locale: 'pt-BR',
        consent_marketing: true,
        consent_text_version: 'v1',
      })
      .select('id')
      .single()
    expect(e1).toBeNull()
    if (r1?.id) createdSubmissionIds.push(r1.id)

    const { error } = await admin.from('campaign_submissions').insert({
      campaign_id: cid,
      email: 'SAME@x.COM',
      locale: 'pt-BR',
      consent_marketing: true,
      consent_text_version: 'v1',
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/duplicate|unique/i)
  })

  it('partial index allows re-signup after anonymization', async () => {
    const cid = await makeCampaign()
    const { data: r1, error: e1 } = await admin
      .from('campaign_submissions')
      .insert({
        campaign_id: cid,
        email: 'anon@x.com',
        locale: 'pt-BR',
        consent_marketing: true,
        consent_text_version: 'v1',
        anonymized_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    expect(e1).toBeNull()
    if (r1?.id) createdSubmissionIds.push(r1.id)

    const { data: r2, error } = await admin
      .from('campaign_submissions')
      .insert({
        campaign_id: cid,
        email: 'anon@x.com',
        locale: 'pt-BR',
        consent_marketing: true,
        consent_text_version: 'v1',
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    if (r2?.id) createdSubmissionIds.push(r2.id)
  })
})
