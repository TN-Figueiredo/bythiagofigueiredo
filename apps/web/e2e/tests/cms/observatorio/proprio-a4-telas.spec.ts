// apps/web/e2e/tests/cms/observatorio/proprio-a4-telas.spec.ts
// A prova, em navegador, das telas do canal e do vídeo próprios no desenho aprovado de 12/10 (Tarefa 15b): o que antes ficava em `test.fixme` à espera das
// telas 13.3 e 13.4 (a seção "Este vídeo no canal", o gráfico do vídeo, o alvo de toque por dia) e as medidas que as revisões deixaram para o navegador
// (1440, 1100 e 390 px, claro e escuro). O dado é o perfil `retencao` da semente (observatorio-seed.ts); os esperados saem das linhas do banco.
// Nada é escrito: toda server action é abortada e reprova o teste. As medidas vão para o arquivo apontado por A4_MEDIDAS (padrão: test-results/).
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { localServiceClient, ORACLE_NOW, RET, RET_1139 } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

test.use({ storageState: ADMIN_STATE })
const ROTA = '/cms/youtube/competitors'
const S = '[data-obs-screen="canal"][data-own="1"]'
const V = '[data-obs-screen="video-proprio"]'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const MEDIDAS = process.env.A4_MEDIDAS ?? path.resolve(__dirname, '../../../../test-results/proprio-a4-telas-medidas.txt')
const medida = (texto: string): void => {
  fs.mkdirSync(path.dirname(MEDIDAS), { recursive: true })
  fs.appendFileSync(MEDIDAS, `[${test.info().title.slice(0, 60)}] ${texto}\n`)
  test.info().annotations.push({ type: 'medida', description: texto })
}
const PT = (n: number): string => n.toLocaleString('pt-BR')

let own = '', ids: ReturnType<typeof seedIdsOf>
let vid: Record<string, string> = {}
let intrusos: string[] = [], erros: string[] = [], cincoXX: string[] = []
let totalIntrusos = 0

test.beforeAll(async () => {
  test.setTimeout(240_000)
  const siteId = await ensureSeeded({ ownPreset: '2', ownL2: 'retencao' })
  ids = seedIdsOf(siteId)
  own = ids.own('tnfigueiredo')
  const r = await localServiceClient().from('youtube_videos').select('id, youtube_video_id').eq('site_id', siteId).eq('channel_id', own)
  vid = Object.fromEntries((r.data ?? []).map(x => [String(x.youtube_video_id), String(x.id)]))
})
test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

/** Liga a interceptação de server action (fail-closed), o filtro de imagens e a coleta de erros num contexto. */
async function armar(ctx: BrowserContext): Promise<void> {
  await ctx.route('**/*', async route => {
    const r = route.request()
    if (r.method() === 'POST' && r.headers()['next-action']) { intrusos.push(`${r.headers()['next-action']} ${r.url()}`); await route.abort('blockedbyclient'); return }
    await route.fallback()
  })
  await ctx.route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
}
function vigiar(page: Page): void {
  page.on('console', m => {
    if (m.type() !== 'error') return
    const loc = m.location().url
    if (/ytimg\.com|ggpht\.com|blob\.vercel|challenges\.cloudflare/.test(loc + m.text())) return
    erros.push(m.text().slice(0, 220) + ' @ ' + loc)
  })
  page.on('pageerror', e => erros.push('pageerror: ' + e.message.slice(0, 220)))
  page.on('response', r => { if (r.status() >= 500) cincoXX.push(r.status() + ' ' + r.url().slice(0, 120)) })
}
test.beforeEach(() => { intrusos = []; erros = []; cincoXX = [] })
test.afterEach(() => {
  totalIntrusos += intrusos.length
  if (intrusos.length) throw new Error(`Server action INESPERADA abortada: ${intrusos.length}. Primeira: ${intrusos[0]}`)
  expect(cincoXX, 'respostas 5xx').toEqual([])
  expect(erros, 'erros de console').toEqual([])
})

interface Tela { largura: number; altura: number; tema: 'dark' | 'light'; toque: boolean }
/** Um contexto novo do administrador no tamanho e no tema pedidos; `toque` liga o ponteiro grosso (pointer: coarse), onde valem os 44 px. */
async function contexto(browser: Browser, t: Tela): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: t.largura, height: t.altura }, hasTouch: t.toque, isMobile: false })
  await ctx.addCookies([{ name: 'btf_theme', value: t.tema, url: 'http://localhost:3099' }])
  await armar(ctx)
  const page = await ctx.newPage()
  page.setDefaultTimeout(30_000)
  vigiar(page)
  return { ctx, page }
}
async function ir(page: Page, url: string, espera: string): Promise<void> {
  await page.goto(url)
  await page.locator(espera).first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
}
const urlCanal = (qs = ''): string => `${ROTA}/canal/${own}${qs}`
const urlVideo = (yt: string, extra = ''): string => `${ROTA}/video/${vid[yt]}?from=canais&canal=${own}${extra}`
const esperaCanal = `${S} .chead h1`
const esperaVideo = `${V} h1:visible`
const figImpCanal = (page: Page) => page.locator(`${S}:visible figure.ic`).filter({ has: page.locator('.ic-t', { hasText: 'Impressões por dia do canal' }) })
const figViewsCanal = (page: Page) => page.locator(`${S}:visible figure.ic`).filter({ has: page.locator('.ic-t', { hasText: 'Views por dia, soma dos vídeos' }) })
const figViewsVideo = (page: Page) => page.locator(`${V}:visible section[aria-labelledby="vb-views-h"] figure.ic`)
const figImpVideo = (page: Page) => page.locator(`${V}:visible section[aria-labelledby="vb-imp-h"] figure.ic`)

