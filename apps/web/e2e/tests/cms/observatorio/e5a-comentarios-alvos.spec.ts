// A5 · E5a · C5 (Gio, 2ª conferência): alvos e título da seção "Comentários de destaque" e a miniatura estreita do Histórico.
// Mede o que o jsdom não mede: tamanho do ⓘ (24 px; 44 px em toque/estreito), título com peso > 400, ⓘ por teclado abre o método com o parágrafo
// do @, legenda sem repetição, e o alvo (::after) da miniatura estreita com >= 44 px de altura sem alcançar o vizinho.
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { C5, MANY_VERSIONS_ID } from '../../../fixtures/observatorio-seed'

const SHOTS = process.env.GIO_SHOTS ?? 'test-results/c5-gio-2'
let ids: ReturnType<typeof seedIdsOf>
test.use({ storageState: ADMIN_STATE })
test.beforeAll(async () => {
  test.setTimeout(240_000)
  await clearSeeded()
  ids = seedIdsOf(await ensureSeeded({ comentariosC5: true, manyVersions: true }))
})
test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

const CASOS = [
  { w: 1440, theme: 'light', toque: false }, { w: 1440, theme: 'dark', toque: false },
  { w: 390, theme: 'light', toque: true }, { w: 390, theme: 'dark', toque: true },
] as const

async function abrir(page: Page, ctx: import('@playwright/test').BrowserContext, base: string, w: number, theme: string, rota: string, espera: string) {
  await ctx.addCookies([{ name: 'btf_theme', value: theme, url: base }])
  await page.setViewportSize({ width: w, height: 900 })
  await page.goto(rota)
  await page.locator(espera).first().waitFor({ timeout: 90_000 })
  await page.waitForLoadState('networkidle')
}

for (const c of CASOS) {
  test(`comentários ${c.w} ${c.theme}: título, ⓘ, teclado, legenda`, async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    const problemas: string[] = []
    page.on('pageerror', e => problemas.push('pageerror: ' + e.message))
    page.on('console', m => { if (m.type() === 'error') problemas.push('console: ' + m.text()) })
    await abrir(page, context, baseURL!, c.w, c.theme, '/cms/youtube/competitors/video/' + ids.video(C5.video.cheio), '.cd-secao .cd-titulo')
    const m = await page.evaluate(() => {
      const t = document.querySelector<HTMLElement>('.cd-secao .cd-titulo')!, b = document.querySelector<HTMLElement>('.cd-secao .ibtn')!
      const rt = t.getBoundingClientRect(), rb = b.getBoundingClientRect(), rs = b.querySelector('svg')!.getBoundingClientRect(), cs = getComputedStyle(t)
      return { peso: +cs.fontWeight, fonte: cs.fontSize, bw: rb.width, bh: rb.height, mesmaLinha: Math.abs((rt.top + rt.height / 2) - (rb.top + rb.height / 2)) < 14,
        sobrepoe: rs.left < rt.right - 1 && rs.right > rt.left + 1 && rs.top < rt.bottom && rs.bottom > rt.top, caixaSobre: Math.max(0, rt.right - rb.left),
        legendas: [...document.querySelectorAll('.cd-secao .cd-leg')].map(e => (e.textContent ?? '').trim().replace(/\s+/g, ' ')),
        scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth }
    })
    const min = c.toque ? 44 : 24
    expect(m.peso, 'título com peso > 400').toBeGreaterThan(400)
    expect(m.bw, 'ⓘ largura').toBeGreaterThanOrEqual(min)
    expect(m.bh, 'ⓘ altura').toBeGreaterThanOrEqual(min)
    expect(m.mesmaLinha, 'ⓘ na linha do título').toBe(true)
    expect(m.sobrepoe, 'ⓘ não cobre o título').toBe(false)
    expect(m.scrollX, 'sem rolagem horizontal').toBe(false)
    // legenda sem repetição: nenhuma palavra de 5+ letras aparece duas vezes na mesma legenda
    for (const l of m.legendas) {
      const ws = l.toLowerCase().split(/\s+/).filter(x => x.length >= 5)
      expect(new Set(ws).size, `legenda repetida: "${l}"`).toBe(ws.length)
    }
    // teclado: Tab chega ao ⓘ; Enter abre; o método traz o parágrafo do @
    await page.locator('.cd-secao .cd-titulo').scrollIntoViewIfNeeded()
    const btn = page.locator('.cd-secao .ibtn').first()
    await btn.focus()
    await expect(btn).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Só as menções com @ ficam escondidas', { exact: false }).first()).toBeVisible()
    await page.screenshot({ path: path.join(SHOTS, `com-${c.w}-${c.theme}.png`) })
    await page.keyboard.press('Escape')
    expect(problemas).toEqual([])
    console.log('MEDIDA', JSON.stringify({ c, m }))
  })
}

