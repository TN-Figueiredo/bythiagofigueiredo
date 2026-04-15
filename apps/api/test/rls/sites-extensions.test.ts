import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/local-supabase'
import { ensureSharedSites, SHARED_RING_ORG_ID } from '../helpers/ring-fixtures'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

describe.skipIf(skipIfNoLocalDb())('sites extensions', () => {
  // Use a per-test temporary site so SHARED_SITE_A_ID is not mutated.
  let tempSiteId: string | null = null

  beforeAll(async () => {
    await ensureSharedSites(admin)
    // Create a temporary site for mutation tests
    const { data, error } = await admin.from('sites').insert({
      org_id: SHARED_RING_ORG_ID,
      name: 'Temp Sites Extension Test',
      slug: `sites-ext-test-${Date.now()}`,
      domains: [],
      default_locale: 'pt-BR',
      supported_locales: ['pt-BR'],
    }).select('id').single()
    if (error || !data) throw error ?? new Error('temp site insert failed')
    tempSiteId = data.id
  })

  afterAll(async () => {
    if (tempSiteId) {
      await admin.from('sites').delete().eq('id', tempSiteId)
    }
  })

  it('brevo_newsletter_list_id and contact_notification_email columns exist', async () => {
    const { data, error } = await admin.from('sites')
      .update({ brevo_newsletter_list_id: 7, contact_notification_email: 'admin@x.com' })
      .eq('id', tempSiteId!)
      .select('brevo_newsletter_list_id, contact_notification_email')
      .single()
    expect(error).toBeNull()
    expect(data?.brevo_newsletter_list_id).toBe(7)
    expect(data?.contact_notification_email).toBe('admin@x.com')
  })
})
