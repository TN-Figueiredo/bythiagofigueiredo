// apps/web/e2e/tests/cms/observatorio/nichos.spec.ts
// Nicho como dado (multi-canal): the Observatório with niches the owner created.
//  1. Fidelity against the mockups approved on 04/10 (docs/superpowers/mockups/2026-10-04-multi-canal/observatorio-n-nichos,
//     ?nichos=3|4|6): the chrome's niche bar, the Canais screen and Insights inside a created niche. The seed reproduces
//     n-nichos.js (NICHE_PRESETS): Jogos takes two competitors of IA, Culinária one of Viagem, Pessoal and Finanças are empty.
//  2. Behaviour of one created niche (Jogos, one competitor), at 1440 and 768, light and dark: not a fidelity comparison.
// Every allowance is one element or one text, scoped to the states it affects, with its ruling.
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { runFidelity, ensureSeeded, VIEWPORTS, THEMES, type Allow, type Exclude, type MockupState, type ScreenSpec } from './fidelity'
import { CANAIS_TABLE_EXCLUDE, BALD_ROW_SUFFIX_F11, ADD_SENTENCE_R62 } from './allowances'
import { NICHE_PRESETS, resetViewerPrefs } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

const MOCK_DIR = 'docs/superpowers/mockups/2026-10-04-multi-canal/observatorio-n-nichos/'
type N = '3' | '4' | '6'
const seedOf = (n: N) => ({ ownPreset: '2' as const, extraNiches: NICHE_PRESETS[n] })
const mq = (n: N, rest = '') => `?nichos=${n}&owns=2${rest}`

/**
 * R85: a niche without competitors has nothing to ask the forja, on EVERY tab — the header button is off and says why.
 * The mockup carries the reason only in the button's `title`; the product repeats it in a visually hidden description
 * (#obs-ch-forja-why, class obs-ch-sr, tied by aria-describedby) so it is not mouse-only. Nothing visible differs:
 * only that hidden element is left out, only in the states of a niche without competitors.
 */
const WHY_R85: Exclude = { impl: ['#obs-ch-forja-why'] }
/**
 * R85, Canais tab: canais.html (04/10) does not model the empty niche in its header (only its Insights does, compared
 * below with the label as is): there the button stays "Pedir nova leitura à forja", enabled. Only the button's label.
 */
const LABEL_R85: Allow = /Pedir (?:nova )?leitura à forja/

/* ------------------------------------------------------------------ 1a. the chrome: niche bar with 3, 4 and 6 niches */
export const MOLDURA_N: ScreenSpec = {
  name: 'nichos-moldura', mockupFile: MOCK_DIR + 'canais.html', route: '/cms/youtube/competitors',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: [
    { label: '3 nichos · Todos', seed: seedOf('3'), mockupQuery: mq('3') },
    { label: '4 nichos · Todos', seed: seedOf('4'), mockupQuery: mq('4') },
    { label: '4 nichos · Pessoal', seed: seedOf('4'), query: '?niche=pessoal', mockupQuery: mq('4', '&niche=pessoal'), textAllow: [LABEL_R85], exclude: WHY_R85 },
    { label: '6 nichos · Todos', seed: seedOf('6'), mockupQuery: mq('6') },
    // the last niche: at 768 the rail has to scroll to bring it into view
    { label: '6 nichos · Finanças', seed: seedOf('6'), query: '?niche=financas', mockupQuery: mq('6', '&niche=financas'), textAllow: [LABEL_R85], exclude: WHY_R85 },
  ],
  compareSelector: { mockup: '#ch-head, #ch-nav', impl: '[data-obs-chrome]' },
  auditRoot: '[data-obs-screen]',
}
runFidelity(MOLDURA_N)

/** The chrome over Insights, where the mockup itself turns the forja button off in a niche without competitors: the label is compared as is. */
export const MOLDURA_INSIGHTS_N: ScreenSpec = {
  name: 'nichos-moldura-insights', mockupFile: MOCK_DIR + 'insights-n-canais.html', route: '/cms/youtube/competitors/insights',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: [
    { label: '4 nichos · Jogos', seed: seedOf('4'), query: '?niche=jogos', mockupQuery: mq('4', '&niche=jogos') },
    { label: '4 nichos · Pessoal', seed: seedOf('4'), query: '?niche=pessoal', mockupQuery: mq('4', '&niche=pessoal'), exclude: WHY_R85 },
  ],
  compareSelector: { mockup: '#ch-head, #ch-nav', impl: '[data-obs-chrome]' },
  auditRoot: '[data-obs-screen]',
  targetExempt: ['.prose sup a', '.since summary', '#youCard .yt .nm a'],
}
runFidelity(MOLDURA_INSIGHTS_N)

