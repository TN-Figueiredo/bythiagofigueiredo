// @vitest-environment node
// A5 · E5a, portão do L7a (AT): `derivarDoVideo` inteiro, sem série, com série fora da janela, com leitura por hora e com estreia agendada.
// Regra de fundo: parte não lida (`null`) nunca vira zero, lista vazia nem data inventada.
import { describe, expect, it } from 'vitest'
import { derivarDoVideo } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/derivar-do-video'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import { FRASES_DAS_HORAS } from '@/lib/youtube/observatorio/medidas-telas/frases-das-horas'
import type { Leitura } from '@/lib/youtube/observatorio/medidas/m1'

const DAY = 864e5
const H = 3_600_000
/** 20/10/2026, 15:00 de São Paulo = 18:00Z. */
const AGORA = Date.UTC(2026, 9, 20, 18, 0, 0)
const naoLida = { lido: false as const, causa: 'erro_do_banco' as const }

function lidoDe(pubMs: number, over: Partial<VideoLido> = {}): VideoLido {
  return {
    id: 'v1', videoId: 'yt1', publishedAt: new Date(pubMs).toISOString(), liveActualStartAt: null, liveBroadcastContent: 'none', wasLive: false, isShort: false,
    durationSeconds: 600, viewCount: 50_000, likeCount: null, commentCount: null, likesHidden: null, commentsDisabled: null, viewsHidden: null,
    discoveredAt: new Date(pubMs).toISOString(), missingSince: null, seriesTier: 'diaria', lastCheckedAt: null, ...over,
  }
}
function canal(v: VideoLido, over: Partial<CanalInteiro> = {}): CanalInteiro {
  return {
    medidas: { porFormato: {}, m3a: {}, m8: {}, porVideo: new Map(), falhas: [] } as unknown as CanalInteiro['medidas'],
    videos: { lido: true, dados: [v] }, retratos: { lido: true, dados: [] },
    marcas: { lido: true, dados: { marcas: new Map(), faltas: new Map() } },
    serie: naoLida, mudancas: naoLida, horas: naoLida, falhas: [], esgotou: [], ...over,
  }
}
const serieDe = (m: Map<string, Leitura[]>): CanalInteiro['serie'] => ({ lido: true, dados: m }) as unknown as CanalInteiro['serie']
const pedido = (pubMs: number) => ({ agoraMs: AGORA, video: { id: 'v1', publicadoEmMs: pubMs, viewsAgora: 50_000, dur: 600 }, eixoH: { fromH: 0, H: 100 } })
const todoTexto = (d: ReturnType<typeof derivarDoVideo>): string => JSON.stringify(d.resumo) + JSON.stringify(d.subida)

describe('derivarDoVideo: série não lida nunca vira zero dias (portão Phil I1, Yannis I-6)', () => {
  const pub = AGORA - 40 * DAY

  it('série não lida: o resumo não diz "Ainda não há histórico" nem "amanhã"', () => {
    const d = derivarDoVideo(canal(lidoDe(pub)), pedido(pub))
    expect(d.serieLida).toBe(false)
    expect(d.resumo.variante).toBe('nao_carregou')
    expect(todoTexto(d)).not.toMatch(/Ainda não há histórico|amanhã/)
  })

  it('série com tempo esgotado: idem', () => {
    const d = derivarDoVideo(canal(lidoDe(pub), { serie: { lido: false, causa: 'tempo_esgotado' } as unknown as CanalInteiro['serie'] }), pedido(pub))
    expect(d.resumo.variante).toBe('nao_carregou')
    expect(todoTexto(d)).not.toMatch(/Ainda não há histórico|amanhã/)
  })

  it('série não lida e M5 não medido: a subida diz não carregou, nunca "fecha em"', () => {
    const porVideo = new Map([['v1', { m5: { estado: 'nao_medido', motivo: 'serie_nao_pedida', notas: [] } }]])
    const c = canal(lidoDe(pub), { medidas: { porFormato: {}, m3a: {}, m8: {}, porVideo, falhas: [] } as unknown as CanalInteiro['medidas'] })
    const d = derivarDoVideo(c, pedido(pub))
    expect(d.subida.tipo).toBe('nao_carregou')
    expect(todoTexto(d)).not.toMatch(/fecha em|Faltam/)
  })

  it('M5 que falhou na E4 (calculo_falhou) com a série lida: não promete "faltam N dias"', () => {
    const porVideo = new Map([['v1', { m5: { estado: 'nao_medido', motivo: 'calculo_falhou', notas: [] } }]])
    const serie = serieDe(new Map([['v1', [{ t: AGORA - 2 * DAY, views: 1, likes: null, comments: null }]]]))
    const c = canal(lidoDe(pub), { serie, medidas: { porFormato: {}, m3a: {}, m8: {}, porVideo, falhas: [] } as unknown as CanalInteiro['medidas'] })
    const d = derivarDoVideo(c, pedido(pub))
    expect(d.subida.tipo).toBe('nao_carregou')
  })

  it('saiu sem nenhuma leitura: nenhuma data de última contagem nem número inventados', () => {
    const saiu = new Date(AGORA - 5 * DAY).toISOString()
    const d = derivarDoVideo(canal(lidoDe(pub, { missingSince: saiu }), { serie: serieDe(new Map()) }), pedido(pub))
    expect(d.resumo.variante).toBe('saiu')
    const t = JSON.stringify(d.resumo)
    expect(t).not.toMatch(/A última contagem, em/)
    expect(t).not.toMatch(/depois de 0 dias/)
  })

  it('série lida e vazia num vídeo de hoje: continua "vazio" (fronteira)', () => {
    const hoje = AGORA - 2 * H
    const d = derivarDoVideo(canal(lidoDe(hoje), { serie: serieDe(new Map()) }), pedido(hoje))
    expect(d.resumo.variante).toBe('vazio')
  })
})

