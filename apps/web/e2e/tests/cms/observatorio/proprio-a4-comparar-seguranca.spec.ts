// apps/web/e2e/tests/cms/observatorio/proprio-a4-comparar-seguranca.spec.ts
// A PROVA DE SEGURANÇA AUTENTICADA da tela de COMPARAÇÃO com o cartão "Só o seu canal mede" (Tarefa 14, conferida em navegador na 15c). O usuário só de leitura (reporter)
// não pode receber NENHUM número privado: nem no HTML bruto, nem no DOM depois de hidratar, nem em nenhuma resposta de rede (a carga RSC pedida direto, que carrega o pacote da
// comparação), nem ao trocar o canal de um lado pelo seletor ou ao inverter os lados (a troca é no navegador, sem ir ao servidor: o pacote que o leitor recebeu não pode trazer o
// dado de nenhum canal próprio, porque ele troca para qualquer um). Três pares: (1) canal seu × concorrente; (2) dois concorrentes; (3) dois canais seus.
// CONTROLE POSITIVO do administrador para cada grupo (impressões, cliques estimados, taxa de clique com os dois extremos do intervalo, % assistido, views por dia): o mesmo desenho,
// com o dado, entrega cada grupo; sem isso a negativa do leitor não prova nada. Os valores esperados SAEM DAS LINHAS DO BANCO (somas feitas aqui), nunca da tela. Formas que o HTML
// público já traz (medidas numa linha de base do administrador SEM dado privado) são descartadas: uma forma que coincide com o público não prova nada.
// O segundo canal seu recebe um dado CLONADO com números diferentes do primeiro (impressões × 2 + 13, taxa × 0,6, views × 3 + 1, % assistido + 2,6): a prova de "nenhum canal seu" vale
// para os dois, e o controle do administrador distingue um do outro.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { taxaComIntervalo } from '@/lib/youtube/observatorio/proprio/taxa'
import { vpdText } from '@/app/cms/(authed)/youtube/competitors/_canal/numeros'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { clearOwnL2, localServiceClient, seedOwnL2 } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE })
const ROTA = '/cms/youtube/competitors/comparar'
const TELA = '[data-obs-screen="comparar"]'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const CAPA = (r: { fulfill: (o: { status: number; contentType: string; body: Buffer }) => Promise<void> }) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG })
const SAIDA = path.resolve(__dirname, '../../../../test-results/proprio-a4-comparar-seguranca.txt')

