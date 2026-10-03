/**
 * Fidelity harness: each approved mockup state × viewport {1440×900, 768×1024} × theme {dark, light} against the
 * implemented screen, on the SAME oracle data (observatorio-seed.ts) and the same frozen clock (webServer
 * OBS_NOW_OVERRIDE = the mockup's NOW_ISO).
 *
 * Per test: seed (once per state) → implementation (cookie btf_theme, route + query, wait for the compare root) →
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
import { seedObservatory, type SeedOptions } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

export interface MockupState { label: string; mockupClicks: string[]; seed: SeedOptions; query?: string }
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
  textAllow?: RegExp[]
  /** Root of the implementation compared with the mockup's #screen (default [data-obs-screen]). */
  compareSelector?: string
  /** The tab rail whose bottom + 16 px is the content top (default [data-obs-tabs]). */
  tabsSelector?: string
  /** Session for http routes (default e2e/.auth/admin.json, written by the 'setup' project). */
  storageState?: string
}

export const VIEWPORTS = [{ id: '1440', width: 1440, height: 900 }, { id: '768', width: 768, height: 1024 }] as const
export const THEMES = ['dark', 'light'] as const
const MOCK_SCREEN = '#screen'
const DEFAULT_ROOT = '[data-obs-screen]', DEFAULT_TABS = '[data-obs-tabs]'
const REPO_ROOT = path.resolve(__dirname, '../../../../../..')
const OUT_DIR = path.resolve(__dirname, '../../../../test-results/observatorio')
const ADMIN_STATE = path.resolve(__dirname, '../../../.auth/admin.json')

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
/** Masks every match of the allowed patterns, so a listed real-data difference compares equal. */
export function maskAllowed(s: string, allow: readonly RegExp[] = []): string {
  return allow.reduce((acc, re) => acc.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), '⟨permitido⟩'), s)
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

/** innerText of `root` with the thumbnails' text left out (hidden while reading, then restored). */
async function textOf(page: Page, root: string, thumbs: string): Promise<string> {
  return page.evaluate(({ root, thumbs }) => {
    const r = document.querySelector<HTMLElement>(root)
    if (!r) throw new Error('fidelity: no element ' + root)
    const hidden = [...r.querySelectorAll<HTMLElement>(thumbs)].map(el => { const prev = el.style.display; el.style.display = 'none'; return () => { el.style.display = prev } })
    try { return r.innerText } finally { hidden.forEach(undo => undo()) }
  }, { root, thumbs })
}

