// apps/web/e2e/tests/cms/observatorio/comparar-a3.spec.ts
// Teste de fumaça da tela de comparação (A3, tarefa 8; a prova completa é da tarefa 11): a rota abre logada com um par da semente, a tabela tem as
// linhas, trocar o seletor não navega, "Inverter lados" troca os lados, ids ruins na URL não dão 500, sem erro de console, sem rolagem horizontal a
// 1440 e a 390 px. Esta tela não escreve nada; o spec só semeia o banco local e reseta as preferências do visualizador (`resetViewerPrefs`), e todo POST de server action é abortado e reprova o teste. As medidas vão para test-results/comparar-a3-medidas.txt.
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STATE, ensureSeeded, seedIdsOf, THEMES } from './fidelity'
import { resetViewerPrefs } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

test.use({ storageState: ADMIN_STATE })
let ids: ReturnType<typeof seedIdsOf>
const MEDIDAS = path.resolve(__dirname, '../../../../test-results/comparar-a3-medidas.txt')
const SEED2 = { ownPreset: '2' as const, canalCompleto: true }
test.beforeAll(async () => {
  test.setTimeout(240_000)
  ids = seedIdsOf(await ensureSeeded(SEED2))
  fs.mkdirSync(path.dirname(MEDIDAS), { recursive: true })
})
function medida(texto: string): void {
  fs.appendFileSync(MEDIDAS, `[${test.info().title.slice(0, 60)}] ${texto}\n`)
  test.info().annotations.push({ type: 'medida', description: texto })
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const S = '[data-obs-screen="comparar"]'
const ROTA = '/cms/youtube/competitors/comparar'
const VP = { w1440: { width: 1440, height: 900 }, w390: { width: 390, height: 844 } } as const
let intrusos: string[] = [], erros: string[] = [], cincoXX: string[] = [], navegacoes: string[] = [], rsc: string[] = []
test.beforeEach(async ({ page }) => {
  test.setTimeout(150_000)
  intrusos = []; erros = []; cincoXX = []; navegacoes = []; rsc = []
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
  // pedidos de DOCUMENTO (recarga ou navegação de verdade); replaceState não gera nenhum
  page.on('request', r => { if (r.resourceType() === 'document') navegacoes.push(r.url()) })
  page.on('request', r => { if (/[?&]_rsc=/.test(r.url()) || r.headers()['rsc']) rsc.push(r.url()) })
  await page.addInitScript(() => {
    // o contêiner que rola: a casca do CMS rola em `main`, não na janela; a raiz é a tela VISÍVEL (depois do Voltar a árvore antiga fica escondida)
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
test.afterAll(async () => { await resetViewerPrefs(await getSeedSiteId()) })
test.afterEach(() => {
  if (intrusos.length) throw new Error(`Server action INESPERADA abortada (nada chegou ao servidor): ${intrusos.length}. Primeira: ${intrusos[0]}`)
  expect(cincoXX, 'respostas 5xx').toEqual([])
  expect(erros, 'erros de console').toEqual([])
})

const OWN = () => ids.own('tnfigueiredo')
const LEO = () => ids.channel('leo-khev')
const par = (a: string, b: string) => `${ROTA}?a=${a}&b=${b}`
const tela = (page: Page) => page.locator(`${S}:visible`).first()
const param = (page: Page, k: string) => new URL(page.url()).searchParams.get(k)
const selA = (page: Page) => tela(page).locator('.cp-side[data-lado="A"] select')
const selB = (page: Page) => tela(page).locator('.cp-side[data-lado="B"] select')

/** Abre a rota, espera a tela e a hidratação (cliques antes dela se perdem) e tira o indicador do `next dev` do caminho. */
async function abrir(page: Page, url: string, size: { width: number; height: number } = VP.w1440): Promise<number> {
  await page.setViewportSize(size)
  const resp = await page.goto(url)
  await tela(page).locator('h1').waitFor({ timeout: 60_000 })
  await tela(page).locator('table').waitFor({ timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
  await page.evaluate(() => { (window as unknown as { __viva: boolean }).__viva = true }) // some se a página recarregar
  return resp?.status() ?? 0
}
/** Rolagem horizontal: do documento e de todo ancestral da tela (a casca do CMS rola em `main`). */
const rolaNaHorizontal = (page: Page) => page.evaluate(() => {
  const raiz = [...document.querySelectorAll('[data-obs-screen="comparar"]')].find(e => e.getClientRects().length > 0)!
  const out: string[] = []
  const olhar = (e: Element, nome: string) => { if (e.scrollWidth > e.clientWidth + 1) out.push(`${nome}: ${e.scrollWidth} > ${e.clientWidth}`) }
  olhar(document.documentElement, 'html'); olhar(document.body, 'body')
  for (let p: Element | null = raiz; p && p !== document.body; p = p.parentElement) olhar(p, p.tagName.toLowerCase() + '.' + (p.className || '').toString().slice(0, 30))
  return out
})
const linhas = (page: Page) => tela(page).locator('tbody tr:not(.grp)')
const nomesDosLados = (page: Page) => tela(page).locator('.cp-side h2').allTextContents()

test('a rota abre logada com um par da semente: tabela com as linhas, lados certos, sem rolagem horizontal a 1440 px', async ({ page }) => {
  const t0 = Date.now()
  const status = await abrir(page, par(OWN(), LEO()))
  expect(status).toBe(200)
  medida(`abrir a rota: ${Date.now() - t0} ms`)
  await expect(tela(page).locator('h1')).toHaveText('Comparar canais')
  expect(await nomesDosLados(page)).toEqual(expect.arrayContaining(['tnFigueiredo']))
  expect(await nomesDosLados(page)).toHaveLength(2)
  expect(await linhas(page).count()).toBeGreaterThanOrEqual(6)
  await expect(tela(page).locator('table caption')).toHaveCount(1)
  await expect(tela(page).getByRole('heading', { name: 'Leitura rápida' })).toBeVisible()
  expect(await rolaNaHorizontal(page), 'rolagem horizontal a 1440 px').toEqual([])
  medida(`linhas da tabela: ${await linhas(page).count()}; réguas: ${await tela(page).locator('[role="group"][aria-label^="Posição em"]').count()}`)
  // o título do documento e o foco na abertura
  expect(await page.title()).toContain('Comparar')
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H1')
  const px = await page.evaluate(() => { const e = document.querySelector('[data-obs-screen="comparar"]')!.getBoundingClientRect(); return { w: Math.round(e.width), h: Math.round(e.height) } })
  medida(`tela a 1440 px: ${px.w} x ${px.h}`)
  await page.screenshot({ path: path.resolve(__dirname, '../../../../test-results/comparar-1440.png'), fullPage: false })
})

test('o tamanho do que chega ao navegador: a resposta do documento da rota (cru e com gzip)', async ({ page }) => {
  await page.setViewportSize(VP.w1440)
  const resp = await page.goto(par(OWN(), LEO()))
  const corpo = await resp!.body()
  await tela(page).locator('table').waitFor({ timeout: 60_000 })
  medida(`documento da rota com o pacote da semente: ${(corpo.length / 1024).toFixed(1)} KB sem compressão, ${(gzipSync(corpo).length / 1024).toFixed(1)} KB com gzip`)
  expect(gzipSync(corpo).length).toBeLessThan(250 * 1024)
})

test('trocar o seletor não navega: a tabela, a URL e o título mudam; nenhuma requisição ao servidor', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()))
  const antes = navegacoes.length, rscAntes = rsc.length
  const outro = ids.channel('nate-herk')
  const t0 = Date.now()
  await selB(page).focus() // o usuário chega ao seletor com o foco antes de escolher
  await selB(page).selectOption(outro)
  await expect(tela(page).locator('thead th.cB')).toContainText('Nate Herk')
  medida(`trocar o seletor até a tabela mudar: ${Date.now() - t0} ms`)
  expect(param(page, 'b')).toBe(outro); expect(param(page, 'a')).toBe(OWN())
  expect(await page.title()).toContain('Nate Herk')
  await expect(tela(page).locator('[role="status"]')).toContainText('Comparando')
  expect(navegacoes.length, 'pedidos de documento').toBe(antes)
  expect(await page.evaluate(() => (window as unknown as { __viva?: boolean }).__viva), 'a página não recarregou').toBe(true)
  expect(rsc.length, 'requisições RSC').toBe(rscAntes)
  // o canal do outro lado está desabilitado, e o foco continua no seletor
  expect(await selA(page).locator(`option[value="${outro}"]`).isDisabled()).toBe(true)
  await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLSelectElement | null)?.id)).toBe(await selB(page).getAttribute('id'))
  expect(await rolaNaHorizontal(page)).toEqual([])
})

test('"Inverter lados" troca os lados na tela e na URL; o canal próprio continua com a cor dele', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()))
  const cor = (lado: 'A' | 'B') => tela(page).locator(`.cp-side[data-lado="${lado}"]`).getAttribute('data-cor')
  expect(await cor('A')).toBe('o')
  const antes = navegacoes.length
  await tela(page).getByRole('button', { name: /Inverter lados/ }).click()
  await expect(tela(page).locator('thead th.cA')).toContainText('Leo')
  expect(param(page, 'a')).toBe(LEO()); expect(param(page, 'b')).toBe(OWN())
  expect(await cor('B')).toBe('o'); expect(await cor('A')).toBe('b')
  expect(navegacoes.length).toBe(antes)
  expect(await page.evaluate(() => (window as unknown as { __viva?: boolean }).__viva)).toBe(true)
  await tela(page).getByRole('button', { name: /Inverter lados/ }).click()
  expect(param(page, 'a')).toBe(OWN())
})

test('a e b ruins na URL (outro site, inventado, maiúsculas, iguais, ausentes) abrem sem 500, no par padrão, e a URL é reescrita', async ({ page }) => {
  const casos: Array<[string, string]> = [
    ['id de outro site', `${ROTA}?a=7c9e6679-7425-40de-944b-e07fc1f90ae7&b=0b8f4a5e-7425-40de-944b-e07fc1f90ae7`],
    ['inventado', `${ROTA}?a=nao-existe&b=tambem-nao`],
    ['maiúsculas', `${ROTA}?a=${OWN().toUpperCase()}&b=${LEO().toUpperCase()}`],
    ['a igual a b', `${ROTA}?a=${LEO()}&b=${LEO()}`],
    ['ausentes', ROTA],
    ['só b', `${ROTA}?b=${LEO()}`],
  ]
  for (const [nome, url] of casos) {
    const status = await abrir(page, url)
    expect(status, nome).toBe(200)
    expect(await linhas(page).count(), nome).toBeGreaterThan(3)
    const a = await selA(page).inputValue(), b = await selB(page).inputValue()
    expect(a, nome).not.toBe(b)
    await expect.poll(() => param(page, 'a'), { message: nome }).toBe(a)
    expect(param(page, 'b'), nome).toBe(b)
    if (nome === 'a igual a b') expect(a).toBe(LEO())
    if (nome === 'só b') { expect(a).toBe(OWN()); expect(b).toBe(LEO()) }
  }
})

test('a 390 px a tabela vira pilha e a página não rola na horizontal', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()), VP.w390)
  expect(await rolaNaHorizontal(page), 'rolagem horizontal a 390 px').toEqual([])
  const linha = linhas(page).first()
  expect(await linha.evaluate(e => getComputedStyle(e).display)).toBe('grid')
  expect(await tela(page).locator('thead th.cR').evaluate(e => e.getBoundingClientRect().width)).toBeLessThanOrEqual(2)
  // os dois cartões empilham
  const [a, b] = await tela(page).locator('.cp-side').evaluateAll(es => es.map(e => { const r = e.getBoundingClientRect(); return { y: Math.round(r.top), w: Math.round(r.width) } }))
  expect(b!.y).toBeGreaterThan(a!.y)
  medida(`a 390 px: cartões ${a!.w} px de largura; primeira linha da tabela em display grid`)
  await page.screenshot({ path: path.resolve(__dirname, '../../../../test-results/comparar-390.png'), fullPage: false })
  await tela(page).getByRole('button', { name: /Inverter lados/ }).click()
  expect(await rolaNaHorizontal(page)).toEqual([])
})

/* ------------------------------------------------------------------------------------------------------------------------------
   Tarefa 9: os cinco mais vistos, a publicação em 90 dias e o cartão da forja "ainda não disponível" (fumaça; a prova completa é da tarefa 11). */
const secao = (page: Page, nome: string) => tela(page).getByRole('heading', { level: 2, name: nome }).locator('xpath=ancestor::section[1]')

test('os três blocos novos aparecem com o par da semente, na ordem certa, e o cartão da forja fica no fim', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()))
  const mv = secao(page, 'Os 5 vídeos mais vistos de cada canal'), pub = secao(page, 'Publicação nos últimos 90 dias')
  await expect(mv).toBeVisible(); await expect(pub).toBeVisible()
  const cartao = tela(page).getByRole('region', { name: 'Leitura da forja' })
  await expect(cartao).toBeVisible()
  expect(await mv.locator('.cp-vc').count()).toBe(2)
  expect(await mv.locator('.cp-t5 a').count()).toBeGreaterThan(0)
  expect(await pub.locator('.cp-strip').count() + await pub.locator('.cp-pv').count(), 'uma faixa ou uma frase por canal').toBe(2)
  expect(await pub.locator('.cp-axis span').allTextContents()).toHaveLength(4)
  // a ordem na página: Número a número, mais vistos, publicação, forja (o cartão é o último filho da tela)
  const ys = await tela(page).evaluate(e => ['Número a número', 'Os 5 vídeos mais vistos de cada canal', 'Publicação nos últimos 90 dias'].map(t => [...e.querySelectorAll('h2')].find(h => h.textContent!.startsWith(t))!.getBoundingClientRect().top))
  expect(ys[0]! < ys[1]! && ys[1]! < ys[2]!).toBe(true)
  expect(await tela(page).evaluate(e => (e.lastElementChild as HTMLElement).getAttribute('aria-labelledby') != null && e.lastElementChild!.tagName === 'SECTION')).toBe(true)
  const traços = await pub.locator('.cp-strip').first().evaluate(e => ({ n: e.querySelectorAll('i.t').length, aria: e.getAttribute('aria-label'), role: e.getAttribute('role') }))
  expect(traços.role).toBe('img'); expect(traços.aria!.length).toBeGreaterThan(20)
  medida(`mais vistos: ${await mv.locator('.cp-t5 a').count()} links; publicação: ${await pub.locator('.cp-strip i.t').count()} traços`)
  expect(await rolaNaHorizontal(page), 'rolagem horizontal a 1440 px').toEqual([])
  await mv.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.resolve(__dirname, '../../../../test-results/comparar-blocos-1440.png') })
})

