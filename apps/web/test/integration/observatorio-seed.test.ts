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
import { seedObservatory, clearObservatory, seedUuid, ownSeedUuid, ORACLE_NOW } from '../../e2e/fixtures/observatorio-seed'

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

  it('change ids cited by readings ("<video>/<type>/<n>") resolve to loaded changes (Task 35b)', async () => {
    await seedObservatory(siteId, {}, sb)
    const obs = createObservatory(await loadDataset({ siteId, now: ORACLE_NOW, supabase: sb }))
    const cited = obs.forja.readings.filter(r => r.type === 'resumo-trocas')
      .flatMap(r => (r.analysis.groups as Array<{ changeIds: string[] }>).flatMap(g => g.changeIds))
    expect(cited.length).toBeGreaterThan(0)
    for (const id of cited) expect({ id, found: !!obs.change(id) }).toEqual({ id, found: true })
  }, 120_000)

  it('publicado: the published request points at the reading it produced (task_id), loaded as a fresh reading (Task 35b)', async () => {
    await seedObservatory(siteId, { forjaState: 'publicado', forjaType: 'padroes-titulo' }, sb)
    const obs = createObservatory(await loadDataset({ siteId, now: ORACLE_NOW, supabase: sb }))
    const pub = obs.forja.requests.filter(r => r.state === 'publicado' && r.type === 'padroes-titulo')
    expect(pub.length).toBeGreaterThan(0)
    for (const r of pub) expect([r.readingId, obs.forja.readings.map(x => x.id).includes(r.readingId!), obs.forja.byId[r.readingId!]?.type]).toEqual([r.readingId, true, 'padroes-titulo'])
  }, 120_000)

  it('seed legado (sem ownPreset): um canal próprio, com o nicho do oráculo (viagem)', async () => {
    await seedObservatory(siteId, {}, sb)
    const ds = await loadDataset({ siteId, now: ORACLE_NOW, supabase: sb })
    expect(ds.channels.filter(c => c.own).map(c => [c.name, c.niche])).toEqual([['tnFigueiredo', 'viagem']])
  }, 120_000)

  it("ownPreset '2': dois canais próprios, os dois de Viagem, na ordem R73; os concorrentes não mudam", async () => {
    await seedObservatory(siteId, { ownPreset: '2' }, sb)
    const ds = await loadDataset({ siteId, now: ORACLE_NOW, supabase: sb })
    const owns = ds.channels.filter(c => c.own)
    expect(owns).toHaveLength(2)
    expect(owns.map(c => c.niche)).toEqual(['viagem', 'viagem'])
    expect(owns.map(c => c.id).sort()).toEqual([ownSeedUuid(siteId, 'tnfigueiredo'), ownSeedUuid(siteId, 'tnfigueiredo-en')].sort())
    const obs = createObservatory(ds)
    expect(obs.ownChannels().map(c => c.name)).toEqual(['tnFigueiredo', 'tnFigueiredo EN'])
    // each own channel carries its own videos (the dado que não existe: a channel seeded without videos would pass the counts)
    for (const c of owns) expect({ c: c.name, n: ds.videos.filter(v => v.ch === c.id).length > 0 }).toEqual({ c: c.name, n: true })
    expect(obs.tabCounts('todos')).toEqual({ canais: 14, mud: 18, out: 11 })
  }, 120_000)

  it("ownPreset '1': o mesmo canal próprio do seed legado, com o mesmo id", async () => {
    await seedObservatory(siteId, { ownPreset: '1' }, sb)
    const ds = await loadDataset({ siteId, now: ORACLE_NOW, supabase: sb })
    expect(ds.channels.filter(c => c.own).map(c => [c.id, c.name, c.niche])).toEqual([[seedUuid(siteId, 'own-channel', 'own'), 'tnFigueiredo', 'viagem']])
    expect(createObservatory(ds).tabCounts('todos')).toEqual({ canais: 14, mud: 18, out: 11 })
  }, 120_000)

  it("ownPreset '5', 'mix' e 'zero' são recusados (UNIQUE(site_id, locale)) ANTES de qualquer escrita", async () => {
    await seedObservatory(siteId, { ownPreset: '2' }, sb)
    for (const p of ['5', 'mix', 'zero'] as const) {
      await expect(seedObservatory(siteId, { ownPreset: p }, sb)).rejects.toThrow(`o preset ${p} precisa de dois canais próprios com o mesmo locale; youtube_channels tem UNIQUE(site_id, locale)`)
    }
    // the refusal left the previous seed untouched (it did not clear the site first)
    const r = await sb.from('youtube_channels').select('id', { count: 'exact', head: true }).eq('site_id', siteId)
    expect(r.count).toBe(2)
  }, 120_000)

  it('clearObservatory tira todos os canais próprios semeados (o legado e os extras) e os vídeos deles', async () => {
    await seedObservatory(siteId, { ownPreset: '2' }, sb)
    const before = await sb.from('youtube_videos').select('id', { count: 'exact', head: true }).eq('site_id', siteId)
    expect(before.count).toBeGreaterThan(0)
    await clearObservatory(siteId, sb)
    for (const t of ['youtube_channels', 'youtube_videos'] as const) {
      const r = await sb.from(t).select('id', { count: 'exact', head: true }).eq('site_id', siteId)
      expect({ t, n: r.count }).toEqual({ t, n: 0 })
    }
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
    const oracle = loadOracle(), showcase = oracle.videos.find((x: { id: string }) => x.id === oracle.SHOWCASE)
    expect(rows.data![0]!.target_video_id).toBe(seedUuid(siteId, 'video', oracle.SHOWCASE))
    const v = await sb.from('competitor_videos').select('title').eq('id', rows.data![0]!.target_video_id!).single()
    expect(v.error).toBeNull()
    expect(v.data!.title).toBe(showcase.title)
    expect(rows.data![0]).toMatchObject({ task_type: 'leitura-video', target_niche: 'ia' })
  }, 120_000)

  it('clearObservatory leaves nothing for the site, cascaded tables included', async () => {
    // the site is seeded by the previous test; keep some video ids to check the FK cascades
    const chs = await sb.from('competitor_channels').select('id').eq('site_id', siteId)
    expect(chs.error).toBeNull()
    const vids = await sb.from('competitor_videos').select('id').in('competitor_channel_id', chs.data!.map(c => c.id)).limit(100)
    expect(vids.error).toBeNull()
    const ids = vids.data!.map(v => v.id)
    expect(ids.length).toBeGreaterThan(0)
    await clearObservatory(siteId, sb)
    for (const [t, col] of [['competitor_videos', 'id'], ['competitor_video_versions', 'video_id'], ['competitor_video_daily', 'video_id']] as const) {
      const r = await sb.from(t).select(col, { count: 'exact', head: true }).in(col, ids)
      expect({ t, n: r.count }).toEqual({ t, n: 0 })
    }
    const ch = await sb.from('competitor_changes').select('id', { count: 'exact', head: true }).eq('site_id', siteId)
    expect(ch.count).toBe(0)
    const tasks = await sb.from('youtube_intelligence_tasks').select('id', { count: 'exact', head: true }).eq('site_id', siteId)
    expect(tasks.count).toBe(0)
    for (const t of ['competitor_channels', 'competitor_readings', 'forja_heartbeat', 'competitor_settings', 'youtube_channels'] as const) {
      const r = await sb.from(t).select('site_id', { count: 'exact', head: true }).eq('site_id', siteId)
      expect({ t, n: r.count }).toEqual({ t, n: 0 })
    }
  }, 120_000)
})
