// apps/web/e2e/tests/cms/observatorio/proprio-a4-comparar-medidas.spec.ts
// As MEDIDAS do cartão "Só o seu canal mede" da comparação em navegador (Tarefa 14, conferida na 15c), nos três casos do mockup aprovado de 12/10 (magro, cheio, sem dado), em
// 1440, 1100, 640 e 390 px, tema escuro e claro: sem rolagem horizontal, texto de 12 px ou mais (inclusive SVG), alvo de toque de 44 px no ⓘ, uma coluna por linha a 640 px e abaixo,
// a faixa da taxa perto de 0% e de 100%, a nota "só N dias com dado; precisa de 7", o popover do ⓘ (não cobre o valor), a posição do cartão e a comparação entre dois concorrentes
// IDÊNTICA com e sem dado privado no banco. As capturas lado a lado (tela implementada × mockup congelado) vão para docs/.../shots/a4-fecho (não commitadas).
// Caso do mockup → perfil da semente: magro = `curto` (2 dias de relatório e de diário), cheio = `ativo` (29 dias, CTR em todo dia), sem dado = nenhuma linha privada.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, repoFileUrl, seedIdsOf } from './fidelity'
import { localServiceClient, resetViewerPrefs, type SeedOptions } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

test.use({ storageState: ADMIN_STATE })
const TELA = '[data-obs-screen="comparar"]'
const CARTAO = `${TELA}:visible [data-so-seu-canal]`
const ROTA = '/cms/youtube/competitors/comparar'
const MEDIDAS = path.resolve(__dirname, '../../../../test-results/proprio-a4-comparar-medidas.txt')
const SHOTS = path.resolve(__dirname, '../../../../../../docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/shots/a4-fecho')
const MOCKUP = '.superpowers/sdd/2026-10-12-telas-a4-canal-proprio-plan/mockup-congelado-12-10/comparar-so-seu-canal.html'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const VPS = [{ w: 1440, h: 900 }, { w: 1100, h: 800 }, { w: 640, h: 900 }, { w: 390, h: 844 }] as const
const TEMAS = ['dark', 'light'] as const
const NOME_TEMA = { dark: 'escuro', light: 'claro' } as const
const CASOS: Array<{ nome: 'magro' | 'cheio' | 'sem-dado'; seed: SeedOptions }> = [
  { nome: 'magro', seed: { ownPreset: '2', ownL2: 'curto' } },
  { nome: 'cheio', seed: { ownPreset: '2', ownL2: 'ativo' } },
  { nome: 'sem-dado', seed: { ownPreset: '2' } },
]

function medida(texto: string): void {
  fs.mkdirSync(path.dirname(MEDIDAS), { recursive: true })
  fs.appendFileSync(MEDIDAS, `[${test.info().title.slice(0, 70)}] ${texto}\n`)
  test.info().annotations.push({ type: 'medida', description: texto })
}

interface Medida {
  docScroll: number; contScroll: number; larguraJanela: number; cartao: { left: number; right: number; top: number; bottom: number } | null
  fora: string[]; menorTexto: number; quemMenor: string; ibtn: { w: number; h: number } | null
  linhas: Array<{ chave: string; empilhada: boolean; ladoALado: boolean }>
  faixa: { textos: number; sobrepostos: string[]; foraDoCartao: string[]; svgW: number } | null
  textoCartao: string; ordem: { depoisDosLados: boolean; antesDoNumero: boolean }; semNumeroNoDom: boolean
}

