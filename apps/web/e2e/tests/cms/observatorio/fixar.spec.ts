// apps/web/e2e/tests/cms/observatorio/fixar.spec.ts
// What jsdom cannot measure about "Fixar vídeo" (plan 2026-10-06-observatorio-fixar-video, Task 16; mockup reviews r4):
// the pin button keeps its rectangle across idle / pending / refusal / failure; the focus hint covers no message and no
// control and closes with Esc; "Remover canal" does not move when the count arrives; 44 px targets with a coarse pointer.
// The action's answer is replaced by page.route: nothing is written to the database.
import { test, expect, type Page, type Locator } from '@playwright/test'
import { ADMIN_STATE, ensureSeeded, seedIdsOf } from './fidelity'

test.use({ storageState: ADMIN_STATE })
const FULL = 'matt-opus55', CH = 'matt-wolfe'
let ids: ReturnType<typeof seedIdsOf>
test.beforeAll(async () => { ids = seedIdsOf(await ensureSeeded({})) })

type Box = { x: number; y: number; width: number; height: number }
const box = async (l: Locator): Promise<Box> => { await l.waitFor({ state: 'visible' }); const b = await l.boundingBox(); if (!b) throw new Error('sem retângulo: ' + l); return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) } }
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
/** Document-relative box (the page may scroll between two measurements). */
/** Box relative to an ancestor: immune to whatever the shell does above it when the page scrolls (sticky bars, the collapsing summary). */
const relBox = async (l: Locator, anchor: Locator): Promise<Box> => { const b = await box(l), a = await box(anchor); return { ...b, x: b.x - a.x, y: b.y - a.y } }
/**
 * Box that does not change when the page scrolls. `y` is relative to the top of the screen's root, not window.scrollY: the
 * CMS shell scrolls inside its own container (the window never moves), so a click that scrolled the button into view read
 * as a 401 px jump. Seen at 390 px once Fase 4's 44 px targets pushed "Fixar vídeo" under the bottom bar
 * (historico.css, the "(pointer:coarse),(max-width:900px)" rules; plan 2026-10-07-observatorio-historico-muitas-versoes Task 11).
 */
const docBox = async (page: Page, l: Locator): Promise<Box> => {
  const b = await box(l), root = page.locator('[data-obs-screen]').first()
  const top = (await root.count()) ? (await box(root)).y : -(await page.evaluate(() => window.scrollY))
  return { ...b, x: b.x + await page.evaluate(() => window.scrollX), y: b.y - top }
}

/**
 * Waits until the screen stopped moving: the CMS shell collapses its sidebar after hydration and the chrome fills in, which
 * shifts everything once. A measurement taken before that compares two different pages.
 */
async function settle(page: Page, l: Locator, o: { idle?: boolean } = {}): Promise<void> {
  if (o.idle !== false) await page.waitForLoadState('networkidle')
  let last = '', same = 0
  for (let i = 0; i < 40 && same < 3; i++) {
    const now = JSON.stringify(await docBox(page, l))
    same = now === last ? same + 1 : 0; last = now
    await page.waitForTimeout(100)
  }
}

/**
 * Holds the server actions whose arguments carry `needle` (the video or channel uuid: pinVideo(id), the removal count)
 * until `release()`, then aborts them. Every other action of the page (niche, forja polling, sync status) goes through:
 * holding those would freeze parts of the chrome and move the layout under the measurement.
 */
async function holdActions(page: Page, needle: string) {
  let release!: () => void
  const gate = new Promise<void>(r => { release = r })
  await page.route('**/*', async route => {
    const req = route.request()
    if (req.method() !== 'POST' || !req.headers()['next-action'] || !(req.postData() ?? '').includes(needle)) return route.continue()
    await gate
    await route.abort('failed') // an aborted action rejects on the client → the kit shows its own failure sentence
  })
  return { release }
}

/**
 * Opens the removal confirmation from the channel drawer. Dispatched, not clicked: what is measured is the dialog, and at
 * 320 × 480 the drawer's footer is outside the viewport (and, in dev, the Next badge sits over it).
 */
async function openRemove(page: Page): Promise<void> {
  const b = page.locator('.cn-drawer').getByRole('button', { name: 'Remover canal…', exact: true })
  // the button is in the server HTML before React hydrates: a click dispatched then is lost (seen after a cold route compile).
  // No hydration marker exists, so click again until the dialog is really there (a click that took effect stops the loop).
  const dlg = page.locator('[role="dialog"][aria-labelledby="cn-cfT"]')
  await b.waitFor()
  await expect(async () => { await b.dispatchEvent('click'); await expect(dlg).toBeVisible({ timeout: 1500 }) }).toPass({ timeout: 15_000 })
}

