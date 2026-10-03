// apps/web/e2e/tests/cms/observatorio/outliers.spec.ts
// Fidelity of the Outliers screen against outliers.html ("Cenário" states, outliers.html:1013-1021 onMock/DEMO_LINKS),
// plus the layout audits of the approval of 02/10: cards of a row share height ([data-obs-row], checked by
// layoutAudits) and the first card sits above the fold at 1440×900. The "Pedido à forja" states are in forja.spec.ts.
import { test, expect, type Page } from '@playwright/test'
import { runFidelity, mockupUrl, ensureSeeded, OUTLIERS_TARGET_EXEMPT, type ScreenSpec } from './fidelity'
import path from 'node:path'


export const OUTLIERS: ScreenSpec = {
  name: 'outliers', mockupFile: 'docs/superpowers/mockups/2026-10-02-observatorio/outliers.html', route: '/cms/youtube/competitors/outliers',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: [
    { label: 'Dados de hoje', mockupClicks: ['Dados de hoje'], seed: {} },
    // onMock 'empty': IA, Shorts, 31–90 d
    { label: 'Janela sem outliers', mockupClicks: ['Janela sem outliers'], seed: {}, query: '?age=31-90&niche=ia&fmt=short' },
    // DEMO_LINKS.link / .linktheme, the exact OBS.link.outliers URLs (reading = the seeded id of the same reading)
    {
      label: 'Link de leitura (fórmula, todos os vídeos)', mockupClicks: ['Link de leitura (fórmula, todos os vídeos)'], seed: {},
      query: '?fmt=long&age=0-30,31-90,91-180&formula=preco&min=0&reading=<reading:padroes-titulo-viagem-20-10>&from=insights',
    },
    {
      label: 'Link de leitura (tema)', mockupClicks: ['Link de leitura (tema)'], seed: {},
      query: '?fmt=long&age=0-30,31-90&topic=lugares-perigosos&min=2&reading=<reading:temas-viagem-20-10>&from=insights',
    },
    // DEMO_LINKS.badlink
    { label: 'Link com filtro desconhecido', mockupClicks: ['Link com filtro desconhecido'], seed: {}, query: '?from=insights&formula=lista&age=0-30,365%2B,ontem&channel=matt' },
  ],
  compareSelector: { mockup: '#screen', impl: '[data-obs-screen="outliers"]' },
  targetExempt: OUTLIERS_TARGET_EXEMPT,
}

runFidelity(OUTLIERS)

/**
 * "1º card acima da dobra" (outliers.html:354, F10 I4; CONVENCOES:201 "Herói acima da dobra a 1440×900"). Measured the
 * same way on the binding mockup and on the screen: the first card starts, and its multiplier (the hero's number) is
 * whole, inside the 900 px viewport. The card's BOTTOM is not the criterion: the mockup's own first card ends ≈ 905 px
 * below its content top, so "bottom ≤ 900" (the first draft of this check) fails the approved mockup itself.
 */
test.describe('outliers · primeiro card acima da dobra', () => {
  test.beforeAll(async () => { test.setTimeout(180_000); await ensureSeeded({}) })
  const fold = async (page: Page, card: string, mult: string) => {
    const c = page.locator(card).first()
    await c.waitFor({ state: 'visible' })
    const cb = (await c.boundingBox())!, mb = (await c.locator(mult).first().boundingBox())!
    return { cardTop: cb.y, multBottom: mb.y + mb.height }
  }
  for (const theme of ['dark', 'light'] as const) test(`1440×900 · ${theme}`, async ({ browser }) => {
    const vp = { viewport: { width: 1440, height: 900 }, colorScheme: theme } as const
    const ctx = await browser.newContext({ ...vp, storageState: path.resolve(__dirname, '../../../.auth/admin.json') }), mctx = await browser.newContext(vp)
    try {
      const page = await ctx.newPage()
      await page.goto(OUTLIERS.route)
      const impl = await fold(page, '[data-obs-screen="outliers"] [data-outlier]', '.obs-out-mult')
      const mock = await mctx.newPage()
      await mock.goto(mockupUrl(OUTLIERS.mockupFile, theme))
      const m = await fold(mock, '#screen .card', '.mult')
      // the criterion holds on the approved mockup (the check is not stricter than what was approved) …
      expect(m.multBottom).toBeLessThanOrEqual(900)
      // … and on the screen
      expect(impl.cardTop).toBeLessThan(900)
      expect(impl.multBottom).toBeLessThanOrEqual(900)
    } finally { await ctx.close(); await mctx.close() }
  })
})
