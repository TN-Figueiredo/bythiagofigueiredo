// apps/web/e2e/tests/cms/observatorio/validacao-a4.spec.ts
// Tarefa 17 da A4, passo 5: o ROTEIRO de validação logada (runbook-cms-e2e-local.md), de ponta a ponta, como o dono: abrir o canal próprio pela lista, pelo
// atalho "Meu canal" e pelo bloco "Seus canais"; o canal (cartões, "Todos os números", aba Retenção); um vídeo de volume alto e um magro; as seções do vídeo; o
// paginador; a comparação com o canal próprio; e o usuário só de leitura. 1440 px escuro e 390 px claro. Console sem erro, nenhuma resposta 5xx, nenhuma server
// action (todo POST é abortado e reprova). Capturas em docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/shots/t17/ (não versionada) e um diário em
// A4_DIARIO (padrão test-results/validacao-a4-diario.txt). Só lê.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { localServiceClient, RET } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE })
const SHOTS = path.resolve(__dirname, '../../../../../../docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/shots/t17')
const DIARIO = process.env.A4_DIARIO ?? path.resolve(__dirname, '../../../../test-results/validacao-a4-diario.txt')
const REPORTER = path.resolve(__dirname, '../../../.auth/reporter.json')
const ROTA = '/cms/youtube/competitors'
const S = '[data-obs-screen="canal"][data-own="1"]'
const V = '[data-obs-screen="video-proprio"]'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const PROIBIDAS = /\b(NaN|undefined|Infinity|\[object|L2|L3|lote|dataset|day_pt|Reporting|Analytics API|escala √)\b|null\b/i

let own = '', rival = '', ids: ReturnType<typeof seedIdsOf>
let vid: Record<string, string> = {}
let intrusos: string[] = [], erros: string[] = [], cincoXX: string[] = []
const d = (t: string): void => { fs.mkdirSync(path.dirname(DIARIO), { recursive: true }); fs.appendFileSync(DIARIO, t + '\n') }

test.beforeAll(async () => {
  test.setTimeout(240_000)
  fs.mkdirSync(SHOTS, { recursive: true })
  const siteId = await ensureSeeded({ ownPreset: '2', ownL2: 'retencao' })
  ids = seedIdsOf(siteId)
  own = ids.own('tnfigueiredo')
  rival = ids.channel('matt-wolfe')
  const r = await localServiceClient().from('youtube_videos').select('id, youtube_video_id').eq('site_id', siteId).eq('channel_id', own)
  vid = Object.fromEntries((r.data ?? []).map(x => [String(x.youtube_video_id), String(x.id)]))
})
test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })
test.beforeEach(() => { intrusos = []; erros = []; cincoXX = [] })
test.afterEach(() => {
  if (intrusos.length) throw new Error(`Server action INESPERADA abortada: ${intrusos.length}. Primeira: ${intrusos[0]}`)
  expect(cincoXX, 'respostas 5xx').toEqual([])
  expect(erros, 'erros de console').toEqual([])
})

interface Tela { rotulo: string; largura: number; altura: number; tema: 'dark' | 'light'; toque: boolean }
const T1440: Tela = { rotulo: '1440-escuro', largura: 1440, altura: 900, tema: 'dark', toque: false }
const T390: Tela = { rotulo: '390-claro', largura: 390, altura: 844, tema: 'light', toque: true }

