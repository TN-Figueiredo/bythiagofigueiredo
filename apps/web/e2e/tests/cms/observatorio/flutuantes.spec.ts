// apps/web/e2e/tests/cms/observatorio/flutuantes.spec.ts
// A prova das flutuantes (spec de telas v9, 19.1, aceite 3; modelo: prova-flutuantes.js do mockup aprovado). Para cada
// flutuante, com o gatilho no centro da janela, colado embaixo e colado em cima: (a) elementsFromPoint no centro e nos
// quatro cantos devolve a própria caixa, (b) a caixa está inteira na janela, (c) mora em #flut, filho do <body>, e não
// cobre o gatilho, (d) Esc fecha e, nos popovers de clique, o foco volta ao gatilho, (e) o fundo não é transparente
// (uma variável de tela que não chega a #flut falha em silêncio). Em 1440 e 390 px, nos dois temas.
// Controle negativo: uma caixa absolute numa célula da última linha, com z-index alto, TEM de reprovar.
// Depois, o teclado em navegador real (Tab que entra e sai dos popovers, Esc que fecha uma camada de cada vez): o que os
// testes de unidade, em jsdom, não conseguem afirmar.
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STATE, ensureSeeded, seedIdsOf, THEMES } from './fidelity'
import { MANY_VERSIONS_ID } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE })
let ids: ReturnType<typeof seedIdsOf>
test.beforeAll(async () => { ids = seedIdsOf(await ensureSeeded({ manyVersions: true })) })

type Modo = 'clique' | 'foco'
interface Familia { id: string; gatilho: string; modo: Modo; caixa: string; max?: number }
const TELAS: Array<{ nome: string; url: () => string; familias: Familia[] }> = [
  { nome: 'canais', url: () => '/cms/youtube/competitors', familias: [
    { id: '"?" da tabela', gatilho: '[data-obs-screen="canais"] .tip', modo: 'foco', caixa: '#flut .cn-tt', max: 8 },
    { id: 'menu da linha', gatilho: '[data-obs-screen="canais"] [data-menu]', modo: 'clique', caixa: '#flut .cn-menu', max: 6 },
    { id: 'menu ⋯ da moldura', gatilho: '.obs-ch-menu-wrap [aria-haspopup="menu"]', modo: 'clique', caixa: '#flut #obs-ch-menu' },
    { id: 'frescor por canal', gatilho: '.obs-ch-fresh > button', modo: 'clique', caixa: '#flut #obs-ch-fresh-pop' },
  ] },
  { nome: 'outliers', url: () => '/cms/youtube/competitors/outliers', familias: [
    { id: 'ⓘ do múltiplo', gatilho: '.obs-out-info', modo: 'clique', caixa: '#flut .obs-out-tip', max: 6 },
    { id: 'dica de ícone', gatilho: 'a.obs-out-ib', modo: 'foco', caixa: '#flut .obs-out-ibtip', max: 6 },
  ] },
  // "Fixar vídeo" (PinButton) não mora em Outliers: está nos cartões de Mudanças e no Histórico do vídeo. Na gaveta do canal o botão só
  // existe como "Desafixar" (lista de fixados), sem dica: não há o que provar lá.
  { nome: 'mudancas', url: () => '/cms/youtube/competitors/mudancas?win=90', familias: [
    { id: 'mais filtros', gatilho: '.filters .more-btn', modo: 'clique', caixa: '#flut .mu-more-pop' },
    { id: 'fixar vídeo (cartão)', gatilho: 'article.vid .fx-btn[data-pin-act="pin"]', modo: 'foco', caixa: '#flut .fx-hint-pop', max: 4 },
  ] },
  { nome: 'historico', url: () => '/cms/youtube/competitors/video/' + ids.video(MANY_VERSIONS_ID), familias: [
    { id: 'marcador da linha do tempo', gatilho: '.lanes .mk', modo: 'foco', caixa: '#flut #hv-tip', max: 8 },
    { id: 'lista de grupo', gatilho: '.lanes .gbtn', modo: 'clique', caixa: '#flut .hv-gpop', max: 6 },
    { id: 'fixar vídeo (histórico)', gatilho: '[data-obs-screen="historico"] .fx-btn[data-pin-act="pin"]', modo: 'foco', caixa: '#flut .fx-hint-pop' },
  ] },
]
const LARGURAS = [1440, 390] as const
const POS = [['centro', 'center'], ['colado embaixo', 'end'], ['colado em cima', 'start']] as const

