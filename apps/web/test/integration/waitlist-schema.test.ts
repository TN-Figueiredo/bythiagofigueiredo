import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('waitlist schema', () => {
  it('rejects a signup row with consent_launch_notification=false (only that field invalid)', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'schema-test', name: 'Schema Test', status: 'open' })
      .select('id, site_id').single()
    const bad = await db.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'valid@b.com',
      consent_launch_notification: false, consent_text_version: 'v1',
    })
    expect(bad.error?.code).toBe('23514') // check_violation
    expect(bad.error?.message ?? '').toContain('consent_required')
    await db.from('waitlists').delete().eq('id', wl!.id)
  })

  it('enforces the partial unique index on (waitlist_id, email) where not anonymized', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'dup-test', name: 'Dup', status: 'open' })
      .select('id, site_id').single()
    const base = { waitlist_id: wl!.id, site_id: wl!.site_id, consent_launch_notification: true, consent_text_version: 'v1' }
    const first = await db.from('waitlist_signups').insert({ ...base, email: 'dup@x.com' })
    expect(first.error).toBeNull()
    const second = await db.from('waitlist_signups').insert({ ...base, email: 'dup@x.com' })
    expect(second.error?.code).toBe('23505') // unique_violation
    await db.from('waitlists').delete().eq('id', wl!.id) // cascades signups
  })
})