async function contexto(browser: Browser, t: Tela, estado: string = ADMIN_STATE): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ storageState: estado, viewport: { width: t.largura, height: t.altura }, hasTouch: t.toque, isMobile: false })
  await ctx.addCookies([{ name: 'btf_theme', value: t.tema, url: 'http://localhost:3099' }])
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
async function ir(page: Page, url: string, espera: string): Promise<void> {
  await page.goto(url)
  await page.locator(espera).first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
}
/** A casca do CMS rola em `main`, não na janela: `fullPage` não vê o resto. Alonga a janela até caber o contêiner que rola, tira a captura e volta. */
async function foto(page: Page, nome: string, full = true): Promise<void> {
  const arq = path.join(SHOTS, nome + '.png')
  const vp = page.viewportSize()
  if (!full || !vp) { await page.screenshot({ path: arq }); return }
  const extra = await page.evaluate(() => {
    const raiz = [...document.querySelectorAll('[data-obs-screen]')].find(e => e.getClientRects().length > 0) as HTMLElement | undefined
    let sc: HTMLElement = document.documentElement
    for (let p = raiz?.parentElement ?? null; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY
      if ((o === 'auto' || o === 'scroll' || o === 'overlay') && p.scrollHeight > p.clientHeight + 1) { sc = p; break }
    }
    return Math.max(0, sc.scrollHeight - sc.clientHeight)
  })
  const alto = Math.min(vp.height + extra, 7000)
  await page.setViewportSize({ width: vp.width, height: alto })
  await page.waitForTimeout(250)
  await page.screenshot({ path: arq })
  await page.setViewportSize(vp)
}
const urlCanal = (qs = ''): string => `${ROTA}/canal/${own}${qs}`
const urlVideo = (yt: string, extra = ''): string => `${ROTA}/video/${vid[yt]}?from=canais&canal=${own}${extra}`
const visivel = (page: Page, sel: string) => page.locator(`${sel}:visible`).first()
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim()
function semProibidas(texto: string, onde: string): void { const m = texto.match(PROIBIDAS); expect(m, `${onde}: texto proibido "${m?.[0]}"`).toBeNull() }
/** a última data do eixo de cada gráfico está inteira: o texto do último rótulo está dentro do SVG (não cortado) e tem o formato dd/mm */
async function ultimaData(page: Page, raiz: string): Promise<string[]> {
  return page.evaluate(sel => {
    const out: string[] = []
    document.querySelectorAll<HTMLElement>(`${sel} figure.ic`).forEach(fig => {
      const svg = [...fig.querySelectorAll<SVGSVGElement>('svg')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]
      if (!svg || !svg.getClientRects().length) return
      const titulo = (fig.querySelector('.ic-t')?.textContent ?? '?').trim().slice(0, 40)
      const box = svg.getBoundingClientRect()
      const ts = [...svg.querySelectorAll<SVGTextElement>('text')].filter(t => /\d{1,2}\/\d{1,2}/.test((t.textContent ?? '').trim()))
      const ult = ts.sort((a, b) => a.getBoundingClientRect().right - b.getBoundingClientRect().right).pop()
      if (!ult) { out.push(`${titulo}: sem rótulo de data (${svg.querySelectorAll('text').length} textos)`); return }
      const r = ult.getBoundingClientRect()
      out.push(`${titulo}: ${(ult.textContent ?? '').trim()} ${r.right <= box.right + 0.5 && r.left >= box.left - 0.5 ? 'inteira' : 'CORTADA (' + Math.round(r.right - box.right) + 'px)'}`)
    })
    return out
  }, raiz)
}
async function larguras(page: Page): Promise<{ doc: number }> {
  return page.evaluate(() => ({ doc: document.documentElement.scrollWidth - document.documentElement.clientWidth }))
}

