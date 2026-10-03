// apps/web/e2e/tests/cms/observatorio/canais.spec.ts
// Fidelity of the Canais screen against canais.html (its states bar: MOCK at canais.html:857-860), drawer included.
// The "Pedido à forja" states of the channel drawer are in forja.spec.ts (CANAIS_FORJA).
import { runFidelity, type ScreenSpec } from './fidelity'

/** The mockup's drawer channels: [oracle id, state-bar label]. */
const DRAWERS: Array<[string, string]> = [
  ['matt-wolfe', 'Matt Wolfe'], ['luke-damant', 'Luke Damant'], ['nomade-raiz', 'Nômade Raiz (teste A/B de thumbnail)'],
  ['vou-sem-volta', 'Vou sem volta (buscando vídeos)'], ['esq-unltd-daily', 'Esq Unltd (erro)'], ['bald-and-bankrupt', 'bald (parado)'],
]
const TABS: Array<[string, string]> = [['trocas', 'Trocas'], ['videos', 'Vídeos'], ['outliers', 'Outliers']]

export const CANAIS: ScreenSpec = {
  name: 'canais', mockupFile: 'docs/superpowers/mockups/2026-10-02-observatorio/canais.html', route: '/cms/youtube/competitors',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb], [data-thumb-missing]',
  compareSelector: { mockup: '#screen, #drawer, #dlgs', impl: '[data-obs-screen="canais"]' },
  states: [
    { label: '(default)', seed: {} },
    // the chrome's button with the server action held: the in-progress state
    // R45: the bar counts the channels the action actually syncs (sync ok: 11 in the oracle), not the mockup's count
    { label: 'Sincronização em andamento', mockupClicks: ['Sincronização em andamento'], seed: {}, implClicks: ['Sincronizar concorrentes'], holdActions: true,
      textAllow: [/\d+ concorrentes na rodada/] },
    { label: 'Seu canal sem vídeo longo em 90 d', mockupClicks: ['Seu canal sem vídeo longo em 90 d'], seed: { ownEmpty: true } },
    { label: 'Só canais com problema', mockupClicks: ['Só canais com problema'], seed: {}, query: '?filter=problemas' },
    // the mockup SIMULATES 74 and 75 channels; the oracle has 14, so the closest real states are 14 of 15 (one slot
    // free) and 14 of 14 (full). The counts differ by construction and are NOT masked (no ruling covers them).
    { label: '74 de 75 canais', mockupClicks: ['74 de 75 canais'], seed: { channelLimit: 15 } },
    { label: '75 de 75 canais (cheio)', mockupClicks: ['75 de 75 canais (cheio)'], seed: { channelLimit: 14 } },
    // "Sincronização concluída" needs the real YouTube Data API round (syncCompetitorsNow); it cannot run locally
    { label: 'Adicionar canal (?add=1)', mockupClicks: ['Adicionar canal (?add=1)'], seed: {}, query: '?add=1' },
    ...DRAWERS.flatMap(([id, label]) => TABS.map(([tab, tabLabel]) => ({
      label: `Drawer: ${label} · ${tabLabel}`, mockupClicks: [label], mockupTabClicks: [tabLabel], seed: {}, query: `?channel=<channel:${id}>&tab=${tab}`,
    }))),
  ],
}

runFidelity(CANAIS)
