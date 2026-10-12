// @vitest-environment jsdom
// A4 Tarefa 14, SEGURANÇA: a comparação é uma tela que quem só lê o site também abre, e o cartão "Só o seu canal mede" mostra dado PRIVADO. Este teste
// roda a ROTA REAL (`comparar/page`) com o leitor de dados REAL (`dados.ts` + `ler.ts`) sobre um banco de mentira com SENTINELAS (números privados
// improváveis, um grupo por vez) e os modelos e componentes REAIS. Só se simulam a guarda (`requireSiteScope`), a página-base (`openObservatoryPage`:
// lê o conjunto PÚBLICO do site) e a moldura (`TrailChrome`). Prova:
//  - quem edita vê cada grupo (controle positivo: a negativa não passa em vazio), no HTML e no que a rota entrega ao cliente;
//  - quem só lê NÃO recebe nenhum número privado: nem no HTML (nem em atributo), nem na árvore de elementos (o que o payload RSC serializa: o
//    pacote da comparação inteiro), nem em `metadata`; o cliente de serviço nem é criado e nenhuma consulta privada é feita;
//  - a guarda vem antes de qualquer leitura;
//  - comparação entre dois concorrentes: o cartão não aparece.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { fakeSupabase, type FakeDb, type Row } from '../../helpers/fake-supabase'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { TIPO_ALCANCE } from '@/lib/youtube/observatorio/proprio/ler'
import type { AlcanceCanal, AlcanceLinha, DiarioCanal, DiarioLinha, RelatorioDia } from '@/lib/youtube/observatorio/proprio/tipos'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { proprioWorld } from './proprio-fixture'
import { urlDoTeste } from './proprio-mount'

const S = '9d1a7c3e-0000-4000-8000-000000000001'
const UUIDS = ['3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10', '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a11']
const [CANAL, CANAL2] = UUIDS as [string, string]
// os dois canais próprios do preset ganham id de uuid (o leitor recusa id que não é uuid)
const comUuid = (ds: Dataset) => {
  const proprios = ds.channels.filter(c => c.own)
  proprios.forEach((ch, i) => {
    const velho = ch.id
    ch.id = UUIDS[i]!
    for (const v of ds.videos) if (v.ch === velho) v.ch = UUIDS[i]!
  })
}
const w = proprioWorld({ mut: comUuid })
const concorrentes = w.obs.channels.filter(c => !c.own)
const [C1, C2] = [concorrentes[0]!, concorrentes[1]!]
const durDe = (ytId: string) => w.obs.videos.find(v => v.ytId === ytId)!.dur ?? 0
const NA_FAIXA = w.ytIds.filter(y => durDe(y) > 300 && durDe(y) <= 900)
const [A, B, C] = [w.ytIds[1]!, w.ytIds[2]!, w.ytIds[3]!]
const [D, E, F] = [w.ytIds[0]!, ...NA_FAIXA.filter(y => ![w.ytIds[0], A, B, C].includes(y))] as [string, string, string]
const d = (n: number) => addDays(w.hoje, -n)

/**
 * Os números privados do canal, um por grupo, improváveis para não colidirem com nenhum número público da tela (a negativa procura estes textos):
 *  - alcance: A 7.919 impressões em um dia (CTR 0,2), B 3.847 (CTR 0,1), C 1.813 (CTR 0,05): 13.579 impressões, 2.059 cliques estimados, taxa de clique
 *    15,2% (intervalo de Wilson de 14,6% a 15,8%);
 *  - diário (de hoje-2 para trás): A 1.234 views por dia em 11 dias, B 2.173 por dia em 28 dias, C 891 por dia; % assistido de A 77,7, de B 61,3, de C 44,9;
 *    o canal todo, pesado pelas views: 59%.
 */
