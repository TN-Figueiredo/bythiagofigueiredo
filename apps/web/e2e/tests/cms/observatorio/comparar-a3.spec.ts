// apps/web/e2e/tests/cms/observatorio/comparar-a3.spec.ts
// Teste de fumaça da tela de comparação (A3, tarefa 8; a prova completa é da tarefa 11): a rota abre logada com um par da semente, a tabela tem as
// linhas, trocar o seletor não navega, "Inverter lados" troca os lados, ids ruins na URL não dão 500, sem erro de console, sem rolagem horizontal a
// 1440 e a 390 px. Esta tela não escreve nada; o spec só semeia o banco local e reseta as preferências do visualizador (`resetViewerPrefs`), e todo POST de server action é abortado e reprova o teste. As medidas vão para test-results/comparar-a3-medidas.txt.
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STATE, ensureSeeded, seedIdsOf } from './fidelity'
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
