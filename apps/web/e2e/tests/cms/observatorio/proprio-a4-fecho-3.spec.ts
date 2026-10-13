// apps/web/e2e/tests/cms/observatorio/proprio-a4-fecho-3.spec.ts
// Segunda passada de navegador do fecho da A4 (12/10), depois de "zero medido só desde a publicação", "hoje e ontem sem linha são não medido" e "vídeo novo" com um
// limite só. Mede e captura o que o revisor de UX pediu: a grade e a lista com o vídeo de 2 dias ("vídeo novo"), a página de vídeo novo (17 h sem linha, 2 dias, 17 h
// COM linha), o gráfico do canal com D e D-1 hachurados, a borda direita a 390 px (scrollWidth × clientWidth e o retângulo do botão "Abrir no YouTube"), a largura da
// pastilha "vídeo novo" a 390, o anel de foco do h1 do vídeo aberto por CLIQUE de mouse e o cartão com "0" + "sem impressão no período" (S5, para o revisor decidir).
// As capturas incluem a trilha e o título (a raiz é `.obs-ch-root`, o ancestral da trilha e da tela). Saem em docs/.../shots/a4-fecho-3 (não commitadas); medidas em
// A4_MEDIDAS. Nada é escrito no produto: toda server action é abortada; as mudanças de dado (data de publicação, uma linha de alcance) são só no banco local e voltam.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, repoFileUrl, seedIdsOf } from './fidelity'
import { diaYoutube, localServiceClient, ORACLE_NOW, RET, somaDias } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

test.use({ storageState: ADMIN_STATE })
const ROTA = '/cms/youtube/competitors'
const S = '[data-obs-screen="canal"][data-own="1"]'
const V = '[data-obs-screen="video-proprio"]'
const RAIZ = '.obs-ch-root'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const MEDIDAS = process.env.A4_MEDIDAS ?? path.resolve(__dirname, '../../../../test-results/proprio-a4-fecho-3-medidas.txt')
const SHOTS = path.resolve(__dirname, '../../../../../../docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/shots/a4-fecho-3')
const MOCK = '.superpowers/sdd/2026-10-12-telas-a4-canal-proprio-plan/mockup-congelado-12-10/'
const TEMAS = ['dark', 'light'] as const
const NOME_TEMA = { dark: 'escuro', light: 'claro' } as const
type Tema = (typeof TEMAS)[number]
const VPS = [{ w: 1440, h: 900 }, { w: 390, h: 844 }] as const
const HOJE = diaYoutube(ORACLE_NOW)

function medida(texto: string): void {
  fs.mkdirSync(path.dirname(MEDIDAS), { recursive: true })
  fs.appendFileSync(MEDIDAS, `[${test.info().title.slice(0, 70)}] ${texto}\n`)
  test.info().annotations.push({ type: 'medida', description: texto })
}

let intrusos: string[] = [], erros: string[] = [], cincoXX: string[] = []
test.beforeEach(() => { intrusos = []; erros = []; cincoXX = [] })
test.afterEach(() => {
  if (intrusos.length) throw new Error(`Server action INESPERADA abortada: ${intrusos.length}. Primeira: ${intrusos[0]}`)
  expect(cincoXX, 'respostas 5xx').toEqual([])
  expect(erros, 'erros de console').toEqual([])
})

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
/**
 * A tela inteira COM a trilha e o título, sem mexer no layout: a janela cresce até caber toda a rolagem da casca (a "liberação" por CSS da passada anterior alargava a
 * tela a 390 px de 334 para 717 px e a captura saía cortada na borda direita), a rolagem volta a zero e se captura o `.obs-ch-root` que contém a tela.
 */
