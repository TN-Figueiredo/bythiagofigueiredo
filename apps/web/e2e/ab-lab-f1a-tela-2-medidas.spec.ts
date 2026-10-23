// Gio, F1a-tela-2 (T9, envio A), Step 2: medidas por estado x tema x largura (projetos l1440/l390 x dark/light) da pergunta do dia 14.
// Lista "Gio mede" do envio A (Logan + Naksu), itens 1 a 7, 9 (foco e hover) e 10 (no spec do dia 14). Itens 8 e 11 (modo mudar) e 12 (Opera): envio B / dono.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { FRASES } from '../src/lib/youtube/teste-youtube/nativo/frases'
import { AUTH_F1A, abrirLista, abrirPergunta, fecharPergunta, foto, largura, linha, medirEAfirmar, preparar, registrar, semAnimacao, soNoProjeto, tema } from './ab-lab-f1a-tela-2-suporte/comum'
import { TIT } from './ab-lab-f1a-tela-2-suporte/semente'

test.use({ storageState: AUTH_F1A })
const D = FRASES.dia14

const ESTADOS: Array<{ nome: string; chave: string; tardia?: boolean }> = [
  { nome: 'd14-duas', chave: 'sm' },
  { nome: 'd14-tres', chave: 'tres' },
  { nome: 'd14-derivada', chave: 'derivada' },
  { nome: 'd14-derivada-com-original', chave: 'sv_igual' },
  { nome: 'd14-tardia-ask-tres', chave: 'sv_navi', tardia: true },
  { nome: 'd14-tardia-ask-derivada', chave: 'sv_inconcl', tardia: true },
  { nome: 'd14-tardia-ask-duas', chave: 'tardia_lv', tardia: true },
  { nome: 'sem_versoes', chave: 'gl' },
]

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
/** Cor de fundo efetiva (composta) de um elemento: sobe a árvore até achar fundo opaco. */
const fundoDe = (el: Locator): Promise<string> => el.evaluate((e) => {
  for (let n: Element | null = e; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba?\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|transparent/.test(c)) return c }
  return getComputedStyle(document.body).backgroundColor
})

for (const est of ESTADOS) {
  test(`${est.nome}: medidas (console, texto, contraste, alvos, rolagem, aviso acima da grade) + captura`, async ({ page, context }, info) => {
    const a = await preparar(page, context, info)
    await abrirLista(page); await semAnimacao(page)
    const li = linha(page, a.m, est.chave)
    const bloco = await abrirPergunta(page, li)
    await expect(bloco).toBeVisible()
    await foto(page, info, est.nome, bloco)
    await medirEAfirmar(page, bloco, est.nome, info, a.coleta)

    // item 6: aviso acima da grade e na tela, sem rolar
    const aviso = bloco.locator('.cn-d14-aviso')
    await expect(aviso).toHaveText(D.avisoResponder)
    const g = await bloco.evaluate((s) => {
      const av = s.querySelector('.cn-d14-aviso')!.getBoundingClientRect(); const gr = (s.querySelector('.cn-d14-grid') ?? s.querySelector('.cn-d14-other'))!.getBoundingClientRect()
      return { avisoTopo: av.top, avisoFundo: av.bottom, grade: gr.top, alturaDaJanela: window.innerHeight, scrollY: window.scrollY }
    })
    registrar(info, `${est.nome}:aviso`, g)
    expect.soft(g.avisoFundo, `${est.nome}: o aviso termina acima da grade`).toBeLessThanOrEqual(g.grade + 0.5)
    expect.soft(g.avisoTopo >= 0 && g.avisoFundo <= g.alturaDaJanela, `${est.nome}: o aviso está na tela sem rolar (topo ${Math.round(g.avisoTopo)}, fundo ${Math.round(g.avisoFundo)}, janela ${g.alturaDaJanela})`).toBe(true)

    const cartoes = bloco.locator('.cn-d14-vopt')
    const n = await cartoes.count()
    if (n > 0) {
      const caixas = await cartoes.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }))
      const lbls = await cartoes.evaluateAll((els) => els.map((e) => { const r = e.querySelector('.cn-d14-lbl')!.getBoundingClientRect(); return { y: r.y, fundo: r.bottom } }))
      registrar(info, `${est.nome}:cartoes`, { caixas, lbls })
      // item 1: altura >= 44 e larguras iguais (+-1 px); 390: uma coluna
      for (const c of caixas) expect.soft(c.h, `${est.nome}: cartão >= 44 px de altura`).toBeGreaterThanOrEqual(44)
      expect.soft(Math.max(...caixas.map((c) => c.w)) - Math.min(...caixas.map((c) => c.w)), `${est.nome}: larguras iguais (+-1 px)`).toBeLessThanOrEqual(1)
      if (largura(info) === 390) {
        expect.soft(new Set(caixas.map((c) => Math.round(c.x))).size, `${est.nome}: uma coluna a 390`).toBe(1)
        const sw = await bloco.evaluate((s) => { const r = s.closest('.cn-raiz') as HTMLElement; return { sw: r.scrollWidth, cw: r.clientWidth } })
        expect.soft(sw.sw, `${est.nome}: .cn-raiz sem rolagem horizontal (${JSON.stringify(sw)})`).toBeLessThanOrEqual(sw.cw)
      } else if (n >= 2) {
        // item 4 (1440): cartões da mesma altura e o `.lbl` alinhado pelo fundo (margin-top:auto)
        expect.soft(Math.max(...caixas.map((c) => c.h)) - Math.min(...caixas.map((c) => c.h)), `${est.nome}: cartões da mesma altura`).toBeLessThanOrEqual(1)
        expect.soft(Math.max(...lbls.map((l) => l.fundo)) - Math.min(...lbls.map((l) => l.fundo)), `${est.nome}: rótulos alinhados pelo fundo`).toBeLessThanOrEqual(1)
      }
      // item 4: derivada sem espaço de miniatura
      if (est.chave === 'derivada' || est.chave === 'sv_igual' || est.chave === 'sv_inconcl') {
        expect.soft(await bloco.locator('.cn-d14-th').count(), `${est.nome}: derivada não reserva espaço de miniatura`).toBe(0)
      }
    }
    // item 1 (390): "Outra resposta" >= 44 px
    if (largura(info) === 390) {
      const outras = await bloco.locator('.cn-d14-other .cn-btn').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height } }))
      for (const o of outras) expect.soft(o.h, `${est.nome}: botão de "Outra resposta" >= 44 px a 390`).toBeGreaterThanOrEqual(44)
    }
    await fecharPergunta(li)
  })
}

