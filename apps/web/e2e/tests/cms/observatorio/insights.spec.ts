// apps/web/e2e/tests/cms/observatorio/insights.spec.ts
// Fidelity of the Insights screen against insights.html (states at insights.html:808-815: NONE, the 9 request states, EMPTY).
// Ruling R35: enabled when Task 21b's harness lands (seed + ./fidelity with compareSelector in ScreenSpec).
// Then replace the skipped describe below by a top-level `runFidelity(INSIGHTS)` and import it statically:
//   import { runFidelity } from './fidelity'
// The 9 "Pedido à forja" request states, the frozen-reading hero and the forja button come with Task 35.
import { test } from '@playwright/test'

export const INSIGHTS = {
  name: 'insights', mockupFile: 'docs/superpowers/mockups/2026-10-02-observatorio/insights.html', route: '/cms/youtube/competitors/insights',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: [
    // NONE: the mockup shows the latest reading in the hero and in Fórmulas ("Na leitura"); P3 has no hero yet, so the
    // hero block and the reading-only Fórmulas texts are removed from the comparison until Task 35 adds them.
    { label: 'NONE (sem pedido hoje)', mockupClicks: ['sem pedido hoje'], seed: {}, query: '?niche=viagem',
      textAllow: ['#forjaCard', '#formCard .chead .meta', '#formCard .fsent', '#formCard .frow > div:nth-child(3)', '#formCard .foot'] },
    // EMPTY: no videos in 90 d.
    { label: 'EMPTY (ainda não há leitura)', mockupClicks: ['ainda não há leitura'], seed: { scenario: 'empty' }, query: '?niche=viagem',
      textAllow: ['#forjaCard'] },
  ],
  compareSelector: { mockup: '#screen', impl: '[data-obs-screen="insights"]' },
}

// enabled when Task 21b's harness lands
test.describe.skip('observatório: insights (fidelity + layout audits)', () => {
  test('runFidelity(INSIGHTS)', async () => {
    const { runFidelity } = await import('./fidelity')
    runFidelity(INSIGHTS)
  })
})