test('um vídeo dos mais vistos abre o Histórico do vídeo e o Voltar devolve a comparação com o MESMO par', async ({ page }) => {
  const outro = ids.channel('nate-herk')
  await abrir(page, par(OWN(), outro))
  const mv = secao(page, 'Os 5 vídeos mais vistos de cada canal')
  // os links dos dois lados vão ao Histórico, com a origem "comparar" e o back da comparação
  const hrefs = await mv.locator('.cp-t5 a').evaluateAll(es => es.map(e => e.getAttribute('href')!))
  expect(hrefs.length).toBeGreaterThan(1)
  for (const h of hrefs) {
    const u = new URL(h, 'http://x')
    expect(u.pathname).toMatch(/\/competitors\/video\//)
    expect(u.searchParams.get('from')).toBe('comparar')
    expect(u.searchParams.get('back')).toBe(`?a=${OWN()}&b=${outro}`)
  }
  const doB = mv.locator('.cp-vc').nth(1).locator('.cp-t5 a').first()
  await doB.click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 60_000 })
  // a trilha do Histórico diz de onde veio e o item "Comparar canais" volta ao mesmo par
  const crumb = page.getByRole('navigation').getByRole('link', { name: 'Comparar canais' }).first()
  await expect(crumb).toBeVisible()
  const hc = new URL((await crumb.getAttribute('href'))!, 'http://x')
  expect(hc.pathname).toBe(ROTA); expect(hc.searchParams.get('a')).toBe(OWN()); expect(hc.searchParams.get('b')).toBe(outro)
  // o Voltar do navegador
  await page.goBack()
  await tela(page).locator('table').waitFor({ timeout: 60_000 })
  expect(new URL(page.url()).pathname).toBe(ROTA)
  expect(param(page, 'a')).toBe(OWN()); expect(param(page, 'b')).toBe(outro)
  expect(await nomesDosLados(page)).toHaveLength(2)
  // e pela trilha
  await mv.locator('.cp-vc').nth(1).locator('.cp-t5 a').first().click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await page.getByRole('navigation').getByRole('link', { name: 'Comparar canais' }).first().click()
  await tela(page).locator('table').waitFor({ timeout: 60_000 })
  expect(param(page, 'a')).toBe(OWN()); expect(param(page, 'b')).toBe(outro)
})

test('o botão apagado da forja é focável, não faz requisição nenhuma e a tela continua a mesma', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()))
  const botao = tela(page).getByRole('button', { name: /Pedir leitura desta comparação à forja/ })
  await botao.scrollIntoViewIfNeeded()
  await expect(botao).toHaveAttribute('aria-disabled', 'true')
  const porque = await botao.getAttribute('aria-describedby')
  await expect(page.locator(`#${porque}`)).toContainText('Ainda não dá')
  const pedidos: string[] = []
  page.on('request', r => { if (!/^data:/.test(r.url())) pedidos.push(`${r.method()} ${r.resourceType()} ${r.url().slice(0, 100)}`) })
  await botao.focus()
  await expect(botao).toBeFocused()
  await botao.click({ force: true }) /* o Playwright trata aria-disabled como desabilitado: força o clique de mouse de verdade */; await page.keyboard.press('Enter'); await page.keyboard.press('Space')
  await page.waitForTimeout(600)
  expect(pedidos, 'requisições depois dos cliques').toEqual([])
  expect(await tela(page).getByRole('region', { name: 'Leitura da forja' }).locator('ol, [aria-current="step"]').count()).toBe(0)
  expect(param(page, 'a')).toBe(OWN())
  // concorrente × concorrente: o mesmo cartão, sem "para o seu canal"
  await selA(page).selectOption(ids.channel('nate-herk'))
  await expect(tela(page).getByRole('region', { name: 'Leitura da forja' })).not.toContainText('para o seu canal')
  await expect(botao).toHaveAttribute('aria-disabled', 'true')
})

for (const [nome, vp] of [['1440', VP.w1440], ['390', VP.w390]] as const) {
  test(`os blocos novos não criam rolagem horizontal a ${nome} px`, async ({ page }) => {
    await abrir(page, par(OWN(), LEO()), vp)
    await secao(page, 'Publicação nos últimos 90 dias').scrollIntoViewIfNeeded()
    expect(await rolaNaHorizontal(page), `rolagem horizontal a ${nome} px`).toEqual([])
    await tela(page).getByRole('region', { name: 'Leitura da forja' }).scrollIntoViewIfNeeded()
    expect(await rolaNaHorizontal(page)).toEqual([])
    if (nome === '390') {
      // as colunas dos mais vistos empilham
      const ys = await secao(page, 'Os 5 vídeos mais vistos de cada canal').locator('.cp-vc').evaluateAll(es => es.map(e => Math.round(e.getBoundingClientRect().top)))
      expect(ys[1]!).toBeGreaterThan(ys[0]!)
    }
    await page.screenshot({ path: path.resolve(__dirname, `../../../../test-results/comparar-blocos-${nome}.png`) })
  })
}

/* ------------------------------------------------------------------------------------------------------------------------------
   Consertos da revisão da Tarefa 8 (fumaça no navegador). */
const LISTA = '/cms/youtube/competitors'
const temAB = (url: string) => { const q = new URL(url).searchParams; return q.has('a') || q.has('b') }

test('Voltar para fora da comparação não escreve a e b na URL de destino (lista de Canais); Avançar devolve a comparação com o par escolhido', async ({ page }) => {
  await page.setViewportSize(VP.w1440)
  await page.goto(`${LISTA}?fmt=longos`)
  await page.waitForLoadState('networkidle')
  // a entrada de verdade (A3 Tarefa 10): o clique em "Comparar" da linha de Leo Khev. A tela precisa estar hidratada (o clique antes dela seria uma navegação de documento).
  await page.locator('[data-obs-screen="canais"] .toolbar:visible').first().waitFor({ timeout: 60_000 })
  await page.evaluate(() => { (window as unknown as { __mole: boolean }).__mole = true })
  await page.locator(`[data-obs-screen="canais"]:visible a[data-comparar="${LEO()}"]`).first().click()
  await page.waitForURL(u => u.pathname === ROTA, { timeout: 60_000 })
  expect(param(page, 'a')).toBe(OWN()); expect(param(page, 'b')).toBe(LEO())
  expect(await page.evaluate(() => (window as unknown as { __mole?: boolean }).__mole), 'a entrada foi navegação do cliente').toBe(true)
  await tela(page).locator('table').waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => { (window as unknown as { __viva: boolean }).__viva = true })
  const outro = ids.channel('nate-herk')
  await selB(page).selectOption(outro)
  await expect.poll(() => param(page, 'b')).toBe(outro)
  // o Next reescreve a URL do destino por conta própria e apaga o estrago depois; por isso a prova olha as ESCRITAS, não só a URL final
  await page.evaluate(() => {
    const w = window as unknown as { __escritas: string[] }
    w.__escritas = []
    const original = window.history.replaceState.bind(window.history)
    window.history.replaceState = (estado: unknown, titulo: string, url?: string | URL | null) => { w.__escritas.push(String(url ?? '')); original(estado, titulo, url) }
  })
  await page.goBack()
  await page.waitForURL(u => u.pathname === LISTA, { timeout: 30_000 })
  await page.waitForTimeout(800) // o popstate chega com a tela ainda montada; deixa qualquer escrita indevida acontecer
  const escritas = await page.evaluate(() => (window as unknown as { __escritas: string[] }).__escritas)
  medida(`escritas na URL durante o Voltar: ${JSON.stringify(escritas)}`)
  expect(escritas.filter(u => /[?&](a|b)=/.test(u)), `escritas na URL durante o Voltar: ${JSON.stringify(escritas)}`).toEqual([])
  expect(temAB(page.url()), `a lista de Canais não pode ganhar a nem b: ${page.url()}`).toBe(false)
  expect(new URL(page.url()).searchParams.get('fmt')).toBe('longos')
  expect(await page.evaluate(() => (window as unknown as { __viva?: boolean }).__viva), 'foi navegação do cliente, sem recarregar').toBe(true)
  await page.goForward()
  await tela(page).locator('table').waitFor({ timeout: 60_000 })
  expect(new URL(page.url()).pathname).toBe(ROTA)
  expect(param(page, 'a')).toBe(OWN()); expect(param(page, 'b')).toBe(outro)
  await expect(tela(page).locator('thead th.cB')).toContainText('Nate Herk')
})

test('a 390 px cada valor da tabela diz de que lado é (letra A ou B no chip da cor do lado), e a 1440 px o rótulo não aparece', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()), VP.w390)
  const rotulos = tela(page).locator('tbody tr:not(.grp) td.cA .cp-lb:visible')
  const n = await linhas(page).count()
  expect(await rotulos.count(), 'um rótulo A por linha').toBe(n)
  expect(await tela(page).locator('tbody tr:not(.grp) td.cB .cp-lb:visible').count(), 'um rótulo B por linha').toBe(n)
  const ult = linhas(page).last()
  await ult.scrollIntoViewIfNeeded()
  const medida390 = await ult.locator('td.cA .cp-lb').evaluate(e => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { fundo: cs.backgroundColor, w: Math.round(r.width), h: Math.round(r.height), tamanho: cs.fontSize, texto: e.textContent } })
  expect(medida390.texto).toBe('A'); expect(medida390.fundo).not.toBe('rgba(0, 0, 0, 0)'); expect(parseFloat(medida390.tamanho)).toBeGreaterThanOrEqual(12)
  medida(`rótulo do lado a 390 px: chip ${medida390.w} x ${medida390.h}, fundo ${medida390.fundo}`)
  expect(await rolaNaHorizontal(page)).toEqual([])
  await page.screenshot({ path: path.resolve(__dirname, '../../../../test-results/comparar-rotulo-390.png') })
  await page.setViewportSize(VP.w1440)
  expect(await tela(page).locator('tbody tr:not(.grp) .cp-lb:visible').count(), 'a 1440 px o rótulo some').toBe(0)
})

/* ------------------------------------------------------------------------------------------------------------------------------
   A3 Tarefa 10: as entradas pela página do canal do concorrente e o atalho "Meu canal" na trilha. */
const CANAL = '/cms/youtube/competitors/canal'
const doCanal = (page: Page) => page.locator('[data-obs-screen="canal"]:visible')
const aberturaDoCanal = async (page: Page, id: string, size: { width: number; height: number } = VP.w1440) => {
  await page.setViewportSize(size)
  await page.goto(`${CANAL}/${id}`)
  await doCanal(page).locator('h1').first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
}
const retangulo = (l: import('@playwright/test').Locator) => l.evaluate(e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) } })

test('"Comparar com o meu canal" no cabeçalho do concorrente: ao lado de "Abrir no YouTube", fora do menu ⋯, abre a comparação com o par certo e o Voltar devolve o canal com o foco no botão', async ({ page }) => {
  await aberturaDoCanal(page, LEO())
  const b = doCanal(page).locator('[data-comparar-canal]')
  await expect(b).toHaveText('Comparar com o meu canal')
  await expect(b).toHaveAttribute('href', `${ROTA}?a=${OWN()}&b=${LEO()}`)
  const abrir = doCanal(page).locator('.acts a', { hasText: 'Abrir no YouTube' })
  const cb = await retangulo(b), ca = await retangulo(abrir), cab = await retangulo(doCanal(page).locator('header.chead'))
  medida(`cabeçalho do concorrente a 1440 px: altura ${cab.h} px (teto 150); "Comparar com o meu canal" ${cb.w} x ${cb.h} em x ${cb.x}; "Abrir no YouTube" em x ${ca.x}`)
  expect(cb.r, 'o botão fica ao lado esquerdo de "Abrir no YouTube"').toBeLessThanOrEqual(ca.x + 1)
  expect(Math.abs(cb.y - ca.y), 'na mesma linha').toBeLessThanOrEqual(2)
  expect(cab.h, 'o cabeçalho continua com até 150 px').toBeLessThanOrEqual(150)
  // fora do menu ⋯
  await doCanal(page).getByRole('button', { name: 'Ações do canal' }).click()
  const menu = page.locator('#flut [role="menu"]').first()
  await expect(menu).toBeVisible()
  await expect(menu).not.toContainText('Comparar')
  await page.keyboard.press('Escape')
  // a entrada de verdade
  await page.evaluate(() => { (window as unknown as { __mole: boolean }).__mole = true })
  await b.click()
  await page.waitForURL(u => u.pathname === ROTA, { timeout: 60_000 })
  expect(param(page, 'a')).toBe(OWN()); expect(param(page, 'b')).toBe(LEO())
  await tela(page).locator('table').waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.goBack()
  await page.waitForURL(u => u.pathname === `${CANAL}/${LEO()}`, { timeout: 30_000 })
  await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.hasAttribute('data-comparar-canal') ?? false), { timeout: 20_000, message: 'o foco volta ao botão do cabeçalho' }).toBe(true)
  expect(await page.evaluate(() => (window as unknown as { __mole?: boolean }).__mole), 'navegação do cliente').toBe(true)
})

test('o cabeçalho do concorrente a 390 px: o botão "Comparar com o meu canal" cabe, o cabeçalho continua dentro da janela e a página não rola na horizontal', async ({ page }) => {
  await aberturaDoCanal(page, LEO(), VP.w390)
  const b = doCanal(page).locator('[data-comparar-canal]')
  await expect(b).toBeVisible()
  const cb = await retangulo(b), cab = await retangulo(doCanal(page).locator('header.chead'))
  medida(`cabeçalho do concorrente a 390 px: altura ${cab.h} px; botão ${cb.w} x ${cb.h} em x ${cb.x}..${cb.r}`)
  expect(cb.r).toBeLessThanOrEqual(390); expect(cb.x).toBeGreaterThanOrEqual(0)
  expect(await page.evaluate(() => { const raiz = document.querySelector('[data-obs-screen="canal"]')!; const out: string[] = []; for (let p: Element | null = raiz; p && p !== document.body; p = p.parentElement) if (p.scrollWidth > p.clientWidth + 1) out.push(p.tagName + '.' + String(p.className).slice(0, 20) + ' ' + p.scrollWidth + '>' + p.clientWidth); if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) out.push('html'); return out }), 'rolagem horizontal').toEqual([])
  await page.screenshot({ path: path.resolve(__dirname, '../../../../test-results/canal-comparar-390.png') })
})

