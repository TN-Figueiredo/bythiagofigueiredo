// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { createFakeNextCache, type FakeNextCache } from '../../helpers/fake-next-cache'
import { buildTables, ids, spDate, heavyTrips } from './load-fixture'
import { loadChannelLiveRows } from '@/lib/youtube/observatorio/load'
import { createObservatory, type Observatory } from '@/lib/youtube/observatorio'
import type { SupabaseClient } from '@supabase/supabase-js'

const NOW = Date.now(), DAY = 864e5
const heavy = heavyTrips
const ENV = { ...process.env }
const captureMessage = vi.fn()

/** Tables of several sites in one database, as in production. */
function merged(...sets: Array<Record<string, Row[]>>): Record<string, Row[]> {
  const out: Record<string, Row[]> = {}
  for (const s of sets) for (const [k, v] of Object.entries(s)) out[k] = [...(out[k] ?? []), ...v]
  return out
}
async function setup(tables: Record<string, Row[]>, o: { failOn?: string; budget?: number } = {}) {
  vi.resetModules()
  captureMessage.mockClear()
  const cache: FakeNextCache = createFakeNextCache(), db = fakeSupabase(tables, { failOn: o.failOn })
  vi.doMock('next/cache', () => cache.module)
  vi.doMock('@sentry/nextjs', () => ({ captureMessage }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => db.client }))
  if (o.budget != null) vi.doMock('@/lib/youtube/observatorio/pack', async () => ({ ...(await vi.importActual<typeof import('@/lib/youtube/observatorio/pack')>('@/lib/youtube/observatorio/pack')), PACK_BUDGET: o.budget }))
  const mod = await import('@/lib/youtube/observatorio/load-page')
  return { cache, db, ...mod }
}
afterEach(() => { process.env = { ...ENV }; vi.unstubAllEnvs(); vi.doUnmock('@/lib/youtube/observatorio/pack') })

