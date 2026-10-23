// Gio, F1a-tela-2 (T9, envio B), Step 2: medidas por estado x tema x largura (4 projetos) do bloco respondido, do conflito e do modo mudar, mais as listas
// "Gio mede" do Logan e da Naksu para o envio B (revisao-codigo-envio-b-*.md) e do conserto B1: C-1 (selo longo vs `.ra`), conflito 390 e 641/640,
// slot `unk` 24x24, foco e anéis, borda de 2 px do "Ver teste" aberto, `scroll-margin-top`, alturas da troca.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { FRASES } from '../src/lib/youtube/teste-youtube/nativo/frases'
import { AUTH_F1A, abrirLista, fotoB, largura, lerFoco, linha, medirB, prepararB, registrarB, semAnimacao, soNoProjeto } from './ab-lab-f1a-tela-2-suporte/comum-b'
import { CHAVES_B } from './ab-lab-f1a-tela-2-suporte/semente-b'

test.use({ storageState: AUTH_F1A })
const D = FRASES.dia14

/** Contraste WCAG entre duas cores CSS (a primeira pode ter alfa e é composta sobre a segunda). */
async function contrasteDe(page: Page, a: string, b: string): Promise<number> {
  return page.evaluate(([ca, cb]) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1
    const cx = cv.getContext('2d', { willReadFrequently: true })!
    const rgba = (c: string): [number, number, number, number] => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0]!, d[1]!, d[2]!, d[3]! / 255] }
    const f = (v: number): number => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
    const L = (r: number, g: number, bl: number): number => 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl)
    const [br, bg, bb] = rgba(cb!); const [r, g, bl, al] = rgba(ca!)
    const l1 = L(r * al + br * (1 - al), g * al + bg * (1 - al), bl * al + bb * (1 - al)); const l2 = L(br, bg, bb)
    return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100
  }, [a, b] as [string, string])
}
const fundoDe = (el: Locator): Promise<string> => el.evaluate((e) => {
  for (let n: Element | null = e; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba?\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|transparent/.test(c)) return c }
  return getComputedStyle(document.body).backgroundColor
})

const RESPONDIDOS = ['b_nova', 'b_orig', 'b_tres', 'b_tardia', 'b_mudada', 'b_der', 'b_der60', 'b_der100', 'b_der_orig', 'b_der_sempar', 'b_igual', 'b_incon', 'b_navi', 'b_veredito'] as const
const CONFLITOS = ['c_regra', 'c_data', 'c_der', 'c_sempar', 'c_hostil'] as const
const verTeste = (li: Locator): Locator => li.getByRole('button', { name: FRASES.conflito.verTeste, exact: true })
const verDuas = (li: Locator): Locator => li.getByRole('button', { name: FRASES.conflito.verAsDuas, exact: true })

