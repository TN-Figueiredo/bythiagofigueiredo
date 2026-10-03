// apps/web/e2e/tests/cms/observatorio/fidelity-self.spec.ts — self-test of the fidelity runner (no CMS screen yet:
// the chrome is Task 22). A mockup compared with ITSELF must pass text equality, screenshots and layoutAudits at both
// viewports and themes; the pure helpers must catch a real difference.
import { test, expect } from '@playwright/test'
import { runFidelity, normalizeText, maskAllowed, lineDiff, repoFileUrl } from './fidelity'

const MOCKUP = 'docs/superpowers/mockups/2026-10-02-observatorio/moldura-forja.html'

runFidelity({
  name: 'auto-teste moldura',
  mockupFile: MOCKUP,
  // an absolute URL: opened as is and themed by ?theme=, exactly like the mockup side
  route: repoFileUrl(MOCKUP),
  compareSelector: '#screen',
  tabsSelector: '#ch-nav',
  mockThumbSelector: '.thumb',
  implThumbSelector: '.thumb',
  states: [{ label: 'Estado inicial', mockupClicks: [], seed: {} }],
})

test.describe('fidelidade · helpers', () => {
  test('normalize collapses whitespace and strips zero-width characters', () => {
    expect(normalizeText('  1,5 mil ​·\n\n há 3 h­ ')).toBe('1,5 mil · há 3 h')
  })
  test('a real difference is not equal; textAllow masks only the listed pattern', () => {
    const mock = normalizeText('Matt Wolfe · 3,6×\nsincronizado há 3 h'), impl = normalizeText('Matt Wolfe · 3,7×\nsincronizado há 3 h')
    expect(impl).not.toBe(mock)
    expect(maskAllowed(impl, [/\d,\d×/])).toBe(maskAllowed(mock, [/\d,\d×/]))
    expect(maskAllowed(impl, [/há \d h/])).not.toBe(maskAllowed(mock, [/há \d h/]))
  })
  test('lineDiff marks mockup-only and implementation-only lines', () => {
    expect(lineDiff('a\nb\nc', 'a\nB\nc')).toBe('  a\n- b\n+ B\n  c')
  })
})
