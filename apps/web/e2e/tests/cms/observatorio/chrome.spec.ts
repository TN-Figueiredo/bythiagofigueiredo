// apps/web/e2e/tests/cms/observatorio/chrome.spec.ts
// Fidelity of the chrome (header, freshness, tabs with counts, niche bar) against moldura-forja.html.
// Ruling R35: enabled when Task 21b's harness lands (seed + ./fidelity with compareSelector in ScreenSpec).
// Then replace the skipped describe below by a top-level `runFidelity(MOLDURA)` and import it statically:
//   import { runFidelity } from './fidelity'
import { test } from '@playwright/test'

export const MOLDURA = {
  name: 'moldura', mockupFile: 'docs/superpowers/mockups/2026-10-02-observatorio/moldura-forja.html', route: '/cms/youtube/competitors',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: [
    { label: 'Aba Canais', mockupClicks: ['Canais'], seed: {} },
    { label: 'Aba Mudanças', mockupClicks: ['Mudanças'], seed: {}, query: '' },
    { label: 'Aba Outliers', mockupClicks: ['Outliers'], seed: {} },
    { label: 'Aba Insights', mockupClicks: ['Insights'], seed: {} },
  ],
  compareSelector: { mockup: '#ch-app header, #ch-app nav', impl: '[data-obs-chrome]' }, // chrome-only text comparison
}

// enabled when Task 21b's harness lands
test.describe.skip('observatório: moldura (fidelity + layout audits)', () => {
  test('runFidelity(MOLDURA)', async () => {
    const { runFidelity } = await import('./fidelity')
    runFidelity(MOLDURA)
  })
})