for (const t of [T1440, T390]) {
  test.describe(`validação logada · ${t.rotulo}`, () => {
    test('1. três caminhos até o canal próprio: lista, atalho "Meu canal", bloco "Seus canais"', async ({ browser }) => {
      test.setTimeout(240_000)
      const { ctx, page } = await contexto(browser, t)
      await ir(page, ROTA, '[data-obs-screen="canais"] .toolbar')
      await foto(page, `1-lista-${t.rotulo}`)
      // (a) pela linha/cartão do canal na lista
      const linha = page.locator(`[data-obs-screen="canais"] a[href*="/canal/${own}"]:visible`).first()
      const nLinks = await page.locator(`[data-obs-screen="canais"] a[href*="/canal/${own}"]`).count()
      d(`[${t.rotulo}] lista: ${nLinks} link(s) para /canal/<próprio>`)
      expect(nLinks, 'a lista tem link para a página do canal próprio').toBeGreaterThan(0)
      await linha.click()
      await page.locator(`${S} .chead h1`).first().waitFor({ timeout: 60_000 })
      expect(page.url()).toContain(`/canal/${own}`)
      d(`[${t.rotulo}] lista -> canal: ${page.url().replace(/^.*localhost:3099/, '')} · h1 "${flat(await page.locator(`${S} .chead h1`).first().innerText())}"`)
      // (b) pelo atalho "Meu canal" da moldura de outra tela (a comparação, que mostra o atalho)
      await ir(page, `${ROTA}/comparar?a=${own}&b=${rival}`, '[data-obs-screen="comparar"] h1')
      const atalho = page.locator('[data-meu-canal]:visible').first()
      d(`[${t.rotulo}] atalho "Meu canal" visível na comparação: ${await atalho.count() > 0}`)
      await atalho.locator('button, a').first().click()
      const item = page.locator('#mc-menu a[role="menuitem"]:visible, a[data-meu-canal]:visible').first()
      await item.waitFor({ timeout: 15_000 })
      await item.click()
      await page.locator(`${S} .chead h1`).first().waitFor({ timeout: 60_000 })
      d(`[${t.rotulo}] atalho -> canal: ${page.url().replace(/^.*localhost:3099/, '')}`)
      expect(page.url()).toContain('/canal/')
      // (c) pelo bloco "Seus canais"
      await ir(page, ROTA, '[data-own-block]')
      const bloco = page.locator('[data-own-block]:visible button').filter({ hasText: /Abrir meu canal/ }).first()
      d(`[${t.rotulo}] bloco "Seus canais": ${await page.locator('[data-own-block]:visible button').filter({ hasText: /Abrir meu canal/ }).count()} botão(ões) "Abrir meu canal"`)
      await bloco.click()
      await page.locator(`${S} .chead h1`).first().waitFor({ timeout: 60_000 })
      d(`[${t.rotulo}] bloco -> canal: ${page.url().replace(/^.*localhost:3099/, '')}`)
      await foto(page, `1-canal-${t.rotulo}`)
      await ctx.close()
    })

    test('2. canal: cartões, painel, "Todos os números", eixo, aba Retenção (% assistido por faixa)', async ({ browser }) => {
      test.setTimeout(240_000)
      const { ctx, page } = await contexto(browser, t)
      await ir(page, urlCanal('?painel=1&nums=1'), `${S} .chead h1`)
      const tela = flat(await visivel(page, S).innerText())
      semProibidas(tela, 'canal')
      d(`[${t.rotulo}] canal: ${tela.length} caracteres de texto; "Todos os números" aberto: ${await page.locator(`${S}:visible [id*="nums"], ${S}:visible .nums`).count() > 0}`)
      d(`[${t.rotulo}] canal: última data do eixo ${JSON.stringify(await ultimaData(page, S))}`)
      d(`[${t.rotulo}] canal: rolagem horizontal do documento ${(await larguras(page)).doc}px`)
      await foto(page, `2-canal-painel-nums-${t.rotulo}`)
      // aba Retenção
      await ir(page, urlCanal('?tab=retencao'), `${S} .ret`)
      const ret = flat(await visivel(page, `${S} .ret`).innerText())
      semProibidas(ret, 'retenção')
      d(`[${t.rotulo}] aba Retenção: "${ret.slice(0, 260)}"`)
      expect(ret.length, 'a aba Retenção não está vazia').toBeGreaterThan(60)
      await foto(page, `2-canal-retencao-${t.rotulo}`)
      // aba Vídeos (grade) e o primeiro vídeo
      await ir(page, urlCanal(''), `${S} .chead h1`)
      // ajustes finais aprovados pelo dono (13/10): "Como o canal está" nasce fechada; a grade a 390 px mostra 24 cartões e o botão "Mostrar mais"
      const secaoPn = page.locator(`${S}:visible section.pn`)
      await expect(secaoPn.getByRole('button', { name: /^Como o canal está/ })).toHaveAttribute('aria-expanded', 'false')
      const nCartoes = await page.locator(`${S}:visible ul.cv-grid > li.cv-card`).count()
      const nVisiveis = await page.evaluate(sel => [...document.querySelectorAll<HTMLElement>(`${sel}:not([hidden]) ul.cv-grid > li.cv-card`)].filter(c => c.getClientRects().length > 0).length, S)
      d(`[${t.rotulo}] grade: ${nVisiveis} cartões visíveis de ${nCartoes}; botão "Mostrar mais" visível: ${await page.locator(`${S}:visible .cv-more.cv-pag button`).isVisible()}`)
      if (t.largura <= 480) {
        expect(nVisiveis, 'a 390 px a grade mostra a primeira página de 24').toBe(Math.min(24, nCartoes))
        await expect(page.locator(`${S}:visible .cv-more.cv-pag button`)).toHaveText(/^Mostrar (mais 24 vídeos|os últimos \d+ vídeos|o último vídeo)$/)
      } else {
        expect(nVisiveis, 'a 1440 px a grade segue inteira').toBe(nCartoes)
        await expect(page.locator(`${S}:visible .cv-more.cv-pag button`)).toBeHidden()
      }
      await foto(page, `2-canal-videos-${t.rotulo}`)
      await ctx.close()
    })

    test('3. vídeo de volume alto e vídeo magro: as seções, as oito réguas, a taxa que "ainda não conclui", retenção sem curva', async ({ browser }) => {
      test.setTimeout(300_000)
      const { ctx, page } = await contexto(browser, t)
      for (const [nome, yt] of [['alto', RET.volumeAlto], ['magro', RET.magro]] as const) {
        await ir(page, urlVideo(yt), `${V} h1:visible`)
        const tela = flat(await visivel(page, V).innerText())
        semProibidas(tela, `vídeo ${nome}`)
        const secoes = {
          'Views por dia': /Views por dia/.test(tela),
          'Impressões e cliques': /Impressões e cliques/.test(tela),
          'Taxa de clique': /Taxa de clique/i.test(tela),
          '% assistido': /% assistido|assistido/i.test(tela),
          'Retenção sem curva': /Ainda não coletamos esta curva/.test(tela),
          'ainda não conclui': /ainda não conclui/i.test(tela),
        }
        d(`[${t.rotulo}] vídeo ${nome}: ${JSON.stringify(secoes)}`)
        const reguas = await page.locator(`${V}:visible .vb-rg`).count()
        d(`[${t.rotulo}] vídeo ${nome}: réguas (.vb-rg) = ${reguas}`)
        d(`[${t.rotulo}] vídeo ${nome}: última data do eixo ${JSON.stringify(await ultimaData(page, V))}`)
        d(`[${t.rotulo}] vídeo ${nome}: rolagem horizontal do documento ${(await larguras(page)).doc}px; svg de curva de retenção: ${await page.locator(`${V}:visible section[aria-labelledby*="ret"] svg`).count()}`)
        expect(secoes['Views por dia'] && secoes['Impressões e cliques'] && secoes['Taxa de clique'], `${nome}: as seções existem`).toBe(true)
        expect(secoes['Retenção sem curva'], `${nome}: a retenção diz que ainda não coletou a curva`).toBe(true)
        if (nome === 'alto') expect(secoes['ainda não conclui'], 'volume alto concluiu a taxa').toBe(false)
        if (nome === 'magro') expect(secoes['ainda não conclui'], 'volume magro não conclui').toBe(true)
        await foto(page, `3-video-${nome}-${t.rotulo}`)
        // botões Dia anterior / Dia seguinte (a 390 px: 44 x 44)
        const ant = page.locator(`${V}:visible button[aria-label="Dia anterior"]`).first()
        if (await ant.count()) {
          const b = await ant.boundingBox()
          const seg = await page.locator(`${V}:visible button[aria-label="Dia seguinte"]`).first().boundingBox()
          d(`[${t.rotulo}] vídeo ${nome}: Dia anterior ${Math.round(b?.width ?? 0)}x${Math.round(b?.height ?? 0)}, Dia seguinte ${Math.round(seg?.width ?? 0)}x${Math.round(seg?.height ?? 0)}`)
          if (t.toque) { expect(b?.width ?? 0).toBeGreaterThanOrEqual(43.5); expect(b?.height ?? 0).toBeGreaterThanOrEqual(43.5) }
          await ant.click()
          await ant.click().catch(() => undefined)
          const frase = flat(await page.locator(`${V}:visible figure.ic [role="status"]`).first().innerText().catch(() => ''))
          d(`[${t.rotulo}] vídeo ${nome}: depois de "Dia anterior" ×2: "${frase.slice(0, 200)}"`)
          await foto(page, `3-video-${nome}-dia-anterior-${t.rotulo}`, false)
        } else d(`[${t.rotulo}] vídeo ${nome}: sem botão "Dia anterior" visível`)
      }
      await ctx.close()
    })

    test('4. paginador do vídeo e comparação com o canal próprio', async ({ browser }) => {
      test.setTimeout(240_000)
      const { ctx, page } = await contexto(browser, t)
      await ir(page, urlVideo(RET.volumeAlto), `${V} h1:visible`)
      const antes = page.url()
      const prox = page.locator('[data-pager-next]:visible').first()
      const nProx = await prox.count()
      d(`[${t.rotulo}] paginador: link "Próximo" ${nProx > 0 ? 'existe' : 'AUSENTE'}`)
      if (nProx) {
        await prox.click()
        await page.waitForURL(u => u.toString() !== antes, { timeout: 30_000 })
        await page.locator(`${V} h1:visible`).first().waitFor({ timeout: 60_000 })
        d(`[${t.rotulo}] paginador: ${antes.replace(/^.*\/video\//, '').slice(0, 40)} -> ${page.url().replace(/^.*\/video\//, '').slice(0, 40)}`)
        await foto(page, `4-video-proximo-${t.rotulo}`, false)
      }
      await ir(page, `${ROTA}/comparar?a=${own}&b=${rival}`, '[data-obs-screen="comparar"] h1')
      const tela = flat(await visivel(page, '[data-obs-screen="comparar"]').innerText())
      semProibidas(tela, 'comparação')
      d(`[${t.rotulo}] comparação própria × concorrente: cartão "Só o seu canal mede" ${/Só o seu canal mede/.test(tela)}; rolagem horizontal ${(await larguras(page)).doc}px`)
      expect(/Só o seu canal mede/.test(tela)).toBe(true)
      await foto(page, `4-comparar-${t.rotulo}`)
      await ctx.close()
    })
  })
}