test('foco (Tab) e hover: anel de 2 px --cn-accent com contraste >= 3:1 nos cartões e nos botões; hover muda a borda', async ({ page, context }, info) => {
  const a = await preparar(page, context, info)
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'tres')
  const bloco = await abrirPergunta(page, li)
  const gatilho = li.getByRole('button', { name: 'Responder' })
  await gatilho.focus()
  const alvos = [...[0, 1, 2].map((i) => bloco.locator('.cn-d14-vopt').nth(i)), ...[0, 1, 2].map((i) => bloco.locator('.cn-d14-other .cn-btn').nth(i))]
  const lidos: Array<Record<string, unknown>> = []
  for (let i = 0; i < alvos.length; i++) {
    await page.keyboard.press('Tab')
    await expect(alvos[i]!, `Tab ${i + 1} cai no controle esperado`).toBeFocused()
    const o = await alvos[i]!.evaluate((e) => { const s = getComputedStyle(e); return { w: s.outlineWidth, estilo: s.outlineStyle, cor: s.outlineColor, desloc: s.outlineOffset, visivel: e.matches(':focus-visible'), accent: getComputedStyle(document.querySelector('.cn-raiz')!).getPropertyValue('--cn-accent').trim() } })
    const fundo = await fundoDe(bloco)
    const cr = await contrasteDe(page, o.cor, fundo)
    lidos.push({ i, ...o, contraste: cr, fundo })
    expect.soft(o.visivel, `controle ${i + 1}: :focus-visible casa por Tab`).toBe(true)
    expect.soft(parseFloat(o.w), `controle ${i + 1}: anel >= 2 px (${o.w} ${o.estilo})`).toBeGreaterThanOrEqual(2)
    expect.soft(o.estilo, `controle ${i + 1}: estilo do anel`).not.toBe('none')
    expect.soft(cr, `controle ${i + 1}: anel x fundo >= 3:1 (${o.cor} sobre ${fundo})`).toBeGreaterThanOrEqual(3)
    if (i === 0) await foto(page, info, 'd14-foco-cartao', bloco)
    if (i === 3) await foto(page, info, 'd14-foco-outra-resposta', bloco)
  }
  registrar(info, 'foco-anel', { lidos })
  // hover do cartão: a borda muda e continua distinta do fundo
  const c0 = bloco.locator('.cn-d14-vopt').nth(0)
  const antes = await c0.evaluate((e) => getComputedStyle(e).borderColor)
  await page.mouse.move(0, 0)
  await c0.hover()
  const depois = await c0.evaluate((e) => getComputedStyle(e).borderColor)
  const fundo = await fundoDe(bloco)
  const crH = await contrasteDe(page, depois, fundo)
  const crN = await contrasteDe(page, antes, fundo)
  registrar(info, 'hover-cartao', { antes, depois, contrasteNormal: crN, contrasteHover: crH })
  expect.soft(depois, 'hover muda a borda do cartão').not.toBe(antes)
  expect.soft(crH, `borda no hover x fundo >= 3:1 (${depois} sobre ${fundo})`).toBeGreaterThanOrEqual(3)
  await foto(page, info, 'd14-hover-cartao', bloco)
})

