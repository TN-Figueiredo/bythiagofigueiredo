// A5, 2ª leva da tela Canais (T10): numeração em toda ordenação, Direção ordenável, "sem variação", dica por célula, barra de ordenação fixa a 390 px.
// Escrito pelo executor, NÃO rodado: quem roda é o Gio (T11). Semente: oráculo + `a5Empate` (Canal Teste A e Canal Teste B, mesmo Crescimento visível,
// Direção "pouco registro"). Nada é escrito no banco: todo POST de server action é abortado e reprova o teste. Só nomes sintéticos.
import { test, expect, type Page, type Locator } from '@playwright/test'
import { ADMIN_STATE, ensureSeeded } from './fidelity'
import { A5_EMPATE, resetViewerPrefs } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

test.use({ storageState: ADMIN_STATE })
const S = '[data-obs-screen="canais"]'
const ROTA = '/cms/youtube/competitors'
const NOME_A = A5_EMPATE.canais[0].nome, NOME_B = A5_EMPATE.canais[1].nome
// textos à letra do plano (posicao-model.ts)
const ORDEM_POSICAO = 'Posição: 1º é o maior valor, em qualquer sentido.'
const ORDEM_EMPATE = 'Empate: mesmo valor na tela, mesma posição.'
const FAIXA_SEM_POSICAO = 'A posição do seu canal em relação aos outros só existe em Inscritos e Views/dia, os números de tamanho e de alcance. Aqui, a coluna P numera os canais da lista.'
const DICA_SEM_VARIACAO = 'A diferença é menor que'
const DICA_SEM_VARIACAO_FIM = 'dentro do que o corte da contagem pelo YouTube explica.'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

let intrusos: string[] = [], erros: string[] = [], cincoXX: string[] = []
test.beforeAll(async () => {
  test.setTimeout(240_000)
  await ensureSeeded({ a5Empate: true })
})
test.afterAll(async () => { await resetViewerPrefs(await getSeedSiteId()) })
test.beforeEach(async ({ page }) => {
  test.setTimeout(150_000)
  intrusos = []; erros = []; cincoXX = []
  await resetViewerPrefs(await getSeedSiteId())
  await page.context().addCookies([{ name: 'btf_theme', value: 'dark', url: 'http://localhost:3099' }])
  // FAIL-CLOSED: toda server action (POST com `next-action`) é abortada e reprova o teste no fim
  await page.context().route('**/*', async route => {
    const r = route.request()
    if (r.method() === 'POST' && r.headers()['next-action']) { intrusos.push(`${r.headers()['next-action']} ${r.url()}`); await route.abort('blockedbyclient'); return }
    await route.fallback()
  })
  await page.route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  page.on('console', m => {
    if (m.type() !== 'error') return
    const loc = m.location().url
    if (/ytimg\.com|ggpht\.com|blob\.vercel|challenges\.cloudflare/.test(loc + m.text())) return
    erros.push(m.text().slice(0, 220) + ' @ ' + loc)
  })
  page.on('pageerror', e => erros.push('pageerror: ' + e.message.slice(0, 220)))
  page.on('response', r => { if (r.status() >= 500) cincoXX.push(r.status() + ' ' + r.url().slice(0, 120)) })
  await page.addInitScript(() => {
    // o contêiner que rola: a casca do CMS rola em `main`, não na janela
    ;(window as unknown as { __sc: () => HTMLElement }).__sc = () => {
      const raiz = [...document.querySelectorAll('[data-obs-screen]')].find(e => e.getClientRects().length > 0) ?? document.querySelector('[data-obs-screen]')
      for (let p = raiz?.parentElement ?? null; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY
        if ((o === 'auto' || o === 'scroll' || o === 'overlay') && p.scrollHeight > p.clientHeight + 1) return p
      }
      return (document.scrollingElement ?? document.documentElement) as HTMLElement
    }
  })
})
test.afterEach(() => {
  if (intrusos.length) throw new Error(`Server action INESPERADA abortada: ${intrusos.length}. Primeira: ${intrusos[0]}`)
  expect(cincoXX, 'respostas 5xx').toEqual([])
  expect(erros, 'erros de console').toEqual([])
})

type W = { __sc: () => HTMLElement }
const rolarPara = (page: Page, top: number) => page.evaluate(t => { (window as unknown as W).__sc().scrollTop = t }, top)
const param = (page: Page, k: string) => new URL(page.url()).searchParams.get(k)
const caixa = (l: Locator) => l.evaluate(e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, bottom: r.bottom, right: r.right } })
const tela = (page: Page) => page.locator(`${S}:visible`).first()