const PT = (n: number): string => n.toLocaleString('pt-BR')
const abrev = (n: number): string => {
  const dec = (x: number) => { const r = Math.round(x * 10) / 10; return (r % 1 === 0 ? String(r) : r.toFixed(1)).replace('.', ',') }
  return n < 1000 ? String(Math.round(n)) : n < 1e6 ? dec(n / 1e3) + ' mil' : dec(n / 1e6) + ' mi'
}
const formasNum = (n: number): string[] => (n >= 1000 ? [String(n), PT(n), abrev(n)] : [String(n)])
const pctUm = (frac: number): string => (frac * 100).toFixed(1).replace('.', ',') + '%'
const unicos = (a: string[]): string[] => [...new Set(a)]
const addDias = (dia: string, n: number): string => { const d = new Date(dia + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

interface Alcance { ytId: string; dia: string; imp: number; ctr: number | null }
interface Diario { ytId: string; dia: string; views: number; pct: number | null }
interface Privado { alcance: Alcance[]; diario: Diario[]; longos: Set<string> }
type Linha = Record<string, unknown>

async function ler(siteId: string, canal: string, t: string, cols: string): Promise<Linha[]> {
  const r = await localServiceClient().from(t).select(cols).eq('site_id', siteId).eq('channel_id', canal).limit(5000)
  if (r.error) throw new Error(t + ': ' + r.error.message)
  return (r.data ?? []) as unknown as Linha[]
}
async function lerPrivado(siteId: string, canal: string): Promise<Privado> {
  const vids = await ler(siteId, canal, 'youtube_videos', 'youtube_video_id, duration_seconds')
  return {
    alcance: (await ler(siteId, canal, 'yt_own_video_reach_daily', 'youtube_video_id, day_pt, thumbnail_impressions, thumbnail_ctr')).map(r => ({ ytId: String(r.youtube_video_id), dia: String(r.day_pt), imp: Number(r.thumbnail_impressions), ctr: r.thumbnail_ctr == null ? null : Number(r.thumbnail_ctr) })),
    diario: (await ler(siteId, canal, 'yt_own_video_daily', 'youtube_video_id, day_pt, views, avg_view_percentage')).map(r => ({ ytId: String(r.youtube_video_id), dia: String(r.day_pt), views: Number(r.views), pct: r.avg_view_percentage == null ? null : Number(r.avg_view_percentage) })),
    longos: new Set(vids.filter(v => Number(v.duration_seconds) > 60).map(v => String(v.youtube_video_id))),
  }
}

/** O segundo canal seu recebe um dado CLONADO do primeiro com números diferentes (só no banco local). */
async function clonarPara(siteId: string, de: string, para: string): Promise<void> {
  const sb = localServiceClient()
  const sufixo = '-c2'
  const insere = async (t: string, linhas: Linha[]) => { if (linhas.length) { const r = await sb.from(t).insert(linhas); if (r.error) throw new Error(`clone ${t}: ${r.error.message}`) } }
  const jobs = await ler(siteId, de, 'yt_reporting_jobs', '*')
  await insere('yt_reporting_jobs', jobs.map(j => ({ ...j, channel_id: para, job_id: String(j.job_id) + sufixo })))
  const rels = await ler(siteId, de, 'yt_reporting_reports', '*')
  await insere('yt_reporting_reports', rels.map(r => ({ ...r, channel_id: para, report_id: String(r.report_id) + sufixo, job_id: String(r.job_id) + sufixo })))
  const reach = await ler(siteId, de, 'yt_own_video_reach_daily', '*')
  await insere('yt_own_video_reach_daily', reach.map(r => ({
    ...r, channel_id: para, youtube_video_id: String(r.youtube_video_id) + sufixo, video_id: null, source_report_id: String(r.source_report_id) + sufixo,
    thumbnail_impressions: r.thumbnail_impressions == null ? null : Number(r.thumbnail_impressions) * 2 + 13, thumbnail_ctr: r.thumbnail_ctr == null ? null : Number(r.thumbnail_ctr) * 0.6,
  })))
  const proprios = await ler(siteId, para, 'youtube_videos', 'id, youtube_video_id, duration_seconds')
  const longos = proprios.filter(v => Number(v.duration_seconds) > 60).sort((a, b) => (String(a.youtube_video_id) < String(b.youtube_video_id) ? -1 : 1))
  const diario = await ler(siteId, de, 'yt_own_video_daily', '*')
  const origem = unicos(diario.map(d => String(d.youtube_video_id))).sort()
  if (longos.length === 0) throw new Error('o segundo canal seu não tem vídeo longo para receber o diário clonado')
  const mapa = new Map(origem.slice(0, longos.length).map((yt, i) => [yt, longos[i]!]))
  await insere('yt_own_video_daily', diario.filter(d => mapa.has(String(d.youtube_video_id))).map(d => {
    const v = mapa.get(String(d.youtube_video_id))!
    const views = d.views == null ? null : Number(d.views) > 0 ? Number(d.views) * 3 + 1 : 0
    return { ...d, channel_id: para, youtube_video_id: String(v.youtube_video_id), video_id: String(v.id), views, avg_view_percentage: d.avg_view_percentage == null ? null : Number(d.avg_view_percentage) + 2.6 }
  }))
}

interface Sentinela { grupo: string; formas: string[] }
/** Todas as formas em que cada grupo de número privado de UM canal poderia viajar, calculadas das linhas do banco. */
function sentinelasDe(rotulo: string, p: Privado): Sentinela[] {
  const cliquesDe = (l: Alcance[]) => l.reduce((a, r) => a + r.imp * (r.ctr ?? 0), 0)
  const impDe = (l: Alcance[]) => l.reduce((a, r) => a + r.imp, 0)
  const porYt = new Map<string, Alcance[]>(), porDia = new Map<string, Alcance[]>()
  for (const r of p.alcance) { porYt.set(r.ytId, [...(porYt.get(r.ytId) ?? []), r]); porDia.set(r.dia, [...(porDia.get(r.dia) ?? []), r]) }
  const grupos = [p.alcance, ...porYt.values()].filter(l => impDe(l) > 0)
  const extremos = grupos.map(l => taxaComIntervalo(cliquesDe(l), impDe(l))!)
  // % assistido do canal: média pesada pelas views, nos 28 dias que terminam no último dia gravado, nos longos
  const ultimo = p.diario.map(d => d.dia).sort().at(-1) ?? null
  let soma = 0, n = 0
  const viewsPorVideo = new Map<string, { s: number; n: number }>()
  if (ultimo) {
    const de = addDias(ultimo, -27)
    for (const d of p.diario) {
      if (!p.longos.has(d.ytId) || d.dia < de || d.dia > ultimo) continue
      const m = viewsPorVideo.get(d.ytId) ?? { s: 0, n: 0 }; m.s += d.views; m.n++; viewsPorVideo.set(d.ytId, m)
      if (d.views > 0 && d.pct != null) { soma += d.pct * d.views; n += d.views }
    }
  }
  const medias = [...viewsPorVideo.values()].filter(m => m.n >= 7).map(m => m.s / m.n).sort((a, b) => a - b)
  const h = medias.length >> 1
  const vpd = medias.length === 0 ? null : medias.length % 2 ? medias[h]! : (medias[h - 1]! + medias[h]!) / 2
  const pctPorVideo = new Map<string, { s: number; n: number }>()
  for (const d of p.diario) if (d.views > 0 && d.pct != null) { const m = pctPorVideo.get(d.ytId) ?? { s: 0, n: 0 }; m.s += d.pct * d.views; m.n += d.views; pctPorVideo.set(d.ytId, m) }
  const total = taxaComIntervalo(cliquesDe(p.alcance), impDe(p.alcance))
  const nm = (g: string) => `${g} [${rotulo}]`
  return [
    { grupo: nm('impressões (total, de cada vídeo e de cada dia)'), formas: unicos([...grupos.map(impDe), ...[...porDia.values()].map(impDe)].flatMap(formasNum)) },
    { grupo: nm('cliques estimados (total, de cada vídeo e de cada dia)'), formas: unicos([...grupos.map(cliquesDe), ...[...porDia.values()].map(cliquesDe)].map(Math.round).flatMap(formasNum)) },
    { grupo: nm('taxa de clique (valor, só ou com a frase do canal)'), formas: unicos([...(total ? [pctUm(total.taxa)] : []), ...extremos.flatMap(t => [`${pctUm(t.taxa)} das impressões viraram clique`])]) },
    { grupo: nm('taxa de clique: o extremo de baixo e o de cima do intervalo (os dois)'), formas: unicos([...(total ? [pctUm(total.lo), pctUm(total.hi), `entre ${pctUm(total.lo)} e ${pctUm(total.hi)}`] : []), ...extremos.flatMap(t => [`${pctUm(t.lo)} a ${pctUm(t.hi)}`, `entre ${pctUm(t.lo)} e ${pctUm(t.hi)}`])]) },
    // o "NN%" sozinho é ambíguo (aparece em texto público): vale a forma COM O CONTEXTO do cartão (a marcação no HTML, o rótulo colado no texto, o campo no pacote)
    { grupo: nm('% assistido (do canal, no contexto do cartão, e por vídeo)'), formas: unicos([...(n > 0 ? [`so-vl num">${Math.round(soma / n)}%`, `28 dias${Math.round(soma / n)}%`, `"valor":"${Math.round(soma / n)}%"`] : []), ...[...pctPorVideo.values()].map(m => `Quem assiste vê em média ${Math.round(m.s / m.n)}%`)]) },
    // idem as views por dia: o número da célula da tabela ("v1 num") e o campo do pacote ("texto")
    { grupo: nm('views por dia (mediana dos longos, 28 dias do diário, no contexto da tabela)'), formas: vpd == null ? [] : unicos([`v1 num">${vpdText(vpd, PT)!}</span>`, `"texto":"${vpdText(vpd, PT)!}"`]) },
  ]
}

interface Fonte { html: string; dom: string; rede: string; rsc: string; contagens: Record<string, number> }
const ondeEsta = (f: Fonte, s: string): Array<'html' | 'dom' | 'rede'> => (['html', 'dom', 'rede'] as const).filter(k => f[k].includes(s))
const trecho = (txt: string, s: string): string => { const i = txt.indexOf(s); return txt.slice(Math.max(0, i - 50), i + s.length + 50).replace(/\s+/g, ' ') }
const MARCADORES = {
  valoresDoCartao: `${TELA} [data-so-seu-canal] .so-vl`,
  linhasDoCartao: `${TELA} [data-so-seu-canal] ul.so-linhas > li`,
  faixaDaTaxa: `${TELA} [data-so-seu-canal] .tf`,
  viewsPorDiaNaTabela: `${TELA} tr:has(th:text-is("Views por dia nos longos")) td.cA .v1, ${TELA} tr:has(td:text-is("Views por dia nos longos")) td.cA .v1`,
} as const
const FRASE_NEGADO = 'Só quem edita o site vê estes números.'

async function abrirPagina(ctx: BrowserContext, url: string): Promise<Page> {
  const pg = await ctx.newPage()
  await pg.route(/(ytimg|ggpht)\.com/, CAPA)
  await pg.goto(url)
  await pg.locator(`${TELA}:visible .cp-side`).first().waitFor({ timeout: 60_000 })
  await pg.waitForLoadState('networkidle')
  return pg
}
const domDe = async (pg: Page): Promise<string> => (await pg.content()) + '\n' + (await pg.evaluate(() => document.body.innerText + '\n' + (document.body.textContent ?? '').replace(/\s+/g, ' ')))
async function contar(pg: Page): Promise<Record<string, number>> {
  const o: Record<string, number> = {}
  for (const [k, sel] of Object.entries(MARCADORES)) o[k] = await pg.locator(sel).count()
  return o
}

/** O que o navegador recebeu ao abrir o par: HTML bruto, DOM hidratado, as respostas de rede e a carga RSC pedida direto (a que leva o pacote da comparação). */
async function colher(ctx: BrowserContext, url: string): Promise<Fonte> {
  const pg = await ctx.newPage()
  try {
    await pg.route(/(ytimg|ggpht)\.com/, CAPA)
    const corpos: Array<Promise<string>> = []
    pg.on('response', r => {
      const tipo = r.request().resourceType(), ct = r.headers()['content-type'] ?? ''
      if (tipo === 'document' || /\/_next\/static\//.test(r.url()) || /^(image|font)\//.test(ct) || /css|javascript/.test(ct)) return
      corpos.push(r.text().catch(() => ''))
    })
    const bruto = await ctx.request.get(url, { timeout: 60_000 })
    expect(bruto.status(), `HTML bruto de ${url}`).toBe(200)
    const html = await bruto.text()
    await pg.goto(url)
    await pg.locator(`${TELA}:visible .cp-side`).first().waitFor({ timeout: 60_000 })
    await pg.waitForLoadState('networkidle')
    const dom = await domDe(pg)
    const rsc = await (await ctx.request.get(url, { headers: { RSC: '1' }, timeout: 60_000 })).text()
    expect(rsc.length, `carga RSC de ${url} veio vazia: a prova de rede estaria vazia`).toBeGreaterThan(500)
    return { html, dom, rsc, rede: [...(await Promise.all(corpos)), rsc].join('\n'), contagens: await contar(pg) }
  } finally { await pg.close() }
}

/** Os estados que o seletor e o "Inverter lados" produzem no navegador, sem ir ao servidor: cada um é varrido (DOM) e as requisições depois da abertura são contadas. */
async function trocarNoNavegador(ctx: BrowserContext, inicial: string, passos: Array<{ nome: string; acao: (pg: Page) => Promise<void>; esperaCartoes: number }>): Promise<{ estados: Array<{ nome: string; dom: string; cartoes: number; textoCartoes: string[]; contagens: Record<string, number> }>; pedidos: string[]; corposNovos: string }> {
  const pg = await abrirPagina(ctx, inicial)
  try {
    const pedidos: string[] = []
    const corpos: Array<Promise<string>> = []
    pg.on('request', r => { if (r.resourceType() !== 'image' && r.resourceType() !== 'font') pedidos.push(`${r.method()} ${r.resourceType()} ${r.url().slice(0, 140)}`) })
    pg.on('response', r => { if (r.request().resourceType() !== 'image') corpos.push(r.text().catch(() => '')) })
    const estados = []
    estados.push({ nome: 'inicial', dom: await domDe(pg), cartoes: await pg.locator(`${TELA}:visible [data-so-seu-canal]`).count(), textoCartoes: await pg.locator(`${TELA}:visible [data-so-seu-canal]`).evaluateAll(es => es.map(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim())), contagens: await contar(pg) })
    for (const p of passos) {
      await p.acao(pg)
      await expect(pg.locator(`${TELA}:visible [data-so-seu-canal]`), `depois de "${p.nome}"`).toHaveCount(p.esperaCartoes)
      estados.push({ nome: p.nome, dom: await domDe(pg), cartoes: p.esperaCartoes, textoCartoes: await pg.locator(`${TELA}:visible [data-so-seu-canal]`).evaluateAll(es => es.map(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim())), contagens: await contar(pg) })
    }
    await pg.waitForTimeout(500)
    return { estados, pedidos, corposNovos: (await Promise.all(corpos)).join('\n') }
  } finally { await pg.close() }
}

test.describe('A4 15c: a COMPARAÇÃO com o cartão "Só o seu canal mede": quem só lê o site não recebe número privado (HTML, DOM, rede e troca no navegador), com controle positivo do administrador por grupo', () => {
  test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

  test('três pares (canal seu × concorrente, dois concorrentes, dois canais seus), HTML, DOM, rede e seletor: o reporter não recebe nenhuma forma de nenhum grupo; o administrador recebe cada uma', async ({ browser, page }) => {
    test.setTimeout(900_000)
    const siteId = await ensureSeeded({ ownPreset: '2', ownL2: 'retencao' })
    const ids = seedIdsOf(siteId)
    const sb = localServiceClient()
    const own1 = ids.own('tnfigueiredo'), own2 = ids.own('tnfigueiredo-en'), matt = ids.channel('matt-wolfe'), leo = ids.channel('leo-khev')
    const semear = async () => { await seedOwnL2(siteId, 'retencao', '2', sb); await clonarPara(siteId, own1, own2) }
    await clearOwnL2(siteId, sb); await semear()
    const p1 = await lerPrivado(siteId, own1), p2 = await lerPrivado(siteId, own2)
    const lista = [...sentinelasDe('canal 1', p1), ...sentinelasDe('canal 2', p2)]
    for (const g of lista) expect(g.formas.length, `o grupo "${g.grupo}" tem formas`).toBeGreaterThan(0)
    const impTotais = [p1, p2].map(p => p.alcance.reduce((a, r) => a + r.imp, 0))
    expect(impTotais[0], 'o clone tem impressões diferentes do original').not.toBe(impTotais[1])

    const pares = [
      { nome: 'canal seu × concorrente', url: `${ROTA}?a=${own1}&b=${matt}`, cartoes: 1 },
      { nome: 'dois concorrentes', url: `${ROTA}?a=${matt}&b=${leo}`, cartoes: 0 },
      { nome: 'dois canais seus', url: `${ROTA}?a=${own1}&b=${own2}`, cartoes: 2 },
    ]
    // 1) a LINHA DE BASE: o administrador SEM nenhum dado privado. O que aparece aqui é público.
    const base: Record<string, Fonte> = {}
    try {
      await clearOwnL2(siteId, sb)
      for (const par of pares) base[par.nome] = await colher(page.context(), par.url)
    } finally { await clearOwnL2(siteId, sb); await semear() }
    // 2) o administrador COM o dado: o controle positivo
    const admin: Record<string, Fonte> = {}
    for (const par of pares) admin[par.nome] = await colher(page.context(), par.url)
    // 3) o reporter, que também troca o seletor no navegador
    const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '../../../.auth/reporter.json'), viewport: { width: 1440, height: 900 } })
    const leitor: Record<string, Fonte> = {}
    const intrusos: string[] = []
    let trocaLeitor!: Awaited<ReturnType<typeof trocarNoNavegador>>
    const seletor = (lado: 'A' | 'B', id: string) => async (pg: Page) => { await pg.locator(`${TELA}:visible .cp-side[data-lado="${lado}"] select`).selectOption(id) }
    const inverter = async (pg: Page) => { await pg.locator(`${TELA}:visible`).getByRole('button', { name: /Inverter lados/ }).click() }
    // a sequência: dois concorrentes → A vira o canal seu 1 → B vira o canal seu 2 → inverte → A volta a ser concorrente → B volta a ser concorrente
    const passos = [
      { nome: 'A = canal seu 1', acao: seletor('A', own1), esperaCartoes: 1 },
      { nome: 'B = canal seu 2', acao: seletor('B', own2), esperaCartoes: 2 },
      { nome: 'inverter lados', acao: inverter, esperaCartoes: 2 },
      { nome: 'A = concorrente (Leo)', acao: seletor('A', leo), esperaCartoes: 1 },
      { nome: 'B = concorrente (Matt)', acao: seletor('B', matt), esperaCartoes: 0 },
    ]
    try {
      await ctx.route('**/*', async route => {
        const r = route.request()
        if (r.method() === 'POST' && r.headers()['next-action']) { intrusos.push(`${r.headers()['next-action']} ${r.url()}`); await route.abort('blockedbyclient'); return }
        await route.fallback()
      })
      for (const par of pares) leitor[par.nome] = await colher(ctx, par.url)
      trocaLeitor = await trocarNoNavegador(ctx, pares[1]!.url, passos)
    } finally { await ctx.close() }
    expect(intrusos, 'nenhuma server action no caminho do reporter').toEqual([])
    // o administrador faz a mesma sequência (controle positivo da troca no navegador)
    const trocaAdmin = await trocarNoNavegador(page.context(), pares[1]!.url, passos)

    // 4) a conta
    const nomes = pares.map(p => p.nome)
    const todasAsFontes = (f: Record<string, Fonte>, extra?: string): Fonte[] => [...nomes.map(n => f[n]!), ...(extra ? [{ html: '', dom: extra, rede: '', rsc: '', contagens: {} }] : [])]
    const ambigua = (forma: string): boolean => todasAsFontes(base).some(f => ondeEsta(f, forma).length > 0)
    const relatorio: string[] = []
    const vazou: string[] = []
    const semControle: string[] = []
    const domAdminTroca = trocaAdmin.estados.map(e => e.dom).join('\n')
    const domLeitorTroca = trocaLeitor.estados.map(e => e.dom).join('\n')
    for (const g of lista) {
      const validas = g.formas.filter(f => !ambigua(f))
      const noAdmin = (f: string) => nomes.some(n => ondeEsta(admin[n]!, f).length > 0) || domAdminTroca.includes(f)
      const comControle = validas.filter(noAdmin)
      const onde = unicos(nomes.flatMap(n => comControle.flatMap(f => ondeEsta(admin[n]!, f).map(o => `${n}/${o}`))))
      const negativas: string[] = []
      for (const f of validas) {
        for (const n of nomes) for (const o of ondeEsta(leitor[n]!, f)) { vazou.push(`SEGURANÇA: "${f}" (${g.grupo}) chegou ao reporter no par "${n}" em ${o}: …${trecho(leitor[n]![o], f)}…`); negativas.push(`${n}/${o}`) }
        for (const e of trocaLeitor.estados) if (e.dom.includes(f)) { vazou.push(`SEGURANÇA: "${f}" (${g.grupo}) apareceu ao reporter depois de "${e.nome}": …${trecho(e.dom, f)}…`); negativas.push(`troca/${e.nome}`) }
        if (trocaLeitor.corposNovos.includes(f)) { vazou.push(`SEGURANÇA: "${f}" (${g.grupo}) veio numa resposta de rede da troca no navegador`); negativas.push('troca/rede') }
      }
      if (comControle.length === 0) semControle.push(g.grupo)
      relatorio.push(`${g.grupo} | formas ${g.formas.length}, públicas descartadas ${g.formas.length - validas.length}, com controle positivo ${comControle.length} (${comControle.slice(0, 4).join(' ; ')}) | admin recebe em: ${onde.slice(0, 5).join(', ') || 'só na troca do seletor'}${onde.length > 5 ? ' (+' + (onde.length - 5) + ')' : ''} | reporter: ${negativas.length ? 'VAZOU ' + negativas.join(', ') : 'limpo em html, dom e rede, em ' + nomes.length + ' pares e ' + trocaLeitor.estados.length + ' estados do seletor'}`)
    }
    for (const n of nomes) relatorio.push(`tamanhos (${n}): reporter html ${leitor[n]!.html.length}, dom ${leitor[n]!.dom.length}, rsc ${leitor[n]!.rsc.length}; admin html ${admin[n]!.html.length}, dom ${admin[n]!.dom.length}, rsc ${admin[n]!.rsc.length}`)

    // 5) marcadores estruturais: o desenho que só o administrador recebe
    for (const par of pares) {
      const a = admin[par.nome]!.contagens, l = leitor[par.nome]!.contagens
      relatorio.push(`marcadores (${par.nome}): administrador ${JSON.stringify(a)} | reporter ${JSON.stringify(l)}`)
      expect(l.valoresDoCartao, `SEGURANÇA: o reporter não recebe nenhum valor no cartão (${par.nome})`).toBe(0)
      expect(l.linhasDoCartao, `SEGURANÇA: o reporter não recebe nenhuma linha do cartão (${par.nome})`).toBe(0)
      expect(l.faixaDaTaxa, `SEGURANÇA: o reporter não recebe a faixa da taxa (${par.nome})`).toBe(0)
      if (par.cartoes > 0) {
        expect(a.valoresDoCartao, `controle positivo: o administrador recebe valores no cartão (${par.nome})`).toBeGreaterThan(0)
        expect(a.linhasDoCartao, `controle positivo: o administrador recebe as linhas do cartão (${par.nome})`).toBe(4 * par.cartoes)
        expect(a.faixaDaTaxa, `controle positivo: o administrador recebe a faixa da taxa (${par.nome})`).toBeGreaterThan(0)
      } else {
        expect(a.valoresDoCartao, 'dois concorrentes: nem o administrador vê cartão').toBe(0)
      }
    }
    // o leitor vê, no lugar dos números, a frase do motivo (uma por cartão)
    expect(leitor['canal seu × concorrente']!.dom).toContain(FRASE_NEGADO)
    expect(leitor['dois canais seus']!.dom.split(FRASE_NEGADO).length - 1, 'uma frase de motivo por cartão no HTML+DOM (texto e conteúdo)').toBeGreaterThanOrEqual(2)
    expect(leitor['dois concorrentes']!.dom).not.toContain('Só o seu canal mede')
    // o pacote que o leitor recebeu (a carga RSC pedida direto): a entrada de CADA canal seu é só `negado` e sem View; a do administrador traz as quatro linhas
    for (const par of pares) {
      const rsc = leitor[par.nome]!.rsc
      expect(rsc, `o pacote do reporter (${par.nome}) leva soSeuCanal`).toContain('"soSeuCanal"')
      for (const id of [own1, own2]) expect(rsc, `o pacote do reporter (${par.nome}): a entrada do canal ${id}`).toContain(`"${id}":{"acesso":"negado","view":null}`)
      expect(rsc, `o pacote do reporter (${par.nome}) não traz nenhuma View`).not.toMatch(/"linhas":\[\{"chave"/)
      expect(rsc).not.toContain('"acesso":"ok"')
      const rsA = admin[par.nome]!.rsc
      expect(rsA, `controle positivo: o pacote do administrador (${par.nome}) traz a View de cada canal seu`).toMatch(/"linhas":\[\{"chave":"impressoes"/)
      relatorio.push(`pacote (${par.nome}): reporter soSeuCanal só negado (ok); administrador traz ${(rsA.match(/"chave":"impressoes"/g) ?? []).length} View(s)`)
    }
    // a troca no navegador: nenhuma requisição de dados, e o cartão sempre diz o motivo
    const dados = trocaLeitor.pedidos.filter(p => !/\.(css|js|woff2?|png|svg|ico)(\?|$)/.test(p) && !/_next\/static|\/_next\/image|favicon/.test(p))
    relatorio.push(`troca no navegador (reporter): ${trocaLeitor.estados.length} estados, ${trocaLeitor.pedidos.length} requisições depois da abertura (de dados: ${dados.length}${dados.length ? ': ' + dados.slice(0, 3).join(' | ') : ''})`)
    expect(dados, 'trocar o seletor e inverter não vão ao servidor').toEqual([])
    for (const e of trocaLeitor.estados) {
      relatorio.push(`reporter, estado "${e.nome}": ${e.cartoes} cartão(ões); marcadores ${JSON.stringify(e.contagens)}`)
      expect(e.contagens.valoresDoCartao, `SEGURANÇA: o reporter não vê valor depois de "${e.nome}"`).toBe(0)
      expect(e.contagens.linhasDoCartao).toBe(0)
      for (const t of e.textoCartoes) expect(t, `o cartão do reporter depois de "${e.nome}" só diz o motivo`).toContain(FRASE_NEGADO)
    }
    for (const e of trocaAdmin.estados) {
      relatorio.push(`administrador, estado "${e.nome}": ${e.cartoes} cartão(ões); marcadores ${JSON.stringify(e.contagens)}`)
      if (e.cartoes > 0) expect(e.contagens.valoresDoCartao, `controle positivo: o administrador vê valores depois de "${e.nome}"`).toBeGreaterThan(0)
    }
    fs.mkdirSync(path.dirname(SAIDA), { recursive: true }); fs.writeFileSync(SAIDA, relatorio.join('\n') + '\n')
    test.info().annotations.push(...relatorio.map(r => ({ type: 'medida', description: r })))

    expect(vazou, 'DEFEITO DE SEGURANÇA: dado privado chegou ao usuário só de leitura').toEqual([])
    expect(semControle, 'grupos sem controle positivo: a negativa não provaria nada').toEqual([])
    expect(domLeitorTroca.length).toBeGreaterThan(1000)
  })
})
