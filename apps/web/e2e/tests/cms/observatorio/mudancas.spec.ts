// apps/web/e2e/tests/cms/observatorio/mudancas.spec.ts
// Fidelity of the Mudanças screen against mudancas.html (its "Dados" states, mudancas.html:431 and :938-939).
// The "Pedido à forja" states are in forja.spec.ts.
import { runFidelity, type ScreenSpec } from './fidelity'
import { F4_MUDANCAS_EXCLUDE_IMPL } from './allowances'

export const MUDANCAS: ScreenSpec = {
  name: 'mudancas', mockupFile: 'docs/superpowers/mockups/2026-10-02-observatorio/mudancas.html', route: '/cms/youtube/competitors/mudancas',
  // the mockup draws placeholder thumbnails; production shows the archived blob or says it has none
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb], [data-thumb-missing]',
  states: [
    { label: 'Dados: Padrão', mockupClicks: ['Padrão'], seed: {} },
    // the mockup's filters for this state (mudancas.html:938): IA, 7 d, Descrição, só com efeito medido, Longos
    { label: 'Vazio com sugestão', mockupClicks: ['Vazio com sugestão'], seed: {}, query: '?niche=ia&win=7&type=desc&measured=1&fmt=long' },
    // mudancas.html:939: Viagem, 90 d, Thumbnail, Shorts
    { label: 'Vazio em 90 dias', mockupClicks: ['Vazio em 90 dias'], seed: {}, query: '?niche=viagem&win=90&type=thumb&fmt=short' },
  ],
  // R118: pinning is of the 2026-10-06-historico-fixar-video mockup (the one that rules for it): the card's pin button,
  // its focus hint, the chips line and the action's message do not exist in mudancas.html
  exclude: { impl: ['[data-pin]', '.fx-hint', '.fx-chips', '.fx-chip', '.fx-row', '.fx-out-note', ...F4_MUDANCAS_EXCLUDE_IMPL] },
  compareSelector: { mockup: '#screen', impl: '[data-obs-screen="mudancas"]' },
}

runFidelity(MUDANCAS)
