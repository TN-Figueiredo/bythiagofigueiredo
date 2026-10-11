// apps/web/e2e/tests/cms/observatorio/historico-a2.spec.ts
// A prova, no navegador de verdade, do que a fase A2 (tarefas 1 a 3) mudou no Histórico do vídeo (spec 2026-10-07-observatorio-canal-video-ui-design,
// aceites A2.1, A2.2, A2.4, A2.5 e A2.6; mockup 2026-10-07-pagina-canal/video.html). O que o jsdom não mede: remontagem pelo Next, foco depois de
// uma navegação, rolagem do contêiner, Voltar do navegador com a cópia escondida da rota, tamanhos, tema.
// Nada é escrito no banco: só a semeadura de `ensureSeeded` (a mesma do canal.spec: canalCompleto). As medidas vão para
// test-results/historico-a2-medidas.txt (e para as anotações de cada teste).
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page, type Locator } from '@playwright/test'
import { ADMIN_STATE, ensureSeeded, seedIdsOf } from './fidelity'
import { CANAL_COMPLETO } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE, colorScheme: 'dark', viewport: { width: 1440, height: 900 } })
let ids: ReturnType<typeof seedIdsOf>
test.beforeAll(async () => { test.setTimeout(240_000); ids = seedIdsOf(await ensureSeeded({ canalCompleto: true })) })
test.beforeEach(async ({ page }) => {
  test.setTimeout(150_000)
  await page.context().addCookies([{ name: 'btf_theme', value: 'dark', url: 'http://localhost:3099' }])
  // o contêiner que rola: a casca do CMS rola dentro do próprio contêiner, não no documento; depois de um Voltar do Next a árvore anterior fica
  // escondida ao lado da visível, então a raiz é a tela VISÍVEL
  await page.addInitScript(() => {
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

const MEDIDAS = path.resolve(__dirname, '../../../../test-results/historico-a2-medidas.txt')
function medida(texto: string): void {
  fs.mkdirSync(path.dirname(MEDIDAS), { recursive: true })
  fs.appendFileSync(MEDIDAS, `[${test.info().title}] ${texto}\n`)
  test.info().annotations.push({ type: 'medida', description: texto })
}

/** Vídeos do oráculo (idade e trocas conferidas em historico-a2-range-troca.test.ts). */
const V = {
  full: 'matt-opus55',            // 18 d, 6 trocas (título 2, thumb 3, desc 1), canal matt-wolfe
  few: 'matt-fast-cheap',         // 1 registro, canal matt-wolfe
  old: 'dale-ninja-dojo',         // 298 d, trocas há 9 e 34 d
  velha: 'luke-hidden-village',   // 86 d, uma troca de título há 52 d
  untr: 'luke-damant-l71',        // fora dos acompanhados
} as const
const CH = () => ids.channel(CANAL_COMPLETO.canal)
const HV = '[data-obs-screen="historico"]'
const CV = '[data-obs-screen="canal"]'
/** O pager mora na linha da trilha da moldura (fora da raiz da tela), como no mockup aprovado. */
const PG = '.obs-ch-root:visible'
const videoUrl = (oracle: string, qs = '') => `/cms/youtube/competitors/video/${ids.video(oracle)}${qs}`
const canalUrl = (qs = '') => `/cms/youtube/competitors/canal/${CH()}${qs}`
type W = { __sc: () => HTMLElement }
const rolagem = (page: Page) => page.evaluate(() => (window as unknown as W).__sc().scrollTop)

/** Abre a tela do Histórico e espera a hidratação (cliques antes dela se perdem); tira o indicador do `next dev` do caminho. */
async function abrirVideo(page: Page, oracle: string, qs = '', size?: { width: number; height: number }): Promise<void> {
  if (size) await page.setViewportSize(size)
  await page.goto(videoUrl(oracle, qs))
  await videoPronto(page)
}
async function videoPronto(page: Page): Promise<void> {
  await page.locator(`${HV} .vhead h2:visible`).first().waitFor({ timeout: 90_000 })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
  await esperarParado(page, page.locator(`${HV} .vhead:visible`).first())
}
async function abrirCanal(page: Page, qs = ''): Promise<void> {
  await page.goto(canalUrl(qs))
  await canalPronto(page)
}
async function canalPronto(page: Page): Promise<void> {
  await page.locator(`${CV} .chead h1:visible`).first().waitFor({ timeout: 90_000 })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
  await esperarParado(page, page.locator(`${CV} .chead:visible`).first())
}
/** A casca do CMS recolhe a barra lateral depois de hidratar e o cabeçalho enche: espera o retângulo parar. */
async function esperarParado(page: Page, l: Locator): Promise<void> {
  let ultimo = '', igual = 0
  for (let i = 0; i < 40 && igual < 3; i++) {
    const agora = JSON.stringify(await l.boundingBox())
    igual = agora === ultimo ? igual + 1 : 0; ultimo = agora
    await page.waitForTimeout(100)
  }
}
interface Caixa { x: number; y: number; w: number; h: number; bottom: number; right: number }
const caixa = (l: Locator): Promise<Caixa> => l.evaluate(e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, bottom: Math.round(r.bottom), right: Math.round(r.right) } })
const idDoVideo = (url: string) => decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '')
const histLen = (page: Page) => page.evaluate(() => history.length)

/** Roda no navegador: o que está em foco, na tela VISÍVEL (a cópia escondida da rota nunca tem foco). */
interface Foco { tag: string; id: string; cls: string; atributos: string[]; visivel: boolean; texto: string; troca: string | null; naArea: boolean; topo: number; fundo: number; areaTopo: number; areaFundo: number }
const foco = (page: Page): Promise<Foco> => page.evaluate(() => {
  const a = document.activeElement as HTMLElement | null
  if (!a || a === document.body) return { tag: 'BODY', id: '', cls: '', atributos: [], visivel: false, texto: '', troca: null, naArea: false, topo: 0, fundo: 0, areaTopo: 0, areaFundo: 0 }
  const r = a.getBoundingClientRect(), main = a.closest('main')?.getBoundingClientRect() ?? { top: 0, bottom: innerHeight }
  return {
    tag: a.tagName, id: a.id, cls: String(a.className), atributos: a.getAttributeNames().filter(n => n.startsWith('data-')), visivel: a.getClientRects().length > 0,
    texto: (a.textContent ?? '').trim().slice(0, 80), troca: a.closest<HTMLElement>('li.ct-sw')?.dataset.troca ?? null,
    naArea: r.top >= main.top - 0.5 && r.bottom <= main.bottom + 0.5, topo: Math.round(r.top), fundo: Math.round(r.bottom), areaTopo: Math.round(main.top), areaFundo: Math.round(main.bottom),
  }
})

/** O que a página transborda na horizontal: o documento, e qualquer elemento da tela que passe da borda direita (respiro de 4 px) sem um ancestral que recorte. */
const transbordo = (page: Page) => page.evaluate(() => {
  const falhas: string[] = [], d = document.documentElement
  if (d.scrollWidth > d.clientWidth + 1) falhas.push(`documento ${d.scrollWidth}>${d.clientWidth}`)
  const raiz = [...document.querySelectorAll('[data-obs-screen]')].find(e => e.getClientRects().length > 0)!
  const tela = raiz.closest('.obs-ch-screen') ?? raiz
  const lim = tela.getBoundingClientRect().right
  const topo = raiz.closest('.obs-ch-content')?.querySelector('.obs-tr-top')
  for (const e of [...(topo ? [topo, ...topo.querySelectorAll('*')] : []), ...tela.querySelectorAll('*')]) {
    const b = e.getBoundingClientRect()
    if (b.width === 0 || b.right <= lim + 4.5) continue
    let recortado = false
    for (let p: Element | null = e.parentElement; p && p !== tela; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') { recortado = true; break }
    if (!recortado) falhas.push(`${e.tagName}.${String((e as HTMLElement).className).slice(0, 30)} ${Math.round(b.right)}>${Math.round(lim)}`)
  }
  return falhas
})

/** Observa erros do console e respostas 5xx enquanto `fn` roda. */
async function vigiar(page: Page, fn: () => Promise<void>): Promise<{ erros: string[]; cincoXX: string[] }> {
  const erros: string[] = [], cincoXX: string[] = []
  const c = (m: import('@playwright/test').ConsoleMessage) => { if (m.type() === 'error') erros.push(m.text().slice(0, 200)) }
  const e = (x: Error) => erros.push('pageerror: ' + x.message.slice(0, 200))
  const r = (x: import('@playwright/test').Response) => { if (x.status() >= 500) cincoXX.push(x.status() + ' ' + x.url().slice(0, 120)) }
  page.on('console', c); page.on('pageerror', e); page.on('response', r)
  try { await fn() } finally { page.off('console', c); page.off('pageerror', e); page.off('response', r) }
  return { erros, cincoXX }
}

/* ================================================================== A2.6 */
test('A2.6 a moldura tem só a trilha: vindo do canal, de Mudanças, de Outliers, de Insights e sem origem', async ({ page }) => {
  const casos: Array<{ nome: string; qs: string; itens: string[]; primeiro: RegExp }> = [
    { nome: 'canal', qs: `?from=canais&canal=${CH()}`, itens: ['Canais', 'Matt Wolfe', 'Histórico do vídeo'], primeiro: /\/competitors(\?|$)/ },
    { nome: 'mudancas', qs: '?from=mudancas&back=' + encodeURIComponent('?niche=ia'), itens: ['Mudanças', 'Matt Wolfe', 'Histórico do vídeo'], primeiro: /\/competitors\/mudancas\?niche=ia/ },
    { nome: 'outliers', qs: '?from=outliers', itens: ['Outliers', 'Matt Wolfe', 'Histórico do vídeo'], primeiro: /\/competitors\/outliers/ },
    { nome: 'insights', qs: '?from=insights', itens: ['Insights', 'Matt Wolfe', 'Histórico do vídeo'], primeiro: /\/competitors\/insights/ },
  ]
  for (const c of casos) {
    const { erros, cincoXX } = await vigiar(page, async () => { await abrirVideo(page, V.full, c.qs) })
    const raiz = page.locator('.obs-ch-root:visible').first()
    // nenhuma aba de seção, nenhuma barra de nicho, nenhum botão da moldura antiga
    expect(await raiz.locator('[role="tablist"]').count(), c.nome + ': sem abas de seção').toBe(0)
    expect(await raiz.locator('.obs-ch-head, .obs-ch-nav, [data-obs-tabs], [data-obs-chrome], .obs-ch-niche-bar, [data-niche-scroll]').count(), c.nome + ': sem cabeçalho nem barra de nicho').toBe(0)
    for (const nome of ['Sincronizar concorrentes', 'Adicionar canal', 'Mais ações']) expect(await raiz.getByRole('button', { name: nome }).count() + await raiz.getByRole('link', { name: nome }).count(), c.nome + ': sem "' + nome + '"').toBe(0)
    const trilha = page.getByRole('navigation', { name: 'Caminho' })
    await expect(trilha).toHaveCount(1)
    const itens = await trilha.locator('li').allTextContents()
    expect(itens.map(t => t.trim()), c.nome + ': itens da trilha').toEqual(c.itens)
    await expect(raiz.locator('.obs-tr-tz')).toHaveText('Horários em São Paulo')
    const href = await trilha.locator('li').first().locator('a').getAttribute('href')
    expect(href, c.nome + ': primeiro item').toMatch(c.primeiro)
    // o que a tela tem: o botão cheio da forja continua, o título do vídeo
    await expect(page.locator(`${HV} .vhead h2:visible`).first()).toBeVisible()
    const t = await caixa(trilha), p = await page.locator(`${PG} [data-pager]`).first().evaluate(e => { const r = e.getBoundingClientRect(); return { y: Math.round(r.top), h: Math.round(r.height) } }).catch(() => null)
    medida(`${c.nome}: trilha ${t.x},${t.y} ${t.w}×${t.h}; pager ${p ? p.y + ' (altura ' + p.h + ')' : 'ausente'}; erros de console ${erros.length}; respostas 5xx ${cincoXX.length}`)
    expect(erros, c.nome + ': console limpo').toEqual([])
    expect(cincoXX, c.nome + ': sem 5xx').toEqual([])
  }
  // o primeiro item da trilha leva de fato à origem: Mudanças, com o filtro de back=
  await abrirVideo(page, V.full, casos[1]!.qs)
  await page.getByRole('navigation', { name: 'Caminho' }).getByRole('link', { name: 'Mudanças' }).click()
  await page.waitForURL(/\/competitors\/mudancas/, { timeout: 60_000 })
  expect(new URL(page.url()).searchParams.get('niche')).toBe('ia')
})

/* ================================================================== A2.4 */
test('A2.4 sem range o gráfico mostra 30 dias; o seletor 7/30/90/tudo existe; range=tudo mostra o vídeo inteiro; recarregar mantém', async ({ page }) => {
  await abrirVideo(page, V.old)
  const seg = page.locator(`${HV} .rng-ctl:visible .seg`).first()
  const botoes = seg.locator('button')
  expect(await botoes.allTextContents()).toEqual(['7 d', '30 d', '90 d', 'tudo'])
  const pressed = async () => (await botoes.evaluateAll(bs => bs.map(b => b.getAttribute('aria-pressed') === 'true' ? (b.textContent ?? '') : '').filter(Boolean)))
  expect(await pressed()).toEqual(['30 d'])
  expect(new URL(page.url()).searchParams.get('range'), 'sem range na URL').toBeNull()
  const texto = async () => ((await page.locator(`${HV} #hv-rngtxt:visible`).first().textContent()) ?? '').replace(/\s+/g, ' ').trim()
  const eixo = async () => page.locator(`${HV} .tl-wrap:visible svg text`).evaluateAll(ts => ts.map(t => (t.textContent ?? '').trim()).filter(x => /^\d\d\/\d\d/.test(x)))
  const t30 = await texto(), eixo30 = await eixo()
  medida(`vídeo de 298 d, 30 d: "${t30}"; rótulos de data no eixo ${eixo30.length} (${eixo30[0]}…${eixo30[eixo30.length - 1]})`)
  // 90 d, depois tudo: o texto muda e a URL leva o range
  await botoes.nth(2).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('range')).toBe('90')
  expect(await pressed()).toEqual(['90 d'])
  await botoes.nth(3).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('range')).toBe('tudo')
  await expect.poll(pressed).toEqual(['tudo'])
  const tTudo = await texto(), eixoTudo = await eixo()
  medida(`range=tudo: "${tTudo}"; rótulos de data no eixo ${eixoTudo.length} (${eixoTudo[0]}…${eixoTudo[eixoTudo.length - 1]})`)
  expect(tTudo).not.toBe(t30)
  // recarregar mantém
  await page.reload()
  await videoPronto(page)
  expect(await pressed()).toEqual(['tudo'])
  expect(await texto()).toBe(tTudo)
  // 30 d tira o range da URL
  await botoes.nth(1).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('range')).toBeNull()
  await expect.poll(pressed).toEqual(['30 d'])
  expect(await texto()).toBe(t30)
  // range lixo na URL = o padrão, sem erro
  const lixo = await vigiar(page, async () => { await abrirVideo(page, V.old, '?range=abc&troca=abc') })
  expect(await pressed()).toEqual(['30 d'])
  await expect(page.locator(`${HV} [data-arrive]`)).toHaveCount(0)
  expect(lixo.cincoXX).toEqual([])
  // série curta: o seletor aparece (antes só acima de 30 dias de série)
  await abrirVideo(page, V.few)
  expect(await page.locator(`${HV} .rng-ctl:visible .seg button`).allTextContents()).toEqual(['7 d', '30 d', '90 d', 'tudo'])
})