async function assentou(page: Page): Promise<void> {
  await expect(page.locator(`${S}:visible [aria-busy="true"]`)).toHaveCount(0, { timeout: 20_000 })
  await page.waitForTimeout(250)
}
async function abrir(page: Page, size: { width: number; height: number }, qs = ''): Promise<void> {
  await page.setViewportSize(size)
  await page.goto(ROTA + qs)
  await page.locator(`${S} .toolbar:visible`).first().waitFor({ timeout: 60_000 })
  await page.locator(`${S} table:visible, ${S} .cards:visible`).first().waitFor({ timeout: 30_000 })
  await expect.poll(() => param(page, 'fmt'), { timeout: 15_000 }).not.toBeNull()
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
}
const D1440 = { width: 1440, height: 900 }, D390 = { width: 390, height: 844 }
/** Clica no cabeçalho (1440 px) e espera a lista nova. */
async function ordenarPelaColuna(page: Page, k: string): Promise<void> {
  await rolarPara(page, 0)
  const b = page.getByTestId(`canais-th-${k}`).locator('visible=true').first().locator('button').first()
  await b.scrollIntoViewIfNeeded()
  await b.click()
  await assentou(page)
}
/** Linhas da tabela (1440 px): nome, posição e texto da célula `col`. */
const linhas = (page: Page) => page.evaluate(() => {
  const raiz = [...document.querySelectorAll('[data-obs-screen="canais"]')].find(e => e.getClientRects().length > 0)!
  return [...raiz.querySelectorAll<HTMLElement>('tbody tr.row')].map(tr => ({
    nome: (tr.querySelector('td:nth-child(2) a, td:nth-child(2)')?.textContent ?? '').trim(),
    p: (tr.querySelector('[data-testid="canais-p"]')?.textContent ?? '').trim(),
    growth: (tr.querySelector('td[data-col="growth"]')?.textContent ?? '').trim(),
    direcao: (tr.querySelector('td[data-col="direcao"]')?.textContent ?? '').trim(),
  }))
})
const linhaDe = (page: Page, nome: string) => page.locator(`${S}:visible tbody tr.row`).filter({ hasText: nome }).first()

test('1. 1440 px, Crescimento: linha de ordem, empate A–Z, inversão', async ({ page }) => {
  await abrir(page, D1440)
  await ordenarPelaColuna(page, 'growth')
  expect(param(page, 'sort')).toBe('growth')
  const ordem = (await page.getByTestId('canais-ordem').locator('visible=true').first().textContent())!
  expect(ordem).toContain('Ordenado por')
  expect(ordem).toContain('Crescimento')
  expect(ordem).toContain(ORDEM_POSICAO)
  expect(ordem).toContain(ORDEM_EMPATE) // há empate na semente: a frase do empate só aparece então
  const ls = await linhas(page)
  const a = ls.findIndex(l => l.nome.includes(NOME_A)), b = ls.findIndex(l => l.nome.includes(NOME_B))
  expect(a, 'Canal Teste A na lista').toBeGreaterThanOrEqual(0)
  expect(b, 'Canal Teste B na lista').toBeGreaterThanOrEqual(0)
  // mesmo Nº, "empate" nos dois, A antes de B (A–Z)
  expect(ls[a]!.p).toMatch(/^\d+º\s*empate$/)
  expect(ls[b]!.p).toBe(ls[a]!.p)
  expect(a).toBeLessThan(b)
  expect(ls[a]!.growth).toBe(ls[b]!.growth)
  const posA = parseInt(ls[a]!.p, 10)
  // inverte: o 1º do topo ganha o MAIOR Nº; o empate continua A–Z
  await ordenarPelaColuna(page, 'growth')
  expect(param(page, 'dir')).toBe('asc')
  const inv = await linhas(page)
  const nums = inv.map(l => parseInt(l.p, 10)).filter(Number.isFinite)
  expect(nums[0]).toBeGreaterThanOrEqual(nums[nums.length - 1]!)
  const a2 = inv.findIndex(l => l.nome.includes(NOME_A)), b2 = inv.findIndex(l => l.nome.includes(NOME_B))
  expect(a2).toBeLessThan(b2)
  expect(inv[a2]!.p).toBe(inv[b2]!.p)
  expect(parseInt(inv[a2]!.p, 10)).toBe(posA) // a posição canônica não muda com o sentido
})

