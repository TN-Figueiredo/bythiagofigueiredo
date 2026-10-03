// apps/web/e2e/tests/cms/observatorio/outliers.spec.ts
// Fidelity of the Outliers screen against outliers.html, plus the layout audits of the approval of 02/10
// (cards of equal height per row; the first card above the fold at 1440×900).
// Ruling R35: enabled when Task 21b's harness lands (seed + ./fidelity with compareSelector, equalHeights, aboveFold).
// Then replace the skipped describe below by a top-level `runFidelity(OUTLIERS)` and import it statically:
//   import { runFidelity, equalHeights, aboveFold } from './fidelity'
import { test } from '@playwright/test'

export const OUTLIERS = {
  name: 'outliers', mockupFile: 'docs/superpowers/mockups/2026-10-02-observatorio/outliers.html', route: '/cms/youtube/competitors/outliers',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: [
    { label: 'Dados de hoje', mockupClicks: ['Dados de hoje'], seed: {} },
    // The spec picks the window the oracle shows empty: obs.outliers({ niche: 'ia', fmt: 'short', ages: [w] }).count === 0.
    { label: 'Janela sem outliers', mockupClicks: ['Janela sem outliers'], seed: {}, query: '?age=31-90&niche=ia&fmt=short' },
    { label: 'Link de leitura (fórmula, todos os vídeos)', mockupClicks: ['Link de leitura (fórmula, todos os vídeos)'], seed: {}, query: '?formula=preco&min=0&asof=2026-10-20' },
    { label: 'Link de leitura (tema)', mockupClicks: ['Link de leitura (tema)'], seed: {}, query: '?topic=comida-de-rua&asof=2026-10-20' },
    { label: 'Link com filtro desconhecido', mockupClicks: ['Link com filtro desconhecido'], seed: {}, query: '?age=99-100&formula=nope' },
    // "Pedido à forja (*)" → Task 35.
  ],
  compareSelector: { mockup: '#screen', impl: '[data-obs-screen="outliers"]' },
  layout: {
    viewport: { width: 1440, height: 900 },
    equalHeights: '[data-outlier-row]', // cards of the same visual row share height and width (the main card spans 2 columns)
    aboveFold: { selector: '[data-outlier]:first-of-type', maxBottom: 900 },
  },
}

// enabled when Task 21b's harness lands
test.describe.skip('observatório: outliers (fidelity + layout audits)', () => {
  test('runFidelity(OUTLIERS)', async () => {
    const { runFidelity } = await import('./fidelity')
    runFidelity(OUTLIERS)
  })
  test('cards of a row share height; the first card is above the fold at 1440×900', async ({ page }) => {
    const { equalHeights, aboveFold } = await import('./fidelity')
    await page.setViewportSize(OUTLIERS.layout.viewport)
    await page.goto(OUTLIERS.route)
    await equalHeights(page, OUTLIERS.layout.equalHeights)
    await aboveFold(page, OUTLIERS.layout.aboveFold.selector, OUTLIERS.layout.aboveFold.maxBottom)
  })
})
