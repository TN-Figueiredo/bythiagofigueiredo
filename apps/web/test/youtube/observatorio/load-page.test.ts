// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fakeSupabase, type FakeDb, type Row } from '../../helpers/fake-supabase'
import { createFakeNextCache, type FakeNextCache } from '../../helpers/fake-next-cache'
import { buildTables, ids } from './load-fixture'

const NOW = Date.now(), DAY = 864e5
const HEAVY = ['competitor_videos', 'competitor_video_versions', 'competitor_video_daily', 'competitor_channel_snapshots']
const heavy = (db: FakeDb) => db.trips.filter(t => HEAVY.includes(t)).length
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
