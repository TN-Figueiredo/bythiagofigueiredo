// apps/web/e2e/tests/cms/observatorio/canais-a3.spec.ts
// A prova, no navegador de verdade, da lista de Canais da fase A3 (tarefas 1 a 3: filtro de formato, lista única com posição, bloco "Seus canais",
// linha presa no pé, busca). O que o jsdom não mede: rolagem de `main`, IntersectionObserver com raiz em `main`, foco, largura real, cinza, tema,
// o histórico do navegador. Semente: oráculo + dois canais próprios (ownPreset '2'); o canal próprio não tem leitura diária em produção, então
// em Views/dia ele fica sem posição e em Inscritos tem posição. Nada é escrito no banco: todo POST de server action é abortado e reprova o teste.
// As medidas vão para test-results/canais-a3-medidas.txt (e para as anotações de cada teste).
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page, type Locator } from '@playwright/test'
import { ADMIN_STATE, ensureSeeded, seedIdsOf, THEMES } from './fidelity'
import { CANAL_COMPLETO, resetViewerPrefs } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

test.use({ storageState: ADMIN_STATE })
let ids: ReturnType<typeof seedIdsOf>
const MEDIDAS = path.resolve(__dirname, '../../../../test-results/canais-a3-medidas.txt')
const SHOTS = path.resolve(__dirname, '../../../../test-results/canais-a3')
// canalCompleto: matt-wolfe ganha um vídeo com formato não confirmado (a dica "formato não confirmado (N)" só existe com isto)
const SEED2 = { ownPreset: '2' as const, canalCompleto: true }
test.beforeAll(async () => {
  test.setTimeout(240_000)
  ids = seedIdsOf(await ensureSeeded(SEED2))
  fs.mkdirSync(path.dirname(MEDIDAS), { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true })
})
function medida(texto: string): void {
  fs.appendFileSync(MEDIDAS, `[${test.info().title.slice(0, 60)}] ${texto}\n`)
  test.info().annotations.push({ type: 'medida', description: texto })
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const S = '[data-obs-screen="canais"]'
const ROTA = '/cms/youtube/competitors'
const VP = { w1440: { width: 1440, height: 900 }, alto: { width: 1440, height: 2100 } } as const
/** Falhas do teste em curso: server action que escapou, erro de console, resposta 5xx. */
let intrusos: string[] = [], erros: string[] = [], cincoXX: string[] = []
test.beforeEach(async ({ page }) => {
  test.setTimeout(150_000)
  intrusos = []; erros = []; cincoXX = []
  // o chrome grava o nicho de um ?niche= nas preferências de quem vê: sem isto o nicho de um teste vaza para o seguinte
  await resetViewerPrefs(await getSeedSiteId())
  await page.context().addCookies([{ name: 'btf_theme', value: 'dark', url: 'http://localhost:3099' }])
  // FAIL-CLOSED: toda server action (POST com `next-action`) é abortada e reprova o teste no fim
  await page.context().route('**/*', async route => {
    const r = route.request()
    if (r.method() === 'POST' && r.headers()['next-action']) { intrusos.push(`${r.headers()['next-action']} ${r.url()} ${(r.postData() ?? '').slice(0, 120)}`); await route.abort('blockedbyclient'); return }
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
    const w = window as unknown as { __sc: () => HTMLElement; __hist: Array<{ k: string; u: string | null }> }
    // o contêiner que rola: a casca do CMS rola em `main`, não na janela; a raiz é a tela VISÍVEL (depois do Voltar a árvore antiga fica escondida)
    w.__sc = () => {
      const raiz = [...document.querySelectorAll('[data-obs-screen]')].find(e => e.getClientRects().length > 0) ?? document.querySelector('[data-obs-screen]')
      for (let p = raiz?.parentElement ?? null; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY
        if ((o === 'auto' || o === 'scroll' || o === 'overlay') && p.scrollHeight > p.clientHeight + 1) return p
      }
      return (document.scrollingElement ?? document.documentElement) as HTMLElement
    }
    // tudo que a página grava no histórico (o `router.replace` do Next chega aqui)
    w.__hist = []
    for (const k of ['pushState', 'replaceState'] as const) {
      const o = history[k].bind(history)
      history[k] = (s: unknown, t: string, u?: string | URL | null) => { w.__hist.push({ k, u: u == null ? null : String(u) }); return o(s, t, u) }
    }
  })
})
test.afterAll(async () => { await resetViewerPrefs(await getSeedSiteId()) })
test.afterEach(() => {
  if (intrusos.length) throw new Error(`Server action INESPERADA abortada (nada chegou ao servidor): ${intrusos.length}. Primeira: ${intrusos[0]}`)
  expect(cincoXX, 'respostas 5xx').toEqual([])
  expect(erros, 'erros de console').toEqual([])
})

type W = { __sc: () => HTMLElement; __hist: Array<{ k: string; u: string | null }> }
const rolagem = (page: Page) => page.evaluate(() => (window as unknown as W).__sc().scrollTop)
const rolarPara = (page: Page, top: number) => page.evaluate(t => { (window as unknown as W).__sc().scrollTop = t }, top)
const historico = (page: Page) => page.evaluate(() => (window as unknown as W).__hist)
const caixa = (l: Locator) => l.evaluate(e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, bottom: Math.round(r.bottom), right: Math.round(r.right) } })
const param = (page: Page, k: string) => new URL(page.url()).searchParams.get(k)
const tela = (page: Page) => page.locator(`${S}:visible`).first()

async function esperarParado(page: Page, l: Locator): Promise<void> {
  let ultimo = '', igual = 0
  for (let i = 0; i < 40 && igual < 3; i++) {
    const agora = JSON.stringify(await l.boundingBox())
    igual = agora === ultimo ? igual + 1 : 0; ultimo = agora
    await page.waitForTimeout(100)
  }
}
/** Espera a tela, a gravação do `fmt` na URL e a hidratação (os cliques antes dela se perdem). */
async function pronta(page: Page, esperarFmt = true): Promise<void> {
  await page.locator(`${S} .toolbar:visible`).first().waitFor({ timeout: 60_000 })
  await page.locator(`${S} table:visible, ${S} .cards:visible`).first().waitFor({ timeout: 30_000 })
  if (esperarFmt) await expect.poll(() => param(page, 'fmt'), { timeout: 15_000 }).not.toBeNull()
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
  await esperarParado(page, page.locator(`${S} .toolbar:visible`).first())
}
async function abrir(page: Page, qs = '', size: { width: number; height: number } = VP.w1440): Promise<void> {
  await page.setViewportSize(size)
  await page.goto(ROTA + qs)
  await pronta(page)
}
/** Espera a lista nova depois de uma troca de URL (a tela marca a lista antiga com aria-busy até o servidor responder). */
async function assentou(page: Page): Promise<void> {
  await expect(page.locator(`${S}:visible [aria-busy="true"]`)).toHaveCount(0, { timeout: 20_000 })
  await page.waitForTimeout(250)
}
const botaoFmt = (page: Page, nome: 'Todos' | 'Longos' | 'Shorts') => page.locator(`${S}:visible [role="group"][aria-label="Formato"] button`).filter({ hasText: new RegExp(`^${nome}$`) }).first()
const fmtPressionado = (page: Page) => page.locator(`${S}:visible [role="group"][aria-label="Formato"] button[aria-pressed="true"]`).first().textContent()
const ordemIds = (page: Page) => page.evaluate(() => {
  const raiz = [...document.querySelectorAll('[data-obs-screen="canais"]')].find(e => e.getClientRects().length > 0)!
  return [...raiz.querySelectorAll<HTMLElement>('tbody tr.row, .cards article')].map(e => e.dataset.id!)
})
const idDoPrimeiroProprio = () => ids.own('tnfigueiredo')
const donoLinha = (page: Page) => page.locator(`${S}:visible tbody tr.row[data-id="${idDoPrimeiroProprio()}"]`).first()
const blocoLinha = (page: Page, id = idDoPrimeiroProprio()) => page.locator(`${S}:visible [data-own-block] li[data-own-id="${id}"]`).first()
const pe = (page: Page) => page.locator(`${S}:visible .cn-pin`).first()
const peVisivel = (page: Page) => pe(page).evaluate(e => !e.hasAttribute('hidden') && e.getClientRects().length > 0)
const anuncioOrd = (page: Page) => page.locator(`${S}:visible [data-k="ord-anuncio"]`).first().textContent().then(t => (t ?? '').trim())
/** Clica na coluna de verdade (mouse), sem rolar a tela (a caixa já está na janela). */
async function clicarColuna(page: Page, k: string): Promise<void> {
  const b = page.locator(`${S}:visible thead th[data-k="${k}"] button`).first()
  const r = await caixa(b)
  expect(r.y, `o cabeçalho de ${k} está na janela`).toBeGreaterThanOrEqual(0)
  expect(r.bottom).toBeLessThanOrEqual(page.viewportSize()!.height)
  await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2)
  await page.mouse.down(); await page.mouse.up()
}
async function ordenarPor(page: Page, k: string): Promise<void> {
  await rolarPara(page, 0)
  const b = page.locator(`${S}:visible thead th[data-k="${k}"] button`).first()
  await b.scrollIntoViewIfNeeded()
  await b.click()
  await assentou(page)
}