describe('loadPageRows — cache por canal', () => {
  it('site sem canal: listas vazias, nada guardado, sem erro', async () => {
    const { loadPageRows, cache } = await setup({})
    const rows = await loadPageRows('vazio', NOW)
    expect(rows).toMatchObject({ channels: [], videos: [], versions: [], daily: [], snapshots: [], settings: null })
    expect(cache.entries.size).toBe(0)
  })
  it('canal sem vídeo: guarda um pacote vazio válido e a segunda abertura acerta o cache, sem aviso', async () => {
    const { loadPageRows, cache, db } = await setup(buildTables({ siteId: 'a', now: NOW, channels: 1, videosPerChannel: 0 }))
    expect((await loadPageRows('a', NOW)).videos).toEqual([])
    const once = heavy(db)
    const again = await loadPageRows('a', NOW)
    expect(again.videos).toEqual([])
    expect(again.channels).toHaveLength(1)
    expect(heavy(db)).toBe(once)
    expect(cache.entries.size).toBe(1)
    expect(captureMessage).not.toHaveBeenCalled()
  })
  it('segunda abertura: nenhuma ida às tabelas pesadas, mesmas linhas', async () => {
    const { loadPageRows, db, cache } = await setup(buildTables({ siteId: 'a', now: NOW }))
    const first = await loadPageRows('a', NOW)
    const afterFirst = heavy(db)
    expect(afterFirst).toBeGreaterThan(0)
    const second = await loadPageRows('a', NOW)
    expect(heavy(db)).toBe(afterFirst)
    expect(second).toEqual(first)
    expect(cache.entries.size).toBe(2)
    expect(cache.rejected).toEqual([])
  })
  it('as tabelas leves são lidas a cada abertura: o batimento novo da forja aparece', async () => {
    const tables = buildTables({ siteId: 'a', now: NOW })
    const { loadPageRows } = await setup(tables)
    await loadPageRows('a', NOW)
    const later = new Date(NOW + 60_000).toISOString()
    tables.forja_heartbeat![0]!.last_poll_at = later
    expect((await loadPageRows('a', NOW + 61_000)).heartbeat!.last_poll_at).toBe(later)
  })
  it('o relógio é o do render: o conjunto montado de um pacote guardado usa o now pedido', async () => {
    const { loadPageRows, loadPageDataset } = await setup(buildTables({ siteId: 'a', now: NOW }))
    await loadPageRows('a', NOW)
    expect((await loadPageDataset('a', NOW + 7 * 60_000)).now).toBe(NOW + 7 * 60_000)
    expect((await loadPageRows('a', NOW + 91 * DAY)).snapshots).toEqual([])
  })
  it('série não iniciada: a chave não muda a cada abertura', async () => {
    const { loadPageRows, db, cache } = await setup(buildTables({ siteId: 'a', now: NOW, seriesStarted: false }))
    await loadPageRows('a', NOW)
    const once = heavy(db)
    await loadPageRows('a', NOW + 5_000)
    expect(heavy(db)).toBe(once)
    expect(cache.misses).toHaveLength(2)
  })
  it('dois sites: nenhuma linha atravessa, cada chave carrega o seu site, e invalidar um não derruba o outro', async () => {
    const { loadPageRows, db, cache } = await setup(merged(buildTables({ siteId: 'a', now: NOW }), buildTables({ siteId: 'b', now: NOW })))
    const b = await loadPageRows('b', NOW)
    const a = await loadPageRows('a', NOW)
    expect(a.channels.every(c => c.id.startsWith('a-'))).toBe(true)
    expect(a.videos.every(v => v.id.startsWith('a-'))).toBe(true)
    expect(a.versions.every(v => v.video_id.startsWith('a-'))).toBe(true)
    expect(a.daily.every(d => d.video_id.startsWith('a-'))).toBe(true)
    expect(a.snapshots.every(s => s.competitor_channel_id.startsWith('a-'))).toBe(true)
    expect(b.videos.every(v => v.id.startsWith('b-'))).toBe(true)
    expect(a.ownVideos.map(v => v.id)).toEqual(['a-ownv'])
    expect(cache.entries.size).toBe(4)
    for (const [key, e] of cache.entries) {
      const site = key.includes('["a","a-') ? 'a' : key.includes('["b","b-') ? 'b' : null
      expect(site).not.toBeNull()
      expect(e.tags).toEqual(['observatorio:' + site])
    }
    const { observatoryTag } = await import('@/lib/youtube/observatorio/cache-tag')
    cache.module.revalidateTag(observatoryTag('a'))
    expect(cache.entries.size).toBe(2)
    expect([...cache.entries.values()].every(e => e.tags.includes('observatorio:b'))).toBe(true)
    const before = heavy(db)
    await loadPageRows('b', NOW)
    expect(heavy(db)).toBe(before)
    await loadPageRows('a', NOW)
    expect(heavy(db)).toBeGreaterThan(before)
  })
  it('invalidar a tag do site faz a próxima abertura reler e ver o dado novo', async () => {
    const tables = buildTables({ siteId: 'a', now: NOW })
    const { loadPageRows, cache } = await setup(tables)
    await loadPageRows('a', NOW)
    const v = tables.competitor_videos!.find(r => r.id === ids.video('a', 0, 0))!
    v.view_count = 999_999
    expect((await loadPageRows('a', NOW)).videos.find(r => r.id === v.id)!.view_count).not.toBe(999_999)
    const { invalidateObservatory } = await import('@/lib/youtube/observatorio/cache-tag')
    invalidateObservatory('a')
    expect(cache.invalidated).toEqual(['observatorio:a'])
    expect((await loadPageRows('a', NOW)).videos.find(r => r.id === v.id)!.view_count).toBe(999_999)
  })
  it('fixar um vídeo fora do limite: só aparece fixado (e com o diário) depois de invalidar a tag', async () => {
    const tables = buildTables({ siteId: 'a', now: NOW })
    const { loadPageRows, loadPageDataset } = await setup(tables)
    await loadPageRows('a', NOW)
    const id = ids.video('a', 0, 3)
    tables.competitor_videos!.find(r => r.id === id)!.pinned_at = new Date(NOW - 60_000).toISOString()
    tables.competitor_video_daily!.push({ video_id: id, snap_date: new Date(NOW - 3 * 36e5).toISOString().slice(0, 10), views: 77, likes: 0, comments: 0, taken_at: new Date(NOW).toISOString() })
    expect((await loadPageDataset('a', NOW)).videos.find(v => v.id === id)!.pinned).toBe(false)
    const { invalidateObservatory } = await import('@/lib/youtube/observatorio/cache-tag')
    invalidateObservatory('a')
    const v = (await loadPageDataset('a', NOW)).videos.find(x => x.id === id)!
    expect(v.pinned).toBe(true)
    expect(v.series.map(p => p.views)).toEqual([77])
  })
  it('canal sem a primeira sincronização concluída nunca é guardado: a busca anda a cada abertura, sem esperar invalidação', async () => {
    const tables = buildTables({ siteId: 'a', now: NOW, channels: 1, videosPerChannel: 0 })
    const ch = tables.competitor_channels![0]!
    Object.assign(ch, { last_ok_synced_at: null, sync_status: 'syncing', youtube_video_count: 40 })
    const { loadPageDataset, cache } = await setup(tables)
    const sync = async () => (await loadPageDataset('a', NOW)).channels.find(c => c.id === ch.id)!.sync
    expect(await sync()).toMatchObject({ state: 'backfill', backfill: { done: 0, total: 3 } })
    // the first sync (after() of the add action) writes videos; it only invalidates when it ends
    tables.competitor_videos!.push(...buildTables({ siteId: 'a', now: NOW, channels: 1, videosPerChannel: 2 }).competitor_videos!)
    expect(await sync()).toMatchObject({ state: 'backfill', backfill: { done: 2, total: 3 } })
    expect(cache.entries.size).toBe(0)
    expect(cache.invalidated).toEqual([])
    // the sync marks the channel done; a render that comes before the invalidation already sees every video
    tables.competitor_videos!.push(...buildTables({ siteId: 'a', now: NOW, channels: 1, videosPerChannel: 4 }).competitor_videos!.slice(2))
    ch.last_ok_synced_at = new Date(NOW).toISOString(); ch.sync_status = 'idle'
    const done = await loadPageDataset('a', NOW)
    expect(done.channels.find(c => c.id === ch.id)!.sync).toMatchObject({ state: 'ok', backfill: null })
    expect(done.videos.filter(v => v.ch === ch.id)).toHaveLength(4)
    expect(cache.entries.size).toBe(1)
  })
  describe('fixado conferido no meio do lote (a invalidação só vem no fim do lote)', () => {
    const H = 36e5, iso = (ms: number) => new Date(ms).toISOString()
    /** Video 3 of channel 0 (outside the limit) pinned one hour ago, after its last check and after the channel's last good sync. */
    async function pinnedWaiting() {
      const tables = buildTables({ siteId: 'a', now: NOW })
      const id = ids.video('a', 0, 3), video = tables.competitor_videos!.find(r => r.id === id)!, ch = tables.competitor_channels!.find(r => r.id === ids.channel('a', 0))!
      video.pinned_at = iso(NOW - H)
      const s = await setup(tables)
      const pinState = async () => (await s.loadPageDataset('a', NOW)).videos.find(v => v.id === id)!.pinState
      // this render stores the channel: pinned, never checked since
      expect(await pinState()).toBe('aguardando-primeira')
      return { ...s, video, ch, pinState }
    }
    it('o sync conferiu o vídeo e marcou o canal: a abertura seguinte diz ativo, nunca "o YouTube não devolveu"', async () => {
      const { video, ch, pinState, cache } = await pinnedWaiting()
      // the order syncCompetitorChannel writes in: the video's check first, the channel's good sync last
      const t = iso(NOW - 5 * 60_000)
      video.last_checked_at = t
      ch.last_ok_synced_at = t
      expect(await pinState()).toBe('ativo')
      expect(cache.invalidated).toEqual([])
    })
    it('o sync marcou o canal e o YouTube não devolveu o vídeo: sem-resposta aparece sem esperar o fim do lote', async () => {
      const { ch, pinState, cache } = await pinnedWaiting()
      ch.last_ok_synced_at = iso(NOW - 5 * 60_000)
      expect(await pinState()).toBe('sem-resposta')
      expect(cache.invalidated).toEqual([])
    })
    it('canal que não sincronizou de novo: o pacote guardado continua valendo', async () => {
      const { pinState, db } = await pinnedWaiting()
      const once = heavy(db)
      expect(await pinState()).toBe('aguardando-primeira')
      expect(heavy(db)).toBe(once)
    })
  })
  it('mudar o limite de vídeos do canal lê um pacote novo, sem invalidação', async () => {
    const tables = buildTables({ siteId: 'a', now: NOW })
    const { loadPageRows, cache } = await setup(tables)
    expect(new Set((await loadPageRows('a', NOW)).daily.map(d => d.video_id)).size).toBe(6)
    for (const c of tables.competitor_channels!) c.video_limit = 1
    // the limit is part of the key: one tracked video per channel now, read from the database, with no tag invalidated
    expect(new Set((await loadPageRows('a', NOW)).daily.map(d => d.video_id)).size).toBe(2)
    expect(cache.invalidated).toEqual([])
  })
  it('entrada ilegível (outro formato): lê o banco, nunca devolve canal vazio, e avisa', async () => {
    const { loadPageRows, cache } = await setup(buildTables({ siteId: 'a', now: NOW }))
    const good = await loadPageRows('a', NOW)
    for (const e of cache.entries.values()) e.body = JSON.stringify('lixo')
    const again = await loadPageRows('a', NOW)
    expect(again.videos).toHaveLength(good.videos.length)
    expect(again.daily).toHaveLength(good.daily.length)
    expect(captureMessage).toHaveBeenCalledTimes(2)
    expect(captureMessage.mock.calls[0]![0]).toMatch(/entrada de cache do canal .* não pôde ser lida/)
  })
  it('pacote acima do orçamento: a tela recebe as linhas e o Sentry é avisado', async () => {
    const { loadPageRows } = await setup(buildTables({ siteId: 'a', now: NOW }), { budget: 10 })
    expect((await loadPageRows('a', NOW)).videos).toHaveLength(8)
    expect(captureMessage).toHaveBeenCalledTimes(2)
    expect(captureMessage.mock.calls[0]![0]).toMatch(/pacote do canal .* passou do orçamento do cache/)
    expect(captureMessage.mock.calls[0]![1]).toMatchObject({ level: 'warning', extra: { siteId: 'a' } })
  })
  it('pacote que o Next recusa (mais de 2 MB): nada é guardado, toda abertura relê o banco e as linhas chegam inteiras', async () => {
    // incompressible description texts on changed descriptions push one channel over the real entry limit
    const tables = buildTables({ siteId: 'a', now: NOW, channels: 1, videosPerChannel: 1, limit: 1, days: 1 })
    let seed = 7
    const noise = (n: number) => { let s = ''; while (s.length < n) { seed = (seed * 1664525 + 1013904223) >>> 0; s += seed.toString(36) } return s }
    for (const r of tables.competitor_video_versions!) if (r.field === 'desc') r.value_text = noise(1_600_000)
    const { loadPageRows, cache, db } = await setup(tables)
    const first = await loadPageRows('a', NOW)
    expect(cache.rejected).toHaveLength(1)
    expect(cache.entries.size).toBe(0)
    expect(captureMessage.mock.calls[0]![0]).toMatch(/passou do orçamento do cache/)
    const once = heavy(db)
    const second = await loadPageRows('a', NOW)
    expect(heavy(db)).toBe(2 * once)
    expect(second.versions).toEqual(first.versions)
    expect(second.versions.filter(v => v.field === 'desc').every(v => (v.value_text ?? '').length >= 1_600_000)).toBe(true)
  }, 30_000)
  it('pacote dentro do orçamento: nenhum aviso', async () => {
    const { loadPageRows } = await setup(buildTables({ siteId: 'a', now: NOW }))
    await loadPageRows('a', NOW)
    expect(captureMessage).not.toHaveBeenCalled()
  })
  it('erro do banco numa tabela pesada: lança e não guarda nada; a abertura seguinte tenta de novo', async () => {
    const tables = buildTables({ siteId: 'a', now: NOW })
    const { loadPageRows, cache, db } = await setup(tables, { failOn: 'competitor_video_daily' })
    await expect(loadPageRows('a', NOW)).rejects.toThrow(/competitor_video_daily/)
    expect(cache.entries.size).toBe(0)
    const tried = db.trips.filter(t => t === 'competitor_video_daily').length
    await expect(loadPageRows('a', NOW)).rejects.toThrow(/competitor_video_daily/)
    expect(db.trips.filter(t => t === 'competitor_video_daily').length).toBeGreaterThan(tried)
    expect(cache.entries.size).toBe(0)
  })
  it('erro do banco numa tabela leve: lança antes de qualquer leitura guardada', async () => {
    const { loadPageRows, cache } = await setup(buildTables({ siteId: 'a', now: NOW }), { failOn: 'competitor_channels' })
    await expect(loadPageRows('a', NOW)).rejects.toThrow(/competitor_channels/)
    expect(cache.misses).toEqual([])
  })
})

