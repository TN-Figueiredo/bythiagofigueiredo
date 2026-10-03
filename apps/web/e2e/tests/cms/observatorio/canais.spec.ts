// apps/web/e2e/tests/cms/observatorio/canais.spec.ts
// Fidelity of the Canais screen against canais.html (its states bar: MOCK at canais.html:857-860).
// Ruling R35: enabled when Task 21b's harness lands (seed + ./fidelity with compareSelector in ScreenSpec).
// Then replace the skipped describe below by a top-level `runFidelity(CANAIS)` and import it statically:
//   import { runFidelity } from './fidelity'
import { test } from '@playwright/test'

/** Seeded ids of the mockup's drawer channels (the seed keeps the mockup ids as channel names → uuid lookup). */
const DRAWERS: Array<[string, string]> = [
  ['matt-wolfe', 'Matt Wolfe'], ['luke-damant', 'Luke Damant'], ['nomade-raiz', 'Nômade Raiz (teste A/B de thumbnail)'],
  ['vou-sem-volta', 'Vou sem volta (buscando vídeos)'], ['esq-unltd-daily', 'Esq Unltd (erro)'], ['bald-and-bankrupt', 'bald (parado)'],
]
const TABS: Array<[string, string]> = [['trocas', 'Trocas'], ['videos', 'Vídeos'], ['outliers', 'Outliers']]

export const CANAIS = {
  name: 'canais', mockupFile: 'docs/superpowers/mockups/2026-10-02-observatorio/canais.html', route: '/cms/youtube/competitors',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  compareSelector: { mockup: '#screen, #drawer, #dlgs', impl: '[data-obs-screen="canais"]' },
  states: [
    { label: '(default)', seed: {} },
    // the chrome's button; the harness intercepts the server action so it stays pending, then lets it resolve
    { label: 'Sincronização em andamento', mockupClicks: ['Sincronização em andamento'], seed: {}, implClicks: ['Sincronizar concorrentes'], holdAction: 'syncCompetitorsNow' },
    { label: 'Sincronização concluída', mockupClicks: ['Sincronização concluída'], seed: {}, implClicks: ['Sincronizar concorrentes'] },
    { label: 'Seu canal sem vídeo longo em 90 d', mockupClicks: ['Seu canal sem vídeo longo em 90 d'], seed: { ownEmpty: true } },
    { label: 'Só canais com problema', mockupClicks: ['Só canais com problema'], seed: {}, query: '?filter=problemas' },
    // real counts: "14 de 15 canais" / "14 de 14 canais"; textAllow covers the numbers
    { label: '74 de 75 canais', mockupClicks: ['74 de 75 canais'], seed: { channelLimit: 15 }, textAllow: [/\d+ de \d+ canais/, /Sobra(m)? \d+ vagas?/] },
    { label: '75 de 75 canais (cheio)', mockupClicks: ['75 de 75 canais (cheio)'], seed: { channelLimit: 14 }, textAllow: [/\d+ de \d+ canais/, /\d+ de \d+ concorrentes/] },
    { label: 'Adicionar canal (?add=1)', mockupClicks: ['Adicionar canal (?add=1)'], seed: {}, query: '?add=1' },
    ...DRAWERS.flatMap(([id, label]) => TABS.map(([tab, tabLabel]) => ({
      label: `Drawer: ${label} · ${tabLabel}`, mockupClicks: [label, tabLabel], seed: {}, query: `?channel=<seeded:${id}>&tab=${tab}`,
    }))),
    // 'Pedido à forja no drawer' states: Task 35
  ],
}

// enabled when Task 21b's harness lands
test.describe.skip('observatório: canais (fidelity + layout audits)', () => {
  test('runFidelity(CANAIS)', async () => {
    const { runFidelity } = await import('./fidelity')
    runFidelity(CANAIS)
  })
})