const alcance: AlcanceCanal = (() => {
  const relatorios: RelatorioDia[] = []
  for (let n = 3; n <= 21; n++) relatorios.push({ dia: d(n), status: 'baixado', normalizado: true })
  const linhas: AlcanceLinha[] = [
    { ytId: A, dia: d(5), imp: 7919, ctr: 0.2 },
    { ytId: B, dia: d(6), imp: 3847, ctr: 0.1 },
    { ytId: C, dia: d(7), imp: 1813, ctr: 0.05 },
  ]
  return { canalId: CANAL, relatorios, linhas, ultimoRelatorio: d(3), descartados: 0 }
})()
const diario: DiarioCanal = (() => {
  const ultimo = d(2)
  const linhas: DiarioLinha[] = []
  const por: Array<[string, number, number, number]> = [[A, 1234, 77.7, 11], [B, 2173, 61.3, 28], [C, 891, 44.9, 28], [D, 40, 70.2, 2], [E, 67, 52.4, 28], [F, 71, 55.1, 28]]
  for (const [ytId, views, pct, dias] of por) for (let n = 0; n < dias; n++) linhas.push({ ytId, dia: addDays(ultimo, -n), views, pctAssistido: pct, duracaoMediaSeg: null })
  return { canalId: CANAL, ultimoDia: ultimo, linhas, descartados: 0 }
})()
const tabelas = (a: AlcanceCanal, di: DiarioCanal): Record<string, Row[]> => ({
  yt_reporting_reports: a.relatorios.map(r => ({
    report_id: 'r-' + r.dia, site_id: S, channel_id: CANAL, report_type_id: TIPO_ALCANCE, status: r.status, start_time: r.dia + 'T07:00:00+00:00', normalized_at: r.normalizado ? r.dia + 'T12:00:00+00:00' : null,
  })),
  yt_own_video_reach_daily: a.linhas.map(l => ({ youtube_video_id: l.ytId, day_pt: l.dia, site_id: S, channel_id: CANAL, thumbnail_impressions: l.imp, thumbnail_ctr: l.ctr, collected_at: l.dia })),
  yt_own_video_daily: di.linhas.map(l => ({ youtube_video_id: l.ytId, day_pt: l.dia, site_id: S, channel_id: CANAL, views: l.views, avg_view_percentage: l.pctAssistido, avg_view_duration_seconds: l.duracaoMediaSeg, collected_at: l.dia })),
})