describe('observatoryCacheEnabled', () => {
  it('sem OBS_E2E (variável apagada) o cache fica ligado: o padrão', async () => {
    delete process.env.OBS_E2E; vi.stubEnv('NODE_ENV', 'development')
    const { observatoryCacheEnabled, loadPageRows, cache } = await setup(buildTables({ siteId: 'a', now: NOW }))
    expect(process.env.OBS_E2E).toBeUndefined()
    expect(observatoryCacheEnabled()).toBe(true)
    await loadPageRows('a', NOW)
    expect(cache.entries.size).toBe(2)
  })
  it('OBS_E2E=1 fora de produção desliga: lê o banco a cada abertura, pela mesma leitura por canal', async () => {
    vi.stubEnv('OBS_E2E', '1'); vi.stubEnv('NODE_ENV', 'development')
    const { observatoryCacheEnabled, loadPageRows, cache, db } = await setup(buildTables({ siteId: 'a', now: NOW }))
    expect(observatoryCacheEnabled()).toBe(false)
    const first = await loadPageRows('a', NOW)
    const once = heavy(db)
    await loadPageRows('a', NOW)
    expect(heavy(db)).toBe(2 * once)
    expect(cache.misses).toEqual([])
    expect(first.videos).toHaveLength(8)
  })
  it('OBS_E2E diferente de "1" não desliga', async () => {
    vi.stubEnv('OBS_E2E', 'true'); vi.stubEnv('NODE_ENV', 'development')
    expect((await setup({})).observatoryCacheEnabled()).toBe(true)
  })
  it('em produção OBS_E2E=1 é ignorado', async () => {
    vi.stubEnv('OBS_E2E', '1'); vi.stubEnv('NODE_ENV', 'production')
    expect((await setup({})).observatoryCacheEnabled()).toBe(true)
  })
})

