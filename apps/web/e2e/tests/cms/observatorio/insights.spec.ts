// apps/web/e2e/tests/cms/observatorio/insights.spec.ts
// Fidelity of the Insights screen against insights-n-canais.html (03/10, N own channels): NONE ("sem pedido hoje") and
// EMPTY ("ainda não há leitura") (its MOCK bar), under Todos and inside each niche, with 1 and with 2 own channels.
// The mockup's own channels come from the URL (?owns=1|2); mockup.js opens Insights in Viagem on a first visit, so the
// Todos states pass ?niche=todos. The 9 request states are in forja.spec.ts.
// Every allowance is one element or one text, scoped to the states it affects, with its ruling.
import { runFidelity, type Allow, type Exclude, type MockupState, type ScreenSpec } from './fidelity'

/**
 * R60 (FU-5): an own channel has no daily views in production, so its "Views/dia por mil inscritos" (2nd cell) and
 * "Vídeos com 2× ou mais" (3rd cell) say "sem dado · base fraca" — only those two cells of each own row.
 */
const OWN_CELLS_R60 = ['#youCard tr[data-own] > td:nth-of-type(2)', '#youCard tr[data-own] > td:nth-of-type(3)']
/** R64: the CMS shell is narrower; at 768 the cadence lane's sync hatch fits no "⚠" (insights.html fitIdle). */
const HATCH_R64 = ['#cadCard .lane .idle.sync > span']
/** R64: the "Você no nicho" sideways-scroll hint follows the shell's real width (the product renders it only on overflow). */
const YOU_HINT_R64: Exclude = { mockup: ['#youHint'], impl: ['[data-you-hint]'] }
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
/** FU-16 (decisão P1): Lacunas sai sem "Criar ideia" — a frase do rodapé que só existe com o botão. */
const IDEA_FOOT_FU16: Allow = { drop: /A ideia é sempre criada para um canal que ainda não cobre o tema\. ?/ }
const both = (...xs: string[][]): Exclude => ({ mockup: xs.flat(), impl: xs.flat() })
const merge = (...xs: Exclude[]): Exclude => ({ mockup: xs.flatMap(x => x.mockup ?? []), impl: xs.flatMap(x => x.impl ?? []) })
const owns = (p: '1' | '2') => (p === '1' ? '1 canal' : '2 canais')

const nicheState = (n: 'viagem' | 'ia', empty: boolean, p: '1' | '2'): MockupState => ({
  label: (empty ? 'EMPTY · ' : 'NONE · ') + n + ' · ' + owns(p), mockupClicks: [empty ? 'ainda não há leitura' : 'sem pedido hoje'],
  seed: { ...(empty ? { noReadings: true } : {}), ownPreset: p }, query: '?niche=' + n, mockupQuery: '?niche=' + n + '&owns=' + p,
  textAllow: empty ? [NO_THEME_SEAL_R49, IDEA_FOOT_FU16] : [...THEME_SOURCE_R49, IDEA_FOOT_FU16],
  exclude: merge(both(OWN_CELLS_R60, HATCH_R64, empty ? NO_THEMES_R49 : []), YOU_HINT_R64),
})
/** P3 (FU-17): the presets whose own channels repeat a locale cannot be seeded. */
const NO_ROOM = 'youtube_channels tem UNIQUE(site_id, locale): 5, mix e zero não cabem no banco até o plano multi-canal; cobertos em Vitest (insights-view-model, canais-view-model)'

export const INSIGHTS: ScreenSpec = {
  name: 'insights', mockupFile: 'docs/superpowers/mockups/2026-10-03-observatorio-seus-canais/insights-n-canais.html', route: '/cms/youtube/competitors/insights',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: [
    // Todos: the screen only asks to pick a niche (no own-channel card)
    { label: 'NONE (sem pedido hoje)', mockupClicks: ['sem pedido hoje'], seed: { ownPreset: '2' }, mockupQuery: '?niche=todos&owns=2' },
    { label: 'EMPTY (ainda não há leitura)', mockupClicks: ['ainda não há leitura'], seed: { noReadings: true, ownPreset: '2' }, mockupQuery: '?niche=todos&owns=2' },
    // the same two states inside a niche, with one and with two own channels (both of Viagem: in IA "Nenhum canal seu está em IA")
    ...(['viagem', 'ia'] as const).flatMap(n => [false, true].flatMap(empty => (['1', '2'] as const).map(p => nicheState(n, empty, p)))),
    { label: '5 canais', seed: { ownPreset: '5' }, skip: NO_ROOM },
    { label: 'mix', seed: { ownPreset: 'mix' }, skip: NO_ROOM },
    { label: 'zero', seed: { ownPreset: 'zero' }, skip: NO_ROOM },
  ],
  compareSelector: { mockup: '#screen', impl: '[data-obs-screen="insights"]' },
  // FU-16 (decisão P1, requisito 7): "Criar ideia" fica para depois — the Lacunas buttons, their menu and the "ideia criada" mark
  mockExclude: ['[data-idea]', '[data-idea-menu]', '#gapCard .made', '#ideaMenu'],
  // insights.html itself draws both below 32 px, and the screen copies it (measured on the mockup: 16×16 and 73×15):
  //  - the evidence marks "1" "2" "3" (insights.html:96-98 `.prose sup a`; its ::after, inset −10 px, is the 36 px hit area);
  //  - the inline "ver detalhes" of a "Desde então" line (insights.html:42 `.since summary`, display:inline).
  //  - R68: the channel name in "Você no nicho" is a running-text link in insights-n-canais.html (`.yt .nm a`), measured on
  //    the mockup at 1440 and at 768: 84×19 ("tnFigueiredo") and 107×19 ("tnFigueiredo EN"); the screen draws the same sizes.
  //    The notes' links (`.ynote a`) are NOT exempt: no state that fits the local DB prints a note, so nothing was measured.
  targetExempt: ['.prose sup a', '.since summary', '#youCard .yt .nm a'],
}

runFidelity(INSIGHTS)
