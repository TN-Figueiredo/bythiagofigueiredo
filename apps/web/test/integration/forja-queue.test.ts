// @vitest-environment node
/**
 * DB-gated: the forja queue service (Task 30) against a real local Supabase — the partial unique indexes, the
 * target CHECK, the PostgREST `.or()` claim filter and the heartbeat upsert. Every case seeds its OWN site and
 * cleans it up (the local DB is shared; never db:reset from here).
 *
 *   HAS_LOCAL_DB=1 npx vitest run test/integration/forja-queue.test.ts
 */
import { describe, it, expect, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import { askReading, cancelReading, claim, completeReading, refuseTask, type ObsType } from '@/lib/pipeline/services/forja-queue'

const NOT_ANNOUNCED = 'A forja ainda não lê pedidos do observatório.'
const USER = '00000000-0000-4000-8000-0000000000aa'

describe.skipIf(skipIfNoLocalDb())('forja queue service — real Supabase', () => {
  const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const siteIds: string[] = []


  afterAll(async () => {
    if (!siteIds.length) return
    await svc.from('competitor_readings').delete().in('site_id', siteIds)
    await svc.from('youtube_intelligence_tasks').delete().in('site_id', siteIds)
    await svc.from('forja_heartbeat').delete().in('site_id', siteIds)
    await svc.from('youtube_channels').delete().in('site_id', siteIds)
    await svc.from('sites').delete().in('id', siteIds)
  })

  async function freshSite(): Promise<string> {
    const { siteId } = await seedSite(svc)
    siteIds.push(siteId)
    return siteId
  }
  async function seedHeartbeat(siteId: string, caps: ObsType[], at = Date.now()) {
    const { error } = await svc.from('forja_heartbeat').upsert({ site_id: siteId, last_poll_at: new Date(at).toISOString(), capabilities: caps }, { onConflict: 'site_id' })
    expect(error).toBeNull()
  }
  async function ownChannel(siteId: string): Promise<string> {
    const sfx = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
    const { data, error } = await svc.from('youtube_channels').insert({ site_id: siteId, channel_id: `UCfq${sfx}`.slice(0, 24), locale: 'pt', handle: `@fq-${sfx}`, name: 'Forja queue', uploads_playlist_id: `UUfq${sfx}`.slice(0, 24) }).select('id').single()
    expect(error).toBeNull()
    return data!.id as string
  }
  const ctx = (siteId: string, keyId = '00000000-0000-4000-8000-00000000f0f0'): ServiceContext => ({ siteId, permissions: ['read', 'intelligence'], keyId, supabase: svc, source: 'api_key' })
  const tasksOf = async (siteId: string) => (await svc.from('youtube_intelligence_tasks').select('id, task_type, target_niche, status, requested_at').eq('site_id', siteId).order('requested_at')).data ?? []
  const insertTask = async (siteId: string, o: Record<string, unknown>) => {
    const { data, error } = await svc.from('youtube_intelligence_tasks').insert({ site_id: siteId, trigger_type: 'manual', ...o }).select('id').single()
    expect(error).toBeNull()
    return data!.id as string
  }

  it('1. ask temas / Todos with the capability → one pending row per niche (IA, Viagem), ok in click order', async () => {
    const siteId = await freshSite()
    await seedHeartbeat(siteId, ['temas'])
    const res = await askReading(ctx(siteId), { type: 'temas', scope: 'todos', userId: USER }, Date.now())
    expect(res.data.ok).toBe(true)
    expect(res.data.results.map(r => [r.niche, r.ok])).toEqual([['ia', true], ['viagem', true]])
    expect(res.data.results.every(r => typeof r.taskId === 'string')).toBe(true)
    const rows = await tasksOf(siteId)
    expect(rows.map(r => [r.task_type, r.target_niche, r.status])).toEqual([['temas', 'ia', 'pending'], ['temas', 'viagem', 'pending']])
    const full = (await svc.from('youtube_intelligence_tasks').select('channel_id, target_fmt, requested_by').eq('site_id', siteId)).data!
    expect(full.every(r => r.channel_id === null && r.target_fmt === 'long' && r.requested_by === USER)).toBe(true)
  })

  it('2. a second ask of the same type and niche sends nothing ("já há um pedido de IA …")', async () => {
    const siteId = await freshSite()
    await seedHeartbeat(siteId, ['temas'])
    await askReading(ctx(siteId), { type: 'temas', scope: 'ia', userId: USER }, Date.now())
    const again = await askReading(ctx(siteId), { type: 'temas', scope: 'ia', userId: USER }, Date.now())
    expect(again.data.ok).toBe(false)
    expect(again.data.reason).toMatch(/^Nada enviado: já há um pedido de IA/)
    expect(await tasksOf(siteId)).toHaveLength(1)
  })

  it('3. a completed temas/IA today uses the quota; a failed one does not', async () => {
    const siteId = await freshSite()
    await seedHeartbeat(siteId, ['temas'])
    const t = new Date(Date.now() - 60_000).toISOString()
    await insertTask(siteId, { task_type: 'temas', target_niche: 'ia', status: 'completed', requested_at: t, started_at: t, completed_at: t })
    await insertTask(siteId, { task_type: 'temas', target_niche: 'viagem', status: 'failed', requested_at: t, started_at: t, failed_at: t })
    const ia = await askReading(ctx(siteId), { type: 'temas', scope: 'ia', userId: USER }, Date.now())
    expect(ia.data.ok).toBe(false)
    expect(ia.data.reason).toMatch(/^cota de hoje usada para IA \(libera /)
    const viagem = await askReading(ctx(siteId), { type: 'temas', scope: 'viagem', userId: USER }, Date.now())
    expect(viagem.data.ok).toBe(true)
  })

  it('4. heartbeat without the capability (or none at all) → nothing sent, the canonical sentence', async () => {
    const siteId = await freshSite()
    const none = await askReading(ctx(siteId), { type: 'temas', scope: 'ia', userId: USER }, Date.now())
    expect(none.data).toMatchObject({ ok: false, reason: NOT_ANNOUNCED })
    await seedHeartbeat(siteId, [])
    const empty = await askReading(ctx(siteId), { type: 'temas', scope: 'todos', userId: USER }, Date.now())
    expect(empty.data).toMatchObject({ ok: false, reason: NOT_ANNOUNCED })
    expect(await tasksOf(siteId)).toHaveLength(0)
  })

  it('5. the old worker (no task_types) never gets an observatory task; with task_types the oldest pending of any type', async () => {
    const siteId = await freshSite()
    const own = await ownChannel(siteId)
    const obs = await insertTask(siteId, { task_type: 'temas', target_niche: 'ia', requested_at: new Date(Date.now() - 20 * 60_000).toISOString() })
    const diag = await insertTask(siteId, { task_type: 'diagnostico', channel_id: own, requested_at: new Date(Date.now() - 10 * 60_000).toISOString() })
    const old = await claim(ctx(siteId), { channelIds: [own] }, Date.now())
    expect(old.data?.id).toBe(diag)
    expect(old.data?.task_type).toBe('diagnostico')
    const none = await claim(ctx(siteId), { channelIds: [own] }, Date.now())
    expect(none.data).toBeNull()                                   // the temas row is still pending, and invisible
    const legacy = await claim({ ...ctx(siteId), permissions: ['read', 'write', 'intelligence'] }, { channelIds: [] }, Date.now())
    expect(legacy.data).toBeNull()                                 // legacy GET: diagnostico only
    const fresh = await claim(ctx(siteId), { channelIds: [own], taskTypes: ['temas'] }, Date.now())
    expect(fresh.data).toMatchObject({ id: obs, task_type: 'temas', target_niche: 'ia', channel_id: null, target_video_id: null })
  })

  it('6. the forja typed claim (heartbeat option) writes the heartbeat even on an empty queue', async () => {
    const siteId = await freshSite()
    const now = Date.now()
    const res = await claim(ctx(siteId), { channelIds: [], taskTypes: ['temas', 'resumo-trocas'] }, now, { heartbeat: { capabilities: ['temas', 'resumo-trocas'] } })
    expect(res.data).toBeNull()
    const hb = (await svc.from('forja_heartbeat').select('last_poll_at, capabilities, key_id').eq('site_id', siteId).single()).data!
    expect(Date.parse(hb.last_poll_at as string)).toBe(now)
    expect(hb.capabilities).toEqual(['temas', 'resumo-trocas'])
    expect(hb.key_id).toBe('00000000-0000-4000-8000-00000000f0f0')
  })

  it('6b. R46: claims without the option (legacy GET, MCP, Health Coach, Cowork) leave the heartbeat untouched', async () => {
    const siteId = await freshSite()
    const at = Date.now() - 2 * 3600_000
    await seedHeartbeat(siteId, ['temas'], at)
    const own = await ownChannel(siteId)
    await claim({ ...ctx(siteId, '00000000-0000-4000-8000-00000000c0c0'), permissions: ['read', 'write', 'intelligence'] }, { channelIds: [] }, Date.now())
    await claim(ctx(siteId), { channelIds: [own] }, Date.now())
    await claim(ctx(siteId), { channelIds: [own], taskTypes: ['temas'] }, Date.now())
    const hb = (await svc.from('forja_heartbeat').select('last_poll_at, capabilities, key_id').eq('site_id', siteId).single()).data!
    expect(Date.parse(hb.last_poll_at as string)).toBe(at)          // a dead machine stays dead
    expect(hb.capabilities).toEqual(['temas'])                       // and keeps what it announced
    expect(hb.key_id).toBeNull()
    // without a heartbeat row at all, an unflagged claim does not create one
    const bare = await freshSite()
    await claim(ctx(bare), { channelIds: [] }, Date.now())
    expect((await svc.from('forja_heartbeat').select('site_id').eq('site_id', bare)).data).toEqual([])
  })

  it('7. completeReading: a number outside sent.numbers → 400; valid → reading + task completed; second POST → 409', async () => {
    const siteId = await freshSite()
    const id = await insertTask(siteId, { task_type: 'temas', target_niche: 'ia', target_fmt: 'long' })
    const claimed = await claim(ctx(siteId), { channelIds: [], taskTypes: ['temas'] }, Date.now())
    expect(claimed.data?.id).toBe(id)
    const VID = '66666666-6666-4666-8666-666666666666'
    const sent = { text: 'dados enviados à forja: 12 longos', asOf: Date.now(), ids: [VID], numbers: ['12', '8,2×'], nVideos: 12, nOutliers: 1, channels: [], channelsOut: [], items: [], capped: false }
    expect((await svc.from('youtube_intelligence_tasks').update({ sent }).eq('id', id)).error).toBeNull()
    const body = (lead: string) => ({ task_id: id, model: 'Gemma 12B', generated_at: new Date().toISOString().replace('Z', '+00:00'), text: { title: 'Temas', lead, items: [] }, analysis: { linhas_lidas: 12, linhas_enviadas: 12 }, evidence: [{ id: VID, note: 'o de 8,2×' }] })
    await expect(completeReading(ctx(siteId), body('Dos 12 longos, 3 subiram.'))).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
    const okRes = await completeReading(ctx(siteId), body('Dos 12 longos, um passou de 8,2×.'))
    const reading = (await svc.from('competitor_readings').select('task_id, task_type, niche, fmt, sent, analysis').eq('id', okRes.data.readingId).single()).data!
    expect(reading).toMatchObject({ task_id: id, task_type: 'temas', niche: 'ia', fmt: 'long', analysis: { linhas_lidas: 12, linhas_enviadas: 12 } })
    expect((reading.sent as { numbers: string[] }).numbers).toEqual(['12', '8,2×'])
    expect((await svc.from('youtube_intelligence_tasks').select('status, completed_at').eq('id', id).single()).data).toMatchObject({ status: 'completed' })
    await expect(completeReading(ctx(siteId), body('Dos 12 longos, um passou de 8,2×.'))).rejects.toMatchObject({ status: 409 })
  })

  it('8. refuseTask → refused with the code; it does not use the quota (ask again the same day → sent)', async () => {
    const siteId = await freshSite()
    await seedHeartbeat(siteId, ['temas'])
    const asked = await askReading(ctx(siteId), { type: 'temas', scope: 'viagem', userId: USER }, Date.now())
    const id = asked.data.results[0]!.taskId!
    const claimed = await claim(ctx(siteId), { channelIds: [], taskTypes: ['temas'] }, Date.now())
    expect(claimed.data?.id).toBe(id)
    expect((await refuseTask(ctx(siteId), id, 'dado-velho')).data).toEqual({ id, status: 'refused' })
    const row = (await svc.from('youtube_intelligence_tasks').select('status, refused_reason, refused_at').eq('id', id).single()).data!
    expect(row).toMatchObject({ status: 'refused', refused_reason: 'dado-velho' })
    expect(row.refused_at).not.toBeNull()
    const again = await askReading(ctx(siteId), { type: 'temas', scope: 'viagem', userId: USER }, Date.now())
    expect(again.data.ok).toBe(true)
  })

  it('9. cancelReading deletes the pending row; the niche can be asked again', async () => {
    const siteId = await freshSite()
    await seedHeartbeat(siteId, ['temas'])
    await askReading(ctx(siteId), { type: 'temas', scope: 'ia', userId: USER }, Date.now())
    expect((await cancelReading(ctx(siteId), { type: 'temas', niche: 'ia' })).data).toEqual({ cancelled: true })
    expect((await cancelReading(ctx(siteId), { type: 'temas', niche: 'ia' })).data).toEqual({ cancelled: false })
    expect(await tasksOf(siteId)).toHaveLength(0)
    expect((await askReading(ctx(siteId), { type: 'temas', scope: 'ia', userId: USER }, Date.now())).data.ok).toBe(true)
  })
})
