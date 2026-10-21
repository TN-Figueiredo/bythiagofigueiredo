// @vitest-environment jsdom
// A4 13.3, SEGURANÇA (achado Importante 1 da revisão): a ROTA REAL do canal próprio (`canal/[id]/page`), com o leitor de dados REAL (`dados.ts` + `ler.ts`)
// sobre um banco de mentira que tem as SENTINELAS (números privados improváveis) e os modelos e componentes REAIS (cabeçalho, "Como o canal está", abas
// Vídeos e Retenção). Só se simulam a guarda (`requireSiteScope`), as páginas-base (`openChannelPage`/`openObservatoryPage`: elas leem o conjunto público
// do site) e a moldura (`TrailChrome`). Prova:
//  - quem edita vê os números (controle positivo: a negativa não passa em vazio), em cada grupo de dado privado;
//  - quem só lê o site NÃO recebe nenhum número privado: nem no HTML (nem em atributo), nem no que a rota entrega ao cliente (a árvore de elementos, que é
//    o que o payload RSC serializa: props dos client components, inclusive a faixa de taxa), nem em `metadata`; o cliente de serviço nunca é criado e
//    nenhuma consulta privada é feita;
//  - canal inexistente e canal de concorrente nunca tocam o dado privado.
import { AbEntradasProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/contexto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fakeSupabase, type FakeDb, type Row } from '../../helpers/fake-supabase'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { TIPO_ALCANCE } from '@/lib/youtube/observatorio/proprio/ler'
import type { AlcanceCanal, AlcanceLinha, DiarioCanal, DiarioLinha, RelatorioDia } from '@/lib/youtube/observatorio/proprio/tipos'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { temSentinela } from './proprio-video-fixture'
import { primeiroProprio, proprioWorld } from './proprio-fixture'
import { urlDoTeste } from './proprio-mount'
/** Desembrulha o AbEntradasProvider (T8/T9a): a página põe o provedor entre a moldura e a tela. */
const semProvedor = <T,>(e: T): T => ((e as { type?: unknown }).type === AbEntradasProvider ? (e as { props: { children: T } }).props.children : e)

const S = '9d1a7c3e-0000-4000-8000-000000000001'
const CANAL = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10'
const comUuid = (ds: Dataset) => {
  const ch = primeiroProprio(ds), velho = ch.id
  ch.id = CANAL
  for (const v of ds.videos) if (v.ch === velho) v.ch = CANAL
}
const w = proprioWorld({ mut: comUuid })
const concorrente = w.obs.channels.find(c => !c.own)!
const durDe = (ytId: string) => w.obs.videos.find(v => v.ytId === ytId)!.dur ?? 0
// os seis vídeos longos da faixa "5 a 15 min" (o normal da faixa precisa de 5): A, B, C com a taxa e as views grandes; D, E, F com views pequenas
const NA_FAIXA = w.ytIds.filter(y => durDe(y) > 300 && durDe(y) <= 900)
const [A, B, C] = [w.ytIds[1]!, w.ytIds[2]!, w.ytIds[3]!]
const [D, E, F] = [w.ytIds[0]!, ...NA_FAIXA.filter(y => ![w.ytIds[0], A, B, C].includes(y))] as [string, string, string]
const d = (n: number) => addDays(w.hoje, -n)