/** A trilha ("Canais › X", o atalho, o pager do Histórico, a nota de fuso): nada se sobrepõe nem sai da janela. */
async function medirTrilha(page: Page, largura: number) {
  const top = page.locator('.obs-tr-top:visible').first()
  const partes = {
    trilha: await retangulo(top.locator('nav.crumbs')),
    atalho: await retangulo(top.locator('[data-meu-canal] button')),
    fuso: await retangulo(top.locator('.obs-tr-tz')),
    pager: (await top.locator('.obs-tr-aside').count()) ? await retangulo(top.locator('.obs-tr-aside')) : null,
  }
  const caixas = Object.entries(partes).filter(([, v]) => v != null) as Array<[string, { x: number; y: number; r: number; b: number; w: number; h: number }]>
  const sobrepoe: string[] = []
  for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) {
    const [na, a] = caixas[i]!, [nb, c] = caixas[j]!
    if (a.x < c.r - 1 && c.x < a.r - 1 && a.y < c.b - 1 && c.y < a.b - 1) sobrepoe.push(`${na} x ${nb}`)
  }
  const fora = caixas.filter(([, v]) => v.r > largura + 1 || v.x < -1).map(([n]) => n)
  return { partes, sobrepoe, fora, linha: await retangulo(top) }
}
const semRolagemH = (page: Page) => page.evaluate(() => {
  const raiz = [...document.querySelectorAll('[data-obs-screen]')].find(e => e.getClientRects().length > 0)!
  const out: string[] = []
  for (let p: Element | null = raiz; p && p !== document.body; p = p.parentElement) if (p.scrollWidth > p.clientWidth + 1) out.push(p.tagName.toLowerCase() + '.' + String(p.className).slice(0, 24) + ' ' + p.scrollWidth + '>' + p.clientWidth)
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) out.push('html')
  return out
})
for (const largura of [1440, 390] as const) {
  test(`o atalho "Meu canal" na trilha da página do canal, da comparação e do Histórico do vídeo (com o pager) a ${largura} px: convive com o pager, nada se sobrepõe nem sai da janela, abre, navega e fecha com Esc`, async ({ page }) => {
    const tam = largura === 1440 ? VP.w1440 : VP.w390
    // 1) a página do canal
    await aberturaDoCanal(page, LEO(), tam)
    let m = await medirTrilha(page, largura)
    medida(`${largura} px, canal: linha da trilha ${m.linha.w} x ${m.linha.h}; atalho ${m.partes.atalho.w} x ${m.partes.atalho.h} em x ${m.partes.atalho.x}; sobreposições: ${m.sobrepoe.join(', ') || 'nenhuma'}`)
    expect(m.sobrepoe).toEqual([]); expect(m.fora).toEqual([])
    expect(await semRolagemH(page), 'canal: rolagem horizontal').toEqual([])
    const atalho = page.locator('.obs-tr-top:visible [data-meu-canal] button').first()
    await expect(atalho).toHaveAccessibleName('Meu canal: tnFigueiredo')
    // abre, anda, fecha com Esc devolvendo o foco
    await atalho.click()
    const itens = page.locator('#flut [role="menu"] [role="menuitem"]')
    await expect(itens).toHaveCount(3)
    await expect(itens.nth(0)).toBeFocused()
    const cm = await retangulo(page.locator('#flut [role="menu"]').first())
    expect(cm.x).toBeGreaterThanOrEqual(0); expect(cm.r).toBeLessThanOrEqual(largura)
    await page.keyboard.press('ArrowDown'); await expect(itens.nth(1)).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.locator('#flut [role="menu"]')).toHaveCount(0)
    await expect(atalho).toBeFocused()
    // navega: "Ver meus canais na lista de Canais"
    await atalho.click()
    await page.getByRole('menuitem', { name: 'Ver meus canais na lista de Canais' }).click()
    await page.waitForURL(u => u.pathname === '/cms/youtube/competitors', { timeout: 60_000 })
    // 2) a comparação
    await page.setViewportSize(tam)
    await page.goto(par(OWN(), LEO()))
    await tela(page).locator('table').waitFor({ timeout: 60_000 })
    m = await medirTrilha(page, largura)
    medida(`${largura} px, comparação: linha da trilha ${m.linha.w} x ${m.linha.h}; atalho x ${m.partes.atalho.x}..${m.partes.atalho.r}; sobreposições: ${m.sobrepoe.join(', ') || 'nenhuma'}`)
    expect(m.sobrepoe).toEqual([]); expect(m.fora).toEqual([])
    expect(await rolaNaHorizontal(page), 'comparação: rolagem horizontal').toEqual([])
    // 3) o Histórico do vídeo, a partir da grade do canal (com pager)
    await aberturaDoCanal(page, LEO(), tam)
    await doCanal(page).locator('a[id^="cv-lnk-"]').first().click()
    await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
    await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 60_000 })
    await page.waitForLoadState('networkidle')
    m = await medirTrilha(page, largura)
    medida(`${largura} px, Histórico do vídeo: linha da trilha ${m.linha.w} x ${m.linha.h}; trilha ${JSON.stringify(m.partes.trilha)}; atalho ${JSON.stringify(m.partes.atalho)}; pager ${JSON.stringify(m.partes.pager)}; fuso ${JSON.stringify(m.partes.fuso)}; sobreposições: ${m.sobrepoe.join(', ') || 'nenhuma'}`)
    expect(m.partes.pager, 'o pager do Histórico está na trilha').not.toBeNull()
    expect(m.sobrepoe).toEqual([]); expect(m.fora).toEqual([])
    if (largura === 1440) {
      // numa linha só: trilha, atalho, pager, fuso (da esquerda para a direita), todos na mesma faixa vertical
      expect(m.partes.atalho.x).toBeGreaterThanOrEqual(m.partes.trilha.r - 1)
      expect(m.partes.pager!.x).toBeGreaterThanOrEqual(m.partes.atalho.r - 1)
      expect(m.partes.fuso.x).toBeGreaterThanOrEqual(m.partes.pager!.r - 1)
    }
    expect(await semRolagemH(page), 'Histórico: rolagem horizontal').toEqual([])
    await page.screenshot({ path: path.resolve(__dirname, `../../../../test-results/trilha-atalho-${largura}.png`) })
  })
}

const S_LISTA = '[data-obs-screen="canais"]'

/* ==============================================================================================================================
   A3 Tarefa 11: a prova completa. Abaixo, o que só o navegador mede: URL e histórico, tempo, a tabela "Número a número" (ordem, relação e barra,
   hachura, 390 px), a régua do nicho (posição dos traços, letras, dica na casca que rola em `main`, teclado, toque real), os blocos, a forja,
   larguras, temas, alvos de toque. Mesmo guarda-chuva: todo POST de server action é abortado e reprova o teste; console e 5xx reprovam. */
type Caixa = { x: number; y: number; r: number; b: number; w: number; h: number }
const NOMES_DAS_LINHAS = [
  'Inscritos', 'Inscritos em 30 dias', 'Longos acompanhados', 'Longos publicados em 90 dias', 'Longos + Shorts por semana', 'Dias desde o último vídeo',
  'Mediana de views dos longos', 'Views por dia nos longos', 'Views por dia por mil inscritos', 'Engajamento nos longos', 'Vídeos acima de 2× em 90 dias',
  'Duração mediana dos longos', 'Trocas de título e thumbnail em 30 dias',
] as const
const nomesDasLinhas = (page: Page) => tela(page).locator('tbody tr:not(.grp) th.rl').evaluateAll(es => es.map(e => e.firstChild?.textContent ?? ''))
async function linhaDe(page: Page, nome: string) {
  const i = (await nomesDasLinhas(page)).indexOf(nome)
  expect(i, `a linha "${nome}" existe`).toBeGreaterThanOrEqual(0)
  return linhas(page).nth(i)
}
const rolarMain = (page: Page, top: number) => page.evaluate(t => { (window as unknown as { __sc: () => HTMLElement }).__sc().scrollTop = t }, top)
const caixaDe = (l: import('@playwright/test').Locator): Promise<Caixa> => l.evaluate(e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10, r: Math.round(r.right * 10) / 10, b: Math.round(r.bottom * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 } })
/** Todos os canais do site, como o seletor do lado A os lista (id e nome), na ordem do seletor. */
const todosOsCanais = (page: Page) => selA(page).locator('option').evaluateAll(os => os.map(o => ({ id: (o as HTMLOptionElement).value, nome: (o.textContent ?? '').replace(/ \(sem vídeos\)$/, '') })))
const SHOTS11 = path.resolve(__dirname, '../../../../test-results/comparar-a3')
const foto = (n: string) => { fs.mkdirSync(SHOTS11, { recursive: true }); return path.join(SHOTS11, n) }

/* ------------------------------------------------------------------------------------------------ A3.5: URL, seletor, histórico */
test('A3.5 a URL reproduz o par: recarregar mantém os dois lados (também depois de trocar o seletor e de inverter); a=lixo e a=b abrem no padrão sem erro no console e sem 500', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()))
  const outro = ids.channel('nate-herk')
  await selB(page).selectOption(outro)
  await expect.poll(() => param(page, 'b')).toBe(outro)
  await page.reload()
  await tela(page).locator('table').waitFor({ timeout: 60_000 })
  expect(param(page, 'a')).toBe(OWN()); expect(param(page, 'b')).toBe(outro)
  expect(await selA(page).inputValue()).toBe(OWN()); expect(await selB(page).inputValue()).toBe(outro)
  await expect(tela(page).locator('thead th.cB')).toContainText('Nate Herk')
  await page.waitForLoadState('networkidle')
  await tela(page).getByRole('button', { name: /Inverter lados/ }).click()
  await expect.poll(() => param(page, 'a')).toBe(outro)
  await page.reload()
  await tela(page).locator('table').waitFor({ timeout: 60_000 })
  expect(param(page, 'a')).toBe(outro); expect(param(page, 'b')).toBe(OWN())
  await expect(tela(page).locator('thead th.cA')).toContainText('Nate Herk')
  // a=lixo com b válido: o b é respeitado; a=b: o a vale e o b muda; os dois lixo: o padrão. Nenhum 500, nenhum erro de console.
  const casos: Array<[string, string, (a: string, b: string) => void]> = [
    ['a=lixo&b válido', `${ROTA}?a=lixo&b=${LEO()}`, (a, b) => { expect(b).toBe(LEO()); expect(a).not.toBe(b) }],
    ['a=b', `${ROTA}?a=${LEO()}&b=${LEO()}`, (a, b) => { expect(a).toBe(LEO()); expect(b).not.toBe(a) }],
    ['a e b lixo', `${ROTA}?a=lixo&b=lixo`, (a, b) => { expect(a).toBe(OWN()); expect(b).not.toBe(a) }],
    ['a vazio, b vazio', `${ROTA}?a=&b=`, (a, b) => { expect(a).toBe(OWN()); expect(b).not.toBe(a) }],
    ['parâmetro repetido', `${ROTA}?a=${OWN()}&a=${LEO()}&b=${LEO()}`, (a, b) => { expect(a).not.toBe(b) }],
  ]
  for (const [nome, url, confere] of casos) {
    const status = await abrir(page, url)
    expect(status, nome).toBe(200)
    const a = await selA(page).inputValue(), b = await selB(page).inputValue()
    confere(a, b)
    await expect.poll(() => param(page, 'a'), { message: nome }).toBe(a)
    expect(param(page, 'b'), nome).toBe(b)
    expect(await linhas(page).count(), nome).toBeGreaterThan(3)
    expect(await tela(page).locator('text=/undefined|NaN|Infinity|\\[object/').count(), `${nome}: nada de undefined/NaN/Infinity`).toBe(0)
  }
})

test('A3.5 trocar o seletor e "Inverter lados" não fazem nenhuma requisição (nem de documento nem de RSC) e a tabela muda em menos de 100 ms', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()))
  const canais = await todosOsCanais(page)
  const outros = canais.filter(c => c.id !== OWN()).map(c => c.id)
  const pedidos: string[] = []
  page.on('request', r => { if (!/^data:/.test(r.url())) pedidos.push(`${r.method()} ${r.resourceType()} ${r.url().slice(0, 90)}`) })
  const antes = navegacoes.length, rscAntes = rsc.length
  // mede DENTRO da página: do evento até o fim do mesmo quadro em que a tabela mudou (sem o ida e volta do Playwright)
  await page.evaluate(() => {
    const w = window as unknown as { __tempos: number[]; __ini: number }
    w.__tempos = []
    const raiz = [...document.querySelectorAll('[data-obs-screen="comparar"]')].find(e => e.getClientRects().length > 0)!
    new MutationObserver(() => {
      if (!w.__ini) return
      const ini = w.__ini; w.__ini = 0
      requestAnimationFrame(() => requestAnimationFrame(() => w.__tempos.push(Math.round((performance.now() - ini) * 10) / 10)))
    }).observe(raiz, { childList: true, subtree: true, characterData: true, attributes: true })
    for (const s of raiz.querySelectorAll('select')) s.addEventListener('change', () => { w.__ini = performance.now() }, { capture: true })
    raiz.querySelector('.cp-swap')!.addEventListener('click', () => { w.__ini = performance.now() }, { capture: true })
  })
  const ler = () => page.evaluate(() => (window as unknown as { __tempos: number[] }).__tempos)
  for (let i = 0; i < 6; i++) {
    await selB(page).selectOption(outros[(i + 1) % outros.length]!)
    await expect.poll(async () => (await ler()).length, { timeout: 5_000 }).toBe(i + 1)
  }
  const n0 = (await ler()).length
  await tela(page).getByRole('button', { name: /Inverter lados/ }).click()
  await expect.poll(async () => (await ler()).length).toBe(n0 + 1)
  const tempos = await ler()
  medida(`troca do seletor (6x) e Inverter (1x), do evento ao quadro pintado, dentro da página: ${tempos.join(', ')} ms`)
  expect(Math.max(...tempos), 'cada troca fecha em menos de 100 ms').toBeLessThan(100)
  expect(navegacoes.length, 'nenhum pedido de documento').toBe(antes)
  expect(rsc.length, 'nenhum pedido RSC').toBe(rscAntes)
  expect(pedidos.filter(p => !/image|font|media/.test(p)), 'nenhum pedido de rede').toEqual([])
  expect(await page.evaluate(() => (window as unknown as { __viva?: boolean }).__viva)).toBe(true)
})

test('A3.5 o canal do outro lado está desabilitado no seletor, nos dois lados, para todos os canais, e continua depois de inverter', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()))
  const canais = await todosOsCanais(page)
  expect(canais.length).toBeGreaterThanOrEqual(10)
  for (const c of canais) {
    expect(await selA(page).locator(`option[value="${c.id}"]`).isDisabled(), `${c.nome} no seletor A`).toBe(c.id === LEO())
    expect(await selB(page).locator(`option[value="${c.id}"]`).isDisabled(), `${c.nome} no seletor B`).toBe(c.id === OWN())
  }
  await tela(page).getByRole('button', { name: /Inverter lados/ }).click()
  await expect.poll(() => param(page, 'a')).toBe(LEO())
  expect(await selA(page).locator(`option[value="${OWN()}"]`).isDisabled()).toBe(true)
  expect(await selB(page).locator(`option[value="${LEO()}"]`).isDisabled()).toBe(true)
  expect(await selA(page).locator(`option[value="${LEO()}"]`).isDisabled(), 'o canal do próprio lado não fica desabilitado').toBe(false)
  // os grupos do seletor: "Seus canais" primeiro, depois um grupo por nicho
  const grupos = await selA(page).locator('optgroup').evaluateAll(gs => gs.map(g => (g as HTMLOptGroupElement).label))
  expect(grupos[0]).toBe('Seus canais')
  expect(grupos.slice(1).every(g => /^Concorrentes/.test(g))).toBe(true)
  medida(`grupos do seletor: ${grupos.join(' | ')}`)
})

test('A3.5 Voltar e Avançar com entradas de histórico de verdade percorrem os pares na ordem; sair pelo Voltar não deixa a= nem b= na lista', async ({ page }) => {
  // O app grava o par com replaceState (spec 18.1): trocar o seletor NÃO cria entrada. Entradas por par existem quando a navegação as cria
  // (um link para outro par, o Voltar do Histórico). Aqui: lista -> par 1 -> par 2 -> par 3 por navegação do cliente (o que um link faz).
  const canais = (await (async () => { await abrir(page, par(OWN(), LEO())); return todosOsCanais(page) })()).filter(c => c.id !== OWN())
  const [c1, c2, c3] = [canais[0]!.id, canais[1]!.id, canais[2]!.id]
  await page.goto(`${LISTA}?fmt=longos`)
  await page.locator('[data-obs-screen="canais"] .toolbar:visible').first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => { (window as unknown as { __viva: boolean }).__viva = true })
  const irPara = async (url: string) => {
    await page.evaluate(u => (window as unknown as { next: { router: { push: (u: string) => void } } }).next.router.push(u), url)
    await page.waitForURL(u => u.pathname === ROTA && `${u.search}` === new URL(url, 'http://x').search, { timeout: 60_000 })
    await tela(page).locator('table').waitFor({ timeout: 60_000 })
  }
  await irPara(par(OWN(), c1))
  await page.waitForLoadState('networkidle')
  await irPara(par(OWN(), c2))
  await irPara(par(OWN(), c3))
  const lados = async () => ({ a: await selA(page).inputValue(), b: await selB(page).inputValue() })
  expect(await lados()).toEqual({ a: OWN(), b: c3 })
  // trocar o seletor NÃO cria entrada: o Voltar seguinte volta ao par 2, não ao par escolhido
  await selB(page).selectOption(canais[3]!.id)
  await expect.poll(() => param(page, 'b')).toBe(canais[3]!.id)
  await page.goBack()
  await expect.poll(async () => (await lados()).b, { timeout: 15_000 }).toBe(c2)
  expect(param(page, 'b')).toBe(c2)
  await page.goBack()
  await expect.poll(async () => (await lados()).b, { timeout: 15_000 }).toBe(c1)
  expect(param(page, 'b')).toBe(c1)
  await expect(tela(page).locator('thead th.cB')).toContainText(canais[0]!.nome)
  await page.goForward()
  await expect.poll(async () => (await lados()).b, { timeout: 15_000 }).toBe(c2)
  await page.goForward()
  // a entrada do par 3 foi REESCRITA pelo seletor (replaceState troca a entrada atual): o Avançar traz o par que a pessoa escolheu ali
  await expect.poll(async () => (await lados()).b, { timeout: 15_000 }).toBe(canais[3]!.id)
  expect(await page.evaluate(() => (window as unknown as { __viva?: boolean }).__viva), 'nenhum Voltar ou Avançar recarregou a página').toBe(true)
  // Voltar até fora: a lista, sem a nem b
  await page.goBack(); await page.goBack(); await page.goBack()
  await page.waitForURL(u => u.pathname === LISTA, { timeout: 30_000 })
  await page.waitForTimeout(600)
  expect(temAB(page.url()), `a lista não ganha a nem b: ${page.url()}`).toBe(false)
  expect(await page.evaluate(() => (window as unknown as { __viva?: boolean }).__viva)).toBe(true)
})

