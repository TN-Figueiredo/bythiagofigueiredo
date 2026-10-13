// apps/web/e2e/tests/cms/observatorio/proprio-a4-recente.spec.ts
// D e D-1 (hoje e ontem, dia do Pacífico) em navegador, com o perfil de semente `recente` (relatórios até HOJE; nenhum outro perfil tem relatório em D ou D-1):
//   - D-1 lido SEM linha do vídeo `a`          -> "não medido" (hachura), com a legenda "o YouTube não entregou o dia"
//   - D-1 lido COM linha do vídeo `b` (77)     -> o valor aparece (dado que existe nunca se esconde), no vídeo `b` e no gráfico do canal
//   - D-2 lido e vazio                          -> zero medido (caixa vazada)
//   - D lido e vazio                            -> "não medido" (recente)
// Nada é escrito: toda server action é abortada e reprova o teste.
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { diaYoutube, localServiceClient, ORACLE_NOW, RECENTE_IMP_B_EM_D1, somaDias } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

test.use({ storageState: ADMIN_STATE })
const ROTA = '/cms/youtube/competitors'
const S = '[data-obs-screen="canal"][data-own="1"]'
const V = '[data-obs-screen="video-proprio"]'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const TEXTO_RECENTE = 'dia recente: o YouTube ainda está entregando; não medido'
const LEGENDA_NAO_MEDIDO = 'não medido (hachura): o YouTube não entregou o dia'

const HOJE = diaYoutube(ORACLE_NOW)
const rotulo = (n: number): string => { const [, m, d] = somaDias(HOJE, -n).split('-'); return `${d}/${m}` }

let intrusos: string[] = [], erros: string[] = [], cincoXX: string[] = []
test.beforeEach(() => { intrusos = []; erros = []; cincoXX = [] })
test.afterEach(() => {
  if (intrusos.length) throw new Error(`Server action INESPERADA abortada: ${intrusos.length}. Primeira: ${intrusos[0]}`)
  expect(cincoXX, 'respostas 5xx').toEqual([])
  expect(erros, 'erros de console').toEqual([])
})

async function contexto(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: 1440, height: 900 } })
  await ctx.route('**/*', async route => {
    const r = route.request()
    if (r.method() === 'POST' && r.headers()['next-action']) { intrusos.push(`${r.headers()['next-action']} ${r.url()}`); await route.abort('blockedbyclient'); return }
    await route.fallback()
  })
  await ctx.route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  const page = await ctx.newPage()
  page.setDefaultTimeout(30_000)
  page.on('console', m => {
    if (m.type() !== 'error') return
    const loc = m.location().url
    if (/ytimg\.com|ggpht\.com|blob\.vercel|challenges\.cloudflare/.test(loc + m.text())) return
    erros.push(m.text().slice(0, 220) + ' @ ' + loc)
  })
  page.on('pageerror', e => erros.push('pageerror: ' + e.message.slice(0, 220)))
  page.on('response', r => { if (r.status() >= 500) cincoXX.push(r.status() + ' ' + r.url().slice(0, 120)) })
  return { ctx, page }
}

/** Uma linha da tabela dia a dia de um gráfico de impressões: a situação, o valor e o texto da situação. */
async function linhasDoGrafico(fig: ReturnType<Page['locator']>): Promise<Record<string, { situacao: string; imp: string; texto: string }>> {
  return await fig.evaluate((el: Element) => {
    const saida: Record<string, { situacao: string; imp: string; texto: string }> = {}
    el.querySelectorAll('tbody tr[data-situacao]').forEach(tr => {
      const tds = tr.querySelectorAll('td')
      saida[(tr.querySelector('th')?.textContent ?? '').trim()] = {
        situacao: tr.getAttribute('data-situacao') ?? '',
        imp: (tds[0]?.textContent ?? '').trim(),
        texto: (tds[tds.length - 1]?.textContent ?? '').trim(),
      }
    })
    return saida
  })
}

