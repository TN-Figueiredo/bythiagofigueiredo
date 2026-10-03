// apps/web/e2e/tests/cms/observatorio/historico.spec.ts
// Fidelity of the per-video history against historico-video.html: the 9 demo videos of the mockup state bar
// (historico-video.html:1015-1021, 1051-1054) × 2 viewports × 2 themes. The "Pedido à forja" states are in forja.spec.ts.
import { runFidelity, type ScreenSpec } from './fidelity'
import { SEAL_R57 } from './seal'

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


export const HISTORICO: ScreenSpec = {
  name: 'historico', mockupFile: 'docs/superpowers/mockups/2026-10-02-observatorio/historico-video.html', route: '/cms/youtube/competitors/video',
  mockThumbSelector: '.th', implThumbSelector: '[data-thumb],[data-thumb-missing]',
  states: (Object.keys(PICK) as Array<keyof typeof PICK>).map(k => ({ label: LABEL[k], mockupClicks: [LABEL[k]], seed: {}, query: '/<video:' + PICK[k] + '>',
    // R64: the CMS shell is narrower than the mockup's chrome; the chart's per-day value labels follow the real width
    // (historico-video.html: only at ≥ 56 px per day) — the value labels of the views chart only
    ...(k === 'full' ? { exclude: { mockup: ['svg text.vl'], impl: ['svg text.vl'] } } : {}) })),
  textAllow: SEAL_R57,
  // R43: the per-video "Salvar no swipe file" is follow-up FU-2 (Task 26 report §5: the header has only "Abrir no YouTube")
  mockExclude: ['#saveBtn'],
  compareSelector: { mockup: '#screen', impl: '[data-obs-screen="historico"]' },
}

runFidelity(HISTORICO)
