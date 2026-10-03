// apps/web/e2e/tests/cms/observatorio/mudancas.spec.ts
// Fidelity of the Mudanças screen against mudancas.html (states at mudancas.html:429-432).
// Ruling R35: enabled when Task 21b's harness lands (seed + ./fidelity with compareSelector in ScreenSpec).
// Then replace the skipped describe below by a top-level `runFidelity(MUDANCAS)` and import it statically:
//   import { runFidelity } from './fidelity'
// "Pedido à forja (*)" states come with Task 35.
import { test } from '@playwright/test'

export const MUDANCAS = {
  name: 'mudancas', mockupFile: 'docs/superpowers/mockups/2026-10-02-observatorio/mudancas.html', route: '/cms/youtube/competitors/mudancas',
  // the mockup draws placeholder thumbnails; production shows the archived blob or says it has none
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb], [data-thumb-missing]',
  states: [
    { label: 'Dados: Padrão', mockupClicks: ['Padrão'], seed: {} },
    { label: 'Vazio com sugestão', mockupClicks: ['Vazio com sugestão'], seed: {}, query: '?q=zzzz' },
    { label: 'Vazio em 90 dias', mockupClicks: ['Vazio em 90 dias'], seed: { emptyWindow: true } },
  ],
  compareSelector: { mockup: '#screen', impl: '[data-obs-screen="mudancas"]' },
}

// enabled when Task 21b's harness lands
test.describe.skip('observatório: mudanças (fidelity + layout audits)', () => {
  test('runFidelity(MUDANCAS)', async () => {
    const { runFidelity } = await import('./fidelity')
    runFidelity(MUDANCAS)
  })
})
