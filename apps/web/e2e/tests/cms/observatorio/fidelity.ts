/**
 * Fidelity harness: each approved mockup state × viewport {1440×900, 768×1024} × theme {dark, light} against the
 * implemented screen, on the SAME oracle data (observatorio-seed.ts) and the same frozen clock (webServer
 * OBS_NOW_OVERRIDE = the mockup's NOW_ISO).
 *
 * Per test: seed (once per state, http routes only; cleared after the state) → implementation (cookie btf_theme, route + query, wait for the compare root) →
 * mockup (file://…?theme=, open #ch-mock, click each mockupClicks label) → visible text equal after normalize →
 * screenshots of both → layoutAudits(implementation) = [].
 * Artefacts: test-results/observatorio/<screen>/<state>-<vp>-<theme>{.diff.txt,-mockup.png,-impl.png}.
 *
 * A `route` that is already a URL (file://…) is opened as is and themed by `?theme=` like a mockup: the self-test uses
 * it to compare a mockup with itself.
 */
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { seedObservatory, clearObservatory, resetViewerPrefs, seedUuid, ownSeedUuid, type SeedOptions } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

/** Seeded uuids of oracle ids (the seed derives them deterministically from the site id). */
export interface SeedIds { channel(oracleId: string): string; video(oracleId: string): string; reading(oracleId: string): string; /** a canal próprio (youtube_channels) */ own(oracleId: string): string }
export interface MockupState {
  label: string
  /** Labels of the mockup's "Estados do mockup" buttons, clicked in order. */
  mockupClicks?: string[]
  seed: SeedOptions
  /**
   * Appended to the implementation route (a path segment "/…" or a query "?…"). A function receives the seeded ids;
   * a string may carry `<channel:ID>` / `<own:ID>` / `<video:ID>` / `<reading:ID>` placeholders (oracle ids), replaced by the seeded uuids.
   */
  query?: string | ((ids: SeedIds) => string)
  /** Tabs (role=tab, name starting with the label) clicked on the MOCKUP page after the state bar, e.g. a drawer's tab. */
  mockupTabClicks?: string[]
  /** Query given to the MOCKUP too (its URL parameters, e.g. ?niche=viagem, which every mockup screen honours). */
  mockupQuery?: string
  /** The state cannot run locally: its tests are registered as skipped with this reason (an external dependency). */
  skip?: string
  /** Elements left out of the text comparison in THIS state only, each with its ruling at the call site. */
  exclude?: Exclude
  /** Real-data differences of THIS state only (added to the screen's), each justified at the call site. */
  textAllow?: Allow[]
  /** Buttons (exact accessible name) clicked on the implementation after it loads, in order. */
  implClicks?: string[]
  /**
   * Hold every server-action POST of the implementation (never answered while the text is read), so a pending state
   * (e.g. "Sincronização em andamento") can be compared. Without it, actions run and the harness waits for the
   * implementation's settled state (`settledText`).
   */
  holdActions?: boolean
  /** Text the implementation shows once the clicks have settled (waited for before reading). */
  settledText?: string
}
/**
 * An allowed difference: a RegExp masks every match on BOTH sides with one token (use an alternation of the two exact
 * texts); `{ drop }` removes a text that exists on one side only (a sentence the product cannot print yet), leaving a
 * space where it was; `{ cut }` removes it leaving nothing (a clause in the middle of a sentence, before its comma).
 */
export type Allow = RegExp | { drop: RegExp } | { cut: RegExp }
/** Selectors whose text is left out, per side. Implementation selectors may carry <channel:ID>/<video:ID> placeholders. */
export interface Exclude { mockup?: string[]; impl?: string[] }
/** A CSS selector, or one per side (selector lists allowed: the texts of every match are joined in document order). */
export type CompareSelector = string | { mockup: string; impl: string }
export interface ScreenSpec {
  name: string
  /** Mockup path from the repo root, e.g. docs/superpowers/mockups/2026-10-02-observatorio/outliers.html */
  mockupFile: string
  /** CMS route (relative to baseURL) or an absolute URL (file://…). */
  route: string
  mockThumbSelector: string
  implThumbSelector: string
  states: MockupState[]
  /** Known "real data" differences, each with a comment at the call site; matches are masked on both sides. */
  textAllow?: Allow[]
  /** Elements left out of the text comparison on each side, each with its ruling at the call site. */
  exclude?: Exclude
  /** Compared roots: mockup default #screen, implementation default [data-obs-screen]. */
  compareSelector?: CompareSelector
  /** Root of the layout audits (default [data-obs-screen]); the chrome spec compares the chrome but audits the screen. */
  auditRoot?: string
  /** The tab rail whose bottom + 16 px is the content top (default [data-obs-tabs]). */
  tabsSelector?: string
  /** Session for http routes (default e2e/.auth/admin.json, written by the 'setup' project). */
  storageState?: string
  /**
   * Mockup elements exempt from the target-size audit ON THE IMPLEMENTATION, each a selector with its justification at
   * the call site (only for an element the binding mockup itself draws below 32 px).
   */
  targetExempt?: string[]
  /**
   * Mockup elements left out of the text comparison, each a selector justified by a RULING at the call site (a
   * deferred piece of the mockup, e.g. R43's per-video swipe). Never for a text the product prints differently.
   */
  mockExclude?: string[]
}