/* ================================================================== A3.1 */
test('A3.1 o controle tem Todos, Longos e Shorts; a URL ganha fmt= ao abrir (UM replace, o Voltar não prende) e a cada troca; recarregar mantém', async ({ page }) => {
  fs.writeFileSync(MEDIDAS, `# canais-a3.spec.ts — ${new Date().toISOString()}\n`) // o arquivo nasce aqui: cada teste que falha reinicia o processo e o beforeAll roda de novo
  await page.goto('about:blank')
  await page.setViewportSize(VP.w1440)
  await page.goto(ROTA)
  await pronta(page)
  expect(param(page, 'fmt')).toBe('longos')
  const h = await historico(page)
  const gravacoes = [...new Set(h.filter(x => x.u && /fmt=/.test(x.u)).map(x => x.u))]
  medida(`primeira visita sem fmt: ${h.length} chamadas ao histórico; URLs com fmt=: ${JSON.stringify(gravacoes)}; pushState: ${h.filter(x => x.k === 'pushState').length}`)
  expect(gravacoes, 'um único destino com fmt= na primeira visita').toHaveLength(1)
  expect(h.filter(x => x.k === 'pushState'), 'nenhum pushState').toHaveLength(0)
  expect(await botaoFmt(page, 'Longos').getAttribute('aria-pressed')).toBe('true')
  expect(await page.locator(`${S}:visible [role="group"][aria-label="Formato"] button`).allTextContents()).toEqual(['Todos', 'Longos', 'Shorts'])
  // trocar: sempre na URL, também Longos; cada troca é um replace (o histórico não cresce)
  await botaoFmt(page, 'Todos').click(); await expect.poll(() => param(page, 'fmt')).toBe('todos'); await assentou(page)
  expect(await fmtPressionado(page)).toBe('Todos')
  await botaoFmt(page, 'Shorts').click(); await expect.poll(() => param(page, 'fmt')).toBe('shorts'); await assentou(page)
  expect(await fmtPressionado(page)).toBe('Shorts')
  await botaoFmt(page, 'Longos').click(); await expect.poll(() => param(page, 'fmt')).toBe('longos'); await assentou(page)
  await botaoFmt(page, 'Todos').click(); await expect.poll(() => param(page, 'fmt')).toBe('todos'); await assentou(page)
  await page.reload(); await pronta(page)
  expect(param(page, 'fmt'), 'recarregar mantém').toBe('todos')
  expect(await fmtPressionado(page)).toBe('Todos')
  // o Voltar leva para a página de antes da lista: nenhuma entrada de histórico foi acrescentada pelo fmt
  await page.goBack({ waitUntil: 'commit' })
  await expect.poll(() => page.url()).toBe('about:blank')
  await page.goForward()
  await pronta(page)
  expect(param(page, 'fmt')).toBe('todos')
})

test('A3.1 o formato lembrado (localStorage) é o gravado na primeira visita sem fmt, uma vez só; sem armazenamento a tela abre em Longos', async ({ page }) => {
  await page.goto('about:blank')
  await page.goto(ROTA); await pronta(page)
  await botaoFmt(page, 'Shorts').click(); await expect.poll(() => param(page, 'fmt')).toBe('shorts'); await assentou(page)
  expect(await page.evaluate(() => localStorage.getItem('obs:canais-fmt'))).toBe('shorts')
  // visita nova, sem fmt: o servidor desenha Longos e o navegador grava o lembrado
  await page.goto(ROTA)
  await pronta(page)
  await assentou(page)
  expect(param(page, 'fmt')).toBe('shorts')
  expect(await fmtPressionado(page)).toBe('Shorts')
  const h = await historico(page)
  const gravacoes = [...new Set(h.filter(x => x.u && /fmt=/.test(x.u)).map(x => x.u))]
  medida(`lembrado = shorts: destinos gravados ${JSON.stringify(gravacoes)}`)
  expect(gravacoes).toHaveLength(1)
  // lixo no armazenamento: Longos
  await page.evaluate(() => localStorage.setItem('obs:canais-fmt', 'abc'))
  await page.goto(ROTA); await pronta(page)
  expect(param(page, 'fmt')).toBe('longos')
  // armazenamento que lança: a tela abre em Longos (o init roda antes da página)
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqueado') } }) })
  await page.goto(ROTA); await pronta(page)
  expect(param(page, 'fmt')).toBe('longos')
})

test('A3.1 link antigo fmt=short abre em Shorts e fmt=long em Longos (sem reescrever); fmt=abc e fmt= abrem em Longos sem erro, sem 500 e a URL vira válida', async ({ page }) => {
  await abrir(page, '?fmt=short')
  expect(await fmtPressionado(page)).toBe('Shorts')
  expect(param(page, 'fmt'), 'o link antigo continua como está').toBe('short')
  await expect(page.locator(`${S}:visible [data-k="fmt-nota"]`)).toContainText('Só Shorts')
  await abrir(page, '?fmt=long')
  expect(await fmtPressionado(page)).toBe('Longos')
  expect(param(page, 'fmt')).toBe('long')
  for (const ruim of ['?fmt=abc', '?fmt=', '?fmt=TODOS', '?fmt=abc&sort=subs&scale=abs']) {
    await abrir(page, ruim)
    expect(await fmtPressionado(page), ruim).toBe('Longos')
    expect(param(page, 'fmt'), ruim).toBe('longos')
    if (ruim.includes('sort=subs')) { expect(param(page, 'sort')).toBe('subs'); expect(param(page, 'scale')).toBe('abs') }
    // nenhuma mensagem de erro na tela (o anunciador de rota do Next é a única coisa com role=alert que não é da página)
    expect(await page.evaluate(() => [...document.querySelectorAll('[role="alert"]')].filter(e => !e.closest('next-route-announcer') && e.getClientRects().length > 0).map(e => (e.textContent ?? '').trim().slice(0, 80))), ruim).toEqual([])
  }
})

test('(c) a URL muda por outro motivo (ordenação, escala, visualização, painel do canal próprio, "só com problema", nicho na URL): nada é apagado e nada é regravado sem o fmt', async ({ page }) => {
  await abrir(page, '?fmt=todos')
  const antes = (await historico(page)).length
  await ordenarPor(page, 'subs')
  await page.locator(`${S}:visible [role="group"][aria-label="Escala de views/dia"] button`).filter({ hasText: /^Absoluto$/ }).first().click()
  await expect.poll(() => param(page, 'scale')).toBe('abs'); await assentou(page)
  await page.getByRole('button', { name: 'Abrir meu canal: tnFigueiredo', exact: true }).first().click()
  await expect.poll(() => param(page, 'channel')).toBe(idDoPrimeiroProprio())
  await expect(page.locator(`${S}:visible .cn-drawer`)).toBeVisible({ timeout: 15_000 })
  await page.keyboard.press('Escape')
  await expect.poll(() => param(page, 'channel')).toBeNull()
  const u0 = new URL(page.url())
  expect([u0.searchParams.get('fmt'), u0.searchParams.get('sort'), u0.searchParams.get('scale')], 'ordenar, escala e painel não apagam nada').toEqual(['todos', 'subs', 'abs'])
  // o link do modelo "Ver só canais com problema" leva o fmt (a Tarefa 1) mas parte de uma URL própria: a ordenação e a escala NÃO viajam nele (anterior à A3)
  await page.locator(`${S}:visible a`, { hasText: /^Ver só canais com problema/ }).first().click()
  await expect.poll(() => param(page, 'filter')).toBe('problemas'); await assentou(page)
  const u = new URL(page.url())
  medida(`depois de ordenar, escala, painel e filtro: ${u.search} (o link do filtro perde sort= e scale=, como antes da A3)`)
  expect([u.searchParams.get('fmt'), u.searchParams.get('filter')]).toEqual(['todos', 'problemas'])
  const novas = (await historico(page)).slice(antes).filter(x => x.u && x.u.startsWith(ROTA))
  expect(novas.length).toBeGreaterThan(3)
  for (const x of novas) expect(x.u, `${x.k} sem fmt`).toMatch(/fmt=todos/)
  // outra entrada sem fmt, com nicho e ordenação: o fmt entra, os outros ficam
  await page.goto(ROTA + '?niche=viagem&sort=subs&dir=asc&scale=abs')
  await pronta(page)
  const v = new URL(page.url())
  expect(Object.fromEntries(v.searchParams)).toEqual({ niche: 'viagem', sort: 'subs', dir: 'asc', scale: 'abs', fmt: 'longos' })
  // (c) um link do chrome (aba Canais) leva a uma URL sem fmt: o fmt volta, o nicho fica
  await page.goto(ROTA + '?niche=ia&fmt=shorts')
  await pronta(page)
  expect(param(page, 'niche')).toBe('ia'); expect(param(page, 'fmt')).toBe('shorts')
})