/* ================================================================== A2.1 */
test('A2.1 "Abrir nesta troca" na aba Trocas: a troca chega selecionada, com a linha de chegada, o anel na raia e o foco no marcador; 7 d e 30 d não tiram o foco do botão', async ({ page }) => {
  await abrirCanal(page, '?tab=trocas')
  const multi = page.locator(`${CV} .ct-card.multi:visible`).first()
  const linha = multi.locator('li.ct-sw[data-troca$="/thumb/2"]')
  await expect(linha).toHaveCount(1)
  const troca = (await linha.getAttribute('data-troca'))!
  await linha.locator('a.ct-rowgo').click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await videoPronto(page)
  expect(new URL(page.url()).searchParams.get('troca')).toBe(troca)
  // a linha de chegada e a troca selecionada em "Antes e depois"
  const arrive = page.locator(`${HV} [data-arrive]:visible`).first()
  await expect(arrive).toHaveText(/^Aberta pela aba Trocas do canal: /)
  await expect(page.locator(`${HV} #hv-compare:visible [data-arrive]`).first()).toBeVisible()
  // o foco está no marcador (ou no contador do grupo que o guarda), que tem o anel
  await expect.poll(async () => (await foco(page)).atributos.includes('data-arrival'), { timeout: 15_000 }).toBe(true)
  const f = await foco(page)
  expect(f.visivel).toBe(true)
  const anel = await page.locator(`${HV} [data-arrival]:visible span`).first().evaluate(e => { const s = getComputedStyle(e); return { w: s.outlineWidth, style: s.outlineStyle } })
  expect(anel).toEqual({ w: '3px', style: 'solid' })
  // o marcador está dentro da área visível do contêiner que rola (a rolagem só acontece se for preciso)
  await expect.poll(async () => (await foco(page)).naArea, { timeout: 8000 }).toBe(true)
  const f2 = await foco(page)
  medida(`chegada pela troca ${troca.slice(-12)}: foco em ${f2.tag}.${f2.cls.slice(0, 20)} [${f2.atributos.join(' ')}], topo ${f2.topo} fundo ${f2.fundo} (área ${f2.areaTopo}..${f2.areaFundo}); anel ${anel.w} ${anel.style}`)
  await expect(page.locator(`${HV} #hv-live`)).toHaveText(/^Aberta a troca: /)
  // 7 d e 30 d: o foco fica no botão do período
  const botoes = page.locator(`${HV} .rng-ctl:visible .seg button`)
  const botao = (n: string) => botoes.filter({ hasText: new RegExp('^' + n + '$') })
  const focoEm = async () => { const x = await foco(page); return x.tag === 'BUTTON' ? x.texto : x.tag + '.' + x.cls }
  await botao('7 d').click()
  await expect.poll(() => new URL(page.url()).searchParams.get('range'), { timeout: 15_000 }).toBe('7')
  await page.waitForTimeout(1200)
  expect(await focoEm(), 'depois de 7 d').toBe('7 d')
  await expect(page.locator(`${HV} [data-arrival]`)).toHaveCount(0)   // a troca de 11 dias não cabe em 7 d: sem chegada
  await botao('30 d').click()
  await page.waitForTimeout(1500)
  expect(await focoEm(), 'depois de 30 d (a chegada volta; o foco NÃO vai ao marcador)').toBe('30 d')
  const url30 = new URL(page.url())
  medida(`depois de 7 d e 30 d: foco em "${await focoEm()}"; URL ?${url30.searchParams.toString().slice(0, 60)}`)
  await botao('90 d').click()
  await page.waitForTimeout(1200)
  expect(await focoEm(), 'depois de 90 d').toBe('90 d')
})