/* ------------------------------------------------------------------ 1b. Canais */
const CANAIS_STATES: MockupState[] = [
  { label: '3 nichos · Todos', seed: seedOf('3'), mockupQuery: mq('3') },
  { label: '3 nichos · Jogos', seed: seedOf('3'), query: '?niche=jogos', mockupQuery: mq('3', '&niche=jogos') },
  // up to 3 niches the add dialog offers buttons; from 4 on, a select (LEIAME 04/10, decisão 12). R62: its sync sentence (allowances.ts)
  { label: '3 nichos · Adicionar canal', seed: seedOf('3'), query: '?add=1', mockupQuery: mq('3'), mockupClicks: ['Adicionar canal (?add=1)'], textAllow: [ADD_SENTENCE_R62] },
  { label: '4 nichos · Todos', seed: seedOf('4'), mockupQuery: mq('4') },
  // a niche just created: no channel at all
  { label: '4 nichos · Pessoal', seed: seedOf('4'), query: '?niche=pessoal', mockupQuery: mq('4', '&niche=pessoal') },
  { label: '4 nichos · Adicionar canal', seed: seedOf('4'), query: '?add=1', mockupQuery: mq('4'), mockupClicks: ['Adicionar canal (?add=1)'], textAllow: [ADD_SENTENCE_R62] },
  { label: '6 nichos · Todos', seed: seedOf('6'), mockupQuery: mq('6') },
  { label: '6 nichos · Culinária', seed: seedOf('6'), query: '?niche=culinaria', mockupQuery: mq('6', '&niche=culinaria') },
]
export const CANAIS_N: ScreenSpec = {
  name: 'nichos-canais', mockupFile: MOCK_DIR + 'canais.html', route: '/cms/youtube/competitors',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb], [data-thumb-missing]',
  compareSelector: { mockup: '#screen, #drawer, #dlgs', impl: '[data-obs-screen="canais"]' },
  // the same rulings as canais.spec.ts, for the same elements: R60, R62, R64 (allowances.ts)
  exclude: CANAIS_TABLE_EXCLUDE,
  // F11 / Task 23 ruling: bald and bankrupt's views/day suffix (allowances.ts)
  textAllow: [BALD_ROW_SUFFIX_F11],
  states: CANAIS_STATES,
}
runFidelity(CANAIS_N)

/* ------------------------------------------------------------------ 1c. Insights */
export const INSIGHTS_N: ScreenSpec = {
  name: 'nichos-insights', mockupFile: MOCK_DIR + 'insights-n-canais.html', route: '/cms/youtube/competitors/insights',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: [
    // Todos with created niches: "Misturar nichos…" and one shortcut per niche
    { label: '4 nichos · Todos', seed: seedOf('4'), mockupQuery: mq('4', '&niche=todos') },
    // a created niche with competitors: no reading yet, no theme list
    { label: '4 nichos · Jogos', seed: seedOf('4'), query: '?niche=jogos', mockupQuery: mq('4', '&niche=jogos') },
    // a niche just created: no competitor, no theme list, the forja button off
    { label: '4 nichos · Pessoal', seed: seedOf('4'), query: '?niche=pessoal', mockupQuery: mq('4', '&niche=pessoal') },
  ],
  compareSelector: { mockup: '#screen', impl: '[data-obs-screen="insights"]' },
  targetExempt: ['.prose sup a', '.since summary', '#youCard .yt .nm a'],
}
runFidelity(INSIGHTS_N)

