// @vitest-environment node
// F3-cache T1: o que o disparo da agenda escreveu, canal a canal; lista ausente ou torta = o site inteiro, nunca nada.
import { describe, it, expect, vi } from 'vitest'
import { juntarAlvos, listaPorSite } from '@/lib/youtube/agenda/alvos-do-cache'

describe('listaPorSite', () => {
  it('descarta o que não tem a forma de Record<site, string[]>', () => {
    expect(listaPorSite({ A: ['a1', 2, ''], B: 'x', C: [], D: null })).toEqual({ A: ['a1'] })
    expect(listaPorSite(null)).toEqual({})
    expect(listaPorSite([1])).toEqual({})
  })
})

describe('juntarAlvos', () => {
  it('une lote, fase semanal e marcas por site, sem repetir canal', () => {
    expect(juntarAlvos({
      lote: { siteIds: ['A'], channelIdsBySite: { A: ['a1', 'a2'] } },
      semanal: { channelIdsBySite: { A: ['a2'], B: ['b1'] } },
      marcas: { channelIdsBySite: { A: ['a3'] }, sitesInteiros: [] },
    })).toEqual([{ siteId: 'A', channelIds: ['a1', 'a2', 'a3'] }, { siteId: 'B', channelIds: ['b1'] }])
  })
  it('site do lote sem lista (ausente, vazia, torta): inteiro; site inteiro vence a lista que outra fonte trouxe', () => {
    expect(juntarAlvos({ lote: { siteIds: ['A', 'B'], channelIdsBySite: { B: [] } } })).toEqual([{ siteId: 'A', channelIds: null }, { siteId: 'B', channelIds: null }])
    expect(juntarAlvos({ lote: { siteIds: ['A'] } })).toEqual([{ siteId: 'A', channelIds: null }])
    expect(juntarAlvos({ lote: { siteIds: ['A'], channelIdsBySite: { A: ['a1'] } }, marcas: { sitesInteiros: ['A'] } })).toEqual([{ siteId: 'A', channelIds: null }])
    expect(juntarAlvos({ lote: { siteIds: ['A'] }, semanal: { channelIdsBySite: { A: ['a1'] } } })).toEqual([{ siteId: 'A', channelIds: null }])
  })
  it('sem nada escrito: nada a invalidar', () => {
    expect(juntarAlvos({})).toEqual([])
    expect(juntarAlvos({ lote: null, semanal: undefined, marcas: 'x' })).toEqual([])
  })
})

describe('marcas_de_idade devolve os canais com marca ou motivo gravado', () => {
  const importar = async (escritos: Array<{ videoId: string; siteId: string }> | undefined, videos: Array<Record<string, unknown>> | 'erro') => {
    vi.resetModules()
    vi.doMock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))
    vi.doMock('@/lib/youtube/observatorio/medidas/fechar-marcas', () => ({
      runFecharMarcas: vi.fn(async () => ({ status: 'ok', feitos: 2, ficaram: 0, numeros: { marcas: 2 }, ...(escritos ? { escritos } : {}) })),
    }))
    const consultas: unknown[][] = []
    const sb = { from: (t: string) => { const b = { select: (c: string) => { consultas.push([t, c]); return b }, in: (c: string, v: unknown) => { consultas.push([c, v]); return b }, abortSignal: () => (videos === 'erro' ? Promise.reject(new Error('x')) : Promise.resolve({ data: videos, error: null })) }; return b } }
    const { marcasDeIdade: tarefa } = await import('@/lib/youtube/agenda/tarefas/marcas-de-idade')
    const r = await tarefa.rodar({ t0: 0, agora: () => 0, apiKey: 'k', sb: sb as never, linhas: null })
    return { r, consultas }
  }
  it('o canal vem da linha do vídeo (competitor_channel_id), por site', async () => {
    const { r, consultas } = await importar([{ videoId: 'v1', siteId: 'A' }, { videoId: 'v2', siteId: 'A' }, { videoId: 'v3', siteId: 'B' }], [
      { id: 'v1', competitor_channel_id: 'c1' }, { id: 'v2', competitor_channel_id: 'c1' }, { id: 'v3', competitor_channel_id: 'c9' }])
    expect(r.extra).toEqual({ channelIdsBySite: { A: ['c1'], B: ['c9'] }, sitesInteiros: [] })
    expect(consultas[0]).toEqual(['competitor_videos', 'id, competitor_channel_id'])
  })
  it('vídeo cujo canal não foi resolvido (leitura falhou ou não achou): o site inteiro, nunca nada', async () => {
    expect((await importar([{ videoId: 'v1', siteId: 'A' }], 'erro')).r.extra).toEqual({ channelIdsBySite: {}, sitesInteiros: ['A'] })
    expect((await importar([{ videoId: 'v1', siteId: 'A' }, { videoId: 'v2', siteId: 'A' }], [{ id: 'v1', competitor_channel_id: 'c1' }])).r.extra).toEqual({ channelIdsBySite: { A: ['c1'] }, sitesInteiros: ['A'] })
  })
  it('nada gravado: sem extra e sem ida ao banco', async () => {
    const a = await importar(undefined, [])
    expect(a.r.extra).toBeUndefined()
    expect(a.consultas).toEqual([])
    expect((await importar([], [])).r.extra).toBeUndefined()
  })
})