describe('loadChannelDataset — um canal só', () => {
  const tabelas = () => buildTables({ siteId: 'a', now: NOW, channels: 3, videosPerChannel: 4 })
  it('igual ao recorte do site inteiro para o mesmo canal', async () => {
    const { loadChannelDataset, loadPageDataset } = await setup(tabelas())
    const id = ids.channel('a', 1)
    const site = await loadPageDataset('a', NOW), um = (await loadChannelDataset('a', id, NOW))!
    expect(um.channels).toEqual(site.channels.filter(c => c.id === id))
    expect(um.videos).toEqual(site.videos.filter(v => v.ch === id))
    expect(um.videos.length).toBeGreaterThan(0)
  })
  it('não lê os outros canais: uma ida a cada tabela pesada, contra três do site inteiro', async () => {
    const { loadChannelDataset, db } = await setup(tabelas())
    await loadChannelDataset('a', ids.channel('a', 1), NOW)
    expect(db.trips.filter(t => t === 'competitor_videos')).toHaveLength(1)
    expect(db.trips.filter(t => t === 'competitor_channel_snapshots')).toHaveLength(1)
  })
  it('usa o mesmo pacote do cache que a lista de canais já guardou: zero leitura pesada', async () => {
    const { loadChannelDataset, loadPageRows, db } = await setup(tabelas())
    await loadPageRows('a', NOW)
    const antes = heavy(db)
    await loadChannelDataset('a', ids.channel('a', 1), NOW)
    expect(heavy(db) - antes).toBe(0)
  })
  it('canal de outro site: null e nenhuma leitura pesada', async () => {
    const { loadChannelDataset, db } = await setup(merged(tabelas(), buildTables({ siteId: 'b', now: NOW, channels: 1, videosPerChannel: 4 })))
    expect(await loadChannelDataset('a', ids.channel('b', 0), NOW)).toBeNull()
    expect(heavy(db)).toBe(0)
    // a conferência de site vem ANTES da leitura leve do diário: um id de outro site não gasta nem essa ida
    expect(db.trips).not.toContain('competitor_video_daily')
  })
  it('canal próprio de outro site: null e nenhuma leitura pesada', async () => {
    const { loadChannelDataset, db } = await setup(merged(tabelas(), buildTables({ siteId: 'b', now: NOW, channels: 1, videosPerChannel: 4 })))
    expect(await loadChannelDataset('a', 'b-own', NOW)).toBeNull()
    expect(heavy(db)).toBe(0)
    expect(db.trips).not.toContain('youtube_videos')
    expect(db.trips).not.toContain('competitor_video_daily')
  })
  it('id que não existe: null', async () => {
    const { loadChannelDataset } = await setup(tabelas())
    expect(await loadChannelDataset('a', '00000000-0000-4000-8000-000000000000', NOW)).toBeNull()
  })
  it('falha de banco lança e nada é guardado (nunca um canal vazio)', async () => {
    const { loadChannelDataset, cache } = await setup(tabelas(), { failOn: 'competitor_videos' })
    await expect(loadChannelDataset('a', ids.channel('a', 1), NOW)).rejects.toThrow()
    expect(cache.entries.size).toBe(0)
  })
  it('canal próprio: só ele, vídeos próprios sem série, nenhuma ida a competitor_videos', async () => {
    const { loadChannelDataset, db } = await setup(tabelas())
    const ds = (await loadChannelDataset('a', 'a-own', NOW))!
    expect(ds.channels.map(c => [c.id, c.own])).toEqual([['a-own', true]])
    expect(ds.videos).toHaveLength(1)
    expect(ds.videos.every(v => v.ch === 'a-own' && v.series.length === 0)).toBe(true)
    expect(db.trips).not.toContain('competitor_videos')
    expect(heavy(db)).toBe(0)
  })
})