/* ------------------------------------------------------------------------------------------------ A3.6: Número a número */
test('A3.6 treze linhas no par completo, na ordem do spec; um par com linhas sem dado nos dois lados não as mostra e o rodapé as conta', async ({ page }) => {
  // dois concorrentes com tudo medido
  await abrir(page, par(LEO(), ids.channel('nate-herk')))
  const nomes = await nomesDasLinhas(page)
  medida(`Leo Khev x Nate Herk: ${nomes.length} linhas`)
  expect(nomes).toEqual([...NOMES_DAS_LINHAS])
  await expect(tela(page).locator('p.cp-n')).not.toContainText('de fora')
  // os três grupos, na ordem
  expect(await tela(page).locator('tbody tr.grp th').allTextContents()).toEqual(['Tamanho', 'Publicação', 'Desempenho'])
  // o canal próprio contra o segundo canal próprio (sem vídeos): as linhas sem dado nos dois lados saem e o rodapé diz quantas
  await abrir(page, par(OWN(), ids.own('tnfigueiredo-en')))
  const nomes2 = await nomesDasLinhas(page)
  const fora = NOMES_DAS_LINHAS.filter(n => !nomes2.includes(n))
  medida(`tnFigueiredo x tnFigueiredo-en: ${nomes2.length} linhas; de fora: ${fora.join(', ')}`)
  expect(nomes2.length).toBeLessThan(13)
  expect(nomes2.length + fora.length).toBe(13)
  expect(nomes2, 'a ordem das que ficam é a mesma').toEqual(NOMES_DAS_LINHAS.filter(n => nomes2.includes(n)))
  const rodape = (await tela(page).locator('p.cp-n').textContent())!
  expect(rodape).toMatch(new RegExp(`${fora.length === 1 ? '1 número ficou' : `${fora.length} números ficaram`} de fora`))
  // nenhuma das que sobraram é uma linha vazia dos dois lados
  for (const nome of nomes2) {
    const l = await linhaDe(page, nome)
    const naoMedidos = await l.locator('td.nd').count()
    expect(naoMedidos, `${nome} não pode ser "não medido" dos dois lados`).toBeLessThan(2)
  }
})

test('A3.6 o lado do canal próprio mostra "não medido" com a hachura E o texto e o motivo em views por dia; nenhum "0" inventado; zero medido, valor e não medido se distinguem em escala de cinza', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()))
  const l = await linhaDe(page, 'Views por dia nos longos')
  const a = l.locator('td.cA')
  await expect(a.locator('.obs-ch-nm')).toHaveText('não medido')
  expect((await a.locator('small.why').textContent())!.length).toBeGreaterThan(10)
  medida(`motivo de "views por dia" do canal próprio: "${(await a.locator('small.why').textContent())!.trim()}"`)
  expect((await a.textContent())!.replace('A', '').replace(/não medido/, '').match(/\b0\b/), 'nenhum 0 na célula não medida').toBeNull()
  // a hachura é um gradiente de fundo (forma), o texto está lá (palavra) e a cor é só o reforço
  const hach = await a.locator('.obs-ch-nm').evaluate(e => { const cs = getComputedStyle(e); return { img: cs.backgroundImage, fundo: cs.backgroundColor, borda: cs.borderTopStyle + ' ' + cs.borderTopWidth, tam: cs.fontSize } })
  medida(`hachura do "não medido": ${hach.img.slice(0, 80)}; fundo ${hach.fundo}; borda ${hach.borda}; corpo ${hach.tam}`)
  expect(hach.img).toContain('gradient')
  expect(parseFloat(hach.tam)).toBeGreaterThanOrEqual(12)
  // a relação dessa linha não inventa: sem relação, com texto para leitor de tela
  await expect(l.locator('td.rel .obs-ch-sr')).toContainText('sem relação: um dos lados não foi medido')
  expect((await l.locator('td.rel .rt').count())).toBe(0)
  // "zero medido" é outra coisa: um par onde um lado tem 0 vira "0" com texto e relação (se existir no seed) — aqui só conferimos que NENHUMA célula "não medido" mostra número
  const celulasNm = tela(page).locator('td.nd')
  const nNm = await celulasNm.count()
  expect(nNm).toBeGreaterThanOrEqual(3)
  for (let i = 0; i < nNm; i++) expect((await celulasNm.nth(i).locator('.v1').count()), 'célula não medida sem valor').toBe(0)
  // em escala de cinza: a hachura continua visível como forma (o gradiente não depende de matiz) e a palavra está no DOM
  await page.addStyleTag({ content: 'html{filter:grayscale(1)!important}' })
  await l.scrollIntoViewIfNeeded()
  await page.screenshot({ path: foto('cinza-nao-medido-1440.png') })
  await expect(a.locator('.obs-ch-nm')).toBeVisible()
  // o sinal que separa os dois lados sem cor: a letra no chip do cabeçalho e o sublinhado de 3 px; o cabeçalho de cada coluna diz "Lado A"/"Lado B"
  await expect(tela(page).locator('thead th.cA .lm')).toHaveText('Lado A')
  await expect(tela(page).locator('thead th.cB .lm')).toHaveText('Lado B')
  const filete = await tela(page).locator('thead th.cA').evaluate(e => getComputedStyle(e).borderBottomWidth)
  expect(parseFloat(filete), 'sublinhado de 3 px do lado').toBeGreaterThanOrEqual(3)
})

test('A3.6 relação e barra coerentes com os números escritos: o lado do ▲ é o maior, a barra mais comprida é a do maior, e a posição escrita do maior é a melhor', async ({ page }) => {
  const pares: Array<[string, string]> = [[LEO(), ids.channel('nate-herk')], [OWN(), LEO()], [ids.channel('nate-herk'), OWN()]]
  let comBarra = 0, comTriangulo = 0
  for (const [a, b] of pares) {
    await abrir(page, par(a, b))
    const nomeA = (await tela(page).locator('.cp-side[data-lado="A"] h2').textContent())!.trim(), nomeB = (await tela(page).locator('.cp-side[data-lado="B"] h2').textContent())!.trim()
    const dados = await linhas(page).evaluateAll(trs => trs.map(tr => {
      const nome = tr.querySelector('th.rl')?.firstChild?.textContent ?? ''
      const barras = [...tr.querySelectorAll('.bars2 .b2t i')].map(i => parseFloat((i as HTMLElement).style.width))
      const sy = tr.querySelector('td.rel .sy:not(.eq)') as HTMLElement | null
      const cor = sy?.style.getPropertyValue('--c') ?? ''
      const txt = tr.querySelector('td.rel .rt')?.textContent ?? ''
      const sr = tr.querySelector('td.rel .obs-ch-sr')?.textContent ?? ''
      const pos = [...tr.querySelectorAll('td.cA small.pos:not(.geral), td.cB small.pos:not(.geral)')].map(p => (p.textContent ?? ''))
      const posA = tr.querySelector('td.cA small.pos:not(.geral)')?.textContent ?? null, posB = tr.querySelector('td.cB small.pos:not(.geral)')?.textContent ?? null
      const corA = (tr.querySelector('td.cA') as HTMLElement).style.getPropertyValue('--c'), corB = (tr.querySelector('td.cB') as HTMLElement).style.getPropertyValue('--c')
      return { nome, barras, cor, txt, sr, posA, posB, pos, corA, corB }
    }))
    for (const d of dados) {
      if (d.barras.length === 2 && d.barras[0]! + d.barras[1]! > 0) {
        comBarra++
        const maior = d.barras[0]! > d.barras[1]! ? 'A' : d.barras[1]! > d.barras[0]! ? 'B' : '='
        if (d.cor && maior !== '=') {
          comTriangulo++
          expect(d.cor, `${d.nome}: a cor do ▲ é a do lado de barra maior`).toBe(maior === 'A' ? d.corA : d.corB)
          expect(d.sr, `${d.nome}: o texto para leitor de tela nomeia o maior`).toContain(maior === 'A' ? nomeA : nomeB)
        }
        // a maior barra ocupa a largura toda do trilho
        expect(Math.max(...d.barras), `${d.nome}: a maior barra é de 100% (proporcional ao maior)`).toBeGreaterThanOrEqual(99.9)
      }
      if (d.cor && d.posA && d.posB && !/empate/.test(d.posA + d.posB)) {
        const pa = parseInt(d.posA, 10), pb = parseInt(d.posB, 10)
        if (d.nome !== 'Dias desde o último vídeo' && pa !== pb) expect(d.cor, `${d.nome}: o ▲ marca o lado de melhor posição (${pa}º x ${pb}º)`).toBe(pa < pb ? d.corA : d.corB)
      }
      // a relação nunca contradiz a si mesma: sem "Infinity", "NaN" ou razão menor que 1
      expect(d.txt, d.nome).not.toMatch(/Infinity|NaN|undefined/)
      for (const m of d.txt.matchAll(/(\d+(?:,\d+)?)×/g)) expect(parseFloat(m[1]!.replace(',', '.')), `${d.nome}: razão de ${d.txt}`).toBeGreaterThanOrEqual(1)
    }
  }
  medida(`relação x barra: ${comBarra} linhas com barra conferidas, ${comTriangulo} com ▲`)
  expect(comBarra).toBeGreaterThan(6)
})

test('A3.6 dois canais de nichos diferentes: posições "no geral" e o nicho de cada um ao lado do nome; no mesmo nicho, "em <Nicho>"', async ({ page }) => {
  const canais = await (async () => { await abrir(page, par(OWN(), LEO())); return todosOsCanais(page) })()
  // acha um concorrente de outro nicho pelo grupo do seletor
  const grupos = await selB(page).locator('optgroup').evaluateAll(gs => gs.map(g => ({ label: (g as HTMLOptGroupElement).label, ids: [...g.querySelectorAll('option')].map(o => (o as HTMLOptionElement).value) })))
  const comps = grupos.filter(g => /^Concorrentes de /.test(g.label))
  expect(comps.length, 'o seed tem pelo menos dois nichos de concorrentes').toBeGreaterThanOrEqual(2)
  const [g1, g2] = comps
  // mesmo nicho
  await abrir(page, par(g1!.ids[0]!, g1!.ids[1]!))
  const nicho1 = /Concorrentes de ([^,]+),/.exec(g1!.label)![1]!
  const posMesmo = (await (await linhaDe(page, 'Inscritos')).locator('td.cA small.pos:not(.geral)').textContent())!
  medida(`mesmo nicho: "${posMesmo}"`)
  expect(posMesmo).toMatch(new RegExp(`º de \\d+ em ${nicho1}`))
  await expect(tela(page).locator('.cp-sub')).toContainText(`Dois canais de ${nicho1}`)
  await expect(tela(page).locator('thead th.cN .cl')).toHaveText('No nicho')
  // nichos diferentes
  await abrir(page, par(g1!.ids[0]!, g2!.ids[0]!))
  const nome1 = (await tela(page).locator('.cp-side[data-lado="A"] h2').textContent())!.trim(), nome2 = (await tela(page).locator('.cp-side[data-lado="B"] h2').textContent())!.trim()
  const l = await linhaDe(page, 'Inscritos')
  const pa = (await l.locator('td.cA small.pos:not(.geral)').textContent())!, pb = (await l.locator('td.cB small.pos:not(.geral)').textContent())!
  medida(`nichos diferentes: A "${pa}" / B "${pb}"`)
  expect(pa).toMatch(/º de \d+ no geral/); expect(pb).toMatch(/º de \d+ no geral/)
  await expect(tela(page).locator('.cp-sub')).toContainText('nichos diferentes')
  await expect(tela(page).locator('thead th.cN .cl')).toHaveText('No geral')
  // o nicho de cada um aparece no cartão do lado
  const nichoA = /Concorrentes de ([^,]+),/.exec(g1!.label)![1]!, nichoB = /Concorrentes de ([^,]+),/.exec(g2!.label)![1]!
  await expect(tela(page).locator('.cp-side[data-lado="A"] .cp-m')).toContainText(nichoA)
  await expect(tela(page).locator('.cp-side[data-lado="B"] .cp-m')).toContainText(nichoB)
  expect(nome1).not.toBe(nome2)
  expect(canais.length).toBeGreaterThan(10)
})

test('A3.6 a posição escrita ao lado do valor é a MESMA da lista de Canais para o mesmo canal, formato e nicho', async ({ page }) => {
  const canais = (await (async () => { await abrir(page, par(OWN(), LEO())); return todosOsCanais(page) })())
  const grupos = await selB(page).locator('optgroup').evaluateAll(gs => gs.map(g => ({ label: (g as HTMLOptGroupElement).label, ids: [...g.querySelectorAll('option')].map(o => (o as HTMLOptionElement).value) })))
  const viagem = grupos.find(g => /^Concorrentes de Viagem/.test(g.label))!
  const [x, y] = viagem.ids
  // comparação do mesmo nicho (Viagem): o conjunto é o nicho; a lista com niche=viagem numera o mesmo conjunto
  await abrir(page, par(x!, y!))
  const lins = ['Inscritos', 'Views por dia nos longos', 'Views por dia por mil inscritos'] as const
  const escritas: Record<string, { A: string; B: string }> = {}
  for (const nome of lins) {
    const l = await linhaDe(page, nome)
    escritas[nome] = { A: ((await l.locator('td.cA small.pos:not(.geral)').textContent()) ?? '').trim(), B: ((await l.locator('td.cB small.pos:not(.geral)').textContent()) ?? '').trim() }
  }
  medida(`comparação (Viagem): ${JSON.stringify(escritas)}`)
  const naLista = async (qs: string, id: string) => {
    await page.goto(LISTA + qs)
    await page.locator(`${S_LISTA} .toolbar:visible`).first().waitFor({ timeout: 60_000 })
    await page.locator(`${S_LISTA} table:visible`).first().waitFor({ timeout: 30_000 })
    await page.waitForLoadState('networkidle')
    const linha = page.locator(`${S_LISTA}:visible tbody tr.row[data-id="${id}"]`).first()
    return ((await linha.locator('td.p').textContent()) ?? '').trim()
  }
  // a lista ordena Views/dia por mil inscritos por padrão (scale=per-mil); a linha "Views por dia nos longos" da comparação é o número absoluto (scale=abs)
  for (const [nome, sort] of [['Inscritos', 'subs'], ['Views por dia nos longos', 'vpd&scale=abs'], ['Views por dia por mil inscritos', 'vpd&scale=per-mil']] as const) {
    for (const [lado, id] of [['A', x!], ['B', y!]] as const) {
      const naComp = escritas[nome]![lado]
      const m = /^(\d+)º de (\d+) em Viagem(?: \(empate\))?/.exec(naComp)
      expect(m, `${nome} lado ${lado}: "${naComp}" tem a forma "Nº de N em Viagem"`).not.toBeNull()
      const naLst = await naLista(`?fmt=longos&sort=${sort}&niche=viagem`, id)
      medida(`${nome} ${lado}: comparação "${naComp}" x lista "${naLst}"`)
      expect(parseInt(naLst, 10), `${nome} lado ${lado}: a posição da lista (${naLst}) é a da comparação (${naComp})`).toBe(Number(m![1]))
    }
  }
  // "no geral": o par de nichos diferentes contra a lista em "Todos"
  const outroNicho = grupos.filter(g => /^Concorrentes de /.test(g.label) && g !== viagem)[0]!
  await abrir(page, par(x!, outroNicho.ids[0]!))
  const lg = await linhaDe(page, 'Inscritos')
  const geralA = ((await lg.locator('td.cA small.pos:not(.geral)').textContent()) ?? '').trim()
  const gm = /^(\d+)º de (\d+) no geral/.exec(geralA)
  expect(gm, `"${geralA}"`).not.toBeNull()
  const listaGeral = await naLista('?fmt=longos&sort=subs', x!)
  medida(`geral (Inscritos): comparação "${geralA}" x lista "${listaGeral}"`)
  expect(parseInt(listaGeral, 10)).toBe(Number(gm![1]))
  expect(canais.length).toBeGreaterThan(10)
})