async function telaComTrilha(page: Page, tela: string): Promise<Buffer> {
  const vp = page.viewportSize()!
  const extra = await page.evaluate((sel: string) => {
    const t = document.querySelector<HTMLElement>(sel)!
    for (let e: HTMLElement | null = t.parentElement; e; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1) return e.scrollHeight - e.clientHeight
    }
    return Math.max(0, document.documentElement.scrollHeight - innerHeight)
  }, tela)
  await page.setViewportSize({ width: vp.width, height: Math.min(30000, vp.height + extra + 60) })
  try {
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll<HTMLElement>('*').forEach(e => { if (e.scrollTop) e.scrollTop = 0 }) })
    await page.waitForTimeout(500)
    const raiz = page.locator(tela).first().locator(`xpath=ancestor::*[contains(@class,"obs-ch-root")][1]`)
    const topo = await raiz.evaluate(e => { const r = e.getBoundingClientRect(); return { y: Math.round(r.top + scrollY), w: Math.round(r.width), trilha: !!e.querySelector('nav.crumbs'), h1: !!e.querySelector('h1') } })
    medida(`captura: raiz em y=${topo.y}, largura ${topo.w}, com trilha=${topo.trilha}, com h1=${topo.h1}`)
    return await raiz.screenshot()
  } finally { await page.setViewportSize(vp) }
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
async function ladoALado(browser: Browser, impl: Buffer, mock: Buffer | null, legenda: string, tema: Tema, nome: string): Promise<void> {
  fs.mkdirSync(SHOTS, { recursive: true })
  const c = await browser.newContext({ viewport: { width: 3000, height: 100 } })
  try {
    const comp = await c.newPage()
    const uri = (b: Buffer) => 'data:image/png;base64,' + b.toString('base64')
    const direita = mock ? `<figure style="margin:0"><figcaption style="margin-bottom:4px">mockup congelado de 12/10</figcaption><img src="${uri(mock)}"></figure>` : `<figure style="margin:0"><figcaption style="margin-bottom:4px">o mockup congelado não tem esta tela</figcaption></figure>`
    await comp.setContent(`<body style="margin:0;padding:12px;background:${tema === 'dark' ? '#2b2724' : '#d8d2c8'};font:12px system-ui;color:${tema === 'dark' ? '#eee' : '#222'};display:flex;gap:16px;align-items:flex-start"><figure style="margin:0"><figcaption style="margin-bottom:4px">implementada agora (${legenda})</figcaption><img src="${uri(impl)}"></figure>${direita}</body>`)
    await comp.screenshot({ path: path.join(SHOTS, nome), fullPage: true })
  } finally { await c.close() }
}
const larguraPng = (b: Buffer): number => b.readUInt32BE(16)
const alturaPng = (b: Buffer): number => b.readUInt32BE(20)