test('A3.1 Todos mostra duas medidas por célula e o cabeçalho diz "longos em cima, Shorts embaixo"; conta as linhas inteiras na dobra', async ({ page }) => {
  await abrir(page, '?fmt=longos')
  async function emDobra() {
    return page.evaluate(() => {
      const w = window as unknown as W
      const sc = w.__sc()
      const raiz = [...document.querySelectorAll('[data-obs-screen="canais"]')].find(e => e.getClientRects().length > 0)!
      const thead = raiz.querySelector('thead')!
      sc.scrollTop += thead.getBoundingClientRect().top - sc.getBoundingClientRect().top
      const area = sc.getBoundingClientRect(), hb = thead.getBoundingClientRect().bottom
      const linhas = [...raiz.querySelectorAll('tbody tr.row')].map(r => r.getBoundingClientRect())
      const pinEl = raiz.querySelector<HTMLElement>('.cn-pin')
      const pin = pinEl && !pinEl.hidden ? pinEl.getBoundingClientRect() : null
      const livre = pin ? pin.top - 2 : area.bottom
      const dentro = (limite: number) => linhas.filter(r => r.top >= hb - 1 && r.bottom <= limite + 0.5).length
      return { janela: dentro(area.bottom), semPin: dentro(livre), pin: pin ? Math.round(pin.height) : 0, alturaLinha: Math.round(linhas[0]!.height), alturas: linhas.slice(0, 6).map(r => Math.round(r.height)), cab: Math.round(thead.getBoundingClientRect().height), areaH: Math.round(area.height) }
    })
  }
  const longos = await emDobra()
  // em Longos a mesma linha mostra UMA medida por célula: nenhum rótulo de Shorts
  const emLongos = await page.locator(`${S}:visible tbody tr.row[data-id="${ids.channel('matt-wolfe')}"]`).first().evaluate(tr => ([3, 4, 5] as const).map(n => ({ fm: tr.children[n - 1]!.querySelectorAll('.fm').length, shorts: /Shorts/.test(tr.children[n - 1]!.textContent ?? '') })))
  // (a faixa de Ritmo desenha as barras dos dois formatos e o nome acessível dela cita os Shorts; o número, não)
  expect(emLongos.map(c => c.fm), 'Longos: nenhuma medida empilhada').toEqual([0, 0, 0])
  expect(emLongos.slice(1).map(c => c.shorts), 'Longos: Views/dia e Outliers não citam Shorts').toEqual([false, false])
  await botaoFmt(page, 'Todos').click(); await expect.poll(() => param(page, 'fmt')).toBe('todos'); await assentou(page)
  await rolarPara(page, 0)
  // o cabeçalho: três colunas dizem a regra; a coluna ordenada (Views/dia) diz que ordena pelos longos
  const cabs = await page.locator(`${S}:visible thead [data-cab-fmt]`).allTextContents()
  expect(cabs).toHaveLength(3)
  for (const c of cabs) expect(c).toContain('longos em cima, Shorts embaixo')
  expect(cabs.join(' ')).toContain('ordenado pelos longos')
  // cada célula que depende de formato mostra as DUAS medidas, rotuladas e empilhadas (longos em cima, Shorts embaixo): a linha conhecida da semente é a de
  // Matt Wolfe (longos e Shorts, com outliers só nos longos); Ritmo, Views/dia e Outliers são as três colunas que dependem de formato
  const mw = page.locator(`${S}:visible tbody tr.row[data-id="${ids.channel('matt-wolfe')}"]`).first()
  const celulas = await mw.evaluate(tr => ([3, 4, 5] as const).map(n => {
    const td = tr.children[n - 1] as HTMLElement
    return [...td.querySelectorAll<HTMLElement>('.fm')].map(f => ({ txt: (f.textContent ?? '').replace(/\s+/g, ' ').trim(), top: Math.round(f.getBoundingClientRect().top) }))
  }))
  medida(`Todos, linha de Matt Wolfe: Ritmo ${JSON.stringify(celulas[0]!.map(f => f.txt))}; Views/dia ${JSON.stringify(celulas[1]!.map(f => f.txt))}; Outliers ${JSON.stringify(celulas[2]!.map(f => f.txt))}`)
  for (const [i, nome] of ['Ritmo', 'Views/dia', 'Outliers'].entries()) {
    const f = celulas[i]!
    expect(f, `${nome}: duas medidas na célula`).toHaveLength(2)
    expect(f[1]!.top, `${nome}: a de Shorts fica embaixo da de longos`).toBeGreaterThan(f[0]!.top + 12)
  }
  expect(celulas[0]!.map(f => f.txt)).toEqual(['4,0 longos/sem', '0,7 Shorts/sem'])
  expect(celulas[1]!.map(f => f.txt)).toEqual(['longos: 0,7 636/dia, n = 102', 'Shorts: 0,3 236/dia, n = 18'])
  expect(celulas[2]![0]!.txt).toMatch(/^longos: 6,0× 2 outliers no canal$/)
  expect(celulas[2]![1]!.txt).toMatch(/^Shorts: Nenhum Short com 2× ou mais\. Base fraca \(n = 1\)\.$/)
  const todos = await emDobra()
  await botaoFmt(page, 'Shorts').click(); await expect.poll(() => param(page, 'fmt')).toBe('shorts'); await assentou(page)
  const shorts = await emDobra()
  medida(`linhas INTEIRAS na dobra (janela 1440x900, tabela no alto da área que rola, área de ${longos.areaH} px, cabeçalho de ${longos.cab} px): Longos ${longos.janela} (${longos.semPin} sem a linha presa de ${longos.pin} px; linha de ${longos.alturaLinha} px), Todos ${todos.janela} (${todos.semPin} sem a linha presa; linha de ${todos.alturaLinha} px, cabeçalho ${todos.cab} px), Shorts ${shorts.janela} (${shorts.semPin} sem a linha presa; linha de ${shorts.alturaLinha} px) — o mockup deu 12, 11 e 11 com 70 linhas e outra casca`)
  expect(longos.janela).toBeGreaterThanOrEqual(5)
  expect(todos.janela).toBeGreaterThanOrEqual(4)
})