test('5. usuário só de leitura (reporter): canal, vídeo e comparação sem nenhum número privado, 1440 px escuro e 390 px claro', async ({ browser }) => {
  test.setTimeout(300_000)
  // os números privados da semente (perfil retenção): improváveis de aparecer por acaso
  const privados = ['51.852', '51852', '19.983', '19983', '1.139', '1139', '113%', '5,7%']
  for (const t of [T1440, T390]) {
    const { ctx, page } = await contexto(browser, t, REPORTER)
    for (const [rotulo, url, espera] of [
      ['canal', urlCanal('?painel=1&nums=1'), `${S} .chead h1, [data-obs-screen] h1`],
      ['aba Retenção', urlCanal('?tab=retencao'), '[data-obs-screen] h1'],
      ['vídeo alto', urlVideo(RET.volumeAlto), `${V} h1:visible, [data-obs-screen] h1`],
      ['comparação', `${ROTA}/comparar?a=${own}&b=${rival}`, '[data-obs-screen] h1'],
    ] as const) {
      const resp = await page.goto(url)
      await page.locator(espera).first().waitFor({ timeout: 60_000 }).catch(() => undefined)
      await page.waitForLoadState('networkidle')
      const html = await resp!.text()
      const dom = flat(await page.locator('body').innerText())
      const achados = privados.filter(p => html.includes(p) || dom.includes(p))
      const figuras = await page.locator('figure.ic').count()
      const titulos = await page.locator('figure.ic .ic-t').allInnerTexts()
      const detalhe = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('figure.ic')].map(f => `${(f.querySelector('.ic-t')?.textContent ?? '').trim().slice(0, 30)} | svg ${f.querySelectorAll('svg').length} rect ${f.querySelectorAll('rect').length} text ${f.querySelectorAll('svg text').length} | "${(f.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 260)}"`))
      d(`[reporter ${t.rotulo}] ${rotulo}: figuras em detalhe ${JSON.stringify(detalhe)}`)
      d(`[reporter ${t.rotulo}] ${rotulo}: status ${resp!.status()}, figure.ic ${figuras} ${JSON.stringify(titulos)}, formas privadas achadas ${JSON.stringify(achados)}, texto "${dom.slice(0, 160)}"`)
      expect(resp!.status()).toBeLessThan(500)
      expect(achados, `${rotulo}: nenhum número privado para o reporter`).toEqual([])
      await foto(page, `5-reporter-${rotulo.replace(/\s/g, '-')}-${t.rotulo}`, false)
    }
    await ctx.close()
  }
})