/* ------------------------------------------------------------------------------------------------ I-1 (revisão da Tarefa 10): o gatilho do Voltar não vaza */
test('I-1 lista -> Comparar -> sair pela trilha ("Canais") e ordenar -> abrir outro canal -> Voltar: o foco NÃO vai ao "Comparar" de antes', async ({ page }) => {
  await page.setViewportSize(VP.w1440)
  await page.goto(`${LISTA}?fmt=longos`)
  await page.locator('[data-obs-screen="canais"] .toolbar:visible').first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.locator(`[data-obs-screen="canais"]:visible a[data-comparar="${LEO()}"]`).first().click()
  await page.waitForURL(u => u.pathname === ROTA, { timeout: 60_000 })
  await tela(page).locator('table').waitFor({ timeout: 60_000 })
  expect(await page.evaluate(() => window.sessionStorage.getItem('obs:gatilho-comparar')), 'o clique gravou o gatilho').toContain(LEO())
  // sai pela trilha (não pelo Voltar), para a lista, e a ordena (outra URL)
  await page.locator('.obs-tr-top:visible nav.crumbs').getByRole('link', { name: 'Canais' }).click()
  await page.waitForURL(u => u.pathname === LISTA, { timeout: 60_000 })
  await page.locator('[data-obs-screen="canais"] .toolbar:visible').first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500) // o macrotarefa que descarta o registro da montagem sem Voltar
  const sobrou = await page.evaluate(() => window.sessionStorage.getItem('obs:gatilho-comparar'))
  medida(`registro depois de sair pela trilha e a lista montar sem Voltar: ${sobrou}`)
  expect(sobrou, 'a montagem sem Voltar descartou o registro').toBeNull()
  // abre outro canal pelo nome e volta
  const nate = ids.channel('nate-herk')
  await page.locator(`[data-obs-screen="canais"]:visible tbody tr.row[data-id="${nate}"] a.nmbtn`).first().click()
  await page.waitForURL(u => u.pathname.endsWith('/canal/' + nate), { timeout: 60_000 })
  await page.locator('[data-obs-screen="canal"]:visible h1').first().waitFor({ timeout: 60_000 })
  await page.goBack()
  await page.waitForURL(u => u.pathname === LISTA, { timeout: 30_000 })
  await page.waitForTimeout(1200)
  const foco = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-comparar') ?? null)
  medida(`foco depois do Voltar (lista): data-comparar=${foco}`)
  expect(foco, 'o foco não pula para o "Comparar" de Leo Khev').not.toBe(LEO())
})

test('I-1 canal -> "Comparar com o meu canal" -> "Abrir o canal" (outro caminho) -> abrir um vídeo -> Voltar: o foco está no cartão do vídeo, não no botão "Comparar"', async ({ page }) => {
  await aberturaDoCanal(page, LEO())
  await page.evaluate(() => { (window as unknown as { __mole: boolean }).__mole = true })
  await doCanal(page).locator('[data-comparar-canal]').click()
  await page.waitForURL(u => u.pathname === ROTA, { timeout: 60_000 })
  await tela(page).locator('table').waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  const reg = await page.evaluate(() => window.sessionStorage.getItem('obs:gatilho-comparar'))
  expect(reg, 'o clique gravou o gatilho do cabeçalho').toContain('"lugar":"canal"')
  expect(JSON.parse(reg!).origem, 'com a URL da página de origem').toBe(`${CANAL}/${LEO()}`)
  // sai por OUTRO caminho: o link "Abrir o canal" do lado B, de volta à página do concorrente (montagem nova, sem Voltar)
  await tela(page).getByRole('link', { name: /^Abrir o canal Leo Khev/ }).click()
  await page.waitForURL(u => u.pathname.endsWith('/canal/' + LEO()), { timeout: 60_000 })
  await doCanal(page).locator('h1').first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => window.sessionStorage.getItem('obs:gatilho-comparar')), 'a página do canal montada sem Voltar descartou o registro').toBeNull()
  // abre um vídeo e volta
  // (um cartão fundo na grade, como no A2.2: o cartão à vista na rolagem restaurada não precisa de foco; um que a rolagem deixa longe, sim)
  const cartao = doCanal(page).locator('.cv-card:visible').nth(30).locator('a.cv-lnk')
  await cartao.scrollIntoViewIfNeeded()
  const idDoCartao = (await cartao.getAttribute('id'))!
  await cartao.click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await page.locator('.obs-tr-top:visible nav.crumbs li[aria-current]').first().waitFor({ timeout: 60_000 })
  await page.goBack()
  await page.waitForURL(u => u.pathname.endsWith('/canal/' + LEO()), { timeout: 30_000 })
  await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.id ?? ''), { timeout: 20_000, message: 'o foco volta ao cartão do último vídeo visto' }).toBe(idDoCartao)
  expect(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.hasAttribute('data-comparar-canal') ?? false), 'não foi parar no botão Comparar').toBe(false)
  medida(`Voltar do vídeo (registro velho do cabeçalho descartado): o foco está em #${idDoCartao}`)
})

/* ------------------------------------------------------------------------------------------------ A3.6: a régua do nicho */
interface MedidaRegua {
  nome: string; n: number; xs: number[]; iA: number; iB: number; posA: string; posB: string; pa: number | null; pb: number | null; empA: boolean; empB: boolean
  letraA: Caixa | null; letraB: Caixa | null; tickA: Caixa | null; tickB: Caixa | null; grupo: Caixa; sr: string
}
/** Mede todas as réguas da tela visível: ordem e % dos traços, onde estão A e B, a posição escrita ao lado e as caixas das letras. */
const medirReguas = (page: Page): Promise<MedidaRegua[]> => tela(page).evaluate(raiz => {
  const cx = (r: DOMRect) => ({ x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height })
  return [...raiz.querySelectorAll('tbody tr:not(.grp)')].filter(tr => tr.querySelector('.obs-rg')).map(tr => {
    const g = tr.querySelector<HTMLElement>('.obs-rg')!
    const ticks = [...g.querySelectorAll<HTMLElement>('.obs-rg-t')]
    const xs = ticks.map(t => parseFloat(t.style.getPropertyValue('--x')))
    const iA = ticks.findIndex(t => t.dataset.marca === 'A'), iB = ticks.findIndex(t => t.dataset.marca === 'B')
    const posA = tr.querySelector('td.cA small.pos:not(.geral)')?.textContent ?? '', posB = tr.querySelector('td.cB small.pos:not(.geral)')?.textContent ?? ''
    const num = (t: string) => { const m = /^(\d+)º/.exec(t); return m ? Number(m[1]) : null }
    const la = g.querySelector<HTMLElement>('[data-letra="A"]'), lb = g.querySelector<HTMLElement>('[data-letra="B"]')
    return {
      nome: tr.querySelector('th.rl')?.firstChild?.textContent ?? '', n: ticks.length, xs, iA, iB, posA, posB, pa: num(posA), pb: num(posB), empA: /empate/.test(posA), empB: /empate/.test(posB),
      letraA: la ? cx(la.getBoundingClientRect()) : null, letraB: lb ? cx(lb.getBoundingClientRect()) : null,
      tickA: iA >= 0 ? cx(ticks[iA]!.getBoundingClientRect()) : null, tickB: iB >= 0 ? cx(ticks[iB]!.getBoundingClientRect()) : null,
      grupo: cx(g.getBoundingClientRect()), sr: g.getAttribute('aria-label') ?? '',
    }
  })
})
/** Visita todos os pares (x < y) trocando os seletores com gestos de verdade, e chama `f` em cada um. Sem rede: cada troca é só estado. */
async function percorrerPares(page: Page, f: (a: { id: string; nome: string }, b: { id: string; nome: string }) => Promise<void>, limite = Infinity) {
  const canais = await todosOsCanais(page)
  let visitados = 0
  for (let i = 0; i < canais.length - 1 && visitados < limite; i++) {
    const x = canais[i]!
    if ((await selB(page).inputValue()) === x.id) await selB(page).selectOption(canais[(i + 1) % canais.length]!.id === (await selA(page).inputValue()) ? canais[(i + 2) % canais.length]!.id : canais[(i + 1) % canais.length]!.id)
    await selA(page).selectOption(x.id)
    for (let j = i + 1; j < canais.length && visitados < limite; j++) {
      await selB(page).selectOption(canais[j]!.id)
      await f(x, canais[j]!); visitados++
    }
  }
  return visitados
}
function conferirRegua(rotulo: string, m: MedidaRegua, largura: number, resumo: { igualX: number; menorGapLetras: number; menorDistTracos: number; linhas: number; letrasColadas: string[]; empates: number }) {
  resumo.linhas++
  // 1) os traços vão do menor ao maior, na ordem do DOM, e o "de N" da posição é o número de traços
  for (let k = 1; k < m.xs.length; k++) expect(m.xs[k]!, `${rotulo} ${m.nome}: traços do menor ao maior`).toBeGreaterThanOrEqual(m.xs[k - 1]! - 1e-6)
  for (const x of m.xs) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100) }
  // 2) A e B estão na posição certa em relação aos demais: o traço de A é o (pos)º a contar do maior (com empate, dentro do grupo empatado)
  for (const [lado, i, pos, emp, txt] of [['A', m.iA, m.pa, m.empA, m.posA], ['B', m.iB, m.pb, m.empB, m.posB]] as const) {
    if (i < 0) continue
    const de = /º de (\d+)/.exec(txt)
    expect(de, `${rotulo} ${m.nome} lado ${lado}: "${txt}" tem "Nº de N"`).not.toBeNull()
    expect(Number(de![1]), `${rotulo} ${m.nome} lado ${lado}: o "de N" é o número de traços`).toBe(m.n)
    const doMaior = m.n - i // 1 = o traço mais à direita
    if (!emp) {
      // sem empate escrito, o traço é o único com aquele x ou fica entre os de mesmo x: a posição escrita é a do primeiro do grupo
      const mesmos = m.xs.filter(x => Math.abs(x - m.xs[i]!) < 1e-6).length
      expect(doMaior >= pos! && doMaior <= pos! + mesmos - 1, `${rotulo} ${m.nome} lado ${lado}: traço ${doMaior}º a contar do maior x posição escrita ${pos}º (${mesmos} no mesmo ponto)`).toBe(true)
    } else {
      // o empate é do valor ESCRITO (dois valores que se escrevem igual, "0,3" e "0,31"): os traços podem estar em pontos próximos, não no mesmo
      resumo.empates++
    }
  }
  // 3) os dois lados no mesmo valor: letras e traços não se cobrem
  if (m.iA >= 0 && m.iB >= 0) {
    if (Math.abs(m.xs[m.iA]! - m.xs[m.iB]!) < 1e-6) resumo.igualX++
    const ta = m.tickA!, tb = m.tickB!
    const dist = Math.abs((ta.x + ta.r) / 2 - (tb.x + tb.r) / 2)
    resumo.menorDistTracos = Math.min(resumo.menorDistTracos, dist)
    expect(dist, `${rotulo} ${m.nome}: os traços de A e B não se cobrem (distância dos centros ${dist.toFixed(1)} px)`).toBeGreaterThan(2.5)
    const la = m.letraA!, lb = m.letraB!
    const gap = la.x < lb.x ? lb.x - la.r : la.x - lb.r
    resumo.menorGapLetras = Math.min(resumo.menorGapLetras, gap)
    expect(gap, `${rotulo} ${m.nome}: as letras A e B não colidem (vão de ${gap.toFixed(1)} px)`).toBeGreaterThanOrEqual(2)
    if (gap < 4) resumo.letrasColadas.push(`${m.nome}: ${gap.toFixed(1)} px`)
    // cada letra continua sob o traço do seu lado (no máximo 24 px de deslocamento) e dentro da faixa (2 px de folga fora, dito no relatório da Tarefa 7)
    expect(Math.abs((la.x + la.r) / 2 - (ta.x + ta.r) / 2), `${rotulo} ${m.nome}: A sob o seu traço`).toBeLessThanOrEqual(24)
    expect(Math.abs((lb.x + lb.r) / 2 - (tb.x + tb.r) / 2), `${rotulo} ${m.nome}: B sob o seu traço`).toBeLessThanOrEqual(24)
    for (const l of [la, lb]) { expect(l.x, `${rotulo} ${m.nome}: letra dentro da faixa (esquerda)`).toBeGreaterThanOrEqual(m.grupo.x - 3); expect(l.r, `${rotulo} ${m.nome}: letra dentro da faixa (direita)`).toBeLessThanOrEqual(m.grupo.r + 3) }
  }
  expect(m.grupo.r, `${rotulo} ${m.nome}: a faixa cabe na janela de ${largura} px`).toBeLessThanOrEqual(largura + 1)
}

for (const [nome, vp] of [['1440', VP.w1440], ['390', VP.w390]] as const) {
  test(`A3.6 a régua a ${nome} px, em TODOS os pares do site: traços na ordem, A e B na posição escrita, letras que não colidem (inclusive valores próximos e iguais), tudo dentro da faixa`, async ({ page }) => {
    test.setTimeout(240_000)
    await abrir(page, par(OWN(), LEO()), vp)
    const resumo = { igualX: 0, menorGapLetras: Infinity, menorDistTracos: Infinity, linhas: 0, letrasColadas: [] as string[], empates: 0 }
    const pares = await percorrerPares(page, async (a, b) => {
      for (const m of await medirReguas(page)) conferirRegua(`${nome} px, ${a.nome} x ${b.nome}`, m, vp.width, resumo)
    })
    medida(`régua a ${nome} px: ${pares} pares, ${resumo.linhas} réguas conferidas; A e B no MESMO ponto em ${resumo.igualX}; posições com empate dito: ${resumo.empates}; menor distância entre os traços de A e B ${resumo.menorDistTracos.toFixed(1)} px; menor vão entre as letras ${resumo.menorGapLetras.toFixed(1)} px; letras a menos de 4 px: ${resumo.letrasColadas.slice(0, 5).join('; ') || 'nenhuma'}`)
    expect(pares).toBeGreaterThan(80)
    expect(resumo.linhas).toBeGreaterThan(300)
  })
}