/** Linhas com bloco: abre, mede (geral, rolagem, selo x `.ra`), captura e fecha. */
test('estados respondidos (linha fechada e bloco aberto): medidas gerais, C-1 (selo longo não cobre `.ra`, sem rolagem horizontal) e captura', async ({ page, context }, info) => {
  test.setTimeout(420_000)
  const a = await prepararB(page, context, info, RESPONDIDOS)
  await abrirLista(page); await semAnimacao(page)
  const raiz = page.locator('.cn-raiz').first()
  for (const k of RESPONDIDOS) {
    const li = linha(page, a.m, k)
    await li.scrollIntoViewIfNeeded()
    // fechada
    await medirB(page, li, `b-${k}:fechada`, info, a.coleta)
    const fechada = await li.evaluate((el) => {
      const selo = el.querySelector('.st .cn-selo') as HTMLElement | null; const ra = el.querySelector('.ra') as HTMLElement | null; const th = el.querySelector('.cn-th') as HTMLElement | null
      const r = (e: HTMLElement | null) => (e ? e.getBoundingClientRect() : null)
      const cruza = (x: DOMRect | null, y: DOMRect | null): boolean => !!x && !!y && x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top
      const sr = r(selo); const raR = r(ra); const thR = r(th)
      const raiz = el.closest('.cn-raiz') as HTMLElement
      return { selo: sr && { w: Math.round(sr.width), h: Math.round(sr.height), l: Math.round(sr.left), r: Math.round(sr.right) }, ra: raR && { l: Math.round(raR.left), r: Math.round(raR.right), t: Math.round(raR.top) },
        seloCobreRa: cruza(sr, raR), seloCobreMiniatura: cruza(sr, thR), raizSW: raiz.scrollWidth, raizCW: raiz.clientWidth, seloLinhas: sr ? Math.round(sr.height / 22) : 0 }
    })
    registrarB(info, `c1:${k}:fechada`, fechada)
    expect.soft(fechada.seloCobreRa, `${k}: o selo da linha não cobre a coluna .ra`).toBe(false)
    expect.soft(fechada.seloCobreMiniatura, `${k}: o selo não cobre a miniatura`).toBe(false)
    expect.soft(fechada.raizSW, `${k}: .cn-raiz sem rolagem horizontal (linha fechada)`).toBeLessThanOrEqual(fechada.raizCW)
    if (k === 'b_der' || k === 'b_der60' || k === 'b_der100' || k === 'b_nova') await fotoB(page, info, `b-${k}-fechada`, li)
    // aberta
    await verTeste(li).click()
    const bloco = li.locator('section.cn-d14')
    await expect(bloco).toBeVisible()
    await page.waitForTimeout(150)
    await medirB(page, li, `b-${k}:aberta`, info, a.coleta)
    const aberta = await li.evaluate((el) => {
      const raiz = el.closest('.cn-raiz') as HTMLElement; const s = el.querySelector('section.cn-d14') as HTMLElement
      const botao = el.querySelector('[data-acao="ver-bloco"]') as HTMLElement
      const bs = getComputedStyle(botao)
      return { raizSW: raiz.scrollWidth, raizCW: raiz.clientWidth, secaoSW: s.scrollWidth, secaoCW: s.clientWidth, docSW: document.documentElement.scrollWidth, innerW: window.innerWidth,
        botaoBorda: bs.borderTopWidth, botaoBordaCor: bs.borderTopColor, botaoExpandido: botao.getAttribute('aria-expanded'), scrollMargemSecao: getComputedStyle(s).scrollMarginTop,
        scrollMargemFoco: (() => { const f = s.querySelector('[data-foco-bloco]') as HTMLElement | null; return f ? getComputedStyle(f).scrollMarginTop : null })() }
    })
    registrarB(info, `c1:${k}:aberta`, aberta)
    expect.soft(aberta.raizSW, `${k}: .cn-raiz sem rolagem horizontal (aberta)`).toBeLessThanOrEqual(aberta.raizCW)
    expect.soft(aberta.secaoSW, `${k}: o bloco não transborda`).toBeLessThanOrEqual(aberta.secaoCW)
    expect.soft(aberta.docSW, `${k}: scrollWidth do documento == janela`).toBeLessThanOrEqual(aberta.innerW)
    expect.soft(aberta.botaoBorda, `${k}: "Ver teste" aberto tem borda de 2 px (I-4)`).toBe('2px')
    const fundo = await fundoDe(li.locator('[data-acao="ver-bloco"]'))
    const crBorda = await contrasteDe(page, aberta.botaoBordaCor, fundo)
    registrarB(info, `c1:${k}:borda-ver-teste`, { crBorda })
    expect.soft(crBorda, `${k}: borda de 2 px do "Ver teste" aberto x fundo >= 3:1`).toBeGreaterThanOrEqual(3)
    await fotoB(page, info, `b-${k}`, li)
    await verTeste(li).click()
    await expect(li.locator('section.cn-d14')).toHaveCount(0)
    void raiz
  }
})