/** A tabela da tela visível: quanto mede o invólucro, quanto a tabela, e o que passa da própria célula sem reticências. */
const medirTabela = (page: Page) => page.evaluate(() => {
  const raiz = [...document.querySelectorAll('[data-obs-screen="canais"]')].find(e => e.getClientRects().length > 0)!
  const box = raiz.querySelector<HTMLElement>('.tablebox')!, t = raiz.querySelector<HTMLElement>('table')!
  const d = document.documentElement, sc = (window as unknown as W).__sc()
  const cortes: string[] = []
  // (1) elemento com overflow oculto cujo conteúdo passa da caixa: só vale se mostra reticências
  box.querySelectorAll<HTMLElement>('*').forEach(e => {
    if (e.closest('.sr') || e.getClientRects().length === 0) return
    const cs = getComputedStyle(e)
    if (cs.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis') cortes.push(`${e.tagName}.${String(e.className).slice(0, 24)} oculta ${e.scrollWidth - e.clientWidth} px sem reticências`)
  })
  // (2) conteúdo que escapa da própria célula (invade a vizinha)
  box.querySelectorAll<HTMLElement>('tbody td').forEach(td => {
    const r = td.getBoundingClientRect()
    td.querySelectorAll<HTMLElement>('*').forEach(e => {
      // o alvo de toque do "?" (.tip, 32 px) passa 1 a 2 px da célula; o glifo não: não é texto cortado
      if (e.closest('.sr') || e.classList.contains('tip') || e.getClientRects().length === 0) return
      const b = e.getBoundingClientRect()
      if (b.width > 0 && b.right > r.right + 1) cortes.push(`${e.tagName}.${String(e.className).slice(0, 24)} passa ${Math.round(b.right - r.right)} px da célula`)
    })
  })
  return {
    box: box.clientWidth, scroll: box.scrollWidth, tabela: t.offsetWidth, hint: !!raiz.querySelector('[data-scroll-hint]'),
    ressalvas: [...raiz.querySelectorAll<HTMLElement>('.ressalva')].filter(e => e.getClientRects().length > 0).length,
    erros: raiz.querySelectorAll('tbody .sync .msg').length,
    cortes: [...new Set(cortes)].slice(0, 6), docRola: d.scrollWidth > d.clientWidth + 1, mainRola: sc.scrollWidth > sc.clientWidth + 1,
    nomeH: Math.round(raiz.querySelector<HTMLElement>('tbody tr.row .nmbtn')!.getBoundingClientRect().height),
    colunas: [...t.querySelectorAll('thead th')].map(h => `${(h.textContent ?? '').trim().slice(0, 12)}=${Math.round(h.getBoundingClientRect().width)}`).join(' | '),
  }
})
for (const fmt of ['longos', 'shorts', 'todos'] as const) {
  test(`A3.1 a tabela CABE no invólucro a 1440 px em ${fmt} (sem rolagem horizontal da tabela), com canal em erro e a ressalva de dado velho na lista; nenhuma coluna com texto cortado sem reticências`, async ({ page }) => {
    await abrir(page, `?fmt=${fmt}&sort=subs`)
    const m = await medirTabela(page)
    medida(`${fmt} 1440: invólucro ${m.box} px, tabela ${m.tabela} px (scrollWidth ${m.scroll}); ressalvas visíveis ${m.ressalvas}; linhas com mensagem de sincronização ${m.erros}; dica de rolagem ${m.hint}; colunas ${m.colunas}; cortes: ${m.cortes.length ? m.cortes.join(' | ') : 'nenhum'}`)
    expect(m.erros, 'a semente tem canal em erro/atrasado (mensagem na coluna Sincronização)').toBeGreaterThan(0)
    if (fmt === 'todos') expect(m.ressalvas, 'Todos mostra a ressalva de dado velho à vista').toBeGreaterThan(0)
    expect(m.scroll, 'a tabela cabe: o invólucro não rola na horizontal').toBeLessThanOrEqual(m.box)
    expect(m.hint, 'sem rolagem interna não há a dica "Role a tabela"').toBe(false)
    expect(m.cortes).toEqual([])
    expect(m.docRola).toBe(false); expect(m.mainRola).toBe(false)
    expect(m.nomeH, 'o nome do canal não fica comprimido').toBeLessThanOrEqual(34)
  })
}

test('A3.1 abaixo da largura em que a tabela cabe, ela rola por dentro do próprio invólucro (a página não) e a dica "Role a tabela" aparece; a largura natural não passa de 1.148 px', async ({ page }) => {
  for (const fmt of ['longos', 'todos'] as const) for (const w of [1280, 1200]) {
    await abrir(page, `?fmt=${fmt}&sort=subs`, { width: w, height: 900 })
    const m = await medirTabela(page)
    medida(`${fmt} ${w}: invólucro ${m.box} px, largura natural da tabela ${m.tabela} px; rola por dentro: ${m.scroll > m.box + 1}; dica ${m.hint}; a tabela cabe a partir de uma janela de ${w + (m.tabela - m.box)} px (a casca tira ${w - m.box} px)`)
    expect(m.tabela, `${fmt} ${w}: a largura natural da tabela`).toBeLessThanOrEqual(1148)
    expect(m.hint, 'a dica de rolagem aparece exatamente quando a tabela rola por dentro').toBe(m.scroll > m.box + 2)
    expect(m.docRola).toBe(false); expect(m.mainRola).toBe(false)
    expect(m.cortes).toEqual([])
  }
})

/* ================================================================== A3.2 */
test('A3.2 o canal próprio está na posição dele (a do bloco = a da célula = a ordem da lista); trocar a ordenação muda a frase do bloco e o anúncio', async ({ page }) => {
  await abrir(page, '?fmt=longos&sort=subs')
  const linha = blocoLinha(page)
  const tp = (await linha.locator('.tp').textContent())!.trim()
  const lider = /^(\d+)º de (\d+) (no geral|em [^,]+), em inscritos, com ([^.]+(?:\.\d+)?)\./.exec(tp)
  medida(`bloco em Inscritos: "${tp.slice(0, 150)}"`)
  expect(lider, 'a frase tem a posição, o conjunto e o valor').not.toBeNull()
  const pos = Number(lider![1])
  const ordem = await ordemIds(page)
  expect(await donoLinha(page).locator('td.p').textContent()).toContain(`${pos}º`)
  expect(ordem.indexOf(idDoPrimeiroProprio()) + 1, 'sem empate, a posição é o lugar na lista').toBe(pos)
  // o valor da frase é o texto da célula de inscritos
  expect(await donoLinha(page).locator('td:nth-child(2)').textContent()).toContain(lider![4]!.trim())
  // as posições da lista vão de 1 em 1, todos juntos (sem grupos por nicho)
  const posicoes = await page.locator(`${S}:visible tbody tr.row td.p`).allTextContents()
  const nums = posicoes.map(t => parseInt(t, 10)).filter(n => Number.isFinite(n))
  expect(nums.slice(0, 5)).toEqual([1, 2, 3, 4, 5])
  expect(await page.locator(`${S}:visible tbody tr.group:not([data-divisor])`).count()).toBe(0)
  // Views/dia: o canal próprio não tem leitura diária: sem posição, o bloco diz o motivo e o anúncio diz o MESMO motivo
  await ordenarPor(page, 'vpd')
  const motivo = (await blocoLinha(page).locator('.tp').textContent())!.trim()
  medida(`bloco em Views/dia: "${motivo}"`)
  expect(motivo).toContain('Ainda sem views por dia medidas')
  expect(await anuncioOrd(page)).toMatch(/Ainda sem views por dia medidas: a coleta diária do seu canal começa em breve\. Sem posição nesta ordenação\.$/)
  // Ritmo (D3: sem posição escrita, mas o canal TEM medida): o anúncio não diz "sem medida"
  await ordenarPor(page, 'active')
  const frase = (await blocoLinha(page).locator('.tp').textContent())!.trim()
  const anuncio = await anuncioOrd(page)
  medida(`Ritmo: bloco "${frase}"; anúncio "${anuncio}"`)
  expect(frase).toContain('Sem posição escrita nesta ordenação')
  expect(anuncio.endsWith(frase)).toBe(true)
  expect(anuncio).not.toContain('ainda sem medida nesta coluna')
  await ordenarPor(page, 'subs')
  expect(await anuncioOrd(page)).toMatch(/Seu canal: \d+º de \d+ (no geral|em \w+)\.$/)
  // ordem crescente: a posição não inverte
  await ordenarPor(page, 'subs')
  expect(param(page, 'dir')).toBe('asc')
  const ordemAsc = await ordemIds(page)
  expect(ordemAsc.indexOf(idDoPrimeiroProprio()), 'em ordem crescente o canal próprio sobe na lista').toBeLessThan(ordem.indexOf(idDoPrimeiroProprio()) || 99)
  expect(await donoLinha(page).locator('td.p').textContent()).toContain(`${pos}º`)
})

test('A3.2 nicho Todos numera todos juntos e diz "no geral"; um nicho diz "em <Nicho>"', async ({ page }) => {
  await abrir(page, '?fmt=longos&sort=subs')
  const geral = (await blocoLinha(page).locator('.tp').textContent())!
  medida(`Todos: "${geral.slice(0, 110)}"`)
  expect(geral).toMatch(/º de \d+ no geral/)
  const totalGeral = Number(/º de (\d+) no geral/.exec(geral)![1])
  const nLinhasGeral = await page.locator(`${S}:visible tbody tr.row td.p`).filter({ hasText: /º/ }).count()
  expect(nLinhasGeral, 'o "de N" é o número de linhas com posição').toBe(totalGeral)
  expect(await page.locator(`${S}:visible [data-k="conjunto-aviso"]`).textContent()).toContain('posição geral ordena, não julga')
  await abrir(page, '?fmt=longos&sort=subs&niche=viagem')
  const emViagem = (await blocoLinha(page).locator('.tp').textContent())!
  medida(`Viagem: "${emViagem.slice(0, 110)}"`)
  expect(emViagem).toMatch(/º de \d+ em Viagem/)
  expect(emViagem).not.toContain('no geral')
  const nViagem = await page.locator(`${S}:visible tbody tr.row td.p`).filter({ hasText: /º/ }).count()
  expect(nViagem).toBe(Number(/º de (\d+) em Viagem/.exec(emViagem)![1]))
  expect(nViagem).toBeLessThan(totalGeral)
  await expect(page.locator(`${S}:visible [data-k="conjunto-aviso"]`)).toHaveCount(0)
  const nums = (await page.locator(`${S}:visible tbody tr.row td.p`).allTextContents()).map(t => parseInt(t, 10)).filter(n => Number.isFinite(n))
  expect(nums.slice(0, 4)).toEqual([1, 2, 3, 4])
})

test('A3.2 a linha presa aparece ao rolar para o meio e some no topo e na linha do canal; tem 30 px e não cobre a última linha nem a legenda', async ({ page }) => {
  await abrir(page, '?fmt=longos&sort=subs')
  await rolarPara(page, 0)
  await page.waitForTimeout(400)
  expect(await peVisivel(page), 'no topo o bloco está na tela: a linha presa some').toBe(false)
  const max = await page.evaluate(() => { const s = (window as unknown as W).__sc(); return s.scrollHeight - s.clientHeight })
  await rolarPara(page, Math.round(max / 2))
  await expect.poll(() => peVisivel(page)).toBe(true)
  const c = await caixa(pe(page))
  const area = await page.evaluate(() => { const r = (window as unknown as W).__sc().getBoundingClientRect(); return { top: r.top, bottom: r.bottom } })
  medida(`linha presa no meio: altura ${c.h} px, base a ${Math.round(area.bottom - c.bottom)} px do pé da área; texto "${((await pe(page).locator('p').textContent()) ?? '').slice(0, 90)}"`)
  expect(c.h, 'altura de 30 px').toBeLessThanOrEqual(34)
  expect(c.h).toBeGreaterThanOrEqual(28)
  // 10 px do pé da área + os 56 px de respiro (pb-14) que a casca deixa no pé de `main`: o `sticky` conta o padding
  expect(area.bottom - c.bottom, 'presa perto do pé da área, sem cobrir mais que o respiro').toBeGreaterThanOrEqual(8)
  expect(area.bottom - c.bottom).toBeLessThanOrEqual(70)
  expect(await pe(page).locator('p').textContent()).toMatch(/^seu canal · \d+º de \d+/)
  // ao fim da rolagem ela ocupa o lugar dela, depois da legenda: nenhuma linha fica sob ela
  await rolarPara(page, max)
  await page.waitForTimeout(300)
  const fim = await page.evaluate(() => {
    const raiz = [...document.querySelectorAll('[data-obs-screen="canais"]')].find(e => e.getClientRects().length > 0)!
    const pin = raiz.querySelector<HTMLElement>('.cn-pin')!, leg = raiz.querySelector('.legend')!.getBoundingClientRect(), ult = [...raiz.querySelectorAll('tbody tr.row')].at(-1)!.getBoundingClientRect(), p = pin.getBoundingClientRect()
    return { oculta: pin.hasAttribute('hidden'), pinTop: Math.round(p.top), legBottom: Math.round(leg.bottom), ultBottom: Math.round(ult.bottom), area: Math.round((window as unknown as W).__sc().getBoundingClientRect().bottom) }
  })
  medida(`ao fim da rolagem: linha presa ${fim.oculta ? 'escondida' : 'visível'} em ${fim.pinTop}; legenda termina em ${fim.legBottom}; a última linha termina em ${fim.ultBottom}`)
  if (!fim.oculta) expect(fim.pinTop, 'a linha presa fica depois da legenda').toBeGreaterThanOrEqual(fim.legBottom - 1)
  expect(fim.ultBottom, 'a última linha está inteira acima da linha presa').toBeLessThanOrEqual(fim.oculta ? fim.area : fim.pinTop + 1)
  // some na linha do canal próprio
  await rolarPara(page, Math.round(max / 2))
  await expect.poll(() => peVisivel(page)).toBe(true)
  await donoLinha(page).evaluate(e => e.scrollIntoView({ block: 'center' }))
  await expect.poll(() => peVisivel(page), { timeout: 5000 }).toBe(false)
  // e some de novo no topo
  await rolarPara(page, 0)
  await expect.poll(() => peVisivel(page)).toBe(false)
})

test('A3.2 "Ir até a linha" traz a linha à área visível e põe o foco nela; "Voltar ao topo" volta; o foco vai ao título', async ({ page }) => {
  await abrir(page, '?fmt=longos&sort=subs')
  const max = await page.evaluate(() => { const s = (window as unknown as W).__sc(); return s.scrollHeight - s.clientHeight })
  await rolarPara(page, max)
  await expect.poll(() => peVisivel(page)).toBe(false).catch(() => {})
  await rolarPara(page, Math.round(max / 2) + 300)
  await expect.poll(() => peVisivel(page)).toBe(true)
  await pe(page).getByRole('button', { name: 'Ir até a linha' }).click()
  await expect.poll(() => donoLinha(page).evaluate(e => { const a = (window as unknown as W).__sc().getBoundingClientRect(), r = e.getBoundingClientRect(); return r.top >= a.top - 1 && r.bottom <= a.bottom + 1 }), { timeout: 8000 }).toBe(true)
  const foco = await page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return { tag: a?.tagName, id: a?.getAttribute('data-id'), own: a?.classList.contains('you') } })
  medida(`"Ir até a linha": rolagem ${await rolagem(page)} px; foco em ${foco.tag} data-id=${foco.id}`)
  expect(foco).toEqual({ tag: 'TR', id: idDoPrimeiroProprio(), own: true })
  const c = await caixa(donoLinha(page))
  const a = await page.evaluate(() => { const r = (window as unknown as W).__sc().getBoundingClientRect(); return { top: r.top, bottom: r.bottom } })
  expect(Math.abs((c.y + c.h / 2) - (a.top + a.bottom) / 2), 'a linha vem para o centro da área').toBeLessThan(120)
  // "Voltar ao topo" a partir do meio
  await rolarPara(page, Math.round(max / 2))
  await expect.poll(() => peVisivel(page)).toBe(true)
  await pe(page).getByRole('button', { name: 'Voltar ao topo' }).click()
  await expect.poll(() => rolagem(page), { timeout: 8000 }).toBe(0)
  const f2 = await page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return { tag: a?.tagName, txt: (a?.textContent ?? '').trim().slice(0, 40) } })
  medida(`"Voltar ao topo": rolagem 0; foco em ${f2.tag} "${f2.txt}"`)
  expect(['H1', 'H2']).toContain(f2.tag)
  // do bloco: "Ir até a linha" também (e a busca que esconde a linha é limpa)
  await page.getByRole('searchbox', { name: 'Buscar canal' }).fill('leo')
  await expect(donoLinha(page)).toHaveCount(0)
  await blocoLinha(page).getByRole('button', { name: /^Ir até a linha/ }).click()
  await expect(donoLinha(page)).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-id')), { timeout: 8000 }).toBe(idDoPrimeiroProprio())
  expect(await page.getByRole('searchbox', { name: 'Buscar canal' }).inputValue()).toBe('')
})