test('A3.6 escala comprimida com os 14+ canais reais do seed: nenhum traço some atrás de outro (distância mínima entre valores distintos) e a ressalva de pilha de empates cabe em 26 px', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()))
  // dois canais de nichos diferentes: a régua é a geral, com todos os canais do site
  const gr = await selB(page).locator('optgroup').evaluateAll(gs => gs.map(g => ({ label: (g as HTMLOptGroupElement).label, ids: [...g.querySelectorAll('option')].map(o => (o as HTMLOptionElement).value) })))
  const comp = gr.filter(g => /^Concorrentes de /.test(g.label))
  await abrir(page, par(comp[0]!.ids[0]!, comp[1]!.ids[0]!))
  const r = await tela(page).evaluate(raiz => {
    const saida: Array<{ nome: string; n: number; comprimida: boolean; menorGap: number; grupos: number; maiorPilha: number; alturaPilha: number }> = []
    for (const tr of raiz.querySelectorAll('tbody tr:not(.grp)')) {
      const g = tr.querySelector<HTMLElement>('.obs-rg'); if (!g) continue
      const ticks = [...g.querySelectorAll<HTMLElement>('.obs-rg-t')]
      const caixas = ticks.map(t => t.getBoundingClientRect())
      const dentro = g.querySelector('.obs-rg-in')!.getBoundingClientRect()
      const xs = ticks.map(t => parseFloat(t.style.getPropertyValue('--x')))
      const distintos = [...new Set(xs.map(x => x.toFixed(3)))].map(Number).sort((a, b) => a - b)
      let menorGap = Infinity
      for (let k = 1; k < distintos.length; k++) menorGap = Math.min(menorGap, (distintos[k]! - distintos[k - 1]!) * dentro.width / 100)
      const pilha = ticks.filter(t => t.classList.contains('obs-rg-pl'))
      const alt = pilha.length ? Math.max(...pilha.map(t => parseFloat(t.style.bottom) + parseFloat(t.style.height))) : 0
      saida.push({ nome: tr.querySelector('th.rl')?.firstChild?.textContent ?? '', n: ticks.length, comprimida: /comprimida/i.test(g.getAttribute('aria-label') ?? ''), menorGap: Math.round(menorGap * 10) / 10, grupos: distintos.length, maiorPilha: pilha.length, alturaPilha: alt })
      void caixas
    }
    return saida
  })
  for (const l of r) medida(`${l.nome}: ${l.n} traços, ${l.grupos} valores distintos, menor distância entre valores distintos ${l.menorGap} px, comprimida ${l.comprimida}, pilha de ${l.maiorPilha} (altura ${l.alturaPilha} px)`)
  expect(r.length).toBeGreaterThanOrEqual(5)
  for (const l of r) {
    expect(l.n, l.nome).toBeGreaterThanOrEqual(12)
    if (l.grupos > 1) expect(l.menorGap, `${l.nome}: dois valores distintos não podem cair no mesmo pixel`).toBeGreaterThanOrEqual(0.5)
    expect(l.alturaPilha, `${l.nome}: a pilha cabe em 26 px de coluna`).toBeLessThanOrEqual(19 + 26 + 1)
  }
})

test('A3.6 a dica da régua por teclado: Tab chega à régua com UMA parada, abre dentro da janela (com a casca rolando em `main`), as setas andam, Esc fecha, o anel de foco é visível', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()))
  // Tab a partir do ⓘ da tabela até a primeira régua
  await tela(page).getByRole('button', { name: 'Como ler esta tabela' }).focus()
  const fica = () => page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return a ? (a.matches('.obs-rg') ? 'regua' : a.tagName + '.' + String(a.className).slice(0, 20)) : '' })
  const passos: string[] = []
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); passos.push(await fica()); if (passos[passos.length - 1] === 'regua') break }
  medida(`Tab desde o ⓘ até a primeira régua: ${passos.join(' > ')}`)
  expect(passos[passos.length - 1]).toBe('regua')
  const g = page.locator('.obs-rg:focus').first()
  const tip = page.locator('#flut [role="tooltip"]')
  await expect(tip).toHaveCount(1)
  expect(await tip.textContent()).toContain('lado A')
  // anel de foco do teclado
  const anel = await g.evaluate(e => { const cs = getComputedStyle(e); return { estilo: cs.outlineStyle, largura: parseFloat(cs.outlineWidth), cor: cs.outlineColor } })
  medida(`anel de foco da régua (teclado): ${anel.estilo} ${anel.largura}px ${anel.cor}`)
  expect(anel.estilo).not.toBe('none'); expect(anel.largura).toBeGreaterThanOrEqual(2)
  expect(anel.cor).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
  await g.screenshot({ path: foto('regua-foco-teclado-dark.png') })
  const dentroDaJanela = async () => {
    const t = await caixaDe(tip), v = page.viewportSize()!, gr = await caixaDe(g)
    expect(t.x, 'a dica começa dentro da janela').toBeGreaterThanOrEqual(0); expect(t.r, 'a dica termina dentro da janela').toBeLessThanOrEqual(v.width)
    expect(t.y).toBeGreaterThanOrEqual(0); expect(t.b).toBeLessThanOrEqual(v.height)
    expect(t.b <= gr.y + 1 || t.y >= gr.b - 1, 'a dica não cobre a régua').toBe(true)
    return { t, gr }
  }
  await dentroDaJanela()
  // as setas: o traço ativo anda, a fala muda, e para nas pontas
  const ativo = () => g.evaluate(e => [...e.querySelectorAll('.obs-rg-t')].findIndex(t => t.classList.contains('obs-rg-on')))
  const i0 = await ativo()
  await page.keyboard.press('ArrowRight'); const i1 = await ativo()
  expect(i1).toBe(i0 + 1)
  await page.keyboard.press('End'); const n = await g.evaluate(e => e.querySelectorAll('.obs-rg-t').length)
  expect(await ativo()).toBe(n - 1)
  await page.keyboard.press('ArrowRight'); expect(await ativo()).toBe(n - 1)
  await page.keyboard.press('Home'); expect(await ativo()).toBe(0)
  expect((await g.locator('xpath=following-sibling::span[@aria-live]').textContent())!.length).toBeGreaterThan(5)
  await dentroDaJanela()
  // a casca rola em `main`: leva a régua para perto do topo da janela e depois do pé, e a dica continua inteira na janela (vira para o outro lado)
  for (const [alvo, rotulo] of [[30, 'régua no topo da janela'], [page.viewportSize()!.height - 70, 'régua no pé da janela']] as const) {
    await page.keyboard.press('Escape')
    await expect(tip).toHaveCount(0)
    const y = (await caixaDe(g)).y
    await rolarMain(page, await page.evaluate(() => (window as unknown as { __sc: () => HTMLElement }).__sc().scrollTop) + (y - alvo))
    await page.waitForTimeout(150)
    await page.keyboard.press('ArrowRight') // "a seta seguinte reabre"
    await expect(tip).toHaveCount(1)
    const { t, gr } = await dentroDaJanela()
    medida(`${rotulo}: régua em y ${Math.round(gr.y)}..${Math.round(gr.b)}, dica em y ${Math.round(t.y)}..${Math.round(t.b)} (${t.b <= gr.y + 1 ? 'acima' : 'abaixo'})`)
  }
  await page.keyboard.press('Escape'); await expect(tip).toHaveCount(0)
  const indice = () => page.evaluate(() => [...document.querySelectorAll('.obs-rg')].indexOf(document.activeElement as Element))
  const antes = await indice()
  await page.keyboard.press('Tab')
  expect(await fica(), 'a próxima parada de Tab é a régua seguinte (uma parada por régua)').toBe('regua')
  expect(await indice(), 'e é a régua SEGUINTE, não a mesma').toBe(antes + 1)
})

test('A3.6 com o mouse: a dica do traço mais perto abre dentro da janela, em #flut, e some ao sair; vale a 1440 e a 390 px', async ({ page }) => {
  for (const vp of [VP.w1440, VP.w390]) {
    await abrir(page, par(OWN(), LEO()), vp)
    const g = tela(page).locator('.obs-rg').first()
    await g.scrollIntoViewIfNeeded()
    const tick = g.locator('.obs-rg-t').nth(3)
    const b = (await tick.boundingBox())!
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    const tip = page.locator('#flut [role="tooltip"]')
    await expect(tip).toHaveCount(1)
    const t = await caixaDe(tip)
    expect(t.x).toBeGreaterThanOrEqual(0); expect(t.r).toBeLessThanOrEqual(vp.width); expect(t.y).toBeGreaterThanOrEqual(0)
    expect(await tip.evaluate(e => !!e.closest('#flut') && !e.closest('td'))).toBe(true)
    expect(await g.locator('.obs-rg-t').nth(3).evaluate(e => e.classList.contains('obs-rg-on'))).toBe(true)
    await page.mouse.move(5, 5)
    await expect(tip).toHaveCount(0)
  }
})

/* ------------------------------------------------------------------------------------------------ Q1: toque real */
test.describe('toque de verdade', () => {
  test.use({ hasTouch: true })
  test('Q1 tocar num traço que NÃO é o do lado A mostra a dica DESSE traço, antes e depois do foco sintetizado que chega depois do levantar do dedo; sem fala de teclado', async ({ page }) => {
    await abrir(page, par(OWN(), LEO()), VP.w390)
    const g = tela(page).locator('.obs-rg').first()
    await g.scrollIntoViewIfNeeded()
    const ticks = g.locator('.obs-rg-t')
    const n = await ticks.count()
    const tip = page.locator('#flut [role="tooltip"]')
    const vistos: string[] = []
    for (const i of [1, Math.floor(n / 2), n - 2, 2]) {
      const t = ticks.nth(i)
      if (await t.evaluate(e => (e as HTMLElement).dataset.marca != null)) continue // só traços sem destaque: o do lado A/B diria "lado A" por direito
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()) // cada toque parte de um grupo SEM foco (com foco, nenhum foco sintetizado chega e a prova seria vazia)
      await expect(tip).toHaveCount(0)
      const b = (await t.boundingBox())!
      const x = b.x + b.width / 2, y = b.y + b.height / 2
      if (vistos.length % 2 === 1) await page.touchscreen.tap(x, y)
      else {
        // o dedo fica 150 ms na tela, como num aparelho de verdade: o mousedown sintetizado (e com ele o foco) só chega no levantar do dedo
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
        await page.waitForTimeout(150)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await cdp.detach()
      }
      await expect(tip).toHaveCount(1)
      await page.waitForTimeout(400) // o foco sintetizado e qualquer temporizador antigo já passaram
      const texto = (await tip.textContent())!
      vistos.push(`traço ${i}: "${texto}"`)
      expect(await g.evaluate(e => document.activeElement === e), 'o foco chegou ao grupo (o caminho que quebrava)').toBe(true)
      expect(await g.evaluate(e => [...e.querySelectorAll('.obs-rg-t')].findIndex(x => x.classList.contains('obs-rg-on')))).toBe(i)
      expect(texto, 'a dica é a do traço tocado, não a do lado A').not.toContain('lado A')
      expect(texto).not.toContain('lado B')
      expect((await g.locator('xpath=following-sibling::span[@aria-live]').textContent())!, 'o toque não fala como o teclado').toBe('')
      const tb = await caixaDe(tip)
      expect(tb.x).toBeGreaterThanOrEqual(0); expect(tb.r).toBeLessThanOrEqual(390); expect(tb.y).toBeGreaterThanOrEqual(0)
    }
    medida(`toque real (hasTouch; tap imediato e dedo parado 150 ms por CDP) a 390 px: ${vistos.join(' | ')}`)
    expect(vistos.length).toBeGreaterThanOrEqual(1)
    // um toque fora fecha
    await page.touchscreen.tap(8, 8)
    await expect(tip).toHaveCount(0)
  })
})

/* ------------------------------------------------------------------------------------------------ A3.7: blocos */
test('A3.7 os cinco mais vistos levam ao Histórico com a trilha "Comparar canais › canal › Histórico do vídeo"; o Voltar devolve a comparação com o mesmo par; vídeo próprio não tem item de canal', async ({ page }) => {
  const outro = ids.channel('nate-herk')
  await abrir(page, par(OWN(), outro))
  const mv = secao(page, 'Os 5 vídeos mais vistos de cada canal')
  // 1) vídeo do concorrente (lado B)
  await mv.locator('.cp-vc').nth(1).locator('.cp-t5 a').first().click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await page.locator('.obs-tr-top:visible nav.crumbs li[aria-current]').first().waitFor({ timeout: 60_000 })
  const trilha = (await page.locator('.obs-tr-top:visible nav.crumbs').first().textContent())!.replace(/\s+/g, ' ').trim()
  medida(`trilha do vídeo do concorrente: "${trilha}"`)
  // o "›" entre os itens é um pseudo-elemento de CSS: o texto é a lista de itens
  expect(await page.locator('.obs-tr-top:visible nav.crumbs li').allTextContents()).toEqual(['Comparar canais', 'Nate Herk', 'Histórico do vídeo'])
  expect(await page.locator('.obs-tr-top:visible nav.crumbs').getByRole('link').allTextContents()).toEqual(['Comparar canais', 'Nate Herk'])
  expect(await page.locator('.obs-tr-top:visible nav.crumbs li').last().getAttribute('aria-current') ?? await page.locator('.obs-tr-top:visible nav.crumbs [aria-current]').count().then(String)).toBeTruthy()
  await page.goBack()
  await tela(page).locator('table').waitFor({ timeout: 60_000 })
  expect(param(page, 'a')).toBe(OWN()); expect(param(page, 'b')).toBe(outro)
  // 2) vídeo do canal próprio (lado A): sem item de canal na trilha (ele ainda não tem página)
  const doA = tela(page).locator('.cp-vc').nth(0).locator('.cp-t5 a').first()
  if (await doA.count()) {
    await doA.click()
    await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
    await page.locator('.obs-tr-top:visible nav.crumbs li[aria-current]').first().waitFor({ timeout: 60_000 })
    const links = await page.locator('.obs-tr-top:visible nav.crumbs').getByRole('link').allTextContents()
    medida(`trilha do vídeo próprio: ${JSON.stringify(links)}`)
    expect(links[0]).toBe('Comparar canais')
    await page.goBack()
    await tela(page).locator('table').waitFor({ timeout: 60_000 })
    expect(param(page, 'a')).toBe(OWN()); expect(param(page, 'b')).toBe(outro)
  }
})

