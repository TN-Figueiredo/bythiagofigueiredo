// apps/web/e2e/tests/cms/observatorio/insights.spec.ts
// Fidelity of the Insights screen against insights.html: NONE ("sem pedido hoje") and EMPTY ("ainda não há leitura")
// (insights.html:808 MOCK). The 9 request states are in forja.spec.ts (INSIGHTS_FORJA).
import { runFidelity, type ScreenSpec } from './fidelity'

export const INSIGHTS: ScreenSpec = {
  name: 'insights', mockupFile: 'docs/superpowers/mockups/2026-10-02-observatorio/insights.html', route: '/cms/youtube/competitors/insights',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: [
    { label: 'NONE (sem pedido hoje)', mockupClicks: ['sem pedido hoje'], seed: {} },
    { label: 'EMPTY (ainda não há leitura)', mockupClicks: ['ainda não há leitura'], seed: { noReadings: true } },
    // the same two states inside a niche (with Todos the screen only asks to pick one): ?niche= on both sides
    ...(['viagem', 'ia'] as const).flatMap(n => [
      { label: 'NONE · ' + n, mockupClicks: ['sem pedido hoje'], seed: {}, query: '?niche=' + n, mockupQuery: '?niche=' + n },
      { label: 'EMPTY · ' + n, mockupClicks: ['ainda não há leitura'], seed: { noReadings: true }, query: '?niche=' + n, mockupQuery: '?niche=' + n },
    ]),
  ],
  compareSelector: { mockup: '#screen', impl: '[data-obs-screen="insights"]' },
  // spec §6 (Fora de escopo): "Criar ideia no pipeline" fica para depois (o endpoint não existe) — the Lacunas button
  mockExclude: ['[data-idea]'],
}

runFidelity(INSIGHTS)