/**
 * Os números privados do canal, um por grupo, improváveis para não colidirem com nenhum número público da tela (a negativa procura estes textos):
 *  - alcance: A 7.919 impressões em um dia (CTR 0,2), B 3.847 (CTR 0,1), C 1.813 (CTR 0,05): 13.579 impressões nos 19 dias lidos, 2.059 cliques
 *    estimados, taxa de clique do canal 15,2% (intervalo de Wilson em `taxa`);
 *  - diário (de hoje-2 para trás): A 1.234 views por dia em 11 dias (13.574 no total), B 2.173 por dia em 28 dias (60.844), C 891 por dia (24.948); a soma
 *    do dia, com os três, é 4.298; % assistido de A 77,7 (78%), de B 61,3 (61%), de C 44,9 (45%).
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
const admin = vi.hoisted(() => ({ chamadas: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: async () => { guarda.chamadas++; return guarda.ok ? { ok: true, user: { id: 'u1' } } : { ok: false, reason: 'insufficient_access' } },
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { servico.criado++; return servico.cliente } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: async () => { admin.chamadas++; return false } }))
// as duas páginas-base leem o conjunto PÚBLICO do site (sem o dado privado). `openChannelPage` repete o que a real faz com a edição: UMA prova, pela guarda REAL
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', async () => {
  const { acessoPrivado, longosAcompanhadosDe } = await import('@/app/cms/(authed)/youtube/competitors/_proprio/dados')
  return {
    openChannelPage: async (id: string) => {
      const acesso = await acessoPrivado(S)
      const p = w.obs.channel(id.toLowerCase()) ?? w.obs.channel(id)
      return {
        siteId: S, now: w.obs.NOW, obs: p ? w.obs : null, canEdit: acesso.edita, leitura: acesso.leitura, ownYtIds: p?.own ? longosAcompanhadosDe(w.obs, p.id) : [], meuCanalLembrado: null,
        owns: { itens: [{ id: CANAL, name: 'Meu', nota: 'n', href: '/x' }], principal: null, listaHref: '/l' },
      }
    },
    openObservatoryPage: async () => ({ siteId: S, now: w.obs.NOW, rows: {}, obs: w.obs, meuCanalLembrado: null, savedNiche: 'todos', extra: undefined }),
  }
})
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/trail-chrome', () => ({ TrailChrome: ({ children }: { children: ReactNode }) => <div data-obs="">{children}</div> }))
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({
  pedirRemocaoCanal: vi.fn(), desfazerRemocaoCanal: vi.fn(), apagarCanalSemGuardarAction: vi.fn(), syncCompetitorNow: vi.fn(), pinVideo: vi.fn(), unpinVideo: vi.fn(), getCompetitorRemovalImpactAction: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/niche-actions', () => ({ setChannelNiche: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/forja-actions', () => ({ askForjaReading: vi.fn(), cancelForjaReading: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }), usePathname: () => '/x', useSearchParams: () => new URLSearchParams('') }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a> }))

// ---- lista fechada do canal de concorrente (falha 4 do portão da tela 15) ----
interface Leitura1 { tabela: string; eqs: Record<string, unknown> }
/** Tudo o que `carregarMedidasDoCanalInteiro` pode ler de um concorrente: dado PÚBLICO do canal e dos vídeos dele. */
const LISTA_FECHADA = new Set([
  'competitor_channels', 'competitor_videos', 'competitor_video_marks', 'competitor_video_mark_misses', 'competitor_channel_snapshots',
  'competitor_video_daily', 'competitor_video_early', 'competitor_video_versions', 'competitor_field_versions', 'competitor_video_hourly', 'competitor_agenda_runs',
])
/** Têm coluna `site_id` e são sempre lidas com ela. As outras (snapshots, daily, early, versions, agenda_runs) filhas de vídeo/canal já do site, ou do banco inteiro (agenda). */
const COM_SITE = ['competitor_channels', 'competitor_video_marks', 'competitor_video_mark_misses', 'competitor_field_versions', 'competitor_video_hourly']
/** Nenhuma tabela do dado privado do canal próprio, de comentário ou de pessoa. */
const PRIVADAS = /^yt_own_|^yt_reporting_|comment|author|user|profile|member|subscriber|audience/i
const foraDaLista = (ls: Leitura1[]) => [...new Set(ls.map(l => l.tabela).filter(t => !LISTA_FECHADA.has(t)))]
const semSite = (ls: Leitura1[]) => [...new Set(ls.filter(l => COM_SITE.includes(l.tabela) && l.eqs.site_id !== S).map(l => l.tabela))]
/** Embrulha o cliente: cada `.from(t)` guarda a tabela e os `.eq()` dessa consulta. */
function espiao(real: SupabaseClient): { client: SupabaseClient; lidas: Leitura1[] } {
  const lidas: Leitura1[] = []
  const from = (tabela: string) => {
    const q = real.from(tabela) as unknown as { eq: (c: string, v: unknown) => unknown }
    const eqs: Record<string, unknown> = {}
    lidas.push({ tabela, eqs })
    const eq = q.eq.bind(q)
    q.eq = (c, v) => { eqs[c] = v; return eq(c, v) }
    return q
  }
  return { client: { from } as unknown as SupabaseClient, lidas }
}