const HIST_WIDTHS = [390, 768, 1099, 1100, 1440], MUD_WIDTHS = [390, 768, 999, 1440]

for (const width of HIST_WIDTHS) {
  test(`Histórico ${width} px: o botão de fixar não se move nem muda de tamanho (parado, em andamento, falha)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const hold = await holdActions(page, ids.video(FULL))
    await page.goto('/cms/youtube/competitors/video/' + ids.video(FULL))
    const btn = page.locator('[data-obs-screen="historico"] [data-pin]')
    await expect(btn).toHaveText('Fixar vídeo')
    await settle(page, btn)
    const idle = await docBox(page, btn)
    await btn.click()
    await expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(await docBox(page, btn)).toEqual(idle)
    hold.release()
    const msg = page.locator('[data-obs-screen="historico"] .fx-msg')
    await expect(msg).toHaveAttribute('data-fx-msg', 'failed')
    await expect(btn).toHaveText('Fixar vídeo')
    expect(await docBox(page, btn)).toEqual(idle)
    // the message is born below the row, inside the screen, and above the forja button
    const m = await docBox(page, msg)
    expect(m.y).toBeGreaterThanOrEqual(idle.y + idle.height)
    expect(m.x + m.width).toBeLessThanOrEqual(width)
    const forja = page.locator('[data-obs-screen="historico"] .actions .frow button').first()
    if (await forja.count()) expect((await docBox(page, forja)).y).toBeGreaterThanOrEqual(m.y + m.height)
    // order on screen = order in the DOM: title above the actions row
    // above 1100 px title and actions share the header's first row (two columns); below, the title is above the actions row
    const h2y = (await docBox(page, page.locator('.vhead .vt h2'))).y
    if (width <= 1100) expect(h2y).toBeLessThan(idle.y); else expect(h2y).toBeLessThan(idle.y + idle.height)
  })

  test(`Histórico ${width} px: a dica de foco não cobre controle nem mensagem, e fecha com Esc`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const hold = await holdActions(page, ids.video(FULL))
    await page.goto('/cms/youtube/competitors/video/' + ids.video(FULL))
    const btn = page.locator('[data-obs-screen="historico"] [data-pin]'), hint = page.locator('[data-obs-screen="historico"] .fx-hint')
    // A0.1: the span .fx-hint stays beside the button for screen readers (it carries data-open); the visible box is in #flut
    const visible = page.locator('#flut .fx-hint-pop')
    await settle(page, btn)
    await btn.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab') // focus by keyboard
    await expect(hint).toHaveAttribute('data-open', '')
    await expect(visible).toBeVisible()
    const h = await docBox(page, visible)
    for (const el of await page.locator('[data-obs-screen="historico"] a[href]:visible, [data-obs-screen="historico"] button:visible').all()) {
      if (await el.getAttribute('data-pin')) continue
      expect(overlap(h, await docBox(page, el)), 'a dica cobre: ' + (await el.textContent())).toBe(0)
    }
    expect(h.x).toBeGreaterThanOrEqual(0); expect(h.x + h.width).toBeLessThanOrEqual(width)
    await page.keyboard.press('Escape')
    await expect(hint).not.toHaveAttribute('data-open', '')
    await expect(visible).toHaveCount(0)
    await expect(btn).toBeFocused()
    // a result message and the hint never share the screen
    await page.keyboard.press('Enter'); hold.release()
    await expect(page.locator('[data-obs-screen="historico"] .fx-msg')).toBeVisible()
    await expect(hint).not.toHaveAttribute('data-open', '')
    await expect(visible).toHaveCount(0)
    await btn.blur(); await btn.focus()
    await expect(hint).not.toHaveAttribute('data-open', '')
    await expect(visible).toHaveCount(0)
  })
}

for (const width of MUD_WIDTHS) {
  test(`Mudanças ${width} px: o botão do cartão não se move entre os estados, e a ordem na tela é a do DOM`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const hold = await holdActions(page, ids.video(FULL))
    await page.goto('/cms/youtube/competitors/mudancas?win=90&video=' + ids.video(FULL))
    const card = page.locator('article.vid').first(), btn = card.locator('[data-pin]')
    await expect(btn).toHaveText('Fixar vídeo')
    await settle(page, btn)
    const idle = await relBox(btn, card)
    // canal, título, ações: each starts at or below the previous one's top (no `order`)
    const top = async (sel: string) => (await relBox(card.locator(sel).first(), card)).y
    expect(await top('.who .ch')).toBeLessThanOrEqual(await top('.who h3'))
    if (width < 1000) expect(await top('.who h3')).toBeLessThan(idle.y)
    await btn.click()
    await expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(await relBox(btn, card)).toEqual(idle)
    hold.release()
    const msg = card.locator('.fx-row .fx-msg')
    await expect(msg).toBeVisible()
    expect(await relBox(btn, card)).toEqual(idle)
    expect((await relBox(msg, card)).y).toBeGreaterThanOrEqual(idle.y + idle.height)
  })
}

test('Mudanças 390 px: o selo e as views que chegam depois de fixar cabem na altura reservada (o botão não desce)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/cms/youtube/competitors/mudancas?win=90&video=' + ids.video(FULL))
  const card = page.locator('article.vid').first(), btn = card.locator('[data-pin]')
  await settle(page, btn)
  const before = await relBox(btn, card)
  // the widest state the header can reach: two chips and one more meta item, written straight into the reserved lines
  await card.locator('.fx-chips').evaluate(el => { el.innerHTML = '<span class="fx-chip fx-sm"><span class="fx-st">Fixado agora</span><span class="fx-how">sincronização do canal atrasada</span></span><span class="fx-chip fx-out fx-sm"><span class="fx-st">fora dos 200 mais recentes</span></span>' })
  await card.locator('.who .meta').evaluate(el => { const s = document.createElement('span'); s.textContent = '12,3 mi views em 24/10 12:00'; el.appendChild(s) })
  expect(await relBox(btn, card)).toEqual(before)
})

test('Diálogo de remover: "Remover canal" não se move quando a contagem chega', async ({ page }) => {
  for (const size of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 320, height: 480 }]) {
    await page.setViewportSize(size)
    const hold = await holdActions(page, ids.channel(CH))
    await page.goto('/cms/youtube/competitors?channel=' + ids.channel(CH))
    await openRemove(page)
    // below the drawer's modal width the drawer is a dialog too: this is the confirmation only
    const dlg = page.locator('[role="dialog"][aria-labelledby="cn-cfT"]'), yes = dlg.getByRole('button', { name: 'Remover canal', exact: true })
    await expect(dlg.locator('.fx-loss')).toHaveAttribute('aria-busy', 'true')
    await expect(dlg.getByRole('button', { name: 'Cancelar' })).toBeFocused()
    await settle(page, yes, { idle: false }) // the count is held: the network is not idle on purpose
    const counting = await box(yes), boxBefore = await box(dlg.locator('.box'))
    hold.release() // the aborted count lands on "não foi possível contar"
    await expect(dlg.locator('.fx-msg.fx-err')).toBeVisible()
    expect(await box(yes)).toEqual(counting)
    expect((await box(dlg.locator('.box'))).height).toBe(boxBefore.height)
    await page.unroute('**/*')
    await page.keyboard.press('Escape')
    // and with the real count
    await openRemove(page)
    await expect(dlg.locator('.fx-loss')).not.toHaveAttribute('aria-busy', 'true')
    expect(await box(yes)).toEqual(counting)
    await page.keyboard.press('Escape')
  }
})

test.describe('ponteiro grosso', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
  test('os alvos novos têm 44 px de altura nas três telas', async ({ page }) => {
    await page.goto('/cms/youtube/competitors/video/' + ids.video(FULL))
    await page.waitForLoadState('networkidle') // while the page streams in, React keeps a hidden copy of the screen
    expect((await box(page.locator('[data-obs-screen="historico"] [data-pin]'))).height).toBeGreaterThanOrEqual(44)
    await page.goto('/cms/youtube/competitors/mudancas?win=90&video=' + ids.video(FULL))
    await page.waitForLoadState('networkidle')
    expect((await box(page.locator('article.vid [data-pin]').first())).height).toBeGreaterThanOrEqual(44)
    await page.goto('/cms/youtube/competitors?channel=' + ids.channel(CH))
    await openRemove(page)
    await page.locator('[role="dialog"][aria-labelledby="cn-cfT"] .acts .btn').first().waitFor()
    for (const b of await page.locator('[role="dialog"][aria-labelledby="cn-cfT"] .acts .btn').all()) expect((await box(b)).height).toBeGreaterThanOrEqual(44)
  })
})
