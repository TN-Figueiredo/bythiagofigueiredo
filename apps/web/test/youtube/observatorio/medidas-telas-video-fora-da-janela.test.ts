// @vitest-environment node
// A5 · E5a, portão do L7a (Phil I2, emenda 17/10 ao plano §4.8): o vídeo fora da janela do conjunto do canal lê a série, as mudanças e as horas SÓ DELE.
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { completarVideoForaDaJanela, type PedidoDoVideo } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-video'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import { derivarDoVideo } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/derivar-do-video'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))

const DAY = 864e5
const H = 3_600_000
const AGORA = Date.UTC(2026, 9, 20, 18, 0, 0)
const sb = {} as SupabaseClient

const lidoDe = (pubMs: number): VideoLido => ({
  id: 'v1', videoId: 'yt1', publishedAt: new Date(pubMs).toISOString(), liveActualStartAt: null, liveBroadcastContent: 'none', wasLive: false, isShort: false,
  durationSeconds: 600, viewCount: 50_000, likeCount: null, commentCount: null, likesHidden: null, commentsDisabled: null, viewsHidden: null,
  discoveredAt: new Date(pubMs).toISOString(), missingSince: null, seriesTier: 'diaria', lastCheckedAt: null,
})
const m5Vazio = { estado: 'nao_medido', motivo: 'serie_diaria_incompleta', notas: [] }
function canal(pubMs: number): CanalInteiro {
  return {
    medidas: { porFormato: {}, m3a: {}, m8: {}, porVideo: new Map([['v1', { m5: m5Vazio }]]), falhas: [] } as unknown as CanalInteiro['medidas'],
    videos: { lido: true, dados: [lidoDe(pubMs)] }, retratos: { lido: true, dados: [] },
    marcas: { lido: true, dados: { marcas: new Map(), faltas: new Map() } },
    serie: { lido: true, dados: new Map() }, mudancas: { lido: true, dados: new Map() },
    horas: { lido: true, dados: { porVideo: new Map(), primeiraHoraDoSiteMs: AGORA - 200 * DAY, ultimoOkDaTarefaMs: AGORA - H, primeiraExecucaoDaTarefaMs: AGORA - 200 * DAY, foraDoCanal: 0 } },
    falhas: [], esgotou: [],
  } as unknown as CanalInteiro
}
const leitores = (over: Partial<NonNullable<PedidoDoVideo['leitores']>> = {}) => {
  const series = vi.fn(async () => ({ lido: true as const, dados: { series: new Map([['v1', [{ t: AGORA - 5 * DAY, views: 10, likes: null, comments: null }]]]), foraDoCanal: 0 } }))
  const mudancas = vi.fn(async () => ({ lido: true as const, dados: { mudancas: new Map([['v1', [{ campo: 'titulo' as const, em: AGORA - 30 * DAY, valueText: null }, { campo: 'titulo' as const, em: AGORA - 60 * DAY, valueText: null }, { campo: 'miniatura' as const, em: AGORA - 90 * DAY, valueText: null }]]]), foraDoCanal: 0 } }))
  const horas = vi.fn(async () => ({ lido: true as const, dados: { porVideo: new Map([['v1', []]]), primeiraHoraDoSiteMs: null, ultimoOkDaTarefaMs: null, primeiraExecucaoDaTarefaMs: null, foraDoCanal: 0 } }))
  return { series, mudancas, horas, ...over } as unknown as NonNullable<PedidoDoVideo['leitores']> & { series: typeof series; mudancas: typeof mudancas; horas: typeof horas }
}
const pedido = (pubMs: number, l: ReturnType<typeof leitores>): PedidoDoVideo => ({ siteId: 's1', channelId: 'c1', agoraMs: AGORA, okSyncedAt: 1, video: { id: 'v1', publicadoEmMs: pubMs, baseMs: pubMs }, leitores: l })