/** As medidas de layout de uma tela: a página e o contêiner que rola não rolam para o lado, nada passa da coluna, o menor texto (inclusive o de dentro do SVG) e os alvos de toque. */
async function medir(page: Page, toque: boolean) {
  return page.evaluate(coarse => {
    const raiz = [...document.querySelectorAll('[data-obs-screen]')].find(e => e.getClientRects().length > 0) as HTMLElement
    let sc: HTMLElement = document.documentElement
    for (let p = raiz.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY
      if ((o === 'auto' || o === 'scroll' || o === 'overlay') && p.scrollHeight > p.clientHeight + 1) { sc = p; break }
    }
    const cx = raiz.getBoundingClientRect()
    const fora: string[] = []
    raiz.querySelectorAll<HTMLElement>('*').forEach(e => {
      if (e.closest('.nclip, .fscroll, .tbw, .ic-tw, .vb-rg-tw, [hidden]') || !e.getClientRects().length || e.closest('.ctabs, .cv-skip, .ntools') || e.matches('.cv-skip')) return
      const r = e.getBoundingClientRect()
      if (r.width > 0 && r.right > cx.right + 1) fora.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)}`)
    })
    let menor = 99, quem = ''
    raiz.querySelectorAll<Element>('*').forEach(e => {
      if (!e.getClientRects().length || ![...e.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim())) return
      const f = parseFloat(getComputedStyle(e).fontSize)
      if (f < menor) { menor = f; quem = `${e.tagName.toLowerCase()}.${String((e as HTMLElement).className?.baseVal ?? (e as HTMLElement).className).slice(0, 20)} "${(e.textContent ?? '').trim().slice(0, 24)}"` }
    })
    const alvos: string[] = []
    if (coarse) {
      const sel = ['.ic-step button', '.ibtn', '.ic-info', '.ret-info', '.vb-info', 'a.handle', '.chead .acts a', 'nav.ctabs li a', 'details.ic-tab summary', '.nmore', '.obs-tr-aside .pager .btn', '.vb-rg', '.vp-a .obs-ch-btn']
      for (const s of sel) for (const el of raiz.ownerDocument.querySelectorAll<HTMLElement>(s)) {
        if (!el.getClientRects().length || el.closest('[hidden]')) continue
        const b = el.getBoundingClientRect()
        if (b.width > 0 && Math.min(b.width, b.height) < 43.5) alvos.push(`${s} ${Math.round(b.width)}x${Math.round(b.height)}`)
      }
    }
    return { docScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, contScroll: sc.scrollWidth - sc.clientWidth, telaW: Math.round(cx.width), fora: fora.slice(0, 5), menor, quem, alvos }
  }, toque)
}

/** O que cada SVG de gráfico desenha: rótulos dentro do SVG, sem sobreposição, a última data, o bloco da hachura e o halo dos rótulos. */
async function medirSvgs(page: Page) {
  return page.evaluate(() => {
    const out: Array<{ onde: string; largura: number; foraDoSvg: string[]; sobrepostos: string[]; ultimaData: string | null; ultimaDentro: boolean; blocos: { n: number; hMax: number; wMax: number; colMin: number }; halo: string[]; rotuloDepoisDoBloco: boolean }> = []
    document.querySelectorAll<SVGSVGElement>('svg.ic-svg').forEach(svg => {
      if (!svg.getClientRects().length) return
      const sb = svg.getBoundingClientRect()
      const fig = svg.closest('figure')
      const onde = (fig?.querySelector('.ic-t')?.textContent ?? 'sem título').slice(0, 40)
      const textos = [...svg.querySelectorAll<SVGTextElement>('text')].filter(t => t.getClientRects().length)
      const foraDoSvg: string[] = [], sobrepostos: string[] = []
      const caixas = textos.map(t => ({ t, b: t.getBoundingClientRect() }))
      for (const { t, b } of caixas) if (b.left < sb.left - 0.5 || b.right > sb.right + 0.5) foraDoSvg.push(`"${t.textContent}" ${Math.round(b.left - sb.left)}..${Math.round(b.right - sb.left)} de ${Math.round(sb.width)}`)
      for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) {
        // a caixa de um texto SVG inclui a folga da linha (ascendente e descendente): o traço do algarismo ocupa ~70% dela, então cada caixa encolhe 15% em cima e embaixo
        const enc = (b: DOMRect) => ({ left: b.left, right: b.right, top: b.top + b.height * 0.15, bottom: b.bottom - b.height * 0.15 })
        const a = enc(caixas[i]!.b), c = enc(caixas[j]!.b)
        const ix = Math.min(a.right, c.right) - Math.max(a.left, c.left), iy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top)
        if (ix > 1.5 && iy > 1.5) sobrepostos.push(`"${caixas[i]!.t.textContent}" × "${caixas[j]!.t.textContent}"`)
      }
      const datas = textos.filter(t => t.classList.contains('ic-ax-x'))
      const ult = datas[datas.length - 1]
      const ub = ult?.getBoundingClientRect()
      // o bloco do "não medido" do GRÁFICO (um por coluna): o da faixa de cliques é outra peça, com a altura da faixa
      const nm = [...svg.querySelectorAll<SVGGElement>('g.ic-col-nao-medido')].map(g => g.querySelector<SVGRectElement>('rect.ic-nm')!).filter(r => r && r.getClientRects().length)
      const hits = [...svg.querySelectorAll<SVGRectElement>('rect.ic-hit')]
      const colMin = hits.length ? Math.min(...hits.map(h => h.getBoundingClientRect().width)) : 0
      const halo = [...svg.querySelectorAll<SVGTextElement>('text.ic-val, text.ic-cln')].filter(t => t.getClientRects().length).filter(t => {
        const cs = getComputedStyle(t)
        return !(cs.stroke !== 'none' && parseFloat(cs.strokeWidth) >= 2 && cs.paintOrder.startsWith('stroke'))
      }).map(t => t.textContent ?? '')
      const ultimoBloco = nm[nm.length - 1], primeiroRotulo = svg.querySelector('.ic-topo')
      const rotuloDepois = !ultimoBloco || !primeiroRotulo ? true : !!(ultimoBloco.compareDocumentPosition(primeiroRotulo) & Node.DOCUMENT_POSITION_FOLLOWING)
      out.push({
        onde, largura: Math.round(sb.width), foraDoSvg, sobrepostos, ultimaData: ult?.textContent ?? null, ultimaDentro: !ub || (ub.left >= sb.left - 0.5 && ub.right <= sb.right + 0.5),
        blocos: { n: nm.length, hMax: Math.max(0, ...nm.map(r => r.getBoundingClientRect().height)), wMax: Math.max(0, ...nm.map(r => r.getBoundingClientRect().width)), colMin },
        halo, rotuloDepoisDoBloco: rotuloDepois,
      })
    })
    return out
  })
}

/** Confere o que se aplica a qualquer tela com gráfico: nada passa do SVG, nada se sobrepõe, a última data cabe, o bloco hachurado cabe na coluna e assenta (24 px), os rótulos têm halo e vêm depois do bloco. */
async function conferirSvgs(page: Page, rotulo: string): Promise<void> {
  const svgs = await medirSvgs(page)
  expect(svgs.length, `${rotulo}: há gráfico`).toBeGreaterThan(0)
  for (const g of svgs) {
    medida(`${rotulo} · ${g.onde} · ${g.largura}px: fora do SVG ${g.foraDoSvg.length}, sobrepostos ${g.sobrepostos.length}, última data "${g.ultimaData}" ${g.ultimaDentro ? 'dentro' : 'FORA'}, blocos ${g.blocos.n} (h ≤ ${g.blocos.hMax.toFixed(1)}, w ≤ ${g.blocos.wMax.toFixed(1)}, coluna ≥ ${g.blocos.colMin.toFixed(1)}), sem halo ${g.halo.length}`)
    expect(g.foraDoSvg, `${rotulo} · ${g.onde}: texto fora do SVG`).toEqual([])
    expect(g.sobrepostos, `${rotulo} · ${g.onde}: textos sobrepostos`).toEqual([])
    expect(g.ultimaDentro, `${rotulo} · ${g.onde}: a última data do eixo cabe dentro do SVG`).toBe(true)
    expect(g.blocos.hMax, `${rotulo} · ${g.onde}: o bloco hachurado tem até 24 px`).toBeLessThanOrEqual(24.5)
    if (g.blocos.n) expect(g.blocos.wMax, `${rotulo} · ${g.onde}: o bloco cabe na coluna`).toBeLessThanOrEqual(g.blocos.colMin + 0.5)
    expect(g.halo, `${rotulo} · ${g.onde}: rótulos sem halo`).toEqual([])
    expect(g.rotuloDepoisDoBloco, `${rotulo} · ${g.onde}: o rótulo é desenhado depois (por cima) do bloco hachurado`).toBe(true)
  }
}

/* ============================================================ B2: o que esperava as telas 13.3 e 13.4 */

test.describe('A4 15b · telas 13.3 e 13.4 (antes fixme)', () => {
  test('"Este vídeo no canal": posição, terço e frase com a base ao lado, as oito linhas (seis + views por dia + % assistido), régua com um traço por vídeo, zero medido onde o relatório não trouxe o vídeo', async ({ page }) => {
    test.setTimeout(240_000)
    await armar(page.context()); vigiar(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await ir(page, urlVideo(RET.volumeAlto), esperaVideo)
    const sec = page.locator(`${V}:visible section[aria-labelledby="vb-canal-h"]`)
    await expect(sec.locator('h2')).toHaveText('Este vídeo no canal')
    // a frase de relance e a base, lado a lado (a base logo depois da frase, no mesmo bloco)
    const frase = sec.locator('.vb-rg-fr'), base = sec.locator('.vb-rg-base-t')
    await expect(frase).toBeVisible(); await expect(base).toBeVisible()
    await expect(base).toContainText('vídeos com impressões medidas de 23/09 a 21/10')
    const fb = await frase.boundingBox(), bb = await base.boundingBox()
    expect(bb!.y, 'a base vem logo depois da frase').toBeGreaterThanOrEqual(fb!.y + fb!.height - 1)
    expect(bb!.y - (fb!.y + fb!.height), 'e colada nela').toBeLessThan(40)
    // as oito linhas, na ordem aprovada
    const numeros = await sec.locator('tr.vb-rg-r').evaluateAll(trs => trs.map(t => t.getAttribute('data-numero')))
    expect(numeros).toEqual(['impressoes', 'views', 'vpd', 'engajamento', 'assistido', 'curtidas', 'comentarios', 'duracao'])
    // views: posição escrita, terço com FORMA (▲ ● ▼) e régua com um traço por vídeo do canal
    const views = sec.locator('tr.vb-rg-r[data-numero="views"]')
    await expect(views.locator('.vb-rg-pt')).toContainText(/^\d+º de 58/)
    await expect(views.locator('.vb-rg-mk')).toHaveText(/^[▲●▼]$/)
    expect(await views.locator('.vb-rg-t').count()).toBe(58)
    await expect(views.locator('.vb-rg-t.vb-rg-este')).toHaveCount(1)
    // impressões e % assistido tem posição entre os vídeos que tiveram medida (este vídeo é o primeiro em impressões)
    await expect(sec.locator('.vb-rg-fr')).toContainText('Primeiro do canal em impressões')
    await expect(sec.locator('tr.vb-rg-r[data-numero="impressoes"] .vb-rg-pt')).toContainText(/^1º de \d/)
    // régua de views por dia e de % assistido existem para quem tem a medida
    await expect(sec.locator('tr.vb-rg-r[data-numero="vpd"] .vb-rg')).toHaveCount(1)
    await expect(sec.locator('tr.vb-rg-r[data-numero="assistido"] .vb-rg')).toHaveCount(1)
    // o vídeo com relatório lido que NÃO trouxe o vídeo: zero medido, dito (nunca "não medido")
    await ir(page, urlVideo('xsi7iiX5Hvd'), esperaVideo)
    const sec2 = page.locator(`${V}:visible section[aria-labelledby="vb-canal-h"]`)
    await expect(page.locator(`${V}:visible section[aria-labelledby="vb-imp-h"]`)).toContainText('Nenhuma impressão nos 19 dias medidos')
    await expect(sec2.locator('.vb-rg-fr')).toContainText('Sem impressão no período')
    // a régua de impressões (conserto de UX B2, 12/10): relatório medido sem o vídeo = ZERO MEDIDO (caixa vazada "0", sem hachura) e a frase dos dias medidos
    await expect(sec2.locator('tr.vb-rg-r[data-numero="impressoes"] td.vb-rg-v .obs-ch-zero')).toContainText('0')
    await expect(sec2.locator('tr.vb-rg-r[data-numero="impressoes"] td.vb-rg-v .obs-ch-nm')).toHaveCount(0)
    await expect(sec2.locator('tr.vb-rg-r[data-numero="impressoes"]')).toContainText('Nenhuma impressão nos 19 dias medidos')
    medida(`"Este vídeo no canal" (vídeo alto): linhas ${numeros.join(',')}; views ${await views.locator('.vb-rg-pt').innerText()}`)
  })

  test('gráfico "Impressões e cliques" do VÍDEO: barra cheia, caixa vazada e hachura (bloco de até 24 px); a faixa de cliques sob as datas com os pontos na mesma linha; teclado; Dia anterior/seguinte leem a frase da tabela', async ({ page }) => {
    test.setTimeout(240_000)
    await armar(page.context()); vigiar(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await ir(page, urlVideo(RET.volumeAlto), esperaVideo)
    const fig = figImpVideo(page)
    await fig.locator('svg.ic-svg').waitFor()
    // as três formas, contadas e medidas
    const formas = await fig.evaluate(f => {
      const por: Record<string, { n: number; tipo: string; hMax: number; base: number[] }> = {}
      for (const g of f.querySelectorAll<SVGGElement>('g.ic-col')) {
        const sit = g.getAttribute('data-situacao')!
        const r = g.querySelector<SVGRectElement>(sit === 'com-impressoes' ? 'rect.ic-bar' : sit === 'zero-medido' ? 'rect.ic-zero' : 'rect.ic-nm')!
        const cs = getComputedStyle(r), bb = r.getBoundingClientRect()
        const tipo = cs.fill.startsWith('url(') ? 'hachura' : cs.fill === 'none' ? 'vazada' : 'cheia'
        const a = por[sit] ?? { n: 0, tipo, hMax: 0, base: [] }
        a.n++; a.hMax = Math.max(a.hMax, bb.height); a.base.push(Math.round(bb.bottom * 10) / 10); por[sit] = a
      }
      const strip = f.querySelector('rect.ic-strip')?.getBoundingClientRect() ?? null
      const datas = [...f.querySelectorAll('text.ic-ax-x')].map(t => t.getBoundingClientRect().bottom)
      const dots = [...f.querySelectorAll('circle.ic-dot')].map(c => Math.round(c.getBoundingClientRect().top * 10) / 10)
      return { por, stripTop: strip?.top ?? null, datasBottom: datas.length ? Math.max(...datas) : null, dots }
    })
    expect([formas.por['com-impressoes']?.n, formas.por['zero-medido']?.n, formas.por['nao-medido']?.n]).toEqual([11, 8, 10])
    expect([formas.por['com-impressoes']!.tipo, formas.por['zero-medido']!.tipo, formas.por['nao-medido']!.tipo]).toEqual(['cheia', 'vazada', 'hachura'])
    expect(formas.por['nao-medido']!.hMax).toBeLessThanOrEqual(24.5)
    expect(formas.por['nao-medido']!.hMax).toBeGreaterThan(formas.por['zero-medido']!.hMax + 6)
    expect(formas.por['zero-medido']!.hMax).toBeLessThanOrEqual(8)
    // a faixa de cliques fica SOB as datas, e todos os pontos estão na mesma linha
    expect(formas.stripTop!, 'a faixa de cliques começa abaixo das datas').toBeGreaterThanOrEqual(formas.datasBottom! - 1)
    expect(new Set(formas.dots).size, 'todos os pontos de cliques na mesma linha').toBe(1)
    expect(formas.dots.length).toBe(11)
    // teclado: o grupo entra uma vez; as setas mudam o dia; Esc fecha; Home/End vão às pontas
    const grupo = fig.locator('.ic-grupo')
    await grupo.focus()
    await page.keyboard.press('ArrowRight')
    const out = fig.locator('p.ic-out')
    const primeiro = await out.innerText()
    await page.keyboard.press('ArrowRight')
    expect(await out.innerText(), 'a seta muda o dia').not.toBe(primeiro)
    await page.keyboard.press('Home')
    expect(await out.innerText()).toMatch(/^23\/09: /)
    await page.keyboard.press('End')
    expect(await out.innerText()).toMatch(/^21\/10: /)
    // Dia anterior / Dia seguinte percorrem todos os dias e leem a mesma frase da linha da tabela
    await fig.locator('details.ic-tab summary').click()
    const linhas = await fig.locator('details.ic-tab tbody tr').evaluateAll(trs => trs.map(t => ({ sit: t.getAttribute('data-situacao'), tds: [...t.querySelectorAll('th, td')].map(c => (c.textContent ?? '').replace(/\s+/g, ' ').trim()) })))
    expect(linhas).toHaveLength(29)
    await grupo.focus(); await page.keyboard.press('Home')
    const seguinte = fig.locator('.ic-step button[aria-label="Dia seguinte"]'), anterior = fig.locator('.ic-step button[aria-label="Dia anterior"]')
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i]!, frase = (await out.innerText()).replace(/\s+/g, ' ').trim()
      expect(frase.startsWith(l.tds[0]! + ':'), `dia ${i + 1}: a frase começa pela data da linha da tabela (${l.tds[0]}): ${frase}`).toBe(true)
      if (l.sit === 'com-impressoes') {
        expect(frase, `dia ${i + 1}`).toContain(`${l.tds[1]} impressões`)
        expect(frase, `dia ${i + 1}`).toContain(`${l.tds[2]} cliques estimados`)
      } else if (l.sit === 'zero-medido') expect(frase, `dia ${i + 1}`).toMatch(/vazio|nenhuma impressão/)
      else expect(frase, `dia ${i + 1}`).toContain('não medido')
      if (i < linhas.length - 1) await seguinte.click()
    }
    await expect(seguinte).toHaveAttribute('aria-disabled', 'true')
    for (let i = linhas.length - 1; i > 0; i--) await anterior.click()
    expect((await out.innerText()).startsWith('23/09')).toBe(true)
    await expect(anterior).toHaveAttribute('aria-disabled', 'true')
    medida(`gráfico do vídeo: ${formas.por['com-impressoes']!.n} cheias, ${formas.por['zero-medido']!.n} vazadas, ${formas.por['nao-medido']!.n} hachuras (≤ ${formas.por['nao-medido']!.hMax.toFixed(1)} px); ${formas.dots.length} pontos na linha ${formas.dots[0]}; faixa em ${formas.stripTop!.toFixed(1)} sob as datas (${formas.datasBottom!.toFixed(1)}); 29 dias percorridos pelo botão = tabela`)
  })

  test('390 px com toque: os botões Dia anterior/seguinte medem 44 × 44 px nos gráficos do canal e do vídeo, e percorrer o gráfico do canal pelo botão lê a mesma frase da tabela', async ({ browser }) => {
    test.setTimeout(300_000)
    const { ctx, page } = await contexto(browser, { largura: 390, altura: 844, tema: 'dark', toque: true })
    try {
      const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
      expect(coarse, 'o contexto é de ponteiro grosso').toBe(true)
      await ir(page, urlCanal('?painel=1'), esperaCanal)
      for (const [nome, fig] of [['canal · impressões', figImpCanal(page)], ['canal · views', figViewsCanal(page)]] as const) {
        for (const b of await fig.locator('.ic-step button').all()) {
          const bx = await b.boundingBox()
          medida(`${nome}: botão "${await b.getAttribute('aria-label')}" ${Math.round(bx!.width)}x${Math.round(bx!.height)}`)
          expect(bx!.width, nome).toBeGreaterThanOrEqual(43.5); expect(bx!.height, nome).toBeGreaterThanOrEqual(43.5)
        }
      }
      // percorrer pelo botão, todos os dias do gráfico de impressões do canal, e comparar com a tabela
      const fig = figImpCanal(page)
      await fig.scrollIntoViewIfNeeded()
      await fig.locator('details.ic-tab summary').click()
      const linhas = await fig.locator('details.ic-tab tbody tr').evaluateAll(trs => trs.map(t => ({ sit: t.getAttribute('data-situacao'), tds: [...t.querySelectorAll('th, td')].map(c => (c.textContent ?? '').replace(/\s+/g, ' ').trim()) })))
      const seguinte = fig.locator('.ic-step button[aria-label="Dia seguinte"]'), out = fig.locator('p.ic-out')
      // o primeiro toque lê o dia 1; os seguintes andam um dia (a janela de leitura de 29 dias fecha no último)
      for (let i = 0; i < linhas.length; i++) {
        await seguinte.tap()
        const frase = (await out.innerText()).replace(/\s+/g, ' ').trim(), l = linhas[i]!
        expect(frase.startsWith(l.tds[0]! + ':'), `dia ${i + 1}: ${frase}`).toBe(true)
        if (l.sit === 'com-impressoes') expect(frase).toContain(`${l.tds[1]} impressões`)
        else if (l.sit === 'nao-medido') expect(frase).toContain('não medido')
      }
      await ir(page, urlVideo(RET.volumeAlto), esperaVideo)
      for (const [nome, fig2] of [['vídeo · views', figViewsVideo(page)], ['vídeo · impressões', figImpVideo(page)]] as const) {
        for (const b of await fig2.locator('.ic-step button').all()) {
          const bx = await b.boundingBox()
          medida(`${nome}: botão "${await b.getAttribute('aria-label')}" ${Math.round(bx!.width)}x${Math.round(bx!.height)}`)
          expect(bx!.width, nome).toBeGreaterThanOrEqual(43.5); expect(bx!.height, nome).toBeGreaterThanOrEqual(43.5)
        }
      }
    } finally { await ctx.close() }
  })

  test('390 px com toque: a régua de "Este vídeo no canal" tem 44 px de altura e, com o foco, mostra o traço escolhido e a dica; o segundo toque no mesmo traço abre o vídeo', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx, page } = await contexto(browser, { largura: 390, altura: 844, tema: 'dark', toque: true })
    try {
      await ir(page, urlVideo(RET.volumeAlto), esperaVideo)
      const reguas = page.locator(`${V}:visible .vb-rg`)
      const n = await reguas.count()
      expect(n).toBeGreaterThanOrEqual(5)
      for (let i = 0; i < n; i++) {
        const b = await reguas.nth(i).boundingBox()
        expect(b!.height, `régua ${i}: altura do alvo`).toBeGreaterThanOrEqual(43.5)
      }
      const views = page.locator(`${V}:visible tr.vb-rg-r[data-numero="views"] .vb-rg`)
      await views.scrollIntoViewIfNeeded()
      await views.focus()
      await page.keyboard.press('ArrowRight')
      await expect(views.locator('.vb-rg-t.vb-rg-on')).toHaveCount(1)
      const dica = page.locator('.vb-rg-tip')
      await expect(dica).toBeVisible()
      const tb = (await dica.boundingBox())!
      expect(tb.x).toBeGreaterThanOrEqual(-0.5); expect(tb.x + tb.width).toBeLessThanOrEqual(390.5)
      // o traço em foco: o desenho dele não some e a faixa toda é o alvo (44 px)
      const tr = (await views.locator('.vb-rg-t.vb-rg-on').boundingBox())!
      medida(`régua em foco a 390: faixa ${Math.round((await views.boundingBox())!.width)}x${Math.round((await views.boundingBox())!.height)}, traço ${Math.round(tr.width)}x${Math.round(tr.height)}, dica ${Math.round(tb.x)}..${Math.round(tb.x + tb.width)}`)
    } finally { await ctx.close() }
  })

  test('Retenção do vídeo: a seção diz "Ainda não coletamos esta curva" e não há <svg> de curva', async ({ page }) => {
    test.setTimeout(240_000)
    await armar(page.context()); vigiar(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await ir(page, urlVideo(RET.volumeAlto), esperaVideo)
    const sec = page.locator(`${V}:visible section[aria-labelledby="vb-ret-h"]`)
    await expect(sec).toContainText('Ainda não coletamos esta curva.')
    // nenhum <svg> de curva (o único svg da seção é o ícone do ⓘ, dentro do botão)
    expect(await sec.evaluate(e => [...e.querySelectorAll('svg')].filter(v => !v.closest('button')).length)).toBe(0)
    await expect(sec.locator('.obs-ch-nm')).toHaveCount(1)
  })
})

/* ============================================================ B4: as medidas que as revisões deixaram para o navegador */

const TAMANHOS: Array<[string, number, number]> = [['1440', 1440, 900], ['1100', 1100, 900], ['390', 390, 844]]
for (const [nome, largura, altura] of TAMANHOS) for (const tema of ['dark', 'light'] as const) {
  test(`${nome} px, tema ${tema}: o canal (painel e todos os números abertos) e seis vídeos não rolam para o lado, texto ≥ 12 px, alvos de 44 px (390), rótulos dentro do SVG, halo, bloco hachurado, última data`, async ({ browser }) => {
    test.setTimeout(420_000)
    const toque = largura <= 390
    const { ctx, page } = await contexto(browser, { largura, altura, tema, toque })
    try {
      const telas: Array<{ rotulo: string; url: string; espera: string; svg: boolean }> = [
        { rotulo: 'canal', url: urlCanal('?painel=1&nums=1'), espera: esperaCanal, svg: true },
        { rotulo: 'retenção', url: urlCanal('?tab=retencao'), espera: `${S} .ret`, svg: false },
        { rotulo: 'vídeo alto', url: urlVideo(RET.volumeAlto), espera: esperaVideo, svg: true },
        { rotulo: 'vídeo magro', url: urlVideo(RET.magro), espera: esperaVideo, svg: true },
        { rotulo: 'vídeo 113%', url: urlVideo('xsi7iiX5Hvd'), espera: esperaVideo, svg: true },
        { rotulo: 'vídeo taxa ~0%', url: urlVideo(RET.taxaBaixa), espera: esperaVideo, svg: true },
        { rotulo: 'vídeo taxa ~97%', url: urlVideo(RET.taxaAlta), espera: esperaVideo, svg: true },
      ]
      for (const t of telas) {
        await ir(page, t.url, t.espera)
        const m = await medir(page, toque)
        medida(`${nome}/${tema}/${t.rotulo}: docScroll ${m.docScroll}, contScroll ${m.contScroll}, tela ${m.telaW}px, menor texto ${m.menor}px (${m.quem}), fora: ${m.fora.join(' | ') || 'nenhum'}${toque ? ', alvos < 44: ' + (m.alvos.join(' | ') || 'nenhum') : ''}`)
        expect(m.docScroll, `${t.rotulo}: rolagem horizontal do documento`).toBeLessThanOrEqual(0)
        expect(m.contScroll, `${t.rotulo}: rolagem horizontal do contêiner`).toBeLessThanOrEqual(0)
        expect(m.fora, `${t.rotulo}: elementos fora da coluna`).toEqual([])
        expect(m.menor, `${t.rotulo}: ${m.quem}`).toBeGreaterThanOrEqual(12)
        if (toque) expect(m.alvos, `${t.rotulo}: alvos de toque menores que 44 px`).toEqual([])
        if (t.svg) await conferirSvgs(page, `${nome}/${tema}/${t.rotulo}`)
        if (t.rotulo === 'canal' && largura === 390) {
          // "1.139" ao lado de dia não medido, a 390 px: o rótulo existe, tem halo e cabe (o conferirSvgs já provou: dentro, sem sobrepor)
          const rot = await page.evaluate(() => [...document.querySelectorAll<SVGTextElement>('svg.ic-svg text.ic-cln')].map(t => t.textContent))
          // desde a 15c o MAIOR valor da série tem prioridade para ficar com rótulo (`quaisCabem` com prioridade; provado em jsdom em proprio-impressoes.test.tsx): o 1.139 deve
          // aparecer; a medida registra e a asserção logo abaixo afirma (provado em navegador no fecho da A4)
          medida(`${nome}/${tema}: rótulos da faixa de cliques a 390 px: ${rot.join(', ')}; "1.139" ${rot.includes(PT(Math.round(RET_1139.imp * RET_1139.ctr))) ? 'aparece' : 'É OMITIDO (esperado: aparece)'}`)
          // provado em navegador (fecho da A4, 12/10): o rótulo do MAIOR valor da faixa de cliques aparece a 390 px, nos dois temas
          expect(rot, `${nome}/${tema}: o rótulo do maior valor (1.139) da faixa de cliques a 390 px`).toContain(PT(Math.round(RET_1139.imp * RET_1139.ctr)))
        }
      }
    } finally { await ctx.close() }
  })
}

test('45 dias a 300 px (colunas estreitas): o bloco hachurado cabe na coluna, tem ao menos 2 px e os rótulos continuam dentro do SVG', async ({ browser }) => {
  test.setTimeout(240_000)
  // 300 px de janela: a coluna do gráfico fica com ~7 px por dia nos 29 dias semeados (o mesmo aperto de 45 dias a 390), o pior caso que a tela atende
  const { ctx, page } = await contexto(browser, { largura: 300, altura: 800, tema: 'dark', toque: true })
  try {
    await ir(page, urlCanal('?painel=1'), esperaCanal)
    const svgs = await medirSvgs(page)
    const g = svgs.find(x => x.onde.startsWith('Impressões'))!
    medida(`300 px: SVG de ${g.largura}px, coluna ≥ ${g.blocos.colMin.toFixed(1)}px, ${g.blocos.n} blocos (w ≤ ${g.blocos.wMax.toFixed(1)}, h ≤ ${g.blocos.hMax.toFixed(1)}), fora ${g.foraDoSvg.length}, sobrepostos ${g.sobrepostos.length}`)
    expect(g.blocos.colMin, 'colunas estreitas de verdade').toBeLessThan(10)
    expect(g.blocos.n).toBe(10)
    expect(g.blocos.wMax).toBeGreaterThanOrEqual(2)
    expect(g.blocos.wMax).toBeLessThanOrEqual(g.blocos.colMin + 0.5)
    expect(g.foraDoSvg).toEqual([])
    expect(g.ultimaDentro).toBe(true)
    const m = await medir(page, true)
    // 300 px é MENOR que o menor aparelho que a casa atende (320): aqui só se mede; a regra de "sem rolagem horizontal" vale de 390 px para cima
    medida(`300 px: docScroll ${m.docScroll}, contScroll ${m.contScroll} (abaixo do mínimo atendido, só medido), fora: ${m.fora.join(' | ') || 'nenhum'}`)
    expect(m.docScroll).toBeLessThanOrEqual(0)
  } finally { await ctx.close() }
})

test.describe('A4 15b · casos de estado', () => {
  test('aba Retenção: normal por faixa (5 vídeos tem normal 50%; 4 dizem "poucos vídeos para comparar (4; precisa de 5)"), "na média" até 2 pontos, 3 pontos acima/abaixo, "N de M dias medidos", a 390 px vira cartões sem rolagem', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx, page } = await contexto(browser, { largura: 1440, altura: 900, tema: 'dark', toque: false })
    try {
      await ir(page, urlCanal('?tab=retencao'), `${S} .ret`)
      const faixas = await page.locator(`${S} .ret-faixas tbody tr`).evaluateAll(trs => trs.map(t => (t.textContent ?? '').replace(/\s+/g, ' ').trim()))
      expect(faixas[0]).toMatch(/^Até 5 min0nenhum vídeo nesta faixa/)
      expect(faixas[1]).toMatch(/^5 a 15 min8 ?50%/)
      expect(faixas[2]).toMatch(/^Acima de 15 min21.*poucos vídeos para comparar \(4; precisa de 5\)/)
      const linha = (titulo: string) => page.locator(`${S} table.tb-v tbody tr`).filter({ hasText: titulo })
      // 52 contra 50: 2 pontos = na média; 53: 3 pontos = acima; 38 e 45: abaixo
      await expect(linha('Ônibus de 3 horas pelo Quirguistão')).toContainText('na média da faixa (50%)')
      await expect(linha('Ônibus de 48 horas pelo Japão')).toContainText('+3 pontos')
      await expect(linha('Ônibus de 48 horas pelo Japão')).toContainText('acima do normal da faixa (50%)')
      await expect(linha('Testei 5 apps de IA para planejar viagem')).toContainText('−12 pontos')
      await expect(linha('Testei 5 apps de IA para planejar viagem')).toContainText('abaixo do normal da faixa (50%)')
      // o vídeo acima de 100%: o número real, a barra cheia e uma frase que explica
      await expect(linha('Hotel de R$ 10 no Tajiquistão')).toContainText('113%')
      await expect(linha('Hotel de R$ 10 no Tajiquistão')).toContainText('acima de 100%: trecho que muita gente voltou para rever')
      // o vídeo com menos de 10 views: o % sai com a contagem, sem comparação
      await expect(page.locator(`${S} .ret-lead`)).toContainText('1 vídeo com poucas views não entra na comparação.')
      // diário que cobre só 14 dos 28 dias
      await expect(page.locator(`${S} table.tb-v .ret-cob`).first()).toContainText(/\d+ de 28 dias medidos/)
      // foco por Tab nas áreas de rolagem: a região é alcançada pelo teclado e o foco se vê
      const regioes = page.locator(`${S} .tbw[tabindex="0"]`)
      expect(await regioes.count()).toBe(2)
      await page.locator(`${S} .ret-info`).focus()
      await page.keyboard.press('Tab')
      const alvo = await page.evaluate(() => { const e = document.activeElement as HTMLElement; const cs = getComputedStyle(e); return { cls: e.className, nome: e.getAttribute('aria-label'), outline: cs.outlineStyle, w: parseFloat(cs.outlineWidth), cor: cs.outlineColor } })
      medida(`Tab nas áreas de rolagem: foco em ${alvo.cls} "${alvo.nome}", contorno ${alvo.outline} ${alvo.w}px ${alvo.cor}`)
      expect(alvo.cls).toContain('tbw')
      expect(alvo.outline).not.toBe('none'); expect(alvo.w).toBeGreaterThanOrEqual(2)
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => (document.activeElement as HTMLElement).className)).toContain('tbw')
    } finally { await ctx.close() }
  })

  test('aba Retenção a 390 px: a tabela vira cartões e nada rola para o lado; a linha "N de M dias medidos" cabe', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx, page } = await contexto(browser, { largura: 390, altura: 844, tema: 'light', toque: true })
    try {
      await ir(page, urlCanal('?tab=retencao'), `${S} .ret`)
      const m = await medir(page, true)
      expect(m.docScroll).toBeLessThanOrEqual(0); expect(m.contScroll).toBeLessThanOrEqual(0)
      const cartoes = page.locator(`${S} .rcards li, ${S} li.rcard`)
      medida(`Retenção a 390: cartões ${await cartoes.count()}, tabela larga visível ${await page.locator(`${S} table.tb-v`).evaluate(e => e.getClientRects().length > 0)}`)
      expect(await cartoes.count()).toBeGreaterThan(0)
      await expect(page.locator(`${S} .rcard .ret-cob`).first()).toBeVisible()
      await expect(page.locator(`${S} .rcard .ret-cob`).first()).toContainText(/\d+ de 28 dias medidos/)
      for (const el of await page.locator(`${S} .rcard .ret-cob`).all()) {
        const b = await el.boundingBox()
        if (b) expect(b.x + b.width).toBeLessThanOrEqual(390.5)
      }
    } finally { await ctx.close() }
  })

  test('vídeo de 1 a 5 dias: com 1 ou 2 dias a seção diz a frase de vídeo novo e não há gráfico de zeros; com 3 a 5 dias o gráfico começa no dia da publicação', async ({ browser }) => {
    test.setTimeout(420_000)
    const siteId = await getSeedSiteId()
    const sb = localServiceClient()
    const { ctx, page } = await contexto(browser, { largura: 1440, altura: 900, tema: 'dark', toque: false })
    try {
      for (const dias of [1, 2, 3, 4, 5]) {
        // publicado ao meio-dia de São Paulo, `dias` dias antes do relógio do oráculo
        const alvo = new Date(ORACLE_NOW - dias * 24 * 3600 * 1000)
        alvo.setUTCHours(15, 0, 0, 0)
        const up = await sb.from('youtube_videos').update({ published_at: alvo.toISOString() }).eq('id', vid[RET.magro]!).eq('site_id', siteId)
        if (up.error) throw new Error(up.error.message)
        await ir(page, urlVideo(RET.magro), esperaVideo)
        const sec = page.locator(`${V}:visible section[aria-labelledby="vb-imp-h"]`)
        const colunas = await sec.locator('g.ic-col').count()
        const texto = (await sec.innerText()).replace(/\s+/g, ' ')
        medida(`vídeo de ${dias} dia(s): colunas ${colunas}; ${texto.slice(0, 160)}`)
        if (dias <= 2) {
          expect(texto, `${dias} dia(s)`).toContain('Vídeo novo: os números de alcance chegam com 2 a 3 dias de atraso, então ainda não há dia deste vídeo.')
          expect(colunas, `${dias} dia(s): nenhum gráfico de zeros`).toBe(0)
          await expect(sec.locator('svg.ic-svg')).toHaveCount(0)
        } else {
          // desde a publicação: nenhuma coluna antes do dia da publicação, e as que existem estão dentro dos 29 dias coletados
          expect(colunas, `${dias} dia(s)`).toBeGreaterThan(0)
          expect(colunas, `${dias} dia(s): só os dias desde a publicação`).toBeLessThanOrEqual(dias)
        }
        const m = await medir(page, false)
        expect(m.docScroll).toBeLessThanOrEqual(0)
      }
    } finally {
      await sb.from('youtube_videos').update({ published_at: new Date(ORACLE_NOW - 13 * 24 * 3600 * 1000).toISOString() }).eq('id', vid[RET.magro]!).eq('site_id', siteId)
      await ctx.close()
    }
  })

  test('régua: o clique do mouse no vão entre traços não navega; sobre um traço navega para o vídeo dele; a 390 px o toque é em dois tempos', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx, page } = await contexto(browser, { largura: 1440, altura: 900, tema: 'dark', toque: false })
    try {
      await ir(page, urlVideo(RET.volumeAlto), esperaVideo)
      const faixa = page.locator(`${V}:visible tr.vb-rg-r[data-numero="views"] .vb-rg`)
      await faixa.scrollIntoViewIfNeeded()
      const centros = await faixa.locator('.vb-rg-t').evaluateAll(ts => ts.map(t => { const b = t.getBoundingClientRect(); return b.left + b.width / 2 }).sort((a, b) => a - b))
      const fb = (await faixa.boundingBox())!
      // o maior vão entre dois traços vizinhos (mais de 28 px: 14 de cada lado, além dos 12 px de alcance do clique)
      let melhor = { de: 0, ate: 0 }
      for (let i = 1; i < centros.length; i++) if (centros[i]! - centros[i - 1]! > melhor.ate - melhor.de) melhor = { de: centros[i - 1]!, ate: centros[i]! }
      medida(`régua de views: 58 traços, maior vão ${(melhor.ate - melhor.de).toFixed(1)} px`)
      expect(melhor.ate - melhor.de, 'há um vão de mais de 26 px para clicar').toBeGreaterThan(26)
      const antes = page.url()
      await page.mouse.click((melhor.de + melhor.ate) / 2, fb.y + fb.height / 2)
      await page.waitForTimeout(700)
      expect(page.url(), 'o clique no vão não navega').toBe(antes)
      // sobre um traço (o do meio da lista, que não é o deste vídeo): navega
      const tracos = faixa.locator('.vb-rg-t:not(.vb-rg-este)')
      const alvo = (await tracos.nth(20).boundingBox())!
      await page.mouse.click(alvo.x + alvo.width / 2, fb.y + fb.height / 2)
      await page.waitForFunction(u => location.href !== u, antes, { timeout: 30_000 })
      expect(page.url(), 'sobre o traço, navega para outro vídeo').toContain('/video/')
    } finally { await ctx.close() }
  })

  test('NBSP no DOM entre número e unidade ("1,3 mil", "2,2 mil views"); no cartão do próprio a linha "N views por dia" vem logo depois de views/impressões e antes dos cliques; o cartão do concorrente não ganha nenhuma linha nova', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx, page } = await contexto(browser, { largura: 1440, altura: 900, tema: 'dark', toque: false })
    try {
      await ir(page, urlCanal(), `${S} ul.cv-grid > li.cv-card`)
      const info = await page.locator(`${S} ul.cv-grid > li.cv-card`).evaluateAll(cards => cards.map(c => ({
        texto: c.textContent ?? '',
        ordem: [...c.querySelectorAll('p, .cv-n, .cv-vpd, .cv-n3')].map(e => e.className).filter(Boolean),
        vpdDepoisDeNumeros: (() => { const n = c.querySelector('.cv-n, .cv-nums'); const v = c.querySelector('.cv-vpd'); const t = c.querySelector('.cv-n3'); return { n: !!n, v: !!v, t: !!t, vDepoisN: !n || !v ? null : !!(n.compareDocumentPosition(v) & Node.DOCUMENT_POSITION_FOLLOWING), vAntesT: !v || !t ? null : !!(v.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) } })(),
      })))
      const comMil = info.filter(i => /\d[\u00A0 ]mil\b/.test(i.texto))
      expect(comMil.length, 'há cartões com "mil"').toBeGreaterThan(0)
      const comEspacoComum = comMil.flatMap(i => i.texto.match(/.{0,18}\d mil\b.{0,12}/g) ?? [])
      medida(`NBSP: cartões com "mil" ${comMil.length}; com espaço comum antes de "mil": ${comEspacoComum.length ? comEspacoComum.slice(0, 4).map(x => JSON.stringify(x)).join(' | ') : 'nenhum'}`)
      expect(comEspacoComum, 'entre o número e "mil" o espaço é NBSP').toEqual([])
      expect(comMil.some(i => /\d\u00A0mil\b/.test(i.texto)), 'o NBSP chega ao DOM').toBe(true)
      const comVpd = info.filter(i => i.vpdDepoisDeNumeros.v)
      expect(comVpd.length, 'há cartões com "N views por dia"').toBeGreaterThan(0)
      for (const i of comVpd) {
        expect(i.vpdDepoisDeNumeros.vDepoisN, '"N views por dia" vem depois da linha de números').not.toBe(false)
        expect(i.vpdDepoisDeNumeros.vAntesT, 'e antes da linha de cliques').not.toBe(false)
      }
      medida(`cartões do próprio: ${info.length}, com "mil" ${comMil.length}, com views por dia ${comVpd.length}`)
      // a página de um concorrente: o cartão não tem a linha nova
      await ir(page, `${ROTA}/canal/${ids.channel('matt-wolfe')}`, '[data-obs-screen="canal"] ul.cv-grid > li.cv-card')
      expect(await page.locator('[data-obs-screen="canal"] .cv-vpd, [data-obs-screen="canal"] .cv-n3').count(), 'o concorrente não tem "views por dia" nem cliques').toBe(0)
    } finally { await ctx.close() }
  })

  test('nada de troca: nenhum losango, triângulo nem "Trocas deste vídeo" no canal nem no vídeo; cores só onde a tabela diz (sem color-mix transparente; verde/âmbar só na direção)', async ({ browser }) => {
    test.setTimeout(240_000)
    const { ctx, page } = await contexto(browser, { largura: 1440, altura: 900, tema: 'dark', toque: false })
    try {
      for (const [url, espera, rotulo] of [[urlCanal('?painel=1'), esperaCanal, 'canal'], [urlVideo(RET.volumeAlto), esperaVideo, 'vídeo']] as const) {
        await ir(page, url, espera)
        const t = await page.locator('body').innerText()
        expect(t, rotulo).not.toMatch(/Trocas deste vídeo|losango/i)
        expect(await page.locator('.ic-trp, svg [class*="troca"], svg polygon').count(), `${rotulo}: nenhuma marca de troca nos gráficos`).toBe(0)
        // cores com significado: opacas (a cor de um color-mix() que o navegador não entende vira transparente)
        const cores = await page.evaluate(() => {
          const sel = ['.ic-bar', '.ic-zero', '.ic-hb', '.ic-hl', '.ic-dot', '.ic-nm', '.tf-int', '.tf-pt', '.vb-as-barra i', '.vb-rg-t.vb-rg-este', '.nm-q']
          const alfa = (c: string): number => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return c === 'none' || c === 'transparent' ? 0 : 1; const p = m[1]!.split(',').map(x => parseFloat(x)); return p.length > 3 ? p[3]! : 1 }
          const r: string[] = []
          for (const s of sel) for (const e of document.querySelectorAll<Element>(s)) {
            if (!e.getClientRects().length && !(e instanceof SVGElement)) continue
            const cs = getComputedStyle(e)
            const fill = cs.fill, stroke = cs.stroke, bg = cs.backgroundColor
            const opaca = [fill, stroke, bg].some(c => c.startsWith('url(') || alfa(c) > 0.5)
            if (!opaca) r.push(`${s}: fill ${fill}, stroke ${stroke}, bg ${bg}`)
            if (/color-mix/.test(fill + stroke + bg)) r.push(`${s}: color-mix`)
          }
          return r.slice(0, 8)
        })
        expect(cores, `${rotulo}: cores transparentes`).toEqual([])
        // verde e âmbar só na direção: dentro da taxa de clique (canal e vídeo) nenhum elemento tem verde nem âmbar
        const dirigidos = await page.evaluate(() => {
          const VERDES = ['rgb(34, 197, 94)', 'rgb(17, 105, 47)'], AMBAR = ['rgb(245, 158, 11)', 'rgb(138, 90, 0)']
          const r: string[] = []
          for (const raiz of document.querySelectorAll('.vb-ctr, .pn-taxa, .tf')) for (const e of raiz.querySelectorAll<Element>('*')) {
            const cs = getComputedStyle(e)
            for (const c of [cs.color, cs.fill, cs.stroke, cs.backgroundColor, cs.borderTopColor]) if ([...VERDES, ...AMBAR].includes(c)) r.push(`${e.tagName}.${String(e.getAttribute('class')).slice(0, 20)}: ${c}`)
          }
          return r
        })
        expect(dirigidos, `${rotulo}: verde/âmbar na taxa de clique`).toEqual([])
      }
    } finally { await ctx.close() }
  })
})

test('nenhum POST de server action em nenhuma tela deste arquivo', () => {
  expect(totalIntrusos).toBe(0)
})

