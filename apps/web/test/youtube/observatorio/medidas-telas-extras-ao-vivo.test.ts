// @vitest-environment node
// F3-cache T1: os extras do site (aviso "saiu do YouTube", pausa) saem do cache: lidos ao vivo em toda abertura; as medidas de cada canal
// caem só pela etiqueta do canal.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeNextCache } from '../../helpers/fake-next-cache'
import { falsoPostgrest, type Linha } from './medidas-fixture'

const T0 = Date.UTC(2026, 9, 14, 15, 0, 0)
const D = 86_400_000
const LAST = Date.UTC(2026, 9, 14, 10, 0, 0)
const iso = (ms: number): string => new Date(ms).toISOString()
const canal = (id: string, extra: Linha = {}): Linha => ({ id, site_id: 's1', collection_paused_at: null, missing_since: null, subscribers_hidden: false, last_ok_synced_at: iso(LAST), ...extra })
const video = (id: string, c: string): Linha => ({ id, competitor_channel_id: c, video_id: 'yt' + id, published_at: iso(T0 - 10 * D), is_short: false, view_count: 1000 })
const tabelas = (): Record<string, Linha[]> => ({
  competitor_channels: [canal('a'), canal('b')], competitor_videos: [video('av', 'a'), video('bv', 'b')], competitor_channel_snapshots: [],
  competitor_video_daily: [], competitor_video_early: [], competitor_video_marks: [], competitor_video_mark_misses: [],
})
const obs = { channels: [{ id: 'a', own: false, sync: { last: LAST } }, { id: 'b', own: false, sync: { last: LAST } }], videos: [] } as never

async function montar(t: Record<string, Linha[]>, op: Parameters<typeof falsoPostgrest>[1] = {}) {
  vi.resetModules()
  const cache = createFakeNextCache()
  vi.doMock('next/cache', () => cache.module)
  vi.doMock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
  const mod = await import('@/lib/youtube/observatorio/medidas-telas/carregar-do-site')
  const tag = await import('@/lib/youtube/observatorio/cache-tag')
  const f = falsoPostgrest(t, op)
  const abrir = () => mod.carregarMedidasDoSite(f.sb, { siteId: 's1', obs, canais: ['a', 'b'], agoraMs: T0 })
  const medidasGravadas = () => [...cache.entries.keys()].filter(k => k.startsWith('medidas-telas:'))
  return { cache, abrir, f, medidasGravadas, ...tag }
}
beforeEach(() => { vi.resetModules() })

describe('extras ao vivo', () => {
  it('prova do aviso: o cron derruba só o canal b, b ganha missing_since, a abertura seguinte mostra "saiu do YouTube"; a medida de a continua guardada', async () => {
    const t = tabelas()
    const { abrir, cache, invalidateObservatory, medidasGravadas } = await montar(t)
    const antes = await abrir()
    expect(antes.extras.lido && antes.extras.dados.get('b')?.missingSince).toBeNull()
    expect(medidasGravadas()).toHaveLength(2)
    const missesAntes = cache.misses.filter(k => k.startsWith('medidas-telas:')).length
    t.competitor_channels!.find(c => c.id === 'b')!.missing_since = iso(T0 - D)
    invalidateObservatory('s1', ['b'])
    expect(medidasGravadas()).toHaveLength(1)
    const depois = await abrir()
    expect(depois.extras.lido && depois.extras.dados.get('b')?.missingSince).toBe(iso(T0 - D))
    // só b foi recalculada: a de a seguiu guardada
    expect(cache.misses.filter(k => k.startsWith('medidas-telas:')).length).toBe(missesAntes + 1)
  })
  it('sem nenhuma invalidação o extra já é novo (nunca fica velho): nada de extras no cache', async () => {
    const t = tabelas()
    const { abrir, cache } = await montar(t)
    await abrir()
    t.competitor_channels!.find(c => c.id === 'a')!.missing_since = iso(T0 - D)
    const r = await abrir()
    expect(r.extras.lido && r.extras.dados.get('a')?.missingSince).toBe(iso(T0 - D))
    expect([...cache.entries.keys()].some(k => k.includes('extras'))).toBe(false)
  })
  it('cada abertura vai ao banco pelos extras (33-68 ms medidos): duas aberturas, duas leituras', async () => {
    const { abrir, f } = await montar(tabelas())
    await abrir(); await abrir()
    // a consulta dos extras é a de competitor_channels sem eq de id
    const extras = f.consultas.filter(c => c.tabela === 'competitor_channels' && c.colunas.includes('subscribers_hidden') && !c.filtros.some(x => x.coluna === 'id'))
    expect(extras).toHaveLength(2)
  })
  it('degradação: a leitura dos extras falha → extras.lido = false, as medidas dos canais seguem e a página abre', async () => {
    const t = tabelas()
    const { abrir } = await montar(t, { colunasAusentes: { competitor_channels: ['subscribers_hidden'] } })
    const r = await abrir().catch(() => null)
    expect(r).not.toBeNull()
    expect(r!.extras.lido).toBe(false)
    expect(r!.porCanal.get('a')).toBeDefined()
    expect(r!.porCanal.get('a')).not.toHaveProperty('naoCarregou')
  })
  it('a leitura dos extras lançando vira erro_do_banco, sem derrubar a abertura', async () => {
    const { abrir } = await montar(tabelas(), { lancam: ['competitor_channels'] })
    const r = await abrir()
    expect(r.extras).toMatchObject({ lido: false })
  })
})