/**
 * outliers.html draws its "+2 canais com problema" toggle ([data-probs-toggle]) 140×18 — its own target audit fails on
 * it (Task 21b report, concern 6). The screen copies the mockup there, so that one element (.obs-out-probbtn) is exempt
 * from the 32 px audit wherever the Outliers screen is audited (outliers.spec, the chrome's Outliers tab, forja-outliers).
 */
export const OUTLIERS_TARGET_EXEMPT = ['.obs-out-probbtn']

export const VIEWPORTS = [{ id: '1440', width: 1440, height: 900 }, { id: '768', width: 768, height: 1024 }] as const
export const THEMES = ['dark', 'light'] as const
const MOCK_SCREEN = '#screen'
const DEFAULT_ROOT = '[data-obs-screen]', DEFAULT_TABS = '[data-obs-tabs]'
const REPO_ROOT = path.resolve(__dirname, '../../../../../..')
const OUT_DIR = path.resolve(__dirname, '../../../../test-results/observatorio')
export const ADMIN_STATE = path.resolve(__dirname, '../../../.auth/admin.json')

const isUrl = (s: string) => /^[a-z][a-z0-9+.-]*:/i.test(s)
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'estado'
/** file:// URL of a file given from the repo root. */
export const repoFileUrl = (file: string) => new URL('file://' + path.resolve(REPO_ROOT, file)).toString()
export const mockupUrl = (file: string, theme: string, query = '') => {
  const u = new URL(repoFileUrl(file))
  for (const [k, v] of new URLSearchParams(query.replace(/^\?/, ''))) u.searchParams.set(k, v)
  u.searchParams.set('theme', theme)
  return u.toString()
}

/** Whitespace collapsed (NBSP included), zero-width and soft-hyphen characters stripped. */
export function normalizeText(s: string): string {
  return s.replace(/[​-‍⁠﻿­]/g, '').replace(/\s+/g, ' ').trim()
}
/** Masks every match of the allowed patterns (or drops it), so a listed, ruled difference compares equal. */
export function maskAllowed(s: string, allow: readonly Allow[] = []): string {
  const g = (re: RegExp) => new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  return normalizeText(allow.reduce<string>((acc, a) => (a instanceof RegExp ? acc.replace(g(a), '⟨permitido⟩') : 'cut' in a ? acc.replace(g(a.cut), '') : acc.replace(g(a.drop), ' ')), s))
}
const linesOf = (s: string) => s.split('\n').map(l => normalizeText(l)).filter(Boolean)
/** Line diff (LCS): "  " same, "- " only in the mockup, "+ " only in the implementation. */
export function lineDiff(mock: string, impl: string): string {
  const a = linesOf(mock), b = linesOf(impl), n = a.length, m = b.length
  const L: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = a[i] === b[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!)
  const out: string[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push('  ' + a[i]); i++; j++ } else if (L[i + 1]![j]! >= L[i]![j + 1]!) out.push('- ' + a[i++]); else out.push('+ ' + b[j++])
  }
  while (i < n) out.push('- ' + a[i++])
  while (j < m) out.push('+ ' + b[j++])
  return out.join('\n')
}

