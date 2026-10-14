// @vitest-environment jsdom
// A4 13.4, SEGURANÇA (pendência das Tarefas 11 e 15): a ROTA REAL do vídeo próprio, com o leitor de dados REAL (`dados.ts` + `ler.ts`) sobre um banco
// de mentira que tem as SENTINELAS (números privados improváveis) e os modelos e componentes REAIS. Só se simulam a guarda (`requireSiteScope`), a
// página-base (`openObservatoryPage`) e a moldura (`TrailChrome`). Prova:
//  - quem edita vê os números (controle positivo: a negativa não passa em vazio);
//  - quem só lê o site NÃO recebe nenhum número privado: nem no HTML, nem no que a rota entrega ao cliente (a árvore de elementos, que é o que o
//    payload RSC serializa), nem em `generateMetadata`; o banco de serviço nem é consultado e o cliente de serviço nem é criado;
//  - vídeo inexistente ou de concorrente nunca toca a guarda de edição nem o dado privado.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { fakeSupabase, type FakeDb, type Row } from '../../helpers/fake-supabase'
import { TIPO_ALCANCE } from '@/lib/youtube/observatorio/proprio/ler'
import type { AlcanceCanal, DiarioCanal } from '@/lib/youtube/observatorio/proprio/tipos'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { DURACAO_MEDIA_FORMAS, DURACAO_MEDIA_SEG, mundoVideo, SENTINELAS, temSentinela, TEXTOS_PRIVADOS } from './proprio-video-fixture'
import { primeiroProprio } from './proprio-fixture'

const S = '9d1a7c3e-0000-4000-8000-000000000001'
const CANAL = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10'
const umaFaixaECanalUuid = (ds: Dataset) => {
  for (const v of ds.videos) if (v.fmt === 'long') v.dur = 600
  const ch = primeiroProprio(ds), velho = ch.id
  ch.id = CANAL
  for (const v of ds.videos) if (v.ch === velho) v.ch = CANAL
}
const w = mundoVideo({ mut: umaFaixaECanalUuid })
const proprio = w.obs.videos.find(v => v.id === w.foco.id)!
const concorrente = w.obs.videos.find(v => !w.obs.channel(v.ch)!.own)!

const alcance = w.dados.alcance.acesso === 'ok' ? w.dados.alcance.dado : (() => { throw new Error('fixture') })()
const diario = w.dados.diario.acesso === 'ok' ? w.dados.diario.dado : (() => { throw new Error('fixture') })()
const tabelas = (a: AlcanceCanal, d: DiarioCanal): Record<string, Row[]> => ({
  yt_reporting_reports: a.relatorios.map(r => ({
    report_id: 'r-' + r.dia, site_id: S, channel_id: CANAL, report_type_id: TIPO_ALCANCE, status: r.status, start_time: r.dia + 'T07:00:00+00:00', normalized_at: r.normalizado ? r.dia + 'T12:00:00+00:00' : null,
  })),
  yt_own_video_reach_daily: a.linhas.map(l => ({ youtube_video_id: l.ytId, day_pt: l.dia, site_id: S, channel_id: CANAL, thumbnail_impressions: l.imp, thumbnail_ctr: l.ctr, collected_at: l.dia })),
  yt_own_video_daily: d.linhas.map(l => ({ youtube_video_id: l.ytId, day_pt: l.dia, site_id: S, channel_id: CANAL, views: l.views, avg_view_percentage: l.pctAssistido, avg_view_duration_seconds: l.duracaoMediaSeg, collected_at: l.dia })),
})