describe('loadChannelDataset — igualdade nos ramos que a leitura de um canal toca', () => {
  const base = { siteId: 'a', now: NOW, channels: 3, videosPerChannel: 4 }
  const id = ids.channel('a', 1)
  const equalToSite = async (tables: Record<string, Row[]>, expectPinned = false) => {
    const { loadChannelDataset, loadPageDataset } = await setup(tables)
    const site = await loadPageDataset('a', NOW), um = (await loadChannelDataset('a', id, NOW))!
    expect(um.channels).toEqual(site.channels.filter(c => c.id === id))
    expect(um.videos).toEqual(site.videos.filter(v => v.ch === id))
    expect(um.videos.length).toBeGreaterThan(0)
    if (expectPinned) expect(um.videos.some(v => v.pinned && !v.tracked)).toBe(true)
    return { um, site }
  }
  it('vídeo fixado fora do limite: o fixado e o diário dele vêm iguais', async () => {
    const { um } = await equalToSite(buildTables({ ...base, pinOldest: true }), true)
    expect(um.videos.find(v => v.pinned && !v.tracked)!.series.length).toBeGreaterThan(0)
  })
  it('canal em primeira sincronização (last_ok_synced_at nulo, sem cache): igual ao site inteiro', async () => {
    const t = buildTables(base)
    t.competitor_channels![1]!.last_ok_synced_at = null
    const { um } = await equalToSite(t)
    expect(um.channels[0]!.sync.last).toBeNull()
  })
  it('série não iniciada: seriesStart no relógio e janela do diário a partir de ontem, igual ao site inteiro', async () => {
    const { um, site } = await equalToSite(buildTables({ ...base, seriesStarted: false }))
    expect(um.seriesStart).toBe(site.seriesStart)
    expect(um.dailyCappedFrom).toBe(site.dailyCappedFrom)
    expect(um.sync).toEqual(site.sync)
    expect(um.obsStart).toBe(site.obsStart)
  })
  it('cache desligado (OBS_E2E=1): o canal lido direto do banco é igual ao do site inteiro lido pelo cache', async () => {
    const tables = buildTables({ ...base, pinOldest: true })
    delete process.env.OBS_E2E; vi.stubEnv('NODE_ENV', 'development')
    const site = await (await setup(tables)).loadPageDataset('a', NOW)
    vi.stubEnv('OBS_E2E', '1')
    const { loadChannelDataset, cache, db } = await setup(tables)
    const um = (await loadChannelDataset('a', id, NOW))!
    expect(cache.entries.size).toBe(0)
    expect(heavy(db)).toBeGreaterThan(0)
    expect(um.channels).toEqual(site.channels.filter(c => c.id === id))
    expect(um.videos).toEqual(site.videos.filter(v => v.ch === id))
    expect(um.obsStart).toBe(site.obsStart)
    expect(um.sync).toEqual(site.sync)
  })
})