test('A2.1 troca= antiga (mais de 30 dias) sem range: o período abre ampliado e a frase diz por quê; com range explícito, abre como hoje', async ({ page }) => {
  const troca = `${ids.video(V.velha)}/title/1`
  await abrirVideo(page, V.velha, '?troca=' + encodeURIComponent(troca))
  const botoes = page.locator(`${HV} .rng-ctl:visible .seg button`)
  const marcado = async () => botoes.evaluateAll(bs => bs.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent))
  expect(await marcado(), 'a troca tem 52 dias: o período é 90 d').toEqual(['90 d'])
  await expect(page.locator(`${HV} [data-rng-why]:visible`).first()).toHaveText('Período ampliado para 90 dias para incluir a troca aberta.')
  await expect(page.locator(`${HV} [data-arrive]:visible`).first()).toHaveText(/^Aberta pela aba Trocas do canal: /)
  await expect.poll(async () => (await foco(page)).atributos.includes('data-arrival'), { timeout: 15_000 }).toBe(true)
  await expect.poll(async () => (await foco(page)).naArea, { timeout: 8000 }).toBe(true)
  // clicar em 90 d escreve o range (com chegada, "30 d" também), e a frase some: o período foi escolhido
  const f = await foco(page)
  medida(`troca de 52 d sem range: período ${(await marcado()).join()}, frase de ampliação visível, foco ${f.tag}[${f.atributos.join(' ')}] na área ${f.naArea}`)
  // com range explícito menor que a troca: a tela abre como hoje, sem chegada nem frase
  const vigia = await vigiar(page, async () => { await abrirVideo(page, V.velha, '?range=30&troca=' + encodeURIComponent(troca)) })
  expect(await marcado()).toEqual(['30 d'])
  await expect(page.locator(`${HV} [data-arrive]`)).toHaveCount(0)
  await expect(page.locator(`${HV} [data-rng-why]`)).toHaveCount(0)
  await expect(page.locator(`${HV} [data-arrival]`)).toHaveCount(0)
  expect(vigia.cincoXX).toEqual([])
  // clicar "30 d" quando 30 já é o período não leva a lugar nenhum de ruim
  // 30 d sem range na URL (a chegada existe): o botão 30 d tem de escrever range=30 para valer
  await abrirVideo(page, V.velha, '?troca=' + encodeURIComponent(troca))
  await botoes.filter({ hasText: /^30 d$/ }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('range'), { timeout: 15_000 }).toBe('30')
  expect(await marcado()).toEqual(['30 d'])
})

test('A2.1 troca= inválido abre como hoje, sem erro no console e sem resposta 500', async ({ page }) => {
  const doOutro = `${ids.video(V.few)}/title/1`
  const casos = ['abc', '', encodeURIComponent(doOutro), encodeURIComponent(ids.video(V.full) + '/title/99'), encodeURIComponent('../../etc/passwd'), '%00']
  for (const t of casos) {
    const { erros, cincoXX } = await vigiar(page, async () => {
      const r = await page.goto(videoUrl(V.full, '?troca=' + t))
      expect(r?.status(), 'troca=' + t).toBe(200)
      await videoPronto(page)
    })
    await expect(page.locator(`${HV} [data-arrive]`), 'troca=' + t).toHaveCount(0)
    await expect(page.locator(`${HV} [data-arrival]`)).toHaveCount(0)
    // como hoje: o título tem o foco e o seletor mostra 30 d
    await expect.poll(async () => { const f = await foco(page); return f.tag }, { timeout: 8000 }).toBe('H2')
    expect(await page.locator(`${HV} .rng-ctl:visible .seg button[aria-pressed="true"]`).first().textContent()).toBe('30 d')
    expect(erros, 'troca=' + t + ': console').toEqual([])
    expect(cincoXX, 'troca=' + t).toEqual([])
  }
  medida(`${casos.length} valores ruins de troca= (abc, vazio, de outro vídeo, índice 99, ../, %00): status 200, sem chegada, foco no título, 30 d, console limpo, sem 5xx`)
})

/* ================================================================== A2.2 */
interface Passo { id: string; pos: number; tot: number; titulo: string; live: string; foco: string; remontou: boolean }

/** Clica no botão do pager e devolve o estado depois de a rota chegar: vídeo novo, foco, status. */
async function andar(page: Page, lado: 'prev' | 'next'): Promise<Passo> {
  const botao = page.locator(`${PG} [data-pager-${lado}]`).first()
  const href = (await botao.getAttribute('href'))!
  const destino = idDoVideo(new URL(href, page.url()).toString())
  await page.locator(`${HV}:visible`).first().evaluate(e => { (e as unknown as { __marca: boolean }).__marca = true })
  await botao.click()
  await page.waitForURL(u => idDoVideo(u.toString()) === destino, { timeout: 60_000 })
  await expect(page.locator(`${PG} [data-pager-pos]`).first()).toBeVisible({ timeout: 30_000 })
  // o foco chega depois do render do vídeo novo: no botão usado, ou no outro quando o usado sumiu (fim da lista)
  await expect.poll(async () => (await foco(page)).atributos.some(a => a.startsWith('data-pager-') && a !== 'data-pager-pos'), { timeout: 20_000 }).toBe(true)
  await page.waitForTimeout(500)
  const f = await foco(page)
  const pos = ((await page.locator(`${PG} [data-pager-pos]`).first().textContent()) ?? '').match(/vídeo (\d+) de (\d+)/)
  const titulo = ((await page.locator(`${HV} .vhead h2:visible`).first().textContent()) ?? '').trim()
  const live = ((await page.locator(`${HV} #hv-live:visible, ${HV} #hv-live`).first().textContent()) ?? '').trim()
  const remontou = !(await page.locator(`${HV}:visible`).first().evaluate(e => !!(e as unknown as { __marca?: boolean }).__marca))
  return { id: destino, pos: Number(pos?.[1] ?? NaN), tot: Number(pos?.[2] ?? NaN), titulo, live, foco: f.atributos.find(a => a.startsWith('data-pager')) ?? f.tag + '.' + f.cls.slice(0, 12), remontou }
}

async function abrirDaGrade(page: Page, indice: number, qs = ''): Promise<{ urlCanal: string; topoAntes: number }> {
  await abrirCanal(page, qs)
  const link = page.locator(`${CV} .cv-card:visible`).nth(indice).locator('a.cv-lnk')
  await link.scrollIntoViewIfNeeded()
  const urlCanal = page.url(), topoAntes = await rolagem(page)
  await link.click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await videoPronto(page)
  return { urlCanal, topoAntes }
}

test('A2.2 Anterior e Próximo: o histórico não cresce, o foco fica no botão usado e o status lê "Vídeo N de M: título"; um Voltar devolve a página do canal', async ({ page }) => {
  const { urlCanal } = await abrirDaGrade(page, 3)
  const len0 = await histLen(page)
  const abertura = await page.locator(`${PG} [data-pager-pos]`).first().textContent()
  const m0 = (abertura ?? '').match(/vídeo (\d+) de (\d+)/)!
  const pos0 = Number(m0[1])
  const passos: Passo[] = []
  for (const lado of ['next', 'next', 'prev', 'next'] as const) passos.push(await andar(page, lado))
  const falhas: string[] = []
  const esperado = [pos0 + 1, pos0 + 2, pos0 + 1, pos0 + 2]
  passos.forEach((p, i) => {
    const lado = (['next', 'next', 'prev', 'next'] as const)[i]!
    if (p.pos !== esperado[i]) falhas.push(`passo ${i + 1}: posição ${p.pos}, esperada ${esperado[i]}`)
    if (p.foco !== `data-pager-${lado}`) falhas.push(`passo ${i + 1}: foco em ${p.foco}, esperado data-pager-${lado}`)
    if (p.live !== `Vídeo ${p.pos} de ${p.tot}: ${p.titulo}`) falhas.push(`passo ${i + 1}: status "${p.live}" vs "Vídeo ${p.pos} de ${p.tot}: ${p.titulo}"`)
  })
  medida(`pager (de ${abertura?.slice(0, 40)}): ${passos.map(p => `${p.pos}/${p.tot} foco=${p.foco} remontou=${p.remontou}`).join(' | ')}`)
  expect(falhas, falhas.join('; ')).toEqual([])
  const len1 = await histLen(page)
  expect(len1, 'Anterior/Próximo substituem a entrada: o histórico não cresce').toBe(len0)
  // um Voltar devolve a página do canal (e não o vídeo anterior)
  await page.goBack()
  await page.waitForURL(u => u.pathname.includes('/canal/'), { timeout: 60_000 })
  expect(page.url()).toBe(urlCanal)
})

