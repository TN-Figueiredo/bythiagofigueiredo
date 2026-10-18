// @vitest-environment node
// T6: `montarVideo` lê os testes abertos só com `{ trocas: true }` e quem edita, pelo uuid resolvido; entrega a duração pública.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { proprioWorld } from './proprio-fixture'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'

const w = proprioWorld()
const EDICAO = Object.defineProperty({}, 'siteId', { value: 's', enumerable: false }) as LeituraPrivadaDoSite
const st = vi.hoisted(() => ({ site: null as unknown, edita: true, lerAbertos: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) }, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: async () => false }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({ openObservatoryPage: async () => st.site }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/ler-testes-abertos', () => ({ lerTestesAbertos: st.lerAbertos }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados', async orig => ({
  ...(await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_proprio/dados')>()),
  acessoPrivado: async () => ({ leitura: st.edita ? EDICAO : null, edita: st.edita, negativa: null }),
  lerDadosDoVideo: async () => ({ acesso: 'negado' }), lerDiarioLongo: async () => ({ acesso: 'erro' }), longosAcompanhadosDe: () => [],
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados-trocas', () => ({ lerTrocas: async () => ({ acesso: 'negado' }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows', () => ({ loadSwipeRows: async () => [], savedFromRows: () => ({ saved: undefined }) }))

const R = '@/app/cms/(authed)/youtube/competitors'
const v = w.obs.videos.find(x => x.ch === w.canalId)!
const abrir = async () => st.site as never
beforeEach(() => {
  st.edita = true
  st.lerAbertos.mockReset(); st.lerAbertos.mockResolvedValue({ acesso: 'ok', porVideo: {} })
  st.site = { siteId: 's1', now: w.obs.NOW, rows: {}, obs: w.obs, meuCanalLembrado: null, savedNiche: 'todos', extra: undefined }
})

describe('montarVideo: entradas do A/B', () => {
  it('editor com trocas: lê UMA vez, com o uuid resolvido, e entrega abertos, durSeg e podeEditar', async () => {
    const { montarVideo } = await import(`${R}/_historico/montar`)
    const m = await montarVideo(v.id, {}, abrir, { trocas: true })
    expect(m.tipo).toBe('proprio')
    if (m.tipo !== 'proprio') return
    expect(st.lerAbertos).toHaveBeenCalledTimes(1)
    expect(st.lerAbertos).toHaveBeenCalledWith('s1', { videoUuid: m.base.header.id })
    expect(m.abertos).toEqual({ acesso: 'ok', porVideo: {} })
    expect(m.durSeg).toBe(w.obs.video(v.id)?.dur ?? null)
    expect(m.podeEditar).toBe(true)
  })
  it('reporter (edita falso): não lê', async () => {
    st.edita = false
    const { montarVideo } = await import(`${R}/_historico/montar`)
    const m = await montarVideo(v.id, {}, abrir, { trocas: true })
    expect(st.lerAbertos).not.toHaveBeenCalled()
    expect(m.tipo === 'proprio' && m.abertos).toBeNull()
    expect(m.tipo === 'proprio' && m.podeEditar).toBe(false)
  })
  it('sem a opção trocas (pacote da IA): não lê', async () => {
    const { montarVideo } = await import(`${R}/_historico/montar`)
    const m = await montarVideo(v.id, {}, abrir)
    expect(st.lerAbertos).not.toHaveBeenCalled()
    expect(m.tipo === 'proprio' && m.abertos).toBeNull()
  })
  it('Short: a duração pública (45) chega e entradaDoProprio não gera entrada', async () => {
    const curto = w.obs.video(v.id)!
    const antes = curto.dur
    curto.dur = 45
    try {
      const { montarVideo } = await import(`${R}/_historico/montar`)
      const { entradaDoProprio } = await import(`${R}/_chrome/ab-entradas/modelo`)
      const m = await montarVideo(v.id, {}, abrir, { trocas: true })
      if (m.tipo !== 'proprio') throw new Error('esperava proprio')
      expect(m.durSeg).toBe(45)
      expect(entradaDoProprio({ podeEditar: true, videoUuid: m.base.header.id, dur: m.durSeg, abertos: m.abertos, semDado: null })).toBeNull()
    } finally { curto.dur = antes }
  })
})