async function openMockup(page: Page, spec: ScreenSpec, state: MockupState, theme: string): Promise<void> {
  await page.goto(mockupUrl(spec.mockupFile, theme))
  await page.waitForFunction(sel => !!document.querySelector(sel)?.textContent?.trim(), MOCK_SCREEN)
  if (state.mockupClicks.length) {
    const mock = page.locator('#ch-mock')
    await mock.locator('summary').click()
    for (const label of state.mockupClicks) await mock.getByRole('button', { name: label, exact: true }).click()
    // closed again so the screenshot shows the screen, not the mockup's control panel
    await page.evaluate(() => { const d = document.getElementById('ch-mock') as HTMLDetailsElement | null; if (d) d.open = false })
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

async function openImpl(page: Page, spec: ScreenSpec, state: MockupState, theme: string, root: string): Promise<void> {
  if (isUrl(spec.route)) {
    const u = new URL(spec.route)
    for (const [k, v] of new URLSearchParams((state.query ?? '').replace(/^\?/, ''))) u.searchParams.set(k, v)
    u.searchParams.set('theme', theme)
    await page.goto(u.toString())
  } else {
    const base = test.info().project.use.baseURL ?? 'http://localhost:3099'
    await page.context().addCookies([{ name: 'btf_theme', value: theme, url: base }])
    await page.goto(spec.route + (state.query ?? ''))
  }
  await page.locator(root).first().waitFor({ state: 'visible' })
  await page.waitForFunction(sel => !!document.querySelector(sel)?.textContent?.trim(), root)
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
export async function layoutAudits(page: Page, opts: { screen: string; root?: string; tabs?: string }): Promise<string[]> {
  const root = opts.root ?? DEFAULT_ROOT, tabs = opts.tabs ?? DEFAULT_TABS
  return page.evaluate(({ screen, root, tabs }) => {
    const fails: string[] = [], tag = screen + '@' + innerWidth
    const rootEl = document.querySelector<HTMLElement>(root)
    if (!rootEl) return [tag + ': raiz ' + root + ' não encontrada']
    const visible = (el: Element) => { if (el.closest('[hidden]')) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' }
    if (document.documentElement.scrollWidth > innerWidth + 1) fails.push(`${tag}: overflow ${document.documentElement.scrollWidth}>${innerWidth}`)
    rootEl.querySelectorAll('button,a[href],input:not([type="hidden"]),select,summary,[role=menuitem]').forEach(el => {
      if (!visible(el) || el.closest('.sr-only,[aria-hidden="true"]')) return
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
  }, { screen: opts.screen, root, tabs })
}

/** Registers the Playwright tests of a screen: state × viewport × theme. Serial: every state re-seeds the same site. */
export function runFidelity(spec: ScreenSpec): void {
  const root = spec.compareSelector ?? DEFAULT_ROOT
  test.describe(`fidelidade · ${spec.name}`, () => {
    test.describe.configure({ mode: 'serial' })
    for (const state of spec.states) {
      test.describe(state.label, () => {
        test.beforeAll(async () => {
          test.setTimeout(180_000)
          await seedObservatory(await getSeedSiteId(), state.seed)
        })
        for (const vp of VIEWPORTS) for (const theme of THEMES) {
          test(`${vp.id} · ${theme}`, async ({ browser }) => {
            test.setTimeout(120_000)
            const base = `${slug(state.label)}-${vp.id}-${theme}`, dir = path.join(OUT_DIR, slug(spec.name))
            fs.mkdirSync(dir, { recursive: true })
            const ctx = { viewport: { width: vp.width, height: vp.height }, colorScheme: theme, ...(isUrl(spec.route) ? {} : { storageState: spec.storageState ?? ADMIN_STATE }) } as const
            const implCtx = await browser.newContext(ctx), mockCtx = await browser.newContext({ viewport: ctx.viewport, colorScheme: theme })
            try {
              const impl = await implCtx.newPage(), mock = await mockCtx.newPage()
              await openImpl(impl, spec, state, theme, root)
              await openMockup(mock, spec, state, theme)
              await impl.screenshot({ path: path.join(dir, base + '-impl.png'), fullPage: true })
              await mock.screenshot({ path: path.join(dir, base + '-mockup.png'), fullPage: true })
              const implText = await textOf(impl, root, spec.implThumbSelector)
              const mockText = await textOf(mock, MOCK_SCREEN, spec.mockThumbSelector)
              const a = maskAllowed(normalizeText(mockText), spec.textAllow), b = maskAllowed(normalizeText(implText), spec.textAllow)
              const diffPath = path.join(dir, base + '.diff.txt')
              if (a !== b) fs.writeFileSync(diffPath, `# mockup × implementação — ${spec.name} · ${state.label} · ${vp.id} · ${theme}\n\n## diff (- mockup, + implementação)\n${lineDiff(mockText, implText)}\n\n## mockup\n${mockText}\n\n## implementação\n${implText}\n`)
              else if (fs.existsSync(diffPath)) fs.rmSync(diffPath)
              expect(b, 'texto da implementação ≠ mockup; diff em ' + diffPath).toBe(a)
              const audits = await layoutAudits(impl, { screen: spec.name, root, tabs: spec.tabsSelector ?? DEFAULT_TABS })
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