test.describe('D e D-1 em navegador: perfil `recente`', () => {
  let own = '', ytA = '', ytB = ''
  const vid: Record<string, string> = {}
  test.beforeAll(async () => {
    test.setTimeout(240_000)
    const siteId = await ensureSeeded({ ownPreset: '2', ownL2: 'recente' })
    const ids = seedIdsOf(siteId)
    own = ids.own('tnfigueiredo')
    const r = await localServiceClient().from('youtube_videos').select('id, youtube_video_id').eq('site_id', siteId).eq('channel_id', own)
    for (const x of r.data ?? []) vid[String(x.youtube_video_id)] = String(x.id)
    // os dois vídeos do perfil: `b` é o que tem linha em D-1; `a`, o outro (a semente já escreveu; nada é re-semeado)
    const sb = localServiceClient()
    const todos = await sb.from('yt_own_video_reach_daily').select('youtube_video_id, day_pt').eq('site_id', siteId).eq('channel_id', own)
    const ids2 = [...new Set((todos.data ?? []).map(x => String(x.youtube_video_id)))]
    const emD1 = new Set((todos.data ?? []).filter(x => String(x.day_pt) === somaDias(HOJE, -1)).map(x => String(x.youtube_video_id)))
    expect(ids2).toHaveLength(2)
    expect([...emD1]).toHaveLength(1)
    ytB = [...emD1][0]!
    ytA = ids2.find(y => y !== ytB)!
  })
  test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

  async function abrirCanal(page: Page): Promise<ReturnType<Page['locator']>> {
    await page.goto(`${ROTA}/canal/${own}?painel=1`)
    await page.locator(`${S} .chead h1`).first().waitFor({ timeout: 60_000 })
    await page.waitForLoadState('networkidle')
    const fig = page.locator(`${S}:visible figure.ic`).filter({ has: page.locator('.ic-t', { hasText: 'Impressões por dia do canal' }) }).first()
    await fig.waitFor()
    return fig
  }
  async function abrirVideo(page: Page, yt: string): Promise<ReturnType<Page['locator']>> {
    await page.goto(`${ROTA}/video/${vid[yt]}?from=canais&canal=${own}`)
    await page.locator(`${V} h1:visible`).first().waitFor({ timeout: 60_000 })
    await page.waitForLoadState('networkidle')
    const fig = page.locator(`${V}:visible figure.ic`).filter({ has: page.locator('.ic-t', { hasText: /mpressões/ }) }).first()
    await fig.waitFor()
    return fig
  }

  test('canal: D hachurado, D-1 com o valor do vídeo b, D-2 zero medido; a legenda diz "o YouTube não entregou o dia"', async ({ browser }) => {
    test.setTimeout(120_000)
    const { ctx, page } = await contexto(browser)
    try {
      const fig = await abrirCanal(page)
      const l = await linhasDoGrafico(fig)
      expect(l[rotulo(0)], 'D (hoje) lido e vazio').toEqual({ situacao: 'nao-medido', imp: 'não medido', texto: TEXTO_RECENTE })
      expect(l[rotulo(1)], 'D-1 lido COM linha de um vídeo: o valor aparece').toMatchObject({ situacao: 'com-impressoes', imp: String(RECENTE_IMP_B_EM_D1) })
      expect(l[rotulo(2)], 'D-2 lido e vazio: zero medido').toMatchObject({ situacao: 'zero-medido', imp: '0' })
      expect(l[rotulo(3)]!.situacao).toBe('com-impressoes')
      await expect(fig.locator('.ic-leg')).toContainText(LEGENDA_NAO_MEDIDO)
      // o desenho: a última coluna é a hachura, a de D-2 é a caixa vazada, a de D-1 é a barra
      const cols = fig.locator('svg.ic-svg g.ic-col')
      const n = await cols.count()
      await expect(cols.nth(n - 1)).toHaveAttribute('data-situacao', 'nao-medido')
      await expect(cols.nth(n - 1).locator('rect.ic-nm').first()).toBeAttached()
      await expect(cols.nth(n - 2)).toHaveAttribute('data-situacao', 'com-impressoes')
      await expect(cols.nth(n - 3)).toHaveAttribute('data-situacao', 'zero-medido')
      await expect(cols.nth(n - 3).locator('rect.ic-zero')).toBeAttached()
    } finally { await ctx.close() }
  })

  test('vídeo a (sem linha em D-1): D-1 e D hachurados, D-2 zero medido; o mesmo total na régua, no cartão e no gráfico', async ({ browser }) => {
    test.setTimeout(120_000)
    const { ctx, page } = await contexto(browser)
    try {
      const fig = await abrirVideo(page, ytA)
      const l = await linhasDoGrafico(fig)
      expect(l[rotulo(0)], 'D').toMatchObject({ situacao: 'nao-medido', texto: TEXTO_RECENTE })
      expect(l[rotulo(1)], 'D-1 lido SEM linha deste vídeo: não medido, não zero').toMatchObject({ situacao: 'nao-medido', imp: 'não medido', texto: TEXTO_RECENTE })
      expect(l[rotulo(2)], 'D-2 lido sem linha: zero medido').toMatchObject({ situacao: 'zero-medido', imp: '0' })
      await expect(fig.locator('.ic-leg')).toContainText(LEGENDA_NAO_MEDIDO)
      // nenhuma frase diz que o relatório falhou
      const texto = (await fig.innerText()).toLowerCase()
      expect(texto).not.toContain('não entregou')
    } finally { await ctx.close() }
  })

  test('vídeo b (com linha em D-1): o valor 77 aparece em D-1, D hachurado, D-2 zero medido', async ({ browser }) => {
    test.setTimeout(120_000)
    const { ctx, page } = await contexto(browser)
    try {
      const fig = await abrirVideo(page, ytB)
      const l = await linhasDoGrafico(fig)
      expect(l[rotulo(1)], 'D-1 com linha do vídeo').toMatchObject({ situacao: 'com-impressoes', imp: String(RECENTE_IMP_B_EM_D1) })
      expect(l[rotulo(0)]).toMatchObject({ situacao: 'nao-medido' })
      expect(l[rotulo(2)]).toMatchObject({ situacao: 'zero-medido', imp: '0' })
    } finally { await ctx.close() }
  })
  // Regra decidida: o dia anterior à publicação não existe, em lugar nenhum. O vídeo `a` é publicado 10 dias atrás e a semente tem linhas dele ANTES disso
  // (dado que em produção não existe); o cartão e a linha se acham pelo id do link (o href de todo cartão leva ids= com todos os ids da grade): o total tem de ser o mesmo no cartão, na lista, na régua e no gráfico da página, e igual à soma das linhas desde a publicação.
  test('o MESMO total em quatro lugares (cartão, lista, régua e gráfico da página) para um vídeo publicado depois de linhas de alcance', async ({ browser }) => {
    test.setTimeout(180_000)
    const sb = localServiceClient()
    const siteId = await getSeedSiteId()
    const antes = await sb.from('youtube_videos').select('published_at').eq('id', vid[ytA]!).eq('site_id', siteId).single()
    const original = String(antes.data?.published_at)
    const pubMs = ORACLE_NOW - 10 * 24 * 3600 * 1000
    const pubDia = diaYoutube(pubMs)
    try {
      const up = await sb.from('youtube_videos').update({ published_at: new Date(pubMs).toISOString() }).eq('id', vid[ytA]!).eq('site_id', siteId)
      if (up.error) throw new Error(up.error.message)
      const linhas = await sb.from('yt_own_video_reach_daily').select('day_pt, thumbnail_impressions').eq('site_id', siteId).eq('youtube_video_id', ytA)
      const todas = (linhas.data ?? []).map(x => ({ dia: String(x.day_pt), imp: Number(x.thumbnail_impressions) }))
      const desde = todas.filter(x => x.dia >= pubDia).reduce((t, x) => t + x.imp, 0)
      const tudo = todas.reduce((t, x) => t + x.imp, 0)
      expect(todas.some(x => x.dia < pubDia), 'premissa: há linha ANTES da publicação').toBe(true)
      expect(desde, 'premissa: o corte muda o total').toBeLessThan(tudo)
      expect(desde).toBeGreaterThan(0)
      const num = (t: string): number => Number((/\d[\d.]*/.exec(t.replace(/\u00a0/g, ' ')) ?? ['NaN'])[0].replace(/\./g, ''))
      const { ctx, page } = await contexto(browser)
      try {
        await page.goto(`${ROTA}/canal/${own}?sort=imp`)
        await page.locator(`${S} .chead h1`).first().waitFor({ timeout: 60_000 })
        await page.waitForLoadState('networkidle')
        const card = page.locator(`${S}:visible ul.cv-grid > li`).filter({ has: page.locator(`a[id="cv-lnk-${vid[ytA]}"]`) }).first()
        const textoCartao = (await card.innerText()).replace(/\s+/g, ' ')
        const doCartao = num((/([\d.]+(?:\s?mil)?)\s*impress/.exec(textoCartao.replace(/\u00a0/g, ' ')) ?? ['', 'NaN'])[1]!)
        await page.goto(`${ROTA}/canal/${own}?ver=lista&sort=imp`)
        await page.locator(`${S} .chead h1`).first().waitFor({ timeout: 60_000 })
        await page.waitForLoadState('networkidle')
        const linha = page.locator(`${S}:visible tr`).filter({ has: page.locator(`a[id="cv-lnk-${vid[ytA]}"]`) }).first()
        const textoLinha = (await linha.innerText()).replace(/\s+/g, ' ')
        const daLista = num(await linha.locator('td[data-label="Impressões"]').innerText())
        await page.goto(`${ROTA}/video/${vid[ytA]}?from=canais&canal=${own}`)
        await page.locator(`${V} h1:visible`).first().waitFor({ timeout: 60_000 })
        await page.waitForLoadState('networkidle')
        const daRegua = num(await page.locator(`${V}:visible tr[data-numero="impressoes"] td.vb-rg-v`).first().innerText())
        const fig = page.locator(`${V}:visible figure.ic`).filter({ has: page.locator('.ic-t', { hasText: /mpressões/ }) }).first()
        const l = await linhasDoGrafico(fig)
        const daPagina = Object.values(l).filter(x => x.situacao === 'com-impressoes').reduce((t, x) => t + num(x.imp), 0)
        const primeiro = Object.keys(l)[0]!
        test.info().annotations.push({ type: 'medida', description: `cartão="${textoCartao.slice(0, 160)}" linha="${textoLinha.slice(0, 200)}" esperado ${desde} (com as anteriores seria ${tudo}); cartão ${doCartao}, lista ${daLista}, régua ${daRegua}, página ${daPagina}; primeira coluna do gráfico ${primeiro} (publicação ${pubDia})` })
        expect({ cartao: doCartao, lista: daLista, regua: daRegua, pagina: daPagina }).toEqual({ cartao: desde, lista: desde, regua: desde, pagina: desde })
        const [, mm, dd] = pubDia.split('-')
        expect(primeiro, 'o gráfico começa no dia da publicação').toBe(`${dd}/${mm}`)
      } finally { await ctx.close() }
    } finally { await sb.from('youtube_videos').update({ published_at: original }).eq('id', vid[ytA]!).eq('site_id', siteId) }
  })
})
