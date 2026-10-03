// apps/web/e2e/tests/cms/observatorio/canais.spec.ts
// Fidelity of the Canais screen against the N-own-channels canais.html of 03/10 (its states bar: MOCK at canais.html:887-893),
// drawer included. The mockup's own channels are picked by URL (?owns=1|2), never by the "Seus canais" buttons of the
// states bar (they reload the page). Presets 5 / mix / zero do not fit the local DB (UNIQUE(site_id, locale)): Vitest only (P3).
// The "Pedido à forja" states of the channel drawer are in forja.spec.ts (CANAIS_FORJA).
// Every allowance below is one element or one text, scoped to the states it affects, with its ruling.
import { test, expect } from '@playwright/test'
import path from 'node:path'
import { runFidelity, ensureSeeded, type Allow, type MockupState, type ScreenSpec } from './fidelity'
import { CANAIS_TABLE_EXCLUDE, BALD_ROW_SUFFIX_F11, HANDLE_R61, OWN_DRAWER_R60, OWN_DRAWER_R79 } from './allowances'

/** The mockup's drawer channels: [oracle id, state-bar label]. */
const DRAWERS: Array<[string, string]> = [
  ['matt-wolfe', 'Matt Wolfe'], ['luke-damant', 'Luke Damant'], ['nomade-raiz', 'Nômade Raiz (teste A/B de thumbnail)'],
  ['vou-sem-volta', 'Vou sem volta (buscando vídeos)'], ['esq-unltd-daily', 'Esq Unltd (erro)'], ['bald-and-bankrupt', 'bald (parado)'],
]
const TABS: Array<[string, string]> = [['trocas', 'Trocas'], ['videos', 'Vídeos'], ['outliers', 'Outliers']]

/**
 * F11 / Task 23 ruling (brief test, CONVENCOES:267): the numbers of a "parado" channel (bald and bankrupt) say "até o
 * registro diário de DD/MM HH:MM"; canais.html prints that suffix only for atrasado/erro. Only in bald's drawer states.
 */
// R75: with ≤ 5 free slots an admin sees "Destravar mais N vagas" (the +25 unlock works since the F1 fix); canais.html has
// no wording for it, so the button exists on the implementation side only. Its behaviour is unit-tested (competitor-slots).
const UNLOCK_R75: Allow = { drop: /Destravar mais \d+ vagas/ }
const PARADO_SUFFIX_F11: Allow = { drop: / ?,? até o registro diário de 24\/10 12:00(?=,| |$)/ }
/**
 * The same suffix in the middle of a video's line (drawer · Vídeos: "1,5 mi views, até o registro diário de 24/10
 * 12:00, 0,7× a mediana"): cut with nothing left behind, or the drop's space would stand before the next comma.
 */
const PARADO_SUFFIX_MID_F11: Allow = { cut: /(?<= views), até o registro diário de 24\/10 12:00(?=, \d)/ }

/** The state with the preset's own channels on both sides: ownPreset in the seed, ?owns= in the mockup URL. */
const withOwns = (p: '1' | '2', s: MockupState): MockupState => ({
  ...s, label: `${s.label} · ${p === '1' ? '1 canal' : '2 canais'}`,
  seed: { ...s.seed, ownPreset: p }, mockupQuery: '?owns=' + p + (s.mockupQuery ? '&' + s.mockupQuery.replace(/^\?/, '') : ''),
})

const BASE_STATES: MockupState[] = [
  { label: '(default)', seed: {} },
  // the chrome's button with the server action held: the in-progress state
  {
    label: 'Sincronização em andamento', mockupClicks: ['Sincronização em andamento'], seed: {}, implClicks: ['Sincronizar concorrentes'], holdActions: true,
    // R45: the round counts only the channels the action syncs (11), and the rows outside it (Paddy Doyle atrasado,
    // Esq Unltd Daily erro) show their true state instead of "Na fila desta rodada": their status cells and the two
    // group flags that name them
    textAllow: [/\d+ concorrentes na rodada/, { drop: /1 com sincronização atrasada/ }, { drop: /1 com erro de sincronização/ }],
    exclude: {
      mockup: ['tr[data-id="paddy-doyle"] > td.sync', 'tr[data-id="esq-unltd-daily"] > td.sync'],
      impl: ['tr[data-id="<channel:paddy-doyle>"] > td.sync', 'tr[data-id="<channel:esq-unltd-daily>"] > td.sync'],
    },
  },
  { label: 'Sincronização concluída', seed: {}, skip: 'needs a real YouTube Data API round (syncCompetitorsNow with YOUTUBE_API_KEY and real channel ids): cannot run locally' },
  {
    label: 'Seu canal sem vídeo longo em 90 d', mockupClicks: ['tnFigueiredo sem vídeo longo em 90 d'], seed: { ownEmpty: true },
    // R67 (C13): the mockup's own-empty scenario keeps "58 vídeos acompanhados" while simulating no recent long video;
    // the seed really drops them (50) — only the own row's coverage line
    exclude: { mockup: ['tr.you > td.sync .cov'], impl: ['tr.you > td.sync .cov'] },
  },
  { label: 'Só canais com problema', mockupClicks: ['Só canais com problema'], seed: {}, query: '?filter=problemas' },
  // R63: the mockup simulates 74 and 75 channels, the oracle has 14: only the counter's numbers differ by construction
  // (the slot semantics — one free, none free — are asserted below); R64: the scroll hint
  { label: '74 de 75 canais', mockupClicks: ['74 de 75 canais'], seed: { channelLimit: 15 }, textAllow: [/\d+ de \d+ canais/, UNLOCK_R75] },
  { label: '75 de 75 canais (cheio)', mockupClicks: ['75 de 75 canais (cheio)'], seed: { channelLimit: 14 }, textAllow: [/\d+ de \d+ canais/, UNLOCK_R75] },
  {
    label: 'Adicionar canal (?add=1)', mockupClicks: ['Adicionar canal (?add=1)'], seed: {}, query: '?add=1',
    // R62: the add action syncs right away, so the dialog says the true sentence (Task 23)
    textAllow: [/Entra na próxima sincronização \(\d\d:\d\d\): busca os vídeos até o limite escolhido\.|A busca dos vídeos começa ao adicionar, até o limite escolhido; o que faltar continua na sincronização das \d\d:\d\d\./],
  },
  ...DRAWERS.flatMap(([id, label]) => TABS.map(([tab, tabLabel]) => ({
    label: `Drawer: ${label} · ${tabLabel}`, mockupClicks: [label], mockupTabClicks: [tabLabel], seed: {}, query: `?channel=<channel:${id}>&tab=${tab}`,
    exclude: HANDLE_R61, ...(id === 'bald-and-bankrupt' ? { textAllow: [PARADO_SUFFIX_MID_F11, PARADO_SUFFIX_F11] } : {}),
  }))),
  // the niche filter with two own channels, both of Viagem: in IA the group says "nenhum de IA · 2 em outro nicho (aparecem em Todos)"
  { label: 'Filtro Viagem', seed: {}, query: '?niche=viagem', mockupQuery: '?niche=viagem' },
  { label: 'Filtro IA', seed: {}, query: '?niche=ia', mockupQuery: '?niche=ia' },
  // an own channel's drawer; no HANDLE_R61 here: an own channel has a handle on both sides
  { label: 'Drawer: tnFigueiredo EN (seu canal) · Trocas', mockupClicks: ['tnFigueiredo EN (seu canal)'], seed: {}, query: '?channel=<own:tnfigueiredo-en>',
    // R60 (FU-5): only the numbers of the drawer's "Views/dia" and "Crescimento, 30 d" stats (allowances.ts)
    // R79: and the coverage line, which must not claim daily views of an own channel
    exclude: { mockup: [...OWN_DRAWER_R60.mockup, ...OWN_DRAWER_R79.mockup], impl: [...OWN_DRAWER_R60.impl, ...OWN_DRAWER_R79.impl] } },
]

