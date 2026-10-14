// apps/web/e2e/tests/cms/observatorio/proprio-a5-retencao.spec.ts
// A5 · E8 · Tarefa 13: a seção "Retenção" da página do vídeo próprio, em navegador. Os cinco estados (curva completa, curva incompleta, sem curva coletada ainda,
// leitura que falhou, só quem edita vê) a 1440 e a 390 px, tema claro e escuro, e o ataque do caminho infeliz: curva de 99, 101 e 1 ponto, pico acima de 120%,
// ponto fora de 0..1, duração desconhecida, título de 100 caracteres, virada do dia em São Paulo, tabela e coluna ausentes.
// O dado é o perfil `retencao` da semente (observatorio-seed.ts, RET_CURVA); os esperados SAEM DAS LINHAS DO BANCO e de contas escritas aqui, nunca da tela.
// Nada é escrito pela tela: toda server action é abortada e reprova o teste. Capturas em RETENCAO_SHOTS (padrão: test-results/retencao-shots).
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { diaYoutube, localServiceClient, ORACLE_NOW, pontosCurvaRetencao, RET_CURVA, somaDias } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE })
const ROTA = '/cms/youtube/competitors'
const V = '[data-obs-screen="video-proprio"]'
const SEC_CSS = `${V} section[aria-labelledby="vb-ret-h"]`
const SEC = `${V}:visible section[aria-labelledby="vb-ret-h"]`
const REPORTER = path.resolve(__dirname, '../../../.auth/reporter.json')
const SHOTS = process.env.RETENCAO_SHOTS ?? path.resolve(__dirname, '../../../../test-results/retencao-shots')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const DB = 'supabase_db_bythiagofigueiredo'

const FRASE_NAO_COLETADA = 'Ainda não coletamos esta curva. Quando coletarmos, esta seção mostra onde as pessoas saem do vídeo e onde voltam.'
const FRASE_ERRO = 'A leitura da curva falhou agora; recarregue a página.'
const FRASE_NEGADO = 'Só quem edita o site vê a curva de retenção deste vídeo.'