/** Quanto do foco a linha presa cobre (px) e outras medidas, para o elemento que está em foco agora; null com a linha presa escondida. */
const coberturaDoFoco = (page: Page) => page.evaluate(() => {
  const a = document.activeElement as HTMLElement | null
  const raiz = [...document.querySelectorAll('[data-obs-screen="canais"]')].find(e => e.getClientRects().length > 0)!
  const pin = raiz.querySelector<HTMLElement>('.cn-pin')
  if (!a || !pin || pin.hidden || !raiz.contains(a) || pin.contains(a) || a === document.body) return null
  const x = a.getBoundingClientRect(), p = pin.getBoundingClientRect(), area = (window as unknown as W).__sc().getBoundingClientRect()
  return {
    desc: `${a.tagName}.${String(a.className).slice(0, 20)} em ${Math.round(x.top)}..${Math.round(x.bottom)} sob a linha presa ${Math.round(p.top)}..${Math.round(p.bottom)}`,
    cobre: Math.round(Math.min(x.bottom, p.bottom) - Math.max(x.top, p.top)),
    pinH: Math.round(p.height), variavel: raiz.style.getPropertyValue('--cn-pin-cobre'), pinAoPe: Math.round(area.bottom - p.top),
  }
})
for (const largura of [1440, 390] as const) for (const sentido of ['Tab', 'Shift+Tab'] as const) {
  test(`A3.2 a linha presa não cobre o foco a ${largura} px: ${sentido} por toda a lista, nenhum elemento em foco fica sob ela`, async ({ page }) => {
    await abrir(page, '?fmt=longos&sort=subs', { width: largura, height: largura === 390 ? 800 : 900 })
    const max = await page.evaluate(() => { const s = (window as unknown as W).__sc(); return s.scrollHeight - s.clientHeight })
    const foco = page.locator(`${S}:visible :is(.tablebox, .cards) :is(a, button, select, input, [tabindex]):visible`)
    // sem linha presa na tela (no topo, com o bloco à vista) o Tab não ganha margem nenhuma
    await rolarPara(page, 0)
    await expect.poll(() => peVisivel(page)).toBe(false)
    expect(await foco.first().evaluate(e => getComputedStyle(e).scrollMarginBottom), 'linha presa escondida: margem zero').toBe('0px')
    await rolarPara(page, Math.round(max * (sentido === 'Tab' ? 0.3 : 0.8)))
    await expect.poll(() => peVisivel(page)).toBe(true)
    await (sentido === 'Tab' ? foco.first() : foco.last()).focus()
    let comPin = 0; const sobrepostos: string[] = []; const alturas = new Set<number>()
    const passos = 70
    for (let i = 0; i < passos; i++) {
      await page.keyboard.press(sentido)
      const r = await coberturaDoFoco(page)
      if (r) { comPin++; alturas.add(r.pinH); if (r.cobre > 1) sobrepostos.push(r.desc) }
    }
    medida(`${sentido} a ${largura} px: ${passos} passos, ${comPin} com a linha presa visível (altura ${[...alturas].join('/')} px); ${sobrepostos.length} focos sob ela${sobrepostos.length ? ': ' + sobrepostos.slice(0, 3).join(' | ') : ''}`)
    expect(comPin, 'a prova só vale se a linha presa esteve visível em vários passos').toBeGreaterThan(8)
    expect(sobrepostos).toEqual([])
  })
}