/* ------------------------------------------------------------------ 1d. the rail: what a text comparison cannot see */
const ADMIN = path.resolve(__dirname, '../../../.auth/admin.json')
async function open(browser: import('@playwright/test').Browser, vp: { width: number; height: number }, theme: 'dark' | 'light', url: string): Promise<{ page: Page; errors: string[]; close: () => Promise<void> }> {
  await resetViewerPrefs(await getSeedSiteId())
  const ctx = await browser.newContext({ viewport: vp, colorScheme: theme, storageState: ADMIN })
  await ctx.addCookies([{ name: 'btf_theme', value: theme, url: test.info().project.use.baseURL ?? 'http://localhost:3099' }])
  const page = await ctx.newPage(), errors: string[] = []
  // a console "Failed to load resource" names no URL: the failed requests are judged below, by their host
  page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(m.text()) })
  page.on('pageerror', e => errors.push(String(e)))
  // the seed's videos carry made-up YouTube ids, so their thumbnails 404 at YouTube's hosts; anything the SITE fails to serve is an error
  page.on('response', r => { if (r.status() >= 400 && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(r.url())) errors.push(r.status() + ' ' + r.url()) })
  await page.goto(url)
  await page.locator('[data-obs-screen]').first().waitFor()
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  return { page, errors, close: () => ctx.close() }
}
/** The rail's geometry: does it scroll, is the pressed niche wholly inside it, does the page scroll sideways. */
const railOf = (page: Page) => page.evaluate(() => {
  const rail = document.querySelector<HTMLElement>('.obs-ch-seg-ctl')!, cur = rail.querySelector<HTMLElement>('[aria-pressed="true"]')!
  const a = rail.getBoundingClientRect(), c = cur.getBoundingClientRect(), nav = document.querySelector<HTMLElement>('.obs-ch-nav')!.getBoundingClientRect()
  const tabs = document.querySelector<HTMLElement>('[data-obs-tabs]')!.getBoundingClientRect()
  return {
    sw: rail.scrollWidth, cw: rail.clientWidth, scrolls: rail.scrollWidth > rail.clientWidth + 2, scrollLeft: Math.round(rail.scrollLeft),
    pressedInView: c.left >= a.left - 1 && c.right <= a.right + 1, pressed: cur.dataset.niche,
    more: rail.classList.contains('obs-ch-more'), less: rail.classList.contains('obs-ch-less'),
    pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    // one line: the bar sits beside the tabs, inside the nav, and does not hang out of it
    insideNav: a.right <= nav.right + 1 && a.left >= nav.left - 1, navHeight: Math.round(nav.height), tabsHeight: Math.round(tabs.height),
    labels: [...rail.querySelectorAll<HTMLElement>('button')].map(b => b.dataset.niche),
  }
})

test.describe('nichos · barra de nicho que rola (6 nichos)', () => {
  test.beforeAll(async () => { test.setTimeout(180_000); await ensureSeeded(seedOf('6')) })
  for (const vp of VIEWPORTS) for (const theme of THEMES) test(`${vp.id} · ${theme}`, async ({ browser }) => {
    test.setTimeout(120_000)
    const all = ['todos', 'viagem', 'ia', 'jogos', 'pessoal', 'culinaria', 'financas']
    // Todos: the rail starts at the beginning
    let s = await open(browser, vp, theme, '/cms/youtube/competitors')
    try {
      await expect(s.page.locator('.obs-ch-nav[data-niche-scroll]')).toHaveCount(1)
      // the fades are put by the bar's effect, after hydration: wait for the rail to settle before reading it
      await expect.poll(async () => { const x = await railOf(s.page); return x.more === x.scrolls }).toBe(true)
      const r = await railOf(s.page)
      expect(r.labels).toEqual(all)
      expect({ pressed: r.pressed, inView: r.pressedInView, left: r.scrollLeft, less: r.less, overflow: r.pageOverflow, insideNav: r.insideNav })
        .toEqual({ pressed: 'todos', inView: true, left: 0, less: false, overflow: false, insideNav: true })
      // at 768 six niches cannot fit beside the tabs (LEIAME 04/10, decisão 9: three fit)
      if (vp.id === '768') expect(r.scrolls).toBe(true)
      expect(s.errors).toEqual([])
    } finally { await s.close() }
    // the last niche: brought into view by the rail, never by the page
    s = await open(browser, vp, theme, '/cms/youtube/competitors?niche=financas')
    try {
      await expect.poll(async () => { const x = await railOf(s.page); return x.pressedInView && x.less === x.scrollLeft > 2 }).toBe(true)
      const r = await railOf(s.page)
      expect({ pressed: r.pressed, inView: r.pressedInView, overflow: r.pageOverflow, insideNav: r.insideNav, more: r.more })
        .toEqual({ pressed: 'financas', inView: true, overflow: false, insideNav: true, more: false })
      if (r.scrolls) expect({ left: r.scrollLeft > 0, less: r.less }).toEqual({ left: true, less: true })
      // clicking a niche at the other end brings IT into view
      const todos = s.page.locator('.obs-ch-seg-ctl [data-niche="todos"]')
      await expect(todos).toHaveCount(1)
      await todos.evaluate((b: HTMLElement) => b.click())
      await expect(todos).toHaveAttribute('aria-pressed', 'true')
      await expect.poll(async () => (await railOf(s.page)).pressedInView).toBe(true)
      expect((await railOf(s.page)).pageOverflow).toBe(false)
      expect(s.errors).toEqual([])
    } finally { await s.close() }
  })
})

