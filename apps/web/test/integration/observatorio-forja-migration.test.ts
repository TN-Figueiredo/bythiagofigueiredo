import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

describe.skipIf(skipIfNoLocalDb())('migration observatorio_forja', () => {
  let sb: SupabaseClient
  let siteId = ''
  beforeAll(async () => {
    sb = getSupabaseServiceClient() as unknown as SupabaseClient
    siteId = (await sb.from('sites').select('id').limit(1).single()).data!.id
    await sb.from('youtube_intelligence_tasks').delete().eq('site_id', siteId).neq('task_type', 'diagnostico')
  })
  const ask = (type: string, niche: string) => sb.from('youtube_intelligence_tasks').insert({ site_id: siteId, task_type: type, target_niche: niche, trigger_type: 'manual', status: 'pending' })
  it('observatory task without channel_id is valid; diagnostico without channel_id is not', async () => {
    expect((await ask('temas', 'ia')).error).toBeNull()
    expect((await sb.from('youtube_intelligence_tasks').insert({ site_id: siteId, task_type: 'diagnostico', trigger_type: 'manual' })).error?.message).toMatch(/check/i)
  })
  it('same type + same niche active twice → unique violation; other type same niche → ok', async () => {
    expect((await ask('temas', 'ia')).error?.message).toMatch(/duplicate|unique/i)
    expect((await ask('padroes-titulo', 'ia')).error).toBeNull()
  })
  it('status refused exists', async () => {
    const { data } = await ask('resumo-trocas', 'viagem').select('id').single()
    expect((await sb.from('youtube_intelligence_tasks').update({ status: 'refused', refused_reason: 'dado-velho', refused_at: new Date().toISOString() }).eq('id', data!.id)).error).toBeNull()
  })
  it('readings and heartbeat tables exist', async () => {
    expect((await sb.from('competitor_readings').select('id').limit(1)).error).toBeNull()
    expect((await sb.from('forja_heartbeat').upsert({ site_id: siteId, last_poll_at: new Date().toISOString(), capabilities: ['temas'] })).error).toBeNull()
  })
})