describe('derivarDoVideo: dia de contagem é o da leitura diária (portão Phil I3)', () => {
  it('diasDeContagem não conta o dia que só tem leitura por hora', () => {
    const pub = Date.UTC(2026, 9, 20, 18, 0, 0) // 20/10 15:00 SP
    const agora = pub + 3 * H + 10 * 60_000 // 20/10 18:10 SP: só há leituras por hora
    const horarias = Array.from({ length: 3 }, (_, i) => ({ t: pub + (i + 1) * H, views: (i + 1) * 1000, likes: null, comments: null, porHora: true as const }))
    const d = derivarDoVideo(canal(lidoDe(pub), { serie: serieDe(new Map([['v1', horarias]])) }), { ...pedido(pub), agoraMs: agora })
    // série lida, mas nenhum dia de contagem diária: é "vazio" (a primeira contagem é amanhã às 12:00), não "1 dia de contagem"
    expect(d.resumo.variante).toBe('vazio')
  })
})

describe('derivarDoVideo: uma âncora só, o início real (portão Phil I4, Yannis I-2)', () => {
  const inicio = AGORA - 5 * DAY // hora cheia
  const pub = inicio - 4 * DAY // estreia agendada 4 dias antes
  const horas = (): CanalInteiro['horas'] => ({
    lido: true,
    dados: {
      porVideo: new Map([['v1', Array.from({ length: 73 }, (_, k) => ({ horaMs: inicio + k * H, lidaEmMs: inicio + k * H + 60_000, views: 1000 * (k + 1), likes: null, comments: null }))]]),
      primeiraHoraDoSiteMs: inicio - H, ultimoOkDaTarefaMs: AGORA - H, primeiraExecucaoDaTarefaMs: inicio - H, foraDoCanal: 0,
    },
  }) as unknown as CanalInteiro['horas']

  it('estreia com início 4 dias depois de published_at e leituras por hora desde o início: as 72 horas são medidas, nunca "entrou tarde"', () => {
    const v = lidoDe(pub, { liveActualStartAt: new Date(inicio).toISOString(), discoveredAt: new Date(inicio).toISOString(), wasLive: true })
    const d = derivarDoVideo(canal(v, { serie: serieDe(new Map()), horas: horas() }), pedido(pub))
    expect(d.horas.tipo).toBe('ok')
  })

  it('"1 hora", no singular (frase de entrou tarde e do bloco de idade)', () => {
    expect(FRASES_DAS_HORAS.entrou_tarde({ horasAteEntrar: 1 } as never).longa).toMatch(/\b1 hora depois/)
    expect(FRASES_DAS_HORAS.entrou_tarde({ horasAteEntrar: 5 } as never).longa).toMatch(/\b5 horas depois/)
  })
})