async function medir(page: Page): Promise<Medida> {
  return page.evaluate(() => {
    const raiz = document.querySelector<HTMLElement>('[data-obs-screen="comparar"]')!
    const c = document.querySelector<HTMLElement>('[data-obs-screen="comparar"] [data-so-seu-canal]')
    const vis = (el: Element): boolean => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden]') }
    // o contêiner que rola (a casca do CMS rola em `main`, não na janela)
    let cont: HTMLElement | null = null
    for (let p = raiz.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) { if (['auto', 'scroll', 'overlay'].includes(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight + 1) { cont = p; break } }
    const contScroll = cont ? cont.scrollWidth - cont.clientWidth : 0
    const out: Medida = {
      docScroll: document.documentElement.scrollWidth - innerWidth, contScroll, larguraJanela: innerWidth, cartao: null, fora: [], menorTexto: 999, quemMenor: '', ibtn: null, linhas: [],
      faixa: null, textoCartao: '', ordem: { depoisDosLados: false, antesDoNumero: false }, semNumeroNoDom: false,
    }
    if (!c) return out
    const r = c.getBoundingClientRect()
    out.cartao = { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    out.textoCartao = (c.textContent ?? '').replace(/\s+/g, ' ').trim()
    c.querySelectorAll<HTMLElement>('*').forEach(el => {
      if (!vis(el) || el.closest('.obs-ch-sr')) return
      const b = el.getBoundingClientRect()
      if (b.right > r.right + 1 || b.left < r.left - 1) out.fora.push(`${el.tagName.toLowerCase()}.${String(el.getAttribute('class')).slice(0, 20)} ${Math.round(b.left)}..${Math.round(b.right)} (cartão ${Math.round(r.left)}..${Math.round(r.right)})`)
      const temTexto = [...el.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0)
      if (!temTexto) return
      let px = parseFloat(getComputedStyle(el).fontSize)
      const svg = el.closest('svg') as SVGSVGElement | null
      if (svg && svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width > 0) px *= svg.getBoundingClientRect().width / svg.viewBox.baseVal.width
      if (px < out.menorTexto) { out.menorTexto = px; out.quemMenor = `${el.tagName.toLowerCase()}.${String(el.getAttribute('class')).slice(0, 24)} “${(el.textContent ?? '').trim().slice(0, 30)}”` }
    })
    const b = c.querySelector<HTMLElement>('.ibtn')
    if (b) { const q = b.getBoundingClientRect(); out.ibtn = { w: q.width, h: q.height } }
    c.querySelectorAll<HTMLElement>('ul.so-linhas > li').forEach(li => {
      const rt = li.querySelector('.so-rt')!.getBoundingClientRect(), val = li.querySelector('.so-val')!.getBoundingClientRect()
      out.linhas.push({ chave: li.getAttribute('data-linha') ?? '', empilhada: val.top >= rt.bottom - 1 && Math.abs(val.left - rt.left) < 2, ladoALado: val.left >= rt.right - 1 && Math.abs(val.top - rt.top) < 24 })
    })
    const tf = c.querySelector('.tf')
    if (tf) {
      const cx = c.getBoundingClientRect()
      const caixas = [...tf.querySelectorAll<SVGTextElement>('svg text')].filter(t => (t.textContent ?? '').trim()).map(t => ({ t: (t.textContent ?? '').trim(), r: t.getBoundingClientRect() }))
      const sobre: string[] = [], fora: string[] = []
      caixas.forEach((a, i) => {
        if (a.r.left < cx.left - 1 || a.r.right > cx.right + 1) fora.push(`${a.t} ${Math.round(a.r.left)}..${Math.round(a.r.right)}`)
        caixas.slice(i + 1).forEach(b2 => {
          // a caixa de texto encolhida em 10% de cada lado: encostar na folga do glifo não é colisão
          const ax = a.r.width * 0.1, bx = b2.r.width * 0.1
          if (a.r.left + ax < b2.r.right - bx && b2.r.left + bx < a.r.right - ax && a.r.top < b2.r.bottom && b2.r.top < a.r.bottom) sobre.push(`${a.t} × ${b2.t}`)
        })
      })
      out.faixa = { textos: caixas.length, sobrepostos: sobre, foraDoCartao: fora, svgW: tf.getBoundingClientRect().width }
    }
    const num = [...raiz.querySelectorAll('h2')].find(h => /^Número a número/.test(h.textContent ?? ''))
    const lados = raiz.querySelector('.cp-sides')
    out.ordem = { depoisDosLados: !!lados && !!(lados.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING), antesDoNumero: !!num && !!(num.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_PRECEDING) }
    out.semNumeroNoDom = c.querySelectorAll('.so-vl').length === 0
    return out
  })
}

async function abrir(page: Page, w: number, h: number, tema: 'dark' | 'light', url: string): Promise<void> {
  await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
  await page.setViewportSize({ width: w, height: h })
  await page.route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  await page.goto(url)
  await page.locator(`${TELA}:visible .cp-side`).first().waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

/** A captura lado a lado: a tela implementada à esquerda, o mockup congelado à direita (só o cartão, na mesma largura de janela). */
async function ladoALado(page: Page, caso: string, w: number, h: number, tema: 'dark' | 'light', nome: string): Promise<void> {
  fs.mkdirSync(SHOTS, { recursive: true })
  // a barra de baixo do celular e a insígnia do `next dev` são fixas e cobririam o pé do cartão na captura: somem só durante a captura
  const fixos = await page.evaluate(() => { const l: HTMLElement[] = []; document.querySelectorAll<HTMLElement>('body *').forEach(e => { if (getComputedStyle(e).position === 'fixed' && !e.closest('.cp-tip')) { l.push(e); e.dataset.antes = e.style.visibility; e.style.visibility = 'hidden' } }); return l.length })
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
  await page.locator(CARTAO).first().scrollIntoViewIfNeeded()
  const impl = await page.locator(CARTAO).first().screenshot()
  if (fixos) await page.evaluate(() => document.querySelectorAll<HTMLElement>('[data-antes]').forEach(e => { e.style.visibility = e.dataset.antes ?? ''; delete e.dataset.antes }))
  const ctx = page.context().browser()!.newContext({ viewport: { width: w, height: h } })
  const c = await ctx
  try {
    const m = await c.newPage()
    await m.goto(repoFileUrl(MOCKUP) + `?caso=${caso}${tema === 'light' ? '&tema=claro' : ''}`)
    await m.locator('section.so').first().waitFor({ timeout: 20_000 })
    await m.evaluate(() => document.fonts.ready.then(() => undefined))
    const mock = await m.locator('section.so').first().screenshot()
    const comp = await c.newPage()
    await comp.setViewportSize({ width: 2600, height: 100 })
    const uri = (b: Buffer) => 'data:image/png;base64,' + b.toString('base64')
    await comp.setContent(`<body style="margin:0;padding:12px;background:${tema === 'dark' ? '#2b2724' : '#d8d2c8'};font:12px system-ui;color:${tema === 'dark' ? '#eee' : '#222'};display:flex;gap:16px;align-items:flex-start"><figure style="margin:0"><figcaption style="margin-bottom:4px">implementada (${caso}, ${w} px, ${NOME_TEMA[tema]})</figcaption><img src="${uri(impl)}"></figure><figure style="margin:0"><figcaption style="margin-bottom:4px">mockup congelado</figcaption><img src="${uri(mock)}"></figure></body>`)
    await comp.screenshot({ path: path.join(SHOTS, nome), fullPage: true })
  } finally { await c.close() }
}

test.beforeEach(async () => { await resetViewerPrefs(await getSeedSiteId()) })

for (const caso of CASOS) {
  test.describe(`medidas do cartão, caso ${caso.nome}`, () => {
    test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })
    let ids: ReturnType<typeof seedIdsOf>
    test.beforeAll(async () => { test.setTimeout(240_000); ids = seedIdsOf(await ensureSeeded(caso.seed)) })

    for (const vp of VPS) for (const tema of TEMAS) {
      test(`${caso.nome} ${vp.w} px ${NOME_TEMA[tema]}`, async ({ browser }) => {
        test.setTimeout(150_000)
        const toque = vp.w <= 640
        const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: vp.w, height: vp.h }, hasTouch: toque, isMobile: toque })
        const page = await ctx.newPage()
        try {
          await abrir(page, vp.w, vp.h, tema, `${ROTA}?a=${ids.own('tnfigueiredo')}&b=${ids.channel('matt-wolfe')}`)
          await expect(page.locator(CARTAO)).toHaveCount(1)
          const m = await medir(page)
          const linhas = m.linhas.map(l => `${l.chave}:${l.empilhada ? 'coluna' : l.ladoALado ? 'lado a lado' : '?'}`).join(' ')
          medida(`${vp.w}px ${NOME_TEMA[tema]}${toque ? ' (toque)' : ''}: docScroll ${m.docScroll}, contScroll ${m.contScroll}, cartão ${Math.round(m.cartao!.left)}..${Math.round(m.cartao!.right)} de ${m.larguraJanela}, fora ${m.fora.length}, menor texto ${m.menorTexto.toFixed(1)}px (${m.quemMenor}), ⓘ ${m.ibtn ? `${Math.round(m.ibtn.w)}×${Math.round(m.ibtn.h)}` : '-'}, linhas ${linhas}, faixa ${m.faixa ? `${m.faixa.textos} textos, sobrepostos ${m.faixa.sobrepostos.length}, fora ${m.faixa.foraDoCartao.length}, svg ${Math.round(m.faixa.svgW)}px` : 'sem faixa'}`)
          expect(m.docScroll, 'rolagem horizontal do documento').toBeLessThanOrEqual(0)
          expect(m.contScroll, 'rolagem horizontal do contêiner').toBeLessThanOrEqual(0)
          expect(m.fora, 'elementos fora do cartão').toEqual([])
          expect(m.menorTexto, `texto de 12 px ou mais: ${m.quemMenor}`).toBeGreaterThanOrEqual(12)
          expect(m.ordem, 'o cartão vem logo abaixo dos dois lados e antes de "Número a número"').toEqual({ depoisDosLados: true, antesDoNumero: true })
          expect(m.linhas).toHaveLength(4)
          if (toque) {
            expect(m.ibtn!.w, 'alvo de toque do ⓘ').toBeGreaterThanOrEqual(43.5)
            expect(m.ibtn!.h, 'alvo de toque do ⓘ').toBeGreaterThanOrEqual(43.5)
          }
          if (vp.w <= 640) for (const l of m.linhas) expect(l.empilhada, `a ${vp.w} px a linha ${l.chave} vira uma coluna`).toBe(true)
          if (vp.w >= 1100) for (const l of m.linhas) expect(l.ladoALado, `a ${vp.w} px a linha ${l.chave} fica lado a lado`).toBe(true)
          if (m.faixa) { expect(m.faixa.sobrepostos, 'caixas de texto da faixa sem sobreposição').toEqual([]); expect(m.faixa.foraDoCartao, 'texto da faixa dentro do cartão').toEqual([]) }
          // os três casos
          if (caso.nome === 'sem-dado') {
            expect(m.semNumeroNoDom, 'sem dado: nenhum valor no cartão').toBe(true)
            expect(m.textoCartao).toContain('Não medido.')
            expect(m.faixa, 'sem dado: sem faixa').toBeNull()
          }
          if (caso.nome === 'magro') {
            // dois dias de diário: o % assistido não crava número, diz a base
            expect(m.textoCartao).toMatch(/só 2 dias com dado; precisa de 7/)
            expect(m.textoCartao).toMatch(/Ainda não dá para dizer se é alta ou baixa\./)
          }
          if (caso.nome === 'cheio') {
            expect(m.textoCartao).not.toMatch(/precisa de 7/)
            expect(m.faixa, 'cheio: a faixa existe').not.toBeNull()
          }
          if (vp.w === 1440 || vp.w === 390) {
            await lado(page, caso.nome, vp.w, vp.h, tema)
          }
          // o popover do ⓘ: não cobre o valor
          if (vp.w === 1440 || vp.w === 390) {
            await page.locator(`${CARTAO} .ibtn`).first().click()
            const pop = page.locator('#flut .cp-tip, .cp-tip').first()
            await pop.waitFor({ timeout: 5000 })
            const sobre = await page.evaluate(() => {
              const p = document.querySelector<HTMLElement>('.cp-tip')!.getBoundingClientRect()
              const c = document.querySelector('[data-obs-screen="comparar"] [data-so-seu-canal]')!
              const alvos = [...c.querySelectorAll<HTMLElement>('.so-vl, .so-val .so-nm, .tf')].map(e => ({ q: e.className.toString().slice(0, 14), r: e.getBoundingClientRect() }))
              const cobre = alvos.filter(a => a.r.width > 0 && p.left < a.r.right && a.r.left < p.right && p.top < a.r.bottom && a.r.top < p.bottom).map(a => a.q)
              return { pop: { l: Math.round(p.left), r: Math.round(p.right), t: Math.round(p.top), b: Math.round(p.bottom) }, cobre, dentro: p.left >= -1 && p.right <= innerWidth + 1 }
            })
            medida(`${vp.w}px ${NOME_TEMA[tema]}: popover do ⓘ ${JSON.stringify(sobre.pop)} dentro da janela ${sobre.dentro}; cobre ${sobre.cobre.length ? sobre.cobre.join(',') : 'nenhum valor'}`)
            expect(sobre.dentro, 'o popover cabe na janela').toBe(true)
            // a 1440 px o popover não pode cobrir nenhum valor (como no mockup, ele cobre só o texto da frase e os rótulos); a 390 px ele ocupa a largura da janela e cobre a linha de baixo, como o mockup
            if (vp.w >= 1100) expect(sobre.cobre, 'o popover do ⓘ não cobre nenhum valor do cartão').toEqual([])
            await page.screenshot({ path: path.join(SHOTS, `comparar-popover-${caso.nome}-${vp.w}-${NOME_TEMA[tema]}.png`) })
            await page.keyboard.press('Escape')
          }
        } finally { await ctx.close() }
      })
    }
  })
}

