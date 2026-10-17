// @vitest-environment node
/**
 * Trem 7 (CE): o pacote da IA do vídeo, nos dois desvios da leitura de "Estourou e parou" (portão Phil M-3 e dívida do trem 6).
 * (1) vídeo acompanhado FORA de `obs.videos`: a tela pinta o Estourou síncrono, então o pacote leva só ele, sem nenhuma outra medida.
 * (2) `lerEstourouDoVideo` lança: só o Estourou vira "não carregou"; as medidas já lidas ficam.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Leitura } from '@/app/cms/(authed)/youtube/competitors/_chrome/medidas/estourou-model'

const st = vi.hoisted(() => ({
  alvo: { doMotor: undefined as unknown, sincrona: null as unknown },
  estourou: null as unknown, lanca: false, projetado: [] as unknown[],
}))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('REDIRECT') }, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_historico/montar', () => ({
  montarVideo: async () => ({ tipo: 'concorrente', view: { notFound: false, untracked: false, video: { id: 'v1' } }, pagina: { siteId: 's1', now: 1, obs: { channels: [], videos: [] } }, recente: null, estado: {} }),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_historico/medidas/ler-do-video', () => ({
  alvoDoHistorico: () => st.alvo,
  clienteDeServicoDoVideo: () => ({}),
  lerMedidasDoVideo: async () => ({ sb: {}, c: {}, d: { marca: 'derivado' }, t0Ms: 0, descobertoMs: null }),
  lerEstourouDoVideo: async () => { if (st.lanca) throw new Error('boom'); return st.estourou },
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_historico/comentarios-de-destaque', () => ({ lerSecaoDeComentarios: async () => ({ tipo: 'na' }), resolverProvas: () => undefined }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados', () => ({ acessoPrivado: async () => ({}) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-video-comentarios', async (orig) => ({ ...(await orig<Record<string, unknown>>()), projetarComentariosDoVideo: () => ({ marca: 'comentarios' }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-video', () => ({
  modeloDeVideo: (_v: unknown, medidas: unknown) => ({ medidas }),
  empacotarVideo: (m: unknown) => m,
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-video-medidas', async (orig) => {
  const m = await orig<Record<string, unknown>>()
  return { ...m, projetarMedidasDoVideo: (d: unknown, e: unknown) => { st.projetado.push(e); return { marca: 'medidas', estourou: e } } }
})

import { medidasDoVideoSoEstourou, tabelasDeMedidasDoVideo } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-video-medidas'
import { EMPACOTAR } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia'

const SINC: Leitura = { tipo: 'ainda_nao_existe', existeEm: '2020-01-10', esteVideoEm: '2020-01-10', hojeSP: '2020-01-01', casas: 'ppp' } as Leitura
const modeloDe = async () => (await EMPACOTAR.video!({ id: 'v1', sp: {} }))!.modelo as unknown as { medidas: { marca?: string; soEstourou?: boolean; estourou: unknown; falhou?: string[] } }

beforeEach(() => { st.alvo = { doMotor: { id: 'v1', ch: 'c1' }, sincrona: 'ler' }; st.estourou = null; st.lanca = false; st.projetado = [] })

describe('vídeo acompanhado fora de obs.videos (M-3)', () => {
  it('a tela pinta o Estourou síncrono, e o pacote leva só ele, sem nenhuma outra medida', async () => {
    st.alvo = { doMotor: undefined, sincrona: SINC }
    const { medidas } = await modeloDe()
    expect(medidas.soEstourou).toBe(true)
    expect(medidas.falhou).toEqual([])
    expect((medidas.estourou as { tipo: string } | null)?.tipo).toBe('ainda_nao_existe')
  })
  it('as tabelas do pacote só têm o Estourou: nenhuma de resumo, idade, horas nem mudanças', () => {
    const { tabelas, avisos } = tabelasDeMedidasDoVideo(medidasDoVideoSoEstourou(SINC))
    expect(tabelas.filter((t) => t.id !== 'video-estourou')).toEqual([])
    expect(avisos.length).toBeGreaterThan(0)
    expect(avisos.every((a) => a !== '')).toBe(true)
  })
  it('sem leitura síncrona (nula) ou a ler (depende do conjunto, que não existe): nenhum bloco de medidas', async () => {
    for (const s of [null, 'ler']) {
      st.alvo = { doMotor: undefined, sincrona: s }
      expect((await EMPACOTAR.video!({ id: "v1", sp: {} }))!.modelo).toEqual({ medidas: null })
    }
  })
})

describe('lerEstourouDoVideo lança', () => {
  it('só o Estourou vira "não carregou"; as medidas já lidas ficam', async () => {
    st.lanca = true
    const { medidas } = await modeloDe()
    expect(medidas.marca).toBe('medidas')
    expect(st.projetado).toEqual([{ tipo: 'nao_carregou' }])
  })
})
