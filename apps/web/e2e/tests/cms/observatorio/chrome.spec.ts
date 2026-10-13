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
  // 15b (A4): o atalho "Meu canal: <nome>" que a moldura mostra quando o site tem canal próprio (oráculo = tnFigueiredo) nasceu na fase A3 (commits f4ab4ac1 e 80bb6a52, 11/10)
  // e o mockup da moldura é de 02/10, anterior a ele: não é defeito nem efeito da A4. A moldura de produção o desenha; a diferença é só esse texto.
  textAllow: [{ drop: /Meu canal: tnFigueiredo/ }],
  // the Outliers tab audits the Outliers screen: same exemption as outliers.spec (the mockup's own 140×18 toggle)
  // + o link "Comparar" de cada linha da lista de Canais (A3, spec 15.2): 24 px de altura com ponteiro fino (WCAG 2.2 AA, 2.5.8) e 44 px com ponteiro grosso (`.cmpl`
  // em canais.css); o piso de 32 px desta auditoria é anterior a ele. A medida de 44 px em toque é de canais-a3.spec.
  // + o nome do canal virou link no texto corrido do cartão de Mudanças e de Outliers (commit d802af12, "o painel lateral sai para concorrente e os cliques levam a página"):
  // link em linha, 15 px de altura, da exceção "em linha" do WCAG 2.5.8; também anterior à A4.
  targetExempt: [...OUTLIERS_TARGET_EXEMPT, '[data-obs-screen="canais"] .cmpl', '[data-obs-screen="mudancas"] a.chlink', 'a.obs-out-chlink'],
}

runFidelity(MOLDURA)
