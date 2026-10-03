import { describe, it, expect, beforeAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

describe.skipIf(skipIfNoLocalDb())('migration observatorio_canais', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  beforeAll(() => { sb = getSupabaseServiceClient() })
  it('competitor_channels has niche, last_ok_synced_at, sync_error_since', async () => {
    const { error } = await sb.from('competitor_channels').select('niche, last_ok_synced_at, sync_error_since').limit(1)
    expect(error).toBeNull()
  })
  it('niche rejects unknown values', async () => {
    const { data: site } = await sb.from('sites').select('id').limit(1).single()
    const { error } = await sb.from('competitor_channels').insert({ site_id: site!.id, channel_id: 'UCnichetest', niche: 'culinaria' })
    expect(error?.message).toMatch(/check/i)
  })
  it('competitor_settings defaults channel_limit to 75', async () => {
    const { data: site } = await sb.from('sites').select('id').limit(1).single()
    await sb.from('competitor_settings').delete().eq('site_id', site!.id)
    const { data, error } = await sb.from('competitor_settings').insert({ site_id: site!.id }).select('channel_limit').single()
    expect(error).toBeNull()
    expect(data!.channel_limit).toBe(75)
    await sb.from('competitor_settings').delete().eq('site_id', site!.id)
  })
  it('competitor_user_prefs accepts todos|viagem|ia only', async () => {
    const { error } = await sb.from('competitor_user_prefs').insert({ user_id: '00000000-0000-0000-0000-000000000001', site_id: (await sb.from('sites').select('id').limit(1).single()).data!.id, niche: 'x' })
    expect(error?.message).toMatch(/check/i)
  })
})