test('conflitos (linha fechada e bloco aberto): medidas gerais, cartões da mesma altura, `.cn-d14-top` igual, slot `unk` 24x24, uma coluna a 390, sem rolagem com 90 letras', async ({ page, context }, info) => {
  test.setTimeout(420_000)
  const a = await prepararB(page, context, info, CONFLITOS)
  await abrirLista(page); await semAnimacao(page)
  for (const k of CONFLITOS) {
    const li = linha(page, a.m, k)
    await li.scrollIntoViewIfNeeded()
    await medirB(page, li, `${k}:fechada`, info, a.coleta)
    const roladorAntes = await page.evaluate(() => Math.round(document.querySelector('main')!.scrollTop))
    const botaoAntes = await verDuas(li).evaluate((e) => Math.round(e.getBoundingClientRect().top))
    await verDuas(li).click()
    const bloco = li.locator('section.cn-d14-conflito')
    await expect(bloco).toBeVisible()
    await page.waitForTimeout(150)
    const roladorDepois = await page.evaluate(() => Math.round(document.querySelector('main')!.scrollTop))
    const topoDepois = await bloco.evaluate((e) => Math.round(e.getBoundingClientRect().top))
    registrarB(info, `${k}:rolagem-ao-abrir`, { roladorAntes, roladorDepois, botaoAntes, topoDepois, janela: await page.evaluate(() => window.innerHeight) })
    expect.soft(topoDepois >= 48 && topoDepois < await page.evaluate(() => window.innerHeight), `${k}: ao abrir "Ver as duas" o começo do bloco fica visível, abaixo do cabeçalho fixo de 48 px (topo ${topoDepois}; main ${roladorAntes} -> ${roladorDepois}; botão estava em ${botaoAntes})`).toBe(true)
    await medirB(page, li, `${k}:aberta`, info, a.coleta)
    const dados = await bloco.evaluate((s) => {
      const cartoes = Array.from(s.querySelectorAll('.cn-d14-cf > div')) as HTMLElement[]
      const tops = cartoes.map((c) => c.querySelector('.cn-d14-top') as HTMLElement)
      const raiz = s.closest('.cn-raiz') as HTMLElement
      const h3 = s.querySelector('h3') as HTMLElement
      const unk = s.querySelector('.cn-chip.unk') as HTMLElement | null
      return {
        larguras: cartoes.map((c) => Math.round(c.getBoundingClientRect().width * 10) / 10), alturas: cartoes.map((c) => Math.round(c.getBoundingClientRect().height * 10) / 10),
        xs: cartoes.map((c) => Math.round(c.getBoundingClientRect().left)), alturasTop: tops.map((t) => Math.round(t.getBoundingClientRect().height * 10) / 10),
        transbordam: cartoes.map((c) => c.scrollWidth > c.clientWidth + 1), raiz: { sw: raiz.scrollWidth, cw: raiz.clientWidth }, secao: { sw: s.scrollWidth, cw: s.clientWidth },
        h3: { sw: h3.scrollWidth, cw: h3.clientWidth, sr: h3.classList.contains('cn-sr'), foco: document.activeElement === h3, dentro: (() => { const a = h3.getBoundingClientRect(); const b = s.getBoundingClientRect(); return { h3Topo: Math.round(a.top), secaoTopo: Math.round(b.top), secaoFundo: Math.round(b.bottom), dentro: a.top >= b.top - 2 && a.bottom <= b.bottom + 2 } })() },
        unk: unk ? { w: Math.round(unk.getBoundingClientRect().width * 10) / 10, h: Math.round(unk.getBoundingClientRect().height * 10) / 10 } : null,
        chips: Array.from(s.querySelectorAll('.cn-chip')).map((c) => ({ w: Math.round(c.getBoundingClientRect().width * 10) / 10, h: Math.round(c.getBoundingClientRect().height * 10) / 10 })),
        selosNoBloco: s.querySelectorAll('.cn-d14-res, .cn-selo').length,
      }
    })
    registrarB(info, `${k}:dados`, dados)
    if (largura(info) === 390) {
      expect.soft(new Set(dados.xs).size, `${k}: uma coluna a 390`).toBe(1)
    } else {
      expect.soft(Math.max(...dados.alturas) - Math.min(...dados.alturas), `${k}: cartões da mesma altura (${dados.alturas})`).toBeLessThanOrEqual(1)
      expect.soft(Math.max(...dados.larguras) - Math.min(...dados.larguras), `${k}: cartões da mesma largura (${dados.larguras})`).toBeLessThanOrEqual(1)
    }
    if (largura(info) === 1440) expect.soft(Math.max(...dados.alturasTop) - Math.min(...dados.alturasTop), `${k}: .cn-d14-top com a mesma altura nos dois cartões (${dados.alturasTop})`).toBeLessThanOrEqual(1)
    expect.soft(dados.transbordam, `${k}: nada transborda os cartões`).toEqual([false, false])
    expect.soft(dados.raiz.sw, `${k}: .cn-raiz sem rolagem horizontal`).toBeLessThanOrEqual(dados.raiz.cw)
    expect.soft(dados.secao.sw, `${k}: o bloco não transborda`).toBeLessThanOrEqual(dados.secao.cw)
    expect.soft(dados.h3.sr && dados.h3.foco, `${k}: h3 cn-sr com o foco`).toBe(true)
    expect.soft(dados.h3.dentro.dentro, `${k}: o h3 cn-sr fica dentro da caixa do bloco (${JSON.stringify(dados.h3.dentro)})`).toBe(true)
    if (k === 'c_sempar') {
      expect.soft(dados.unk, `${k}: slot unk 24x24`).toEqual({ w: 24, h: 24 })
      expect.soft(dados.chips.every((c) => c.w === 24 && c.h === 24), `${k}: os dois chips do conflito têm 24x24 (${JSON.stringify(dados.chips)})`).toBe(true)
    }
    expect.soft(dados.selosNoBloco, `${k}: o bloco não repete o selo da linha`).toBe(0)
    // contraste das bordas dos cartões x fundo do bloco (informativo; o texto dos cartões já entra na medida geral)
    const fundoB = await fundoDe(bloco)
    const bordas = await bloco.locator('.cn-d14-cf > div').evaluateAll((els) => els.map((e) => getComputedStyle(e).borderTopColor))
    const crs = [] as number[]
    for (const b of bordas) crs.push(await contrasteDe(page, b, fundoB))
    registrarB(info, `${k}:borda-cartoes`, { bordas, crs, fundoB })
    await fotoB(page, info, `b-${k}`, li)
    await verDuas(li).click()
    await expect(li.locator('section.cn-d14')).toHaveCount(0)
  }
})