interface Res { ok: boolean; dentro: boolean; topo: boolean; cobre: boolean; noFlut: boolean; fundo: boolean; quem: string; caixa?: string }
/** Roda no navegador. As dicas de mouse têm pointer-events:none: a prova liga durante a medida, senão elementsFromPoint não as vê. */
async function conferir(page: Page, gatilho: string, n: number, caixa: string): Promise<Res> {
  return page.evaluate(({ gatilho, n, caixa }) => {
    const g = document.querySelectorAll<HTMLElement>(gatilho)[n]!, tip = document.querySelector<HTMLElement>(caixa)
    if (!tip) return { ok: false, dentro: false, topo: false, cobre: false, noFlut: false, fundo: false, quem: 'a flutuante não abriu' }
    const st = document.createElement('style'); st.textContent = '#flut>*{pointer-events:auto!important}'; document.head.appendChild(st)
    const r = tip.getBoundingClientRect(), W = document.documentElement.clientWidth, H = innerHeight
    const dentro = r.width > 0 && r.height > 0 && r.left >= -0.5 && r.top >= -0.5 && r.right <= W + 0.5 && r.bottom <= H + 0.5
    let topo = true, quem = ''
    for (const [px, py] of [[(r.left + r.right) / 2, (r.top + r.bottom) / 2], [r.left + 3, r.top + 3], [r.right - 3, r.top + 3], [r.left + 3, r.bottom - 3], [r.right - 3, r.bottom - 3]]) {
      const x = Math.min(Math.max(px!, 0), W - 1), y = Math.min(Math.max(py!, 0), H - 1), t = document.elementsFromPoint(x, y)[0]
      if (!(t && (t === tip || tip.contains(t)))) { topo = false; quem = (t ? t.tagName + '.' + String((t as HTMLElement).className) : 'nada') + ' em ' + Math.round(x) + ',' + Math.round(y) }
    }
    st.remove()
    const b = g.getBoundingClientRect()
    const cobre = !(r.right <= b.left + 0.5 || r.left >= b.right - 0.5 || r.bottom <= b.top + 0.5 || r.top >= b.bottom - 0.5)
    const flut = tip.closest('#flut'), noFlut = !!flut && flut.parentNode === document.body
    const bg = getComputedStyle(tip).backgroundColor, m = bg.match(/rgba?\(([^)]+)\)/)?.[1]?.split(',').map(s => parseFloat(s)) ?? []
    const fundo = m.length === 3 || (m.length === 4 && m[3]! > 0.9)
    return { ok: dentro && topo && !cobre && noFlut && fundo, dentro, topo, cobre, noFlut, fundo, quem, caixa: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} bg=${bg}; gatilho ${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)}; janela ${W}x${H}` }
  }, { gatilho, n, caixa })
}

/** Índices dos gatilhos visíveis, espalhados do primeiro ao último, no máximo `max`. */
async function amostra(page: Page, gatilho: string, max = 3): Promise<number[]> {
  const vis = await page.evaluate(sel => [...document.querySelectorAll<HTMLElement>(sel)].map((e, i) => (e.getBoundingClientRect().width > 0 ? i : -1)).filter(i => i >= 0), gatilho)
  if (vis.length <= max) return vis
  return Array.from({ length: max }, (_, k) => vis[Math.round(k * (vis.length - 1) / (max - 1))]!)
}

for (const tema of THEMES) for (const largura of LARGURAS) for (const tela of TELAS) {
  test(`${tela.nome} · ${largura} px · ${tema}: toda flutuante acima do conteúdo e dentro da janela`, async ({ page }) => {
    await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
    await page.setViewportSize({ width: largura, height: 900 })
    await page.goto(tela.url())
    await page.locator('[data-obs-screen]').first().waitFor()
    await page.waitForLoadState('networkidle')
    // o indicador do `next dev` (<nextjs-portal>, canto inferior esquerdo, z-index máximo) não é do produto: sai da medida
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
    const falhas: string[] = []
    const modos: Record<string, Record<string, number>> = {}
    let total = 0
    for (const f of tela.familias) {
      const porFamilia = (modos[f.id] ??= {})
      const indices = await amostra(page, f.gatilho, f.max)
      expect(indices.length, `${f.id}: nenhum gatilho visível (${f.gatilho})`).toBeGreaterThan(0)
      for (const n of indices) {
        const g = page.locator(f.gatilho).nth(n)
        for (const [pos, bloco] of POS) {
          await g.evaluate((e, b) => e.scrollIntoView({ block: b as ScrollLogicalPosition, inline: 'nearest' }), bloco)
          if (!(await g.isVisible())) continue
          let modo = f.modo === 'clique' ? 'clique' : 'teclado'
          if (f.modo === 'clique') {
            await g.click()
          } else {
            // uma tecla neutra põe o navegador em modalidade de teclado: só então focus() por script conta como :focus-visible
            await page.keyboard.press('Shift')
            await g.evaluate(e => { (e as HTMLElement).blur(); (e as HTMLElement).focus({ preventScroll: true }) })
            if (!(await g.evaluate(e => e.matches(':focus-visible')))) { modo = 'mouse'; await g.hover() }
          }
          porFamilia[modo] = (porFamilia[modo] ?? 0) + 1
          await page.waitForTimeout(80)
          total++
          const r = await conferir(page, f.gatilho, n, f.caixa)
          if (!r.ok) falhas.push(`${f.id} #${n} ${pos} (${modo}): ${JSON.stringify(r)}`)
          await page.keyboard.press('Escape')
          await page.waitForTimeout(40)
          if (await page.locator(f.caixa).count()) falhas.push(`${f.id} #${n} ${pos} (${modo}): Esc não fechou`)
          if (f.modo === 'clique' && !(await g.evaluate(e => document.activeElement === e))) falhas.push(`${f.id} #${n} ${pos}: o foco não voltou ao gatilho`)
          await g.evaluate(e => (e as HTMLElement).blur())
          await page.mouse.move(1, 1)
        }
      }
    }
    console.info(`[prova-flutuantes] ${tela.nome} ${largura} ${tema}: ${total - falhas.length} de ${total} | modos ${JSON.stringify(modos)}`)
    expect(total, 'nenhuma flutuante foi exercitada: o seletor do gatilho mudou?').toBeGreaterThan(0)
    expect(falhas).toEqual([])
  })
}

