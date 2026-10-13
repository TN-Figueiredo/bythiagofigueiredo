// apps/web/e2e/tests/cms/observatorio/proprio-ajustes-finais.spec.ts
// A4, ajustes finais de UX aprovados pelo dono (13/10): (1) a grade de Capas do canal próprio mostra 24 cartões a 390 px e "Mostrar mais" de 24 em 24;
// em 1440 px a grade segue inteira e o botão não existe; (2) "Como o canal está" nasce FECHADA (sem URL e sem lembrança), com a frase-resumo à vista.
// Gesto de mouse de verdade. Todo POST com `next-action` é abortado e reprova. Capturas (antes simulado e depois) em
// docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/shots/a4-ajustes-finais/ (pasta não versionada).
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'

test.use({ storageState: ADMIN_STATE })
const SHOTS = process.env.A4_AJUSTES_SHOTS ?? path.resolve(__dirname, '../../../../../../docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/shots/a4-ajustes-finais')
const ROTA = '/cms/youtube/competitors'
const S = '[data-obs-screen="canal"][data-own="1"]'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const PAGINA = 24
const DIARIO = process.env.A4_AJUSTES_DIARIO ?? path.resolve(__dirname, '../../../../test-results/a4-ajustes-diario.txt')
const d = (t: string): void => { fs.mkdirSync(path.dirname(DIARIO), { recursive: true }); fs.appendFileSync(DIARIO, t + '\n') }

let own = ''
let intrusos: string[] = [], erros: string[] = []

test.beforeAll(async () => {
  test.setTimeout(240_000)
  fs.mkdirSync(SHOTS, { recursive: true })
  const siteId = await ensureSeeded({ ownPreset: '2', ownL2: 'retencao' })
  own = seedIdsOf(siteId).own('tnfigueiredo')
})
test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })
test.beforeEach(() => { intrusos = []; erros = [] })
test.afterEach(() => {
  if (intrusos.length) throw new Error(`Server action INESPERADA abortada: ${intrusos.length}. Primeira: ${intrusos[0]}`)
  expect(erros, 'erros de console').toEqual([])
})

interface Tela { rotulo: string; largura: number; altura: number; tema: 'dark' | 'light'; toque: boolean }
const T1440: Tela = { rotulo: '1440-escuro', largura: 1440, altura: 900, tema: 'dark', toque: false }
const T390: Tela = { rotulo: '390-claro', largura: 390, altura: 844, tema: 'light', toque: true }

async function contexto(browser: Browser, t: Tela): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: t.largura, height: t.altura }, hasTouch: t.toque, isMobile: false })
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
  return { ctx, page }
}
async function ir(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await page.locator(`${S} .chead h1`).first().waitFor({ timeout: 60_000 })
  await page.locator(`${S}:visible ul.cv-grid > li.cv-card`).first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
}
/** A casca do CMS rola em `main`: alonga a janela até caber o contêiner que rola, fotografa e volta. */
async function foto(page: Page, nome: string): Promise<void> {
  const arq = path.join(SHOTS, nome + '.png')
  const vp = page.viewportSize()
  if (!vp) { await page.screenshot({ path: arq }); return }
  const extra = await page.evaluate(() => {
    const raiz = [...document.querySelectorAll('[data-obs-screen]')].find(e => e.getClientRects().length > 0) as HTMLElement | undefined
    let sc: HTMLElement = document.documentElement
    for (let p = raiz?.parentElement ?? null; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY
      if ((o === 'auto' || o === 'scroll' || o === 'overlay') && p.scrollHeight > p.clientHeight + 1) { sc = p; break }
    }
    return Math.max(0, sc.scrollHeight - sc.clientHeight)
  })
  await page.setViewportSize({ width: vp.width, height: Math.min(vp.height + extra, 24000) })
  await page.waitForTimeout(250)
  await page.screenshot({ path: arq })
  await page.setViewportSize(vp)
}
const urlCanal = (qs = ''): string => `${ROTA}/canal/${own}${qs}`
const cartoesNoDom = (page: Page) => page.locator(`${S}:visible ul.cv-grid > li.cv-card`)
const cartoesVisiveis = (page: Page): Promise<number> => page.evaluate(sel => [...document.querySelectorAll<HTMLElement>(`${sel}:not([hidden]) ul.cv-grid > li.cv-card`)].filter(c => c.getClientRects().length > 0 && getComputedStyle(c).display !== 'none').length, S)
const divisoresVisiveis = (page: Page): Promise<number> => page.evaluate(sel => [...document.querySelectorAll<HTMLElement>(`${sel}:not([hidden]) ul.cv-grid > li.cv-div`)].filter(c => c.getClientRects().length > 0).length, S)
const botaoMais = (page: Page) => page.locator(`${S}:visible .cv-more.cv-pag button`)
/** o scroller da casca (o `main` que contém a tela) */
const rolagem = (page: Page): Promise<number> => page.evaluate(sel => {
  const raiz = document.querySelector(sel)
  for (let p = raiz?.parentElement ?? null; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) return Math.round(p.scrollTop) }
  return Math.round(document.documentElement.scrollTop)
}, S)

