// apps/web/e2e/tests/cms/observatorio/forja.spec.ts
// Fidelity of the forja (Task 35) against the forja states of canais.html, mudancas.html, outliers.html, insights.html
// and historico-video.html. The moldura's selector drawer (moldura-forja.html FLOWS, :742) is the chrome's demo, not a
// product surface (ruling R59): it is not ported, and the per-screen request states below cover the same 9 states.
// Ruling R54: Task 35 wrote this spec skipped; Task 35b enabled it. Both viewports and both themes come from runFidelity.
// The status lines are the engine's own texts on both sides (statusLabel/statusLines/statusText): `textAllow` stays
// EMPTY for them — a mismatch there is a bug, never a "real data" difference.
import type { RequestState } from '../../../../src/lib/youtube/observatorio/types'
import { runFidelity, OUTLIERS_TARGET_EXEMPT, type Allow, type ScreenSpec } from './fidelity'
import { SEAL_R57 } from './seal'
import { CANAIS_TABLE_EXCLUDE, BALD_ROW_SUFFIX_F11, HANDLE_R61, COMPOSE_R67, LATEST_READING_R67 } from './allowances'

const DIR = 'docs/superpowers/mockups/2026-10-02-observatorio/'
/**
 * R65 / FU-8: production stores the final failure reason and the refusal reason (mapped), but not a retry's reason, the
 * refused data's date nor "busy with another request": those mockup-only sentences are dropped, nothing else.
 */
const NOT_STORED_FU8: Allow[] = [
  { drop: /O validador recusou a tentativa 1 às \d\d:\d\d porque o texto citava um número que não estava nos dados enviados\.? ?/ },
  { drop: /Outro pedido em andamento desde \d\d:\d\d\./ },
]
/** R67 allowances of the two states whose texts the mockup hand-wrote (publicado, recusado); others get none. */
const r67 = (s: RequestState): { textAllow?: Allow[] } =>
  s === 'publicado' ? { textAllow: [...COMPOSE_R67, ...LATEST_READING_R67] } : s === 'recusado (dado velho)' ? { textAllow: COMPOSE_R67 } : {}
/** The 9 request states, in the mockup's order (REQ_SCENARIOS keys; engine REQUEST_STATES). */
export const REQUEST_STATES: readonly RequestState[] = ['na fila', 'trabalhando', 'publicado', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia', 'falhou', 'recusado (dado velho)']
/** Canais: the channel drawer's forja box × the 9 request states (resumo-trocas of the open channel's niche). */
export const CANAIS_FORJA: ScreenSpec = {
  name: 'forja-canais', mockupFile: DIR + 'canais.html', route: '/cms/youtube/competitors',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb], [data-thumb-missing]',
  compareSelector: { mockup: '#screen, #drawer, #dlgs', impl: '[data-obs-screen="canais"]' },
  textAllow: [...NOT_STORED_FU8, BALD_ROW_SUFFIX_F11],
  exclude: { mockup: [...CANAIS_TABLE_EXCLUDE.mockup, ...HANDLE_R61.mockup!], impl: CANAIS_TABLE_EXCLUDE.impl },
  // the request state, then the drawer of Matt Wolfe (the mockup's forja box lives in the channel drawer; below 1280 px the
  // open drawer is modal and makes the mockup's state bar inert, so the state is picked first)
  states: REQUEST_STATES.map(s => ({ label: 'canais · ' + s, mockupClicks: [s, 'Matt Wolfe'], seed: { forjaState: s, forjaType: 'resumo-trocas' }, query: '?channel=<channel:matt-wolfe>', ...r67(s) })),
}

