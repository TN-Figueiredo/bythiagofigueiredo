// apps/web/e2e/tests/cms/observatorio/proprio-a4-fecho-2.spec.ts
// Fecho em navegador da onda de consertos de UX da A4 (12/10: hachura do "não medido", "zero medido" na caixa vazada, grade de cartões, frases, cartão "Só o seu canal mede"
// no fim da comparação). Mede o que a onda deixou para o navegador (contraste e forma da hachura nos dois temas, escala de cinza, colunas da grade a 1440/1100/390, o zero na
// caixa vazada, a posição do cartão nos dois pares, o cartão magro a 390, o foco do h1 do vídeo, o popover do ⓘ do vídeo) e salva as capturas lado a lado
// (esquerda = tela implementada, direita = mockup congelado) em docs/.../shots/a4-fecho-2 (não commitadas). Nada é escrito: toda server action é abortada e reprova o teste.
// Medidas vão para A4_MEDIDAS (padrão: test-results/). Perfis da semente: magro = `curto`, cheio = `retencao` (canal e vídeo) ou `ativo` (comparação), sem dado = nenhuma linha privada.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, repoFileUrl, seedIdsOf } from './fidelity'
import { localServiceClient, ORACLE_NOW, RET, type SeedOptions } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

test.use({ storageState: ADMIN_STATE })
const ROTA = '/cms/youtube/competitors'
const S = '[data-obs-screen="canal"][data-own="1"]'
const V = '[data-obs-screen="video-proprio"]'
const C = '[data-obs-screen="comparar"]'
const CARTAO = `${C}:visible [data-so-seu-canal]`
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const MEDIDAS = process.env.A4_MEDIDAS ?? path.resolve(__dirname, '../../../../test-results/proprio-a4-fecho-2-medidas.txt')
const SHOTS = path.resolve(__dirname, '../../../../../../docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/shots/a4-fecho-2')
const MOCK = '.superpowers/sdd/2026-10-12-telas-a4-canal-proprio-plan/mockup-congelado-12-10/'
const TEMAS = ['dark', 'light'] as const
const NOME_TEMA = { dark: 'escuro', light: 'claro' } as const
type Tema = (typeof TEMAS)[number]

function medida(texto: string): void {
  fs.mkdirSync(path.dirname(MEDIDAS), { recursive: true })
  fs.appendFileSync(MEDIDAS, `[${test.info().title.slice(0, 70)}] ${texto}\n`)
  test.info().annotations.push({ type: 'medida', description: texto })
}

let intrusos: string[] = [], erros: string[] = [], cincoXX: string[] = []
test.beforeEach(async () => { intrusos = []; erros = []; cincoXX = []; await resetPrefs() })
test.afterEach(() => {
  if (intrusos.length) throw new Error(`Server action INESPERADA abortada: ${intrusos.length}. Primeira: ${intrusos[0]}`)
  expect(cincoXX, 'respostas 5xx').toEqual([])
  expect(erros, 'erros de console').toEqual([])
})
async function resetPrefs(): Promise<void> {
  const { resetViewerPrefs } = await import('../../../fixtures/observatorio-seed')
  await resetViewerPrefs(await getSeedSiteId())
}

async function contexto(browser: Browser, w: number, h: number, tema: Tema): Promise<{ ctx: BrowserContext; page: Page }> {
  const toque = w <= 640
  const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: w, height: h }, hasTouch: toque, isMobile: toque })
  await ctx.addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
  await ctx.route('**/*', async route => {
    const r = route.request()
    if (r.method() === 'POST' && r.headers()['next-action']) { intrusos.push(`${r.headers()['next-action']} ${r.url()}`); await route.abort('blockedbyclient'); return }
    await route.fallback()
  })
  await ctx.route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  const page = await ctx.newPage()
  page.setDefaultTimeout(30_000)
  page.on('console', m => {
    if (m.type() !== 'error') return
    const loc = m.location().url
    if (/ytimg\.com|ggpht\.com|blob\.vercel|challenges\.cloudflare/.test(loc + m.text())) return
    erros.push(m.text().slice(0, 220) + ' @ ' + loc)
  })
  page.on('pageerror', e => erros.push('pageerror: ' + e.message.slice(0, 220)))
  page.on('response', r => { if (r.status() >= 500) cincoXX.push(r.status() + ' ' + r.url().slice(0, 120)) })
  return { ctx, page }
}
async function ir(page: Page, url: string, espera: string): Promise<void> {
  await page.goto(url)
  await page.locator(espera).first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

/** Utilitários de cor dentro da página (contraste WCAG com composição de alfa sobre os fundos dos ancestrais). */
const UTIL = `window.__u = {
  rgb(s){ const m = String(s).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } },
  lum(c){ const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b) },
  over(c, bg){ return { r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a), a: 1 } },
  ratio(a, b){ const la = this.lum(a), lb = this.lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05) },
  fundo(el){ const pilha = []; for (let e = el; e; e = e.parentElement) { const c = this.rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { pilha.push(c); if (c.a >= 1) break } } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = pilha.length - 1; i >= 0; i--) base = this.over(pilha[i], base); return base },
}`
async function util(page: Page): Promise<void> { await page.evaluate(UTIL) }

/** Libera a rolagem interna da casca para a tela inteira poder ser capturada (só durante a captura); esconde o que é fixo. */
async function liberar(page: Page, raiz: string): Promise<void> {
  await page.evaluate((sel: string) => {
    const r = document.querySelector<HTMLElement>(sel)
    if (!r) return
    for (let e: HTMLElement | null = r; e; e = e.parentElement) {
      e.style.setProperty('overflow', 'visible', 'important'); e.style.setProperty('height', 'auto', 'important'); e.style.setProperty('max-height', 'none', 'important'); e.style.setProperty('min-height', '0', 'important')
    }
    document.querySelectorAll<HTMLElement>('body *').forEach(e => { if (getComputedStyle(e).position === 'fixed' && !e.closest(sel)) e.style.setProperty('visibility', 'hidden', 'important') })
  }, raiz)
}

async function mockShot(browser: Browser, arquivo: string, query: string, w: number, h: number, tema: Tema, seletor: string): Promise<Buffer> {
  const c = await browser.newContext({ viewport: { width: w, height: h } })
  try {
    const m = await c.newPage()
    await m.goto(repoFileUrl(MOCK + arquivo) + `?${query}${tema === 'light' ? '&tema=claro' : ''}`)
    await m.locator(seletor).first().waitFor({ timeout: 20_000 })
    await m.evaluate(() => document.fonts.ready.then(() => undefined))
    await m.waitForTimeout(400)
    return await m.locator(seletor).first().screenshot()
  } finally { await c.close() }
}

/** Esquerda = implementado agora, direita = mockup congelado. */
async function ladoALado(browser: Browser, impl: Buffer, mock: Buffer, legenda: string, tema: Tema, nome: string): Promise<void> {
  fs.mkdirSync(SHOTS, { recursive: true })
  const c = await browser.newContext({ viewport: { width: 3000, height: 100 } })
  try {
    const comp = await c.newPage()
    const uri = (b: Buffer) => 'data:image/png;base64,' + b.toString('base64')
    await comp.setContent(`<body style="margin:0;padding:12px;background:${tema === 'dark' ? '#2b2724' : '#d8d2c8'};font:12px system-ui;color:${tema === 'dark' ? '#eee' : '#222'};display:flex;gap:16px;align-items:flex-start"><figure style="margin:0"><figcaption style="margin-bottom:4px">implementada agora (${legenda})</figcaption><img src="${uri(impl)}"></figure><figure style="margin:0"><figcaption style="margin-bottom:4px">mockup congelado de 12/10</figcaption><img src="${uri(mock)}"></figure></body>`)
    await comp.screenshot({ path: path.join(SHOTS, nome), fullPage: true })
  } finally { await c.close() }
}

async function telaInteira(page: Page, raiz: string): Promise<Buffer> {
  await liberar(page, raiz)
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll<HTMLElement>('*').forEach(e => { if (e.scrollTop) e.scrollTop = 0 }) })
  await page.waitForTimeout(250)
  return await page.locator(raiz).first().screenshot()
}