test('A3.2 I3: reordenar com o canal próprio passando entre "com medida" e "sem medida" não deixa a linha presa visível com a linha do canal à vista', async ({ page }) => {
  // a janela é alta o bastante para ter o cabeçalho e o canal sob o divisor ao mesmo tempo, com o bloco já fora da tela
  await abrir(page, '?fmt=longos&sort=vpd', VP.alto)
  const topoBloco = await page.locator(`${S}:visible [data-own-block]`).evaluate(e => { const s = (window as unknown as W).__sc(); return e.getBoundingClientRect().bottom - s.getBoundingClientRect().top + s.scrollTop })
  await rolarPara(page, Math.round(topoBloco) + 4)
  await page.waitForTimeout(500)
  const visivelDono = () => donoLinha(page).evaluate(e => { const a = (window as unknown as W).__sc().getBoundingClientRect(), r = e.getBoundingClientRect(); return r.bottom > a.top + 4 && r.top < a.bottom - 4 })
  expect(await page.locator(`${S}:visible tbody tr.row.you`).first().evaluate(e => !!e.closest('tbody') && !!document.querySelector('[data-divisor]') && e.compareDocumentPosition(document.querySelector('[data-divisor]')!) === Node.DOCUMENT_POSITION_PRECEDING), 'em Views/dia o canal está sob o divisor "Ainda sem medida"').toBe(true)
  expect(await visivelDono(), 'a linha do canal está à vista').toBe(true)
  expect(await peVisivel(page), 'com a linha à vista a linha presa está escondida').toBe(false)
  // clica a coluna de verdade: o canal passa para a lista com medida (outro filho do tbody; a tr é remontada)
  await clicarColuna(page, 'subs')
  await expect.poll(() => param(page, 'sort')).toBe('subs')
  await assentou(page)
  await page.waitForTimeout(600)
  const dono = await visivelDono()
  const presa = await peVisivel(page)
  medida(`I3 clicando Inscritos: linha do canal à vista ${dono}, linha presa visível ${presa}`)
  expect(dono, 'a linha do canal continua à vista').toBe(true)
  expect(presa, 'a linha presa continua escondida').toBe(false)
  // e no sentido contrário
  await clicarColuna(page, 'vpd')
  await expect.poll(() => param(page, 'sort')).toBeNull()
  await assentou(page)
  await page.waitForTimeout(600)
  const dono2 = await visivelDono(), presa2 = await peVisivel(page)
  medida(`I3 clicando Views/dia: linha do canal à vista ${dono2}, linha presa visível ${presa2}`)
  expect(dono2).toBe(true)
  expect(presa2).toBe(false)
})

test('A3.2 os cartões têm a mesma ordem da tabela e a frase "Você está na …ª posição"', async ({ page }) => {
  await abrir(page, '?fmt=longos&sort=subs')
  const ordemTabela = await ordemIds(page)
  await abrir(page, '?fmt=longos&sort=subs&layout=cards')
  const ordemCartoes = await ordemIds(page)
  expect(ordemCartoes).toEqual(ordemTabela)
  const voce = page.locator(`${S}:visible .cards article.you .voce`).first()
  const txt = (await voce.textContent())!.trim()
  medida(`cartão do canal próprio: "${txt}"`)
  expect(txt).toMatch(/^Você está na \d+ª posição de \d+ (no geral|em \w+) nesta ordenação\.$/)
  const pos = Number(/na (\d+)ª/.exec(txt)![1])
  expect(ordemCartoes.indexOf(idDoPrimeiroProprio()) + 1).toBe(pos)
  expect(await page.locator(`${S}:visible .cards article:not(.you) .voce`).count()).toBe(0)
  // em Views/dia o cartão diz o motivo
  await abrir(page, '?fmt=longos&layout=cards')
  expect((await page.locator(`${S}:visible .cards article.you .voce`).first().textContent())!).toContain('Ainda sem views por dia medidas')
  // a busca que casa só com o canal próprio não mostra a frase de vazio (I1)
  await page.getByRole('searchbox', { name: 'Buscar canal' }).fill('tnfig')
  await expect(page.locator(`${S}:visible .cards article`)).toHaveCount(2)
  expect(await tela(page).textContent()).not.toMatch(/Nenhum canal com “/)
  await page.getByRole('searchbox', { name: 'Buscar canal' }).fill('zzzzqq')
  await expect(page.locator(`${S}:visible .cards article`)).toHaveCount(0)
  await expect(tela(page)).toContainText('Nenhum canal com “zzzzqq”')
})

test('I1 a busca que casa só com o canal próprio (tabela): as linhas dele ficam e a frase de vazio não aparece', async ({ page }) => {
  await abrir(page, '?fmt=longos&sort=subs')
  await page.getByRole('searchbox', { name: 'Buscar canal' }).fill('tnfig')
  await expect(page.locator(`${S}:visible tbody tr.row`)).toHaveCount(2)
  expect(await page.locator(`${S}:visible tbody tr.row.you`).count()).toBe(2)
  expect(await tela(page).textContent()).not.toMatch(/Nenhum canal com “/)
  expect(await page.locator(`${S}:visible [data-k="busca-nota"]`).textContent()).toContain('Posição na lista inteira')
  await page.getByRole('searchbox', { name: 'Buscar canal' }).fill('zzzzqq')
  await expect(page.locator(`${S}:visible tbody tr.row`)).toHaveCount(0)
  await expect(tela(page)).toContainText('Nenhum canal com “zzzzqq”')
  await page.getByRole('searchbox', { name: 'Buscar canal' }).fill('leo')
  expect(await tela(page).textContent()).not.toMatch(/Nenhum canal com “/)
})

/* ================================================================== painéis, links, camada flutuante */
test('o painel lateral do canal PRÓPRIO continua abrindo (botão do bloco e clique na linha) e fecha; clique num concorrente leva à página do canal e o Voltar devolve a lista funcionando', async ({ page }) => {
  await abrir(page, '?fmt=todos&sort=subs')
  await page.getByRole('button', { name: 'Abrir meu canal: tnFigueiredo', exact: true }).first().click()
  await expect.poll(() => param(page, 'channel')).toBe(idDoPrimeiroProprio())
  const painel = page.locator(`${S}:visible .cn-drawer`)
  await expect(painel).toBeVisible({ timeout: 15_000 })
  await expect(painel).toContainText('tnFigueiredo')
  expect(param(page, 'fmt'), 'abrir o painel não apaga o fmt').toBe('todos')
  await page.keyboard.press('Escape')
  await expect(painel).toHaveCount(0)
  await expect.poll(() => param(page, 'channel')).toBeNull()
  // clique na linha do canal próprio (no nome)
  await donoLinha(page).locator('.nmbtn').first().scrollIntoViewIfNeeded()
  await donoLinha(page).locator('.nmbtn').first().click()
  await expect(painel).toBeVisible({ timeout: 15_000 })
  await page.keyboard.press('Escape')
  await expect(painel).toHaveCount(0)
  // um concorrente: a página do canal
  const alvo = page.locator(`${S}:visible tbody tr.row:not(.you) .nmbtn`).first()
  const idConc = (await alvo.getAttribute('data-open'))!
  await alvo.scrollIntoViewIfNeeded()
  await alvo.click()
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe(`${ROTA}/canal/${idConc}`)
  await page.locator('[data-obs-screen="canal"] .chead h1:visible').first().waitFor({ timeout: 30_000 })
  // Voltar: a árvore antiga da rota fica escondida ao lado da visível; a lista visível tem a linha presa e a rolagem funcionando
  await page.goBack()
  await expect.poll(() => new URL(page.url()).pathname).toBe(ROTA)
  await pronta(page, false)
  expect(param(page, 'fmt')).toBe('todos')
  expect(await page.locator(`${S}:visible`).count(), 'uma só lista visível').toBe(1)
  const max = await page.evaluate(() => { const s = (window as unknown as W).__sc(); return s.scrollHeight - s.clientHeight })
  await rolarPara(page, Math.round(max / 2))
  await expect.poll(() => peVisivel(page), { timeout: 8000 }).toBe(true)
  await rolarPara(page, 0)
  await expect.poll(() => peVisivel(page)).toBe(false)
  await pe(page).evaluate(() => {}) // o localizador resolve na árvore visível
  medida(`Voltar da página do canal: ${await page.locator(S).count()} árvores da lista no DOM, ${await page.locator(`${S}:visible`).count()} visível`)
})

