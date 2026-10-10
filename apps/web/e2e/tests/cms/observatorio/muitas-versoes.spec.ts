// apps/web/e2e/tests/cms/observatorio/muitas-versoes.spec.ts
// What jsdom cannot measure about "histórico com muitas versões" (plan 2026-10-07-observatorio-historico-muitas-versoes,
// Task 11; mockup reviews r2): nothing overflows, no lane item covers its neighbour, a group opens on Enter and never on
// focus, its list stays inside the timeline, the period filter and the grid button do not move what is around them, the
// comparison filters keep the list in place, and the targets are 24 px (44 px on a narrow or coarse screen).
// The video is the seed's synthetic one (observatorio-seed.ts manyVersionsVideo): 24 thumbnail periods, 33 changes.
import { test, expect, type Page, type Locator } from '@playwright/test'
import { ADMIN_STATE, ensureSeeded, seedIdsOf } from './fidelity'
import { MANY_VERSIONS_ID } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE })
let ids: ReturnType<typeof seedIdsOf>
test.beforeAll(async () => { ids = seedIdsOf(await ensureSeeded({ manyVersions: true })) })

const S = '[data-obs-screen="historico"]'
const WIDTHS = [1440, 1100, 760] as const
type Box = { x: number; y: number; width: number; height: number }
const box = async (l: Locator): Promise<Box> => { await l.waitFor({ state: 'visible' }); const b = await l.boundingBox(); if (!b) throw new Error('sem retângulo: ' + l); return b }
/**
 * Top relative to the screen's root (the page may scroll between two measurements). Not window.scrollY: the CMS shell
 * scrolls inside its own container, so the window never moves.
 */
const docY = async (page: Page, l: Locator) => Math.round((await box(l)).y - (await box(page.locator(S))).y)
/** Grows the viewport until the shell's scroll container shows the whole screen (fullPage alone captures 900 px of it). */
async function fitWholeScreen(page: Page, width: number) {
  const extra = await page.evaluate(() => {
    let m = 0
    for (const e of document.querySelectorAll<HTMLElement>('*')) {
      const o = getComputedStyle(e).overflowY
      if ((o === 'auto' || o === 'scroll') && e.querySelector('[data-obs-screen]')) m = Math.max(m, e.scrollHeight - e.clientHeight)
    }
    return m
  })
  await page.setViewportSize({ width, height: 900 + extra + 20 })
}
async function open(page: Page, width: number, query = '') {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/cms/youtube/competitors/video/' + ids.video(MANY_VERSIONS_ID) + query)
  await page.locator(S + ' .lanes .ln-i').first().waitFor()
  await page.waitForLoadState('networkidle')
}

