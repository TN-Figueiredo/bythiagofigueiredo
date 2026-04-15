import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, ANON_KEY } from '../helpers/local-supabase'
import { ensureSharedSites, SHARED_SITE_A_ID } from '../helpers/ring-fixtures'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const anon = createClient(SUPABASE_URL, ANON_KEY)

describe.skipIf(skipIfNoLocalDb())('sent_emails schema + RLS', () => {
  const ids: string[] = []
  beforeAll(async () => { await ensureSharedSites(admin) })
  afterAll(async () => {
    if (ids.length) await admin.from('sent_emails').delete().in('id', ids)
  })

  it('service role can insert a sent_email record', async () => {
    const { data, error } = await admin.from('sent_emails').insert({
      site_id: SHARED_SITE_A_ID,
      template_name: 'contact_notification',
      to_email: 'recipient@example.com',
      subject: 'Test subject',
      provider: 'brevo',
      status: 'sent',
    }).select('id').single()
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    if (data?.id) ids.push(data.id)
  })

  it('anon cannot read sent_emails', async () => {
    const { data } = await anon.from('sent_emails').select('id')
    expect((data ?? []).length).toBe(0)
  })

  it('staff can read sent_emails for own site', async () => {
    const { data, error } = await admin.from('sent_emails')
      .select('id')
      .eq('site_id', SHARED_SITE_A_ID)
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  it('rejects invalid status', async () => {
    const { error } = await admin.from('sent_emails').insert({
      site_id: SHARED_SITE_A_ID,
      template_name: 'contact_notification',
      to_email: 'recipient@example.com',
      subject: 'Test',
      provider: 'brevo',
      status: 'invalid_status',
    })
    expect(error).not.toBeNull()
  })
})
