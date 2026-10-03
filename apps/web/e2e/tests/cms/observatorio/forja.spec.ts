// apps/web/e2e/tests/cms/observatorio/forja.spec.ts
// Fidelity of the forja (Task 35) against the forja states of canais.html, mudancas.html, outliers.html, insights.html
// and historico-video.html. The moldura's selector drawer (moldura-forja.html FLOWS, :742) is the chrome's demo, not a
// product surface (ruling R59): it is not ported, and the per-screen request states below cover the same 9 states.
// Ruling R54: Task 35 writes this spec SKIPPED; Task 35b enables it (with every other fidelity spec), adds the
// data-obs-* hooks it needs and runs it. Both viewports and both themes come from runFidelity.
// The status lines are the engine's own texts on both sides (statusLabel/statusLines/statusText): `textAllow` stays
// EMPTY for them — a mismatch there is a bug, never a "real data" difference.
import { test } from '@playwright/test'
import type { RequestState } from '../../../../src/lib/youtube/observatorio/types'
import type { ScreenSpec } from './fidelity'

const DIR = 'docs/superpowers/mockups/2026-10-02-observatorio/'
/** The 9 request states, in the mockup's order (REQ_SCENARIOS keys; engine REQUEST_STATES). */
export const REQUEST_STATES: readonly RequestState[] = ['na fila', 'trabalhando', 'publicado', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia', 'falhou', 'recusado (dado velho)']
/** Canais: the channel drawer's forja box × the 9 request states (resumo-trocas of the open channel's niche). */
export const CANAIS_FORJA: ScreenSpec = {
  name: 'forja-canais', mockupFile: DIR + 'canais.html', route: '/cms/youtube/competitors',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: REQUEST_STATES.map(s => ({ label: 'canais · ' + s, mockupClicks: [s], seed: { forjaState: s, forjaType: 'resumo-trocas' }, query: '?channel=matt-wolfe' })),
}

/** Mudanças: the forja card of the summary box × the 9 request states. */
export const MUDANCAS_FORJA: ScreenSpec = {
  name: 'forja-mudancas', mockupFile: DIR + 'mudancas.html', route: '/cms/youtube/competitors/mudancas',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: REQUEST_STATES.map(s => ({ label: 'mudanças · ' + s, mockupClicks: [s], seed: { forjaState: s, forjaType: 'resumo-trocas' } })),
}

/** Outliers: the forja bar × the 9 request states. */
export const OUTLIERS_FORJA: ScreenSpec = {
  name: 'forja-outliers', mockupFile: DIR + 'outliers.html', route: '/cms/youtube/competitors/outliers',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: REQUEST_STATES.map(s => ({ label: 'outliers · ' + s, mockupClicks: [s], seed: { forjaState: s, forjaType: 'padroes-titulo' } })),
}

/** Insights: NONE + the 9 request states + EMPTY (insights.html:808 MOCK). */
export const INSIGHTS_FORJA: ScreenSpec = {
  name: 'forja-insights', mockupFile: DIR + 'insights.html', route: '/cms/youtube/competitors/insights',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: [
    { label: 'insights · sem pedido hoje', mockupClicks: ['sem pedido hoje'], seed: {}, query: '?niche=viagem' },
    ...REQUEST_STATES.map(s => ({ label: 'insights · ' + s, mockupClicks: [s], seed: { forjaState: s, forjaType: 'padroes-titulo' }, query: '?niche=viagem' })),
    // EMPTY needs a seed without frozen readings: observatorio-seed.ts has no such option yet (its `scenario` only
    // knows 'own-empty') — Task 35b adds it (e.g. `noReadings: true`) when it enables this spec.
    { label: 'insights · ainda não há leitura', mockupClicks: ['ainda não há leitura'], seed: {}, query: '?niche=viagem' },
  ],
  compareSelector: '[data-obs-screen="insights"]',
}

/** Histórico: the 9 request states on the showcase video (matt-opus55, leitura-video). */
export const HISTORICO_FORJA: ScreenSpec = {
  name: 'forja-historico', mockupFile: DIR + 'historico-video.html', route: '/cms/youtube/competitors/video/matt-opus55',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: REQUEST_STATES.map(s => ({ label: 'histórico · ' + s, mockupClicks: [s], seed: { forjaState: s, forjaType: 'leitura-video' } })),
}

export const FORJA_SPECS: readonly ScreenSpec[] = [CANAIS_FORJA, MUDANCAS_FORJA, OUTLIERS_FORJA, INSIGHTS_FORJA, HISTORICO_FORJA]

// R54: enabled by Task 35b (with every fidelity spec). Then replace this skipped describe by top-level
// `for (const s of FORJA_SPECS) runFidelity(s)` with a static `import { runFidelity } from './fidelity'`.
test.describe.skip('observatório: forja (fidelity + layout audits)', () => {
  test('runFidelity(each forja spec)', async () => {
    const { runFidelity } = await import('./fidelity')
    for (const s of FORJA_SPECS) runFidelity(s)
  })
})
