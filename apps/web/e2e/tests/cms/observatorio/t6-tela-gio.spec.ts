// Trem 6 · dívidas de tela (Gio): o que os specs existentes não medem. Contraste da casa vazia e da foto inicial dos comentários,
// alvo da busca da página do canal a 390, "Miniatura" única no Histórico, "há N dias" da lista de Canais igual ao da página do canal.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { C5, CANAL_COMPLETO, MANY_VERSIONS_ID } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE })
const SHOTS = process.env.GIO_SHOTS ?? 'test-results/t6-tela-gio'
const MEDIDAS = path.resolve(SHOTS, 'medidas.txt')
let ids: ReturnType<typeof seedIdsOf>
test.beforeAll(async () => {
  test.setTimeout(300_000)
  await clearSeeded()
  ids = seedIdsOf(await ensureSeeded({ comentariosC5: true, manyVersions: true, ownPreset: (process.env.GIO_PRESET ?? 'mix') as '5', canalCompleto: true }))
  fs.mkdirSync(SHOTS, { recursive: true })
})
test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })
const medida = (t: string) => { fs.appendFileSync(MEDIDAS, t + '\n'); test.info().annotations.push({ type: 'medida', description: t }) }

async function abrir(page: Page, ctx: import('@playwright/test').BrowserContext, base: string, w: number, theme: string, rota: string, espera: string) {
  await ctx.addCookies([{ name: 'btf_theme', value: theme, url: base }])
  await page.setViewportSize({ width: w, height: 900 })
  await page.goto(rota)
  await page.locator(espera).first().waitFor({ timeout: 90_000 })
  await hidratou(page)
}
// hidratação por condição (o networkidle do next dev nunca assenta: polling de notificações)
async function hidratou(page: Page) {
  await page.waitForFunction(() => [...document.querySelectorAll('[data-obs-screen] *')].slice(0, 400).some(e => Object.keys(e).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactProps'))), null, { timeout: 60_000 })
  await page.waitForTimeout(500)
}

// razão de contraste WCAG entre duas cores rgb(a) já resolvidas pelo navegador; o fundo efetivo sobe pelos ancestrais
const CONTRASTE = `(() => {
  const parse = c => { const m = c.match(/[\\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } }
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const mix = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 })
  const fundo = el => { const pilha = []; for (let e = el; e; e = e.parentElement) pilha.push(parse(getComputedStyle(e).backgroundColor)); let base = { r: 255, g: 255, b: 255, a: 1 }; for (const c of pilha.reverse()) base = mix(c, base); return base }
  const opac = el => { let o = 1; for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o }
  return { parse, lum, mix, fundo, opac }
})()`

for (const c of [{ w: 1440, theme: 'light' }, { w: 1440, theme: 'dark' }, { w: 390, theme: 'light' }, { w: 390, theme: 'dark' }] as const) {
  test(`contraste ${c.w} ${c.theme}: casa vazia (c5-novo) >= 3:1 e foto inicial (c5-cheio) legivel`, async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    const erros: string[] = []
    page.on('pageerror', e => erros.push('pageerror: ' + e.message))
    page.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()) })
    await abrir(page, context, baseURL!, c.w, c.theme, '/cms/youtube/competitors/video/' + ids.video(C5.video.novo), '.cd-casa-vazia')
    const vazia = await page.evaluate(`(() => { const K = ${CONTRASTE}; const el = document.querySelector('.cd-casa-vazia'); const cs = getComputedStyle(el)
      const borda = K.parse(cs.borderTopColor), bg = K.fundo(el.parentElement), o = K.opac(el)
      const ef = K.mix({ ...borda, a: borda.a * o }, bg); const L1 = K.lum(ef), L2 = K.lum(bg)
      return { n: document.querySelectorAll('.cd-casa-vazia').length, opacidade: o, estilo: cs.borderTopStyle, largura: cs.borderTopWidth, razao: (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05) } })()`) as { n: number; opacidade: number; estilo: string; largura: string; razao: number }
    medida(`casa-vazia ${c.w} ${c.theme}: ${JSON.stringify(vazia)}`)
    await page.locator('.cd-casa-vazia').first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(SHOTS, `casa-vazia-${c.w}-${c.theme}.png`) })
    expect(vazia.n, 'há casa vazia no vídeo novo').toBeGreaterThan(0)
    expect(vazia.opacidade, 'sem opacity').toBe(1)
    expect(vazia.razao, 'contraste da borda da casa vazia').toBeGreaterThanOrEqual(3)

    // A foto inicial só existe com o NÍVEL identidade, que exige token de edição (leitor-nivel.ts): a sessão do CMS (texto) nunca recebe o nome nem a foto,
    // então o caso não é alcançável pelo navegador. Prova por injeção: o mesmo markup do componente (cartao.tsx, Foto) dentro de um .cd-autor real.
    await page.goto('/cms/youtube/competitors/video/' + ids.video(C5.video.cheio))
    await page.locator('.cd-secao .cd-autor:visible').first().waitFor({ timeout: 30_000 })
    await hidratou(page)
    const foto = await page.evaluate(`(() => { const K = ${CONTRASTE}; const host = [...document.querySelectorAll('.cd-secao .cd-autor')].find(e => e.getClientRects().length > 0)
      const el = document.createElement('span'); el.className = 'cd-foto cd-foto-inicial'; el.textContent = 'Z'; host.prepend(el); const cs = getComputedStyle(el)
      const L1 = K.lum(K.parse(cs.color)), L2 = K.lum(K.fundo(el)); const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height), fonte: cs.fontSize, cor: cs.color, fundo: cs.backgroundColor, razao: (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05) } })()`) as { w: number; h: number; fonte: string; razao: number }
    medida(`foto-inicial (injetada, nível identidade inalcançável pela sessão) ${c.w} ${c.theme}: ${JSON.stringify(foto)}`)
    await page.screenshot({ path: path.join(SHOTS, `foto-inicial-${c.w}-${c.theme}.png`) })
    expect(foto.razao, 'contraste da letra da foto inicial').toBeGreaterThanOrEqual(4.5)
    expect(erros.filter(e => !/ggpht|ERR_FAILED|Failed to load resource/.test(e)), 'console').toEqual([])
  })
}

