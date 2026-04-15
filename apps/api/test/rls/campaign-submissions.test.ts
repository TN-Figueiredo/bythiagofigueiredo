import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, ANON_KEY } from '../helpers/local-supabase'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const anon = createClient(SUPABASE_URL, ANON_KEY)

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

describe.skipIf(skipIfNoLocalDb())('campaign_submissions RLS + consent trigger', () => {
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

  it('anon can insert with consent=true', async () => {
    const cid = await makeCampaign()
    const { error } = await anon.from('campaign_submissions').insert({
      campaign_id: cid,
      email: `a${Date.now()}@x.com`,
      locale: 'pt-BR',
      consent_marketing: true,
      consent_text_version: 'v1',
    })
    expect(error).toBeNull()
    // Submission inserted by anon — RLS hides it from select, so recover via admin for cleanup.
    const { data: rows } = await admin
      .from('campaign_submissions')
      .select('id')
      .eq('campaign_id', cid)
    ;(rows ?? []).forEach((r) => createdSubmissionIds.push(r.id))
  })

  it('trigger rejects consent=false', async () => {
    const cid = await makeCampaign()
    const { error } = await anon.from('campaign_submissions').insert({
      campaign_id: cid,
      email: `b${Date.now()}@x.com`,
      locale: 'pt-BR',
      consent_marketing: false,
      consent_text_version: 'v1',
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/consent/i)
  })

  it('anon cannot read submissions', async () => {
    const { data } = await anon.from('campaign_submissions').select('id')
    expect((data ?? []).length).toBe(0)
  })

  it('service role reads and updates freely', async () => {
    const cid = await makeCampaign()
    const { data: ins, error: iErr } = await admin
      .from('campaign_submissions')
      .insert({
        campaign_id: cid,
        email: `sr${Date.now()}@x.com`,
        locale: 'pt-BR',
        consent_marketing: true,
        consent_text_version: 'v1',
      })
      .select('id')
      .single()
    expect(iErr).toBeNull()
    if (ins?.id) createdSubmissionIds.push(ins.id)

    const { error } = await admin
      .from('campaign_submissions')
      .update({ brevo_sync_status: 'synced', brevo_synced_at: new Date().toISOString() })
      .eq('id', ins!.id)
    expect(error).toBeNull()
  })
})