test('A3.7 a faixa de publicação: os dois canais no mesmo eixo (mesmo início, mesma largura, mesmas linhas guia), traço alto/baixo/tracejado distintos por forma', async ({ page }) => {
  await abrir(page, par(LEO(), ids.channel('nate-herk')))
  const pub = secao(page, 'Publicação nos últimos 90 dias')
  await pub.scrollIntoViewIfNeeded()
  const faixas = pub.locator('.cp-strip')
  expect(await faixas.count()).toBe(2)
  const [a, b] = [await caixaDe(faixas.nth(0)), await caixaDe(faixas.nth(1))]
  expect(Math.abs(a.x - b.x), 'mesmo início').toBeLessThanOrEqual(0.5); expect(Math.abs(a.w - b.w), 'mesma largura').toBeLessThanOrEqual(0.5)
  const guias = (i: number) => faixas.nth(i).locator('i.gl').evaluateAll(es => es.map(e => Math.round(e.getBoundingClientRect().left * 10) / 10))
  expect(await guias(0)).toEqual(await guias(1))
  const eixo = await caixaDe(pub.locator('.cp-axis'))
  expect(Math.abs(eixo.x - a.x) <= 0.5 && Math.abs(eixo.w - a.w) <= 0.5, `o eixo (${eixo.x}, ${eixo.w}) é o das faixas (${a.x}, ${a.w})`).toBe(true)
  const formas = await pub.locator('.cp-strip i.t').evaluateAll(es => es.map(e => ({ k: e.className.replace('t ', ''), h: Math.round(e.getBoundingClientRect().height), borda: getComputedStyle(e).borderLeftStyle })))
  const alturas = (k: string) => [...new Set(formas.filter(f => f.k === k).map(f => f.h))]
  medida(`traços: longo ${alturas('lg')} px, Short ${alturas('sh')} px, não confirmado ${alturas('nc')} px (n=${formas.length})`)
  if (alturas('lg')[0] && alturas('sh')[0]) expect(alturas('lg')[0]!).toBeGreaterThan(alturas('sh')[0]!)
  // cada traço está dentro da faixa
  const fora = await faixas.evaluateAll(fs => fs.flatMap(f => { const r = f.getBoundingClientRect(); return [...f.querySelectorAll('i.t')].filter(t => { const b = t.getBoundingClientRect(); return b.left < r.left - 1 || b.right > r.right + 1 }).length }))
  expect(fora.reduce((x, y) => x + y, 0)).toBe(0)
  // o rótulo de lado, em texto
  await expect(pub.locator('.cp-pl .lm').nth(0)).toHaveText('Lado A'); await expect(pub.locator('.cp-pl .lm').nth(1)).toHaveText('Lado B')
})

test('A3.7 o botão do cartão da forja: apagado, focável por Tab, nenhuma requisição ao clicar nem com Enter e Espaço (todo POST de server action é interceptado e reprova)', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()))
  const botao = tela(page).getByRole('button', { name: /Pedir leitura desta comparação à forja/ })
  await botao.scrollIntoViewIfNeeded()
  // chega por Tab (do último link dos mais vistos até ele)
  await secao(page, 'Publicação nos últimos 90 dias').locator('xpath=preceding::a[1]').first().focus().catch(() => undefined)
  let achou = false
  for (let i = 0; i < 12 && !achou; i++) { await page.keyboard.press('Tab'); achou = await botao.evaluate(e => e === document.activeElement) }
  medida(`Tab até o botão apagado da forja: ${achou ? 'alcançou' : 'NÃO alcançou'}`)
  expect(achou, 'o botão apagado recebe o foco por Tab').toBe(true)
  const anel = await botao.evaluate(e => { const cs = getComputedStyle(e); return { estilo: cs.outlineStyle, largura: parseFloat(cs.outlineWidth), borda: cs.borderTopStyle, cursor: cs.cursor } })
  expect(anel.estilo).not.toBe('none'); expect(anel.borda).toBe('dashed')
  const pedidos: string[] = []
  page.on('request', r => { if (!/^data:/.test(r.url())) pedidos.push(`${r.method()} ${r.resourceType()} ${r.url().slice(0, 100)}`) })
  await botao.click({ force: true }); await page.keyboard.press('Enter'); await page.keyboard.press('Space'); await botao.dblclick({ force: true })
  await page.waitForTimeout(700)
  expect(pedidos, 'requisições depois dos gestos').toEqual([])
  expect(intrusos, 'nenhuma server action tentada').toEqual([])
  await expect(botao).toHaveAttribute('aria-disabled', 'true')
  const porque = await page.locator(`#${await botao.getAttribute('aria-describedby')}`).textContent()
  expect(porque).toBe('Ainda não dá: a forja ainda não escreve leitura de comparação entre canais.')
  expect(await tela(page).evaluate(e => e.textContent!.match(/depois que a coleta|coleta di[aá]ria[^.;]*(estiver no ar|começa|em breve)/i))).toBeNull()
})

test('I-A/I-B/I-C na tela real: nenhum item dos mais vistos aponta para um vídeo que o Histórico não acha, nenhum "0" de longos em 90 dias é de canal sem datas, e a tela não se contradiz sobre a coleta', async ({ page }) => {
  const canais = await (async () => { await abrir(page, par(OWN(), LEO())); return todosOsCanais(page) })()
  let links = 0, semLink = 0
  for (const c of canais.slice(0, 8)) {
    const outro = canais.find(x => x.id !== c.id)!
    await abrir(page, par(c.id, outro.id))
    for (const a of await tela(page).locator('.cp-t5 a').evaluateAll(es => es.map(e => e.getAttribute('href')!))) { links++; expect(a).toMatch(/\/competitors\/video\/[^/?]+\?/) }
    semLink += await tela(page).locator('.cp-t5 .cp-sem-abrir').count()
    const t = (await tela(page).textContent())!
    expect(t).not.toMatch(/depois que a coleta di[aá]ria estiver no ar/)
  }
  medida(`mais vistos em 8 pares: ${links} links, ${semLink} itens sem data (sem link)`)
  expect(links).toBeGreaterThan(20)
  // abre de verdade o primeiro vídeo de cada tipo de link e confere que o Histórico o conhece
  await abrir(page, par(OWN(), LEO()))
  await tela(page).locator('.cp-vc').nth(1).locator('.cp-t5 a').first().click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 60_000 })
  await expect(page.getByText('Vídeo não encontrado')).toHaveCount(0)
})

/* ------------------------------------------------------------------------------------------------ cor, tema, larguras, alvos */
test('cor nunca sozinha: em escala de cinza os dois lados se distinguem pela letra e pelo chip (a luminância das duas cores é medida e dita), o "não medido" pela hachura e pelo texto, o zero medido pelo "0"', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()))
  await page.addStyleTag({ content: 'html{filter:grayscale(1)!important}' })
  await tela(page).screenshot({ path: foto('cinza-tela-1440.png') })
  const cor = await tela(page).evaluate(raiz => {
    const lum = (rgb: string) => { const m = rgb.match(/\d+(\.\d+)?/g)!.map(Number); const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }; return 0.2126 * f(m[0]!) + 0.7152 * f(m[1]!) + 0.0722 * f(m[2]!) }
    const bg = (sel: string) => getComputedStyle(raiz.querySelector(sel)!).backgroundColor
    const a = bg('.cp-side[data-lado="A"] .lm'), b = bg('.cp-side[data-lado="B"] .lm')
    return { a, b, la: lum(a), lb: lum(b), chipA: raiz.querySelector('.cp-side[data-lado="A"] .lm')!.textContent, chipB: raiz.querySelector('.cp-side[data-lado="B"] .lm')!.textContent }
  })
  const razao = (Math.max(cor.la, cor.lb) + 0.05) / (Math.min(cor.la, cor.lb) + 0.05)
  medida(`lados em escala de cinza: A ${cor.a} (L ${cor.la.toFixed(3)}), B ${cor.b} (L ${cor.lb.toFixed(3)}), razão ${razao.toFixed(2)} (o spec 18.2 diz 1,35: o que separa é a letra, o chip e o filete, não a cor)`)
  expect(cor.chipA).toBe('Lado A'); expect(cor.chipB).toBe('Lado B')
  // cada coluna tem a letra no cabeçalho e cada valor, a 390 px, a letra no chip; a régua tem as letras A e B embaixo dos traços
  expect(await tela(page).locator('.obs-rg [data-letra="A"]').count()).toBeGreaterThan(3)
  expect(await tela(page).locator('.obs-rg [data-letra="B"]').count()).toBeGreaterThan(3)
  // zero medido x valor x não medido: três textos diferentes (um deles pode não existir no seed, e isso é dito)
  const nm = await tela(page).locator('td.nd .obs-ch-nm').first().textContent()
  expect(nm).toBe('não medido')
  const valores = await tela(page).locator('td:not(.nd) .v1').allTextContents()
  const zeros = valores.filter(v => v.trim() === '0')
  medida(`zeros medidos no par: ${zeros.length}; valores: ${valores.length}; não medidos: ${await tela(page).locator('td.nd').count()}`)
  await page.setViewportSize(VP.w390)
  await page.screenshot({ path: foto('cinza-tela-390.png') })
  const nm390 = tela(page).locator('td.nd').first()
  await nm390.scrollIntoViewIfNeeded()
  await nm390.screenshot({ path: foto('cinza-nao-medido-390.png') })
  await expect(nm390.locator('.cp-lb')).toBeVisible()
  await expect(nm390.locator('.obs-ch-nm')).toBeVisible()
})

/** Razão de contraste do texto de cada alvo contra o fundo efetivo (camadas translúcidas compostas), na tela visível. */
const contrastes = (page: Page, alvos: Array<[string, string]>) => tela(page).evaluate((raiz, alvos) => {
  type RGBA = [number, number, number, number]
  const parse = (s: string): RGBA => { const m = s.match(/rgba?\(([^)]+)\)/)?.[1]?.split(/[ ,/]+/).filter(Boolean).map(parseFloat) ?? [0, 0, 0, 0]; return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0, m[3] ?? 1] }
  const sobre = (top: RGBA, bottom: RGBA): RGBA => { const a = top[3] + bottom[3] * (1 - top[3]); return a === 0 ? [0, 0, 0, 0] : [(top[0] * top[3] + bottom[0] * bottom[3] * (1 - top[3])) / a, (top[1] * top[3] + bottom[1] * bottom[3] * (1 - top[3])) / a, (top[2] * top[3] + bottom[2] * bottom[3] * (1 - top[3])) / a, a] }
  const fundoDe = (e: Element): RGBA => { const cam: RGBA[] = []; for (let p: Element | null = e; p; p = p.parentElement) { const c = parse(getComputedStyle(p).backgroundColor); if (c[3] > 0) cam.push(c); if (c[3] >= 1) break } return cam.reduceRight<RGBA>((acc, c) => sobre(c, acc), [255, 255, 255, 1]) }
  const L = (c: RGBA) => { const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
  return alvos.map(([nome, sel]) => {
    const els = [...raiz.querySelectorAll<HTMLElement>(sel)].filter(e => e.getClientRects().length > 0)
    if (!els.length) return { nome, ausente: true as const }
    let pior = Infinity, cor = '', fundo = ''
    for (const e of els.slice(0, 12)) {
      const fg = parse(getComputedStyle(e).color), bg = fundoDe(e), a = L(sobre(fg, bg)), b = L(bg)
      const r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      if (r < pior) { pior = r; cor = getComputedStyle(e).color; fundo = `rgb(${bg.slice(0, 3).map(Math.round).join(',')})` }
    }
    return { nome, ausente: false as const, ratio: Math.round(pior * 100) / 100, cor, fundo }
  })
}, alvos)
const ALVOS_TEXTO: Array<[string, string]> = [
  ['chip "Lado A/B" do cartão', '.cp-side .lm'], ['selo "seu canal"', '.cp-seal'], ['nome do canal', '.cp-side h2'], ['subtítulo', '.cp-sub'], ['inscritos do cartão', '.cp-m'],
  ['chip do cabeçalho da coluna', 'thead .lm'], ['nome da linha', 'th.rl'], ['base da linha', 'th.rl small'], ['valor', 'td:not(.nd) .v1'], ['posição escrita', 'small.pos:not(.geral)'],
  ['"não medido" (texto)', 'td.nd .obs-ch-nm'], ['motivo do não medido', 'td.nd small.why'], ['relação', 'td.rel .rt'], ['Leitura rápida', '.cp-lr .lr-t'], ['título da Leitura', '.cp-lr h3'],
  ['mais vistos: título', '.cp-vt b'], ['mais vistos: views', '.cp-vt small'], ['publicação: rótulo', '.cp-pl'], ['publicação: eixo', '.cp-axis span'], ['forja: texto', '.cp-fj-what'],
  ['forja: porquê', '.cp-fj-ask p'], ['forja: botão (apagado)', '.cp-fj-btn'], ['rodapé', 'p.cp-n'], ['régua: sem traço', '.obs-rg-falta'], ['rodapé de unidade da régua (letra)', '.obs-rg-ch'],
]
for (const tema of THEMES) {
  test(`tema ${tema === 'dark' ? 'escuro' : 'claro'}: os dois lados, o "não medido", a régua, os blocos e o cartão da forja legíveis (contraste de texto 4,5:1 medido; traço da régua 3:1)`, async ({ page }) => {
    await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
    await abrir(page, par(OWN(), LEO()))
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(tema)
    const todos = new Map<string, { ratio: number; cor: string; fundo: string }>()
    for (const largura of [1440, 390]) {
      await page.setViewportSize({ width: largura, height: 900 })
      await page.waitForTimeout(150)
      for (const m of await contrastes(page, ALVOS_TEXTO)) {
        if (m.ausente) continue
        const k = `${m.nome}${largura === 390 ? ' (390)' : ''}`
        todos.set(k, { ratio: m.ratio, cor: m.cor, fundo: m.fundo })
      }
      if (largura === 390) for (const m of await contrastes(page, [['chip da letra do lado em cada valor', '.cp-lb']])) if (!m.ausente) todos.set('chip da letra (390)', { ratio: m.ratio, cor: m.cor, fundo: m.fundo })
    }
    // o traço da régua (marca gráfica) contra o fundo da célula
    await page.setViewportSize(VP.w1440)
    const traco = await tela(page).evaluate(raiz => {
      const parse = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number)
      const L = (c: number[]) => { const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!) }
      const out: Record<string, number> = {}
      const fundo = parse(getComputedStyle(raiz.querySelector('td.cN')!).backgroundColor).length ? null : null
      void fundo
      let p: Element | null = raiz.querySelector('td.cN'); let bg = [255, 255, 255]
      for (; p; p = p.parentElement) { const c = parse(getComputedStyle(p).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) >= 1) { bg = c.slice(0, 3); break } }
      for (const l of ['A', 'B']) { const t = raiz.querySelector(`.obs-rg-t[data-marca="${l}"]`); if (!t) continue; const c = parse(getComputedStyle(t).backgroundColor).slice(0, 3); const a = L(c), b = L(bg); out[l] = Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100 }
      return out
    })
    medida(`${tema}: traço da régua A ${traco.A}:1, B ${traco.B}:1`)
    for (const [nome, m] of todos) medida(`${tema}: ${nome}: ${m.ratio}:1 (${m.cor} sobre ${m.fundo})`)
    expect(todos.size).toBeGreaterThanOrEqual(15)
    const reprovados = [...todos].filter(([nome, m]) => m.ratio < (/apagado/.test(nome) ? 3 : 4.5)).map(([nome, m]) => `${nome} ${m.ratio}:1`)
    expect(reprovados, `${tema}: contraste abaixo do piso`).toEqual([])
    expect(traco.A, `${tema} traço A`).toBeGreaterThanOrEqual(3); expect(traco.B, `${tema} traço B`).toBeGreaterThanOrEqual(3)
    await page.screenshot({ path: foto(`tema-${tema}-1440.png`) })
    await page.setViewportSize(VP.w390)
    await page.screenshot({ path: foto(`tema-${tema}-390.png`) })
  })
}