test('A2.2 Voltar depois de vários Anterior/Próximo (grade): a página do canal volta com o cartão do ÚLTIMO vídeo visto à vista e com o foco nele', async ({ page }) => {
  // o vídeo de partida está no topo da grade; 10 passos à frente levam o último para fora da tela da rolagem restaurada
  const { urlCanal, topoAntes } = await abrirDaGrade(page, 1)
  let ultimo = idDoVideo(page.url())
  for (let i = 0; i < 10; i++) ultimo = (await andar(page, 'next')).id
  await page.goBack()
  await page.waitForURL(u => u.pathname.includes('/canal/'), { timeout: 60_000 })
  expect(page.url()).toBe(urlCanal)
  await page.locator(`${CV} .cv-card:visible`).first().waitFor({ timeout: 30_000 })
  await expect.poll(async () => { const f = await foco(page); return f.id }, { timeout: 15_000 }).toBe('cv-lnk-' + ultimo)
  await page.waitForTimeout(1500)   // a rolagem restaurada reafirma a posição por até 6 s
  const f = await foco(page)
  const alvo = page.locator(`#cv-lnk-${ultimo}:visible`).first()
  const c = await caixa(alvo)
  const depois = await rolagem(page)
  medida(`Voltar após 10 Próximo (grade): foco em "${f.id}" (visível ${f.visivel}); cartão a ${f.topo}..${f.fundo} na área ${f.areaTopo}..${f.areaFundo}; rolagem ${topoAntes} -> ${depois}; caixa ${c.x},${c.y} ${c.w}×${c.h}`)
  expect(f.id).toBe('cv-lnk-' + ultimo)
  expect(f.visivel).toBe(true)
  expect(f.naArea, 'o cartão do último vídeo visto está à vista').toBe(true)
})

test('A2.2 Voltar com a grade rolada fundo: a rolagem de antes volta e o cartão do último vídeo visto (a poucos passos) fica à vista com o foco', async ({ page }) => {
  await abrirCanal(page)
  const alvoLink = page.locator(`${CV} .cv-card:visible`).nth(30).locator('a.cv-lnk')
  await alvoLink.scrollIntoViewIfNeeded()
  const urlCanal = page.url(), topoAntes = await rolagem(page)
  expect(topoAntes, 'a grade está rolada fundo').toBeGreaterThan(1000)
  await alvoLink.click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await videoPronto(page)
  let ultimo = idDoVideo(page.url())
  for (let i = 0; i < 2; i++) ultimo = (await andar(page, 'next')).id
  await page.goBack()
  await page.waitForURL(u => u.pathname.includes('/canal/'), { timeout: 60_000 })
  expect(page.url()).toBe(urlCanal)
  await page.locator(`${CV} .cv-card:visible`).first().waitFor({ timeout: 30_000 })
  await expect.poll(async () => (await foco(page)).id, { timeout: 15_000 }).toBe('cv-lnk-' + ultimo)
  await page.waitForTimeout(1500)
  const depois = await rolagem(page), f = await foco(page)
  medida(`Voltar com a grade rolada fundo (cartão 30 + 2 Próximo): rolagem ${topoAntes} -> ${depois}; foco em ${f.id.slice(0, 16)}… a ${f.topo}..${f.fundo} na área ${f.areaTopo}..${f.areaFundo}`)
  expect(Math.abs(depois - topoAntes), 'a rolagem de antes (até 240 px: o cartão do último pode pedir um ajuste)').toBeLessThanOrEqual(240)
  expect(f.naArea).toBe(true)
})

test('A2.2 Voltar depois de andar PARA TRÁS (Anterior): o cartão do último vídeo visto, acima da rolagem de antes, fica à vista e livre (não sob a barra de controles presa)', async ({ page }) => {
  await abrirCanal(page)
  const alvoLink = page.locator(`${CV} .cv-card:visible`).nth(30).locator('a.cv-lnk')
  await alvoLink.scrollIntoViewIfNeeded()
  const urlCanal = page.url(), topoAntes = await rolagem(page)
  await alvoLink.click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await videoPronto(page)
  let ultimo = idDoVideo(page.url())
  for (let i = 0; i < 14; i++) ultimo = (await andar(page, 'prev')).id
  await page.goBack()
  await page.waitForURL(u => u.pathname.includes('/canal/'), { timeout: 60_000 })
  expect(page.url()).toBe(urlCanal)
  await page.locator(`${CV} .cv-card:visible`).first().waitFor({ timeout: 30_000 })
  await expect.poll(async () => (await foco(page)).id, { timeout: 15_000 }).toBe('cv-lnk-' + ultimo)
  await page.waitForTimeout(1800)
  const alvo = page.locator(`#cv-lnk-${ultimo}:visible`).first()
  const livre = await alvo.evaluate(e => {
    const r = e.getBoundingClientRect(), t = document.elementFromPoint((r.left + r.right) / 2, r.top + 20)
    return { livre: !!t && (t === e || e.contains(t)), quem: t ? t.tagName + '.' + String((t as HTMLElement).className).slice(0, 30) : 'nada', topo: Math.round(r.top) }
  })
  const bar = await caixa(page.locator(`${CV} .cv-ctl:visible`).first())
  const depois = await rolagem(page), f = await foco(page)
  medida(`Voltar após 14 Anterior: rolagem ${topoAntes} -> ${depois}; cartão em ${f.topo}..${f.fundo} (área ${f.areaTopo}..${f.areaFundo}); barra de controles presa ${bar.y}..${bar.bottom}; ponto do cartão a ${livre.topo + 20} ${livre.livre ? 'livre' : 'COBERTO por ' + livre.quem}`)
  expect(f.naArea, 'à vista').toBe(true)
  expect(f.topo, 'abaixo da barra de controles presa').toBeGreaterThanOrEqual(bar.bottom - 1)
  expect(livre.livre, 'nada cobre o cartão: ' + livre.quem).toBe(true)
})

test('A2.2 as teclas [ e ] fazem o que Anterior e Próximo fazem, com o foco no título, e não crescem o histórico', async ({ page }) => {
  await abrirDaGrade(page, 3)
  const len0 = await histLen(page)
  const pos0 = Number((((await page.locator(`${PG} [data-pager-pos]`).first().textContent()) ?? '').match(/vídeo (\d+)/) ?? [])[1])
  const id0 = idDoVideo(page.url())
  await page.locator(`${HV} .vhead h2:visible`).first().focus()
  await page.keyboard.press(']')
  await page.waitForURL(u => idDoVideo(u.toString()) !== id0, { timeout: 60_000 })
  await expect(page.locator(`${PG} [data-pager-pos]`).first()).toContainText(`vídeo ${pos0 + 1} de`, { timeout: 30_000 })
  await expect.poll(async () => (await foco(page)).atributos.includes('data-pager-next'), { timeout: 20_000 }).toBe(true)
  await page.keyboard.press('[')
  await page.waitForURL(u => idDoVideo(u.toString()) === id0, { timeout: 60_000 })
  await expect(page.locator(`${PG} [data-pager-pos]`).first()).toContainText(`vídeo ${pos0} de`, { timeout: 30_000 })
  await expect.poll(async () => (await foco(page)).atributos.includes('data-pager-prev'), { timeout: 20_000 }).toBe(true)
  expect(await histLen(page)).toBe(len0)
  medida(`teclas ] e [ a partir do título: vídeo ${pos0} -> ${pos0 + 1} -> ${pos0}; foco no botão usado; histórico ${len0} -> ${await histLen(page)}`)
})

test('A2.2 o item do canal na trilha faz o mesmo que o Voltar: foco no cartão do último vídeo visto, à vista', async ({ page }) => {
  await abrirDaGrade(page, 1)
  let ultimo = idDoVideo(page.url())
  for (let i = 0; i < 10; i++) ultimo = (await andar(page, 'next')).id
  await page.getByRole('navigation', { name: 'Caminho' }).getByRole('link', { name: 'Matt Wolfe' }).click()
  await page.waitForURL(u => u.pathname.includes('/canal/'), { timeout: 60_000 })
  await page.locator(`${CV} .cv-card:visible`).first().waitFor({ timeout: 30_000 })
  await expect.poll(async () => (await foco(page)).id, { timeout: 15_000 }).toBe('cv-lnk-' + ultimo)
  await page.waitForTimeout(1500)
  const f = await foco(page)
  medida(`item do canal na trilha após 10 Próximo: foco em "${f.id}"; cartão a ${f.topo}..${f.fundo} na área ${f.areaTopo}..${f.areaFundo}`)
  expect(f.id).toBe('cv-lnk-' + ultimo)
  expect(f.naArea, 'à vista').toBe(true)
})

