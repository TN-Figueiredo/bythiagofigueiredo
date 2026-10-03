// apps/web/e2e/tests/cms/observatorio/chrome.spec.ts
// Fidelity of the chrome (header, freshness, tabs with counts, niche bar) against moldura-forja.html, one state per tab.
// The text compared is the chrome's only; the layout audits run on the screen under it (content top = tabs + 16 px).
// The moldura's forja drawer FLOWS are the chrome demo, not a product surface (R59): not ported, not compared.
import { runFidelity, OUTLIERS_TARGET_EXEMPT, type ScreenSpec } from './fidelity'

const ROUTE: Record<string, string> = { Canais: '', 'Mudanças': '/mudancas', Outliers: '/outliers', Insights: '/insights' }

export const MOLDURA: ScreenSpec = {
  name: 'moldura', mockupFile: 'docs/superpowers/mockups/2026-10-02-observatorio/moldura-forja.html', route: '/cms/youtube/competitors',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: Object.entries(ROUTE).map(([tab, sub]) => ({ label: 'Aba ' + tab, mockupClicks: [tab], seed: {}, query: sub })),
  // chrome-only text comparison: the header block (title, actions, freshness) and the tab rail with the niche bar
  compareSelector: { mockup: '#ch-head, #ch-nav', impl: '[data-obs-chrome]' },
  auditRoot: '[data-obs-screen]',
  // the Outliers tab audits the Outliers screen: same exemption as outliers.spec (the mockup's own 140×18 toggle)
  targetExempt: OUTLIERS_TARGET_EXEMPT,
}

runFidelity(MOLDURA)