test('2. 1440 px, Direção ordenável: sem medida abaixo do divisor, nenhum 0% inventado', async ({ page }) => {
  await abrir(page, D1440)
  await expect(page.getByTestId('canais-th-direcao').locator('visible=true').first().locator('button')).toBeVisible()
  await ordenarPelaColuna(page, 'direcao')
  expect(param(page, 'sort')).toBe('direcao')
  expect(param(page, 'dir')).not.toBe('asc') // o primeiro clique abre com quem mais sobe
  const divisor = page.locator(`${S}:visible tbody tr.group[data-divisor]`).first()
  await expect(divisor).toContainText('Ainda sem medida para ordenar')
  const abaixo = await page.evaluate(() => {
    const raiz = [...document.querySelectorAll('[data-obs-screen="canais"]')].find(e => e.getClientRects().length > 0)!
    const trs = [...raiz.querySelectorAll<HTMLElement>('tbody tr')]
    const i = trs.findIndex(t => t.hasAttribute('data-divisor'))
    return { antes: trs.slice(0, i).filter(t => t.classList.contains('row')).map(t => t.querySelector('td[data-col="direcao"]')?.textContent?.trim() ?? ''),
             depois: trs.slice(i + 1).filter(t => t.classList.contains('row')).map(t => t.querySelector('td[data-col="direcao"]')?.textContent?.trim() ?? '') }
  })
  expect(abaixo.depois.length, 'Canal Teste A e B (pouco registro) ficam abaixo do divisor').toBeGreaterThanOrEqual(2)
  for (const t of abaixo.depois) expect(t).not.toMatch(/^[+−-]?\s*0\s*%/)
  for (const t of abaixo.antes) expect(t, 'acima do divisor só há Direção medida').not.toMatch(/não medido|pouco registro|canal próprio/i)
  await expect(linhaDe(page, NOME_A)).toBeVisible()
  const ls = await linhas(page)
  const nomes = ls.map(l => l.nome)
  expect(nomes.findIndex(n => n.includes(NOME_A))).toBeLessThan(nomes.findIndex(n => n.includes(NOME_B)))
})