const guarda = vi.hoisted(() => ({ ok: true, chamadas: 0 }))
const servico = vi.hoisted(() => ({ cliente: null as unknown, criado: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: async () => { guarda.chamadas++; return guarda.ok ? { ok: true, user: { id: 'u1' } } : { ok: false, reason: 'insufficient_access' } },
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { servico.criado++; return servico.cliente } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({
  openObservatoryPage: async () => ({ siteId: S, now: w.obs.NOW, rows: {}, obs: w.obs, meuCanalLembrado: null, savedNiche: 'todos', extra: undefined }),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/own-menu', async orig => ({ ...(await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_chrome/own-menu')>()), ownMenuOf: () => ({ itens: [], principal: null, listaHref: '/l' }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows', async orig => ({ ...(await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows')>()), loadSwipeRows: async () => [] }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/trail-chrome', () => ({ TrailChrome: ({ children }: { children: ReactNode }) => <div data-obs="">{children}</div> }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_historico/historico-screen', () => ({ HistoricoScreen: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/forja-actions', () => ({ askForjaReading: vi.fn(), cancelForjaReading: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({ pinVideo: vi.fn(), unpinVideo: vi.fn(), syncCompetitorNow: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }), usePathname: () => '/x', useSearchParams: () => new URLSearchParams('') }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a> }))

let db: FakeDb
beforeEach(() => {
  vi.clearAllMocks(); guarda.ok = true; guarda.chamadas = 0; servico.criado = 0
  db = fakeSupabase(tabelas(alcance, diario))
  servico.cliente = db.client
})
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

async function rota(id: string) {
  const { default: Pagina } = await import('@/app/cms/(authed)/youtube/competitors/video/[id]/page')
  return Pagina({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) })
}
/** Tudo o que a rota entrega ao cliente (props de client components, aninhadas), serializado: é o que o payload RSC leva. */
const SERIALIZADO = (el: unknown) => JSON.stringify(el, (_k, v) => (typeof v === 'function' || typeof v === 'symbol' ? undefined : v))
const html = () => document.body.innerHTML

describe('13.4 segurança do vídeo próprio: quem edita × quem só lê', () => {
  it('controle positivo: quem edita vê os números privados no HTML (impressões, cliques, views do diário, % assistido) e o banco foi consultado', async () => {
    render(await rota(proprio.id))
    for (const s of TEXTOS_PRIVADOS) expect(temSentinela(html(), s), s).toBe(true)
    expect(db.trips.length).toBeGreaterThan(0)
    expect(servico.criado).toBe(1)
    expect(guarda.chamadas).toBe(1)
  })

  it('controle positivo: o que a rota entrega ao cliente TEM os números para quem edita (a negativa abaixo não passa em vazio)', async () => {
    const el = SERIALIZADO(await rota(proprio.id))
    for (const s of TEXTOS_PRIVADOS) expect(temSentinela(el, s), s).toBe(true)
  })

  it('controle positivo da DURAÇÃO MÉDIA e da TAXA: o leitor real entrega a duração do foco a quem edita (a tela não a mostra, então a negativa só vale se o dado existe), e a taxa e os dois extremos do intervalo estão no HTML', async () => {
    const { lerDadosDoVideo, podeVerPrivado } = await import('@/app/cms/(authed)/youtube/competitors/_proprio/dados')
    const leitura = await podeVerPrivado(S)
    const lido = await lerDadosDoVideo({ canalId: CANAL, ytId: w.foco.ytId, longosAcompanhados: w.outros, agora: w.obs.NOW, leitura })
    if (lido.acesso !== 'ok') throw new Error('o editor devia ler')
    const doFoco = lido.dado.diario.linhas.filter(l => l.ytId === w.foco.ytId)
    expect(doFoco.length).toBeGreaterThan(0)
    expect(doFoco.every(l => l.duracaoMediaSeg === DURACAO_MEDIA_SEG)).toBe(true)
    // as formas que a duração teria na página: o padrão as acha em um exemplo de cada (o padrão não é vazio)
    for (const forma of ['4711', '4.711', '4,711', '78:31', '1:18:31', 'duracaoMediaSeg']) expect(DURACAO_MEDIA_FORMAS.test(forma), forma).toBe(true)
    render(await rota(proprio.id))
    for (const s of [SENTINELAS.taxa, SENTINELAS.taxaMin, SENTINELAS.taxaMax]) expect(temSentinela(html(), s), s).toBe(true)
  })

  it('quem só lê o site: o HTML não tem nenhuma das sentinelas, o cliente de serviço nem é criado e o banco não é consultado', async () => {
    guarda.ok = false
    render(await rota(proprio.id))
    for (const s of TEXTOS_PRIVADOS) expect(temSentinela(html(), s), s).toBe(false)
    expect(html()).not.toMatch(DURACAO_MEDIA_FORMAS)
    expect(servico.criado).toBe(0)
    expect(db.trips).toEqual([])
    expect(document.querySelector('[data-privado-nota]')!.textContent).toBe('Só quem edita o site vê as views por dia, as impressões e cliques, o % assistido e a posição deste vídeo nessas medidas.')
    // a parte pública continua: a faixa de seis números do cabeçalho e a posição em views
    expect(document.querySelector('[data-obs-screen="video-proprio"] .nstrip')).not.toBeNull()
    expect(document.querySelector('[data-numero="views"]')).not.toBeNull()
    expect(document.querySelector('[data-numero="impressoes"]')!.textContent).toContain('só quem edita o site vê as impressões')
    expect(document.querySelector('[data-numero="vpd"]')).toBeNull()
    expect(document.querySelector('[data-numero="assistido"]')).toBeNull()
  })

  it('quem só lê o site: a árvore entregue ao cliente (o que o payload RSC serializa) não tem sentinela nem dado cru', async () => {
    guarda.ok = false
    const el = SERIALIZADO(await rota(proprio.id))
    for (const s of TEXTOS_PRIVADOS) expect(temSentinela(el, s), s).toBe(false)
    expect(el).not.toMatch(DURACAO_MEDIA_FORMAS)
    expect(el).not.toMatch(/"relatorios"|"linhas":\[\{"ytId"|"pctAssistido"|"ctr"|"taxa"|"cliques"|"duracaoMediaSeg"|"thumbnail_impressions"|avg_view_percentage|avg_view_duration_seconds/)
    expect(el).toContain('"acesso":"negado"')
  })

  it('a guarda vem antes de qualquer leitura: sem a prova de edição a ordem é guarda, depois nada (nenhum banco)', async () => {
    guarda.ok = false
    await rota(proprio.id)
    // E17 passo 0: a prova de leitura privada pergunta a edição e, negada, a leitura (2 guardas, nenhuma a mais); depois disso nada
    expect(guarda.chamadas).toBe(2)
    expect(db.trips).toEqual([])
    expect(servico.criado).toBe(0)
  })

  it('generateMetadata nunca lê dado privado nem pede a guarda: o título é o mesmo para quem edita e para quem só lê, sem número', async () => {
    const { generateMetadata } = await import('@/app/cms/(authed)/youtube/competitors/video/[id]/page')
    for (const ok of [true, false]) {
      guarda.ok = ok; guarda.chamadas = 0
      const m = await generateMetadata({ params: Promise.resolve({ id: proprio.id }) })
      expect(m).toEqual({ title: 'Vídeo · Competidores' })
      for (const s of TEXTOS_PRIVADOS) expect(temSentinela(JSON.stringify(m), s), s).toBe(false)
      expect(JSON.stringify(m)).not.toMatch(DURACAO_MEDIA_FORMAS)
      expect(guarda.chamadas).toBe(0)
      expect(db.trips).toEqual([])
      expect(servico.criado).toBe(0)
    }
  })

  it('vídeo de concorrente e id inexistente: nem a guarda de edição nem o dado privado são tocados, mesmo para quem edita', async () => {
    for (const id of [concorrente.id, 'nao-existe', 'x\'; drop table']) {
      await rota(id)
      expect(guarda.chamadas, id).toBe(0)
      expect(servico.criado, id).toBe(0)
      expect(db.trips, id).toEqual([])
    }
  })

  it('o vídeo que não é o da tela não vaza: o texto do banco que não pertence à tela não aparece nem para quem edita (a sentinela de impressões é do vídeo em foco)', async () => {
    render(await rota(proprio.id))
    // 7.919 impressões são do vídeo em foco; nenhum outro vídeo tem esse número
    expect(temSentinela(html(), SENTINELAS.imp)).toBe(true)
    cleanup()
    const outro = w.obs.videos.find(v => v.ch === CANAL && v.id !== w.foco.id && v.fmt === 'long' && v.ageDays >= 20)!
    render(await rota(outro.id))
    expect(temSentinela(html(), SENTINELAS.imp)).toBe(false)
  })
})