test('controle negativo: uma caixa absolute numa célula da última linha, com z-index alto, reprova', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/cms/youtube/competitors')
  await page.locator('[data-obs-screen="canais"] tbody tr').first().waitFor()
  await page.evaluate(() => {
    const td = document.querySelector<HTMLElement>('[data-obs-screen="canais"] tbody tr:last-child td:first-child')!
    td.scrollIntoView({ block: 'end' })
    const g = document.createElement('button'); g.id = 'neg-g'; g.textContent = '?'; td.appendChild(g)
    const c = document.createElement('div'); c.id = 'neg-caixa'
    c.style.cssText = 'position:absolute;z-index:9999;top:30px;left:0;width:270px;height:160px;background:#221E1A'
    td.appendChild(c)
  })
  const r = await conferir(page, '#neg-g', 0, '#neg-caixa')
  console.info('[prova-flutuantes] controle negativo: ' + JSON.stringify(r))
  expect(r.ok).toBe(false)
  expect(r.noFlut).toBe(false)
})

test('uma aberta por vez e clique fora, na tela de verdade', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/cms/youtube/competitors')
  await page.locator('.obs-ch-fresh > button').click()
  await page.locator('.obs-ch-menu-wrap [aria-haspopup="menu"]').click()
  expect(await page.locator('#flut > *').count()).toBe(1)
  await page.mouse.click(5, 895)
  expect(await page.locator('#flut > *').count()).toBe(0)
})

// ---- teclado em navegador real -------------------------------------------------------------------------------------

const MARCA = 'data-prova-proximo'
/** Foca o gatilho, aperta Tab com tudo fechado e marca o controle que recebeu o foco: é "o controle seguinte na ordem da página". */
async function marcaProximo(page: Page, gatilho: string): Promise<string> {
  await page.locator(gatilho).focus()
  await page.keyboard.press('Tab')
  const desc = await page.evaluate(m => {
    const a = document.activeElement as HTMLElement
    a.setAttribute(m, '')
    return a.tagName + '.' + String(a.className) + ' ' + (a.getAttribute('aria-label') ?? a.textContent ?? '').trim().slice(0, 40)
  }, MARCA)
  await page.locator(gatilho).focus()
  return desc
}
const focoNoProximo = (page: Page) => page.evaluate(m => document.activeElement?.hasAttribute(m) ?? false, MARCA)
const focoDentro = (page: Page, caixa: string) => page.evaluate(c => !!document.querySelector(c)?.contains(document.activeElement), caixa)
const descFoco = (page: Page) => page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return a ? a.tagName + '.' + String(a.className) + ' ' + (a.getAttribute('aria-label') ?? a.textContent ?? '').trim().slice(0, 40) : 'nada' })