const guarda = vi.hoisted(() => ({ ok: true, chamadas: 0 }))
const servico = vi.hoisted(() => ({ cliente: null as unknown, criado: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: async () => { guarda.chamadas++; return guarda.ok ? { ok: true, user: { id: 'u1' } } : { ok: false, reason: 'insufficient_access' } },
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { servico.criado++; return servico.cliente } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
// a página-base lê o conjunto PÚBLICO do site (sem o dado privado)
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({
  openObservatoryPage: async () => ({ siteId: S, now: w.obs.NOW, rows: {}, obs: w.obs, meuCanalLembrado: null, savedNiche: 'todos', extra: undefined }),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/trail-chrome', () => ({ TrailChrome: ({ children }: { children: ReactNode }) => <div data-obs="">{children}</div> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }), usePathname: () => '/x', useSearchParams: () => new URLSearchParams('') }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a> }))

let db: FakeDb
beforeEach(() => {
  vi.clearAllMocks(); guarda.ok = true; guarda.chamadas = 0; servico.criado = 0
  db = fakeSupabase(tabelas(alcance, diario))
  servico.cliente = db.client
})
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

async function rota(sp: Record<string, string>) {
  const { default: Pagina } = await import('@/app/cms/(authed)/youtube/competitors/comparar/page')
  urlDoTeste(sp) // o par vive na URL do navegador
  return Pagina({ searchParams: Promise.resolve(sp) })
}
const PAR_PROPRIO = { a: CANAL, b: C1.id }
const PAR_CONCORRENTES = { a: C1.id, b: C2.id }
/** Tudo o que a rota entrega ao cliente (props de client components, aninhadas), serializado: é o que o payload RSC leva. */
const SERIALIZADO = (el: unknown) => JSON.stringify(el, (_k, v) => (typeof v === 'function' || typeof v === 'symbol' ? undefined : v))
const html = () => document.body.innerHTML
const texto = () => document.body.textContent ?? ''

/** Uma sentinela: o grupo de dado privado a que pertence e o padrão que a procura. Não precedida de dígito, ponto ou vírgula. */
interface Sentinela { grupo: string; nome: string; re: RegExp }
const lit = (txt: string) => new RegExp('(?<![\\d.,])' + txt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
const sen = (grupo: string, nome: string, re: RegExp = lit(nome)): Sentinela => ({ grupo, nome, re })
/** O que o cartão mostra, um grupo por vez. */
const SENTINELAS: Sentinela[] = [
  sen('impressões', '13.579'),
  sen('cliques', '2.059'),
  sen('taxa', '15,2%'), sen('taxa', 'entre 14,6% e 15,8%'), sen('taxa', '14,6%'), sen('taxa', '15,8%'),
  sen('% assistido', '59%'),
  // as views por dia do canal (a linha "Views por dia nos longos" de "Número a número": o diário privado, em outro lugar da mesma tela)
  sen('views por dia', '891 (célula)', /class="v1 num">891</), sen('views por dia', 'base de 28 dias', /média dos últimos 28 dias do YouTube com medida/),
]
/** O que só vive na árvore enviada ao cliente: os números crus da faixa de taxa. */
const SENTINELAS_ARVORE: Sentinela[] = [
  sen('impressões (props)', '"imp":13579', /"imp":13579/), sen('impressões (props)', '"valor":"13.579"', /"valor":"13\.579"/),
  sen('cliques (props)', '"cliques":2059.15', /"cliques":2059\.15/), sen('cliques (props)', '"valor":"2.059"', /"valor":"2\.059"/),
  sen('taxa (props)', '"valor":"15,2%"', /"valor":"15,2%"/), sen('taxa (props)', 'nota do intervalo', /"nota":"entre 14,6% e 15,8%"/),
  sen('% assistido (props)', '"valor":"59%"', /"valor":"59%"/),
  sen('views por dia (props)', '"texto":"891"', /"texto":"891"/), sen('views por dia (props)', '"x":891', /"x":891[,}]/),
]
/** Nomes de campo do dado cru e a estrutura da View: nada disso existe para quem só lê. */
const CAMPOS_CRUS = /"relatorios"|"linhas":\[\{"ytId"|"pctAssistido"|"duracaoMediaSeg"|thumbnail_impressions|thumbnail_ctr|avg_view_percentage|avg_view_duration_seconds|"ultimoRelatorio"|"ultimoDia"/
const achados = (lista: Sentinela[], ...textos: string[]): string[] => lista.filter(x => textos.some(t => x.re.test(t))).map(x => `${x.grupo}: ${x.nome}`)

describe('14 segurança da comparação: quem edita × quem só lê', () => {
  it('controle positivo: quem edita vê TODA sentinela do cartão, de cada grupo (HTML ou texto), e o banco foi consultado', async () => {
    render(await rota(PAR_PROPRIO))
    expect(document.querySelector('[data-so-seu-canal]')).not.toBeNull()
    expect(achados(SENTINELAS, html(), texto()).sort()).toEqual(SENTINELAS.map(x => `${x.grupo}: ${x.nome}`).sort())
    expect(db.trips.length).toBeGreaterThan(0)
    expect(servico.criado).toBeGreaterThanOrEqual(1)
    expect(guarda.chamadas).toBe(1)
  })

  it('controle positivo: o que a rota entrega ao cliente TEM os números para quem edita (a negativa abaixo não passa em vazio)', async () => {
    const arvore = SERIALIZADO(await rota(PAR_PROPRIO))
    expect(achados(SENTINELAS_ARVORE, arvore).sort()).toEqual(SENTINELAS_ARVORE.map(x => `${x.grupo}: ${x.nome}`).sort())
    // o pacote tem uma entrada por canal seu do site: a do canal lido ('ok') e a do outro (sem dado no banco)
    const pack = JSON.parse(arvore).props.children.props.pack as { soSeuCanal: Record<string, { acesso: string }> }
    expect(Object.keys(pack.soSeuCanal).sort()).toEqual([CANAL, CANAL2].sort())
    expect(pack.soSeuCanal[CANAL]!.acesso).toBe('ok')
  })

  it('quem só lê o site: nenhuma sentinela no HTML, no texto nem nos atributos; o cartão diz que só quem edita vê; o cliente de serviço nem é criado', async () => {
    guarda.ok = false
    render(await rota(PAR_PROPRIO))
    expect(achados(SENTINELAS, html(), texto())).toEqual([])
    expect(servico.criado).toBe(0)
    expect(db.trips).toEqual([])
    expect(document.querySelector('[data-obs-screen="comparar"]')).not.toBeNull() // a parte pública continua
    const cartao = document.querySelector('[data-so-seu-canal]')!
    expect(cartao).not.toBeNull()
    expect(cartao.textContent).toContain('Só quem edita o site vê estes números.')
    expect(cartao.querySelectorAll('li')).toHaveLength(0)
    expect(cartao.querySelector('.tf')).toBeNull() // nem faixa de taxa
  })

  it('quem só lê o site: o pacote serializado (pack.soSeuCanal) é só "negado", sem nenhum dígito, e a árvore não tem sentinela, fração da faixa nem dado cru', async () => {
    guarda.ok = false
    const el = await rota(PAR_PROPRIO)
    const arvore = SERIALIZADO(el)
    const pack = JSON.parse(arvore).props.children.props.pack as { soSeuCanal: Record<string, unknown> }
    expect(pack.soSeuCanal).toEqual({ [CANAL]: { acesso: 'negado', view: null }, [CANAL2]: { acesso: 'negado', view: null } })
    expect(JSON.stringify(pack.soSeuCanal).replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '')).not.toMatch(/\d/) // tirados os uuids, nenhum dígito
    expect(achados([...SENTINELAS, ...SENTINELAS_ARVORE], arvore)).toEqual([])
    expect(arvore).not.toMatch(CAMPOS_CRUS)
    expect(arvore).not.toMatch(/"eixo":\[\{"pos"|"loTxt"|"hiTxt"|"inconclusiva"|"taxa":\{"cliques"/)
  })

  it('a guarda vem antes de qualquer leitura: sem a prova de edição, a ordem é guarda (uma só) e depois nada (nenhum banco, nenhum cliente de serviço)', async () => {
    guarda.ok = false
    await rota(PAR_PROPRIO)
    expect(guarda.chamadas).toBe(1)
    expect(db.trips).toEqual([])
    expect(servico.criado).toBe(0)
  })

  it('o título da aba é estático: o mesmo objeto para quem edita e para quem só lê, sem sentinela', async () => {
    const mod = await import('@/app/cms/(authed)/youtube/competitors/comparar/page')
    expect('generateMetadata' in mod).toBe(false)
    expect(mod.metadata).toEqual({ title: 'Comparar canais · Competidores' })
    expect(achados([...SENTINELAS, ...SENTINELAS_ARVORE], JSON.stringify(mod.metadata))).toEqual([])
  })

  it('dois concorrentes: o cartão não aparece e nenhuma sentinela está no HTML, mesmo para quem edita', async () => {
    render(await rota(PAR_CONCORRENTES))
    expect(document.querySelector('[data-so-seu-canal]')).toBeNull()
    expect(achados(SENTINELAS, html(), texto())).toEqual([])
    expect(texto()).not.toContain('Só o seu canal mede')
  })

  it('dois concorrentes e quem só lê: nenhum cartão, nenhuma leitura, nenhum cliente de serviço', async () => {
    guarda.ok = false
    render(await rota(PAR_CONCORRENTES))
    expect(document.querySelector('[data-so-seu-canal]')).toBeNull()
    expect(db.trips).toEqual([])
    expect(servico.criado).toBe(0)
  })
})