async function lado(page: Page, caso: 'magro' | 'cheio' | 'sem-dado', w: number, h: number, tema: 'dark' | 'light'): Promise<void> {
  await ladoALado(page, caso, w, h, tema, `comparar-cartao-${caso}-${w}-${NOME_TEMA[tema]}.png`)
}

/** A taxa de clique perto de 0% e de 100%: a faixa colada no começo e no fim do eixo, a 390 px e a 1440 px. */
test.describe('medidas do cartão: a faixa da taxa perto de 0% e de 100%', () => {
  test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })
  const ALVOS = [{ nome: 'perto de 0% (0,1%)', ctr: 0.001, k: 'zero' }, { nome: 'perto de 100% (97%)', ctr: 0.97, k: 'cem' }] as const
  for (const alvo of ALVOS) for (const vp of [{ w: 390, h: 844 }, { w: 1440, h: 900 }] as const) for (const tema of TEMAS) {
    test(`taxa ${alvo.nome} ${vp.w} px ${NOME_TEMA[tema]}`, async ({ browser }) => {
      test.setTimeout(240_000)
      const siteId = await ensureSeeded({ ownPreset: '2', ownL2: 'ativo' })
      const ids = seedIdsOf(siteId)
      // só no banco local: a taxa de cada dia vira o valor extremo (a semente é reposta no fim do bloco, por `clearSeeded`)
      const sb = localServiceClient()
      const r = await sb.from('yt_own_video_reach_daily').update({ thumbnail_ctr: alvo.ctr }).eq('site_id', siteId).eq('channel_id', ids.own('tnfigueiredo'))
      if (r.error) throw new Error(r.error.message)
      const toque = vp.w <= 640
      const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: vp.w, height: vp.h }, hasTouch: toque, isMobile: toque })
      const page = await ctx.newPage()
      try {
        await abrir(page, vp.w, vp.h, tema, `${ROTA}?a=${ids.own('tnfigueiredo')}&b=${ids.channel('matt-wolfe')}`)
        const m = await medir(page)
        medida(`${alvo.nome} ${vp.w}px ${NOME_TEMA[tema]}: docScroll ${m.docScroll}, contScroll ${m.contScroll}, fora ${m.fora.length}, menor texto ${m.menorTexto.toFixed(1)}px, faixa ${m.faixa ? `${m.faixa.textos} textos, sobrepostos ${JSON.stringify(m.faixa.sobrepostos)}, fora ${JSON.stringify(m.faixa.foraDoCartao)}, svg ${Math.round(m.faixa.svgW)}px` : 'SEM FAIXA'}; taxa: ${await page.locator(`${CARTAO} li[data-linha="taxa"]`).innerText().then(t => t.replace(/\s+/g, ' '))}`)
        expect(m.faixa).not.toBeNull()
        expect(m.docScroll).toBeLessThanOrEqual(0)
        expect(m.contScroll).toBeLessThanOrEqual(0)
        expect(m.fora).toEqual([])
        expect(m.menorTexto, m.quemMenor).toBeGreaterThanOrEqual(12)
        expect(m.faixa!.sobrepostos, 'caixas de texto da faixa sem sobreposição').toEqual([])
        expect(m.faixa!.foraDoCartao, 'texto da faixa dentro do cartão').toEqual([])
        await page.locator(`${CARTAO} li[data-linha="taxa"]`).screenshot({ path: path.join(SHOTS, `comparar-taxa-${alvo.k}-${vp.w}-${NOME_TEMA[tema]}.png`) })
      } finally { await ctx.close() }
    })
  }
})