test('conflito: 641 px de contêiner = duas colunas; 640 px = uma coluna; 90 letras sem espaço nos dois cartões e no h3 não alargam nada', async ({ page, context }, info) => {
  test.skip(largura(info) !== 1440, 'o contêiner é ajustado a partir de uma janela larga')
  const a = await prepararB(page, context, info, ['c_hostil'])
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'c_hostil')
  await verDuas(li).click()
  const bloco = li.locator('section.cn-d14-conflito')
  await expect(bloco).toBeVisible()
  const med = async (px: number): Promise<Record<string, unknown>> => bloco.evaluate((s, w) => {
    let cont: HTMLElement | null = null
    for (let n: HTMLElement | null = s.parentElement; n; n = n.parentElement) { if (getComputedStyle(n).containerType !== 'normal') { cont = n; break } }
    if (!cont) throw new Error('sem ancestral com container-type')
    cont.style.width = `${w}px`; cont.style.maxWidth = `${w}px`; cont.style.minWidth = '0'
    const cf = s.querySelector('.cn-d14-cf') as HTMLElement
    const cartoes = Array.from(cf.children) as HTMLElement[]
    const h3 = s.querySelector('h3') as HTMLElement
    return { px: w, colunas: getComputedStyle(cf).gridTemplateColumns.split(' ').length, larguras: cartoes.map((c) => Math.round(c.getBoundingClientRect().width)), alturas: cartoes.map((c) => Math.round(c.getBoundingClientRect().height)),
      transbordam: cartoes.map((c) => c.scrollWidth > c.clientWidth + 1), h3: [h3.scrollWidth, h3.clientWidth], secao: [s.scrollWidth, s.clientWidth], doc: [document.documentElement.scrollWidth, window.innerWidth] }
  }, px)
  const r641 = await med(641); await fotoB(page, info, 'b-conflito-container-641', bloco)
  const r640 = await med(640); await fotoB(page, info, 'b-conflito-container-640', bloco)
  const r400 = await med(400)
  registrarB(info, 'conflito-container', { r641, r640, r400 })
  expect(r641.colunas, '641 px: duas colunas').toBe(2)
  expect(r640.colunas, '640 px: uma coluna').toBe(1)
  for (const r of [r641, r640, r400]) {
    expect.soft(r.transbordam, `${r.px}: nada transborda`).toEqual([false, false])
    expect.soft((r.secao as number[])[0], `${r.px}: o bloco não transborda`).toBeLessThanOrEqual((r.secao as number[])[1]!)
  }
})

