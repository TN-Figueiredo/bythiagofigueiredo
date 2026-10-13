// apps/web/e2e/tests/cms/observatorio/voltar-grade-480.spec.ts
// A4, revisão de UX dos ajustes finais, bloqueio B1: a 480 px ou menos a grade de Capas mostra 24 cartões por vez. Voltar do Histórico com o último
// vídeo visto ALÉM do 24º cartão tem de mostrar o trecho da grade em que ele está, pôr o foco nele (nunca no body, nunca num cartão com display:none)
// e deixá-lo dentro da área visível. Vale no canal do concorrente e no canal próprio (a grade é o mesmo componente). E o Tab a 390 px nunca para num
// cartão escondido. Gesto de mouse e teclado de verdade; todo POST com `next-action` é abortado e reprova.
// Capturas (B1_FASE=antes|depois) em docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/shots/a4-b1/ (pasta não versionada).
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { CANAL_COMPLETO } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE })
const FASE = process.env.B1_FASE ?? 'depois'
const SHOTS = process.env.B1_SHOTS ?? path.resolve(__dirname, '../../../../../../docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/shots/a4-b1')
const ROTA = '/cms/youtube/competitors'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const PAGINA = 24
const ALVO = 29   // o "vídeo 30": índice 29, no segundo lote de 24

let own = '', concorrente = ''
let intrusos: string[] = [], erros: string[] = []

test.beforeAll(async () => {
  test.setTimeout(240_000)
  fs.mkdirSync(SHOTS, { recursive: true })
  const ids = seedIdsOf(await ensureSeeded({ ownPreset: '2', ownL2: 'retencao', canalCompleto: true }))
  own = ids.own('tnfigueiredo')
  concorrente = ids.channel(CANAL_COMPLETO.canal)
})
test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })
test.beforeEach(() => { intrusos = []; erros = [] })
test.afterEach(() => {
  if (intrusos.length) throw new Error(`Server action INESPERADA abortada: ${intrusos.length}. Primeira: ${intrusos[0]}`)
  expect(erros, 'erros de console').toEqual([])
})

interface Tela { rotulo: string; sel: string; url: () => string }
const TELAS: Tela[] = [
  { rotulo: 'proprio', sel: '[data-obs-screen="canal"][data-own="1"]', url: () => `${ROTA}/canal/${own}` },
  { rotulo: 'concorrente', sel: '[data-obs-screen="canal"]:not([data-own="1"])', url: () => `${ROTA}/canal/${concorrente}?sort=recentes&dir=desc` },
]

async function contexto(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: false })
  await ctx.addCookies([{ name: 'btf_theme', value: 'light', url: 'http://localhost:3099' }])
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
async function ir(page: Page, t: Tela): Promise<void> {
  await page.goto(t.url())
  await page.locator(`${t.sel} .chead h1`).first().waitFor({ timeout: 60_000 })
  await page.locator(`${t.sel}:visible ul.cv-grid > li.cv-card`).first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
}
/** O estado do cartão `id` na tela VISÍVEL (depois de um Voltar o Next 16 mantém a árvore anterior escondida ao lado): existe, aparece, o foco está nele, está dentro de `main`. */
async function estadoDoCartao(page: Page, sel: string, id: string) {
  return page.evaluate(({ sel, id }) => {
    const raiz = [...document.querySelectorAll<HTMLElement>(sel)].find(e => e.getClientRects().length > 0)
    const li = raiz?.querySelector<HTMLElement>(`li.cv-card[data-id="${id}"]`) ?? null
    const lnk = raiz?.querySelector<HTMLElement>(`#cv-lnk-${id}`) ?? null
    const ativo = document.activeElement as HTMLElement | null
    const aparece = !!li && li.getClientRects().length > 0 && getComputedStyle(li).display !== 'none'
    const caixa = li?.closest('main')?.getBoundingClientRect()
    const r = li?.getBoundingClientRect()
    const dentro = !!(aparece && r && caixa && r.top >= caixa.top - 1 && r.bottom <= caixa.bottom + 1)
    return {
      existe: !!li, aparece,
      focoNele: !!lnk && ativo === lnk,
      ativo: ativo ? `${ativo.tagName}#${ativo.id}` : 'nenhum',
      dentro, topo: r ? Math.round(r.top) : null, fundo: r ? Math.round(r.bottom) : null,
      janela: caixa ? `${Math.round(caixa.top)}..${Math.round(caixa.bottom)}` : '?',
      cartoes: raiz?.querySelectorAll('li.cv-card').length ?? 0,
      visiveis: [...(raiz?.querySelectorAll<HTMLElement>('li.cv-card') ?? [])].filter(c => c.getClientRects().length > 0 && getComputedStyle(c).display !== 'none').length,
    }
  }, { sel, id })
}