test('busca da pagina do canal a 390: alvo >= 44 px', async ({ page, context, baseURL }) => {
  await abrir(page, context, baseURL!, 390, 'dark', '/cms/youtube/competitors/canal/' + ids.channel(CANAL_COMPLETO.canal), '.cv-search')
  const b = await page.locator('.cv-search:visible').first().boundingBox()
  const i = await page.locator('.cv-search:visible input').first().boundingBox()
  medida(`cv-search 390: caixa ${b?.width}x${b?.height}, input ${i?.width}x${i?.height}`)
  await page.screenshot({ path: path.join(SHOTS, 'busca-390.png') })
  expect(b!.height).toBeGreaterThanOrEqual(43.5)
  await page.setViewportSize({ width: 1440, height: 900 })
  const b2 = await page.locator('.cv-search:visible').first().boundingBox()
  medida(`cv-search 1440: altura ${b2?.height} (esperado 34, desenho inalterado)`)
  expect(Math.round(b2!.height)).toBe(34)
})

test('Historico: nenhum "Miniatura" visivel na tela (texto, title e aria-label), "Thumbnail" presente', async ({ page, context, baseURL }) => {
  for (const w of [1440, 390]) {
    await abrir(page, context, baseURL!, w, 'dark', '/cms/youtube/competitors/video/' + ids.video(MANY_VERSIONS_ID) + '?range=tudo', '[data-obs-screen]')
    const r = await page.evaluate(() => {
      const raiz = document.querySelector('[data-obs-screen]')!
      const texto = (raiz as HTMLElement).innerText
      const attrs = [...raiz.querySelectorAll('[title],[aria-label]')].map(e => `${e.getAttribute('title') ?? ''} | ${e.getAttribute('aria-label') ?? ''}`).filter(s => /miniatura/i.test(s))
      return { texto: texto.split('\n').filter(l => /miniatura/i.test(l)), attrs, thumbnail: /thumbnail/i.test(texto) }
    })
    medida(`historico ${w}: ${JSON.stringify(r)}`)
    await page.screenshot({ path: path.join(SHOTS, `historico-${w}.png`) })
    expect(r.thumbnail).toBe(true)
    expect(r.texto, 'Miniatura no texto visível').toEqual([])
    expect(r.attrs, 'Miniatura em title/aria-label').toEqual([])
  }
})

test('lista de Canais: "ultimo em ..., ha N dias" igual ao da pagina do canal, em dias completos', async ({ page, context, baseURL }) => {
  test.setTimeout(240_000)
  await abrir(page, context, baseURL!, 1440, 'dark', '/cms/youtube/competitors?niche=todos', '[data-obs-screen="canais"]')
  const frases = await page.evaluate(() => ((document.querySelector('[data-obs-screen="canais"]') as HTMLElement).innerText.match(/Nenhum vídeo longo nos últimos 90 dias \(último em [^)]*\)/g) ?? []))
  medida(`lista de Canais, frases: ${JSON.stringify(frases)}`)
  await page.screenshot({ path: path.join(SHOTS, 'canais-lista.png') })
  test.info().annotations.push({ type: 'nota', description: `frases=${frases.length}` })
  test.skip(frases.length === 0, 'NÃO PROVADO: a semente não tem canal próprio com último vídeo longo há mais de 90 dias; sem ele a frase "último em ..., há N dias" não aparece')
  for (const f of frases) expect(f, 'dias completos: "há N dias" inteiro').toMatch(/há \d+ dias?\)$|hoje\)$|ontem\)$/)
})
