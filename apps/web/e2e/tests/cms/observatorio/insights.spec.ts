// apps/web/e2e/tests/cms/observatorio/insights.spec.ts
// Fidelity of the Insights screen against insights.html: NONE ("sem pedido hoje") and EMPTY ("ainda não há leitura")
// (insights.html:808 MOCK), under Todos and inside each niche. The 9 request states are in forja.spec.ts.
// Every allowance is one element or one text, scoped to the states it affects, with its ruling.
import { runFidelity, type Allow, type Exclude, type MockupState, type ScreenSpec } from './fidelity'

/** R60 (FU-5): no daily views of the own channel → no "views/dia por mil inscritos" row and another own 2× share. */
const OWN_METRICS_R60 = ['#youCard [data-you="perMilSubs"]', '#youCard [data-you="pctOutliers"] .you-top .val']
/** R64: the CMS shell is narrower; at 768 the cadence lane's sync hatch fits no "⚠" (insights.html fitIdle). */
const HATCH_R64 = ['#cadCard .lane .idle.sync > span']
/** R49 extended (C9): production names the themes from the temas reading, not a nightly labelling — seal time and foot. */
const THEME_SOURCE_R49: Allow[] = [
  /(?<=dias vs os 90 anteriores )forja · Gemma 12B · gerada \d\d\/\d\d \d\d:\d\d \(SP\)/,
  /A forja dá nome aos grupos toda madrugada;|Os nomes dos grupos vêm da leitura de temas da forja de \d\d\/\d\d \d\d:\d\d \(SP\);/,
]
/** R49 extended (C10): with no reading there are no themes in production — the Temas and Lacunas card bodies. */
const NO_THEMES_R49 = ['#themeCard > :not(.chead)', '#gapCard > :not(.chead)']
/**
 * R49 extended (C9 + C10): the Temas seal is the temas reading's (C9); with no reading there is none to print (C10),
 * while the mockup's EMPTY state keeps its nightly-labelling seal in the card head — only that seal, by its meta.
 */
const NO_THEME_SEAL_R49: Allow = { drop: /(?<=dias vs os 90 anteriores )forja · Gemma 12B · gerada \d\d\/\d\d \d\d:\d\d \(SP\)/ }
/** R66 (FU-7): the own channel has no niche in production, so in IA it is compared — "Você no nicho" and Lacunas bodies. */
const OWN_NICHE_R66 = ['#youCard > :not(.chead)', '#gapCard > :not(.chead)']
const both = (...xs: string[][]): Exclude => ({ mockup: xs.flat(), impl: xs.flat() })

const nicheState = (n: 'viagem' | 'ia', empty: boolean): MockupState => ({
  label: (empty ? 'EMPTY · ' : 'NONE · ') + n, mockupClicks: [empty ? 'ainda não há leitura' : 'sem pedido hoje'],
  seed: empty ? { noReadings: true } : {}, query: '?niche=' + n, mockupQuery: '?niche=' + n,
  textAllow: empty ? [NO_THEME_SEAL_R49] : THEME_SOURCE_R49,
  exclude: both(OWN_METRICS_R60, HATCH_R64, empty ? NO_THEMES_R49 : [], n === 'ia' ? OWN_NICHE_R66 : []),
})

export const INSIGHTS: ScreenSpec = {
  name: 'insights', mockupFile: 'docs/superpowers/mockups/2026-10-02-observatorio/insights.html', route: '/cms/youtube/competitors/insights',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: [
    { label: 'NONE (sem pedido hoje)', mockupClicks: ['sem pedido hoje'], seed: {} },
    { label: 'EMPTY (ainda não há leitura)', mockupClicks: ['ainda não há leitura'], seed: { noReadings: true } },
    // the same two states inside a niche (with Todos the screen only asks to pick one): ?niche= on both sides
    nicheState('viagem', false), nicheState('viagem', true), nicheState('ia', false), nicheState('ia', true),
  ],
  compareSelector: { mockup: '#screen', impl: '[data-obs-screen="insights"]' },
  // spec §6 (Fora de escopo): "Criar ideia no pipeline" fica para depois (o endpoint não existe) — the Lacunas button
  mockExclude: ['[data-idea]'],
  // insights.html itself draws both below 32 px, and the screen copies it (measured on the mockup: 16×16 and 73×15):
  //  - the evidence marks "1" "2" "3" (insights.html:96-98 `.prose sup a`; its ::after, inset −10 px, is the 36 px hit area);
  //  - the inline "ver detalhes" of a "Desde então" line (insights.html:42 `.since summary`, display:inline).
  targetExempt: ['.prose sup a', '.since summary'],
}

runFidelity(INSIGHTS)