export const CANAIS: ScreenSpec = {
  name: 'canais', mockupFile: 'docs/superpowers/mockups/2026-10-03-observatorio-seus-canais/canais.html', route: '/cms/youtube/competitors',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb], [data-thumb-missing]',
  compareSelector: { mockup: '#screen, #drawer, #dlgs', impl: '[data-obs-screen="canais"]' },
  // R60, R62, R64 (allowances.ts): the own rows' views/day and growth cells, the error row's handle action, the scroll hint
  exclude: CANAIS_TABLE_EXCLUDE,
  // F11 / Task 23 ruling: bald and bankrupt's views/day suffix (allowances.ts)
  textAllow: [BALD_ROW_SUFFIX_F11],
  states: [withOwns('1', BASE_STATES[0]!), ...BASE_STATES.map(st => withOwns('2', st))],
}

runFidelity(CANAIS)

// R63: the 74/75 states differ only in the counts; what a slot means must still hold on the screen
test.describe('canais · vagas (semântica dos estados 74 de 75 / 75 de 75)', () => {
  for (const [limit, free] of [[15, 1], [14, 0]] as const) test(`limite ${limit}: ${free ? 'sobra 1 vaga' : 'sem vagas'}`, async ({ browser }) => {
    test.setTimeout(180_000)
    await ensureSeeded({ channelLimit: limit })
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: path.resolve(__dirname, '../../../.auth/admin.json') })
    try {
      const p = await ctx.newPage()
      await p.goto('/cms/youtube/competitors')
      const screen = p.locator('[data-obs-screen="canais"]')
      await screen.waitFor()
      await expect(screen.locator('.quota')).toContainText(`14 de ${limit} canais`)
      // canais.html:591 (renderNiche): the limit's tooltip says what is left; with no slot the add control is off and
      // its TITLE (not a visible text) carries "Sem vagas: N de N concorrentes. Remova um canal para adicionar outro."
      const tip = screen.locator('.quota [role="tooltip"]'), off = screen.locator('.btn.primary[aria-disabled="true"]')
      if (free) {
        await expect(screen).not.toContainText('Sem vagas')
        await expect(tip).toContainText('Até 15 concorrentes acompanhados; o seu canal não ocupa vaga. Sobra 1 vaga.')
        await expect(off).toHaveCount(0)
      } else {
        await expect(tip).toContainText('Até 14 concorrentes acompanhados; o seu canal não ocupa vaga. Sem vagas: para acompanhar outro, remova um.')
        await expect(off).toHaveAttribute('title', 'Sem vagas: 14 de 14 concorrentes. Remova um canal para adicionar outro.')
      }
    } finally { await ctx.close() }
  })
  // with two own channels the same sentence is in the plural (own-channels.ts ownTexts)
  test('limite 15 com 2 canais próprios: o texto fica no plural', async ({ browser }) => {
    test.setTimeout(180_000)
    await ensureSeeded({ channelLimit: 15, ownPreset: '2' })
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: path.resolve(__dirname, '../../../.auth/admin.json') })
    try {
      const p = await ctx.newPage()
      await p.goto('/cms/youtube/competitors')
      const screen = p.locator('[data-obs-screen="canais"]')
      await screen.waitFor()
      await expect(screen.locator('.quota')).toContainText('14 de 15 canais')
      await expect(screen.locator('.quota [role="tooltip"]')).toContainText('Até 15 concorrentes acompanhados; os seus canais não ocupam vaga. Sobra 1 vaga.')
    } finally { await ctx.close() }
  })
})