// Miniatura estreita do Histórico: só existe na faixa de linha do tempo (>900 px). 1440 = ponteiro fino (alvo >= 24); 1100 com toque = ponteiro grosso (alvo >= 44).
const HIST = [
  { w: 1440, theme: 'light', coarse: false }, { w: 1440, theme: 'dark', coarse: false },
  { w: 1100, theme: 'light', coarse: true }, { w: 1100, theme: 'dark', coarse: true },
] as const
for (const c of HIST) {
  test(`histórico ${c.w}${c.coarse ? ' toque' : ''} ${c.theme}: miniatura estreita com alvo suficiente e sem invadir o vizinho`, async ({ browser, baseURL }) => {
    // ACHADO C5-M3 (menor): a 1440 (ponteiro fino) o botao.mk de outra faixa cobre ~16 px do topo da miniatura #6 e o alvo dela fica com 23 px (< 24). Sai quando consertarem.
    if (!c.coarse) test.fail()
    test.setTimeout(180_000)
    const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: c.w, height: 900 }, hasTouch: c.coarse, isMobile: c.coarse })
    const page = await ctx.newPage()
    try {
      await ctx.addCookies([{ name: 'btf_theme', value: c.theme, url: baseURL! }])
      await page.goto('/cms/youtube/competitors/video/' + ids.video(MANY_VERSIONS_ID) + '?range=tudo')
      await page.locator('[data-obs-screen="historico"] .lane.thumbs .clip.narrow').first().waitFor({ timeout: 90_000 })
      await page.waitForLoadState('networkidle')
      const r = await page.evaluate(() => {
        const lane = document.querySelector<HTMLElement>('[data-obs-screen="historico"] .lane.thumbs')!
        const clips = [...lane.querySelectorAll<HTMLElement>('.clip')]
        const narrow = clips.filter(e => e.classList.contains('narrow'))
        const min = matchMedia('(pointer:coarse),(max-width:900px)').matches ? 44 : 24
        const ruins: string[] = [], amostra: string[] = []
        narrow.forEach((el, i) => {
          el.scrollIntoView({ block: 'center', inline: 'center' })
          const b = el.getBoundingClientRect(), cx = b.left + b.width / 2
          let top = Infinity, bot = -Infinity
          for (let y = Math.floor(b.top) - 30; y <= Math.ceil(b.bottom) + 30; y++) { const t = document.elementFromPoint(cx, y); if (t?.closest('.clip') === el) { top = Math.min(top, y); bot = Math.max(bot, y + 1) } }
          let invade = 0
          for (const o of clips) { if (o === el) continue; const q = o.getBoundingClientRect(); if (q.right < b.left - 30 || q.left > b.right + 30) continue
            for (let x = Math.ceil(q.left) + 1; x < q.right - 1; x += 2) for (const y of [q.top + 3, q.top + q.height / 2, q.bottom - 3]) { if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) continue; if (document.elementFromPoint(x, y)?.closest('.clip') === el) invade++ } }
          const quem: string[] = []; for (const y of [b.top + 2, b.top + b.height / 2, b.bottom - 2]) { const t = document.elementFromPoint(cx, y); quem.push(t ? t.tagName + '.' + String(t.className).slice(0, 30) + '@' + Math.round(t.getBoundingClientRect().height) : 'null') }
          const linha = quem.join('|') + ` #${i} caixa ${Math.round(b.width)}x${Math.round(b.height)} alvo-h ${bot - top} invade ${invade} top ${Math.round(b.top)}`
          if (i < 3) amostra.push(linha)
          if (!(bot - top >= min) || invade > 0) ruins.push(linha)
        })
        return { n: narrow.length, min, ruins, amostra }
      })
      console.log('NARROW', c.w, c.coarse, c.theme, JSON.stringify(r))
      expect(r.ruins).toEqual([])
      await page.screenshot({ path: path.join(SHOTS, `hist-${c.w}-${c.theme}${c.coarse ? '-toque' : ''}.png`) })
    } finally { await ctx.close() }
  })
}