for (const t of [T1440, T390]) {
  test.describe(`ajustes finais · ${t.rotulo}`, () => {
    test('grade de vídeos: 390 px mostra 24 e "Mostrar mais" de 24 em 24; 1440 px mostra tudo e não tem o botão', async ({ browser }) => {
      test.setTimeout(240_000)
      const { ctx, page } = await contexto(browser, t)
      await ir(page, urlCanal(''))
      const total = await cartoesNoDom(page).count()
      expect(total, 'o canal semeado tem mais de 48 cartões (senão o teste não prova a paginação)').toBeGreaterThan(2 * PAGINA)
      // ANTES (simulado: o CSS novo anulado, a grade inteira e sem o bloco), só para a captura e para medir a rolagem que se evita
      await page.addStyleTag({ content: `${S} .cv-grid > [data-pag-oculto]{display:revert!important} ${S} .cv-more.cv-pag{display:none!important}` }).then(async h => {
        await foto(page, `grade-antes-simulado-${t.rotulo}`)
        const alturaAntes = await page.evaluate(sel => document.querySelector(sel)!.getBoundingClientRect().height, S)
        d(`[${t.rotulo}] altura da tela ANTES (simulado, grade inteira): ${Math.round(alturaAntes)} px`)
        await h.evaluate(el => el.remove())
      })
      const largo = t.largura > 480
      const visiveis = await cartoesVisiveis(page)
      d(`[${t.rotulo}] cartões visíveis ${visiveis} de ${total}`)
      const alturaDepois = await page.evaluate(sel => document.querySelector(sel)!.getBoundingClientRect().height, S)
      d(`[${t.rotulo}] altura da tela DEPOIS: ${Math.round(alturaDepois)} px`)
      const dx = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(dx, 'sem rolagem horizontal do documento').toBe(0)

      if (largo) {
        expect(visiveis, '1440: a grade segue inteira').toBe(total)
        await expect(botaoMais(page)).toHaveCount(1)
        await expect(botaoMais(page)).toBeHidden()
        await foto(page, `grade-depois-${t.rotulo}`)
        await ctx.close()
        return
      }

      // 390: 24 cartões, um bloco com barra, contagem e botão de 44 px
      expect(visiveis).toBe(PAGINA)
      const bloco = page.locator(`${S}:visible .cv-more.cv-pag`)
      await expect(bloco).toBeVisible()
      await expect(bloco).toHaveAttribute('role', 'group')
      await expect(bloco).toHaveAttribute('aria-label', 'Mostrar mais vídeos')
      await expect(bloco.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', String(PAGINA))
      await expect(bloco).toContainText(new RegExp(`Mostrando ${PAGINA} de ${total} vídeos`))
      const botao = botaoMais(page)
      await expect(botao).toHaveText(`Mostrar mais ${PAGINA} vídeos`)
      const caixa = (await botao.boundingBox())!
      expect(caixa.height, 'alvo de toque: altura').toBeGreaterThanOrEqual(44)
      expect(caixa.width, 'alvo de toque: largura').toBeGreaterThanOrEqual(44)
      // o "Carregar mais" dos antigos (se houvesse) não aparece junto com este; a grade vem antes do botão e nada além do botão fica entre eles
      expect(await page.locator(`${S}:visible .cv-more:visible`).count(), 'um só bloco "mais" visível').toBe(1)
      await foto(page, `grade-depois-${t.rotulo}`)
      await botao.scrollIntoViewIfNeeded()
      await page.screenshot({ path: path.join(SHOTS, `grade-botao-na-tela-${t.rotulo}.png`) })

      // o clique de verdade: mais 24, o foco no primeiro cartão novo, a página não pula, o status diz quantos vieram
      await botao.scrollIntoViewIfNeeded()
      const antesRol = await rolagem(page)
      const idNovo = await cartoesNoDom(page).nth(PAGINA).getAttribute('data-id')
      await botao.click()
      await expect.poll(() => cartoesVisiveis(page)).toBe(2 * PAGINA)
      const depoisRol = await rolagem(page)
      expect(Math.abs(depoisRol - antesRol), `a rolagem não pula (antes ${antesRol}, depois ${depoisRol})`).toBeLessThanOrEqual(2)
      expect(await page.evaluate(() => document.activeElement?.id), 'o foco vai ao primeiro cartão novo').toBe('cv-lnk-' + idNovo)
      d(`[${t.rotulo}] clique: rolagem ${antesRol} -> ${depoisRol}; botão ${caixa.width}x${caixa.height}`)
      await page.screenshot({ path: path.join(SHOTS, `grade-logo-apos-o-clique-${t.rotulo}.png`) })
      await expect(page.locator(`${S}:visible p.cv-status`)).toContainText(new RegExp(`Mostrando ${2 * PAGINA} de ${total} vídeos\\. ${PAGINA} vídeos novos`))
      await expect(bloco.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', String(2 * PAGINA))
      await foto(page, `grade-depois-de-um-clique-${t.rotulo}`)

      // até o fim, só com o teclado (Enter no botão): o último lote é parcial, o botão some e o foco fica num cartão
      let guarda = 0
      while (await botao.isVisible() && guarda++ < 10) {
        await botao.focus()
        await page.keyboard.press('Enter')
        await page.waitForTimeout(150)
        expect(await page.evaluate(() => document.activeElement?.tagName), 'o foco nunca cai no body').not.toBe('BODY')
      }
      expect(await cartoesVisiveis(page)).toBe(total)
      await expect(bloco).toBeHidden()
      expect(await page.evaluate(() => document.activeElement?.id)).toMatch(/^cv-lnk-/)
      expect(await divisoresVisiveis(page), 'com tudo aberto, os divisores voltam').toBe(await page.locator(`${S}:visible ul.cv-grid > li.cv-div`).count())
      await foto(page, `grade-depois-tudo-aberto-${t.rotulo}`)

      await ctx.close()
    })

    test('"Como o canal está": fechada por padrão (sem URL e sem lembrança), com a frase-resumo à vista; abre e fecha com o botão', async ({ browser }) => {
      test.setTimeout(240_000)
      const { ctx, page } = await contexto(browser, t)
      await ir(page, urlCanal(''))
      const secao = page.locator(`${S}:visible section.pn`)
      const botao = secao.getByRole('button', { name: /^Como o canal está/ })
      await expect(botao).toHaveAttribute('aria-expanded', 'false')
      const alvo = await botao.getAttribute('aria-controls')
      expect(alvo).toBeTruthy()
      await expect(page.locator(`#${alvo}`)).toBeHidden()
      // o resumo fechado fala por si: não é vazio, e traz o alcance ou o motivo de não haver
      const resumo = (await secao.locator('.pn-r').innerText()).replace(/\s+/g, ' ').trim()
      expect(resumo.length, 'a frase-resumo existe').toBeGreaterThan(20)
      expect(resumo).toMatch(/impress|alcance|coleta|dado|medi/i)
      d(`[${t.rotulo}] resumo da seção fechada: "${resumo}"`)
      const caixa = (await botao.boundingBox())!
      if (t.toque) expect(caixa.height, 'alvo de toque do botão da seção').toBeGreaterThanOrEqual(44)
      await foto(page, `como-esta-fechado-${t.rotulo}`)

      await botao.click()
      await expect(botao).toHaveAttribute('aria-expanded', 'true')
      await expect(page.locator(`#${alvo}`)).toBeVisible()
      expect(await page.evaluate(() => document.activeElement?.textContent ?? ''), 'o foco fica no botão').toMatch(/^Como o canal está/)
      await foto(page, `como-esta-aberto-${t.rotulo}`)
      await botao.click()
      await expect(botao).toHaveAttribute('aria-expanded', 'false')
      await expect(page.locator(`#${alvo}`)).toBeHidden()
      await ctx.close()
    })
  })
}