/** Mudanças: the forja card of the summary box × the 9 request states. */
export const MUDANCAS_FORJA: ScreenSpec = {
  name: 'forja-mudancas', mockupFile: DIR + 'mudancas.html', route: '/cms/youtube/competitors/mudancas',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb], [data-thumb-missing]',
  states: REQUEST_STATES.map(s => ({ label: 'mudanças · ' + s, mockupClicks: [s], seed: { forjaState: s, forjaType: 'resumo-trocas' }, ...r67(s),
    // R67 (C11): the new IA resumo-trocas reading also classifies two more title changes — only those two tags
    ...(s === 'publicado' ? { textAllow: [...COMPOSE_R67, { drop: /(?<=A versão anterior ficou cerca de 3 horas no ar )Reescrita \(forja\): reação no lugar do nome do produto/ }, { drop: /(?<=A versão anterior ficou cerca de 38 dias no ar )Reescrita \(forja\): passou para primeira pessoa/ }] } : {}) })),
  compareSelector: { mockup: '#screen', impl: '[data-obs-screen="mudancas"]' },
  textAllow: [...SEAL_R57, ...NOT_STORED_FU8],
}

/** Outliers: the forja bar × the 9 request states. */
export const OUTLIERS_FORJA: ScreenSpec = {
  name: 'forja-outliers', mockupFile: DIR + 'outliers.html', route: '/cms/youtube/competitors/outliers',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb], [data-thumb-missing]',
  states: REQUEST_STATES.map(s => ({ label: 'outliers · ' + s, mockupClicks: [s], seed: { forjaState: s, forjaType: 'padroes-titulo' }, ...r67(s) })),
  compareSelector: { mockup: '#screen', impl: '[data-obs-screen="outliers"]' },
  textAllow: [...SEAL_R57, ...NOT_STORED_FU8],
  targetExempt: OUTLIERS_TARGET_EXEMPT,
}

/** Insights: NONE + the 9 request states + EMPTY (insights.html:808 MOCK). */
export const INSIGHTS_FORJA: ScreenSpec = {
  name: 'forja-insights', mockupFile: DIR + 'insights.html', route: '/cms/youtube/competitors/insights',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb], [data-thumb-missing]',
  states: [
    // Todos (both screens' default): the request card lists one line per niche (CONVENCOES F7/F8)
    { label: 'insights · sem pedido hoje', mockupClicks: ['sem pedido hoje'], seed: {} },
    ...REQUEST_STATES.map(s => ({ label: 'insights · ' + s, mockupClicks: [s], seed: { forjaState: s, forjaType: 'padroes-titulo' }, ...r67(s) })),
    { label: 'insights · ainda não há leitura', mockupClicks: ['ainda não há leitura'], seed: { noReadings: true } },
  ],
  compareSelector: { mockup: '#screen', impl: '[data-obs-screen="insights"]' },
  textAllow: NOT_STORED_FU8,
}

/** Histórico: the 9 request states on the showcase video (matt-opus55, leitura-video). */
export const HISTORICO_FORJA: ScreenSpec = {
  name: 'forja-historico', mockupFile: DIR + 'historico-video.html', route: '/cms/youtube/competitors/video',
  mockThumbSelector: '.th', implThumbSelector: '[data-thumb],[data-thumb-missing]',
  states: REQUEST_STATES.map(s => ({ label: 'histórico · ' + s, mockupClicks: [s], seed: { forjaState: s, forjaType: 'leitura-video' }, query: '/<video:matt-opus55>' })),
  compareSelector: { mockup: '#screen', impl: '[data-obs-screen="historico"]' },
  textAllow: [...SEAL_R57, ...NOT_STORED_FU8],
  // R43: the per-video "Salvar no swipe file" is follow-up FU-2 (Task 26 report §5)
  mockExclude: ['#saveBtn'],
  // R64: the chart's per-day value labels follow the CMS shell's real width (only at ≥ 56 px per day)
  exclude: { mockup: ['svg text.vl'], impl: ['svg text.vl'] },
}

export const FORJA_SPECS: readonly ScreenSpec[] = [CANAIS_FORJA, MUDANCAS_FORJA, OUTLIERS_FORJA, INSIGHTS_FORJA, HISTORICO_FORJA]

for (const s of FORJA_SPECS) runFidelity(s)