/* ------------------------------------------------------------------ contas independentes da tela */
const p2 = (n: number): string => (n < 10 ? '0' : '') + n
const mmss = (sec: number): string => { const s = Math.round(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return h ? `${h}:${p2(m)}:${p2(r)}` : `${m}:${p2(r)}` }
/** dd/mm de um instante, no relógio de São Paulo. */
const diaMesSP = (instante: string): string => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(instante))
/** dd/mm de uma data AAAA-MM-DD (sem fuso: é uma data, não um instante). */
const diaMesData = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`

/* ------------------------------------------------------------------ ambiente */
let siteId = '', own = ''
let vid: Record<string, { id: string; dur: number | null; pub: string; title: string }> = {}
let intrusos: string[] = [], erros: string[] = [], cincoXX: string[] = [], falhas: string[] = []
const medidas: string[] = []
const medida = (t: string): void => {
  const linha = `[${test.info().title.slice(0, 50)}] ${t}`
  medidas.push(linha); test.info().annotations.push({ type: 'medida', description: t })
  fs.mkdirSync(SHOTS, { recursive: true }); fs.appendFileSync(path.join(SHOTS, 'medidas.txt'), linha + '\n')   // em arquivo na hora: um teste que falha reinicia o worker
}

const sql = (comando: string): string => execFileSync('docker', ['exec', DB, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atc', comando], { encoding: 'utf8' }).trim()

async function carregarVideos(): Promise<void> {
  const r = await localServiceClient().from('youtube_videos').select('id, youtube_video_id, duration_seconds, published_at, title').eq('site_id', siteId).eq('channel_id', own)
  expect(r.error).toBeNull()
  vid = Object.fromEntries((r.data ?? []).map(x => [String(x.youtube_video_id), { id: String(x.id), dur: x.duration_seconds == null ? null : Number(x.duration_seconds), pub: String(x.published_at), title: String(x.title) }]))
}
test.beforeAll(async () => {
  test.setTimeout(240_000)
  siteId = await ensureSeeded({ ownPreset: '2', ownL2: 'retencao' })
  own = seedIdsOf(siteId).own('tnfigueiredo')
  await carregarVideos()
})
test.afterAll(async () => {
  test.setTimeout(120_000)
  // o que os testes de tabela e coluna ausentes alteram volta SEMPRE, mesmo se um teste morreu no meio
  try {
    if (sql("select to_regclass('public.yt_own_video_retention_gio') is not null") === 't') sql('alter table public.yt_own_video_retention_gio rename to yt_own_video_retention')
    if (sql("select count(*) from information_schema.columns where table_name='yt_own_video_retention' and column_name='points_gio'") === '1') sql('alter table public.yt_own_video_retention rename column points_gio to points')
  } finally {
    await clearSeeded()
  }
})
test.beforeEach(() => { intrusos = []; erros = []; cincoXX = []; falhas = [] })
test.afterEach(() => {
  if (intrusos.length) throw new Error(`Server action INESPERADA abortada: ${intrusos.length}. Primeira: ${intrusos[0]}`)
  expect(cincoXX, 'respostas 5xx').toEqual([])
  expect(falhas, 'requisições que falharam').toEqual([])
  expect(erros, 'erros de console, avisos de hidratação e erros de página').toEqual([])
})

async function armar(ctx: BrowserContext): Promise<void> {
  await ctx.route('**/*', async route => {
    const r = route.request()
    if (r.method() === 'POST' && r.headers()['next-action']) { intrusos.push(`${r.headers()['next-action']} ${r.url()}`); await route.abort('blockedbyclient'); return }
    await route.fallback()
  })
  await ctx.route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
}
function vigiar(page: Page): void {
  page.on('console', m => {
    if (m.type() !== 'error' && !(m.type() === 'warning' && /hydrat/i.test(m.text()))) return
    const loc = m.location().url
    if (/ytimg\.com|ggpht\.com|blob\.vercel|challenges\.cloudflare/.test(loc + m.text())) return
    erros.push(`${m.type()}: ${m.text().slice(0, 220)} @ ${loc}`)
  })
  page.on('pageerror', e => erros.push('pageerror: ' + e.message.slice(0, 220)))
  page.on('response', r => { if (r.status() >= 500) cincoXX.push(r.status() + ' ' + r.url().slice(0, 120)) })
  page.on('requestfailed', r => {
    const u = r.url()
    if (/ytimg\.com|ggpht\.com|blob\.vercel|challenges\.cloudflare|_next\/webpack-hmr|\.well-known/.test(u)) return
    if (r.failure()?.errorText === 'net::ERR_ABORTED') return   // navegação que substitui a anterior
    falhas.push(`${r.failure()?.errorText} ${u.slice(0, 120)}`)
  })
}

interface Tela { nome: string; largura: number; altura: number; tema: 'dark' | 'light' }
const TELAS: Tela[] = [
  { nome: '1440-escuro', largura: 1440, altura: 900, tema: 'dark' }, { nome: '1440-claro', largura: 1440, altura: 900, tema: 'light' },
  { nome: '390-escuro', largura: 390, altura: 844, tema: 'dark' }, { nome: '390-claro', largura: 390, altura: 844, tema: 'light' },
]
async function contexto(browser: Browser, t: Tela, estado: string = ADMIN_STATE): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ storageState: estado, viewport: { width: t.largura, height: t.altura } })
  await ctx.addCookies([{ name: 'btf_theme', value: t.tema, url: 'http://localhost:3099' }])
  await armar(ctx)
  const page = await ctx.newPage()
  page.setDefaultTimeout(30_000)
  vigiar(page)
  return { ctx, page }
}
async function abrir(page: Page, yt: string): Promise<void> {
  await page.goto(`${ROTA}/video/${vid[yt]!.id}?from=canais&canal=${own}`)
  await page.locator(SEC).waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
}
const texto = async (page: Page, sel: string): Promise<string> => ((await page.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim())

/** O layout da seção: a página não rola de lado, nada passa da coluna, o menor texto (inclusive o do SVG) e a cor da curva resolvida. */
async function medirSecao(page: Page) {
  return page.evaluate(sel => {
    const sec = [...document.querySelectorAll<HTMLElement>(sel)].find(e => e.getClientRects().length > 0)!
    const sb = sec.getBoundingClientRect()
    const fora: string[] = []
    sec.querySelectorAll<Element>('*').forEach(e => {
      if (!e.getClientRects().length) return
      const r = e.getBoundingClientRect()
      if (r.width > 0 && (r.right > sb.right + 1 || r.left < sb.left - 1)) fora.push(`${e.tagName.toLowerCase()}.${String((e.className as unknown as { baseVal?: string }).baseVal ?? e.className).slice(0, 24)} ${Math.round(r.left - sb.left)}..${Math.round(r.right - sb.left)} de ${Math.round(sb.width)}`)
    })
    let menor = 99
    sec.querySelectorAll<Element>('*').forEach(e => {
      if (!e.getClientRects().length || ![...e.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim())) return
      menor = Math.min(menor, parseFloat(getComputedStyle(e).fontSize))
    })
    const linha = sec.querySelector<SVGPathElement>('.rc-linha')
    const svg = sec.querySelector<SVGSVGElement>('svg.rc-svg')
    return {
      docScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      fora: fora.slice(0, 5), menor, secW: Math.round(sb.width), svgW: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
      stroke: linha ? getComputedStyle(linha).stroke : null,
      fillArea: sec.querySelector('.rc-area') ? getComputedStyle(sec.querySelector('.rc-area')!).fill : null,
    }
  }, SEC_CSS)
}
const TRANSPARENTE = /^(none|transparent|rgba\(0, 0, 0, 0\))$/

/** Confere o que vale para qualquer estado, em qualquer tela, e guarda a captura da seção. */
async function conferirTela(page: Page, t: Tela, estado: string, comGrafico: boolean): Promise<void> {
  const m = await medirSecao(page)
  medida(`${estado} · ${t.nome}: seção ${m.secW}px, svg ${m.svgW}px, rolagem de lado ${m.docScroll}, menor texto ${m.menor}px, fora da coluna ${m.fora.length}, stroke ${m.stroke}`)
  expect(m.docScroll, `${estado} ${t.nome}: a página rola de lado`).toBeLessThanOrEqual(0)
  expect(m.fora, `${estado} ${t.nome}: elementos fora da coluna da seção`).toEqual([])
  expect(m.menor, `${estado} ${t.nome}: o menor texto`).toBeGreaterThanOrEqual(12)
  if (comGrafico) {
    expect(m.svgW, `${estado} ${t.nome}: o SVG cabe na seção`).toBeLessThanOrEqual(m.secW)
    expect(m.stroke, `${estado} ${t.nome}: a cor da curva resolve (não transparente)`).not.toMatch(TRANSPARENTE)
    expect(m.fillArea, `${estado} ${t.nome}: a cor da área resolve`).not.toMatch(TRANSPARENTE)
  }
  fs.mkdirSync(SHOTS, { recursive: true })
  // a barra de navegação fixa do celular cobre o pé da seção numa janela baixa: a captura é feita numa janela alta e a janela volta ao tamanho de antes
  await page.setViewportSize({ width: t.largura, height: 2400 })
  await page.locator(SEC).scrollIntoViewIfNeeded()
  await page.locator(SEC).screenshot({ path: path.join(SHOTS, `${estado}-${t.nome}.png`), animations: 'disabled' })
  await page.setViewportSize({ width: t.largura, height: t.altura })
}

/* ------------------------------------------------------------------ dado do banco */
interface PontoDb { t: number; ratio: number }
async function curvaDoBanco(yt: string): Promise<{ pontos: PontoDb[]; coletada: string; windowEnd: string }> {
  const r = await localServiceClient().from('yt_own_video_retention').select('points, collected_at, window_end').eq('site_id', siteId).eq('youtube_video_id', yt).eq('window_kind', 'vida').single()
  expect(r.error).toBeNull()
  return { pontos: r.data!.points as PontoDb[], coletada: String(r.data!.collected_at), windowEnd: String(r.data!.window_end) }
}
/** O primeiro ponto abaixo de 50%: a regra da metade, escrita aqui de novo, em três linhas. */
const metadeSaiuEm = (pontos: PontoDb[]): number | null => pontos.find(p => p.ratio < 0.5)?.t ?? null

/** Escreve (ou troca) a curva da vida de um vídeo de ataque; limpa no `finally` do teste. */
async function escreverCurva(yt: string, points: object[], extra: Record<string, unknown> = {}): Promise<void> {
  const sb = localServiceClient()
  const del = await sb.from('yt_own_video_retention').delete().eq('site_id', siteId).eq('youtube_video_id', yt)
  expect(del.error).toBeNull()
  const fim = somaDias(diaYoutube(ORACLE_NOW), -3)
  const v = vid[yt]!
  const ins = await sb.from('yt_own_video_retention').insert({
    youtube_video_id: yt, window_kind: 'vida', segment: 'organico', window_end: fim, window_start: diaYoutube(Date.parse(v.pub)), requested_end: fim, site_id: siteId, video_id: v.id,
    channel_id: own, points, point_count: points.length, metrics_returned: ['audienceWatchRatio'], views_at_read: 500, source: 'analytics_api',
    collected_at: new Date(ORACLE_NOW - 864e5).toISOString().slice(0, 10) + 'T01:30:00Z', metric_version: 'views_desde_2026-08-27', ...extra,
  })
  expect(ins.error, 'a semente do ataque entrou no banco').toBeNull()
}
async function limparAtaque(): Promise<void> {
  const r = await localServiceClient().from('yt_own_video_retention').delete().eq('site_id', siteId).in('youtube_video_id', [...RET_CURVA.ataque])
  expect(r.error).toBeNull()
}
const grade = (n: number, de = 1, ratio: (i: number) => number = i => 0.9 - i * 0.003): object[] =>
  Array.from({ length: n }, (_, i) => ({ t: Math.round(((de + i) / 100) * 1e6) / 1e6, ratio: ratio(i), relative: 0.5, segment_impressions: 100 }))

/* ================================================================== os cinco estados */
test.describe('Retenção: os cinco estados, 1440 e 390 px, claro e escuro', () => {
  test('1 coletada: a frase, o gráfico, as saídas, os trechos revistos e a data da leitura saem das linhas do banco', async ({ browser }) => {
    test.setTimeout(240_000)
    const yt = RET_CURVA.completa, dur = vid[yt]!.dur!
    const c = await curvaDoBanco(yt)
    expect(c.pontos).toHaveLength(100)
    const t50 = metadeSaiuEm(c.pontos)!
    expect(t50, 'a curva semeada cruza 50% em 0,32').toBeCloseTo(0.32, 6)
    for (const t of TELAS) {
      const { ctx, page } = await contexto(browser, t)
      try {
        await abrir(page, yt)
        const sec = page.locator(SEC)
        const frase = `Metade das pessoas já saiu aos ${mmss(t50 * dur)} (${Math.round(t50 * 100)}% do vídeo).`
        await expect(sec.locator('.vb-fr')).toHaveText(frase)
        // o gráfico: um SVG com papel de imagem e a frase como nome acessível; grade, eixo, metade, saídas, revistos
        const svg = sec.locator('svg.rc-svg')
        await expect(svg).toHaveCount(1)
        await expect(svg).toHaveAttribute('role', 'img')
        await expect(svg).toHaveAttribute('aria-label', frase)
        await expect(svg.locator('.rc-gy')).toHaveText(['0%', '50%', '100%'])
        await expect(svg.locator('.rc-gx')).toHaveText([0, 0.25, 0.5, 0.75, 1].map(f => mmss(f * dur)))
        await expect(svg.locator('.rc-rotulo')).toHaveText('metade já saiu aqui')
        await expect(svg.locator('polygon.rc-saida')).toHaveCount(2)
        await expect(svg.locator('rect.rc-revisto')).toHaveCount(1)
        // a lista e o aviso: os tempos e as porcentagens da curva desenhada na semente (contas escritas aqui)
        const lista = await texto(page, `${SEC} .vb-ret-ls`)
        expect(lista).toContain(`Maiores saídas: ${mmss(0.01 * dur)} a ${mmss(0.06 * dur)}, de 100% para 80%; ${mmss(0.30 * dur)} a ${mmss(0.35 * dur)}, de 56% para 40%.`)
        expect(lista).toContain(`Trechos revistos: ${mmss(0.55 * dur)} a ${mmss(0.62 * dur)}.`)
        // a data é a de SÃO PAULO (01:30 UTC de ontem = 22:30 do dia anterior): o corte do texto UTC daria o dia seguinte
        const dm = diaMesSP(c.coletada)
        expect(dm).not.toBe(diaMesData(c.coletada.slice(0, 10)))
        await expect(sec.locator('.vb-ret-aviso')).toHaveText(`Curva da vida inteira do vídeo, coletada em ${dm}. O % assistido da seção anterior é dos últimos dias.`)
        // 100 pontos: nenhuma frase de curva incompleta; nenhum "não medido" nem o texto de outro estado
        const tudo = await texto(page, SEC)
        expect(tudo).not.toMatch(/Curva com \d+ pontos|incompleta|não medido|Ainda não coletamos|falhou|Só quem edita/)
        // pico: a curva semeada não passa de 100%, então não há legenda de pico
        await expect(sec.locator('.rc-leg')).not.toContainText('pico de')
        await conferirTela(page, t, 'coletada', true)
        // o ⓘ traz o método
        await sec.getByRole('button', { name: 'De onde vem a curva' }).click()
        await expect(page.getByRole('dialog', { name: 'De onde vem a curva' })).toContainText('Acima de 100%: trecho que muita gente voltou para rever.')
        await page.keyboard.press('Escape')
      } finally { await ctx.close() }
    }
  })

  test('2 coletada, curva incompleta (37 pontos): não dá para dizer, nada de saídas, revistos ou pico, e o desenho acaba onde os pontos acabam', async ({ browser }) => {
    test.setTimeout(240_000)
    const yt = RET_CURVA.incompleta
    for (const t of TELAS) {
      const { ctx, page } = await contexto(browser, t)
      try {
        await abrir(page, yt)
        const sec = page.locator(SEC)
        await expect(sec.locator('.vb-fr')).toHaveText('Não dá para dizer onde metade das pessoas sai: a curva coletada está incompleta.')
        const tudo = await texto(page, SEC)
        expect(tudo).not.toMatch(/ficou até o fim|Maiores saídas|Trechos revistos|pico de|metade já saiu aqui/)
        await expect(sec.locator('.vb-ret-aviso')).toContainText('Curva com 37 pontos.')
        await expect(sec.locator('polygon.rc-saida, rect.rc-revisto')).toHaveCount(0)
        // o último ponto do caminho fica em 37% da largura do gráfico (L = 40, R = 10 na largura do SVG): nenhum ponto inventado depois dele
        const g = await sec.locator('svg.rc-svg').evaluate(svg => {
          const d = svg.querySelector('.rc-linha')!.getAttribute('d')!
          const xs = [...d.matchAll(/[ML]([\d.]+) /g)].map(m => Number(m[1]))
          const W = Number(svg.getAttribute('width'))
          return { n: xs.length, fracao: (xs[xs.length - 1]! - 40) / (W - 50), primeira: (xs[0]! - 40) / (W - 50) }
        })
        medida(`incompleta ${t.nome}: ${g.n} pontos desenhados, de ${g.primeira.toFixed(3)} a ${g.fracao.toFixed(3)} da largura`)
        expect(g.n).toBe(37)
        expect(g.fracao).toBeCloseTo(0.37, 2)
        await conferirTela(page, t, 'incompleta', true)
      } finally { await ctx.close() }
    }
  })

  test('3 sem curva (o YouTube respondeu "sem dado", depois um erro mais novo): continua "sem curva", com a data da RESPOSTA', async ({ browser }) => {
    test.setTimeout(240_000)
    const hoje = diaYoutube(ORACLE_NOW)
    const esperada = diaMesData(somaDias(hoje, -6)), doErro = diaMesData(somaDias(hoje, -2))
    for (const t of TELAS) {
      const { ctx, page } = await contexto(browser, t)
      try {
        await abrir(page, RET_CURVA.semCurva)
        const sec = page.locator(SEC)
        const tudo = await texto(page, SEC)
        expect(tudo).toContain('não medido')
        expect(tudo).toContain('O YouTube não devolveu curva para este vídeo (poucas views). Tentamos de novo quando o vídeo ganhar views. Última resposta: ' + esperada + '.')
        expect(tudo, 'a data do erro mais novo não é a da resposta').not.toContain('Última resposta: ' + doErro)
        expect(tudo).not.toMatch(/Ainda não coletamos|falhou|Só quem edita/)
        await expect(sec.locator('svg')).toHaveCount(1)   // só o ícone do ⓘ: nenhum gráfico
        await expect(sec.locator('svg.rc-svg')).toHaveCount(0)
        await conferirTela(page, t, 'sem-curva', false)
      } finally { await ctx.close() }
    }
  })

  test('4 não coletada: o texto de sempre, palavra por palavra, e nenhum gráfico', async ({ browser }) => {
    test.setTimeout(240_000)
    for (const t of TELAS) {
      const { ctx, page } = await contexto(browser, t)
      try {
        await abrir(page, RET_CURVA.naoColetada)
        const sec = page.locator(SEC)
        await expect(sec.locator('.vb-nml p')).toHaveText(FRASE_NAO_COLETADA)
        await expect(sec.locator('svg.rc-svg')).toHaveCount(0)
        expect(await texto(page, SEC)).not.toMatch(/Última resposta|falhou|Só quem edita|Metade das pessoas/)
        await conferirTela(page, t, 'nao-coletada', false)
      } finally { await ctx.close() }
    }
  })

  test('5 a leitura falhou (curva com um ponto de ratio negativo no banco): "a leitura falhou", nunca "ainda não coletamos", e as outras seções aparecem', async ({ browser }) => {
    test.setTimeout(240_000)
    for (const t of TELAS) {
      const { ctx, page } = await contexto(browser, t)
      try {
        await abrir(page, RET_CURVA.ilegivel)
        const sec = page.locator(SEC)
        await expect(sec.locator('.vb-nml p')).toHaveText(FRASE_ERRO)
        await expect(sec.locator('svg.rc-svg')).toHaveCount(0)
        expect(await texto(page, SEC)).not.toMatch(/Ainda não coletamos|Metade das pessoas/)
        await expect(page.locator(`${V}:visible section[aria-labelledby="vb-canal-h"]`)).toBeVisible()
        await conferirTela(page, t, 'erro-ilegivel', false)
      } finally { await ctx.close() }
    }
  })

  test('6 leitura que falha de verdade (coluna da curva renomeada no banco local): a retenção diz que falhou, o resto da página fica de pé, e a coluna volta', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx, page } = await contexto(browser, TELAS[0]!)
    try {
      sql('alter table public.yt_own_video_retention rename column points to points_gio')
      await new Promise(r => setTimeout(r, 1500))   // o PostgREST recarrega o esquema depois do DDL
      await abrir(page, RET_CURVA.completa)
      const sec = page.locator(SEC)
      await expect(sec.locator('.vb-nml p')).toHaveText(FRASE_ERRO)
      await expect(sec.locator('svg.rc-svg')).toHaveCount(0)
      await expect(page.locator(`${V}:visible section[aria-labelledby="vb-canal-h"]`)).toBeVisible()
      await expect(page.locator(`${V}:visible h1`)).toBeVisible()
      await conferirTela(page, TELAS[0]!, 'erro-leitura', false)
    } finally {
      sql('alter table public.yt_own_video_retention rename column points_gio to points')
      await ctx.close()
    }
    expect(sql("select count(*) from information_schema.columns where table_name='yt_own_video_retention' and column_name='points'")).toBe('1')
  })

  test('7 tabela ausente (migration não aplicada neste banco): "ainda não coletamos", sem erro, e a tabela volta', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx, page } = await contexto(browser, TELAS[0]!)
    try {
      sql('alter table public.yt_own_video_retention rename to yt_own_video_retention_gio')
      await new Promise(r => setTimeout(r, 1500))
      await abrir(page, RET_CURVA.completa)
      const sec = page.locator(SEC)
      await expect(sec.locator('.vb-nml p')).toHaveText(FRASE_NAO_COLETADA)
      await expect(sec.locator('svg.rc-svg')).toHaveCount(0)
      await conferirTela(page, TELAS[0]!, 'tabela-ausente', false)
    } finally {
      sql('alter table public.yt_own_video_retention_gio rename to yt_own_video_retention')
      await ctx.close()
    }
    expect(sql("select to_regclass('public.yt_own_video_retention') is not null")).toBe('t')
    await new Promise(r => setTimeout(r, 1500))
  })

  test('8 só quem edita vê: o usuário de leitura (reporter) recebe a frase de acesso e NENHUM número, data ou gráfico da curva, nem no HTML nem na rede', async ({ browser }) => {
    test.setTimeout(240_000)
    const yt = RET_CURVA.completa, dur = vid[yt]!.dur!
    const c = await curvaDoBanco(yt)
    const t50 = metadeSaiuEm(c.pontos)!
    const proibidos = [mmss(t50 * dur), `${Math.round(t50 * 100)}% do vídeo`, diaMesSP(c.coletada), 'Maiores saídas', 'Trechos revistos', 'metade já saiu aqui', 'Curva da vida inteira']
    for (const t of TELAS) {
      const { ctx, page } = await contexto(browser, t, REPORTER)
      const corpos: string[] = []
      page.on('response', async r => { if (/\/cms\/youtube\/competitors\/video\//.test(r.url()) || r.url().includes('_rsc=')) { try { corpos.push(await r.text()) } catch { /* sem corpo */ } } })
      try {
        await abrir(page, yt)
        const sec = page.locator(SEC)
        await expect(sec.locator('.vb-nml p')).toHaveText(FRASE_NEGADO)
        await expect(sec.locator('svg.rc-svg')).toHaveCount(0)
        const tudo = await texto(page, SEC)
        for (const p of proibidos) expect(tudo, `o texto da seção não pode trazer "${p}"`).not.toContain(p)
        const html = await page.content()
        for (const p of proibidos) { expect(html, `o HTML não pode trazer "${p}"`).not.toContain(p); for (const b of corpos) expect(b, `a rede não pode trazer "${p}"`).not.toContain(p) }
        // os pontos do banco não viajam: a forma com que a curva é gravada ("ratio", "segment_impressions", o nome da métrica)
        const tudoDoReporter = html + corpos.join('')
        for (const forma of ['"ratio"', 'segment_impressions', 'audienceWatchRatio', '\\"ratio\\"', '"points"']) expect(tudoDoReporter, `a forma "${forma}" da curva não pode chegar ao reporter`).not.toContain(forma)
        await conferirTela(page, t, 'negado', false)
      } finally { await ctx.close() }
    }
  })
})

/* ================================================================== o ataque do caminho infeliz */
test.describe('Retenção: o ataque (cada caso escreve a curva num vídeo de ataque e limpa no fim)', () => {
  test.afterEach(async () => { await limparAtaque() })
  const [A1, A2, A3, A4] = RET_CURVA.ataque

  test('99 pontos (grade sem o último): curva incompleta; 100 pontos fora da grade (0,00 a 0,99): também', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx, page } = await contexto(browser, TELAS[0]!)
    try {
      await escreverCurva(A1, grade(99))
      await abrir(page, A1)
      const sec = page.locator(SEC)
      await expect(sec.locator('.vb-fr')).toHaveText('Não dá para dizer onde metade das pessoas sai: a curva coletada está incompleta.')
      await expect(sec.locator('.vb-ret-aviso')).toContainText('Curva com 99 pontos.')
      expect(await texto(page, SEC)).not.toMatch(/ficou até o fim|Maiores saídas|Trechos revistos/)
      await escreverCurva(A1, grade(100, 0))
      await abrir(page, A1)
      await expect(sec.locator('.vb-fr')).toHaveText('Não dá para dizer onde metade das pessoas sai: a curva coletada está incompleta.')
      medida('100 pontos fora da grade (t de 0,00 a 0,99): aviso = ' + (await texto(page, `${SEC} .vb-ret-aviso`)))
    } finally { await ctx.close() }
  })

  test('101 pontos (0,00 a 1,00): não é a grade; a tela não afirma meio, saídas nem revistos, e o texto diz o que é verdade sobre os pontos', async ({ browser }) => {
    test.fail(true, 'ACHADO G-1 (menor): a curva de 101 pontos é chamada de "incompleta" e o aviso não diz quantos pontos há (a regra é `pontos < 100`). Tire este test.fail quando for consertado.')
    test.setTimeout(240_000)
    const { ctx, page } = await contexto(browser, TELAS[0]!)
    try {
      await escreverCurva(A2, grade(101, 0))
      await abrir(page, A2)
      const sec = page.locator(SEC)
      const frase = await texto(page, `${SEC} .vb-fr`)
      const aviso = await texto(page, `${SEC} .vb-ret-aviso`)
      medida(`101 pontos: frase = "${frase}" | aviso = "${aviso}"`)
      expect(await texto(page, SEC)).not.toMatch(/ficou até o fim|Maiores saídas|Trechos revistos/)
      await expect(sec.locator('svg.rc-svg')).toHaveCount(1)
      // 101 pontos NÃO é curva "incompleta": a frase e o aviso não podem chamá-la assim, e o aviso tem de dizer quantos pontos há
      expect(frase, 'a frase diz "incompleta" para uma curva com MAIS pontos que a grade').not.toMatch(/incompleta/)
      expect(aviso).toContain('Curva com 101 pontos.')
    } finally { await ctx.close() }
  })

  test('1 ponto: a curva é um ponto; o aviso concorda em número e o desenho não quebra', async ({ browser }) => {
    test.fail(true, 'ACHADO G-2 (menor): "Curva com 1 pontos." (concordância). Tire este test.fail quando for consertado.')
    test.setTimeout(240_000)
    const { ctx, page } = await contexto(browser, TELAS[0]!)
    try {
      await escreverCurva(A3, grade(1))
      await abrir(page, A3)
      const sec = page.locator(SEC)
      const aviso = await texto(page, `${SEC} .vb-ret-aviso`)
      medida(`1 ponto: aviso = "${aviso}"`)
      await expect(sec.locator('svg.rc-svg')).toHaveCount(1)
      expect(aviso, 'concordância: "1 ponto", não "1 pontos"').not.toContain('1 pontos')
      expect(await texto(page, SEC)).not.toMatch(/ficou até o fim|Maiores saídas|Trechos revistos/)
    } finally { await ctx.close() }
  })

  test('pico de 130% no começo: legenda "pico de 130% no começo" e o caminho não sai da área do desenho', async ({ browser }) => {
    test.setTimeout(240_000)
    const pontos = pontosCurvaRetencao(100, i => (i === 2 ? 1.3 : i < 2 ? 1 - i * 0.05 : 0.9 - i * 0.004))
    for (const t of [TELAS[0]!, TELAS[2]!]) {
      const { ctx, page } = await contexto(browser, t)
      try {
        await escreverCurva(A4, pontos)
        await abrir(page, A4)
        const sec = page.locator(SEC)
        await expect(sec.locator('.rc-leg')).toContainText('pico de 130% no começo')
        const g = await sec.locator('svg.rc-svg').evaluate(svg => {
          const ys = [...svg.querySelector('.rc-linha')!.getAttribute('d')!.matchAll(/[ML][\d.]+ ([\d.-]+)/g)].map(m => Number(m[1]))
          return { minY: Math.min(...ys), alturaSvg: Number(svg.getAttribute('height')) }
        })
        medida(`pico 130% ${t.nome}: y mínimo do caminho ${g.minY} (o topo da área é 14), svg ${g.alturaSvg}`)
        expect(g.minY, 'o caminho não passa do teto de 120% (y = 14)').toBeGreaterThanOrEqual(14 - 0.05)
        await conferirTela(page, t, 'pico-130', true)
      } finally { await ctx.close() }
    }
  })

  test('ponto fora de 0..1 (t = 1,2) e pontos fora de ordem: a leitura falhou, nunca uma curva torta', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx, page } = await contexto(browser, TELAS[0]!)
    try {
      const ruim = grade(100).map((p, i) => (i === 99 ? { ...(p as object), t: 1.2 } : p))
      await escreverCurva(A1, ruim)
      await abrir(page, A1)
      await expect(page.locator(`${SEC} .vb-nml p`)).toHaveText(FRASE_ERRO)
      await expect(page.locator(`${SEC} svg.rc-svg`)).toHaveCount(0)
      const base = grade(100)
      const fora = base.map((p, i) => (i === 10 ? base[20]! : p))
      await escreverCurva(A1, fora)
      await abrir(page, A1)
      await expect(page.locator(`${SEC} .vb-nml p`)).toHaveText(FRASE_ERRO)
      const zero = grade(100).map((p, i) => (i === 5 ? { ...(p as object), ratio: 'NaN' } : p))
      await escreverCurva(A1, zero)
      await abrir(page, A1)
      await expect(page.locator(`${SEC} .vb-nml p`)).toHaveText(FRASE_ERRO)
    } finally { await ctx.close() }
  })

  test('duração zero (o que o banco aceita como "desconhecida"): os tempos saem em % do vídeo, nunca "0:00"', async ({ browser }) => {
    test.setTimeout(240_000)
    const yt = A2, original = vid[yt]!.dur
    const sb = localServiceClient()
    const { ctx, page } = await contexto(browser, TELAS[0]!)
    try {
      await escreverCurva(yt, pontosCurvaRetencao())
      // o banco recusa duração nula (coluna NOT NULL): "desconhecida" no banco é zero. O modelo trata os dois (teste de unidade); aqui vale o que o banco aceita.
      const nula = await sb.from('youtube_videos').update({ duration_seconds: null }).eq('site_id', siteId).eq('id', vid[yt]!.id)
      expect(nula.error?.code, 'duration_seconds é NOT NULL').toBe('23502')
      for (const dur of [0]) {
        const up = await sb.from('youtube_videos').update({ duration_seconds: dur }).eq('site_id', siteId).eq('id', vid[yt]!.id)
        expect(up.error, 'duração ' + dur).toBeNull()
        await abrir(page, yt)
        const sec = page.locator(SEC)
        const frase = await texto(page, `${SEC} .vb-fr`)
        medida(`duração ${dur}: "${frase}" | eixo ${(await sec.locator('.rc-gx').allInnerTexts()).join(' ')}`)
        expect(frase).toBe('Metade das pessoas já saiu com 32% do vídeo.')
        await expect(sec.locator('.rc-gx')).toHaveText(['0%', '25%', '50%', '75%', '100%'])
        const tudo = await texto(page, SEC)
        expect(tudo, 'nenhum 0:00 com duração desconhecida').not.toContain('0:00')
        expect(tudo).toMatch(/Maiores saídas: 1% a 6% do vídeo, de 100% para 80%; 30% a 35% do vídeo, de 56% para 40%\./)
        expect(tudo).toContain('Trechos revistos: 55% a 62% do vídeo.')
      }
    } finally {
      await sb.from('youtube_videos').update({ duration_seconds: original }).eq('site_id', siteId).eq('id', vid[yt]!.id)
      await ctx.close()
    }
  })

  test('título de 100 caracteres e uma palavra de 60 sem espaço: a página não rola de lado a 390 px e a seção cabe', async ({ browser }) => {
    test.setTimeout(240_000)
    const yt = A3, original = vid[yt]!.title
    const sb = localServiceClient()
    const longo = 'A'.repeat(60) + ' ' + 'viagem de trem pelo interior da Ásia com 100 caracteres no título ' + 'x'.repeat(10)
    expect(longo.length).toBeGreaterThanOrEqual(100)
    const { ctx, page } = await contexto(browser, TELAS[2]!)
    try {
      await escreverCurva(yt, pontosCurvaRetencao())
      const up = await sb.from('youtube_videos').update({ title: longo }).eq('site_id', siteId).eq('id', vid[yt]!.id)
      expect(up.error).toBeNull()
      await abrir(page, yt)
      await conferirTela(page, TELAS[2]!, 'titulo-longo', true)
      const h1 = await page.locator(`${V}:visible h1`).evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth, w: Math.round(e.getBoundingClientRect().width) }))
      medida(`título longo 390: h1 ${h1.w}px, scrollWidth ${h1.sw}, clientWidth ${h1.cw}`)
      expect(h1.sw, 'o título não passa da própria caixa').toBeLessThanOrEqual(h1.cw + 1)
    } finally {
      await sb.from('youtube_videos').update({ title: original }).eq('site_id', siteId).eq('id', vid[yt]!.id)
      await ctx.close()
    }
  })

  test('o dono está fora do país: navegador em outro fuso e outro idioma (Tóquio, Kiritimati, en-US) vê a MESMA data de São Paulo e nenhum aviso de hidratação', async ({ browser }) => {
    test.setTimeout(240_000)
    const yt = RET_CURVA.completa, dur = vid[yt]!.dur!
    const c = await curvaDoBanco(yt)
    const t50 = metadeSaiuEm(c.pontos)!
    for (const [timezoneId, locale] of [['Asia/Tokyo', 'ja-JP'], ['Pacific/Kiritimati', 'en-US'], ['America/Los_Angeles', 'pt-BR']] as const) {
      const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: 1440, height: 900 }, timezoneId, locale })
      await ctx.addCookies([{ name: 'btf_theme', value: 'dark', url: 'http://localhost:3099' }])
      await armar(ctx)
      const page = await ctx.newPage(); page.setDefaultTimeout(30_000); vigiar(page)
      try {
        await abrir(page, yt)
        await expect(page.locator(`${SEC} .vb-ret-aviso`)).toContainText(`coletada em ${diaMesSP(c.coletada)}.`)
        await expect(page.locator(`${SEC} .vb-fr`)).toContainText(`aos ${mmss(t50 * dur)}`)
        medida(`fuso ${timezoneId} / ${locale}: data ${diaMesSP(c.coletada)} igual à de São Paulo`)
      } finally { await ctx.close() }
    }
  })

  test('o gráfico se mede de novo ao redimensionar a janela (1440 para 390 e de volta) e o ⓘ abre e fecha pelo teclado devolvendo o foco', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx, page } = await contexto(browser, TELAS[0]!)
    try {
      await abrir(page, RET_CURVA.completa)
      const larguraSvg = (): Promise<number> => page.locator(`${SEC} svg.rc-svg`).evaluate(e => Math.round(e.getBoundingClientRect().width))
      const grande = await larguraSvg()
      await page.setViewportSize({ width: 390, height: 844 })
      await expect.poll(larguraSvg, { message: 'o SVG encolhe com a janela' }).toBeLessThan(grande)
      const pequeno = await larguraSvg()
      const sec = await page.locator(SEC).evaluate(e => Math.round(e.getBoundingClientRect().width))
      medida(`redimensionar: svg ${grande}px a 1440, ${pequeno}px a 390 (seção ${sec}px)`)
      expect(pequeno).toBeLessThanOrEqual(sec)
      await page.setViewportSize({ width: 1440, height: 900 })
      await expect.poll(larguraSvg, { message: 'o SVG volta a crescer' }).toBeGreaterThan(pequeno)
      // teclado: Tab até o ⓘ, Enter abre, Escape fecha e o foco volta ao botão
      const info = page.locator(SEC).getByRole('button', { name: 'De onde vem a curva' })
      await info.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('dialog', { name: 'De onde vem a curva' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog', { name: 'De onde vem a curva' })).toHaveCount(0)
      await expect(info).toBeFocused()
    } finally { await ctx.close() }
  })

  test('celular estreito (360 e 320 px): a página não rola de lado, o gráfico cabe na seção e o texto do gráfico continua com 12 px ou mais na tela', async ({ browser }) => {
    test.fail(true, 'ACHADO G-3 (corrige): abaixo de ~390 px o SVG (largura mínima 300) encolhe para caber e o texto do gráfico sai com menos de 12 px na tela (360 px: 10,8 px). Tire este test.fail quando for consertado.')
    test.setTimeout(240_000)
    for (const largura of [360, 320]) {
      const t: Tela = { nome: `${largura}-escuro`, largura, altura: 740, tema: 'dark' }
      const { ctx, page } = await contexto(browser, t)
      try {
        await abrir(page, RET_CURVA.completa)
        const m = await page.evaluate(sel => {
          const sec = [...document.querySelectorAll<HTMLElement>(sel)].find(e => e.getClientRects().length > 0)!
          const svg = sec.querySelector<SVGSVGElement>('svg.rc-svg')!
          const vb = svg.viewBox.baseVal.width, w = svg.getBoundingClientRect().width
          const textos = [...svg.querySelectorAll<SVGTextElement>('text')].map(x => parseFloat(getComputedStyle(x).fontSize) * (w / vb))
          return { secW: Math.round(sec.getBoundingClientRect().width), svgW: Math.round(w), vb, menorNaTela: Math.round(Math.min(...textos) * 10) / 10, docScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth }
        }, SEC_CSS)
        medida(`${largura}px: seção ${m.secW}, svg ${m.svgW} (viewBox ${m.vb}), menor texto do gráfico NA TELA ${m.menorNaTela}px, rolagem de lado ${m.docScroll}`)
        expect(m.docScroll, `${largura}px: a página rola de lado`).toBeLessThanOrEqual(0)
        expect(m.svgW, `${largura}px: o SVG cabe na seção`).toBeLessThanOrEqual(m.secW)
        expect.soft(m.menorNaTela, `${largura}px: o texto do gráfico encolheu com o SVG`).toBeGreaterThanOrEqual(12)
      } finally { await ctx.close() }
    }
  })

  test('virada do dia: 02:59:59Z é 23:59 de ontem em São Paulo, 03:00:00Z já é o dia seguinte; o aviso segue o relógio de SP', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx, page } = await contexto(browser, TELAS[0]!)
    try {
      for (const instante of ['2026-10-23T02:59:59Z', '2026-10-23T03:00:00Z', '2026-10-31T02:30:00Z']) {
        await escreverCurva(A4, pontosCurvaRetencao(), { collected_at: instante })
        await abrir(page, A4)
        await expect(page.locator(`${SEC} .vb-ret-aviso`)).toContainText(`coletada em ${diaMesSP(instante)}.`)
        medida(`virada ${instante}: ${diaMesSP(instante)}`)
      }
    } finally { await ctx.close() }
  })
})
