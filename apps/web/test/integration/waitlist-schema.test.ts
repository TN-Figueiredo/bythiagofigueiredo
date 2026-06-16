import { describe, it, expect, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('waitlist schema', () => {
  const createdWaitlists: string[] = []
  afterEach(async () => {
    if (createdWaitlists.length) {
      await db.from('waitlists').delete().in('id', createdWaitlists) // cascades signups
      createdWaitlists.length = 0
    }
  })

  it('rejects a signup row with consent_launch_notification=false (only that field invalid)', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'schema-test', name: 'Schema Test', status: 'open' })
      .select('id, site_id').single()
    createdWaitlists.push(wl!.id)
    const bad = await db.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'valid@b.com',
      consent_launch_notification: false, consent_text_version: 'v1',
    })
    expect(bad.error?.code).toBe('23514') // check_violation
    expect(bad.error?.message ?? '').toContain('consent_required')
  })

  it('enforces the partial unique index on (waitlist_id, email) where not anonymized', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'dup-test', name: 'Dup', status: 'open' })
      .select('id, site_id').single()
    createdWaitlists.push(wl!.id)
    const base = { waitlist_id: wl!.id, site_id: wl!.site_id, consent_launch_notification: true, consent_text_version: 'v1' }
    const first = await db.from('waitlist_signups').insert({ ...base, email: 'dup@x.com' })
    expect(first.error).toBeNull()
    const second = await db.from('waitlist_signups').insert({ ...base, email: 'dup@x.com' })
    expect(second.error?.code).toBe('23505') // unique_violation
  })

  it('rejects a signup whose site_id desyncs from its parent waitlist (composite FK)', async () => {
    const a = await seedSite(db)
    const b = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: a.siteId, slug: 'fk-desync', name: 'FK', status: 'open' })
      .select('id, site_id').single()
    createdWaitlists.push(wl!.id)
    const bad = await db.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: b.siteId, email: 'x@desync.com',
      consent_launch_notification: true, consent_text_version: 'v1',
    })
    expect(bad.error?.code).toBe('23503') // foreign_key_violation
  })

  it('treats email case-insensitively (citext) in the dedupe index', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'ci-dup', name: 'CI', status: 'open' })
      .select('id, site_id').single()
    createdWaitlists.push(wl!.id)
    const base = { waitlist_id: wl!.id, site_id: wl!.site_id, consent_launch_notification: true, consent_text_version: 'v1' }
    expect((await db.from('waitlist_signups').insert({ ...base, email: 'Mixed@Case.com' })).error).toBeNull()
    expect((await db.from('waitlist_signups').insert({ ...base, email: 'mixed@case.com' })).error?.code).toBe('23505')
  })

  it('allows re-signup of the same email after the prior row is anonymized (partial index)', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'anon-reuse', name: 'AR', status: 'open' })
      .select('id, site_id').single()
    createdWaitlists.push(wl!.id)
    const base = { waitlist_id: wl!.id, site_id: wl!.site_id, consent_launch_notification: true, consent_text_version: 'v1', email: 'reuse@x.com' }
    const first = await db.from('waitlist_signups').insert(base).select('id').single()
    expect(first.error).toBeNull()
    await db.from('waitlist_signups').update({ anonymized_at: new Date().toISOString() }).eq('id', first.data!.id)
    expect((await db.from('waitlist_signups').insert(base)).error).toBeNull()
  })

  it('rejects an invalid waitlists.status (status enum CHECK)', async () => {
    const { siteId } = await seedSite(db)
    const r = await db.from('waitlists').insert({ site_id: siteId, slug: 'bad-status', name: 'X', status: 'bogus' })
    expect(r.error?.code).toBe('23514')
  })

  it('enforces unique (waitlist_id, locale) on waitlist_translations', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'tx-uniq', name: 'TX', status: 'open' })
      .select('id').single()
    createdWaitlists.push(wl!.id)
    const first = await db.from('waitlist_translations').insert({ waitlist_id: wl!.id, locale: 'pt-BR', consent_label: 'a' })
    expect(first.error).toBeNull()
    const second = await db.from('waitlist_translations').insert({ waitlist_id: wl!.id, locale: 'pt-BR', consent_label: 'b' })
    expect(second.error?.code).toBe('23505')
  })

  it('bumps updated_at on UPDATE via trg_waitlists_set_updated_at', async () => {
    // Locks the updated_at trigger wired in migration 000001. A future edit that
    // drops/renames the trigger, or a tg_set_updated_at that stops touching this
    // table, would otherwise ship green (zero prior coverage of this surface item).
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'upd-trg', name: 'U', status: 'draft' })
      .select('id, updated_at').single()
    createdWaitlists.push(wl!.id)
    await new Promise((r) => setTimeout(r, 10))
    await db.from('waitlists').update({ name: 'U2' }).eq('id', wl!.id)
    const { data: after } = await db.from('waitlists').select('updated_at').eq('id', wl!.id).single()
    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(new Date(wl!.updated_at).getTime())
  })

  it('enforces the signup data-integrity CHECKs', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'checks', name: 'C', status: 'open' })
      .select('id, site_id').single()
    createdWaitlists.push(wl!.id)
    const base = { waitlist_id: wl!.id, site_id: wl!.site_id, consent_launch_notification: true, consent_text_version: 'v1' }
    // email too short (<5)
    expect((await db.from('waitlist_signups').insert({ ...base, email: 'a@b' })).error?.code).toBe('23514')
    // suppressed without suppressed_at
    expect((await db.from('waitlist_signups').insert({ ...base, email: 'a@coherent.com', status: 'suppressed' })).error?.code).toBe('23514')
    // invalid source_surface
    expect((await db.from('waitlist_signups').insert({ ...base, email: 'a@src.com', source_surface: 'bogus' })).error?.code).toBe('23514')
    // invalid suppression_reason (coherent status+ts, bad enum)
    expect((await db.from('waitlist_signups').insert({ ...base, email: 'a@reason.com', status: 'suppressed', suppressed_at: new Date().toISOString(), suppression_reason: 'nope' })).error?.code).toBe('23514')
  })
})