test('a dica dos inscritos e o "formato não confirmado" abrem na camada flutuante (#flut), inteiras na janela', async ({ page }) => {
  await abrir(page, '?fmt=longos')
  await rolarPara(page, 700)
  const dicas: Array<{ nome: string; gatilho: Locator }> = [
    { nome: 'inscritos', gatilho: page.locator(`${S}:visible tbody tr.row [aria-label="Sobre o número de inscritos"]`).first() },
  ]
  // a semente (`canalCompleto`) dá a Matt Wolfe um vídeo com formato não confirmado: se o caso deixar de existir, o teste FALHA em vez de pular a dica
  const nc = page.locator(`${S}:visible tbody tr.row[data-id="${ids.channel(CANAL_COMPLETO.canal)}"] [aria-label="Sobre os vídeos sem formato confirmado"]`)
  await expect(nc, 'a semente tem um canal com vídeo de formato não confirmado (CANAL_COMPLETO)').toHaveCount(1)
  dicas.push({ nome: 'formato não confirmado', gatilho: nc.first() })
  for (const d of dicas) {
    await d.gatilho.scrollIntoViewIfNeeded()
    await d.gatilho.focus()
    const caixaTip = page.locator('#flut .cn-tt').first()
    await expect(caixaTip).toBeVisible({ timeout: 5000 })
    const r = await caixa(caixaTip)
    const dentroDaTabela = await caixaTip.evaluate(e => !!e.closest('td, tr, table'))
    const j = page.viewportSize()!
    medida(`dica de ${d.nome}: ${r.x},${r.y} ${r.w}x${r.h} na janela ${j.width}x${j.height}; dentro de td/tr: ${dentroDaTabela}`)
    expect(dentroDaTabela).toBe(false)
    expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0)
    expect(r.right).toBeLessThanOrEqual(j.width); expect(r.bottom).toBeLessThanOrEqual(j.height)
    const g = await caixa(d.gatilho)
    expect(Math.abs(r.y - g.bottom) < 24 || Math.abs(g.y - r.bottom) < 24, 'perto do gatilho').toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.locator('#flut .cn-tt')).toHaveCount(0)
  }
})

/* ================================================================== largura */
const LARGURAS = [1440, 1280, 1024, 768, 390, 320] as const
const transbordo = (page: Page) => page.evaluate(() => {
  const falhas: string[] = [], d = document.documentElement, sc = (window as unknown as W).__sc()
  if (d.scrollWidth > d.clientWidth + 1) falhas.push(`documento ${d.scrollWidth}>${d.clientWidth}`)
  // `main` pode rolar na horizontal por causa da MOLDURA (faixa de frescor/forja `.obs-ch-fresh`, cabeçalho "Abrir no Cowork" da casca): quem passa da largura e
  // está fora da tela da lista é medido e relatado; qualquer elemento DENTRO da lista que passe reprova
  let faixa: string | null = null
  if (sc !== d && sc.scrollWidth > sc.clientWidth + 1) {
    const dentro: string[] = [], fora = new Set<string>()
    const tela = document.querySelector('[data-obs-screen="canais"]')
    sc.querySelectorAll('*').forEach(e => {
      const b = e.getBoundingClientRect()
      if (b.width === 0 || b.right <= sc.clientWidth + 1 || e.closest('.sr, [hidden]')) return
      for (let p: Element | null = e.parentElement; p && p !== sc; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return
      if (tela?.contains(e) && !e.classList.contains('tip')) dentro.push(`${e.tagName}.${String((e as HTMLElement).className).slice(0, 30)} ${Math.round(b.right)}`)
      else if (!tela?.contains(e)) fora.add(String((e as HTMLElement).className).split(' ')[0] || e.tagName)
    })
    if (dentro.length) falhas.push(`main ${sc.scrollWidth}>${sc.clientWidth} por elemento da lista: ${dentro.slice(0, 3).join(' | ')}`)
    else faixa = `main ${sc.scrollWidth}>${sc.clientWidth} só por causa da moldura/casca (${[...fora].slice(0, 4).join(', ')})`
  }
  const raiz = [...document.querySelectorAll('[data-obs-screen="canais"]')].find(e => e.getClientRects().length > 0)!
  const lim = raiz.getBoundingClientRect().right
  raiz.querySelectorAll('*').forEach(e => {
    const b = e.getBoundingClientRect()
    // o alvo de toque do "?" tem 32 px e passa até 12 px do fim da tela, para dentro do respiro da casca (o glifo é menor); não é transbordo
    if (b.width === 0 || b.right <= lim + (e.classList.contains('tip') ? 12 : 4.5) || e.closest('.sr, [hidden]')) return
    for (let p: Element | null = e.parentElement; p && p !== raiz; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return
    falhas.push(`${e.tagName}.${String((e as HTMLElement).className).slice(0, 30)} ${Math.round(b.right)}>${Math.round(lim)}`)
  })
  const box = raiz.querySelector<HTMLElement>('.tablebox')
  return { falhas: falhas.slice(0, 6), faixa, tabela: box && box.getClientRects().length ? { dentro: box.clientWidth, total: box.scrollWidth } : null }
})
for (const fmt of ['longos', 'todos', 'shorts'] as const) {
  test(`sem rolagem horizontal da página em 1440, 1280, 1024, 768 e 390 px, e a lista cabe a 320 px, tabela e cartões, em ${fmt}`, async ({ page }) => {
    const linhas: string[] = []
    for (const layout of ['table', 'cards'] as const) for (const w of LARGURAS) {
      await abrir(page, `?fmt=${fmt}&sort=subs&layout=${layout}`, { width: w, height: w <= 390 ? 800 : 900 })
      const t = await transbordo(page)
      linhas.push(`${layout} ${w}px: ${t.falhas.length ? 'FALHA ' + t.falhas.join(' | ') : t.faixa ? 'lista sem transbordo; ' + t.faixa : 'sem transbordo'}${t.tabela ? `; invólucro ${t.tabela.dentro} px, tabela ${t.tabela.total} px (rola por dentro: ${t.tabela.total > t.tabela.dentro + 1})` : ''}`)
      expect(t.falhas, `${fmt} ${layout} ${w}px`).toEqual([])
      // a PÁGINA (main) não rola na horizontal até 390 px: a faixa de frescor da moldura quebra de linha. A 320 px o cabeçalho "Abrir no Cowork" da
      // casca do CMS (fora do Observatório) ainda passa: é o test.fixme logo abaixo, com a medida.
      if (w >= 390) expect(t.faixa, `${fmt} ${layout} ${w}px: a moldura não faz a página rolar`).toBeNull()
      // o bloco e a linha presa cabem na largura
      const b = await caixa(page.locator(`${S}:visible [data-own-block]`))
      expect(b.right, `bloco ${w}px`).toBeLessThanOrEqual(w + 1)
      if (w === 390 || w === 320) await page.screenshot({ path: path.join(SHOTS, `largura-${fmt}-${layout}-${w}.png`) })
    }
    medida(`${fmt}:\n  ` + linhas.join('\n  '))
  })
}

// ACHADO ANTERIOR À FASE A3 (a moldura/casca é a mesma do commit c8672312): a 320 px o cabeçalho da casca do CMS ("Abrir no Cowork", `div.flex.items-center.gap-3`,
// 215 px de largura, termina em 337 px) e o menu ⋯ (termina em 349 px) passam da janela e `main` rola 29 px na horizontal (scrollWidth 349 > 320) em TODAS as
// telas do Observatório. Fica fora do Observatório (componente do CMS inteiro); o conserto é do cabeçalho da casca, não da lista.
test.fixme('a página não rola na horizontal a 320 px: o cabeçalho "Abrir no Cowork" e o menu ⋯ da casca do CMS terminam em 349 px (> 320)', async ({ page }) => {
  await abrir(page, '?fmt=longos&sort=subs&layout=cards', { width: 320, height: 800 })
  const t = await transbordo(page)
  expect(t.faixa, 'main não rola a 320 px').toBeNull()
})

test('a linha presa a 390 e 320 px: cabe na largura, e a altura passa de 30 px só quando o texto quebra', async ({ page }) => {
  for (const w of [390, 320]) {
    await abrir(page, '?fmt=longos&sort=subs', { width: w, height: 800 })
    const max = await page.evaluate(() => { const s = (window as unknown as W).__sc(); return s.scrollHeight - s.clientHeight })
    await rolarPara(page, Math.round(max / 2))
    await expect.poll(() => peVisivel(page)).toBe(true)
    const c = await caixa(pe(page))
    medida(`linha presa a ${w} px: ${c.w}x${c.h} px, de ${c.x} a ${c.right}`)
    expect(c.x).toBeGreaterThanOrEqual(0); expect(c.right).toBeLessThanOrEqual(w)
    expect(c.h, 'não cobre mais de um quarto da janela').toBeLessThan(200)
  }
})

/* ================================================================== cor, tema */
test('cor nunca sozinha: em escala de cinza o canal próprio continua identificável pelo selo "seu canal" (bloco, linha e cartão)', async ({ page }) => {
  await abrir(page, '?fmt=longos&sort=subs')
  await page.addStyleTag({ content: 'html{filter:grayscale(1)!important}' })
  await page.screenshot({ path: path.join(SHOTS, 'cinza-tabela.png') })
  await expect(page.locator(`${S}:visible [data-own-block] .youtag`).first()).toBeVisible()
  expect((await page.locator(`${S}:visible [data-own-block] .youtag`).first().textContent())!.trim()).toBe('seu canal')
  await expect(donoLinha(page).locator('.youtag').first()).toBeVisible()
  expect(await donoLinha(page).locator('td.p').textContent(), 'a posição é texto, não cor').toMatch(/^\d+º/)
  // o selo tem fundo e borda além da cor? mede a diferença de luminância entre o selo e o que está em volta, em cinza
  const lum = await page.locator(`${S}:visible [data-own-block] .youtag`).first().evaluate(e => {
    const cor = (s: string) => (s.match(/rgba?\(([^)]+)\)/)?.[1] ?? '').split(',').map(v => parseFloat(v))
    const L = (c: number[]) => { const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!) }
    const cs = getComputedStyle(e)
    return { texto: cs.color, fundo: cs.backgroundColor, borda: cs.borderTopWidth + ' ' + cs.borderTopColor, lt: L(cor(cs.color)), lf: L(cor(cs.backgroundColor)) }
  })
  medida(`selo "seu canal" em cinza: texto ${lum.texto} sobre ${lum.fundo}, borda ${lum.borda}`)
  await abrir(page, '?fmt=longos&sort=subs&layout=cards')
  await expect(page.locator(`${S}:visible .cards article.you .youtag`).first()).toBeVisible()
  await expect(page.locator(`${S}:visible .cards article.you .voce`).first()).toBeVisible()
})

