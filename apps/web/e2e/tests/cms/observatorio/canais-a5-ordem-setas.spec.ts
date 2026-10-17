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
// A5_TEMA=light roda a spec no tema claro (padrão: escuro); A5_SHOTS=<pasta> salva uma captura por caso
const TEMA = process.env.A5_TEMA === 'light' ? 'light' : 'dark'
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
  await page.context().addCookies([{ name: 'btf_theme', value: TEMA, url: 'http://localhost:3099' }])
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
test.afterEach(async ({ page }, info) => {
  if (process.env.A5_SHOTS) { const v = page.viewportSize()?.width ?? 0; await page.screenshot({ path: `${process.env.A5_SHOTS}/${info.title.split('.')[0]}-${v}-${TEMA}.png` }).catch(() => {}) }
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
  await expect.poll(() => param(page, 'fmt'), { timeout: 30_000 }).not.toBeNull()
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
  // A4: o nome de um concorrente leva à PÁGINA do canal (o painel lateral não abre mais)
  await linhaDe(page, NOME_A).locator('.nmbtn').first().click()
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toMatch(/\/competitors\/canal\/[^/]+$/)
})

// toque de verdade: `tap()` exige hasTouch e o alvo de 44 px vive em `@media (pointer: coarse)` (isMobile)
test.describe('celular', () => {
test.use({ hasTouch: true, isMobile: true })
test('6. 390 px: barra presa, Direção inverte, Trocas visível, alvos, dica abre e fecha, caixa dentro da janela', async ({ page }) => {
  await abrir(page, D390)
  const barra = page.getByTestId('canais-sortbar').locator('visible=true').first()
  await expect(barra).toBeVisible()
  // presa logo abaixo da barra do topo depois de rolar 2.000 px (não em 0: com `top: 0` ficaria por baixo dela)
  await rolarPara(page, 2000)
  await page.waitForTimeout(300)
  const topo = await caixa(page.locator('.cms-topbar').first())
  const b0 = await caixa(barra)
  if (process.env.A5_SHOTS) await page.screenshot({ path: `${process.env.A5_SHOTS}/6c-presa-390-${TEMA}.png` })
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
  const botoes = await Promise.all((await barra.getByRole('button').all()).map(caixa))
  const linhasBarra = new Set(botoes.map(b => Math.round(b.y))).size
  test.info().annotations.push({ type: 'barra', description: `h=${bb.h} linhas=${linhasBarra} botoes=${botoes.map(b => `${Math.round(b.w)}x${Math.round(b.h)}`).join(',')} tema=${TEMA}` })
  if (process.env.A5_SHOTS) await barra.screenshot({ path: `${process.env.A5_SHOTS}/6b-barra-390-${TEMA}.png` })
  console.log(`BARRA390 caixa=${Math.round(bb.x)}..${Math.round(bb.right)} cartao=${Math.round((await caixa(page.locator(`${S}:visible .cards article`).first())).x)} h=${bb.h} linhas=${linhasBarra} botoes=${botoes.map(b => `${Math.round(b.w)}x${Math.round(b.h)}@${Math.round(b.x)},${Math.round(b.y)}`).join(' ')}`)
  expect.soft(bb.h, 'altura da barra (<= 112 px; se passar, devolver ao controlador)').toBeLessThanOrEqual(112)
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
  await expect.poll(() => param(page, 'sort') ?? 'vpd', { timeout: 10_000 }).toBe('vpd') // vpd é a ordenação padrão: a URL não leva sort=
  await expect(tela(page)).toBeVisible()
})

// 8. Regressão: `canais-a3.spec.ts` inteiro, com FAIXA_SEM_POSICAO no lugar do texto antigo (rodar o arquivo à parte).

test('8. 1440 px, Tab por linha: uma parada entre as dicas, setas andam, Enter/Esc/Tab', async ({ page }) => {
  await abrir(page, D1440)
  const linha = page.locator(`${S}:visible tbody tr.row`).first()
  const dicas = linha.locator('[data-cdica]')
  const n = await dicas.count()
  expect(n, 'a linha tem várias dicas').toBeGreaterThan(2)
  // uma única parada de Tab entre as dicas da linha
  expect(await linha.locator('[data-cdica][tabindex="0"]').count(), 'dicas com tabIndex=0 na linha').toBe(1)
  expect(await linha.locator('[data-cdica][tabindex="-1"]').count()).toBe(n - 1)
  // entra na linha pela primeira parada, anda com as setas
  await linha.locator('[data-cdica][tabindex="0"]').focus()
  await expect(page.getByRole('tooltip').first()).toBeVisible()
  const idDe = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.closest('td')?.getAttribute('data-col') ?? 'fora')
  const c0 = await idDe()
  await page.keyboard.press('ArrowRight')
  const c1 = await idDe()
  expect(c1, 'seta direita muda de dica').not.toBe(c0)
  await page.keyboard.press('ArrowRight')
  const c2 = await idDe()
  expect(c2).not.toBe(c1)
  await page.keyboard.press('ArrowLeft')
  expect(await idDe(), 'seta esquerda volta').toBe(c1)
  // a ativa passou a ser a única parada
  expect(await linha.locator('[data-cdica][tabindex="0"]').count()).toBe(1)
  expect(await page.evaluate(() => (document.activeElement as HTMLElement).getAttribute('tabindex'))).toBe('0')
  // Esc fecha e mantém o foco; Enter reabre
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  expect(await idDe(), 'Esc mantém o foco').toBe(c1)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tooltip').first()).toBeVisible()
  // Enter/Espaço com a dica JÁ aberta a MANTÊM aberta (não alterna); fecha só com Esc, Tab ou ao sair
  for (const tecla of ['Enter', ' ']) {
    await page.keyboard.press(tecla)
    await page.waitForTimeout(150)
    await expect(page.getByRole('tooltip').first(), `${JSON.stringify(tecla)} com a dica aberta mantém aberta`).toBeVisible()
    expect(await page.evaluate(() => (document.activeElement as HTMLElement).getAttribute('aria-expanded'))).toBe('true')
  }
  // Tab fecha a dica e o foco sai da dica (não vai para outra dica da mesma linha)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  const aposTab = await page.evaluate(() => { const a = document.activeElement as HTMLElement; return { cdica: a.hasAttribute('data-cdica'), mesmaLinha: !!a.closest('tr.row') && a.closest('tr.row') === document.querySelector('[data-obs-screen="canais"] tbody tr.row') } })
  expect(aposTab.cdica && aposTab.mesmaLinha, 'Tab não cai noutra dica da mesma linha').toBe(false)
  // Tab pela lista inteira: no máximo 1 dica por linha e o foco chega ao fim sem ficar preso
  const vistos: string[] = []
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press('Tab')
    const s = await page.evaluate(() => { const a = document.activeElement as HTMLElement; const tr = a.closest('tr.row'); return { ok: a !== document.body, id: tr?.getAttribute('data-id') ?? '', d: a.hasAttribute('data-cdica') } })
    if (s.d) vistos.push(s.id)
  }
  const porLinha = vistos.reduce<Record<string, number>>((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {})
  expect(Math.max(0, ...Object.values(porLinha)), 'paradas de dica por linha no Tab corrido').toBeLessThanOrEqual(1)
  expect(Object.keys(porLinha).length, 'o Tab corrido atravessa várias linhas').toBeGreaterThan(2)
})

test('9. 1280 px com o painel aberto: a coluna escondida não deixa a linha sem parada de Tab', async ({ page }) => {
  // O painel REAL só abre para canal próprio sem vídeos, que a semente não tem (concorrente e próprio com vídeos vão para a página do canal).
  // Por isso o estado `.drawer-open` (que esconde `.c-hide` a partir de 1280 px) é posto na raiz por script, com o foco na dica que vai sumir.
  await abrir(page, { width: 1280, height: 900 })
  const linha = page.locator(`${S}:visible tbody tr.row`).nth(1)
  const escondida = linha.locator('.c-hide [data-cdica]').first()
  expect(await escondida.count(), 'a linha tem dica em coluna escondível (o cenário existe)').toBe(1)
  await escondida.focus() // a ativa da linha passa a ser a dica da coluna que vai sumir
  expect(await escondida.getAttribute('tabindex')).toBe('0')
  await page.evaluate(() => document.querySelector('[data-obs-screen="canais"]')!.classList.add('drawer-open'))
  expect(await escondida.evaluate(e => getComputedStyle(e.closest('.c-hide')!).display), 'a coluna some com o painel').toBe('none')
  await page.waitForTimeout(300)
  const estado = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-obs-screen="canais"].drawer-open tbody tr.row')].map(tr => {
    const vis = [...tr.querySelectorAll<HTMLElement>('[data-cdica]')].filter(d => { for (let n: HTMLElement | null = d; n && n !== tr; n = n.parentElement) if (getComputedStyle(n).display === 'none') return false; return true })
    return { id: tr.getAttribute('data-id'), visiveis: vis.length, paradas: vis.filter(d => d.tabIndex === 0).length }
  }))
  expect(estado.length).toBeGreaterThan(2)
  for (const e of estado) expect(e.paradas, `linha ${e.id}: exatamente 1 parada de Tab entre as dicas visíveis (${JSON.stringify(e)})`).toBe(1)
  // Tab de verdade pela lista: o foco nunca para em coluna escondida e atravessa várias linhas
  await page.locator(`${S}.drawer-open tbody tr.row [data-cdica][tabindex="0"]`).first().focus()
  const vistos = new Set<string>()
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab')
    const s = await page.evaluate(() => { const a = document.activeElement as HTMLElement; return { id: a.closest('tr.row')?.getAttribute('data-id') ?? '', d: a.hasAttribute('data-cdica'), escondido: !!a.closest('.c-hide') } })
    expect(s.escondido, 'o foco nunca para em coluna escondida').toBe(false)
    if (s.d) vistos.add(s.id)
  }
  expect(vistos.size, 'o Tab corrido para em dicas de várias linhas').toBeGreaterThan(2)
})