describe('loadChannelDataset — valores do site por leitura leve', () => {
  const tabelas = () => buildTables({ siteId: 'a', now: NOW, channels: 3, videosPerChannel: 4 })
  it('a leitura leve só pede as duas colunas dos canais e uma linha do diário; nenhum vídeo dos outros canais', async () => {
    const { loadChannelDataset, db } = await setup(tabelas())
    await loadChannelDataset('a', ids.channel('a', 1), NOW)
    expect(db.selects.filter(s => s.table === 'competitor_channels').map(s => s.cols)).toContain('added_at, last_ok_synced_at')
    const daily = db.selects.filter(s => s.table === 'competitor_video_daily' && s.cols.includes('!inner'))
    expect(daily).toHaveLength(1)
    expect(daily[0]!.cols).toBe('snap_date, taken_at, competitor_videos!inner(competitor_channels!inner(site_id))')
    expect(db.trips.filter(t => t === 'competitor_videos')).toHaveLength(1)
  })
  it('a leitura leve do diário pede UMA linha (range 0..0), nunca o diário do site', async () => {
    const { loadChannelDataset, db } = await setup(tabelas())
    await loadChannelDataset('a', ids.channel('a', 1), NOW)
    // a leitura leve é a única com `!inner`; as leituras pesadas do diário do canal não têm junção
    const leve = db.selects.map((s, i) => ({ s, i })).filter(x => x.s.table === 'competitor_video_daily' && x.s.cols.includes('!inner'))
    expect(leve).toHaveLength(1)
    const idas = db.ranges.filter(r => r.table === 'competitor_video_daily')
    expect(idas.filter(r => r.range?.[0] === 0 && r.range?.[1] === 0)).toHaveLength(1)
  })
  it('o filtro de site da leitura leve só vale com a junção interna: o fake recusa o filtro aninhado sem !inner', async () => {
    const db = fakeSupabase(tabelas())
    expect(() => db.client.from('competitor_video_daily').select('snap_date, taken_at').eq('competitor_videos.competitor_channels.site_id', 'a')).toThrow(/needs competitor_videos!inner/)
    expect(() => db.client.from('competitor_video_daily').select('snap_date, competitor_videos!inner(competitor_channels(site_id))').eq('competitor_videos.competitor_channels.site_id', 'a')).toThrow(/needs competitor_channels!inner/)
  })
  it('o diário de OUTRO site não vira o "último dia" deste (a leitura leve filtra por site)', async () => {
    const b = buildTables({ siteId: 'b', now: NOW, channels: 1, videosPerChannel: 4 })
    for (const r of b.competitor_video_daily!) r.taken_at = new Date(NOW + 0).toISOString()
    // o site b tem um registro bem mais novo que o do a: o do a (atrasado um dia) é o que vale para o a
    const a = tabelas()
    const lag = spDate(NOW)
    a.competitor_video_daily = a.competitor_video_daily!.filter(r => r.snap_date !== lag)
    const { loadChannelDataset, loadPageDataset } = await setup(merged(a, b))
    const um = (await loadChannelDataset('a', ids.channel('a', 1), NOW))!, site = await loadPageDataset('a', NOW)
    expect(um.lastSeriesAt).not.toBeNull()
    expect(createObservatory(um).LAST_IDX).toBe(createObservatory(site).LAST_IDX)
    expect(Math.max(...site.videos.flatMap(v => v.series.map(p => p.t)))).toBe(um.lastSeriesAt)
  })
  it('site sem registro diário: lastSeriesAt nulo (o motor cai no relógio, como no site inteiro)', async () => {
    const t = buildTables({ siteId: 'a', now: NOW, channels: 3, videosPerChannel: 4, seriesStarted: false })
    t.competitor_video_daily = []
    const { loadChannelDataset, loadPageDataset } = await setup(t)
    const um = (await loadChannelDataset('a', ids.channel('a', 1), NOW))!
    expect(um.lastSeriesAt).toBeNull()
    expect(createObservatory(um).LAST_IDX).toBe(createObservatory(await loadPageDataset('a', NOW)).LAST_IDX)
  })
  it('o registro mais novo com taken_at fora do dia dele: lê o resto da data e dá o mesmo instante do site inteiro', async () => {
    const t = tabelas()
    // o maior taken_at da data mais nova cai no dia seguinte (inutilizável): vale o maior dos que cabem no dia
    const today = spDate(NOW)
    const rows = t.competitor_video_daily!.filter(r => r.snap_date === today)
    rows[0]!.taken_at = new Date(NOW + 2 * DAY).toISOString()
    const { loadChannelDataset, loadPageDataset, db } = await setup(t)
    const um = (await loadChannelDataset('a', ids.channel('a', 1), NOW))!, site = await loadPageDataset('a', NOW)
    expect(db.selects.filter(x => x.table === 'competitor_video_daily' && x.cols.includes('!inner'))).toHaveLength(2)
    expect(um.lastSeriesAt).toBe(Math.max(...site.videos.flatMap(v => v.series.map(p => p.t))))
    expect(createObservatory(um).LAST_IDX).toBe(createObservatory(site).LAST_IDX)
  })
  it('o resto da data (taken_at fora do dia) também filtra por site: o diário de outro site na mesma data não entra', async () => {
    const a = tabelas(), today = spDate(NOW)
    const hoje = a.competitor_video_daily!.filter(r => r.snap_date === today)
    // o mais novo do site a tem taken_at fora do dia (inutilizável: vale o meio-dia nominal de SP, 15:00Z); os outros leem às 01:00 de SP
    for (const r of hoje) r.taken_at = today + 'T04:00:00.000Z'
    hoje[0]!.taken_at = new Date(NOW + 2 * DAY).toISOString()
    const b = buildTables({ siteId: 'b', now: NOW, channels: 1, videosPerChannel: 4 })
    // o site b tem registros na MESMA data, depois do meio-dia nominal (17:00 de SP): se entrassem, o instante do site a seria o do b
    for (const r of b.competitor_video_daily!) if (r.snap_date === today) r.taken_at = today + 'T20:00:00.000Z'
    const { loadChannelDataset, db } = await setup(merged(a, b))
    const um = (await loadChannelDataset('a', ids.channel('a', 1), NOW))!
    expect(db.selects.filter(x => x.table === 'competitor_video_daily' && x.cols.includes('!inner'))).toHaveLength(2) // o ramo "resto da data" rodou
    expect(um.lastSeriesAt).toBe(Date.parse(today + 'T15:00:00.000Z'))
  })
  it('erro do banco na leitura leve do diário lança (nunca cai no valor do canal)', async () => {
    const { loadChannelDataset } = await setup(tabelas(), { failOn: 'competitor_video_daily' })
    await expect(loadChannelDataset('a', ids.channel('a', 1), NOW)).rejects.toThrow()
  })
})