for (const tema of THEMES) {
  test(`tema ${tema === 'dark' ? 'escuro' : 'claro'}: bloco, selo, divisor, posição e linha presa legíveis (contraste de texto medido, 4,5:1)`, async ({ page }) => {
    await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
    type Medida = { nome: string; ausente: true } | { nome: string; ausente: false; ratio: number; cor: string; fundo: string; tam: string }
    const medirTudo = () => page.evaluate((): Medida[] => {
      type RGBA = [number, number, number, number]
      const parse = (s: string): RGBA => { const m = s.match(/rgba?\(([^)]+)\)/)?.[1]?.split(/[ ,/]+/).filter(Boolean).map(parseFloat) ?? [0, 0, 0, 0]; return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0, m[3] ?? 1] }
      const over = (top: RGBA, bottom: RGBA): RGBA => { const a = top[3] + bottom[3] * (1 - top[3]); return a === 0 ? [0, 0, 0, 0] : [(top[0] * top[3] + bottom[0] * bottom[3] * (1 - top[3])) / a, (top[1] * top[3] + bottom[1] * bottom[3] * (1 - top[3])) / a, (top[2] * top[3] + bottom[2] * bottom[3] * (1 - top[3])) / a, a] }
      const fundoDe = (e: Element): RGBA => { const camadas: RGBA[] = []; for (let p: Element | null = e; p; p = p.parentElement) { const c = parse(getComputedStyle(p).backgroundColor); if (c[3] > 0) camadas.push(c); if (c[3] >= 1) break }; return camadas.reduceRight<RGBA>((acc, c) => over(c, acc), [255, 255, 255, 1]) }
      const L = (c: RGBA) => { const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
      const raiz = [...document.querySelectorAll('[data-obs-screen="canais"]')].find(e => e.getClientRects().length > 0)!
      const alvos: Array<[string, string]> = [
        ['título do bloco', '[data-own-block] h2'], ['frase do bloco', '[data-own-block] .tp'], ['negrito da frase', '[data-own-block] .tp b'], ['selo "seu canal"', '[data-own-block] .youtag'],
        ['partes do bloco', '[data-own-block] .cn-own'], ['botão do bloco', '[data-own-block] .ta .btn'], ['aviso do conjunto', '[data-k="conjunto-aviso"]'], ['nota da ordenação', '.sortnote'],
        ['divisor (título)', 'tr[data-divisor] strong'], ['divisor (nota)', 'tr[data-divisor] small'], ['posição', 'tbody tr.row td.p'], ['posição do canal próprio', 'tbody tr.you td.p'],
        ['selo na linha', 'tbody tr.you .youtag'], ['linha presa (texto)', '.cn-pin p'], ['linha presa (link)', '.cn-pin .lk'],
      ]
      return alvos.map(([nome, sel]): Medida => {
        const e = raiz.querySelector(sel)
        if (!e) return { nome, ausente: true }
        const fg = parse(getComputedStyle(e).color), bg = fundoDe(e), a = L(over(fg, bg)), b = L(bg)
        return { nome, ausente: false, ratio: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100, cor: getComputedStyle(e).color, fundo: `rgb(${bg.slice(0, 3).map(Math.round).join(',')})`, tam: getComputedStyle(e).fontSize }
      })
    })
    const vistos = new Map<string, Medida>()
    // Views/dia: o canal próprio está sob o divisor "Ainda sem medida" e a frase é o motivo; Inscritos: a frase tem o negrito da posição
    for (const sort of ['vpd', 'subs']) {
      await abrir(page, `?fmt=longos&sort=${sort}`, VP.w1440)
      expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(tema)
      const max = await page.evaluate(() => { const s = (window as unknown as W).__sc(); return s.scrollHeight - s.clientHeight })
      await rolarPara(page, Math.round(max / 2))
      await expect.poll(() => peVisivel(page)).toBe(true)
      for (const m of await medirTudo()) if (!vistos.has(m.nome) || vistos.get(m.nome)!.ausente) vistos.set(m.nome, m)
      await page.screenshot({ path: path.join(SHOTS, `tema-${tema}-${sort}.png`) })
    }
    for (const m of vistos.values()) medida(`${tema}: ${m.nome}: ${m.ausente ? 'ausente' : `${m.ratio}:1 (${m.cor} sobre ${m.fundo}, ${m.tam})`}`)
    for (const m of vistos.values()) {
      expect(m.ausente, `${tema} ${m.nome} existe em alguma das duas ordenações`).toBe(false)
      if (!m.ausente) expect(m.ratio, `${tema} ${m.nome}`).toBeGreaterThanOrEqual(4.5)
    }
  })
}

/* ================================================================== medidas do bloco */
test('medidas: altura do bloco "Seus canais" com dois canais próprios e com um', async ({ page }) => {
  test.setTimeout(300_000)
  await abrir(page, '?fmt=longos&sort=subs')
  const dois = await caixa(page.locator(`${S}:visible [data-own-block]`))
  const linhas2 = await page.locator(`${S}:visible [data-own-block] li`).count()
  // a mesma semente com UM canal próprio (a última prova do arquivo: as outras já rodaram com o preset 2). `finally`: se algo falhar no meio, a semente
  // volta ao preset 2 e o spec seguinte não herda o banco trocado
  try {
    ids = seedIdsOf(await ensureSeeded({ ...SEED2, ownPreset: '1' }))
    await abrir(page, '?fmt=longos&sort=subs')
    const um = await caixa(page.locator(`${S}:visible [data-own-block]`))
    const linhas1 = await page.locator(`${S}:visible [data-own-block] li`).count()
    const tabela = await page.evaluate(() => {
      const raiz = [...document.querySelectorAll('[data-obs-screen="canais"]')].find(e => e.getClientRects().length > 0)!
      const box = raiz.querySelector<HTMLElement>('.tablebox')!
      return { dentro: box.clientWidth, total: box.scrollWidth, bloco: Math.round(raiz.querySelector<HTMLElement>('[data-own-block]')!.getBoundingClientRect().width) }
    })
    medida(`bloco com 2 canais próprios: ${dois.h} px (${linhas2} linhas); com 1: ${um.h} px (${linhas1} linha); a 1440 px o bloco tem ${tabela.bloco} px de largura, a tabela ${tabela.total} px num invólucro de ${tabela.dentro} px (${tabela.total > tabela.dentro + 1 ? 'rola por dentro' : 'cabe'})`)
    expect(linhas2).toBe(2); expect(linhas1).toBe(1)
    expect(um.h).toBeLessThan(dois.h)
    // com um canal só a frase fala dele e a linha presa também
    await expect(page.locator(`${S}:visible [data-own-block] li`)).toHaveCount(1)
    const max = await page.evaluate(() => { const s = (window as unknown as W).__sc(); return s.scrollHeight - s.clientHeight })
    await rolarPara(page, Math.round(max / 2))
    await expect.poll(() => peVisivel(page)).toBe(true)
  } finally {
    ids = seedIdsOf(await ensureSeeded(SEED2))
  }
})