for (const width of WIDTHS) {
  test(`${width} px: nada passa da largura da tela e nenhum item da faixa cobre o vizinho`, async ({ page }) => {
    await open(page, width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    const over = await page.evaluate(sel => {
      const root = document.querySelector(sel)!, right = root.getBoundingClientRect().right
      return [...root.querySelectorAll<HTMLElement>('.lanes *, .isum-card *, #hv-compare *')].filter(e => e.offsetParent !== null && !e.classList.contains('sr') && !e.closest('.gpop, .isum-sc, .clist'))
        .filter(e => e.getBoundingClientRect().right > right + 1).map(e => e.className + ' ' + (e.textContent ?? '').slice(0, 30))
    }, S)
    expect(over).toEqual([])
    for (const type of ['title', 'thumb', 'desc']) {
      const rects = await page.locator(`${S} [data-lane="${type}"] > .clip, ${S} [data-lane="${type}"] > .gwrap.pg`).evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [r.left, r.right] as [number, number] }).sort((a, b) => a[0] - b[0]))
      for (let i = 1; i < rects.length; i++) expect(rects[i - 1]![1], `${type} ${i}`).toBeLessThanOrEqual(rects[i]![0] + 1.5)
    }
    // one tick per change inside every counter
    const groups = await page.locator(`${S} .gwrap.mg`).evaluateAll(els => els.map(e => [e.querySelector('.mkg')!.getAttribute('data-pairs')!.split(' ').length, e.querySelectorAll('.mtick').length]))
    for (const [n, ticks] of groups) expect(ticks).toBe(n)
  })

  test(`${width} px: cada faixa é uma parada de Tab; o grupo não abre no foco, abre com Enter, a lista cabe inteira na janela e fecha com Esc`, async ({ page }) => {
    await open(page, width)
    expect(await page.locator(`${S} .lanes [tabindex="0"]`).count()).toBe(3)
    const g = page.locator(`${S} [data-lane="thumb"] .gbtn`).first()
    await g.focus()
    await expect(g).toHaveAttribute('aria-expanded', 'false')
    // the tooltip and the list live in the floating layer (#flut), outside the screen's root
    await expect(page.locator('#flut #hv-tip')).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(g).toHaveAttribute('aria-expanded', 'true')
    const pop = page.locator('#flut #' + await g.getAttribute('aria-controls'))
    const p = await box(pop), win = page.viewportSize()!
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.x + p.width).toBeLessThanOrEqual(win.width + 1)
    expect(p.y).toBeGreaterThanOrEqual(0)
    expect(p.y + p.height).toBeLessThanOrEqual(win.height + 1)
    await page.keyboard.press('Escape')
    await expect(g).toHaveAttribute('aria-expanded', 'false')
    await expect(g).toBeFocused()
    // the arrows walk the lane and never leave it
    await page.keyboard.press('End'); await page.keyboard.press('ArrowRight')
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-lane="thumb"]'))).toBe(true)
  })

  test(`${width} px: trocar o período não move o gráfico nem as faixas, escreve ?range= e deixa o foco no botão`, async ({ page }) => {
    await open(page, width)
    const chart = page.locator(S + ' svg.hv-chart'), lanes = page.locator(S + ' .lanes'), b7 = page.locator(S + ' [data-range="7"]')
    const before = [await docY(page, chart), await docY(page, lanes)]
    await b7.click()
    await expect(page).toHaveURL(/[?&]range=7(&|$)/)
    await expect(page.locator(S + ' #hv-rngtxt')).toContainText('De 17/10 15:02 até agora')
    await expect(b7).toHaveAttribute('aria-pressed', 'true')
    await expect(b7).toBeFocused()
    expect([await docY(page, chart), await docY(page, lanes)]).toEqual(before)
    await page.locator(S + ' [data-range="tudo"]').click()
    await expect(page).not.toHaveURL(/range=/)
  })

  test(`${width} px: "Ver todas" não move o botão; escolher na faixa um período recolhido abre a grade e leva ao cartão`, async ({ page }) => {
    await open(page, width)
    const more = page.locator(S + ' #hv-more')
    await expect(more).toHaveText('Ver todas (24)')
    expect(await page.locator(S + ' #hv-film .fcard:visible').count()).toBe(8)
    const y0 = await docY(page, more)
    await more.click()
    await expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(await docY(page, more)).toBe(y0)
    expect(await page.locator(S + ' #hv-film .fcard:visible').count()).toBe(24)
    await more.click()
    // the first thumbnail period (index 0) is hidden while the grid is collapsed
    const first = page.locator(`${S} [data-lane="thumb"] [data-k="thumb:0"], ${S} [data-lane="thumb"] .cgrp`).first()
    await first.click()
    const go = page.locator('#flut .gpop [data-go]').first()
    if (await go.count()) await go.click()
    const card = page.locator(S + ' #hv-film .fcard.target')
    await expect(card).toBeVisible()
    await expect(card).toBeFocused()
    await expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(await card.evaluate(e => getComputedStyle(e).outlineWidth)).toBe('3px')
  })

  test(`${width} px: filtrar a comparação não move a barra nem a lista, e a frase de contagem é o mesmo nó`, async ({ page }) => {
    await open(page, width)
    const flt = page.locator(S + ' .flt'), list = page.locator(S + ' #hv-clist'), count = page.locator(S + ' #hv-cmpcount')
    await expect(count).toContainText('Mostrando 33 de 33 trocas.')
    await count.evaluate(e => e.setAttribute('data-same', '1'))
    const before = [await docY(page, flt), (await box(flt)).height, await docY(page, list)]
    await page.locator(S + ' [data-flt="field"][data-v="title"]').click()
    await expect(count).toContainText('Mostrando 8 de 33 trocas.')
    await expect(count).toHaveAttribute('data-same', '1')
    expect([await docY(page, flt), (await box(flt)).height, await docY(page, list)]).toEqual(before)
    await page.locator(S + ' [data-flt="situation"][data-v="ganhou"]').click()
    await expect(page.locator(S + ' #hv-fltclear')).toHaveText('Limpar filtros')
    expect([await docY(page, flt), (await box(flt)).height]).toEqual(before.slice(0, 2))
  })

  test(`${width} px: alvos com o tamanho mínimo e toda thumbnail com width e height`, async ({ page }) => {
    await open(page, width)
    const min = width <= 900 ? 44 : 24
    const small = await page.locator(`${S} .mk, ${S} .mkg, ${S} .seg button, ${S} .isum-b, ${S} #hv-more, ${S} #hv-clist li`).evaluateAll((els, m) =>
      els.filter(e => (e as HTMLElement).offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return { c: e.className, w: Math.round(r.width), h: Math.round(r.height) } }).filter(r => r.w < m || r.h < m), min)
    expect(small).toEqual([])
    expect(await page.locator(S + ' img').evaluateAll(els => els.filter(e => !e.getAttribute('width') || !e.getAttribute('height')).length)).toBe(0)
  })
}