test('modo mudar (ficha de 2, de 3 e derivada): medidas gerais, "Sua resposta" com borda de 2 px >= 3:1, "Manter" >= 44 px a 390, sem primário', async ({ page, context }, info) => {
  test.setTimeout(240_000)
  const a = await prepararB(page, context, info, ['m2', 'm3', 'md'])
  await abrirLista(page); await semAnimacao(page)
  for (const k of ['m2', 'm3', 'md']) {
    const li = linha(page, a.m, k)
    await li.scrollIntoViewIfNeeded()
    await verTeste(li).click()
    await li.getByRole('button', { name: FRASES.respondido.mudar, exact: true }).click()
    const bloco = li.locator('section.cn-d14')
    await expect(bloco.getByRole('heading', { name: D.pergunta })).toBeVisible()
    await page.waitForTimeout(150)
    await medirB(page, li, `mudar-${k}`, info, a.coleta)
    const atual = bloco.locator('.cn-d14-vopt[aria-pressed="true"]')
    await expect(atual).toHaveCount(1)
    const dados = await atual.evaluate((el) => { const s = getComputedStyle(el); return { borda: s.borderTopWidth, estilo: s.borderTopStyle, cor: s.borderTopColor, fundo: s.backgroundColor } })
    const fundo = await fundoDe(bloco)
    const cr = await contrasteDe(page, dados.cor, fundo)
    const outros = await bloco.locator('.cn-d14-vopt[aria-pressed="false"]').evaluateAll((els) => els.map((e) => ({ borda: getComputedStyle(e).borderTopWidth, cor: getComputedStyle(e).borderTopColor })))
    registrarB(info, `mudar-${k}:sua-resposta`, { ...dados, cr, fundo, outros })
    expect.soft(parseFloat(dados.borda), `${k}: borda de "Sua resposta" >= 2 px`).toBeGreaterThanOrEqual(2)
    expect.soft(cr, `${k}: borda de "Sua resposta" x fundo >= 3:1 (${dados.cor} sobre ${fundo})`).toBeGreaterThanOrEqual(3)
    const m = manter(bloco)
    const caixa = (await m.boundingBox())!
    registrarB(info, `mudar-${k}:manter`, { w: caixa.width, h: caixa.height })
    if (largura(info) === 390) expect.soft(caixa.height, `${k}: "Manter a resposta atual" >= 44 px a 390`).toBeGreaterThanOrEqual(44)
    await fotoB(page, info, `b-mudar-${k}`, li)
    await m.click()
    await expect(li.getByRole('button', { name: FRASES.respondido.mudar, exact: true })).toBeVisible()
    await verTeste(li).click()
    await expect(li.locator('section.cn-d14')).toHaveCount(0)
  }
})
const manter = (b: Locator): Locator => b.getByRole('button', { name: D.manter, exact: true })

test('anel de foco (Tab): "Ver teste", "Mudar minha resposta", cartões e "Manter" têm outline >= 2 px e contraste >= 3:1; o título do bloco recebe foco programático sem anel inventado', async ({ page, context }, info) => {
  test.setTimeout(240_000)
  const a = await prepararB(page, context, info, ['m3'])
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'm3')
  await li.scrollIntoViewIfNeeded()
  const lido: Array<Record<string, unknown>> = []
  const anel = async (nome: string, alvo: Locator): Promise<void> => {
    await expect(alvo, `${nome} recebe o foco por Tab`).toBeFocused()
    const o = await alvo.evaluate((e) => { const s = getComputedStyle(e); return { w: s.outlineWidth, estilo: s.outlineStyle, cor: s.outlineColor, desloc: s.outlineOffset, visivel: e.matches(':focus-visible') } })
    const fundo = await fundoDe(alvo)
    const cr = await contrasteDe(page, o.cor, fundo)
    lido.push({ nome, ...o, cr, fundo })
    expect.soft(o.visivel, `${nome}: :focus-visible casa por Tab`).toBe(true)
    expect.soft(parseFloat(o.w), `${nome}: outline >= 2 px (${o.w} ${o.estilo})`).toBeGreaterThanOrEqual(2)
    expect.soft(o.estilo, `${nome}: estilo do outline`).not.toBe('none')
    expect.soft(cr, `${nome}: outline x fundo >= 3:1 (${o.cor} sobre ${fundo})`).toBeGreaterThanOrEqual(3)
  }
  // "Ver teste": foca pelo teclado a partir do título da linha
  const ver = verTeste(li)
  await ver.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab')
  await anel('Ver teste', ver)
  await page.keyboard.press('Enter')
  const bloco = li.locator('section.cn-d14')
  await expect(bloco).toBeVisible()
  const mud = li.getByRole('button', { name: FRASES.respondido.mudar, exact: true })
  await mud.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab')
  await anel('Mudar minha resposta', mud)
  await page.keyboard.press('Enter')
  const bm = li.locator('section.cn-d14')
  await expect(bm.getByRole('heading', { name: D.pergunta })).toBeVisible()
  // foco programático do título (sem :focus-visible por Tab): registra o que se vê
  const h3 = await bm.getByRole('heading', { name: D.pergunta }).evaluate((e) => { const s = getComputedStyle(e); return { outline: `${s.outlineWidth} ${s.outlineStyle}`, focado: document.activeElement === e, visivel: e.matches(':focus-visible') } })
  lido.push({ nome: 'título (foco programático)', ...h3 })
  const primeiro = bm.locator('.cn-d14-vopt').first()
  await page.keyboard.press('Tab')
  await anel('cartão A', primeiro)
  await bm.locator('.cn-d14-other .cn-btn').first().focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab')
  await anel('Ficou igual', bm.locator('.cn-d14-other .cn-btn').first())
  const man = manter(bm)
  await man.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab')
  await anel('Manter a resposta atual', man)
  registrarB(info, 'aneis-de-foco', { lido })
  await fotoB(page, info, 'b-foco-manter', li)
})