/** Cada seção do relatório conta com uma pasta de capturas por perfil. */
test.describe('fecho A4 (2ª passada): perfil retencao (vídeo de 2 dias, grade, lista, borda, foco)', () => {
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
  const esperaCanal = `${S} .chead h1`
  const esperaVideo = `${V} h1:visible`

  for (const vp of VPS) for (const tema of TEMAS) {
    test(`F ${vp.w} px ${NOME_TEMA[tema]}: grade com o vídeo de 2 dias (vídeo novo), lista, cartão com zero (S5) e a pastilha`, async ({ browser }) => {
      test.setTimeout(420_000)
      const { ctx, page } = await contexto(browser, vp.w, vp.h, tema)
      const sufixo = `${vp.w}-${NOME_TEMA[tema]}`
      try {
        await ir(page, urlCanal(), esperaCanal)
        const grade = await telaComTrilha(page, S)
        await ladoALado(browser, grade, await mockShot(browser, 'canal.html', 'caso=cheio', vp.w, vp.h, tema, '#screen'), `canal, grade de cartões, ${sufixo}`, tema, `grade-canal-inteiro-${sufixo}.png`)
        // o cartão do vídeo de 2 dias: palavra, pastilha e medidas
        // atenção: o href de TODO cartão leva ids=<todos os ids da grade>, então o cartão de um vídeo se acha pelo id do link (a#cv-lnk-<uuid>), nunca por href*=
        const card = page.locator(`${S}:visible ul.cv-grid > li`).filter({ has: page.locator('.obs-ch-nm', { hasText: 'vídeo novo' }) }).first()
        await card.scrollIntoViewIfNeeded()
        const texto = (await card.innerText()).replace(/\s+/g, ' ').trim()
        medida(`${sufixo} cartão do vídeo novo (17 h): "${texto.slice(0, 200)}"`)
        expect(texto).toContain('vídeo novo')
        expect(texto, 'o vídeo novo nunca vira "0 impressões" nem "sem impressão"').not.toMatch(/sem impressão no período/)
        const pastilha = card.locator('.obs-ch-nm', { hasText: 'vídeo novo' }).first()
        const m = await pastilha.evaluate(el => {
          const r = el.getBoundingClientRect(), c = el.closest('li')!.getBoundingClientRect(), cs = getComputedStyle(el)
          let corte = false
          for (let e: HTMLElement | null = el as HTMLElement; e && e.tagName !== 'BODY'; e = e.parentElement) {
            const s = getComputedStyle(e)
            if (/(hidden|clip|auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 0.5) { corte = true; break }
          }
          return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, cardW: Math.round(c.width), esq: Math.round(r.left - c.left), dir: Math.round(c.right - r.right), linhas: Math.round(r.height / parseFloat(cs.lineHeight || '16')), ws: cs.whiteSpace, sw: el.scrollWidth, cw: el.clientWidth, corte }
        })
        medida(`${sufixo} pastilha "vídeo novo" (cartão de 17 h): ${JSON.stringify(m)}`)
        expect(m.dir, 'a pastilha termina dentro do cartão').toBeGreaterThanOrEqual(0)
        expect(m.corte, 'nenhum ancestral corta a pastilha').toBe(false)
        const cartaoPng = await card.screenshot()
        await ladoALado(browser, cartaoPng, await mockShot(browser, 'canal.html', 'caso=cheio', vp.w, vp.h, tema, 'article.vc'), `cartão do vídeo novo (17 h), ${sufixo}`, tema, `grade-cartao-video-novo-17h-${sufixo}.png`)

        // S5: o cartão com "0" na caixa vazada E a frase "sem impressão no período", ao lado do mesmo cartão no mockup congelado
        const comZero = page.locator(`${S}:visible ul.cv-grid > li`).filter({ has: page.locator('.obs-ch-zero') }).first()
        await comZero.scrollIntoViewIfNeeded()
        const tz = (await comZero.innerText()).replace(/\s+/g, ' ').trim()
        medida(`${sufixo} S5 cartão com zero: "${tz.slice(0, 200)}"`)
        // K5 (UX rodada 3): o cartão tem só a caixa "0" (com o title do zero medido); a frase "sem impressão no período" saiu do cartão e a legenda da grade explica a caixa
        expect(tz, 'a frase antiga não está mais no cartão').not.toContain('sem impressão no período')
        const caixaZero = comZero.locator('.obs-ch-zero').first()
        expect((await caixaZero.innerText()).replace(/\s+/g, ' ').trim()).toMatch(/^0\b/)
        await expect(caixaZero).toHaveAttribute('title', 'zero medido: o YouTube mediu e o vídeo não apareceu')
        expect(await comZero.locator('p.cv-n3').count(), 'sem terceira linha no cartão com zero medido').toBe(0)
        expect(await page.locator(S).first().innerText(), 'a legenda da grade explica a caixa vazada e a hachura').toContain('Caixa vazada com 0: o YouTube mediu o período e o vídeo não apareceu. Hachura: ainda não medido.')
        const zeroPng = await comZero.screenshot()
        let mockZero: Buffer | null = null
        try { mockZero = await mockShot(browser, 'canal.html', 'caso=cheio', vp.w, vp.h, tema, 'article.vc:has-text("sem impressão no período")') } catch { mockZero = null }
        await ladoALado(browser, zeroPng, mockZero, `S5: "0" na caixa vazada + "sem impressão no período", ${sufixo}`, tema, `s5-cartao-zero-e-frase-${sufixo}.png`)

        // a lista: vídeo novo e zero na caixa vazada
        await ir(page, urlCanal('?ver=lista'), esperaCanal)
        const lista = await telaComTrilha(page, S)
        await ladoALado(browser, lista, await mockShot(browser, 'canal.html', 'caso=cheio', vp.w, vp.h, tema, '#screen'), `canal, lista, ${sufixo}`, tema, `lista-canal-inteiro-${sufixo}.png`)
        const linhaNova = page.locator(`${S}:visible tr, ${S}:visible li`).filter({ hasText: 'vídeo novo' }).first()
        medida(`${sufixo} lista, linha do vídeo novo: "${((await linhaNova.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 200)}"`)
        medida(`${sufixo} lista: ${await page.locator(`${S}:visible .obs-ch-zero`).count()} caixas vazadas, ${await page.locator(`${S}:visible .obs-ch-nm`, { hasText: 'vídeo novo' }).count()} pastilhas "vídeo novo"`)
      } finally { await ctx.close() }
    })
  }

  // O vídeo "há 2 dias" da semente foi publicado há 2 d 20 h, mas em DIA DO PACÍFICO são 3 dias (21/10 contra 24/10): para a regra ("menos de 3 dias de vida") ele NÃO é novo. Aqui:
  // (1) o estado da semente, medido e capturado como está; (2) o mesmo vídeo com a publicação a 47 h (2 dias exatos no Pacífico): "vídeo novo" na página, no cartão, na lista e na régua.
  for (const tema of TEMAS) for (const vp of VPS) {
    test(`F ${vp.w} px ${NOME_TEMA[tema]}: vídeo "há 2 dias" da semente (3 dias no Pacífico) na página e no cartão`, async ({ browser }) => {
      test.setTimeout(240_000)
      const { ctx, page } = await contexto(browser, vp.w, vp.h, tema)
      const sufixo = `${vp.w}-${NOME_TEMA[tema]}`
      try {
        await ir(page, urlCanal(), esperaCanal)
        const card = page.locator(`${S}:visible ul.cv-grid > li`).filter({ has: page.locator(`a[id="cv-lnk-${vid[RET.novo]}"]`) }).first()
        await card.scrollIntoViewIfNeeded()
        medida(`${sufixo} cartão do vídeo "há 2 dias" da semente: "${(await card.innerText()).replace(/\s+/g, ' ').slice(0, 220)}"`)
        await ir(page, urlVideo(RET.novo), esperaVideo)
        const t = (await page.locator(`${V}:visible section[aria-labelledby="vb-imp-h"]`).innerText()).replace(/\s+/g, ' ')
        medida(`${sufixo} página do vídeo "há 2 dias" da semente, impressões: ${t.slice(0, 200)}`)
        expect(t, 'a semente tem 3 dias no Pacífico: um dia medido, zero').toMatch(/Nenhuma impressão em 1 dia/)
        const video = await telaComTrilha(page, V)
        await ladoALado(browser, video, await mockShot(browser, 'video.html', 'caso=novo', vp.w, vp.h, tema, '#screen'), `vídeo da semente "há 2 dias" (3 dias no Pacífico), ${sufixo}`, tema, `video-ha-2-dias-3-no-pacifico-${sufixo}.png`)
      } finally { await ctx.close() }
    })
  }

  test('vídeo de 2 dias EXATOS no Pacífico (publicação a 47 h): "vídeo novo" no cartão, na lista, na página e na régua (captura 1440 e 390, claro e escuro)', async ({ browser }) => {
    test.setTimeout(480_000)
    const sb = localServiceClient()
    const antes = await sb.from('youtube_videos').select('published_at').eq('id', vid[RET.novo]!).eq('site_id', siteId).single()
    const original = String(antes.data?.published_at)
    try {
      const up = await sb.from('youtube_videos').update({ published_at: new Date(ORACLE_NOW - 47 * 3600 * 1000).toISOString() }).eq('id', vid[RET.novo]!).eq('site_id', siteId)
      if (up.error) throw new Error(up.error.message)
      for (const vp of VPS) for (const tema of TEMAS) {
        const { ctx, page } = await contexto(browser, vp.w, vp.h, tema)
        const sufixo = `${vp.w}-${NOME_TEMA[tema]}`
        try {
          await ir(page, urlCanal(), esperaCanal)
          const card = page.locator(`${S}:visible ul.cv-grid > li`).filter({ has: page.locator(`a[id="cv-lnk-${vid[RET.novo]}"]`) }).first()
          await card.scrollIntoViewIfNeeded()
          const tc = (await card.innerText()).replace(/\s+/g, ' ')
          medida(`${sufixo} 2 dias exatos, cartão: "${tc.slice(0, 200)}"`)
          expect(tc).toContain('vídeo novo')
          expect(tc, 'nem "0" nem "sem impressão no período"').not.toMatch(/sem impressão no período|zero medido/)
          const grade = await telaComTrilha(page, S)
          await ladoALado(browser, grade, await mockShot(browser, 'canal.html', 'caso=cheio', vp.w, vp.h, tema, '#screen'), `canal, grade com o vídeo de 2 dias exatos, ${sufixo}`, tema, `grade-com-video-de-2-dias-${sufixo}.png`)
          await ir(page, urlCanal('?ver=lista'), esperaCanal)
          const lista = page.locator(`${S}:visible tbody tr`).filter({ hasText: 'vídeo novo' })
          medida(`${sufixo} 2 dias exatos, lista: ${await lista.count()} linhas com "vídeo novo"`)
          await ir(page, urlVideo(RET.novo), esperaVideo)
          const t = (await page.locator(`${V}:visible section[aria-labelledby="vb-imp-h"]`).innerText()).replace(/\s+/g, ' ')
          medida(`${sufixo} 2 dias exatos, página, impressões: ${t.slice(0, 220)}`)
          expect(t).toMatch(/Vídeo novo/)
          const regua = await page.locator(`${V}:visible tr[data-numero="impressoes"]`).first().innerText()
          medida(`${sufixo} 2 dias exatos, régua: ${regua.replace(/\s+/g, ' ').slice(0, 220)}`)
          expect(regua).toMatch(/vídeo novo/i)
          const video = await telaComTrilha(page, V)
          await ladoALado(browser, video, await mockShot(browser, 'video.html', 'caso=novo', vp.w, vp.h, tema, '#screen'), `vídeo de 2 dias exatos, ${sufixo}`, tema, `video-2-dias-${sufixo}.png`)
        } finally { await ctx.close() }
      }
    } finally { await sb.from('youtube_videos').update({ published_at: original }).eq('id', vid[RET.novo]!).eq('site_id', siteId) }
  })

  test('vídeo de 17 horas SEM linha: seção e régua dizem "vídeo novo" (captura 1440 e 390, claro e escuro)', async ({ browser }) => {
    test.setTimeout(420_000)
    const sb = localServiceClient()
    const antes = await sb.from('youtube_videos').select('published_at').eq('id', vid[RET.novo]!).eq('site_id', siteId).single()
    const original = String(antes.data?.published_at)
    try {
      const up = await sb.from('youtube_videos').update({ published_at: new Date(ORACLE_NOW - 17 * 3600 * 1000).toISOString() }).eq('id', vid[RET.novo]!).eq('site_id', siteId)
      if (up.error) throw new Error(up.error.message)
      for (const vp of VPS) for (const tema of TEMAS) {
        const { ctx, page } = await contexto(browser, vp.w, vp.h, tema)
        try {
          await ir(page, urlVideo(RET.novo), esperaVideo)
          const t = (await page.locator(`${V}:visible section[aria-labelledby="vb-imp-h"]`).innerText()).replace(/\s+/g, ' ')
          medida(`${vp.w}-${NOME_TEMA[tema]} 17 h sem linha, impressões: ${t.slice(0, 220)}`)
          expect(t).toMatch(/Vídeo novo/)
          const video = await telaComTrilha(page, V)
          await ladoALado(browser, video, await mockShot(browser, 'video.html', 'caso=novo', vp.w, vp.h, tema, '#screen'), `vídeo de 17 h sem linha, ${vp.w}-${NOME_TEMA[tema]}`, tema, `video-17h-sem-linha-${vp.w}-${NOME_TEMA[tema]}.png`)
        } finally { await ctx.close() }
      }
    } finally { await sb.from('youtube_videos').update({ published_at: original }).eq('id', vid[RET.novo]!).eq('site_id', siteId) }
  })

  // a borda direita a 390: a captura anterior mostrava o botão "Abrir no YouTube" cortado; é a captura ou a tela?
  for (const tema of TEMAS) {
    test(`borda direita a 390 px ${NOME_TEMA[tema]}: scrollWidth × clientWidth, retângulo do botão "Abrir no YouTube" e largura da captura`, async ({ browser }) => {
      test.setTimeout(240_000)
      const { ctx, page } = await contexto(browser, 390, 844, tema)
      try {
        for (const [nome, url, espera, tela] of [['canal', urlCanal('?painel=1'), esperaCanal, S], ['vídeo', urlVideo(RET.volumeAlto), esperaVideo, V]] as const) {
          await ir(page, url, espera)
          const r = await page.evaluate((sel: string) => {
            const tela = document.querySelector<HTMLElement>(sel)!
            const raiz = tela.closest<HTMLElement>('.obs-ch-root')!
            const rolantes: Array<{ el: string; sw: number; cw: number; ox: string }> = []
            for (let e: HTMLElement | null = tela; e; e = e.parentElement) {
              const cs = getComputedStyle(e)
              if (e.scrollWidth > e.clientWidth + 0.5 || /(auto|scroll|hidden|clip)/.test(cs.overflowX)) rolantes.push({ el: e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''), sw: e.scrollWidth, cw: e.clientWidth, ox: cs.overflowX })
            }
            const botao = [...document.querySelectorAll<HTMLElement>('a, button')].filter(e => /Abrir no YouTube/.test(e.textContent ?? '') && e.getBoundingClientRect().width > 0)
            const rects = botao.map(b => { const x = b.getBoundingClientRect(); return { esq: Math.round(x.left * 10) / 10, dir: Math.round(x.right * 10) / 10, w: Math.round(x.width * 10) / 10, texto: (b.textContent ?? '').trim().slice(0, 30), dentroDaRaiz: x.right <= raiz.getBoundingClientRect().right + 0.5 } })
            const rr = raiz.getBoundingClientRect(), tr = tela.getBoundingClientRect()
            return {
              janela: innerWidth, docSW: document.documentElement.scrollWidth, docCW: document.documentElement.clientWidth, bodySW: document.body.scrollWidth,
              raiz: { esq: Math.round(rr.left), dir: Math.round(rr.right), w: Math.round(rr.width) }, tela: { esq: Math.round(tr.left), dir: Math.round(tr.right), w: Math.round(tr.width), sw: tela.scrollWidth, cw: tela.clientWidth },
              rolantes, botoes: rects,
              maisLargo: [...tela.querySelectorAll<HTMLElement>('*')].filter(e => e.getBoundingClientRect().right > rr.right + 0.5 && e.getBoundingClientRect().width > 0 && getComputedStyle(e).position !== 'fixed').slice(0, 6).map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + '→' + Math.round(e.getBoundingClientRect().right)),
            }
          }, tela)
          medida(`${NOME_TEMA[tema]} ${nome} 390: ${JSON.stringify(r)}`)
          const png = await telaComTrilha(page, tela)
          medida(`${NOME_TEMA[tema]} ${nome} 390: captura ${larguraPng(png)}x${alturaPng(png)} px (dpr 1); raiz ${r.raiz.w} px de largura`)
          expect.soft(r.docSW, `${nome}: o documento não rola para o lado`).toBeLessThanOrEqual(r.docCW)
          expect.soft(r.tela.sw, `${nome}: a tela não tem conteúdo além da própria largura`).toBeLessThanOrEqual(r.tela.cw + 1)
          for (const b of r.botoes) expect.soft(b.dir, `${nome}: "${b.texto}" termina dentro da janela`).toBeLessThanOrEqual(r.janela)
          expect.soft(larguraPng(png), `${nome}: a captura tem a largura da raiz`).toBe(r.raiz.w)
          // o botão inteiro cabe na captura (a captura é da raiz): se a largura da captura é a da raiz e o botão termina dentro da raiz, o corte visto antes era da captura lado a lado
          for (const b of r.botoes) expect.soft(b.dentroDaRaiz, `${nome}: o botão cabe na raiz capturada`).toBe(true)
        }
      } finally { await ctx.close() }
    })
  }

  // S3: o anel de foco do h1 do vídeo aberto por CLIQUE de mouse (navegação do cliente, a partir da grade) e, para comparar, por teclado
  for (const tema of TEMAS) {
    test(`S3 anel de foco do h1 do vídeo aberto por clique do mouse, tema ${NOME_TEMA[tema]} (1440)`, async ({ browser }) => {
      test.setTimeout(240_000)
      const { ctx, page } = await contexto(browser, 1440, 900, tema)
      try {
        const ler = (): Promise<{ ativo: string; focusVisible: boolean; outline: string; offset: string; anel: string | null }> => page.evaluate(() => {
          const h = document.querySelector<HTMLElement>('[data-obs-screen="video-proprio"] h1')!
          const a = document.activeElement as HTMLElement | null
          const cs = getComputedStyle(h)
          const r = h.getBoundingClientRect()
          return { ativo: a ? a.tagName.toLowerCase() + (a === h ? '(h1)' : '') : 'nenhum', focusVisible: h.matches(':focus-visible'), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, offset: cs.outlineOffset, anel: a === h ? `${Math.round(r.width)}x${Math.round(r.height)}` : null }
        })
        // 1. clique de mouse no cartão da grade (navegação do cliente)
        await ir(page, urlCanal(), esperaCanal)
        const link = page.locator(`${S}:visible ul.cv-grid a[href*="${vid[RET.volumeAlto]}"]`).first()
        await link.scrollIntoViewIfNeeded()
        const box = (await link.boundingBox())!
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
        await page.locator(esperaVideo).first().waitFor({ timeout: 60_000 })
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(400)
        const mouse = await ler()
        medida(`${NOME_TEMA[tema]} CLIQUE de mouse na grade: ${JSON.stringify(mouse)}`)
        await page.screenshot({ path: path.join((fs.mkdirSync(SHOTS, { recursive: true }), SHOTS), `s3-h1-clique-mouse-${NOME_TEMA[tema]}.png`), clip: { x: 0, y: 0, width: 1440, height: 260 } })
        // 2. o mesmo por teclado (Enter no cartão), para comparar
        await ir(page, urlCanal(), esperaCanal)
        const link2 = page.locator(`${S}:visible ul.cv-grid a[href*="${vid[RET.volumeAlto]}"]`).first()
        await link2.scrollIntoViewIfNeeded()
        await link2.focus()
        await page.keyboard.press('Enter')
        await page.locator(esperaVideo).first().waitFor({ timeout: 60_000 })
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(400)
        const teclado = await ler()
        medida(`${NOME_TEMA[tema]} TECLADO (Enter no cartão): ${JSON.stringify(teclado)}`)
        await page.screenshot({ path: path.join(SHOTS, `s3-h1-teclado-${NOME_TEMA[tema]}.png`), clip: { x: 0, y: 0, width: 1440, height: 260 } })
        // o fato medido (não é uma regra): o relatório diz se o anel aparece com o mouse
        expect(mouse.ativo, 'o h1 recebe o foco ao abrir').toBe('h1(h1)')
      } finally { await ctx.close() }
    })
  }
})

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// Perfil `recente` (relatórios até HOJE): o gráfico do canal com D e D-1 hachurados, e o vídeo de 17 h COM linha de alcance
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
test.describe('fecho A4 (2ª passada): perfil recente (D e D-1, vídeo de 17 h com linha)', () => {
  let siteId = '', own = '', ytB = ''
  const vid: Record<string, string> = {}
  test.beforeAll(async () => {
    test.setTimeout(240_000)
    siteId = await ensureSeeded({ ownPreset: '2', ownL2: 'recente' })
    own = seedIdsOf(siteId).own('tnfigueiredo')
    const sb = localServiceClient()
    const r = await sb.from('youtube_videos').select('id, youtube_video_id').eq('site_id', siteId).eq('channel_id', own)
    for (const x of r.data ?? []) vid[String(x.youtube_video_id)] = String(x.id)
    const reach = await sb.from('yt_own_video_reach_daily').select('youtube_video_id, day_pt').eq('site_id', siteId).eq('channel_id', own).eq('day_pt', somaDias(HOJE, -1))
    ytB = String(reach.data?.[0]?.youtube_video_id)
  })
  test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

  for (const vp of VPS) for (const tema of TEMAS) {
    test(`F ${vp.w} px ${NOME_TEMA[tema]}: gráfico do canal com D e D-1 hachurados (sem a linha de D-1) e com a linha de D-1`, async ({ browser }) => {
      test.setTimeout(420_000)
      const sb = localServiceClient()
      const sufixo = `${vp.w}-${NOME_TEMA[tema]}`
      const { ctx, page } = await contexto(browser, vp.w, vp.h, tema)
      const dia1 = somaDias(HOJE, -1)
      const guardada = await sb.from('yt_own_video_reach_daily').select('*').eq('site_id', siteId).eq('youtube_video_id', ytB).eq('day_pt', dia1)
      try {
        // com a linha de D-1 (como a semente): D hachurado, D-1 com valor
        await ir(page, `${ROTA}/canal/${own}?painel=1`, `${S} .chead h1`)
        const fig = page.locator(`${S}:visible figure.ic`).filter({ has: page.locator('.ic-t', { hasText: 'Impressões por dia do canal' }) }).first()
        await fig.scrollIntoViewIfNeeded()
        const a = await fig.screenshot()
        await ladoALado(browser, a, await mockShot(browser, 'canal.html', 'caso=cheio', vp.w, vp.h, tema, '#screen'), `gráfico do canal, D hachurado e D-1 com valor, ${sufixo}`, tema, `grafico-canal-d-hachurado-${sufixo}.png`)
        // sem a linha de D-1 (o relatório de D-1 foi lido e não trouxe linha nenhuma): D e D-1 hachurados
        const del = await sb.from('yt_own_video_reach_daily').delete().eq('site_id', siteId).eq('youtube_video_id', ytB).eq('day_pt', dia1)
        if (del.error) throw new Error(del.error.message)
        await ir(page, `${ROTA}/canal/${own}?painel=1`, `${S} .chead h1`)
        const fig2 = page.locator(`${S}:visible figure.ic`).filter({ has: page.locator('.ic-t', { hasText: 'Impressões por dia do canal' }) }).first()
        await fig2.scrollIntoViewIfNeeded()
        const rows = await fig2.evaluate(el => [...el.querySelectorAll('tbody tr[data-situacao]')].slice(-4).map(tr => `${(tr.querySelector('th')?.textContent ?? '').trim()}=${tr.getAttribute('data-situacao')}`))
        medida(`${sufixo} sem a linha de D-1, últimos 4 dias: ${rows.join(' ')}`)
        expect(rows.slice(-2).every(x => /nao-medido/.test(x)), 'D e D-1 hachurados').toBe(true)
        const b = await fig2.screenshot()
        await ladoALado(browser, b, await mockShot(browser, 'canal.html', 'caso=cheio', vp.w, vp.h, tema, '#screen'), `gráfico do canal, D e D-1 hachurados, ${sufixo}`, tema, `grafico-canal-d-e-d1-hachurados-${sufixo}.png`)
        const inteiro = await telaComTrilha(page, S)
        await ladoALado(browser, inteiro, await mockShot(browser, 'canal.html', 'caso=cheio', vp.w, vp.h, tema, '#screen'), `canal inteiro, D e D-1 hachurados, ${sufixo}`, tema, `canal-d-e-d1-hachurados-${sufixo}.png`)
      } finally {
        await ctx.close()
        const ja = await sb.from('yt_own_video_reach_daily').select('youtube_video_id').eq('site_id', siteId).eq('youtube_video_id', ytB).eq('day_pt', dia1)
        if ((ja.data ?? []).length === 0 && guardada.data?.length) await sb.from('yt_own_video_reach_daily').insert(guardada.data)
      }
    })
  }

  test('vídeo de 17 horas COM linha de alcance (a de D-1): o número aparece e nenhuma frase o nega (captura 1440 e 390, claro e escuro)', async ({ browser }) => {
    test.setTimeout(420_000)
    const sb = localServiceClient()
    const antes = await sb.from('youtube_videos').select('published_at').eq('id', vid[ytB]!).eq('site_id', siteId).single()
    const original = String(antes.data?.published_at)
    try {
      const up = await sb.from('youtube_videos').update({ published_at: new Date(ORACLE_NOW - 17 * 3600 * 1000).toISOString() }).eq('id', vid[ytB]!).eq('site_id', siteId)
      if (up.error) throw new Error(up.error.message)
      for (const vp of VPS) for (const tema of TEMAS) {
        const { ctx, page } = await contexto(browser, vp.w, vp.h, tema)
        try {
          await ir(page, `${ROTA}/video/${vid[ytB]}?from=canais&canal=${own}`, `${V} h1:visible`)
          const t = (await page.locator(`${V}:visible section[aria-labelledby="vb-imp-h"]`).innerText()).replace(/\s+/g, ' ')
          medida(`${vp.w}-${NOME_TEMA[tema]} 17 h COM linha, impressões: ${t.slice(0, 240)}`)
          expect(t, 'a seção não nega o dado que existe').not.toMatch(/ainda não há dia/)
          const regua = (await page.locator(`${V}:visible tr[data-numero="impressoes"]`).first().innerText()).replace(/\s+/g, ' ').trim()
          medida(`${vp.w}-${NOME_TEMA[tema]} 17 h COM linha, régua: ${regua}`)
          expect(regua, 'a régua mostra o número').toMatch(/77/)
          const video = await telaComTrilha(page, V)
          await ladoALado(browser, video, await mockShot(browser, 'video.html', 'caso=novo', vp.w, vp.h, tema, '#screen'), `vídeo de 17 h com linha, ${vp.w}-${NOME_TEMA[tema]}`, tema, `video-17h-com-linha-${vp.w}-${NOME_TEMA[tema]}.png`)
        } finally { await ctx.close() }
      }
    } finally { await sb.from('youtube_videos').update({ published_at: original }).eq('id', vid[ytB]!).eq('site_id', siteId) }
  })
})