for (const tema of THEMES) {
  test(`sem rolagem horizontal da página em 1440, 1280, 1024, 768, 390 e 320 px, tema ${tema === 'dark' ? 'escuro' : 'claro'}; abaixo de 820 px a tabela vira pilha com rótulo; nenhuma resposta 500`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
    const resumo: string[] = []
    for (const w of [1440, 1280, 1024, 768, 390, 320]) {
      await abrir(page, par(OWN(), LEO()), { width: w, height: 900 })
      for (const alvo of ['table', '.cp-vids', '.cp-pr', '.cp-fj']) await tela(page).locator(alvo).first().scrollIntoViewIfNeeded().catch(() => undefined)
      const rola = await rolaNaHorizontal(page)
      const proprio = await tela(page).evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth, filhos: [...e.querySelectorAll('*')].filter(x => x.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && x.getClientRects().length > 0).map(x => `${x.tagName}.${String(x.className).slice(0, 18)}`).slice(0, 4) }))
      const grid = await linhas(page).first().evaluate(e => getComputedStyle(e).display)
      resumo.push(`${w}: ${rola.length ? 'ROLA ' + rola.join('; ') : 'sem rolagem'}; tela ${proprio.sw}/${proprio.cw}; 1ª linha ${grid}${proprio.filhos.length ? '; passam da janela: ' + proprio.filhos.join(',') : ''}`)
      if (w >= 1024) expect(rola, `${tema} ${w} px`).toEqual([])
      if (w >= 390) { expect(rola, `${tema} ${w} px`).toEqual([]); expect(proprio.filhos, `${tema} ${w}: nada da tela passa da janela`).toEqual([]) }
      if (w <= 768) expect(grid, `${tema} ${w}: a tabela vira pilha`).toBe('grid')
      else if (w >= 1024) expect(grid).not.toBe('grid')
      if (w <= 768) expect(await tela(page).locator('tbody tr:not(.grp) .cp-lb:visible').count(), `${tema} ${w}: cada valor leva a letra do lado`).toBeGreaterThan(20)
      if (w === 320) {
        // a casca do CMS (fora desta tela) pode passar de 320 px, como na lista de Canais; a tela da comparação, não
        expect(proprio.sw, `${tema} 320: a própria tela da comparação cabe`).toBeLessThanOrEqual(proprio.cw + 1)
        expect(proprio.filhos, `${tema} 320: nada da tela da comparação passa da janela`).toEqual([])
      }
    }
    medida(`larguras (${tema}): ${resumo.join(' || ')}`)
  })
}

test('alvos: 24 px sempre e 44 px em 390 px nos seletores, em "Inverter lados", nos links dos mais vistos e de "Abrir o canal", no ⓘ e na régua', async ({ page }) => {
  const alvos: Array<[string, string]> = [
    ['seletor do lado A', '.cp-side[data-lado="A"] select'], ['seletor do lado B', '.cp-side[data-lado="B"] select'], ['Inverter lados', '.cp-swap'], ['ⓘ da tabela', '.ibtn'],
    ['link dos mais vistos', '.cp-t5 a'], ['Abrir o canal', '.cp-open a'], ['régua', '.obs-rg'], ['botão da forja', '.cp-fj-btn'],
  ]
  const medirAlvos = () => tela(page).evaluate((raiz, alvos) => alvos.map(([nome, sel]) => {
    const els = [...raiz.querySelectorAll<HTMLElement>(sel)].filter(e => e.getClientRects().length > 0)
    const menor = els.reduce((m, e) => { const r = e.getBoundingClientRect(); return { w: Math.min(m.w, r.width), h: Math.min(m.h, r.height) } }, { w: Infinity, h: Infinity })
    return { nome, n: els.length, w: Math.round(menor.w * 10) / 10, h: Math.round(menor.h * 10) / 10 }
  }), alvos)
  await abrir(page, par(OWN(), LEO()))
  const reprovados: string[] = []
  for (const m of await medirAlvos()) { medida(`alvo 1440 ${m.nome}: menor ${m.w} x ${m.h} (${m.n})`); if (m.n === 0 || m.w < 24 || m.h < 24) reprovados.push(`1440 ${m.nome} ${m.w}x${m.h}`) }
  await page.setViewportSize(VP.w390)
  await page.waitForTimeout(200)
  for (const m of await medirAlvos()) {
    medida(`alvo 390 ${m.nome}: menor ${m.w} x ${m.h} (${m.n})`)
    if (m.h < 44 || (m.nome !== 'ⓘ da tabela' && m.w < 44)) reprovados.push(`390 ${m.nome} ${m.w}x${m.h}`)
  }
  expect(reprovados, 'alvos abaixo de 24 px (1440) ou de 44 px (390)').toEqual([])
})

/* ------------------------------------------------------------------------------------------------ o atalho "Meu canal" na comparação e no Histórico; topo; trilha */
test('A3.3 o atalho "Meu canal" na comparação e no Histórico do vídeo: abre, anda com as setas, fecha com Esc e devolve o foco; o menu fica inteiro na janela e ACIMA do conteúdo, em 1440 e em 390 px', async ({ page }) => {
  for (const vp of [VP.w1440, VP.w390]) {
    for (const onde of ['comparação', 'Histórico'] as const) {
      if (onde === 'comparação') await abrir(page, par(OWN(), LEO()), vp)
      else {
        await aberturaDoCanal(page, LEO(), vp)
        await doCanal(page).locator('a[id^="cv-lnk-"]').first().click()
        await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
        await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 60_000 })
        await page.waitForLoadState('networkidle')
      }
      const atalho = page.locator('.obs-tr-top:visible [data-meu-canal] button').first()
      await atalho.click()
      const menu = page.locator('#flut [role="menu"]').first()
      await expect(menu).toBeVisible()
      const itens = menu.getByRole('menuitem')
      await expect(itens.first()).toBeFocused()
      const m = await caixaDe(menu)
      expect(m.x, `${onde} ${vp.width}: o menu começa na janela`).toBeGreaterThanOrEqual(0); expect(m.r).toBeLessThanOrEqual(vp.width); expect(m.y).toBeGreaterThanOrEqual(0); expect(m.b).toBeLessThanOrEqual(vp.height)
      // acima do conteúdo: o elemento no centro e nos quatro cantos é o menu ou filho dele
      const topo = await menu.evaluate(e => { const r = e.getBoundingClientRect(); return [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 3, r.top + 3], [r.right - 3, r.top + 3], [r.left + 3, r.bottom - 3], [r.right - 3, r.bottom - 3]].map(([x, y]) => { const el = document.elementFromPoint(x!, y!); return !!el && e.contains(el) }) })
      expect(topo, `${onde} ${vp.width}: o menu está acima do conteúdo (centro e cantos)`).toEqual([true, true, true, true, true])
      expect(await menu.evaluate(e => !!e.closest('#flut'))).toBe(true)
      await page.keyboard.press('ArrowDown'); await expect(itens.nth(1)).toBeFocused()
      await page.keyboard.press('End'); await expect(itens.last()).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(page.locator('#flut [role="menu"]')).toHaveCount(0)
      await expect(atalho).toBeFocused()
      medida(`menu "Meu canal" em ${onde} a ${vp.width} px: ${Math.round(m.w)} x ${Math.round(m.h)} em (${Math.round(m.x)}, ${Math.round(m.y)}); itens ${await itens.count()}`)
    }
  }
})

test('Meu canal em Canais, no canal, no Histórico e na comparação: um por tela, com o nome do canal principal no nome acessível', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()))
  await expect(page.locator('.obs-tr-top:visible [data-meu-canal] button')).toHaveAccessibleName('Meu canal: tnFigueiredo')
  await page.goto(`${LISTA}?fmt=longos`)
  await page.locator('[data-obs-screen="canais"] .toolbar:visible').first().waitFor({ timeout: 60_000 })
  await expect(page.locator('[data-meu-canal]:visible button')).toHaveCount(1)
  await expect(page.locator('[data-meu-canal]:visible button')).toHaveAccessibleName('Meu canal: tnFigueiredo')
  await aberturaDoCanal(page, LEO())
  await expect(page.locator('[data-meu-canal]:visible button')).toHaveCount(1)
})

test('o topo (moldura) a 390 px nas sete telas: altura medida e comparada com a da moldura sem o atalho "Meu canal"; nada se sobrepõe nem sai da janela', async ({ page }) => {
  const ROTAS: Array<[string, string, string]> = [
    ['Canais', `${LISTA}?fmt=longos`, '.obs-ch-head'], ['Mudanças', `${LISTA}/mudancas`, '.obs-ch-head'], ['Outliers', `${LISTA}/outliers`, '.obs-ch-head'], ['Insights', `${LISTA}/insights`, '.obs-ch-head'],
    ['Página do canal', `${CANAL}/${LEO()}`, '.obs-tr-top'], ['Comparação', par(OWN(), LEO()), '.obs-tr-top'],
  ]
  const linhasMedidas: string[] = []
  for (const [nome, url, sel] of ROTAS) {
    await page.setViewportSize(VP.w390)
    const resp = await page.goto(url)
    expect(resp?.status(), nome).toBe(200)
    await page.locator(sel + ':visible').first().waitFor({ timeout: 60_000 })
    await page.waitForLoadState('networkidle')
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
    const medir = () => page.locator(sel + ':visible').first().evaluate((e, nome) => {
      const r = e.getBoundingClientRect()
      const fora = [...e.querySelectorAll('*')].filter(x => { const b = x.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 1 || b.left < -1) }).map(x => `${x.tagName}.${String(x.className).slice(0, 14)}`).slice(0, 3)
      return { h: Math.round(r.height), fora, nome }
    }, nome)
    const depois = await medir()
    // "antes" = a moldura sem o atalho (o CSS de `c2eac82a` não tinha o grupo quebrável nem o botão): esconde o atalho e devolve o `nowrap` antigo
    await page.addStyleTag({ content: '[data-meu-canal]{display:none!important}[data-obs] .obs-ch-actions{flex-wrap:nowrap!important}' })
    const antes = await medir()
    linhasMedidas.push(`${nome}: antes (sem o atalho) ${antes.h} px, depois ${depois.h} px (${depois.h - antes.h >= 0 ? '+' : ''}${depois.h - antes.h}); fora da janela depois: ${depois.fora.join(',') || 'nada'}`)
    expect(depois.fora, `${nome} a 390 px: nada do topo sai da janela`).toEqual([])
    expect(depois.h - antes.h, `${nome}: o atalho não pode custar mais que uma linha de botão (44 px)`).toBeLessThanOrEqual(46)
  }
  medida(`topo a 390 px: ${linhasMedidas.join(' | ')}`)
  // Histórico do vídeo (com pager)
  await aberturaDoCanal(page, LEO(), VP.w390)
  await doCanal(page).locator('a[id^="cv-lnk-"]').first().click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  const h = await page.locator('.obs-tr-top:visible').first().evaluate(e => Math.round(e.getBoundingClientRect().height))
  await page.addStyleTag({ content: '[data-meu-canal]{display:none!important}' })
  const h0 = await page.locator('.obs-tr-top:visible').first().evaluate(e => Math.round(e.getBoundingClientRect().height))
  medida(`topo a 390 px, Histórico do vídeo: antes (sem o atalho) ${h0} px, depois ${h} px`)
  expect(h - h0).toBeLessThanOrEqual(46)
})

test('a trilha do Histórico com nome de canal longo ainda cabe ao lado do pager e do atalho entre 1181 e 1400 px de janela (sem sobreposição, sem sair da janela)', async ({ page }) => {
  test.setTimeout(240_000)
  await aberturaDoCanal(page, LEO(), VP.w1440)
  await doCanal(page).locator('a[id^="cv-lnk-"]').first().click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  const nome = 'Canal de Viagens e Aventuras pelo Mundo com Nome Bem Comprido'
  await page.locator('.obs-tr-top:visible nav.crumbs li').nth(1).evaluate((e, n) => { const a = e.querySelector('a') ?? e; a.textContent = n }, nome)
  const resumo: string[] = []
  for (const w of [1181, 1200, 1280, 1366, 1400]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(200)
    const m = await medirTrilha(page, w)
    const linhasDaTrilha = Math.round(m.linha.h / 26)
    resumo.push(`${w}: linha ${m.linha.w} x ${m.linha.h} (${linhasDaTrilha} linha(s)); trilha ${m.partes.trilha.x}..${m.partes.trilha.r}; atalho ${m.partes.atalho.x}..${m.partes.atalho.r}; pager ${m.partes.pager ? m.partes.pager.x + '..' + m.partes.pager.r : '-'}; fuso ${m.partes.fuso.x}..${m.partes.fuso.r}; sobrepõe: ${m.sobrepoe.join(',') || 'não'}; fora: ${m.fora.join(',') || 'não'}`)
    expect(m.sobrepoe, `${w} px`).toEqual([]); expect(m.fora, `${w} px`).toEqual([])
    expect(await semRolagemH(page), `${w} px`).toEqual([])
  }
  medida(`trilha do Histórico com nome longo ("${nome}"): ${resumo.join(' || ')}`)
  await page.screenshot({ path: foto('trilha-nome-longo-1181.png') })
})

/* ------------------------------------------------------------------------------------------------ tempo e medidas */
test('tempo: da lista de Canais (clique em "Comparar") até a tela pronta; altura até "Número a número"; linhas da Leitura rápida a 390 px; documento da rota', async ({ page }) => {
  await page.setViewportSize(VP.w1440)
  await page.goto(`${LISTA}?fmt=longos`)
  await page.locator('[data-obs-screen="canais"] .toolbar:visible').first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  const t0 = Date.now()
  await page.locator(`[data-obs-screen="canais"]:visible a[data-comparar="${LEO()}"]`).first().click()
  await tela(page).locator('table').waitFor({ timeout: 60_000 })
  const ate = Date.now() - t0
  await page.waitForLoadState('networkidle')
  const pronta = Date.now() - t0
  medida(`da lista (clique em "Comparar") até a tabela visível: ${ate} ms; até a rede assentar: ${pronta} ms (next dev, rota já compilada pelos testes anteriores)`)
  expect(ate, 'a tela abre em menos de 10 s mesmo no next dev').toBeLessThan(10_000)
  const altura = async () => tela(page).evaluate(raiz => {
    const h2 = [...raiz.querySelectorAll('h2')].find(h => h.textContent!.startsWith('Número a número'))!
    const topoTela = raiz.getBoundingClientRect().top
    return { ate: Math.round(h2.getBoundingClientRect().top - topoTela), total: Math.round(raiz.getBoundingClientRect().height) }
  })
  const a1440 = await altura()
  await page.setViewportSize(VP.w390); await page.waitForTimeout(200)
  const a390 = await altura()
  medida(`altura do topo da tela até "Número a número": ${a1440.ate} px a 1440, ${a390.ate} px a 390 (tela inteira ${a1440.total} / ${a390.total} px)`)
  const lr = await tela(page).evaluate(raiz => {
    const itens = [...raiz.querySelectorAll<HTMLElement>('.cp-lr li')]
    return itens.map(li => { const cs = getComputedStyle(li.querySelector('.lr-t')!); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5; return { linhas: Math.round(li.getBoundingClientRect().height / lh), h: Math.round(li.getBoundingClientRect().height), texto: (li.textContent ?? '').slice(0, 70) } })
  })
  const totalLinhas = lr.reduce((s, x) => s + x.linhas, 0)
  medida(`Leitura rápida a 390 px: ${lr.length} itens, ${totalLinhas} linhas no total (${lr.map(x => x.linhas).join(' + ')}); o maior item: ${Math.max(...lr.map(x => x.linhas))} linhas`)
  expect(lr.length).toBeGreaterThan(0)
})

// A casca do CMS (a barra de cima, fora desta tela) passa de 320 px; a tela da comparação em si cabe (264/264, medido no teste de larguras acima). Mesma pendência da lista de Canais.
test.fixme('a página não rola na horizontal a 320 px: a casca do CMS (div.flex.flex-col e o <main>) mede 337 px de largura rolável (> 320); a tela da comparação, 264 de 264', async ({ page }) => {
  await abrir(page, par(OWN(), LEO()), { width: 320, height: 800 })
  expect(await rolaNaHorizontal(page), 'nada rola na horizontal a 320 px').toEqual([])
})