test('10. 1440 px: Views/dia alinhado com as colunas vizinhas e com largura mínima 128', async ({ page }) => {
  await abrir(page, D1440)
  const m = await page.evaluate(() => {
    const raiz = [...document.querySelectorAll('[data-obs-screen="canais"]')].find(e => e.getClientRects().length > 0)!
    const th = (k: string) => raiz.querySelector<HTMLElement>(`thead th[data-k="${k}"]`)
    const med = (k: string) => { const t = th(k); const b = t?.querySelector('button'); return t && b ? { w: t.getBoundingClientRect().width, top: b.getBoundingClientRect().top, h: b.getBoundingClientRect().height } : null }
    return { vpd: med('vpd'), outliers: med('outliers'), active: med('active'), swaps: med('swaps') }
  })
  expect(m.vpd, 'th Views/dia existe').not.toBeNull()
  expect(m.vpd!.w, 'largura do th Views/dia').toBeGreaterThanOrEqual(127)
  // as vizinhas de Views/dia, Trocas incluída (L6: th com vertical-align:top; antes a unidade longa de Trocas subia o botão 15 px)
  for (const k of ['outliers', 'active', 'swaps'] as const) {
    if (m[k]) expect(Math.abs(m[k]!.top - m.vpd!.top), `topo do botão ${k} vs Views/dia (${JSON.stringify(m)})`).toBeLessThanOrEqual(2)
  }
})