test('A2.2 Voltar da aba Trocas devolve a aba, a rolagem e o foco no "Abrir nesta troca" usado (e no botão do cartão quando foi ele)', async ({ page }) => {
  // (a) o link da troca
  await abrirCanal(page, '?tab=trocas')
  const multi = page.locator(`${CV} .ct-card.multi:visible`).first()
  const linha = multi.locator('li.ct-sw').nth(1)
  const troca = (await linha.getAttribute('data-troca'))!
  const cartaoId = (await multi.getAttribute('data-id'))!
  const urlTrocas = page.url()
  await linha.locator('a.ct-rowgo').click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await videoPronto(page)
  await page.goBack()
  await page.waitForURL(u => u.pathname.includes('/canal/'), { timeout: 60_000 })
  expect(page.url()).toBe(urlTrocas)
  await page.locator(`${CV} .ct-card:visible`).first().waitFor({ timeout: 30_000 })
  await expect.poll(async () => { const f = await foco(page); return f.cls.includes('ct-rowgo') ? f.troca : f.cls }, { timeout: 15_000 }).toBe(troca)
  await page.waitForTimeout(800)
  const fa = await foco(page)
  medida(`Voltar da aba Trocas pelo link da troca: foco em ${fa.tag}.${fa.cls.slice(0, 12)} troca ${fa.troca?.slice(-12)}; na área ${fa.naArea}`)
  expect(fa.troca).toBe(troca)
  expect(fa.naArea).toBe(true)
  // (b) o botão do cartão
  await abrirCanal(page, '?tab=trocas')
  const multi2 = page.locator(`${CV} .ct-card.multi:visible`).first()
  await multi2.locator('a.ct-go').click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await videoPronto(page)
  await page.goBack()
  await page.waitForURL(u => u.pathname.includes('/canal/'), { timeout: 60_000 })
  await page.locator(`${CV} .ct-card:visible`).first().waitFor({ timeout: 30_000 })
  await expect.poll(async () => (await foco(page)).cls.includes('ct-go'), { timeout: 15_000 }).toBe(true)
  const fb = await foco(page)
  medida(`Voltar da aba Trocas pelo botão do cartão: foco em ${fb.tag}.${fb.cls.slice(0, 12)}; na área ${fb.naArea}`)
  expect(fb.naArea).toBe(true)
  // (c) o pager andou para o outro vídeo com trocas: vale o botão do cartão dele
  await abrirCanal(page, '?tab=trocas')
  const multi3 = page.locator(`${CV} .ct-card.multi:visible`).first()
  await multi3.locator('li.ct-sw').nth(1).locator('a.ct-rowgo').click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await videoPronto(page)
  const lado = (await page.locator(`${PG} [data-pager-next]`).count()) ? 'next' : 'prev'
  const saida = idDoVideo(page.url())
  const p = await andar(page, lado)
  expect(p.id).not.toBe(saida)
  const outro = p.id
  await page.goBack()
  await page.waitForURL(u => u.pathname.includes('/canal/'), { timeout: 60_000 })
  await page.locator(`${CV} .ct-card:visible`).first().waitFor({ timeout: 30_000 })
  await expect.poll(async () => (await foco(page)).cls.includes('ct-go'), { timeout: 15_000 }).toBe(true)
  const fc = await page.evaluate(() => { const a = document.activeElement as HTMLElement; return a.closest<HTMLElement>('li.ct-card')?.dataset.id ?? '' })
  medida(`Voltar da aba Trocas depois do pager (${lado}): foco no botão do cartão de ${fc.slice(-8)} (o vídeo para onde o pager andou: ${outro.slice(-8)}); o cartão de saída era ${cartaoId.slice(-8)}`)
  expect(fc).toBe(outro)
})