/** innerText of every element matching `root` (a selector list; nested matches counted once), thumbnails' text left out. */
async function textOf(page: Page, root: string, thumbs: string): Promise<string> {
  return page.evaluate(({ root, thumbs }) => {
    const all = [...document.querySelectorAll<HTMLElement>(root)]
    // a root that is not rendered (a closed [hidden] drawer) shows nothing; its innerText would be its whole textContent
    const roots = all.filter(el => !all.some(o => o !== el && o.contains(el)) && el.getClientRects().length > 0)
    if (!roots.length) throw new Error('fidelity: no element ' + root)
    const hidden = roots.flatMap(r => [...r.querySelectorAll<HTMLElement>(thumbs)]).map(el => { const prev = el.style.display; el.style.display = 'none'; return () => { el.style.display = prev } })
    try { return roots.map(r => r.innerText).join('\n') } finally { hidden.forEach(undo => undo()) }
  }, { root, thumbs })
}

const sides = (sel: CompareSelector | undefined) => (typeof sel === 'string' ? { mockup: MOCK_SCREEN, impl: sel } : sel ?? { mockup: MOCK_SCREEN, impl: DEFAULT_ROOT })

/** The state's implementation suffix with the seeded ids resolved. */
export function resolveQuery(q: MockupState['query'], ids: SeedIds): string {
  if (typeof q === 'function') return q(ids)
  return (q ?? '').replace(/<(channel|own|video|reading):([^>]+)>/g, (_, kind: 'channel' | 'own' | 'video' | 'reading', id: string) => ids[kind](id))
}
export const seedIdsOf = (siteId: string): SeedIds => ({ channel: id => seedUuid(siteId, 'channel', id), video: id => seedUuid(siteId, 'video', id), reading: id => seedUuid(siteId, 'reading', id), own: id => ownSeedUuid(siteId, id) })