/* ------------------------------------------------------------------ 2. one created niche (Jogos, one competitor of IA) */
const BAD = /NaN|undefined|há −/
test.describe('nichos · um nicho criado pelo dono (Jogos)', () => {
  test.beforeAll(async () => { test.setTimeout(180_000); await ensureSeeded({ extraNiche: { slug: 'jogos', label: 'Jogos', channel: 'the-ai-advantage' } }) })
  for (const vp of VIEWPORTS) for (const theme of THEMES) test(`${vp.id} · ${theme}`, async ({ browser }) => {
    test.setTimeout(180_000)
    const noOverflow = async (p: Page) => expect(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
    const clean = async (p: Page) => expect(await p.locator('[data-obs]').first().innerText()).not.toMatch(BAD)
    let s = await open(browser, vp, theme, '/cms/youtube/competitors')
    // React can leave a streamed segment (`<div hidden id="S:n">`) behind when the client render wins the race with the
    // stream's swap script: the screen is then twice in the DOM, once hidden. Only what is rendered counts here.
    const live = (sel: string) => s.page.locator(sel).filter({ visible: true })
    try {
      const bar = live('.obs-ch-seg-ctl button')
      // the label, without the count and the screen-reader suffix
      expect(await bar.evaluateAll(bs => bs.map(b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()))).toEqual(['Todos', 'Viagem', 'IA', 'Jogos'])
      const count = async (n: string) => Number(await live(`.obs-ch-seg-ctl [data-niche="${n}"] .obs-ch-n`).innerText())
      expect([await count('todos'), await count('jogos')]).toEqual([14, 1])
      // the niche select of a row: the site's niches (Viagem, IA, Jogos); a row "sem nicho" would add its own empty option
      const sel = live('select.niche[data-ctx="row"]:not(.none)').first()
      expect(await sel.locator('option').evaluateAll(os => os.map(o => o.textContent))).toEqual(['Viagem', 'IA', 'Jogos'])
      const tabCanais = live('[data-obs-tabs] [role="tab"], [data-obs-tabs] a').first()
      const before = await tabCanais.innerText()
      await noOverflow(s.page); await clean(s.page)
      // picking Jogos: one competitor row, and the tab's count follows
      await live('.obs-ch-seg-ctl [data-niche="jogos"]').click()
      await expect(s.page).toHaveURL(/niche=jogos/)
      const rows = live('[data-obs-screen="canais"] tbody tr[data-id]:not(.you)')
      await expect(rows).toHaveCount(1)
      await expect(rows.first()).toContainText('The AI Advantage')
      await expect(live('tr.group .dot.custom')).toHaveCount(1)
      const after = await tabCanais.innerText()
      expect(before).toMatch(/14/); expect(after).toMatch(/1(?!\d)/); expect(after).not.toBe(before)
      await noOverflow(s.page); await clean(s.page)
      expect(s.errors).toEqual([])
    } finally { await s.close() }
    s = await open(browser, vp, theme, '/cms/youtube/competitors/insights?niche=jogos')
    try {
      const txt = 'Ainda não há lista de temas para Jogos. Padrões de título, o mapa de publicação e “Você no nicho” funcionam normalmente.'
      await expect(live('#themeCard [data-no-themes]')).toHaveText(txt)
      await expect(live('#gapCard [data-no-themes]')).toHaveText(txt)
      await noOverflow(s.page); await clean(s.page)
      expect(s.errors).toEqual([])
    } finally { await s.close() }
  })
})