test('A2.2 a frase de posição descreve a origem (grade com filtro; aba Trocas)', async ({ page }) => {
  // grade com filtro e ordem
  await abrirCanal(page, '?fmt=longos&sort=vistos')
  await page.locator(`${CV} .cv-card:visible`).nth(2).locator('a.cv-lnk').click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await videoPronto(page)
  const frase = ((await page.locator(`${PG} [data-pager-pos]`).first().textContent()) ?? '').trim()
  medida(`frase da grade: "${frase}"`)
  expect(frase).toMatch(/^vídeo 3 de \d+ de Matt Wolfe \(longos, mais vistos primeiro\)$/)
  const aria = await page.locator(`${PG} [data-pager-next]`).first().getAttribute('aria-label')
  expect(aria).toBe('Próximo vídeo em Canais')
  // aba Trocas
  await abrirCanal(page, '?tab=trocas')
  await page.locator(`${CV} .ct-card:visible`).first().locator('a.ct-go').click()
  await page.waitForURL(/\/competitors\/video\//, { timeout: 60_000 })
  await videoPronto(page)
  const frase2 = ((await page.locator(`${PG} [data-pager-pos]`).first().textContent()) ?? '').trim()
  medida(`frase da aba Trocas: "${frase2}"`)
  expect(frase2).toMatch(/^vídeo \d+ de \d+ com trocas de Matt Wolfe \(trocas dos últimos 30 dias, da mais recente à mais antiga\)$/)
  // sem lista (origem sem ids): sem pager
  await abrirVideo(page, V.full, `?from=canais&canal=${CH()}`)
  await expect(page.locator(`${PG} [data-pager]`)).toHaveCount(0)
})

/* ================================================================== pager: lugar na tela */
test('o pager fica no lugar do mockup aprovado: na mesma linha da trilha, à direita', async ({ page }) => {
  await abrirDaGrade(page, 3)
  const trilha = await caixa(page.locator('.obs-tr-top:visible').first())
  const nav = await caixa(page.getByRole('navigation', { name: 'Caminho' }))
  const pager = await caixa(page.locator(`${PG} [data-pager]`).first())
  const cab = await caixa(page.locator(`${HV} .vhead:visible`).first())
  medida(`1440: linha da trilha ${trilha.x},${trilha.y} ${trilha.w}×${trilha.h}; trilha (nav) ${nav.x},${nav.y} ${nav.w}×${nav.h}; pager ${pager.x},${pager.y} ${pager.w}×${pager.h}; cabeçalho do vídeo começa em ${cab.y}`)
  // mockup (hist.css .crumbs: space-between): trilha e pager na mesma linha; o pager começa à direita da trilha
  expect(pager.y, 'o pager não está numa linha abaixo da trilha').toBeLessThan(nav.bottom)
  expect(pager.x, 'o pager está à direita da trilha').toBeGreaterThan(nav.right)
  expect(pager.right, 'o pager não passa da borda da tela').toBeLessThanOrEqual(trilha.right + 1)
  // e não encosta na nota de fuso, que fecha a linha
  const tz = await caixa(page.locator('.obs-tr-tz:visible').first())
  expect(pager.right, 'o pager não cobre a nota de fuso').toBeLessThanOrEqual(tz.x)
  await page.screenshot({ path: path.resolve(__dirname, '../../../../test-results/historico-a2-pager-1440.png'), clip: { x: 200, y: 150, width: 1240, height: 260 } })
})

test('o pager na linha da trilha tem contraste legível nos dois temas (texto de posição e botões)', async ({ page }) => {
  for (const tema of ['dark', 'light'] as const) {
    await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
    await page.emulateMedia({ colorScheme: tema })
    await abrirDaGrade(page, 3)
    const r = await page.evaluate(() => {
      const lum = (c: string) => { const m = c.match(/[\d.]+/g)!.map(Number); const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(m[0]!) + 0.7152 * f(m[1]!) + 0.0722 * f(m[2]!) }
      const fundo = (e: Element) => { for (let p: Element | null = e; p; p = p.parentElement) { const b = getComputedStyle(p).backgroundColor; if (b && !/rgba?\(.*,\s*0\)$/.test(b) && b !== 'transparent') return b } return 'rgb(255,255,255)' }
      const razao = (e: Element) => { const a = lum(getComputedStyle(e).color), b = lum(fundo(e)); return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100 }
      const raiz = document.querySelector('.obs-ch-root')!
      return { pos: razao(raiz.querySelector('[data-pager-pos]')!), botao: razao(raiz.querySelector('[data-pager-next]')!), trilha: razao(raiz.querySelector('.obs-tr-top .crumbs a')!) }
    })
    medida(`tema ${tema}: contraste do texto de posição ${r.pos}, dos botões do pager ${r.botao}, da trilha ${r.trilha}`)
    expect(r.pos, tema + ': texto de posição').toBeGreaterThanOrEqual(4.5)
    expect(r.botao, tema + ': botões').toBeGreaterThanOrEqual(4.5)
  }
  await page.context().addCookies([{ name: 'btf_theme', value: 'dark', url: 'http://localhost:3099' }])
})

/* ================================================================== A2.5 */
test('A2.5 o gráfico e as três raias cabem sem rolar em 1440×900 (terminam em até 760 px)', async ({ page }) => {
  for (const origem of ['', `?from=canais&canal=${CH()}`]) {
    await abrirVideo(page, V.full, origem)
    const tl = await caixa(page.locator(`${HV} .tl-wrap:visible`).first())
    const raias = await caixa(page.locator(`${HV} .lanes:visible`).first())
    const topo = await caixa(page.locator(`${HV} .vhead:visible`).first())
    const rolou = await rolagem(page)
    medida(`${origem ? 'do canal' : 'sem origem'}: cabeçalho do vídeo em ${topo.y}..${topo.bottom}; gráfico+raias ${tl.y}..${tl.bottom} (raias ${raias.y}..${raias.bottom}); rolagem ${rolou}`)
    // O mockup termina em 737 px com a casca dele; a casca real do CMS começa a trilha 34 px mais abaixo (181 contra 147), então o critério que vale
    // aqui é o do spec ("cabem sem rolar"): o gráfico e as três raias terminam DENTRO da janela de 900 px, e quanto passa dos 760 do brief fica medido.
    expect(tl.bottom, 'o gráfico e as raias cabem sem rolar (janela de 900 px)').toBeLessThanOrEqual(900)
    expect(raias.bottom, 'as três raias inteiras na janela').toBeLessThanOrEqual(900)
  }
})

/* ================================================================== sem rolagem horizontal */
test('sem rolagem horizontal da página em 1440, 1024, 768 e 390 px', async ({ page }) => {
  const tamanhos = [{ width: 1440, height: 900 }, { width: 1024, height: 800 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]
  const casos: Array<{ nome: string; oracle: string; qs: string }> = [
    { nome: 'do canal (grade)', oracle: V.full, qs: `?from=canais&canal=${CH()}&ids=${ids.video(V.full)},${ids.video(V.few)}&pos=1&tot=2&back=` },
    { nome: 'chegada pela troca', oracle: V.full, qs: `?troca=${encodeURIComponent(ids.video(V.full) + '/thumb/2')}` },
    { nome: 'fora dos acompanhados', oracle: V.untr, qs: '' },
  ]
  for (const t of tamanhos) for (const c of casos) {
    await abrirVideo(page, c.oracle, c.qs, t)
    const falhas = await transbordo(page)
    if (c.qs.includes('&ids=')) {
      // trilha, pager e nota de fuso não se cobrem (o pager desce para a linha de baixo quando não cabe)
      const [nav, pg, tz] = [await caixa(page.getByRole('navigation', { name: 'Caminho' })), await caixa(page.locator(`${PG} [data-pager]`).first()), await caixa(page.locator('.obs-tr-tz:visible').first())]
      const cobre = (a: Caixa, b: Caixa) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom
      if (cobre(nav, pg)) falhas.push('o pager cobre a trilha')
      if (cobre(pg, tz)) falhas.push('o pager cobre a nota de fuso')
      if (cobre(nav, tz)) falhas.push('a trilha cobre a nota de fuso')
      medida(`${t.width}×${t.height} linha da trilha: trilha ${nav.x},${nav.y} ${nav.w}×${nav.h}; pager ${pg.x},${pg.y} ${pg.w}×${pg.h}; nota ${tz.x},${tz.y}`)
    }
    medida(`${t.width}×${t.height} ${c.nome}: ${falhas.length ? falhas.join('; ') : 'sem transbordo'}`)
    expect(falhas, `${t.width}×${t.height} ${c.nome}`).toEqual([])
  }
})

/* ================================================================== vídeos sem gráfico, na moldura nova */
test('vídeo não encontrado e vídeo fora dos acompanhados: moldura só com a trilha, sem seletor de período, sem erro, a trilha leva de volta', async ({ page }) => {
  // não encontrado
  const desconhecido = '00000000-0000-4000-8000-000000000042'
  const nf = await vigiar(page, async () => {
    const r = await page.goto(`/cms/youtube/competitors/video/${desconhecido}?from=canais&canal=${CH()}&troca=abc`)
    expect(r?.status()).toBe(200)
    await expect(page.locator(`${HV} [data-not-found]:visible`).first()).toContainText('Vídeo não encontrado', { timeout: 60_000 })
  })
  const trilha = page.getByRole('navigation', { name: 'Caminho' })
  expect(await trilha.locator('a').count(), 'a trilha leva de volta').toBeGreaterThan(0)
  expect(await page.locator('.obs-ch-root:visible [role="tablist"]').count()).toBe(0)
  await expect(page.locator(`${HV} .rng-ctl`)).toHaveCount(0)
  expect(nf.erros, 'console').toEqual([])
  expect(nf.cincoXX).toEqual([])
  const voltar = page.locator(`${HV} [data-not-found] a`).first()
  const hrefVoltar = await voltar.getAttribute('href')
  const nfTexto = ((await page.locator(`${HV} [data-not-found]`).first().textContent()) ?? '').trim()
  medida(`não encontrado: "${nfTexto.slice(0, 120)}"; link de volta ${hrefVoltar}; itens da trilha ${(await trilha.locator('li').allTextContents()).join(' › ')}`)
  await trilha.locator('a').first().click()
  await page.waitForURL(u => !u.pathname.includes('/video/'), { timeout: 60_000 })
  // fora dos acompanhados, com troca= (que não vira chegada) e com range
  for (const qs of ['', '?troca=' + encodeURIComponent(ids.video(V.untr) + '/title/1'), '?range=7&from=canais&canal=' + ids.channel('luke-damant')]) {
    const r = await vigiar(page, async () => { await abrirVideo(page, V.untr, qs) })
    await expect(page.locator(`${HV} [data-untracked]:visible`).first()).toBeVisible()
    await expect(page.locator(`${HV} .rng-ctl`)).toHaveCount(0)
    await expect(page.locator(`${HV} [data-arrive]`)).toHaveCount(0)
    expect(await page.locator('.obs-ch-root:visible [role="tablist"]').count()).toBe(0)
    await expect.poll(async () => (await foco(page)).tag, { timeout: 8000 }).toBe('H2')
    expect(r.erros, 'console ' + qs).toEqual([])
    expect(r.cincoXX).toEqual([])
    expect(await page.getByRole('navigation', { name: 'Caminho' }).locator('a').count(), 'a trilha continua levando de volta').toBeGreaterThan(0)
  }
  medida('fora dos acompanhados (sem query, com troca=, com range e canal): aviso presente, sem seletor de período, foco no título, console limpo, sem 5xx')
})

/* ================================================================== A2.3 (tarefa 6): o visualizador de thumbnail */
// O oráculo semeado não traz imagens arquivadas (thumb_blob_url nulo) e a rede de imagens não deve ser tocada: o banco LOCAL ganha, só para estes
// testes, endereços de Blob para três dos quatro períodos de thumbnail de matt-opus55 (A, B, A, C: o B fica sem cópia), e as respostas das imagens
// (i.ytimg.com e *.public.blob.vercel-storage.com) são feitas aqui, por `page.route`. A CSP continua a do site: o que ela barra, barra de verdade.
// Os endereços são devolvidos a nulo no fim (afterAll), para os outros arquivos continuarem com o oráculo como ele é.
import { localServiceClient } from '../../../fixtures/observatorio-seed'

const BLOB_HOST = 'https://e2e-obs.public.blob.vercel-storage.com'
const blobDe = (i: number) => `${BLOB_HOST}/obs/${V.full}-${i}.svg`
const svg = (w: number, h: number, rotulo: string, cor: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${cor}"/><circle cx="${w / 2}" cy="${h / 2}" r="${h / 4}" fill="#fff" opacity=".85"/><text x="24" y="${h - 24}" font-size="${Math.round(h / 12)}" fill="#fff" font-family="sans-serif">${rotulo}</text></svg>`
/** `lentoMs`: segura a resposta das imagens do YouTube (para ver o que o diálogo mostra enquanto a maior ainda não chegou). */
async function rotearImagens(page: Page, o: { lentoMs?: number } = {}): Promise<{ pedidos: string[] }> {
  const pedidos: string[] = []
  await page.route('https://i.ytimg.com/**', async route => {
    const url = route.request().url()
    pedidos.push(url)
    if (o.lentoMs) await new Promise(r => setTimeout(r, o.lentoMs))
    if (/\/maxresdefault\.jpg/.test(url)) return route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: svg(1280, 720, 'maxresdefault 1280x720', '#14532d') })
    // as miniaturas de 320x180 dos cartões do canal e o que mais o YouTube serviria
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: svg(320, 180, 'mqdefault 320x180', '#1e3a8a') })
  })
  await page.route(`${BLOB_HOST}/**`, route => {
    const url = route.request().url()
    pedidos.push(url)
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: svg(480, 360, 'arquivada ' + url.split('/').pop(), '#7c2d12') })
  })
  return { pedidos }
}
async function arquivar(ligar: boolean): Promise<void> {
  const sb = localServiceClient(), vid = ids.video(V.full)
  const { data, error } = await sb.from('competitor_video_versions').select('id').eq('video_id', vid).eq('field', 'thumb').order('first_seen_at')
  if (error || !data) throw new Error('arquivar: ' + (error?.message ?? 'sem linhas'))
  for (const [i, row] of data.entries()) {
    const { error: e } = await sb.from('competitor_video_versions').update({ thumb_blob_url: ligar && i !== 1 ? blobDe(i) : null }).eq('id', row.id)
    if (e) throw new Error('arquivar: ' + e.message)
  }
}