test.describe('teclado', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/cms/youtube/competitors')
    await page.locator('[data-obs-screen]').first().waitFor()
    await page.waitForLoadState('networkidle')
  })

  test('Frescor por canal: Tab entra no popover, e passar do último focável fecha e segue para o controle depois do botão', async ({ page }) => {
    const btn = '.obs-ch-fresh > button'
    const prox = await marcaProximo(page, btn)
    await page.locator(btn).click()
    await expect(page.locator('#flut #obs-ch-fresh-pop')).toBeVisible()
    await page.keyboard.press('Tab')
    expect(await focoDentro(page, '#obs-ch-fresh-pop'), 'depois do 1º Tab o foco devia estar dentro do popover; está em ' + await descFoco(page)).toBe(true)
    expect(await page.locator('#flut #obs-ch-fresh-pop').count(), 'o popover devia seguir aberto').toBe(1)
    let passos = 1
    for (; passos < 40 && await page.locator('#flut #obs-ch-fresh-pop').count(); passos++) {
      await page.keyboard.press('Tab')
      if (await page.locator('#flut #obs-ch-fresh-pop').count()) expect(await focoDentro(page, '#obs-ch-fresh-pop'), `passo ${passos}: com o popover aberto o foco tem de estar nele; está em ${await descFoco(page)}`).toBe(true)
    }
    expect(await page.locator('#flut #obs-ch-fresh-pop').count(), 'o popover não fechou depois de ' + passos + ' Tabs').toBe(0)
    expect(await focoNoProximo(page), `o foco devia estar em "${prox}"; está em ${await descFoco(page)}`).toBe(true)
  })

  test('menu ⋯ da moldura: Tab fecha e foca o controle seguinte; Shift+Tab a partir de um item volta ao ⋯', async ({ page }) => {
    const btn = '.obs-ch-menu-wrap [aria-haspopup="menu"]'
    const prox = await marcaProximo(page, btn)
    await page.locator(btn).click()
    await expect(page.locator('#flut #obs-ch-menu')).toBeVisible()
    expect(await focoDentro(page, '#obs-ch-menu'), 'o primeiro item devia ter o foco ao abrir; está em ' + await descFoco(page)).toBe(true)
    await page.keyboard.press('Tab')
    await expect(page.locator('#flut #obs-ch-menu')).toHaveCount(0)
    expect(await focoNoProximo(page), `Tab: o foco devia estar em "${prox}"; está em ${await descFoco(page)}`).toBe(true)
    // Shift+Tab a partir de um item
    await page.locator(btn).click()
    await expect(page.locator('#flut #obs-ch-menu')).toBeVisible()
    expect(await focoDentro(page, '#obs-ch-menu')).toBe(true)
    await page.keyboard.press('Shift+Tab')
    expect(await page.locator(btn).evaluate(e => document.activeElement === e), 'Shift+Tab: o foco devia estar no ⋯; está em ' + await descFoco(page)).toBe(true)
  })

  test('menu da linha de Canais: Esc fecha o menu e a gaveta aberta fica', async ({ page }) => {
    await page.locator('[data-obs-screen="canais"] .nmbtn[data-open]').first().click()
    await expect(page.locator('.cn-drawer')).toBeVisible()
    await page.locator('[data-obs-screen="canais"] [data-menu]').first().click()
    await expect(page.locator('#flut .cn-menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#flut .cn-menu')).toHaveCount(0)
    await expect(page.locator('.cn-drawer'), 'o Esc que fechou o menu fechou também a gaveta').toBeVisible()
    // o segundo Esc fecha a gaveta
    await page.keyboard.press('Escape')
    await expect(page.locator('.cn-drawer')).toHaveCount(0)
  })
})

test('Mais filtros de Mudanças: Tab do botão entra no select; Esc devolve o foco ao botão', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/cms/youtube/competitors/mudancas')
  await page.locator('[data-obs-screen]').first().waitFor()
  await page.waitForLoadState('networkidle')
  const btn = page.locator('.filters .more-btn')
  await btn.click()
  await expect(page.locator('#flut .mu-more-pop')).toBeVisible()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.id), 'Tab devia entrar no select de canal; o foco está em ' + await descFoco(page)).toBe('mu-fChannel')
  await page.keyboard.press('Escape')
  await expect(page.locator('#flut .mu-more-pop')).toHaveCount(0)
  expect(await btn.evaluate(e => document.activeElement === e), 'Esc devia devolver o foco ao botão; está em ' + await descFoco(page)).toBe(true)
})
