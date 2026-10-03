// @vitest-environment node
// apps/web/test/integration/observatorio-seed.test.ts — the fidelity seed round trip without a browser:
// oracle dataset → rows (seedObservatory) → loadDataset → engine must give the mockup's tab counts.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import { requestStateOf } from '@/lib/youtube/observatorio/forja/states'
import { humanizeSyncError } from '@/lib/youtube/observatorio/channels'
import { loadOracle } from '../youtube/observatorio/oracle'
import { seedObservatory, clearObservatory, ORACLE_NOW } from '../../e2e/fixtures/observatorio-seed'

describe.skipIf(skipIfNoLocalDb())('seedObservatory (local DB)', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId = ''
  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    // own site: other suites share the seed site, and competitor_settings is one row per site
    siteId = (await seedSite(sb)).siteId
  }, 60_000)
  afterAll(async () => {
    if (!siteId) return
    await clearObservatory(siteId, sb)
    await sb.from('sites').delete().eq('id', siteId)
  }, 60_000)

  it('ORACLE_NOW is the mockup clock (24/10 15:02 SP)', () => {
    expect(ORACLE_NOW).toBe(Date.parse('2026-10-24T15:02:00-03:00'))
  })

  it('round trip: tabCounts(todos) = {canais 14, mud 18, out 11}, and the sync labels survive', async () => {
    await seedObservatory(siteId, {}, sb)
    const obs = createObservatory(await loadDataset({ siteId, now: ORACLE_NOW, supabase: sb }))
    expect(obs.tabCounts('todos')).toEqual({ canais: 14, mud: 18, out: 11 })
    const oracle = loadOracle()
    for (const n of ['viagem', 'ia'] as const) expect({ n, c: obs.tabCounts(n) }).toEqual({ n, c: oracle.tabCounts(n) })
    const ds = await loadDataset({ siteId, now: ORACLE_NOW, supabase: sb })
    const byName = (n: string) => ds.channels.find(c => c.name === n)!
    expect(byName('Esq Unltd Daily').sync.state).toBe('erro')
    expect(humanizeSyncError(byName('Esq Unltd Daily').sync.msg!)).toBe('não encontrado no YouTube (404)')
    expect(byName('Paddy Doyle').sync.state).toBe('atrasado')
    expect(byName('Vou sem volta').sync.state).toBe('backfill')
    expect(byName('Vou sem volta').sync.backfill).toEqual({ done: 18, total: 50 })
    expect(ds.seriesStart).toBe(Date.parse('2026-10-03T00:00:00-03:00'))
    expect(ds.queue.lastPollAt).toBe(Date.parse('2026-10-24T14:55:00-03:00'))
  }, 120_000)

  it('is idempotent: seeding twice gives the same counts (clear runs first)', async () => {
    await seedObservatory(siteId, {}, sb)
    const obs = createObservatory(await loadDataset({ siteId, now: ORACLE_NOW, supabase: sb }))
    expect(obs.tabCounts('todos')).toEqual({ canais: 14, mud: 18, out: 11 })
  }, 120_000)

  it('forja states map to the columns requestStateOf reads', async () => {
    const cases: Array<[string, string, string]> = [
      // [state, IA row state, Viagem row state] (Todos: one request per niche)
      ['na fila', 'na fila', 'na fila'],
      ['trabalhando', 'trabalhando', 'na fila'],
      ['publicado', 'publicado', 'trabalhando'],
      ['atrasado', 'atrasado', 'atrasado'],
      ['sem máquina', 'sem máquina', 'sem máquina'],
      ['nova tentativa', 'nova tentativa', 'na fila'],
      ['liberado pelo vigia', 'liberado pelo vigia', 'atrasado'],
      ['falhou', 'falhou', 'falhou'],
      ['recusado (dado velho)', 'recusado (dado velho)', 'na fila'],
    ]
    for (const [state, ia, viagem] of cases) {
      await seedObservatory(siteId, { forjaState: state as never }, sb)
      const hb = await sb.from('forja_heartbeat').select('last_poll_at').eq('site_id', siteId).single()
      expect(hb.error).toBeNull()
      const machine = { lastPollAt: Date.parse(hb.data!.last_poll_at) }
      const rows = await sb.from('youtube_intelligence_tasks')
        .select('status, retry_count, requested_at, started_at, completed_at, failed_at, refused_at, released_at, target_niche, task_type, target_video_id')
        .eq('site_id', siteId).gte('requested_at', new Date(ORACLE_NOW - 3 * 36e5).toISOString())
      expect(rows.error).toBeNull()
      const got = Object.fromEntries(rows.data!.map(r => [r.target_niche, requestStateOf(r, machine, ORACLE_NOW)]))
      expect({ state, got }).toEqual({ state, got: { ia, viagem } })
      for (const r of rows.data!) expect(r).toMatchObject({ task_type: 'padroes-titulo', target_video_id: null })
    }
  }, 300_000)

  it('leitura-video targets the showcase video by its seeded id', async () => {
    await seedObservatory(siteId, { forjaState: 'na fila', forjaType: 'leitura-video' }, sb)
    const rows = await sb.from('youtube_intelligence_tasks').select('task_type, target_niche, target_video_id, status')
      .eq('site_id', siteId).eq('status', 'pending')
    expect(rows.error).toBeNull()
    expect(rows.data).toHaveLength(1)
    const v = await sb.from('competitor_videos').select('title').eq('id', rows.data![0]!.target_video_id!).single()
    expect(v.error).toBeNull()
    expect(rows.data![0]).toMatchObject({ task_type: 'leitura-video', target_niche: 'ia' })
  }, 120_000)

  it('clearObservatory leaves nothing for the site', async () => {
    await clearObservatory(siteId, sb)
    for (const t of ['competitor_channels', 'competitor_readings', 'forja_heartbeat', 'competitor_settings', 'youtube_channels'] as const) {
      const r = await sb.from(t).select('site_id', { count: 'exact', head: true }).eq('site_id', siteId)
      expect({ t, n: r.count }).toEqual({ t, n: 0 })
    }
  }, 120_000)
})