/**
 * Igualdade no nível do MOTOR: o que a tela de um canal calcula com o conjunto de um canal é o que a tela do site calcula
 * com o site inteiro. O site abaixo tem 3 canais; o pedido (índice 1) não é o primeiro adicionado, não tem a
 * sincronização mais nova e está um dia ou mais atrás no registro diário (o canal 2 tem o dia de hoje, o 1 não).
 */
describe('loadChannelDataset — igualdade no nível do motor', () => {
  const FMTS = [undefined, 'long', 'short'] as const
  const motorTabelas = () => {
    const t = buildTables({ siteId: 'a', now: NOW, channels: 3, videosPerChannel: 4, days: 6 })
    const ch = t.competitor_channels!
    ch[1]!.last_ok_synced_at = new Date(NOW - 5 * 36e5).toISOString()
    ch[2]!.last_ok_synced_at = new Date(NOW - 36e5).toISOString()
    ch[2]!.added_at = new Date(NOW - 10 * DAY).toISOString()
    // o canal pedido está atrasado: sem os dois dias mais novos do diário
    const lag = new Set([0, 1].map(d => spDate(NOW - d * DAY)))
    t.competitor_video_daily = t.competitor_video_daily!.filter(r => !(String(r.video_id).startsWith(ids.channel('a', 1) + '-') && lag.has(String(r.snap_date))))
    return t
  }
  const pair = async (tables: Record<string, Row[]>, id: string) => {
    const { loadChannelDataset, loadPageDataset } = await setup(tables)
    const siteDs = await loadPageDataset('a', NOW), oneDs = (await loadChannelDataset('a', id, NOW))!
    return { siteDs, oneDs, siteObs: createObservatory(siteDs), oneObs: createObservatory(oneDs) }
  }
  const sameForChannel = (siteObs: Observatory, oneObs: Observatory, id: string) => {
    expect.soft(oneObs.OBS_START, 'OBS_START').toBe(siteObs.OBS_START)
    expect.soft(oneObs.SERIES_START, 'SERIES_START').toBe(siteObs.SERIES_START)
    expect.soft(oneObs.SYNC, 'SYNC').toEqual(siteObs.SYNC)
    expect.soft(oneObs.LAST_IDX, 'LAST_IDX').toBe(siteObs.LAST_IDX)
    expect.soft(oneObs.channel(id), 'channel').toEqual(siteObs.channel(id))
    for (const f of FMTS) {
      expect.soft(oneObs.channelStats(id, f), 'channelStats ' + f).toEqual(siteObs.channelStats(id, f))
      expect.soft(oneObs.cadence(id, f), 'cadence ' + f).toEqual(siteObs.cadence(id, f))
    }
    const mine = (o: Observatory) => o.videos.filter(v => v.ch === id)
    expect(mine(oneObs).length).toBeGreaterThan(0)
    expect(mine(oneObs), 'videos (vpd, vpd7, mult)').toEqual(mine(siteObs))
    for (const v of mine(siteObs)) {
      expect.soft(oneObs.multiplier(v.id), 'multiplier ' + v.id).toEqual(siteObs.multiplier(v.id))
      expect.soft(oneObs.phaseOf(v.id), 'phaseOf ' + v.id).toEqual(siteObs.phaseOf(v.id))
      expect.soft(oneObs.effect(v.id), 'effect ' + v.id).toEqual(siteObs.effect(v.id))
    }
  }
  it('canal concorrente atrasado, nem o primeiro nem o mais novo: os campos de site e o canal iguais ao do site inteiro', async () => {
    const id = ids.channel('a', 1)
    const { siteDs, oneDs, siteObs, oneObs } = await pair(motorTabelas(), id)
    expect.soft(oneDs.obsStart, 'ds.obsStart').toBe(siteDs.obsStart)
    expect.soft(oneDs.sync, 'ds.sync').toEqual(siteDs.sync)
    expect.soft(oneDs.seriesStart).toBe(siteDs.seriesStart)
    expect.soft(oneDs.snap0).toBe(siteDs.snap0)
    expect.soft(oneDs.dailyCappedFrom).toBe(siteDs.dailyCappedFrom)
    // o fixture vale: o pedido não é o primeiro adicionado, não é o sincronizado mais recente e está atrasado
    expect(siteDs.channels.find(c => c.id === id)!.sync.added).toBeGreaterThan(siteDs.obsStart)
    expect(siteDs.sync.last).toBeGreaterThan(siteDs.channels.find(c => c.id === id)!.sync.last!)
    expect(siteObs.channel(id)!.lastIdx!).toBeLessThan(siteObs.LAST_IDX)
    sameForChannel(siteObs, oneObs, id)
  })
  it('canal próprio: os campos de site e o canal iguais ao do site inteiro', async () => {
    const { siteDs, oneDs, siteObs, oneObs } = await pair(motorTabelas(), 'a-own')
    expect.soft(oneDs.obsStart, 'ds.obsStart').toBe(siteDs.obsStart)
    expect.soft(oneDs.sync, 'ds.sync').toEqual(siteDs.sync)
    expect(siteDs.sync.last).not.toBeNull()
    expect.soft(oneObs.OBS_START).toBe(siteObs.OBS_START)
    expect.soft(oneObs.SYNC).toEqual(siteObs.SYNC)
    expect.soft(oneObs.LAST_IDX, 'LAST_IDX').toBe(siteObs.LAST_IDX)
    expect.soft(oneObs.channel('a-own')).toEqual(siteObs.channel('a-own'))
    for (const f of FMTS) expect.soft(oneObs.channelStats('a-own', f)).toEqual(siteObs.channelStats('a-own', f))
    expect(siteObs.videos.filter(v => v.ch === 'a-own').length).toBeGreaterThan(0) // [] contra [] passaria sem provar nada
    expect.soft(oneObs.videos.filter(v => v.ch === 'a-own')).toEqual(siteObs.videos.filter(v => v.ch === 'a-own'))
    expect.soft(oneDs.seriesStart, 'ds.seriesStart').toBe(siteDs.seriesStart)
    expect.soft(oneDs.snap0, 'ds.snap0').toBe(siteDs.snap0)
    expect.soft(oneDs.dailyCappedFrom, 'ds.dailyCappedFrom').toBe(siteDs.dailyCappedFrom)
    for (const f of FMTS) expect.soft(oneObs.cadence('a-own', f), 'cadence ' + f).toEqual(siteObs.cadence('a-own', f))
  })
})