let db: FakeDb
beforeEach(() => {
  vi.clearAllMocks(); guarda.ok = true; guarda.chamadas = 0; servico.criado = 0; admin.chamadas = 0
  db = fakeSupabase(tabelas(alcance, diario))
  servico.cliente = db.client
})
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

async function rota(id: string, sp: Record<string, string> = {}) {
  const { default: Pagina } = await import('@/app/cms/(authed)/youtube/competitors/canal/[id]/page')
  urlDoTeste(sp) // o Next 16 não remonta a tela quando só a query muda: ela segue a URL do navegador
  return Pagina({ params: Promise.resolve({ id }), searchParams: Promise.resolve(sp) })
}
/** Tudo o que a rota entrega ao cliente (props de client components, aninhadas), serializado: é o que o payload RSC leva. */
const SERIALIZADO = (el: unknown) => JSON.stringify(el, (_k, v) => (typeof v === 'function' || typeof v === 'symbol' ? undefined : v))
const html = () => document.body.innerHTML
const texto = () => document.body.textContent ?? ''

/** Uma sentinela: o grupo de dado privado a que pertence e o padrão que a procura. Não precedida de dígito, ponto ou vírgula (uma coordenada de SVG "23.78%" não é o "78%"). */
interface Sentinela { grupo: string; nome: string; re: RegExp }
const lit = (txt: string) => new RegExp('(?<![\\d.,])' + txt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
const sen = (grupo: string, nome: string, re: RegExp = lit(nome)): Sentinela => ({ grupo, nome, re })
const cp = (re: RegExp) => new RegExp('(?<![\\d.,])' + re.source)
/**
 * Um grupo de dado privado por vez, tudo o que a tela do canal mostra dele (a negativa lista os que acharam, então um vazamento diz de qual grupo foi):
 *  - impressões: o total, as de cada dia/vídeo e as formas curtas do cabeçalho e dos cartões;
 *  - cliques: o total estimado, o do dia e a frase do cartão;
 *  - taxa de clique: o valor e os DOIS extremos do intervalo (14,6% e 15,8%);
 *  - % assistido: o do canal (cabeçalho), o de cada vídeo (aba Retenção) e o normal da faixa;
 *  - leitura contra a faixa: o que só existe porque o % assistido foi lido (relance e pastilhas "acima/abaixo do normal");
 *  - views do diário privado: o total de 28 dias, a soma de cada dia ("views por dia"), as views de cada vídeo e a linha "N views por dia" dos cartões.
 */
const SENTINELAS: Sentinela[] = [
  sen('impressões', '13.579'), sen('impressões', '7.919'), sen('impressões', '3.847'), sen('impressões', '1.813'),
  sen('impressões', '7,9 mil impressões', cp(/7,9\smil\s*impressões/)), sen('impressões', '13,6 mil impressões', cp(/13,6\smil\s*impressões/)),
  sen('cliques', '2.059'), sen('cliques', '1.584'), sen('cliques', '1584 cliques'), sen('cliques', '385 cliques'), sen('cliques', '91 cliques'),
  sen('taxa', '15,2%'), sen('taxa', '14,6%'), sen('taxa', '15,8%'),
  sen('% assistido', '59%% assistido', cp(/59%% assistido/)), sen('% assistido', '61%'), sen('% assistido', '45%'), sen('% assistido', '78%'),
  sen('% assistido', '55%'), sen('% assistido', '52%'), sen('% assistido', '70%'), sen('% assistido', '(58%)'),
  sen('contra a faixa', 'views acima do normal do canal e % assistido abaixo', /views acima do normal do canal e % assistido abaixo/),
  sen('contra a faixa', 'acima do normal da faixa', /acima do normal da faixa/), sen('contra a faixa', 'abaixo do normal da faixa', /abaixo do normal da faixa/),
  sen('views do diário', '103.310'), sen('views do diário', '4.436'), sen('views do diário', '4.476'), sen('views do diário', '3.202'),
  sen('views do diário', '13.574'), sen('views do diário', '60.844'), sen('views do diário', '24.948'), sen('views do diário', '1.988'), sen('views do diário', '1.876'),
  sen('views do diário', 'N de M dias medidos', cp(/\d+ de \d+ dias medidos/)),
  sen('views por dia', '1,2 mil views por dia', cp(/1,2\smil\s*views por dia/)), sen('views por dia', '2,2 mil views por dia', cp(/2,2\smil\s*views por dia/)),
  sen('views por dia', '891 views por dia', cp(/891 views por dia/)), sen('views por dia', '67 views por dia', cp(/67 views por dia/)),
  sen('views por dia', '891 views/dia por vídeo', cp(/891\s*views\/dia por vídeo/)),
]
/** O que só vive na árvore enviada ao cliente: as posições do intervalo da taxa no eixo (a faixa recebe as frações, não o texto) e os nomes de campo do dado cru. */
const SENTINELAS_ARVORE: Sentinela[] = [
  sen('taxa (props da faixa)', 'lo 0.7285', /"lo":0\.7285/), sen('taxa (props da faixa)', 'p 0.7582', /"p":0\.7582/), sen('taxa (props da faixa)', 'hi 0.7888', /"hi":0\.7888/),
  sen('taxa (props da faixa)', 'loTxt', /"loTxt":"14,6%"/), sen('taxa (props da faixa)', 'hiTxt', /"hiTxt":"15,8%"/),
]
const CAMPOS_CRUS = /"relatorios"|"linhas":\[\{"ytId"|"pctAssistido"|"duracaoMediaSeg"|thumbnail_impressions|thumbnail_ctr|avg_view_percentage|avg_view_duration_seconds|"ultimoRelatorio"|"ultimoDia"/
/** Os nomes das sentinelas achadas em algum dos textos. */
const achados = (lista: Sentinela[], ...textos: string[]): string[] => lista.filter(x => textos.some(t => x.re.test(t))).map(x => `${x.grupo}: ${x.nome}`)

/** As telas que a rota monta: a aba Vídeos com o painel aberto (cabeçalho, "Como o canal está", cartões) e a aba Retenção. */
const TELAS: Array<[string, Record<string, string>]> = [['Vídeos com o painel aberto', { painel: '1' }], ['Retenção', { tab: 'retencao', painel: '1' }]]
const TEXTO_NEGADO = 'Só quem edita o site vê'

describe('13.3 segurança do canal próprio: quem edita × quem só lê', () => {
  it('controle positivo: quem edita vê TODA sentinela, de cada grupo, nas duas abas (HTML ou texto), e o banco foi consultado', async () => {
    const vistos = new Set<string>()
    for (const [, sp] of TELAS) {
      guarda.chamadas = 0; servico.criado = 0; db.trips.length = 0
      render(await rota(w.canalId, sp))
      for (const a of achados(SENTINELAS, html(), texto())) vistos.add(a)
      expect(db.trips.length).toBeGreaterThan(0)
      expect(servico.criado).toBeGreaterThanOrEqual(1)
      // + a guarda de edição que mora DENTRO de `lerTestesAbertos` (entradas do A/B, T8): uma ida a mais por visita ao canal próprio de quem edita, declarada no plano
      expect(guarda.chamadas).toBe(2)
      cleanup()
    }
    expect([...vistos].sort()).toEqual(SENTINELAS.map(x => `${x.grupo}: ${x.nome}`).sort())
  })

  it('controle positivo: o que a rota entrega ao cliente TEM os números para quem edita (a negativa abaixo não passa em vazio), inclusive as frações da faixa de taxa', async () => {
    const arvore = SERIALIZADO(await rota(w.canalId, { painel: '1' }))
    for (const x of [...SENTINELAS_ARVORE, ...SENTINELAS.filter(y => ['13.579', '2.059', '15,2%', '14,6%', '15,8%', '4.436', '103.310', '(58%)'].includes(y.nome))]) expect(x.re.test(arvore), x.nome).toBe(true)
    // a aba Retenção também chega ao cliente com o % assistido de cada vídeo
    const ret = SERIALIZADO(await rota(w.canalId, { tab: 'retencao' }))
    for (const n of ['61%', '45%', '78%', '13.574', '60.844', '24.948']) expect(lit(n).test(ret), n).toBe(true)
  })

  it('quem só lê o site: nenhuma sentinela no HTML, no texto nem nos atributos, em nenhuma aba; o cliente de serviço nem é criado e o banco não é consultado', async () => {
    guarda.ok = false
    for (const [nome, sp] of TELAS) {
      render(await rota(w.canalId, sp))
      expect(achados(SENTINELAS, html(), texto()), nome).toEqual([])
      expect(servico.criado, nome).toBe(0)
      expect(db.trips, nome).toEqual([])
      // a parte pública continua e as frases dizem por quê
      expect(document.querySelector('[data-obs-screen="canal"]'), nome).not.toBeNull()
      expect(texto(), nome).toContain(TEXTO_NEGADO)
      cleanup()
    }
  })

  it('quem só lê o site: a aba Retenção diz a frase da negativa e não desenha tabela, faixas nem barras', async () => {
    guarda.ok = false
    render(await rota(w.canalId, { tab: 'retencao' }))
    expect(texto()).toContain('Só quem edita o site vê o % assistido.')
    expect(document.querySelector('.ret table')).toBeNull()
    expect(document.querySelector('.ret .mini')).toBeNull()
  })

  it('quem só lê o site: a árvore entregue ao cliente (o que o payload RSC serializa) não tem sentinela, fração da faixa de taxa nem dado cru', async () => {
    guarda.ok = false
    for (const sp of [{ painel: '1' }, { tab: 'retencao', painel: '1' }]) {
      const arvore = SERIALIZADO(await rota(w.canalId, sp))
      expect(achados([...SENTINELAS, ...SENTINELAS_ARVORE], arvore)).toEqual([])
      expect(arvore).not.toMatch(CAMPOS_CRUS)
      // a faixa de taxa nem existe nas props: nem o desenho (eixo, linhas) nem as frações
      expect(arvore).not.toMatch(/"eixo":|"loTxt"|"hiTxt"|"inconclusiva"/)
    }
  })

  it('E5b T17: quem só lê o site abre a aba Origem em "só o aviso": os nós da origem e dos cartões, resolvidos, não têm sentinela (nem o termo, nem o endereço), nenhum leitor roda e o cliente de serviço não é criado', async () => {
    guarda.ok = false
    const moldura0 = (await rota(w.canalId, { tab: 'origem' })) as { props: { children: { props: { origem?: { props: { children: { type: unknown; props: unknown } } }; periodos?: unknown } } } }
    const moldura = { props: { children: semProvedor(moldura0.props.children) } }
    expect(moldura.props.children.props.periodos).toBeUndefined()   // diário negado: os cartões da Retenção nem existem
    const no = moldura.props.children.props.origem!.props.children
    render(await (no.type as (p: unknown) => Promise<ReactNode>)(no.props))
    expect(texto()).toContain('Dado que você não vê')
    expect(achados(SENTINELAS, html(), texto())).toEqual([])
    for (const x of ['sentinela-termo-xyz', 'sentinela.example']) expect(html()).not.toContain(x)
    expect(servico.criado).toBe(0)
    expect(db.trips).toEqual([])
  })

  it('a guarda vem antes de qualquer leitura: sem a prova de edição, a ordem é guarda (edição e leitura, nada além) e depois nada (nenhum banco, nenhum cliente de serviço)', async () => {
    guarda.ok = false
    await rota(w.canalId)
    // E17 passo 0: a prova de leitura privada pergunta a edição e, negada, a leitura (2 guardas, nenhuma a mais); depois disso nada
    expect(guarda.chamadas).toBe(2)
    expect(db.trips).toEqual([])
    expect(servico.criado).toBe(0)
  })

  it('o título da aba é estático: sem generateMetadata, sem guarda, sem dado; o mesmo objeto para quem edita e para quem só lê, sem sentinela', async () => {
    for (const ok of [true, false]) {
      guarda.ok = ok; guarda.chamadas = 0
      const mod = await import('@/app/cms/(authed)/youtube/competitors/canal/[id]/page')
      const m: unknown = 'generateMetadata' in mod
        ? await (mod as { generateMetadata: (a: { params: Promise<{ id: string }> }) => Promise<unknown> }).generateMetadata({ params: Promise.resolve({ id: w.canalId }) })
        : mod.metadata
      expect(m).toEqual({ title: 'Canal · Competidores' })
      expect(achados([...SENTINELAS, ...SENTINELAS_ARVORE], JSON.stringify(m))).toEqual([])
      expect(guarda.chamadas).toBe(0)
      expect(db.trips).toEqual([])
      expect(servico.criado).toBe(0)
    }
  })

  it('canal inexistente: nem o cliente de serviço é criado nem o banco consultado; canal de concorrente: só a lista fechada de tabelas públicas é lida, sempre com o site, e nada privado', async () => {
    // (a) inexistente (e ids hostis): nada é lido nem criado
    for (const id of ['nao-existe', 'x\'; drop table', w.canalId.replace(/.$/, '1')]) {
      guarda.chamadas = 0
      render(await rota(id))
      expect(achados(SENTINELAS.filter(x => !/^\d\d%$/.test(x.nome)), html(), texto()), id).toEqual([])
      expect(guarda.chamadas, id).toBe(1)
      expect(servico.criado, id).toBe(0)
      expect(db.trips, id).toEqual([])
      cleanup()
    }
    // (b) concorrente (falha 4 do portão da tela 15): a T19 lê as medidas do concorrente com o cliente de serviço DEPOIS da guarda da
    // página (como `_outliers/montar.ts`). Só as tabelas públicas de `carregarMedidasDoCanalInteiro` podem aparecer.
    guarda.chamadas = 0; servico.criado = 0; db.trips.length = 0
    const { client, lidas } = espiao(db.client)
    servico.cliente = client
    render(await rota(concorrente.id))
    expect(achados(SENTINELAS.filter(x => !/^\d\d%$/.test(x.nome)), html(), texto()), 'concorrente').toEqual([])
    expect(guarda.chamadas).toBe(1)
    expect(lidas.length).toBeGreaterThan(0)
    expect(foraDaLista(lidas)).toEqual([])
    expect(lidas.map(l => l.tabela).filter(t => PRIVADAS.test(t))).toEqual([])
    expect(semSite(lidas)).toEqual([])
    cleanup()
  })

  it('controle negativo: uma leitura de yt_own_video_daily, de yt_reporting_*, de comentário ou sem site_id reprova as afirmações da lista fechada', () => {
    const boa: Leitura1[] = [{ tabela: 'competitor_channels', eqs: { id: 'c', site_id: S } }, { tabela: 'competitor_video_daily', eqs: {} }]
    expect(foraDaLista(boa)).toEqual([])
    expect(semSite(boa)).toEqual([])
    for (const t of ['yt_own_video_daily', 'yt_reporting_reports', 'yt_own_video_reach_daily', 'competitor_comments', 'competitor_comment_authors']) {
      const ruim = [...boa, { tabela: t, eqs: { site_id: S } }]
      expect(foraDaLista(ruim), t).toEqual([t])
      expect(ruim.map(l => l.tabela).filter(x => PRIVADAS.test(x)), t).toEqual([t])
    }
    expect(semSite([{ tabela: 'competitor_channels', eqs: { id: 'c' } }])).toEqual(['competitor_channels'])
    expect(semSite([{ tabela: 'competitor_video_hourly', eqs: { site_id: 'outro' } }])).toEqual(['competitor_video_hourly'])
  })
})
