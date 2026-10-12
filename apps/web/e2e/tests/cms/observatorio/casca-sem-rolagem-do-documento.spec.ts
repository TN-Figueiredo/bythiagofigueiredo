// apps/web/e2e/tests/cms/observatorio/casca-sem-rolagem-do-documento.spec.ts
// T0 (defeito em produção, 12/10): na tela Comparar o contêiner "parava no meio do monitor" e embaixo aparecia a cor de fundo.
// Causa: a casca do CMS é `div.h-screen > main.overflow-y-auto` (só o `main` rola), mas `main` não é `position:relative`. Todo
// elemento `position:absolute` sem ancestral posicionado (o `.obs-ch-sr` do texto só para leitor de tela, a região viva
// `.fx-live`) tem como bloco de contenção o viewport inicial, escapa do corte do `main` e estica a altura do DOCUMENTO. O documento
// passa a rolar além da janela; quando a roda do mouse chega ao fim do `main`, a rolagem encadeia para a janela e a casca
// inteira sobe, deixando uma faixa sem conteúdo embaixo. A regra: só o `main` rola; o documento nunca.
// Esta tela não escreve nada: o spec só semeia o banco local.
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STATE, ensureSeeded, seedIdsOf, THEMES } from './fidelity'
import { resetViewerPrefs } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

test.use({ storageState: ADMIN_STATE })
let ids: ReturnType<typeof seedIdsOf>
test.beforeAll(async () => {
  test.setTimeout(240_000)
  ids = seedIdsOf(await ensureSeeded({ ownPreset: '2' as const, canalCompleto: true }))
})
test.afterAll(async () => { await resetViewerPrefs(await getSeedSiteId()) })

const TAMANHOS = [
  { n: '1440x1060', width: 1440, height: 1060 },
  { n: '1024x768', width: 1024, height: 768 },
  { n: '390x844', width: 390, height: 844 },
] as const
const ROTAS: { nome: string; url: () => string; raiz: string }[] = [
  { nome: 'comparar', url: () => `/cms/youtube/competitors/comparar?a=${ids.own('tnfigueiredo')}&b=${ids.channel('leo-khev')}`, raiz: '[data-obs-screen="comparar"]' },
  { nome: 'lista de canais', url: () => '/cms/youtube/competitors?niche=todos', raiz: '[data-obs]' },
  { nome: 'página do canal', url: () => `/cms/youtube/competitors/canal/${ids.channel('leo-khev')}`, raiz: '[data-obs-screen="canal"]' },
  { nome: 'histórico', url: () => '/cms/youtube/competitors/mudancas', raiz: '[data-obs]' },
]

async function abrir(page: Page, url: string, raiz: string, size: { width: number; height: number }, tema: string): Promise<void> {
  await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
  await page.setViewportSize(size)
  await page.goto(url)
  await page.locator(raiz).first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }) // indicador do `next dev`
}

/** Quem estica o documento: elemento absoluto sem ancestral posicionado cujo fundo passa da janela (para a mensagem de falha). */
const culpados = (page: Page) => page.evaluate(() => {
  const H = document.documentElement.clientHeight, out: string[] = []
  for (const e of document.querySelectorAll('body *')) {
    const c = getComputedStyle(e), b = e.getBoundingClientRect()
    if (c.position !== 'absolute' || b.bottom <= H + 1) continue
    let cb: Element | null = e.parentElement
    while (cb && getComputedStyle(cb).position === 'static') cb = cb.parentElement
    if (!cb || cb === document.body || cb === document.documentElement) out.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)} bottom=${Math.round(b.bottom)}`)
  }
  return out.slice(0, 5)
})

for (const rota of ROTAS) {
  for (const tema of THEMES) {
    for (const tam of TAMANHOS) {
      test(`${rota.nome}, tema ${tema}, ${tam.n}: só o main rola, o documento não`, async ({ page }) => {
        test.setTimeout(120_000)
        await abrir(page, rota.url(), rota.raiz, tam, tema)
        const m = await page.evaluate(() => {
          const se = document.scrollingElement!, main = document.querySelector('main')!
          return { doc: se.scrollHeight, janela: innerHeight, mainRola: main.scrollHeight > main.clientHeight + 1 }
        })
        expect.soft(m.doc, `o documento rola (${m.doc} > ${m.janela}); absolutos soltos: ${(await culpados(page)).join(' | ')}`).toBeLessThanOrEqual(m.janela)
        // rolagem de verdade: a roda sobre o main até além do fim; a janela não pode se mexer e a casca tem de continuar colada embaixo
        if (m.mainRola) {
          const box = (await page.locator('main').boundingBox())!
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
          const noFim = () => page.evaluate(() => { const mn = document.querySelector('main')!; return Math.round(mn.scrollTop + mn.clientHeight) >= mn.scrollHeight - 1 })
          for (let i = 0; i < 60 && !(await noFim()); i++) await page.mouse.wheel(0, 6000) // a página do canal a 390 px tem ~50 000 px
          for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 4000) // e mais, já no fim: é aqui que a rolagem encadeava para a janela
          await page.waitForTimeout(250)
          const f = await page.evaluate(() => {
            const main = document.querySelector('main')!, casca = main.parentElement!.getBoundingClientRect()
            return { scrollY: Math.round(scrollY), cascaBottom: Math.round(casca.bottom), janela: innerHeight, mainNoFim: Math.round(main.scrollTop + main.clientHeight) >= main.scrollHeight - 1 }
          })
          if (process.env.T0_OUT) await page.screenshot({ path: `${process.env.T0_OUT}/${rota.nome.replace(/ /g, '-')}-${tema}-${tam.n}-apos-rolar.png` })
          expect(f.scrollY, 'a janela rolou').toBe(0)
          expect(f.cascaBottom, 'a casca subiu e deixou uma faixa embaixo').toBe(f.janela)
          expect(f.mainNoFim, 'o main não chegou ao fim do conteúdo').toBe(true)
        }
      })
    }
  }
}