/**
 * CONTRATO: o conjunto de UM canal serve ao que a tela do canal calcula sobre o próprio canal; o que agrega ENTRE
 * canais (vagas, nicho, mapa de calor, tendência, referência do nicho, leitura da forja) daria o número do canal só,
 * em silêncio. Essas funções lançam quando o conjunto é de escopo 'canal'; no site inteiro seguem iguais.
 */
describe('loadChannelDataset — contrato do conjunto de um canal', () => {
  const agregados: Array<[string, (o: Observatory) => unknown]> = [
    ['channelSlots', o => o.channelSlots()],
    ['heatmap', o => o.heatmap('todos')],
    ['nicheRef', o => o.nicheRef('todos')],
    ['nicheStats', o => o.nicheStats('todos')],
    ['ownNicheStats', o => o.ownNicheStats('todos', 'long', ['a-own'])],
    ['themeTrend', o => o.themeTrend('todos')],
    ['ownCoverage', o => o.ownCoverage()],
    ['ownChannels', o => o.ownChannels()],
    ['patternsNow (usa o último dia do site)', o => o.patternsNow('todos')],
    ['forja.preview (base do nicho)', o => o.forja.preview('padroes-titulo', 'todos')],
  ]
  const par = async () => {
    const { loadChannelDataset, loadPageDataset } = await setup(buildTables({ siteId: 'a', now: NOW, channels: 3, videosPerChannel: 4 }))
    return { one: (await loadChannelDataset('a', ids.channel('a', 1), NOW))!, site: await loadPageDataset('a', NOW) }
  }
  it("o conjunto de um canal traz scope 'canal' (concorrente e próprio); o do site inteiro não traz o campo", async () => {
    const { loadChannelDataset, loadPageDataset } = await setup(buildTables({ siteId: 'a', now: NOW, channels: 3, videosPerChannel: 4 }))
    expect((await loadChannelDataset('a', ids.channel('a', 1), NOW))!.scope).toBe('canal')
    expect((await loadChannelDataset('a', 'a-own', NOW))!.scope).toBe('canal')
    expect('scope' in (await loadPageDataset('a', NOW))).toBe(false)
  })
  it.each(agregados)('%s lança sobre o conjunto de um canal, com a mensagem que diz o porquê', async (_nome, chama) => {
    const { one } = await par()
    expect(() => chama(createObservatory(one))).toThrow(/aggregates across the site's channels/)
  })
  it.each(agregados)('%s no site inteiro não lança', async (_nome, chama) => {
    const { site } = await par()
    expect(() => chama(createObservatory(site))).not.toThrow()
  })
  it('o que é do próprio canal segue funcionando sobre o conjunto de um canal', async () => {
    const { one } = await par()
    const o = createObservatory(one), id = ids.channel('a', 1)
    expect(() => { o.channelStats(id); o.cadence(id); o.channel(id); o.SYNC; o.LAST_IDX; o.tabCounts('todos') }).not.toThrow()
  })
})

describe('loadChannelLiveRows — id da URL', () => {
  const client = (code: string) => ({
    from: (table: string) => {
      const q = { select: () => q, eq: () => q, order: () => q, range: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: null, error: table === 'competitor_channels' ? { code, message: 'x' } : null }) }
      return q
    },
  }) as unknown as SupabaseClient
  it('id da URL em caixa alta casa com o concorrente e com o canal próprio (a comparação é sem caixa)', async () => {
    const { loadChannelDataset } = await setup(buildTables({ siteId: 'a', now: NOW, channels: 3, videosPerChannel: 4 }))
    const comp = (await loadChannelDataset('a', ids.channel('a', 1).toUpperCase(), NOW))!
    expect(comp.channels.map(c => c.id)).toEqual([ids.channel('a', 1)])
    const own = (await loadChannelDataset('a', 'A-OWN', NOW))!
    expect(own.channels.map(c => [c.id, c.own])).toEqual([['a-own', true]])
  })
  it('id que não é uuid (22P02): null, não erro de servidor', async () => {
    expect(await loadChannelLiveRows(client('22P02'), 'a', 'lixo', NOW)).toBeNull()
  })
  it('outro erro de banco lança', async () => {
    await expect(loadChannelLiveRows(client('XX000'), 'a', 'lixo', NOW)).rejects.toThrow()
  })
})