test('largura de troca do contêiner: 641 px = três colunas; 640 px = uma coluna (item 2)', async ({ page, context }, info) => {
  test.skip(largura(info) !== 1440, 'o contêiner é ajustado a partir de uma janela larga')
  const a = await preparar(page, context, info)
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'tres')
  const bloco = await abrirPergunta(page, li)
  const med = async (px: number): Promise<{ colunas: number; qLargura: number; cartaoLargura: number; contêiner: string; scrollWidth: number }> => bloco.evaluate((s, w) => {
    let cont: HTMLElement | null = null
    for (let n: HTMLElement | null = s.parentElement; n; n = n.parentElement) { if (getComputedStyle(n).containerType !== 'normal') { cont = n; break } }
    if (!cont) throw new Error('sem ancestral com container-type')
    cont.style.width = `${w}px`; cont.style.maxWidth = `${w}px`; cont.style.minWidth = '0'
    const g = s.querySelector('.cn-d14-grid') as HTMLElement
    const cols = getComputedStyle(g).gridTemplateColumns.split(' ').length
    const q = s.querySelector('.cn-d14-top q') as HTMLElement
    const card = s.querySelector('.cn-d14-vopt') as HTMLElement
    return { colunas: cols, qLargura: Math.round(q.getBoundingClientRect().width), cartaoLargura: Math.round(card.getBoundingClientRect().width), contêiner: `${cont.tagName}.${cont.className.split(' ')[0]} (${w}px)`, scrollWidth: document.documentElement.scrollWidth }
  }, px)
  const r641 = await med(641)
  await foto(page, info, 'd14-container-641', bloco)
  const r640 = await med(640)
  await foto(page, info, 'd14-container-640', bloco)
  registrar(info, 'container-641-640', { r641, r640 })
  expect(r641.colunas, '641 px: três colunas').toBe(3)
  expect(r640.colunas, '640 px: uma coluna').toBe(1)
  expect.soft(r641.qLargura, '641 px: o título ainda tem largura legível (>= 100 px)').toBeGreaterThanOrEqual(100)
})

test('títulos hostis: 90 letras sem espaço nas três versões; 100 caracteres com espaços (item 3)', async ({ page, context }, info) => {
  const a = await preparar(page, context, info)
  await abrirLista(page); await semAnimacao(page)
  const limite = largura(info) === 390 ? 4 : 3
  for (const [nome, chave, titulos] of [['hostil-90', 'hostil', [a.m.v.hostil!.titulo, TIT.y90, TIT.z90]], ['titulo-100', 'r66', [a.m.v.r66!.titulo, TIT.l100, TIT.l90]]] as const) {
    const li = linha(page, a.m, chave)
    const bloco = await abrirPergunta(page, li)
    await foto(page, info, `d14-${nome}`, bloco)
    await medirEAfirmar(page, bloco, `d14-${nome}`, info, a.coleta)
    const dados = await bloco.evaluate((s) => {
      const cartoes = Array.from(s.querySelectorAll('.cn-d14-vopt')) as HTMLElement[]
      const raiz = s.closest('.cn-raiz') as HTMLElement
      return {
        larguras: cartoes.map((c) => Math.round(c.getBoundingClientRect().width * 10) / 10),
        stranspassam: cartoes.map((c) => c.scrollWidth > c.clientWidth + 1),
        linhas: cartoes.map((c) => { const q = c.querySelector('.cn-d14-top q') as HTMLElement; const lh = parseFloat(getComputedStyle(q).lineHeight); return { n: Math.round(q.getBoundingClientRect().height / lh), title: q.getAttribute('title'), texto: q.textContent } }),
        raiz: { sw: raiz.scrollWidth, cw: raiz.clientWidth }, doc: { sw: document.documentElement.scrollWidth, iw: window.innerWidth },
        secao: { sw: s.scrollWidth, cw: s.clientWidth },
      }
    })
    registrar(info, `d14-${nome}:dados`, dados)
    expect.soft(Math.max(...dados.larguras) - Math.min(...dados.larguras), `${nome}: o cartão não alarga (larguras ${dados.larguras})`).toBeLessThanOrEqual(1)
    expect.soft(dados.stranspassam, `${nome}: nada transborda o cartão`).toEqual([false, false, false])
    expect.soft(dados.raiz.sw, `${nome}: .cn-raiz sem rolagem horizontal`).toBeLessThanOrEqual(dados.raiz.cw)
    expect.soft(dados.doc.sw, `${nome}: scrollWidth == ${dados.doc.iw}`).toBeLessThanOrEqual(dados.doc.iw)
    expect.soft(dados.secao.sw, `${nome}: o bloco não transborda`).toBeLessThanOrEqual(dados.secao.cw)
    dados.linhas.forEach((l, i) => {
      expect.soft(l.n, `${nome}: versão ${i + 1} corta em até ${limite} linhas (tem ${l.n})`).toBeLessThanOrEqual(limite)
      expect.soft(l.title, `${nome}: title da versão ${i + 1} traz o texto completo`).toBe(titulos[i])
    })
    await fecharPergunta(li)
  }
})