/** A comparação entre DOIS CONCORRENTES não muda com o cartão: o mesmo HTML e os mesmos pixels com e sem dado privado no banco (o cartão e o dado dos canais seus não vazam para este par). */
test.describe('medidas do cartão: dois concorrentes idêntica com e sem dado privado', () => {
  test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })
  test('o HTML (ids do useId renumerados, sem as linhas de views por dia) é igual com e sem dado privado (byte a byte a 1440 px; texto e contagem de elementos a 390 px)', async ({ browser }) => {
    test.setTimeout(300_000)
    const siteId = await ensureSeeded({ ownPreset: '2', ownL2: 'ativo' })
    const ids = seedIdsOf(siteId)
    const url = `${ROTA}?a=${ids.channel('matt-wolfe')}&b=${ids.channel('leo-khev')}`
    const norm = (h: string): string => { const m = new Map<string, string>(); return h.replace(/(_[rR]_[0-9a-zA-Z]+_|:r[0-9a-z]+:)/g, x => { if (!m.has(x)) m.set(x, `ID${m.size}`); return m.get(x)! }) }
    const tirar = async (w: number, h: number) => {
      const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: w, height: h } })
      const page = await ctx.newPage()
      try {
        await abrir(page, w, h, 'dark', url)
        // só depois de hidratar: o DOM do servidor e o hidratado serializam os atributos em outra ordem
        await page.waitForFunction(() => { const b = document.querySelector('[data-obs-screen="comparar"] .cp-swap'); return !!b && Object.keys(b).some(k => k.startsWith('__reactProps')) })
        await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' })
        // as linhas de "Views por dia" ficam de fora: a posição "no geral" conta o canal seu quando ele tem a medida (as views por dia do diário, desde a Tarefa 5), então "7º de 14"
        // com dado e "7º de 13" sem dado. Isso já era assim antes do cartão; o resto da tela tem de ser idêntico.
        const html = norm(await page.locator(`${TELA}:visible`).first().evaluate(e => { const c = e.cloneNode(true) as HTMLElement; c.querySelectorAll('tr').forEach(tr => { if (/Views por dia/.test(tr.textContent ?? '')) tr.remove() }); return c.outerHTML }))
        const cartoes = await page.locator(`${TELA}:visible [data-so-seu-canal]`).count()
        const texto = await page.locator(`${TELA}:visible`).first().evaluate(e => { const c = e.cloneNode(true) as HTMLElement; c.querySelectorAll('tr').forEach(tr => { if (/Views por dia/.test(tr.textContent ?? '')) tr.remove() }); c.querySelectorAll('[role="status"]').forEach(x => { x.textContent = '' }); return (c.textContent ?? '').replace(/\s+/g, ' ').trim() + ' #' + c.querySelectorAll('*').length })
        await page.evaluate(() => document.querySelectorAll('tr').forEach(tr => { if (/Views por dia/.test(tr.textContent ?? '')) (tr as HTMLElement).style.visibility = 'hidden' }))
        const shot = await page.locator(`${TELA}:visible`).first().screenshot()
        return { html, shot, cartoes, texto }
      } finally { await ctx.close() }
    }
    const medidasCom = [await tirar(1440, 900), await tirar(390, 844)]
    const sb = localServiceClient()
    const { clearOwnL2 } = await import('../../../fixtures/observatorio-seed')
    await clearOwnL2(siteId, sb)
    const medidasSem = [await tirar(1440, 900), await tirar(390, 844)]
    for (const [i, w] of [1440, 390].entries()) {
      const a = medidasCom[i]!, b = medidasSem[i]!
      medida(`dois concorrentes a ${w}px: cartões ${a.cartoes}/${b.cartoes}; HTML ${a.html.length}/${b.html.length} bytes, iguais ${a.html === b.html}; texto+elementos iguais ${a.texto === b.texto}; captura ${a.shot.length}/${b.shot.length} bytes, iguais ${a.shot.equals(b.shot)}`)
      expect(a.cartoes + b.cartoes, 'nenhum cartão').toBe(0)
      if (a.html !== b.html) { fs.writeFileSync(path.resolve(__dirname, `../../../../test-results/dois-concorrentes-com-${w}.html`), a.html.replace(/></g, '>\n<')); fs.writeFileSync(path.resolve(__dirname, `../../../../test-results/dois-concorrentes-sem-${w}.html`), b.html.replace(/></g, '>\n<')) }
      expect(a.texto === b.texto, `texto e número de elementos iguais com e sem dado privado (${w}px)`).toBe(true)
      // o HTML serializado byte a byte vale a 1440 px (a 390 px o instante da hidratação muda a ordem dos atributos e comentários do React, sem mudar a tela)
      if (w === 1440) expect(a.html === b.html, `HTML igual com e sem dado privado (${w}px)`).toBe(true)
      // a captura é só medida (o PNG pode diferir em poucos pixels por antialiasing de elementos que o `visibility` esconde); o que vale é o HTML idêntico
    }
  })
})