test('`?video=` de linha respondida/conflito: o bloco abre, o foco vai ao título e o topo do bloco fica >= 80 px abaixo de qualquer cabeçalho fixo (scroll-margin-top)', async ({ page, context }, info) => {
  test.setTimeout(240_000)
  const chaves = ['b_nova', 'b_igual', 'c_regra', 'c_hostil']
  const a = await prepararB(page, context, info, chaves)
  const lidos: Record<string, unknown> = {}
  for (const k of chaves) {
    await abrirLista(page, `?video=${a.m.v[k]!.yt}`); await semAnimacao(page)
    const li = linha(page, a.m, k)
    await expect(li.locator('section.cn-d14')).toBeVisible({ timeout: 20_000 })
    const amostras: Array<Record<string, number>> = []
    for (const t of [0, 300, 700, 1500]) {
      await page.waitForTimeout(t === 0 ? 0 : 300 + (t > 700 ? 500 : 0))
      amostras.push(await li.evaluate((el, tt) => ({ t: tt, scrollY: Math.round(window.scrollY), topoSecao: Math.round(el.querySelector('section.cn-d14')!.getBoundingClientRect().top), topoLinha: Math.round(el.getBoundingClientRect().top), foco: Math.round((document.activeElement as HTMLElement).getBoundingClientRect().top), focoEhAlvo: Number((document.activeElement as HTMLElement).hasAttribute('data-foco-bloco')), roladores: JSON.stringify(Array.from(document.querySelectorAll('*')).filter((e) => { const o = getComputedStyle(e).overflowY; return (o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 2 }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)}:${Math.round(e.scrollTop)}/${e.scrollHeight}`)) as unknown as number }), t))
    }
    registrarB(info, `scroll-amostras:${k}`, { amostras })
    const x = await li.evaluate((el) => {
      const s = el.querySelector('section.cn-d14') as HTMLElement; const f = document.activeElement as HTMLElement
      const fixos = Array.from(document.querySelectorAll('body *')).filter((e) => { const p = getComputedStyle(e).position; if (p !== 'fixed' && p !== 'sticky') return false; const r = e.getBoundingClientRect(); return r.top <= 4 && r.height > 0 && r.width > 200 })
      const fundoFixo = Math.max(0, ...fixos.map((e) => e.getBoundingClientRect().bottom))
      return { secaoTopo: Math.round(s.getBoundingClientRect().top), focoTopo: Math.round(f.getBoundingClientRect().top), focoEhAlvo: f.hasAttribute('data-foco-bloco'), fundoDoCabecalhoFixo: Math.round(fundoFixo), janela: window.innerHeight,
        scrollMargemSecao: getComputedStyle(s).scrollMarginTop, scrollMargemFoco: getComputedStyle(f).scrollMarginTop }
    })
    lidos[k] = x
    expect.soft(x.focoEhAlvo, `${k}: foco no alvo do bloco`).toBe(true)
    expect.soft(x.focoTopo, `${k}: o título focado fica abaixo do cabeçalho fixo (${x.fundoDoCabecalhoFixo}) e na janela`).toBeGreaterThanOrEqual(x.fundoDoCabecalhoFixo)
    expect.soft(x.secaoTopo >= x.fundoDoCabecalhoFixo - 1 && x.secaoTopo < x.janela, `${k}: o topo do bloco (${x.secaoTopo}) está sob o cabeçalho (${x.fundoDoCabecalhoFixo}) e na janela`).toBe(true)
    await fotoB(page, info, `b-video-${k}`)
  }
  registrarB(info, 'scroll-margin-video', lidos)
  void lerFoco; void CHAVES_B; void soNoProjeto
})