async function openMockup(page: Page, spec: ScreenSpec, state: MockupState, theme: string, root: string): Promise<void> {
  await page.goto(mockupUrl(spec.mockupFile, theme, state.mockupQuery ?? ''))
  await page.waitForFunction(sel => !!document.querySelector(sel)?.textContent?.trim(), root.split(',')[0]!.trim())
  const clicks = state.mockupClicks ?? []
  if (clicks.length) {
    const mock = page.locator('#ch-mock')
    await mock.locator(':scope > summary').click()
    for (const label of clicks) await mock.getByRole('button', { name: label, exact: true }).click()
    // closed again so the screenshot shows the screen, not the mockup's control panel
    await page.evaluate(() => { const d = document.getElementById('ch-mock') as HTMLDetailsElement | null; if (d) d.open = false })
  }
  // the tab's count follows its label with no space ("Trocas5"): the label must not continue with a letter
  for (const label of state.mockupTabClicks ?? []) await page.getByRole('tab', { name: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-zÀ-ÿ])') }).first().click()
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

async function openImpl(page: Page, spec: ScreenSpec, state: MockupState, theme: string, root: string, ids: SeedIds | null): Promise<void> {
  if (isUrl(spec.route)) {
    const u = new URL(spec.route)
    for (const [k, v] of new URLSearchParams(resolveQuery(state.query, ids ?? seedIdsOf('')).replace(/^\?/, ''))) u.searchParams.set(k, v)
    u.searchParams.set('theme', theme)
    await page.goto(u.toString())
  } else {
    const base = test.info().project.use.baseURL ?? 'http://localhost:3099'
    await page.context().addCookies([{ name: 'btf_theme', value: theme, url: base }])
    if (state.holdActions) {
      // a Next server action is a POST carrying the `next-action` header: never answered, so the UI stays pending
      await page.route('**/*', (route, req) => (req.method() === 'POST' && req.headers()['next-action'] ? undefined : route.fallback()))
    }
    await page.goto(spec.route + resolveQuery(state.query, ids ?? seedIdsOf('')))
  }
  const first = root.split(',')[0]!.trim()
  await page.locator(first).first().waitFor({ state: 'visible' })
  await page.waitForFunction(sel => !!document.querySelector(sel)?.textContent?.trim(), first)
  for (const name of state.implClicks ?? []) await page.getByRole('button', { name, exact: true }).first().click()
  if (state.settledText) await page.getByText(state.settledText, { exact: false }).first().waitFor({ state: 'visible', timeout: 60_000 })
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

/**
 * Layout audits of a rendered screen (port of the mockup's auditMockup layout checks, moldura-forja.html:1029-1038,
 * 1108, 1171). Returns failures (empty = pass):
 *  - horizontal overflow of the document (checked at every width; the brief's case is 768);
 *  - interactive targets (button, a[href], input without label, summary, select, [role=menuitem]) at least 32×32;
 *  - equal heights per row: the visible children of each [data-obs-row] that share a top have the same height;
 *  - content top = tabs bottom + 16 px.
 */
export async function layoutAudits(page: Page, opts: { screen: string; root?: string; tabs?: string; targetExempt?: string[] }): Promise<string[]> {
  const root = opts.root ?? DEFAULT_ROOT, tabs = opts.tabs ?? DEFAULT_TABS, exempt = (opts.targetExempt ?? []).join(',')
  return page.evaluate(({ screen, root, tabs, exempt }) => {
    const fails: string[] = [], tag = screen + '@' + innerWidth
    const rootEl = document.querySelector<HTMLElement>(root)
    if (!rootEl) return [tag + ': raiz ' + root + ' não encontrada']
    const visible = (el: Element) => { if (el.closest('[hidden]')) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' }
    if (document.documentElement.scrollWidth > innerWidth + 1) fails.push(`${tag}: overflow ${document.documentElement.scrollWidth}>${innerWidth}`)
    rootEl.querySelectorAll('button,a[href],input:not([type="hidden"]),select,summary,[role=menuitem]').forEach(el => {
      if (!visible(el) || el.closest('.sr-only,[aria-hidden="true"]') || (exempt && el.matches(exempt))) return
      if (el instanceof HTMLInputElement && el.labels && el.labels.length) return
      const r = el.getBoundingClientRect()
      if (r.width < 32 || r.height < 32) fails.push(`${tag}: alvo ${Math.round(r.width)}×${Math.round(r.height)} “${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}”`)
    })
    rootEl.querySelectorAll('[data-obs-row]').forEach(row => {
      const byTop = new Map<number, number[]>()
      for (const c of row.children) { if (!visible(c)) continue; const r = c.getBoundingClientRect(), t = Math.round(r.top); byTop.set(t, [...(byTop.get(t) ?? []), Math.round(r.height)]) }
      for (const [t, hs] of byTop) if (hs.length > 1 && Math.max(...hs) - Math.min(...hs) > 1) fails.push(`${tag}: linha ${row.getAttribute('data-obs-row') || ''} com alturas ${hs.join('/')} (topo ${t})`)
    })
    const tabsEl = document.querySelector(tabs)
    if (!tabsEl) fails.push(`${tag}: trilho de abas ${tabs} não encontrado`)
    else { const gap = Math.round(rootEl.getBoundingClientRect().top - tabsEl.getBoundingClientRect().bottom); if (gap !== 16) fails.push(`${tag}: topo da tela ${gap} px abaixo das abas (esperado 16)`) }
    return fails
  }, { screen: opts.screen, root, tabs, exempt })
}

/** Marker of what the local site holds now (seed options + site), so a restarted worker does not seed the same data again. */
const SEED_MARK = path.resolve(__dirname, '../../../../test-results/.observatorio-seed.json')
/**
 * Seeds the local site with `seed` unless it already holds exactly that (marker file). Playwright restarts the worker
 * after every failed test and re-runs beforeAll there: without the marker each failure re-seeded ~4 000 rows. The
 * project's teardown ('observatorio-teardown') clears the site and the marker once the whole run ends.
 */
export async function ensureSeeded(seed: SeedOptions): Promise<string> {
  const siteId = await getSeedSiteId(), key = JSON.stringify({ siteId, seed })
  let have: string | null = null
  try { have = fs.readFileSync(SEED_MARK, 'utf8') } catch { have = null }
  if (have !== key) {
    try { fs.rmSync(SEED_MARK) } catch { /* none */ }
    await seedObservatory(siteId, seed)
    fs.mkdirSync(path.dirname(SEED_MARK), { recursive: true })
    fs.writeFileSync(SEED_MARK, key)
  }
  return siteId
}
/** Clears the observatory data of the local site and forgets the marker (project teardown). */
export async function clearSeeded(): Promise<void> {
  await clearObservatory(await getSeedSiteId())
  try { fs.rmSync(SEED_MARK) } catch { /* none */ }
}

/**
 * Registers the Playwright tests of a screen: state × viewport × theme. One worker, in file order (the project sets
 * workers: 1): each state seeds the same site (ensureSeeded skips it when the site already holds that state); a file://
 * route is not seeded. Not `serial`: one failing state must not skip the rest of the sweep.
 */
export function runFidelity(spec: ScreenSpec): void {
  const { mockup: mockRoot, impl: implRoot } = sides(spec.compareSelector)
  const auditRoot = spec.auditRoot ?? (typeof spec.compareSelector === 'string' ? spec.compareSelector : DEFAULT_ROOT)
  test.describe(`fidelidade · ${spec.name}`, () => {
    for (const state of spec.states) {
      if (state.skip) {
        const reason = state.skip
        test.describe(state.label, () => {
          for (const vp of VIEWPORTS) for (const theme of THEMES) test.skip(`${vp.id} · ${theme}`, { annotation: { type: 'skip', description: reason } }, () => {})
        })
        continue
      }
      test.describe(state.label, () => {
        let ids: SeedIds | null = null
        // a file:// "implementation" (the self-test) reads no DB: nothing to seed
        if (!isUrl(spec.route)) {
          test.beforeAll(async () => {
            test.setTimeout(180_000)
            ids = seedIdsOf(await ensureSeeded(state.seed))
          })
        }
        for (const vp of VIEWPORTS) for (const theme of THEMES) {
          test(`${vp.id} · ${theme}`, async ({ browser }) => {
            test.setTimeout(120_000)
            const base = `${slug(state.label)}-${vp.id}-${theme}`, dir = path.join(OUT_DIR, slug(spec.name))
            fs.mkdirSync(dir, { recursive: true })
            const ctx = { viewport: { width: vp.width, height: vp.height }, colorScheme: theme, ...(isUrl(spec.route) ? {} : { storageState: spec.storageState ?? ADMIN_STATE }) } as const
            // the mockup opens with an empty localStorage (niche 'todos'); so does the implementation
            if (!isUrl(spec.route)) await resetViewerPrefs(await getSeedSiteId())
            const implCtx = await browser.newContext(ctx), mockCtx = await browser.newContext({ viewport: ctx.viewport, colorScheme: theme })
            try {
              const impl = await implCtx.newPage(), mock = await mockCtx.newPage()
              await openImpl(impl, spec, state, theme, implRoot, ids)
              await openMockup(mock, spec, state, theme, mockRoot)
              await impl.screenshot({ path: path.join(dir, base + '-impl.png'), fullPage: true })
              await mock.screenshot({ path: path.join(dir, base + '-mockup.png'), fullPage: true })
              const exImpl = [...(spec.exclude?.impl ?? []), ...(state.exclude?.impl ?? [])].map(x => resolveQuery(x, ids ?? seedIdsOf('')))
              const exMock = [...(spec.mockExclude ?? []), ...(spec.exclude?.mockup ?? []), ...(state.exclude?.mockup ?? [])]
              const implText = await textOf(impl, implRoot, [spec.implThumbSelector, ...exImpl].join(','))
              const mockText = await textOf(mock, mockRoot, [spec.mockThumbSelector, ...exMock].join(','))
              const allow = [...(spec.textAllow ?? []), ...(state.textAllow ?? [])]
              const a = maskAllowed(normalizeText(mockText), allow), b = maskAllowed(normalizeText(implText), allow)
              // equal only thanks to a ruled exclusion or mask → the test is reported as allow-listed, never as a plain pass
              if (a === b && (exImpl.length || exMock.length || allow.length)) {
                const rawI = normalizeText(await textOf(impl, implRoot, spec.implThumbSelector)), rawM = normalizeText(await textOf(mock, mockRoot, spec.mockThumbSelector))
                if (rawI !== rawM) test.info().annotations.push({ type: 'allow-listed', description: spec.name + ' · ' + state.label })
              }
              const diffPath = path.join(dir, base + '.diff.txt')
              if (a !== b) fs.writeFileSync(diffPath, `# mockup × implementação — ${spec.name} · ${state.label} · ${vp.id} · ${theme}\n\n## diff (- mockup, + implementação)\n${lineDiff(maskLines(mockText, allow), maskLines(implText, allow))}\n\n## mockup\n${mockText}\n\n## implementação\n${implText}\n`)
              else if (fs.existsSync(diffPath)) fs.rmSync(diffPath)
              expect(b, 'texto da implementação ≠ mockup; diff em ' + diffPath).toBe(a)
              const audits = await layoutAudits(impl, { screen: spec.name, root: auditRoot, tabs: spec.tabsSelector ?? DEFAULT_TABS, targetExempt: spec.targetExempt })
              expect(audits).toEqual([])
            } finally {
              await implCtx.close(); await mockCtx.close()
            }
          })
        }
      })
    }
  })
}
/** Per line masking, so the written diff shows only the differences the comparison actually fails on. */
const maskLines = (s: string, allow: readonly Allow[]) => s.split('\n').map(l => maskAllowed(normalizeText(l), allow)).join('\n')