const VPS = [{ w: 1440, h: 900 }, { w: 390, h: 844 }] as const

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// Perfil `retencao`: canal e vídeo cheios, medidas da onda de UX e do vídeo
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
test.describe('fecho A4: perfil retencao (canal e vídeo cheios)', () => {
  let ids: ReturnType<typeof seedIdsOf>, siteId = '', own = ''
  let vid: Record<string, string> = {}
  test.beforeAll(async () => {
    test.setTimeout(240_000)
    siteId = await ensureSeeded({ ownPreset: '2', ownL2: 'retencao' })
    ids = seedIdsOf(siteId)
    own = ids.own('tnfigueiredo')
    const r = await localServiceClient().from('youtube_videos').select('id, youtube_video_id').eq('site_id', siteId).eq('channel_id', own)
    vid = Object.fromEntries((r.data ?? []).map(x => [String(x.youtube_video_id), String(x.id)]))
  })
  test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })
  const urlCanal = (qs = ''): string => `${ROTA}/canal/${own}${qs}`
  const urlVideo = (yt: string): string => `${ROTA}/video/${vid[yt]}?from=canais&canal=${own}`
  const urlComparar = (a: string, b: string): string => `${ROTA}/comparar?a=${a}&b=${b}`
  const esperaCanal = `${S} .chead h1`
  const esperaVideo = `${V} h1:visible`

  // 1. B1: a hachura do "não medido" (contraste e forma) nos dois temas
  for (const tema of TEMAS) {
    test(`B1 hachura do não medido, tema ${NOME_TEMA[tema]}: gradiente de 2 px, contraste da listra e da borda`, async ({ browser }) => {
      test.setTimeout(180_000)
      const { ctx, page } = await contexto(browser, 1440, 900, tema)
      try {
        const achados: Array<{ onde: string; seletor: string; n: number; forma?: Record<string, unknown> }> = []
        const paginas: Array<{ onde: string; url: string; espera: string; seletores: string[] }> = [
          { onde: 'canal próprio', url: urlCanal('?painel=1'), espera: esperaCanal, seletores: ['.ic-sw.nm'] },
          { onde: 'comparação', url: urlComparar(own, ids.channel('matt-wolfe')), espera: `${C} .cp-side`, seletores: ['.lr-s.nmk .obs-ch-nm', '.so-nm'] },
          { onde: 'comparação 2 seus', url: urlComparar(own, ids.own('tnfigueiredo-en')), espera: `${C} .cp-side`, seletores: ['.lr-s.nmk .obs-ch-nm', '.so-nm'] },
        ]
        for (const p of paginas) {
          await ir(page, p.url, p.espera)
          await util(page)
          for (const sel of p.seletores) {
            const forma = await page.evaluate((s: string) => {
              const u = (window as unknown as { __u: Record<string, (...a: unknown[]) => never> }).__u as unknown as {
                rgb(s: string): { r: number; g: number; b: number; a: number } | null; ratio(a: unknown, b: unknown): number; fundo(el: Element): unknown; over(c: unknown, b: unknown): unknown
              }
              const els = [...document.querySelectorAll<HTMLElement>(s)].filter(e => e.getBoundingClientRect().width > 0)
              if (!els.length) return { n: 0 }
              const el = els[0]!
              const cs = getComputedStyle(el)
              const bgi = cs.backgroundImage
              const cores = [...new Set([...bgi.matchAll(/rgba?\([^)]*\)/g)].map(m => m[0]))]
              const fundoCartao = u.fundo(el.parentElement!)
              const listra = cores[0] ? u.rgb(cores[0]) : null, fundoListra = cores[1] ? u.rgb(cores[1]) : null
              const borda = u.rgb(cs.borderTopColor)
              const bordaSobre = borda ? u.over(borda, fundoCartao) : null
              const r = el.getBoundingClientRect()
              return {
                n: els.length, imagem: bgi.slice(0, 160), repetida: /repeating-linear-gradient/.test(bgi), angulo: (bgi.match(/(\d+)deg/) ?? [])[1] ?? null,
                larguras: [...bgi.matchAll(/(\d+(?:\.\d+)?)px/g)].map(m => m[1]), corListra: cores[0] ?? null, corFundoListra: cores[1] ?? null,
                contrasteListraFundo: listra && fundoListra ? Math.round(u.ratio(listra, fundoListra) * 100) / 100 : null,
                bordaEstilo: cs.borderTopStyle, bordaLargura: cs.borderTopWidth, bordaCor: cs.borderTopColor,
                contrasteBordaCartao: bordaSobre ? Math.round(u.ratio(bordaSobre, fundoCartao) * 100) / 100 : null,
                caixa: `${Math.round(r.width)}x${Math.round(r.height)}`, textoDentro: (el.textContent ?? '').trim().length,
              }
            }, sel)
            achados.push({ onde: p.onde, seletor: sel, n: Number((forma as { n: number }).n), forma })
          }
        }
        for (const a of achados) medida(`${NOME_TEMA[tema]} | ${a.onde} | ${a.seletor}: ${JSON.stringify(a.forma)}`)
        // pelo menos o quadradinho do cabeçalho e o da legenda do gráfico existem no canal próprio (dados com dia não medido); os demais são registrados
        for (const sel of ['.ic-sw.nm', '.lr-s.nmk .obs-ch-nm']) {
          const a = achados.find(x => x.seletor === sel)!
          expect(a.n, `${sel} existe`).toBeGreaterThan(0)
        }
        for (const a of achados.filter(x => x.n > 0)) {
          const f = a.forma as { repetida: boolean; angulo: string | null; contrasteListraFundo: number | null; contrasteBordaCartao: number | null; bordaEstilo: string }
          expect(f.repetida, `${a.seletor}: gradiente repetido`).toBe(true)
          expect(f.angulo, `${a.seletor}: ângulo`).toBe('135')
          expect(f.contrasteListraFundo, `${a.seletor}: contraste listra × fundo`).toBeGreaterThanOrEqual(3)
          expect(f.bordaEstilo, `${a.seletor}: borda sólida`).toBe('solid')
          expect(f.contrasteBordaCartao, `${a.seletor}: contraste da borda × cartão`).toBeGreaterThanOrEqual(3)
        }
      } finally { await ctx.close() }
    })
  }

  // 2. escala de cinza: os três estados (medido, zero medido, não medido) se separam pela forma
  for (const tema of TEMAS) {
    test(`escala de cinza, tema ${NOME_TEMA[tema]}: medido, zero medido e não medido se separam pela forma`, async ({ browser }) => {
      test.setTimeout(180_000)
      const { ctx, page } = await contexto(browser, 1440, 900, tema)
      try {
        // o vídeo sem impressão (xsi7iiX5Hvd) tem os três estados no mesmo gráfico (dias com impressão do canal não, mas zero medido e não medido sim): usa o gráfico do canal
        await ir(page, urlCanal('?painel=1'), esperaCanal)
        const fig = page.locator(`${S}:visible figure.ic`).filter({ has: page.locator('.ic-t', { hasText: 'Impressões por dia do canal' }) }).first()
        await fig.scrollIntoViewIfNeeded()
        await page.addStyleTag({ content: 'html{filter:grayscale(1)}' })
        const sw = fig.locator('.ic-leg .ic-sw')
        const n = await sw.count()
        const c2 = await ctx.newPage()
        const internos: Array<{ classe: string; L: number[] }> = []
        for (let i = 0; i < n; i++) {
          const buf = await sw.nth(i).screenshot()
          const classe = (await sw.nth(i).getAttribute('class')) ?? ''
          const L = await c2.evaluate(async (b64: string) => {
            const blob = await (await fetch('data:image/png;base64,' + b64)).blob()
            const bmp = await createImageBitmap(blob)
            const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height
            const g = cv.getContext('2d')!; g.drawImage(bmp, 0, 0)
            const d = g.getImageData(0, 0, cv.width, cv.height).data
            const out: number[] = []
            // só o miolo (3 px de cada lado fora): a borda de 1 px e o antialiasing não contam
            for (let y = 3; y < cv.height - 3; y++) for (let x = 3; x < cv.width - 3; x++) { const k = (y * cv.width + x) * 4; out.push((0.2126 * d[k]! + 0.7152 * d[k + 1]! + 0.0722 * d[k + 2]!) / 255) }
            return out
          }, buf.toString('base64'))
          internos.push({ classe, L })
        }
        await c2.close()
        const zeroL = internos.find(x => /\bzero\b/.test(x.classe))!.L
        const fundoL = [...zeroL].sort((a, b) => a - b)[Math.floor(zeroL.length / 2)]!   // o miolo da caixa vazada é o fundo da página
        const stats = internos.map(x => ({ classe: x.classe, tinta: x.L.filter(v => Math.abs(v - fundoL) > 0.12).length / x.L.length, media: x.L.reduce((a, b) => a + b, 0) / x.L.length }))
        for (const s of stats) medida(`${NOME_TEMA[tema]} cinza | ${s.classe}: miolo com tinta ${(s.tinta * 100).toFixed(0)}%, luminância média ${s.media.toFixed(3)} (fundo ${fundoL.toFixed(3)})`)
        // forma computada dos estados
        const formas = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('figure.ic .ic-leg .ic-sw')].slice(0, 4).map(e => {
          const cs = getComputedStyle(e)
          return { classe: e.className, imagem: cs.backgroundImage.startsWith('repeating') ? 'hachura' : cs.backgroundImage === 'none' ? 'nenhuma' : 'outra', fundo: cs.backgroundColor, borda: `${cs.borderTopStyle} ${cs.borderTopWidth}` }
        }))
        medida(`${NOME_TEMA[tema]} formas: ${JSON.stringify(formas)}`)
        const nm = stats.find(s => /\bnm\b/.test(s.classe)), zero = stats.find(s => /\bzero\b/.test(s.classe)), imp = stats.find(s => /\bimp\b/.test(s.classe))
        expect(nm && zero && imp, 'a legenda tem os três estados').toBeTruthy()
        // distinguíveis em cinza só pela forma: cheio (tinta ~100%), hachura (tinta intermediária) e caixa vazada (~0%)
        expect(imp!.tinta, 'barra cheia: miolo quase todo com tinta').toBeGreaterThan(0.85)
        expect(zero!.tinta, 'caixa vazada: miolo sem tinta').toBeLessThan(0.15)
        expect(nm!.tinta, 'hachura: miolo parcialmente com tinta').toBeGreaterThan(0.25)
        expect(nm!.tinta, 'hachura: miolo parcialmente com tinta').toBeLessThan(0.75)
        const lt = page.locator(`${S}:visible`).first()
        await fs.promises.mkdir(SHOTS, { recursive: true })
        await fig.screenshot({ path: path.join(SHOTS, `cinza-grafico-canal-${NOME_TEMA[tema]}.png`) })
        await ir(page, urlCanal(), esperaCanal)
        await page.addStyleTag({ content: 'html{filter:grayscale(1)}' })
        await lt.locator('ul.cv-grid').first().scrollIntoViewIfNeeded()
        await page.screenshot({ path: path.join(SHOTS, `cinza-grade-cartoes-${NOME_TEMA[tema]}.png`) })
      } finally { await ctx.close() }
    })
  }

  // 3. C1: colunas da grade (sem sobreposição) a 1440, 1100 e 390
  for (const vp of [{ w: 1440, h: 900 }, { w: 1100, h: 800 }, { w: 390, h: 844 }]) {
    test(`C1 grade de cartões a ${vp.w} px: as colunas de .cv-nums3 não se sobrepõem nem saem do cartão`, async ({ browser }) => {
      test.setTimeout(180_000)
      const { ctx, page } = await contexto(browser, vp.w, vp.h, 'dark')
      try {
        await ir(page, urlCanal(), esperaCanal)
        const r = await page.evaluate((raiz: string) => {
          const cards = [...document.querySelectorAll<HTMLElement>(`${raiz}:not([hidden]) ul.cv-grid > li.cv-card`)].filter(c => c.getBoundingClientRect().width > 0)
          const out = { cartoes: cards.length, comTerceiraEmBaixo: 0, sobrepostos: [] as string[], foraDoCartao: [] as string[], alturasPorFila: [] as string[], docScroll: document.documentElement.scrollWidth - innerWidth }
          const filas = new Map<number, number[]>()
          cards.forEach((c, i) => {
            const cr = c.getBoundingClientRect()
            const cols = [...c.querySelectorAll<HTMLElement>('.cv-nums3 > .cv-c')].map(e => e.getBoundingClientRect())
            const tops = new Set(cols.map(x => Math.round(x.top)))
            if (tops.size > 1) out.comTerceiraEmBaixo++
            cols.forEach((a, k) => {
              if (a.left < cr.left - 1 || a.right > cr.right + 1) out.foraDoCartao.push(`cartão ${i} coluna ${k}: ${Math.round(a.left)}..${Math.round(a.right)} (cartão ${Math.round(cr.left)}..${Math.round(cr.right)})`)
              cols.slice(k + 1).forEach((b, j) => {
                const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
                if (w > 0.5 && h > 0.5) out.sobrepostos.push(`cartão ${i}: coluna ${k} × ${k + 1 + j} (${w.toFixed(1)}x${h.toFixed(1)} px)`)
              })
            })
            const y = Math.round(cr.top)
            filas.set(y, [...(filas.get(y) ?? []), Math.round(cr.height)])
          })
          filas.forEach((hs, y) => out.alturasPorFila.push(`fila y=${y}: alturas ${[...new Set(hs)].join('/')}`))
          return out
        }, S)
        medida(`${vp.w}px: ${r.cartoes} cartões, ${r.comTerceiraEmBaixo} com a terceira coluna na linha de baixo, sobrepostos ${r.sobrepostos.length}, fora do cartão ${r.foraDoCartao.length}, docScroll ${r.docScroll}; ${r.alturasPorFila.slice(0, 6).join(' ; ')}`)
        expect(r.cartoes).toBeGreaterThan(3)
        expect(r.sobrepostos, 'colunas sobrepostas').toEqual([])
        expect(r.foraDoCartao, 'coluna fora do cartão').toEqual([])
        expect(r.docScroll).toBeLessThanOrEqual(0)
      } finally { await ctx.close() }
    })
  }

  // 4. o zero na caixa vazada (lista e cartão), contraste do contorno nos dois temas
  for (const tema of TEMAS) {
    test(`B2 zero medido na caixa vazada, tema ${NOME_TEMA[tema]}: lista (Impressões e Cliques) e cartão; contorno com contraste`, async ({ browser }) => {
      test.setTimeout(180_000)
      const { ctx, page } = await contexto(browser, 1440, 900, tema)
      try {
        await ir(page, urlCanal('?ver=lista'), esperaCanal)
        await util(page)
        const lista = await page.evaluate(() => {
          const u = (window as unknown as { __u: { rgb(s: string): { r: number; g: number; b: number; a: number } | null; ratio(a: unknown, b: unknown): number; fundo(el: Element): unknown; over(c: unknown, b: unknown): unknown } }).__u
          const zs = [...document.querySelectorAll<HTMLElement>('table .obs-ch-zero')].filter(e => e.getBoundingClientRect().width > 0)
          const el = zs[0]
          if (!el) return { n: 0 }
          const cs = getComputedStyle(el)
          const fundo = u.fundo(el.parentElement!)
          const borda = u.rgb(cs.borderTopColor)
          const cel = el.closest('td')?.getAttribute('data-label')
          return {
            n: zs.length, colunas: [...new Set(zs.map(e => e.closest('td')?.getAttribute('data-label')))], primeira: cel, texto: (el.firstChild?.textContent ?? '').trim(), fundo: cs.backgroundColor, bordaEstilo: cs.borderTopStyle,
            bordaLargura: cs.borderTopWidth, bordaCor: cs.borderTopColor, contrasteContornoCartao: borda ? Math.round(u.ratio(u.over(borda, fundo), fundo) * 100) / 100 : null,
            hachura: cs.backgroundImage !== 'none', naoMedidoNasCelulas: [...document.querySelectorAll('table td[data-label="Impressões"] .obs-ch-nm')].length,
          }
        })
        medida(`${NOME_TEMA[tema]} lista: ${JSON.stringify(lista)}`)
        expect((lista as { n: number }).n, 'a lista tem "0" na caixa vazada').toBeGreaterThan(0)
        const l = lista as { texto: string; hachura: boolean; bordaEstilo: string; contrasteContornoCartao: number | null; colunas: unknown[] }
        expect(l.texto).toBe('0')
        expect(l.hachura, 'o zero medido não tem hachura').toBe(false)
        expect(l.bordaEstilo).toBe('solid')
        expect(l.contrasteContornoCartao, 'contorno × fundo').toBeGreaterThanOrEqual(3)
        expect(l.colunas, 'zero em Impressões e em Cliques').toEqual(expect.arrayContaining(['Impressões', 'Cliques']))
        // o cartão da grade
        await ir(page, urlCanal(), esperaCanal)
        const cartao = await page.evaluate(() => {
          const zs = [...document.querySelectorAll<HTMLElement>('li.cv-card .cv-nums3 .obs-ch-zero')].filter(e => e.getBoundingClientRect().width > 0)
          const nm = [...document.querySelectorAll<HTMLElement>('li.cv-card .cv-nums3 .obs-ch-nm')].filter(e => e.getBoundingClientRect().width > 0)
          return { zeros: zs.length, naoMedidosNaColuna: nm.map(e => (e.textContent ?? '').trim()).slice(0, 4) }
        })
        medida(`${NOME_TEMA[tema]} cartões: ${JSON.stringify(cartao)}`)
        expect(cartao.zeros, 'a grade tem cartão com "0" na caixa vazada').toBeGreaterThan(0)
      } finally { await ctx.close() }
    })
  }

  // 5. posição do cartão nos dois pares, 1440 e 390: depois de Número a número, dos mais vistos e da publicação; antes da forja (último)
  for (const vp of VPS) {
    test(`posição do cartão a ${vp.w} px: canal seu × concorrente e canal seu × canal seu`, async ({ browser }) => {
      test.setTimeout(180_000)
      const { ctx, page } = await contexto(browser, vp.w, vp.h, 'dark')
      try {
        for (const [rotulo, url, esperados] of [
          ['seu × concorrente', urlComparar(own, ids.channel('matt-wolfe')), 1],
          ['seu × seu', urlComparar(own, ids.own('tnfigueiredo-en')), 2],
        ] as const) {
          await ir(page, url, `${C} .cp-side`)
          const o = await page.evaluate(() => {
            const raiz = document.querySelector<HTMLElement>('[data-obs-screen="comparar"]')!
            const hs = [...raiz.children].map(e => `${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).split(' ')[0] : ''}${e.hasAttribute('data-so-seu-canal') ? '[so]' : ''}`)
            const filhos = [...raiz.children] as HTMLElement[]
            const idx = (f: (e: HTMLElement) => boolean) => filhos.findIndex(f)
            const num = idx(e => /Número a número/.test(e.querySelector('h2')?.textContent ?? e.textContent?.slice(0, 40) ?? ''))
            const cartoes = filhos.map((e, i) => e.hasAttribute('data-so-seu-canal') ? i : -1).filter(i => i >= 0)
            const forja = idx(e => e.classList.contains('cp-fj'))
            const maisVistos = idx(e => /mais vistos/i.test(e.querySelector('h2')?.textContent ?? ''))
            const publ = idx(e => /Publica/i.test(e.querySelector('h2')?.textContent ?? ''))
            const rects = (i: number) => (i >= 0 ? Math.round(filhos[i]!.getBoundingClientRect().top + scrollY) : -1)
            return { sequencia: hs, num, maisVistos, publ, cartoes, forja, filhos: filhos.length, topoCartoes: cartoes.map(rects), topoForja: rects(forja), topoNum: rects(num) }
          })
          medida(`${vp.w}px ${rotulo}: ${JSON.stringify(o)}`)
          expect(o.cartoes.length, `${rotulo}: cartões`).toBe(esperados)
          expect(Math.min(...o.cartoes), `${rotulo}: cartão depois de Número a número`).toBeGreaterThan(o.num)
          if (o.maisVistos >= 0) expect(Math.min(...o.cartoes), `${rotulo}: depois dos mais vistos`).toBeGreaterThan(o.maisVistos)
          if (o.publ >= 0) expect(Math.min(...o.cartoes), `${rotulo}: depois da publicação`).toBeGreaterThan(o.publ)
          expect(o.forja, `${rotulo}: forja existe`).toBeGreaterThanOrEqual(0)
          expect(Math.max(...o.cartoes), `${rotulo}: antes da forja`).toBeLessThan(o.forja)
          expect(o.forja, `${rotulo}: forja é o último filho`).toBe(o.filhos - 1)
          // dois cartões ficam juntos
          if (o.cartoes.length === 2) expect(o.cartoes[1]! - o.cartoes[0]!, 'os dois cartões são vizinhos').toBe(1)
        }
      } finally { await ctx.close() }
    })
  }

  // 6. foco do h1 do vídeo (S3) e H13 (popover do ⓘ do vídeo × linha de rótulos da faixa)
  test('foco do h1 do vídeo: quem recebe o foco ao abrir, o anel e o contorno do h1 focado', async ({ browser }) => {
    test.setTimeout(180_000)
    const { ctx, page } = await contexto(browser, 1440, 900, 'dark')
    try {
      await ir(page, urlVideo(RET.volumeAlto), esperaVideo)
      await page.waitForTimeout(600)
      const aberto = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null
        const h1 = document.querySelector<HTMLElement>('[data-obs-screen="video-proprio"] h1')!
        return { ativo: a ? `${a.tagName.toLowerCase()}${a.className ? '.' + String(a.className).split(' ')[0] : ''}` : null, ativoEhH1: a === h1, tabindex: h1.getAttribute('tabindex') }
      })
      medida(`foco ao abrir o vídeo: ${JSON.stringify(aberto)}`)
      // foco programático no h1 (como a tela faz ao trocar de vídeo) e por teclado
      await page.evaluate(() => (document.querySelector('[data-obs-screen="video-proprio"] h1') as HTMLElement).focus())
      await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab')
      const anel = await page.evaluate(() => {
        const h1 = document.querySelector<HTMLElement>('[data-obs-screen="video-proprio"] h1')!
        h1.focus()
        const cs = getComputedStyle(h1)
        return { focado: document.activeElement === h1, focusVisible: h1.matches(':focus-visible'), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, offset: cs.outlineOffset, boxShadow: cs.boxShadow }
      })
      medida(`h1 do vídeo focado: ${JSON.stringify(anel)}`)
      expect(anel.focado).toBe(true)
      const caixa = (await page.locator(`${V}:visible h1`).first().boundingBox())!
      await page.screenshot({ path: path.join(SHOTS, 'video-h1-foco.png'), clip: { x: Math.max(0, caixa.x - 16), y: Math.max(0, caixa.y - 16), width: Math.min(1440, caixa.width + 32), height: caixa.height + 32 } })
      medida(`h1 do vídeo: caixa ${Math.round(caixa.width)}x${Math.round(caixa.height)}; anel de 2 px a 4 px de distância (${Math.round(caixa.width + 12)}x${Math.round(caixa.height + 12)} com anel)`)
      // depois de Próximo: o foco vai a quê
      const prox = page.locator('.obs-tr-aside [data-pager-next]:visible')
      if (await prox.count()) {
        await prox.first().click()
        await page.waitForURL(/\/video\//)
        await page.locator(esperaVideo).first().waitFor()
        await page.waitForTimeout(500)
        const depois = await page.evaluate(() => {
          const a = document.activeElement as HTMLElement | null
          const h1 = document.querySelector<HTMLElement>('[data-obs-screen="video-proprio"] h1')
          return { ativo: a ? `${a.tagName.toLowerCase()}${a.className ? '.' + String(a.className).split(' ')[0] : ''}${a.hasAttribute('data-pager-next') ? '[next]' : ''}` : null, ehH1: a === h1 }
        })
        medida(`foco depois de Próximo: ${JSON.stringify(depois)}`)
      }
    } finally { await ctx.close() }
  })

  for (const vp of VPS) {
    test(`H13 popover do ⓘ do vídeo a ${vp.w} px: não cobre a linha de rótulos da faixa nem o valor; fica dentro da janela`, async ({ browser }) => {
      test.setTimeout(180_000)
      const { ctx, page } = await contexto(browser, vp.w, vp.h, 'dark')
      try {
        await ir(page, urlVideo(RET.volumeAlto), esperaVideo)
        // H13 (T11 menor 8): o ⓘ do CABEÇALHO ("De onde vêm os números deste vídeo") abre o popover sobre a faixa de números (rótulos e valores)? Afirma.
        const cab = page.locator(`${V}:visible button.ibtn[aria-controls="video-tip"]`)
        await expect(cab).toHaveCount(1)
        await cab.click()
        await page.locator('#video-tip').waitFor({ timeout: 5000 })
        const h = await page.evaluate(() => {
          const p = document.querySelector<HTMLElement>('#video-tip')!.getBoundingClientRect()
          const inter = (a: DOMRect) => a.width > 0 && p.left < a.right - 0.5 && a.left < p.right - 0.5 && p.top < a.bottom - 0.5 && a.top < p.bottom - 0.5
          const dts = [...document.querySelectorAll<HTMLElement>('[data-obs-screen="video-proprio"] .nstrip dt')].filter(e => e.getBoundingClientRect().width > 0)
          const dds = [...document.querySelectorAll<HTMLElement>('[data-obs-screen="video-proprio"] .nstrip dd')].filter(e => e.getBoundingClientRect().width > 0)
          const ib = document.querySelector<HTMLElement>('[data-obs-screen="video-proprio"] button.ibtn[aria-controls="video-tip"]')!.getBoundingClientRect()
          const tit = document.querySelector<HTMLElement>('[data-obs-screen="video-proprio"] h1')!.getBoundingClientRect()
          const faixa = document.querySelector<HTMLElement>('[data-obs-screen="video-proprio"] .nstrip')!.getBoundingClientRect()
          return {
            pop: { l: Math.round(p.left), r: Math.round(p.right), t: Math.round(p.top), b: Math.round(p.bottom) }, ibtn: { l: Math.round(ib.left), t: Math.round(ib.top), b: Math.round(ib.bottom) },
            faixa: { t: Math.round(faixa.top), b: Math.round(faixa.bottom), l: Math.round(faixa.left), r: Math.round(faixa.right) },
            cobreRotulos: dts.filter(e => inter(e.getBoundingClientRect())).map(e => (e.textContent ?? '').trim().slice(0, 20)), cobreValores: dds.filter(e => inter(e.getBoundingClientRect())).map(e => (e.textContent ?? '').trim().slice(0, 12)),
            cobreTitulo: inter(tit), dentro: p.left >= -1 && p.right <= innerWidth + 1,
          }
        })
        medida(`${vp.w}px ⓘ do cabeçalho: ${JSON.stringify(h)}`)
        await page.screenshot({ path: path.join(SHOTS, `video-popover-cabecalho-${vp.w}.png`) })
        expect.soft(h.dentro, 'popover do cabeçalho dentro da janela').toBe(true)
        expect.soft(h.cobreRotulos, 'o popover do ⓘ do cabeçalho não cobre a linha de rótulos da faixa').toEqual([])
        expect.soft(h.cobreValores, 'o popover do ⓘ do cabeçalho não cobre os valores da faixa').toEqual([])
        await page.keyboard.press('Escape')
        const botoes = page.locator(`${V}:visible button.ibtn.vb-info`)
        const n = await botoes.count()
        medida(`${vp.w}px: ${n} botões ⓘ de seção no vídeo`)
        expect(n).toBeGreaterThan(0)
        for (let i = 0; i < n; i++) {
          const b = botoes.nth(i)
          const rotulo = (await b.getAttribute('aria-label')) ?? `ⓘ ${i}`
          await b.scrollIntoViewIfNeeded()
          await b.click()
          const pop = page.locator('#flut [role="dialog"], [role="dialog"].canal-tip').first()
          await pop.waitFor({ timeout: 5000 })
          const r = await page.evaluate(() => {
            const p = document.querySelector<HTMLElement>('[role="dialog"].canal-tip')!.getBoundingClientRect()
            const alvos = [...document.querySelectorAll<HTMLElement>('[data-obs-screen="video-proprio"] .tf-lab, [data-obs-screen="video-proprio"] .tf-nota, [data-obs-screen="video-proprio"] .tf-svg text, [data-obs-screen="video-proprio"] .tf-cab, [data-obs-screen="video-proprio"] .vb-info')]
            const cobre = alvos.filter(e => { const a = e.getBoundingClientRect(); return a.width > 0 && !e.matches('.vb-info') && p.left < a.right - 0.5 && a.left < p.right - 0.5 && p.top < a.bottom - 0.5 && a.top < p.bottom - 0.5 }).map(e => `${e.tagName.toLowerCase()}.${String(e.getAttribute('class')).slice(0, 14)}“${(e.textContent ?? '').trim().slice(0, 18)}”`)
            return { pop: { l: Math.round(p.left), r: Math.round(p.right), t: Math.round(p.top), b: Math.round(p.bottom) }, cobre, dentro: p.left >= -1 && p.right <= innerWidth + 1, faixas: document.querySelectorAll('[data-obs-screen="video-proprio"] .tf-linha').length }
          })
          medida(`${vp.w}px ⓘ “${rotulo}”: popover ${JSON.stringify(r.pop)}, dentro ${r.dentro}, faixas na tela ${r.faixas}, cobre ${r.cobre.length ? r.cobre.join(' | ') : 'nenhum rótulo da faixa'}`)
          if (/taxa/i.test(rotulo)) await page.screenshot({ path: path.join(SHOTS, `video-popover-taxa-${vp.w}.png`) })
          expect.soft(r.dentro, `“${rotulo}”: popover dentro da janela`).toBe(true)
          await page.keyboard.press('Escape')
          await page.waitForTimeout(150)
        }
      } finally { await ctx.close() }
    })
  }

  // 7. capturas: canal cheio, vídeo cheio, grade, lista, vídeo sem impressão (régua)
  for (const vp of VPS) for (const tema of TEMAS) {
    test(`capturas retencao ${vp.w} px ${NOME_TEMA[tema]}: canal cheio, vídeo cheio, grade de cartões, lista com zero, vídeo sem impressão`, async ({ browser }) => {
      test.setTimeout(420_000)
      const { ctx, page } = await contexto(browser, vp.w, vp.h, tema)
      const sufixo = `${vp.w}-${NOME_TEMA[tema]}`
      try {
        await ir(page, urlCanal('?painel=1&nums=1'), esperaCanal)
        const canal = await telaInteira(page, S)
        await ladoALado(browser, canal, await mockShot(browser, 'canal.html', 'caso=cheio', vp.w, vp.h, tema, '#screen'), `canal cheio, ${sufixo}`, tema, `canal-cheio-${sufixo}.png`)
        // a grade de cartões (só a grade) × o mockup (os cartões de vídeo)
        await ir(page, urlCanal(), esperaCanal)
        await liberar(page, S)
        const grade = await page.locator(`${S}:visible ul.cv-grid`).first().screenshot()
        await ladoALado(browser, grade, await mockShot(browser, 'canal.html', 'caso=cheio', vp.w, vp.h, tema, '#screen'), `grade de cartões, ${sufixo}`, tema, `grade-cartoes-${sufixo}.png`)
        await ir(page, urlCanal('?ver=lista'), esperaCanal)
        await liberar(page, S)
        const lista = await page.locator(`${S}:visible table, ${S}:visible ul.cv-lista, ${S}:visible [data-ver="lista"]`).first().screenshot()
        await ladoALado(browser, lista, await mockShot(browser, 'canal.html', 'caso=cheio', vp.w, vp.h, tema, '#screen'), `lista com zero na caixa vazada, ${sufixo}`, tema, `lista-zero-caixa-vazada-${sufixo}.png`)
        await ir(page, urlVideo(RET.volumeAlto), esperaVideo)
        const video = await telaInteira(page, V)
        await ladoALado(browser, video, await mockShot(browser, 'video.html', 'caso=cheio', vp.w, vp.h, tema, '#screen'), `vídeo cheio, ${sufixo}`, tema, `video-cheio-${sufixo}.png`)
        // o vídeo sem impressão (a régua de impressões mostra 0 na caixa vazada e a frase)
        await ir(page, urlVideo('xsi7iiX5Hvd'), esperaVideo)
        const sem = await telaInteira(page, V)
        await ladoALado(browser, sem, await mockShot(browser, 'video.html', 'caso=cheio', vp.w, vp.h, tema, '#screen'), `vídeo sem impressão, ${sufixo}`, tema, `video-sem-impressao-${sufixo}.png`)
        const regua = await page.evaluate(() => {
          const li = [...document.querySelectorAll<HTMLElement>('[data-obs-screen="video-proprio"] .vb-reguas li, [data-obs-screen="video-proprio"] [data-regua]')].find(e => /impress/i.test(e.textContent ?? ''))
          return li ? (li.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 260) : null
        })
        medida(`${sufixo} régua de impressões do vídeo sem impressão: ${regua}`)
      } finally { await ctx.close() }
    })
  }

  // 8. vídeo de 3 a 5 dias (3 e 5 dias)
  test('captura do vídeo de 3 a 5 dias (impressões e views): 1440 e 390, claro e escuro', async ({ browser }) => {
    test.setTimeout(480_000)
    const sb = localServiceClient()
    try {
      for (const dias of [3, 5]) {
        const alvo = new Date(ORACLE_NOW - dias * 24 * 3600 * 1000); alvo.setUTCHours(15, 0, 0, 0)
        const up = await sb.from('youtube_videos').update({ published_at: alvo.toISOString() }).eq('id', vid[RET.magro]!).eq('site_id', siteId)
        if (up.error) throw new Error(up.error.message)
        for (const vp of VPS) for (const tema of TEMAS) {
          const { ctx, page } = await contexto(browser, vp.w, vp.h, tema)
          try {
            await ir(page, urlVideo(RET.magro), esperaVideo)
            const sufixo = `${dias}-dias-${vp.w}-${NOME_TEMA[tema]}`
            const sec = page.locator(`${V}:visible section[aria-labelledby="vb-imp-h"]`)
            const colunas = await sec.locator('g.ic-col').count()
            const texto = (await sec.innerText()).replace(/\s+/g, ' ').slice(0, 240)
            medida(`${sufixo}: colunas de impressões ${colunas}; ${texto}`)
            const video = await telaInteira(page, V)
            await ladoALado(browser, video, await mockShot(browser, 'video.html', 'caso=novo', vp.w, vp.h, tema, '#screen'), `vídeo de ${dias} dias, ${vp.w} px, ${NOME_TEMA[tema]}`, tema, `video-${sufixo}.png`)
          } finally { await ctx.close() }
        }
      }
    } finally {
      await sb.from('youtube_videos').update({ published_at: new Date(ORACLE_NOW - 13 * 24 * 3600 * 1000).toISOString() }).eq('id', vid[RET.magro]!).eq('site_id', siteId)
    }
  })
})

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// Casos da comparação e do canal/vídeo magros: curto (magro), ativo (cheio), nenhum (sem dado)
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
const CASOS: Array<{ nome: 'magro' | 'cheio' | 'sem-dado'; seed: SeedOptions }> = [
  { nome: 'magro', seed: { ownPreset: '2', ownL2: 'curto' } },
  { nome: 'cheio', seed: { ownPreset: '2', ownL2: 'ativo' } },
  { nome: 'sem-dado', seed: { ownPreset: '2' } },
]
for (const caso of CASOS) {
  test.describe(`fecho A4: comparação, caso ${caso.nome}`, () => {
    let ids: ReturnType<typeof seedIdsOf>, siteId = ''
    test.beforeAll(async () => { test.setTimeout(240_000); siteId = await ensureSeeded(caso.seed); ids = seedIdsOf(siteId) })
    test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })
    const url = (): string => `${ROTA}/comparar?a=${ids.own('tnfigueiredo')}&b=${ids.channel('matt-wolfe')}`

    for (const vp of VPS) for (const tema of TEMAS) {
      test(`${caso.nome} ${vp.w} px ${NOME_TEMA[tema]}: o fim da comparação com o cartão, lado a lado com o mockup`, async ({ browser }) => {
        test.setTimeout(240_000)
        const { ctx, page } = await contexto(browser, vp.w, vp.h, tema)
        try {
          await ir(page, url(), `${C}:visible .cp-side`)
          await expect(page.locator(CARTAO)).toHaveCount(1)
          await liberar(page, C)
          await page.waitForTimeout(250)
          // do topo de "Número a número" ao fim da tela (cartão e forja)
          const clip = await page.evaluate(() => {
            const raiz = document.querySelector<HTMLElement>('[data-obs-screen="comparar"]')!
            const num = [...raiz.children].find(e => /Número a número/.test(e.textContent?.slice(0, 60) ?? '')) as HTMLElement
            const r0 = raiz.getBoundingClientRect(), n = num.getBoundingClientRect()
            return { x: Math.max(0, r0.left + scrollX), y: n.top + scrollY, width: r0.width, height: r0.bottom - n.top }
          })
          const fim = await page.screenshot({ clip, fullPage: true })
          const sufixo = `${vp.w}-${NOME_TEMA[tema]}`
          await ladoALado(browser, fim, await mockShot(browser, 'comparar-so-seu-canal.html', `caso=${caso.nome}`, vp.w, vp.h, tema, 'section.so'), `de Número a número ao fim, caso ${caso.nome}, ${sufixo}`, tema, `comparar-fim-com-cartao-${caso.nome}-${sufixo}.png`)
          if (caso.nome === 'sem-dado') {
            await util(page)
            const f = await page.evaluate(() => {
              const el = document.querySelector<HTMLElement>('[data-so-seu-canal] .so-nm')
              if (!el) return null
              const cs = getComputedStyle(el); const bgi = cs.backgroundImage
              return { repetida: /repeating-linear-gradient/.test(bgi), borda: `${cs.borderTopStyle} ${cs.borderTopWidth}`, caixa: `${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}` }
            })
            medida(`sem dado ${sufixo}: .so-nm ${JSON.stringify(f)}`)
            expect(f, '.so-nm existe no cartão sem dado').not.toBeNull()
            expect(f!.repetida, '.so-nm tem a hachura').toBe(true)
          }
        } finally { await ctx.close() }
      })
    }

    if (caso.nome === 'sem-dado') {
      for (const tema of TEMAS) {
        test(`B1 hachura do .nm-q (cabeçalho do canal sem coleta), tema ${NOME_TEMA[tema]}`, async ({ browser }) => {
          test.setTimeout(180_000)
          const { ctx, page } = await contexto(browser, 1440, 900, tema)
          try {
            await ir(page, `${ROTA}/canal/${ids.own('tnfigueiredo')}`, `${S} .chead h1`)
            await util(page)
            const f = await page.evaluate(() => {
              const u = (window as unknown as { __u: { rgb(s: string): { r: number; g: number; b: number; a: number } | null; ratio(a: unknown, b: unknown): number; fundo(el: Element): unknown; over(c: unknown, b: unknown): unknown } }).__u
              const els = [...document.querySelectorAll<HTMLElement>('.nm-q')].filter(e => e.getBoundingClientRect().width > 0)
              const el = els[0]
              if (!el) return null
              const cs = getComputedStyle(el), bgi = cs.backgroundImage
              const cores = [...new Set([...bgi.matchAll(/rgba?\([^)]*\)/g)].map(m => m[0]))]
              const fundo = u.fundo(el.parentElement!), a = u.rgb(cores[0] ?? ''), b = u.rgb(cores[1] ?? ''), borda = u.rgb(cs.borderTopColor)
              return {
                n: els.length, repetida: /repeating-linear-gradient/.test(bgi), angulo: (bgi.match(/(\d+)deg/) ?? [])[1] ?? null, cores,
                contrasteListraFundo: a && b ? Math.round(u.ratio(a, b) * 100) / 100 : null, bordaEstilo: cs.borderTopStyle,
                contrasteBordaCartao: borda ? Math.round(u.ratio(u.over(borda, fundo), fundo) * 100) / 100 : null, caixa: `${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`,
              }
            })
            medida(`${NOME_TEMA[tema]} | canal sem dado | .nm-q: ${JSON.stringify(f)}`)
            expect(f, '.nm-q existe no cabeçalho do canal sem coleta').not.toBeNull()
            expect(f!.repetida).toBe(true)
            expect(f!.angulo).toBe('135')
            expect(f!.contrasteListraFundo!).toBeGreaterThanOrEqual(3)
            expect(f!.bordaEstilo).toBe('solid')
            expect(f!.contrasteBordaCartao!).toBeGreaterThanOrEqual(3)
          } finally { await ctx.close() }
        })
      }
    }

    if (caso.nome === 'magro') {
      for (const tema of TEMAS) {
        test(`M1 cartão magro a 390 px ${NOME_TEMA[tema]}: "% assistido" sem quadradinho, frase "Ainda não dá para dizer" legível e dentro do cartão`, async ({ browser }) => {
          test.setTimeout(180_000)
          const { ctx, page } = await contexto(browser, 390, 844, tema)
          try {
            await ir(page, url(), `${C}:visible .cp-side`)
            const r = await page.evaluate(() => {
              const c = document.querySelector<HTMLElement>('[data-obs-screen="comparar"] [data-so-seu-canal]')!
              const li = [...c.querySelectorAll<HTMLElement>('ul.so-linhas > li')].find(l => /assistido/i.test(l.querySelector('.so-rt')?.textContent ?? ''))
              if (!li) return null
              const ainda = li.querySelector<HTMLElement>('.so-ainda')
              const cr = c.getBoundingClientRect(), ar = ainda?.getBoundingClientRect()
              return {
                chave: li.getAttribute('data-linha'), quadradinhos: li.querySelectorAll('.so-nm, .obs-ch-nm').length, texto: (ainda?.textContent ?? '').trim(), display: ainda ? getComputedStyle(ainda).display : null,
                fonte: ainda ? parseFloat(getComputedStyle(ainda).fontSize) : null, dentro: ar ? ar.left >= cr.left - 1 && ar.right <= cr.right + 1 : null, larguraRelativa: ar ? Math.round((ar.width / cr.width) * 100) : null,
                docScroll: document.documentElement.scrollWidth - innerWidth,
              }
            })
            medida(`magro 390 ${NOME_TEMA[tema]}: ${JSON.stringify(r)}`)
            expect(r, 'a linha de % assistido existe').not.toBeNull()
            expect(r!.quadradinhos, 'sem quadradinho de não medido').toBe(0)
            expect(r!.texto).toMatch(/^Ainda não dá para dizer: só 2 dias com dado; precisa de 7\./)
            expect(r!.dentro, 'frase dentro do cartão').toBe(true)
            expect(r!.fonte!, 'texto de 12 px ou mais').toBeGreaterThanOrEqual(12)
            expect(r!.docScroll).toBeLessThanOrEqual(0)
            await page.locator(CARTAO).first().scrollIntoViewIfNeeded()
            await page.locator(CARTAO).first().screenshot({ path: path.join(SHOTS, `cartao-magro-390-${NOME_TEMA[tema]}.png`) })
          } finally { await ctx.close() }
        })
      }
      // canal e vídeo magros lado a lado com o mockup
      for (const vp of VPS) for (const tema of TEMAS) {
        test(`capturas magro ${vp.w} px ${NOME_TEMA[tema]}: canal magro e vídeo magro`, async ({ browser }) => {
          test.setTimeout(300_000)
          const { ctx, page } = await contexto(browser, vp.w, vp.h, tema)
          const sufixo = `${vp.w}-${NOME_TEMA[tema]}`
          try {
            const own = ids.own('tnfigueiredo')
            await ir(page, `${ROTA}/canal/${own}`, `${S} .chead h1`)
            const canal = await telaInteira(page, S)
            await ladoALado(browser, canal, await mockShot(browser, 'canal.html', 'caso=magro', vp.w, vp.h, tema, '#screen'), `canal magro, ${sufixo}`, tema, `canal-magro-${sufixo}.png`)
            // um vídeo com linha de alcance no banco
            const rr = await localServiceClient().from('yt_own_video_reach_daily').select('youtube_video_id').eq('site_id', siteId).eq('channel_id', own).limit(1)
            const yt = String(rr.data?.[0]?.youtube_video_id ?? '')
            const vv = await localServiceClient().from('youtube_videos').select('id').eq('site_id', siteId).eq('channel_id', own).eq('youtube_video_id', yt).maybeSingle()
            expect(vv.data?.id, 'um vídeo com alcance no perfil curto').toBeTruthy()
            await ir(page, `${ROTA}/video/${vv.data!.id}?from=canais&canal=${own}`, `${V} h1:visible`)
            const video = await telaInteira(page, V)
            await ladoALado(browser, video, await mockShot(browser, 'video.html', 'caso=magro', vp.w, vp.h, tema, '#screen'), `vídeo magro, ${sufixo}`, tema, `video-magro-${sufixo}.png`)
          } finally { await ctx.close() }
        })
      }
    }
  })
}
