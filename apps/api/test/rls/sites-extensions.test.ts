import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/local-supabase'
import { ensureSharedSites, SHARED_SITE_A_ID } from '../helpers/ring-fixtures'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

describe.skipIf(skipIfNoLocalDb())('sites extensions', () => {
  beforeAll(async () => { await ensureSharedSites(admin) })

  it('brevo_newsletter_list_id and contact_notification_email columns exist', async () => {
    const { data, error } = await admin.from('sites')
      .update({ brevo_newsletter_list_id: 7, contact_notification_email: 'admin@x.com' })
      .eq('id', SHARED_SITE_A_ID)
      .select('brevo_newsletter_list_id, contact_notification_email')
      .single()
    expect(error).toBeNull()
    expect(data?.brevo_newsletter_list_id).toBe(7)
    expect(data?.contact_notification_email).toBe('admin@x.com')
  })
})
