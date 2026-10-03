// apps/web/e2e/tests/cms/observatorio/historico.spec.ts
// Fidelity of the per-video history against historico-video.html: the 9 demo videos of the mockup state bar
// (historico-video.html:1015-1021, 1051-1054) × 2 viewports × 2 themes, run by the harness.
// Ruling R35: enabled when Task 21b's harness lands (seed + ./fidelity with compareSelector in ScreenSpec).
// Then replace the skipped describe below by a top-level `runFidelity(HISTORICO)` and import it statically:
//   import { runFidelity } from './fidelity'
// Each state opens /video/<seeded uuid of PICK[k]>: `videoOf(oracleId)` is the seed's oracle-id → uuid map.
import { test } from '@playwright/test'

/** The mockup's pickStates() over the oracle (dados.js), one video per edge case. */
export const PICK = {
  full: 'matt-opus55', pre: 'nate-ai-agent-business', few: 'matt-fast-cheap', none: 'matt-gpt6-astra', noreg: 'paddy-doyle-l0',
  untr: 'luke-damant-l71', old: 'preguica-hailuo', err: 'esq-lawsuit', bf: 'vou-sem-volta-s0',
} as const
/** The mockup state-bar labels (STATE_LABEL, historico-video.html:427). */
const LABEL: Record<keyof typeof PICK, string> = {
  full: 'Vitrine com trocas medidas', pre: 'Histórico anterior a 03/10', few: 'Registros diários insuficientes', none: 'Vídeo sem trocas',
  noreg: 'Sem registro diário (canal atrasado)', untr: 'Fora dos acompanhados', old: 'Antigo sem trocas', err: 'Canal com erro de sincronização',
  bf: 'Canal ainda buscando vídeos',
}

export const HISTORICO = {
  name: 'historico', mockupFile: 'docs/superpowers/mockups/2026-10-02-observatorio/historico-video.html', route: '/cms/youtube/competitors/video',
  mockThumbSelector: '.th', implThumbSelector: '[data-thumb],[data-thumb-missing]',
  states: (Object.keys(PICK) as Array<keyof typeof PICK>).map(k => ({
    label: LABEL[k], mockupClicks: [LABEL[k]], seed: {},
    query: (videoOf: (oracleId: string) => string) => '/' + videoOf(PICK[k]),
  })),
  // screen-only text comparison (the chrome has its own spec); the forja block is Task 35
  compareSelector: { mockup: '#screen .page > :not(#forja)', impl: '[data-obs-screen="historico"] .page' },
}

// enabled when Task 21b's harness lands
test.describe.skip('observatório: histórico do vídeo (fidelity + layout audits)', () => {
  test('runFidelity(HISTORICO)', async () => {
    const { runFidelity } = await import('./fidelity')
    runFidelity(HISTORICO)
  })
})