test('3. Sem variação: célula e dica no hover', async ({ page }) => {
  await abrir(page, D1440)
  await ordenarPelaColuna(page, 'growth')
  // o canal da semente que cai dentro do arredondamento: o Crescimento de A e B é +10.000 em 290.000 (3,4%): medido. Para "sem variação" o spec procura
  // qualquer célula assim na lista; se a semente não tiver nenhuma, o caso reprova e o Gio ajusta a semente (não o texto).
  const celula = page.locator(`${S}:visible tbody td[data-col="growth"]`).filter({ hasText: 'sem variação' }).first()
  await expect(celula, 'a semente precisa de um canal dentro do arredondamento').toBeVisible()
  await expect(celula).toContainText(/dentro do arredondamento \(±/)
  await celula.locator('.cdica').first().hover()
  const tip = page.getByRole('tooltip').first()
  await expect(tip).toBeVisible()
  await expect(tip).toContainText(DICA_SEM_VARIACAO)
  await expect(tip).toContainText(DICA_SEM_VARIACAO_FIM)
})

test('4. Dica por célula no teclado: Tab abre, Esc fecha, nenhum title nas células de valor', async ({ page }) => {
  await abrir(page, D1440)
  await ordenarPelaColuna(page, 'vpd')
  expect(await page.locator(`${S}:visible td[data-col] [title]`).count()).toBe(0)
  const dica = page.locator(`${S}:visible tbody td[data-col="vpd"] .cdica`).first()
  await dica.focus()
  await expect(page.getByRole('tooltip').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
})

test('5. Clicar na dica não abre o painel; clicar no nome abre', async ({ page }) => {
  await abrir(page, D1440)
  const dica = page.locator(`${S}:visible tbody td[data-col="vpd"] .cdica`).first()
  await dica.click()
  await page.waitForTimeout(400)
  expect(param(page, 'channel'), 'a dica não abre o painel').toBeNull()
  await linhaDe(page, NOME_A).locator('td:nth-child(2) a').first().click()
  await expect.poll(() => param(page, 'channel'), { timeout: 10_000 }).not.toBeNull()
})

test('6. 390 px: barra presa, Direção inverte, Trocas visível, alvos, dica abre e fecha, caixa dentro da janela', async ({ page }) => {
  await abrir(page, D390)
  const barra = page.getByTestId('canais-sortbar').locator('visible=true').first()
  await expect(barra).toBeVisible()
  // presa logo abaixo da barra do topo depois de rolar 2.000 px (não em 0: com `top: 0` ficaria por baixo dela)
  await rolarPara(page, 2000)
  await page.waitForTimeout(300)
  const topo = await caixa(page.locator('.cms-topbar').first())
  const b0 = await caixa(barra)
  expect(Math.abs(b0.y - topo.bottom), `barra y=${b0.y} vs bottom da barra do topo=${topo.bottom}`).toBeLessThanOrEqual(1)
  await rolarPara(page, 0)
  // Direção ordena; de novo inverte
  await barra.getByRole('button', { name: /^Direção/ }).click()
  await assentou(page)
  expect(param(page, 'sort')).toBe('direcao')
  await expect(barra.getByRole('button', { name: 'Direção, maior primeiro' })).toBeVisible()
  await barra.getByRole('button', { name: /^Direção/ }).click()
  await assentou(page)
  await expect(barra.getByRole('button', { name: 'Direção, menor primeiro' })).toBeVisible()
  // Trocas inteiramente dentro da barra; barra com no máximo 2 linhas (<= 112 px)
  await barra.getByRole('button', { name: /^Trocas/ }).click()
  await assentou(page)
  const bt = await caixa(barra.getByRole('button', { name: /^Trocas/ }))
  const bb = await caixa(barra)
  expect(bt.x).toBeGreaterThanOrEqual(bb.x - 0.5); expect(bt.right).toBeLessThanOrEqual(bb.right + 0.5)
  expect(bt.y).toBeGreaterThanOrEqual(bb.y - 0.5); expect(bt.bottom).toBeLessThanOrEqual(bb.bottom + 0.5)
  expect(bb.h, 'altura da barra (<= 112 px; se passar, devolver ao controlador)').toBeLessThanOrEqual(112)
  // alvo de toque de cada botão >= 44 px de altura (Naksu A2)
  for (const bot of await barra.getByRole('button').all()) expect((await caixa(bot)).h).toBeGreaterThanOrEqual(44)
  // células com dica: alvo >= 44 px (A8); tocar abre, de novo fecha, fora fecha; a caixa cabe nos 390 px na 1ª e na última coluna do cartão
  const cartao = page.locator(`${S}:visible .cards article`).first()
  const dicas = cartao.locator('.cdica')
  const n = await dicas.count()
  expect(n).toBeGreaterThan(1)
  for (const i of [0, n - 1]) {
    const d = dicas.nth(i)
    await d.scrollIntoViewIfNeeded()
    expect((await caixa(d)).h, 'alvo da dica').toBeGreaterThanOrEqual(44)
    await d.tap()
    const tip = page.getByRole('tooltip').first()
    await expect(tip).toBeVisible()
    const t = await caixa(tip)
    expect(t.x).toBeGreaterThanOrEqual(0); expect(t.x + t.w).toBeLessThanOrEqual(390)
    await d.tap() // a mesma dica de novo fecha (Naksu A6)
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    await d.tap()
    await expect(tip).toBeVisible()
    await page.locator(`${S}:visible .toolbar`).first().tap({ position: { x: 4, y: 4 } }) // fora fecha
    await expect(page.getByRole('tooltip')).toHaveCount(0)
  }
  // sem rolagem horizontal da página
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('7. Faixa do seu canal: Crescimento sem medida, links para Inscritos e Views/dia', async ({ page }) => {
  await abrir(page, D1440, '?sort=growth')
  await assentou(page)
  const faixa = page.getByTestId('canais-faixa').locator('visible=true').first()
  await expect(faixa).toBeVisible()
  await expect(faixa).toContainText('Seu canal ainda não tem Crescimento medido.')
  await expect(faixa).toContainText(FAIXA_SEM_POSICAO)
  await faixa.getByRole('link', { name: 'Ordenar por Inscritos' }).click()
  await expect.poll(() => param(page, 'sort'), { timeout: 10_000 }).toBe('subs')
  await assentou(page)
  await page.goBack()
  await expect.poll(() => param(page, 'sort'), { timeout: 10_000 }).toBe('growth')
  await assentou(page)
  await page.getByTestId('canais-faixa').locator('visible=true').first().getByRole('link', { name: 'Ordenar por Views/dia' }).click()
  await expect.poll(() => param(page, 'sort'), { timeout: 10_000 }).toBe('vpd')
  await expect(tela(page)).toBeVisible()
})

// 8. Regressão: `canais-a3.spec.ts` inteiro, com FAIXA_SEM_POSICAO no lugar do texto antigo (rodar o arquivo à parte).