describe('completarVideoForaDaJanela', () => {
  it('zero consultas extras para vídeo dentro da janela', async () => {
    const l = leitores()
    const r = await completarVideoForaDaJanela(sb, canal(AGORA - 30 * DAY), pedido(AGORA - 30 * DAY, l))
    expect(l.series).not.toHaveBeenCalled(); expect(l.mudancas).not.toHaveBeenCalled(); expect(l.horas).not.toHaveBeenCalled()
    expect(r.semLeitura).toEqual({}); expect(r.leituraExtra).toBe(false)
  })

  it('vídeo de 200 dias com 3 trocas: lê só o dele e a lista mostra as 3, nunca "nenhuma mudança"', async () => {
    const pub = AGORA - 200 * DAY
    const l = leitores()
    const r = await completarVideoForaDaJanela(sb, canal(pub), pedido(pub, l))
    expect(l.series).toHaveBeenCalledTimes(1)
    expect((l.series.mock.calls[0] as unknown as [unknown, { videoIds: string[] }])[1].videoIds).toEqual(['v1'])
    expect((l.mudancas.mock.calls[0] as unknown as [unknown, { videoIds: string[] }])[1].videoIds).toEqual(['v1'])
    expect(r.semLeitura).toEqual({})
    const d = derivarDoVideo(r.canal, { agoraMs: AGORA, video: { id: 'v1', publicadoEmMs: pub, viewsAgora: 50_000, dur: 600 }, eixoH: { fromH: 0, H: 100 }, semLeitura: r.semLeitura })
    expect(d.lista).not.toBeNull()
    expect(JSON.stringify(d.lista)).not.toMatch(/Nenhuma mudan/)
    expect(d.serieLida).toBe(true)
  })

  it('vídeo de 100 dias: lê as horas só dele (fora dos 90 dias) mas não a série (dentro dos 180)', async () => {
    const pub = AGORA - 100 * DAY
    const l = leitores()
    await completarVideoForaDaJanela(sb, canal(pub), pedido(pub, l))
    expect(l.horas).toHaveBeenCalledTimes(1)
    expect(l.series).not.toHaveBeenCalled()
  })

  it('a leitura do vídeo falhou: semLeitura, e a tela diz "não carregou" em vez de "nenhuma mudança" e "0 dias"', async () => {
    const pub = AGORA - 200 * DAY
    const l = leitores({
      series: vi.fn(async () => ({ lido: false as const, causa: 'erro_do_banco' as const })),
      mudancas: vi.fn(async () => { throw new Error('boom') }),
    } as never)
    const r = await completarVideoForaDaJanela(sb, canal(pub), pedido(pub, l))
    expect(r.semLeitura).toMatchObject({ serie: true, mudancas: true })
    const d = derivarDoVideo(r.canal, { agoraMs: AGORA, video: { id: 'v1', publicadoEmMs: pub, viewsAgora: 50_000, dur: 600 }, eixoH: { fromH: 0, H: 100 }, semLeitura: r.semLeitura })
    expect(d.lista).toBeNull()
    expect(d.serieLida).toBe(false)
    expect(d.resumo.variante).toBe('nao_carregou')
  })

  it('parte do canal não lida continua não lida: não mistura um vídeo só', async () => {
    const pub = AGORA - 200 * DAY
    const c = { ...canal(pub), serie: { lido: false, causa: 'erro_do_banco' } } as unknown as CanalInteiro
    const l = leitores()
    const r = await completarVideoForaDaJanela(sb, c, pedido(pub, l))
    expect(l.series).not.toHaveBeenCalled()
    expect(r.canal.serie).toBe(c.serie)
  })

  it('a subida do vídeo é refeita com a série dele (a do conjunto foi calculada sem ela)', async () => {
    const pub = AGORA - 200 * DAY
    const l = leitores()
    const r = await completarVideoForaDaJanela(sb, canal(pub), pedido(pub, l))
    const mv = ('porVideo' in r.canal.medidas ? r.canal.medidas.porVideo.get('v1') : undefined)!
    expect(mv.m5).not.toBe(m5Vazio)
  })
})