test('1440 px: o resumo por imagem fica entre a linha do tempo e a comparação; fixar e Esc', async ({ page }) => {
  await open(page, 1440)
  const sum = page.locator(S + ' #hv-isum')
  expect(await docY(page, sum)).toBeGreaterThan(await docY(page, page.locator(S + ' .lanes')))
  expect(await docY(page, sum)).toBeLessThan(await docY(page, page.locator(S + ' #hv-compare')))
  await expect(sum.locator('tbody tr')).toHaveCount(5)
  const pin = sum.getByRole('button', { name: 'A: fixar o destaque desta imagem' })
  await pin.click()
  await expect(pin).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator(S + ' #hv-live')).toHaveText('Imagem A fixada no destaque. Esc solta.')
  await page.keyboard.press('Escape')
  await expect(pin).toHaveAttribute('aria-pressed', 'false')
  await expect(pin).toBeFocused()
})

test('Mudanças 1440 px: a linha da sequência cabe em duas linhas e a definição aparece uma vez no cartão', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/cms/youtube/competitors/mudancas?video=' + ids.video(MANY_VERSIONS_ID) + '&win=30')
  const card = page.locator(`[data-obs-screen="mudancas"] article[data-video="${ids.video(MANY_VERSIONS_ID)}"]`).first()
  await card.waitFor()
  await expect(card.locator('[data-run-note]')).toHaveCount(1)
  await expect(card.locator('[data-run-note]')).toContainText('Pode ser um teste; o YouTube não informa.')
  const run = card.locator('[data-run]').first()
  await expect(run).toContainText('trocas em sequência')
  const lh = await run.evaluate(e => parseFloat(getComputedStyle(e).lineHeight) || 18)
  expect((await box(run)).height).toBeLessThanOrEqual(lh * 2 + 2)
})

// Captures for the owner (not assertions): every width in both themes, the whole page.
for (const theme of ['dark', 'light'] as const) for (const width of WIDTHS) {
  test(`captura ${width} px ${theme}`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'btf_theme', value: theme, url: baseURL! }])
    await open(page, width)
    await fitWholeScreen(page, width)
    await page.screenshot({ path: `test-results/observatorio/fase4/historico-${width}-${theme}.png`, fullPage: true })
    await open(page, width, '?range=7')
    await fitWholeScreen(page, width)
    await page.screenshot({ path: `test-results/observatorio/fase4/historico-${width}-${theme}-7d.png`, fullPage: true })
  })
}
