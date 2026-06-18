/**
 * DB-gated test for the atomic create_waitlist_with_translation RPC (WL-09): the waitlist
 * row + its default-locale translation are created together, and a slug collision creates
 * NEITHER (the function rolls itself back and reports slug_taken as data).
 *
 * Run: npm run db:reset && HAS_LOCAL_DB=1 npx vitest run test/integration/waitlist-create-rpc.test.ts
 */
import { describe, it, expect, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const slug = () => `rpc-${Math.random().toString(36).slice(2, 7)}`

function args(siteId: string, s: string) {
  return {
    p_site_id: siteId,
    p_slug: s,
    p_name: 'Atomic',
    p_description: null,
    p_campaign_id: null,
    p_sender_name: null,
    p_sender_email: null,
    p_reply_to: null,
    p_intro_mdx: null,
    p_locale: 'en',
    p_headline: 'Atomic',
  }
}

describe.skipIf(skipIfNoLocalDb())('create_waitlist_with_translation (atomic create)', () => {
  const created: string[] = []
  afterEach(async () => {
    if (created.length) {
      await db.from('waitlists').delete().in('id', created)
      created.length = 0
    }
  })

  it('creates the waitlist + default-locale translation in one transaction', async () => {
    const { siteId } = await seedSite(db)
    const s = slug()
    const { data } = await db.rpc('create_waitlist_with_translation', args(siteId, s))
    const id = (data as { id?: string }).id
    expect(id).toBeTruthy()
    created.push(id!)

    const { count: wlCount } = await db
      .from('waitlists')
      .select('id', { count: 'exact', head: true })
      .eq('id', id!)
    expect(wlCount).toBe(1)
    const { data: tx } = await db.from('waitlist_translations').select('locale').eq('waitlist_id', id!)
    expect(tx?.map((t) => t.locale)).toEqual(['en'])
  })

  it('reports slug_taken and persists NO second row on a duplicate slug', async () => {
    const { siteId } = await seedSite(db)
    const s = slug()
    const first = await db.rpc('create_waitlist_with_translation', args(siteId, s))
    created.push((first.data as { id: string }).id)

    const dup = await db.rpc('create_waitlist_with_translation', args(siteId, s))
    expect((dup.data as { error?: string }).error).toBe('slug_taken')

    const { count } = await db
      .from('waitlists')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('slug', s)
    expect(count).toBe(1) // the collision created nothing
  })
})