test('miniatura nula ("não medido") e miniatura com URL quebrada: placeholder 16:9, sem ícone de imagem quebrada (item 5)', async ({ page, context }, info) => {
  const a = await preparar(page, context, info, { naoEsperadas: [/Failed to load resource/] })
  await page.route(/tres-B\.png/, (r) => r.fulfill({ status: 404, body: '' }))
  await abrirLista(page); await semAnimacao(page)
  // miniatura nula: r66, versão C sem imagem
  const li66 = linha(page, a.m, 'r66')
  const b66 = await abrirPergunta(page, li66)
  const nm = b66.getByTestId('miniatura-nao-medida')
  await expect(nm).toHaveCount(1)
  await expect(nm).toContainText(D.naoMedido)
  await foto(page, info, 'd14-miniatura-nula', b66)
  const dimNula = await b66.evaluate((s) => Array.from(s.querySelectorAll('.cn-d14-th')).map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, razao: Math.round((r.width / r.height) * 100) / 100, tag: e.tagName } }))
  registrar(info, 'miniatura-nula', { dimNula })
  for (const d of dimNula) expect.soft(Math.abs(d.razao - 16 / 9), `miniatura ${d.tag} 16:9 (razão ${d.razao})`).toBeLessThan(0.03)
  await fecharPergunta(li66)
  // URL quebrada: tres, versão B (404)
  const li = linha(page, a.m, 'tres')
  const bloco = await abrirPergunta(page, li)
  const carta = bloco.locator('.cn-d14-vopt').nth(1)
  const falha = carta.locator('.cn-d14-ph.fail')
  await expect(falha).toHaveCount(1, { timeout: 15_000 })
  await expect(falha).toContainText(FRASES.ficha.imagemNaoCarregou)
  await expect(carta.locator('img')).toHaveCount(0)
  const lido = await falha.evaluate((e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { borda: s.borderTopStyle, larguraBorda: s.borderTopWidth, w: r.width, h: r.height, role: e.getAttribute('role'), rotulo: e.getAttribute('aria-label') } })
  const irma = await bloco.locator('.cn-d14-vopt').nth(0).locator('.cn-d14-th').evaluate((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height } })
  registrar(info, 'miniatura-quebrada', { lido, irma })
  expect.soft(lido.borda, 'borda tracejada de erro').toBe('dashed')
  expect.soft(Math.abs(lido.w / lido.h - 16 / 9), 'placeholder 16:9').toBeLessThan(0.03)
  expect.soft(Math.abs(lido.w - irma.w) + Math.abs(lido.h - irma.h), 'mesmas dimensões da miniatura irmã').toBeLessThanOrEqual(2)
  expect(lido.role).toBe('img'); expect(lido.rotulo).toBe(FRASES.ficha.imagemNaoCarregou)
  await foto(page, info, 'd14-miniatura-quebrada', bloco)
  await medirEAfirmar(page, bloco, 'd14-miniatura-quebrada', info, a.coleta)
  void soNoProjeto; void tema
})