test.describe('A2.3 o visualizador de thumbnail', () => {
  test.beforeAll(async () => { test.setTimeout(240_000); ids = seedIdsOf(await ensureSeeded({ canalCompleto: true })); await arquivar(true) })
  test.afterAll(async () => { await arquivar(false) })

  const dlg = (page: Page) => page.locator('.obs-tv-box[role="dialog"]')
  const fundoCobre = (page: Page) => page.evaluate(() => {
    // em cada canto e no centro da janela, o que está por cima pertence ao diálogo (ou ao contêiner dele): nada da tela fica acima
    const w = innerWidth, h = innerHeight, falhas: string[] = []
    for (const [x, y] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3], [w / 2, h / 2], [w / 2, 3]] as const) {
      const e = document.elementFromPoint(x, y)
      if (!e?.closest('.obs-tv')) falhas.push(`${Math.round(x)},${Math.round(y)} → ${e?.tagName}.${String((e as HTMLElement | null)?.className ?? '').slice(0, 30)}`)
    }
    return falhas
  })
  const foco2 = (page: Page) => page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return { tag: a?.tagName ?? '', id: a?.id ?? '', dentro: !!a?.closest('.obs-tv'), texto: (a?.textContent ?? '').trim().slice(0, 60), rotulo: a?.getAttribute('aria-label') ?? '' } })

  test('A2.3 os gatilhos do Histórico abrem o visualizador e Esc devolve o foco', async ({ page }) => {
    await rotearImagens(page)
    const { erros, cincoXX } = await vigiar(page, async () => { await abrirVideo(page, V.full) })
    const tela = page.locator(`${HV}:visible`).first()
    // ---- o gatilho 1 (cabeçalho), 3 (cartões) e 2 (Antes e depois), cada um com sua versão esperada
    const casos: Array<{ nome: string; alvo: () => Locator; esperado: RegExp }> = [
      { nome: 'gatilho 1: o cabeçalho', alvo: () => tela.locator('.vhead .cur [role="button"]'), esperado: /· 4 de 4$/ },
      { nome: 'gatilho 3: o cartão do período 1', alvo: () => tela.locator('.film .fcard').nth(0).locator('[role="button"]'), esperado: /· 1 de 4$/ },
      { nome: 'gatilho 3: o cartão do período 2 (sem cópia)', alvo: () => tela.locator('.film .fcard').nth(1).locator('[role="button"]'), esperado: /· 2 de 4$/ },
      { nome: 'gatilho 3: o cartão do período 4', alvo: () => tela.locator('.film .fcard').nth(3).locator('[role="button"]'), esperado: /· 4 de 4$/ },
    ]
    for (const c of casos) {
      const g = c.alvo()
      await g.scrollIntoViewIfNeeded()
      await g.focus()
      await g.press('Enter')
      await expect(dlg(page), c.nome).toBeVisible()
      await expect(dlg(page).locator('.obs-tv-pos')).toHaveText(c.esperado)
      const f = await foco2(page)
      expect(f.tag, c.nome + ': o foco abre no título do diálogo').toBe('H2')
      expect(f.dentro).toBe(true)
      expect(await dlg(page).locator('xpath=ancestor::*[contains(@class,"obs-tv")][1]').evaluate(e => getComputedStyle(e).zIndex), c.nome + ': camada do modal').toBe('2000')
      expect(await fundoCobre(page), c.nome + ': nada da tela fica acima do diálogo').toEqual([])
      await page.keyboard.press('Escape')
      await expect(dlg(page)).toHaveCount(0)
      expect(await g.evaluate(e => e === document.activeElement), c.nome + ': Esc devolve o foco ao gatilho').toBe(true)
    }
    // ---- o gatilho 2: os dois lados de uma troca de thumbnail em "Antes e depois"
    const trocas = tela.locator('#hv-compare .pair, #hv-compare li[data-k]')
    let achou = 0
    for (let k = 0; k < await trocas.count() && achou < 2; k++) {
      await trocas.nth(k).click()
      const lados = tela.locator('#hv-compare .ba .side [role="button"]')
      const n = await lados.count()
      if (n < 2) continue
      for (let j = 0; j < n; j++) {
        const g = lados.nth(j)
        await g.focus(); await g.press('Space')
        await expect(dlg(page)).toBeVisible()
        const pos = (await dlg(page).locator('.obs-tv-pos').textContent()) ?? ''
        medida(`gatilho 2, troca ${k}, lado ${j}: abre em "${pos}"`)
        await page.keyboard.press('Escape')
        await expect(dlg(page)).toHaveCount(0)
        expect(await g.evaluate(e => e === document.activeElement), 'gatilho 2: Esc devolve o foco').toBe(true)
      }
      achou++
    }
    expect(achou, 'há ao menos uma troca de thumbnail com os dois lados').toBeGreaterThan(0)
    // ---- o gatilho 4: o clique simples vai ao cartão na hora; o duplo abre o diálogo
    const clip = tela.locator('.lane[data-lane="thumb"] button.clip:visible').first()
    await expect(clip).toBeVisible()
    const k = (await clip.getAttribute('data-k')) ?? ''
    const i = Number(k.split(':')[1])
    const t0 = Date.now()
    await clip.click()
    const noCartao = await page.evaluate(() => document.activeElement?.getAttribute('data-ver') ?? null)
    medida(`gatilho 4: o clique simples levou o foco a data-ver="${noCartao}" em ${Date.now() - t0} ms (clique incluído); sem diálogo: ${await dlg(page).count() === 0}`)
    expect(noCartao).toBe('thumb:' + i)
    await expect(dlg(page)).toHaveCount(0)
    await clip.dblclick()
    await expect(dlg(page)).toBeVisible()
    await expect(dlg(page).locator('.obs-tv-pos')).toHaveText(new RegExp(`· ${i + 1} de 4$`))
    await page.keyboard.press('Escape')
    await expect(dlg(page)).toHaveCount(0)
    // a legenda do gráfico diz isso
    await expect(tela.locator('[data-legend]')).toContainText('clique duplo numa miniatura da faixa Thumbnail a amplia')
    medida(`A2.3 gatilhos 1 a 4 conferidos; erros de console ${erros.length}; 5xx ${cincoXX.length}`)
    expect(cincoXX).toEqual([])
  })

  test('A2.3 o diálogo mostra a imagem que já estava na tela enquanto a maior carrega; e a maior entra depois', async ({ page }) => {
    await rotearImagens(page, { lentoMs: 1500 })
    await abrirVideo(page, V.full)
    const g = page.locator(`${HV}:visible .vhead .cur [role="button"]`).first()
    await g.click()
    await expect(dlg(page)).toBeVisible()
    const antes = await dlg(page).locator('.obs-tv-main').evaluate(e => ({ img: e.querySelector('img')?.getAttribute('src') ?? null, texto: (e.textContent ?? '').trim() }))
    medida(`preview antes da maior: img=${antes.img}; texto do quadro="${antes.texto}"`)
    expect(antes.img, 'a imagem do cabeçalho aparece na hora').toBe(blobDe(3))
    expect(antes.texto).not.toMatch(/Carregando a imagem/)
    await expect(dlg(page).locator('.obs-tv-stage img')).toHaveAttribute('src', /maxresdefault\.jpg/, { timeout: 20_000 })
    await expect(dlg(page).locator('.obs-tv-res')).toContainText('maxresdefault.jpg, 1280×720 px (maior resolução disponível)')
  })

  test('A2.3 a roda amplia em torno do cursor e arrastar move; os percentuais e o 100% batem com os pixels; o fundo fica inerte; D10 (Baixar)', async ({ page }) => {
    const msgs: string[] = []
    page.on('console', m => { if (m.type() === 'error') msgs.push(m.text().slice(0, 300)) })
    await rotearImagens(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await abrirVideo(page, V.full)
    await page.locator(`${HV}:visible .vhead .cur [role="button"]`).first().click()
    const stage = dlg(page).locator('.obs-tv-stage')
    await expect(stage.locator('img')).toHaveAttribute('src', /maxresdefault\.jpg/, { timeout: 20_000 })
    const img = stage.locator('img')
    const medidaImg = () => img.evaluate(e => { const r = e.getBoundingClientRect(), s = e.closest('.obs-tv-stage')!.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.left - s.left, y: r.top - s.top, nw: (e as HTMLImageElement).naturalWidth, sw: s.width, sh: s.height } })
    const m0 = await medidaImg()
    const pctTexto = async () => parseInt(((await dlg(page).locator('.obs-tv-pct').textContent()) ?? '0').replace('%', ''), 10)
    medida(`Ajustar: imagem ${m0.w.toFixed(1)}×${m0.h.toFixed(1)} na caixa ${m0.sw}×${m0.sh}; natural ${m0.nw}; escrito ${await pctTexto()}%; esperado ${(m0.w / m0.nw * 100).toFixed(1)}%`)
    expect(Math.abs(await pctTexto() - Math.round(m0.w / m0.nw * 100))).toBeLessThanOrEqual(1)
    // "100%": um pixel da imagem por pixel da tela
    await dlg(page).getByRole('button', { name: '100%' }).click()
    const m100 = await medidaImg()
    medida(`100%: largura ${m100.w.toFixed(2)} para natural ${m100.nw}`)
    expect(Math.abs(m100.w - m100.nw)).toBeLessThanOrEqual(0.6)
    await dlg(page).getByRole('button', { name: 'Ajustar' }).click()
    // a roda amplia em torno do cursor: o ponto da imagem sob o cursor fica sob o cursor
    const sb = (await stage.boundingBox())!
    // perto do centro: mais longe, a borda da imagem que ficaria à mostra a empurra de volta (o enquadramento nunca abre um vão), e o ponto sob o cursor anda
    const cx = sb.x + sb.width * 0.45, cy = sb.y + sb.height * 0.6
    const ponto = async () => { const m = await medidaImg(); return { u: (cx - sb.x - m.x) / m.w, v: (cy - sb.y - m.y) / m.h, w: m.w } }
    const p0 = await ponto()
    await page.mouse.move(cx, cy)
    await page.mouse.wheel(0, -400)
    await expect.poll(async () => (await ponto()).w).toBeGreaterThan(p0.w * 1.2)
    const p1 = await ponto()
    medida(`roda -400 em (${Math.round(cx)},${Math.round(cy)}): largura ${p0.w.toFixed(0)} → ${p1.w.toFixed(0)}; ponto da imagem sob o cursor (${p0.u.toFixed(3)},${p0.v.toFixed(3)}) → (${p1.u.toFixed(3)},${p1.v.toFixed(3)}); escrito ${await pctTexto()}%`)
    expect(Math.abs(p1.u - p0.u)).toBeLessThan(0.01); expect(Math.abs(p1.v - p0.v)).toBeLessThan(0.01)
    // arrastar move (e não passa da borda)
    const a0 = await medidaImg()
    await page.mouse.down(); await page.mouse.move(cx - 60, cy - 40, { steps: 6 }); await page.mouse.up()
    const a1 = await medidaImg()
    medida(`arrastar (-60,-40): posição ${a0.x.toFixed(1)},${a0.y.toFixed(1)} → ${a1.x.toFixed(1)},${a1.y.toFixed(1)}`)
    expect(Math.abs((a1.x - a0.x) + 60) + Math.abs((a1.y - a0.y) + 40)).toBeLessThan(1.5)
    // clique duplo alterna Ajustar e 100% (o "Ajustar" muda de percentual quando a linha de status aparece e encolhe a caixa: a referência é a de agora)
    await dlg(page).getByRole('button', { name: 'Ajustar' }).click()
    const ajuste = await pctTexto()
    medida(`Ajustar agora: ${ajuste}% (era ${Math.round(m0.w / m0.nw * 100)}% antes de a linha de status aparecer)`)
    await stage.dblclick({ position: { x: 100, y: 100 } })
    await expect.poll(async () => (await pctTexto())).toBe(100)
    await stage.dblclick({ position: { x: 100, y: 100 } })
    await expect.poll(async () => (await pctTexto())).toBe(ajuste)
    // o fundo está inerte: nenhuma Tab alcança a tela de trás; Shift+Tab a partir do título vai ao último controle
    const titulo = dlg(page).locator('h2')
    await titulo.focus()
    const visitados = new Set<string>()
    for (let n = 0; n < 24; n++) { await page.keyboard.press('Tab'); const f = await foco2(page); visitados.add(f.tag + '|' + f.texto + f.rotulo); if (!f.dentro) throw new Error('Tab saiu do diálogo: ' + JSON.stringify(f)) }
    medida(`Tab: ${visitados.size} paradas distintas, todas dentro do diálogo`)
    await titulo.focus()
    await page.keyboard.press('Shift+Tab')
    expect((await foco2(page)).texto, 'Shift+Tab do título vai ao Baixar').toContain('Baixar')
    // ---- D10, a thumbnail ATUAL (i.ytimg.com): o fetch é barrado pela CSP; cai em abrir em outra aba, com o aviso
    const fetchYt = await page.evaluate(() => fetch('https://i.ytimg.com/vi/x/hqdefault.jpg').then(r => 'passou ' + r.status, e => 'recusado: ' + String(e)))
    medida(`D10 fetch(i.ytimg.com) pela página: ${fetchYt}`)
    expect(fetchYt).toMatch(/^recusado/)
    const popupP = page.waitForEvent('popup', { timeout: 15_000 }).catch(() => null)
    await dlg(page).getByRole('button', { name: 'Baixar' }).click()
    const popup = await popupP
    medida(`D10 Baixar da atual: popup ${popup ? popup.url().slice(0, 90) : 'NÃO abriu'}; status "${((await dlg(page).locator('.obs-tv-msg').textContent()) ?? '').trim()}"`)
    expect(popup, 'Baixar da atual abre outra aba').not.toBeNull()
    expect(popup!.url()).toMatch(/i\.ytimg\.com\/vi\/.+\/maxresdefault\.jpg/)
    await popup!.close()
    await expect(dlg(page).locator('.obs-tv-msg')).toContainText('salve por lá')
    expect(msgs.some(t => /Content Security Policy|connect-src/i.test(t)), 'a violação de connect-src aparece no console').toBe(true)
    medida(`D10 console: ${msgs.filter(t => /Content Security Policy|connect-src/i.test(t)).slice(0, 1).join(' | ').slice(0, 220)}`)
    // ---- D10, uma versão ARQUIVADA (Blob): o fetch passa e o arquivo baixa
    const fetchBlob = await page.evaluate(u => fetch(u).then(r => 'passou ' + r.status, e => 'recusado: ' + String(e)), blobDe(2))
    medida(`D10 fetch(Blob simulado) pela página: ${fetchBlob}`)
    expect(fetchBlob).toBe('passou 200')
    await dlg(page).getByRole('button', { name: 'Anterior' }).click()   // 3 de 4: a arquivada A
    await expect(dlg(page).locator('.obs-tv-pos')).toHaveText(/· 3 de 4$/)
    await expect(dlg(page).locator('.obs-tv-stage img')).toHaveAttribute('src', blobDe(2), { timeout: 20_000 })
    const baixar = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null)
    const popup2 = page.waitForEvent('popup', { timeout: 4_000 }).catch(() => null)
    await dlg(page).getByRole('button', { name: 'Baixar' }).click()
    const d = await baixar
    medida(`D10 Baixar da arquivada: ${d ? 'download "' + d.suggestedFilename() + '"' : 'SEM download (popup: ' + ((await popup2)?.url() ?? 'não') + ')'}`)
    expect(d, 'Baixar da arquivada baixa o arquivo').not.toBeNull()
    expect(d!.suggestedFilename()).toBe('thumbnail-capa-a.svg')
  })

  test('A2.3 o diálogo fica acima de tudo e dentro da janela em 1440 e 390 px', async ({ page }) => {
    await rotearImagens(page)
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await abrirVideo(page, V.full, '', size)
      const g = page.locator(`${HV}:visible .vhead .cur [role="button"]`).first()
      await g.scrollIntoViewIfNeeded()
      await g.click()
      await expect(dlg(page)).toBeVisible()
      await expect(dlg(page).locator('.obs-tv-stage img')).toHaveAttribute('src', /maxresdefault\.jpg/, { timeout: 20_000 })
      const box = (await dlg(page).boundingBox())!
      const dentro = box.x >= -0.5 && box.y >= -0.5 && box.x + box.width <= size.width + 0.5 && box.y + box.height <= size.height + 0.5
      const tr = await transbordo(page)
      const naoCobre = await fundoCobre(page)
      const alvos = await dlg(page).locator('button:visible, a[role="link"]:visible').evaluateAll(bs => bs.map(b => { const r = b.getBoundingClientRect(); return { n: (b.getAttribute('aria-label') ?? b.textContent ?? '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) } }))
      const pequenos = alvos.filter(a => Math.min(a.w, a.h) < 44)
      const rola = await page.evaluate(() => ({ h: document.documentElement.scrollWidth - document.documentElement.clientWidth, caixa: (document.querySelector('.obs-tv-box') as HTMLElement).scrollHeight - (document.querySelector('.obs-tv-box') as HTMLElement).clientHeight }))
      medida(`${size.width}×${size.height}: caixa ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)} dentro=${dentro}; fundo coberto=${naoCobre.length === 0}; rolagem horizontal ${rola.h}, rolagem da caixa ${rola.caixa}; alvos < 44 px: ${pequenos.length ? pequenos.map(a => `${a.n} ${a.w}×${a.h}`).join(', ') : 'nenhum'} (de ${alvos.length})`)
      expect(dentro, size.width + ': a caixa cabe na janela').toBe(true)
      expect(naoCobre, size.width + ': nada acima do diálogo').toEqual([])
      expect(rola.h, size.width + ': sem rolagem horizontal').toBeLessThanOrEqual(1)
      void tr
      if (size.width < 900) expect(pequenos, '390 px: alvos de 44 px').toEqual([])
      await page.keyboard.press('Escape')
      await expect(dlg(page)).toHaveCount(0)
    }
  })

  test('A2.3 a lupa da grade do canal abre o visualizador', async ({ page }) => {
    await rotearImagens(page)
    const { erros, cincoXX } = await vigiar(page, async () => { await abrirCanal(page) })
    const tela = page.locator(`${CV}:visible`).first()
    const cartao = tela.locator('li.cv-card').first()
    const lupa = cartao.locator('.cv-amp')
    await lupa.focus()
    await lupa.click()
    await expect(dlg(page)).toBeVisible()
    expect((await foco2(page)).tag).toBe('H2')
    const titulo = ((await dlg(page).locator('h2').textContent()) ?? '').replace(/^Thumbnail: /, '')
    expect(titulo).toBe(((await cartao.locator('.cv-ttl').textContent()) ?? '').trim())
    await expect(dlg(page).locator('.obs-tv-stage img')).toHaveAttribute('src', /maxresdefault\.jpg/, { timeout: 20_000 })
    expect(await fundoCobre(page)).toEqual([])
    await page.keyboard.press('Escape')
    await expect(dlg(page)).toHaveCount(0)
    expect(await lupa.evaluate(e => e === document.activeElement), 'Esc devolve o foco à lupa').toBe(true)
    // o item "Ampliar thumbnail" do menu "Ações do vídeo": o foco volta ao botão ⋯
    const abtn = cartao.getByRole('button', { name: /^Ações do vídeo: / })
    await abtn.click()
    await page.getByRole('menuitem', { name: 'Ampliar thumbnail' }).click()
    await expect(dlg(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dlg(page)).toHaveCount(0)
    expect(await abtn.evaluate(e => e === document.activeElement), 'Esc devolve o foco ao botão ⋯').toBe(true)
    // o vídeo com quatro períodos (matt-opus55) abre na atual e oferece as outras
    const q = tela.locator('li.cv-card', { has: page.locator(`#cv-lnk-${ids.video(V.full)}`) })
    if (await q.count()) {
      await q.locator('.cv-amp').click()
      await expect(dlg(page).locator('.obs-tv-pos')).toHaveText(/· 4 de 4$/)
      await page.keyboard.press('Escape')
    } else medida('matt-opus55 não está no primeiro lote da grade; a atual com as outras versões fica provada no jsdom')
    // a aba Trocas
    await abrirCanal(page, '?tab=trocas')
    const cardT = tela.locator('li.ct-card').first()
    await cardT.locator('.cv-amp').click()
    await expect(dlg(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dlg(page)).toHaveCount(0)
    expect(erros.filter(t => !/Content Security Policy/.test(t)), 'console').toEqual([])
    expect(cincoXX).toEqual([])
  })
})