for (const t of TELAS) {
  test.describe(`B1 · ${t.rotulo} · 390 px`, () => {
    test('Voltar do Histórico com o vídeo 30 (além do 24º cartão): o cartão aparece, o foco está nele e ele está dentro da janela', async ({ browser }) => {
      test.setTimeout(240_000)
      const { ctx, page } = await contexto(browser)
      await ir(page, t)
      const botao = page.locator(`${t.sel}:visible .cv-more.cv-pag button`)
      await expect(botao).toHaveText(`Mostrar mais ${PAGINA} vídeos`)
      // dois lotes: 48 cartões, o 30º à vista
      await botao.scrollIntoViewIfNeeded()
      await botao.click()
      await expect.poll(async () => (await estadoDoCartao(page, t.sel, '')).visiveis).toBe(2 * PAGINA)
      const card = page.locator(`${t.sel}:visible ul.cv-grid > li.cv-card`).nth(ALVO)
      const id = (await card.getAttribute('data-id'))!
      await card.scrollIntoViewIfNeeded()
      const link = card.locator('a.cv-lnk')
      await expect(link).toBeVisible()
      const urlAntes = page.url()
      await link.click()
      await page.waitForURL(/\/competitors\/video\//, { timeout: 30_000 })
      // o Histórico grava o último vídeo visto depois de hidratar: quem fica um segundo ali já o gravou (sem isso o Voltar corre na frente do registro)
      await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).some(k => k.startsWith('obs:ultimo-video:')))).toBe(true)
      await page.goBack()
      await page.waitForURL(u => u.pathname.includes('/canal/'), { timeout: 30_000 })
      await page.locator(`${t.sel}:visible ul.cv-grid > li.cv-card`).first().waitFor({ timeout: 30_000 })
      await page.waitForLoadState('networkidle')
      expect(page.url()).toBe(urlAntes)
      // a restauração leva até ~1 s (e a rolagem reafirmada 6 s): espera o foco assentar antes de medir
      await page.waitForTimeout(2500)
      const e = await estadoDoCartao(page, t.sel, id)
      await page.screenshot({ path: path.join(SHOTS, `${FASE}-voltar-${t.rotulo}.png`) })
      fs.appendFileSync(path.join(SHOTS, `${FASE}-medidas.txt`), `[${t.rotulo}] vídeo ${ALVO + 1}: ${JSON.stringify(e)}\n`)
      expect(e.existe, 'o cartão está no documento').toBe(true)
      expect(e.aparece, `o cartão 30 aparece (visíveis ${e.visiveis} de ${e.cartoes})`).toBe(true)
      expect(e.focoNele, `o foco está no cartão 30, não em ${e.ativo}`).toBe(true)
      expect(e.dentro, `o cartão 30 está dentro da janela (${e.topo}..${e.fundo} em ${e.janela})`).toBe(true)
      await ctx.close()
    })

    test('teclado: o Tab a 390 px nunca para num cartão escondido, e focus() num cartão escondido não leva o foco', async ({ browser }) => {
      test.setTimeout(240_000)
      const { ctx, page } = await contexto(browser)
      await ir(page, t)
      const total = await page.locator(`${t.sel}:visible ul.cv-grid > li.cv-card`).count()
      expect(total, 'há mais de uma página').toBeGreaterThan(PAGINA + 1)
      // a causa do B1, provada: o cartão escondido não recebe foco
      const escondido = await page.evaluate(({ sel, n }) => {
        const raiz = [...document.querySelectorAll<HTMLElement>(sel)].find(e => e.getClientRects().length > 0)!
        const li = raiz.querySelectorAll<HTMLElement>('ul.cv-grid > li.cv-card')[n]!
        const lnk = li.querySelector<HTMLElement>('a.cv-lnk')!
        const antes = document.activeElement
        lnk.focus()
        return { display: getComputedStyle(li).display, mudou: document.activeElement !== antes, noCartao: document.activeElement === lnk }
      }, { sel: t.sel, n: PAGINA + 5 })
      expect(escondido.display, 'o cartão 30 está escondido na página 1').toBe('none')
      expect(escondido.noCartao, 'focus() num cartão com display:none não leva o foco').toBe(false)
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      // percorre com o Tab de verdade, do título da aba até o botão "Mostrar mais"
      await page.locator(`${t.sel}:visible #cv-h2`).evaluate(e => (e as HTMLElement).focus())
      const paradas: Array<{ onde: string; visivel: boolean; idx: number }> = []
      let chegou = false
      for (let i = 0; i < 400 && !chegou; i++) {
        await page.keyboard.press('Tab')
        const p = await page.evaluate(sel => {
          const a = document.activeElement as HTMLElement | null
          if (!a || a === document.body) return { onde: 'BODY', visivel: false, idx: -1, botao: false }
          const li = a.closest('ul.cv-grid > li.cv-card')
          const idx = li ? [...li.parentElement!.querySelectorAll(':scope > li.cv-card')].indexOf(li) : -1
          const raiz = [...document.querySelectorAll<HTMLElement>(sel)].find(e => e.getClientRects().length > 0)
          return { onde: `${a.tagName}#${a.id || a.className}`.slice(0, 60), visivel: a.checkVisibility({ checkVisibilityCSS: true }) && !!raiz?.contains(a), idx, botao: !!a.closest('.cv-more.cv-pag') }
        }, t.sel)
        paradas.push(p)
        if (p.botao) chegou = true
      }
      expect(chegou, 'o Tab chega ao botão "Mostrar mais" passando só pelos cartões da página').toBe(true)
      const naGrade = paradas.filter(p => p.idx >= 0)
      expect(naGrade.length, 'o Tab passa pelos cartões da grade').toBeGreaterThanOrEqual(PAGINA)
      const invisiveis = paradas.filter(p => !p.visivel)
      expect(invisiveis, 'toda parada do Tab está visível').toEqual([])
      expect(Math.max(...naGrade.map(p => p.idx)), 'nenhuma parada além do 24º cartão').toBeLessThan(PAGINA)
      await ctx.close()
    })
  })
}
