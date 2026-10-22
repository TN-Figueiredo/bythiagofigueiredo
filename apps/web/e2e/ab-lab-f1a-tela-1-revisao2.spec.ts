// Gio, F1a-tela-1, Re-validação 2: consertos da revisão de tela do Logan (I-1, I-3, I-4, M-1) e da Naksu (U-1 a U-4, U-6).
import fs from 'node:fs'
import { expect, test, type Locator } from '@playwright/test'
import { FRASES } from '../src/lib/youtube/teste-youtube/nativo/frases'
import {
  AUTH_F1A, abrirFichaDaLinha, abrirLista, foto, linha, medirEAfirmar, preparar, semAnimacao, soNoProjeto, tema, ytCtl, MEDIDAS, ficha,
} from './ab-lab-f1a-tela-1-suporte/comum'
import { BLOB, conectar, consultar, prepararNosso, type Chave, type Mundo } from './ab-lab-f1a-tela-1-suporte/semente'

test.use({ storageState: AUTH_F1A })
const F = FRASES.ficha
const estreito = (i: { project: { name: string } }): boolean => i.project.name.startsWith('l390')
const registrar = (o: Record<string, unknown>): void => fs.appendFileSync(MEDIDAS, JSON.stringify(o) + '\n')

/** Deixa no site só as linhas de `manter` (apaga as outras e o que depende delas). */
async function manterSoLinhas(m: Mundo, manter: Chave[]): Promise<void> {
  const fora = Object.values(m.v).filter((x) => !manter.includes(x.chave as Chave)).map((x) => x.id)
  const c = await conectar()
  try {
    const testes = `(select id from public.ab_tests where youtube_video_id = any($1::uuid[]))`
    for (const t of ['ab_test_restores', 'ab_test_cycles', 'ab_test_polls', 'ab_test_variants']) await c.query(`delete from public.${t} where test_id in ${testes}`, [fora]).catch(() => undefined)
    await c.query('delete from public.ab_tests where youtube_video_id = any($1::uuid[])', [fora])
    const tabs = (await c.query(
      `select table_name from information_schema.columns where table_schema='public' and column_name = 'video_id' and table_name like 'ab\\_%'`,
    )).rows as Array<{ table_name: string }>
    for (const t of tabs) await c.query(`delete from public."${t.table_name}" where video_id = any($1::uuid[])`, [fora]).catch(() => undefined)
    await c.query('delete from public.youtube_videos where id = any($1::uuid[])', [fora])
  } finally { await c.end() }
}

// ── U-3: esqueleto por altura de linha ──
for (const [rotulo, manter] of [['11 linhas', null], ['3 linhas', ['sp', 'r66', 'sh'] as Chave[]]] as const) {
  test(`U-3: esqueleto da lista com ${rotulo} mede a lista pronta (Δ ≤ 4 px) na visita seguinte`, async ({ page, context }, info) => {
    const a = await preparar(page, context, info)
    if (manter) await manterSoLinhas(a.m, [...manter])
    const lista = await abrirLista(page)
    await semAnimacao(page)
    const nLinhas = await page.locator('li[data-linha]').count()
    if (manter) expect(nLinhas, 'mundo reduzido').toBe(manter.length)
    const pronta = (await lista.boundingBox())?.height ?? 0
    const trava = await conectar()
    let seguinte = 0
    try {
      await trava.query('begin')
      await trava.query('lock table public.ab_native_fichas in access exclusive mode')
      await page.reload({ waitUntil: 'commit' })
      await expect(page.getByText(FRASES.lista.carregando.frase)).toBeVisible({ timeout: 30_000 })
      await expect(page.locator('li[data-linha]')).toHaveCount(0)
      await expect(page.locator('[data-skel-grupo]')).toHaveCount(2, { timeout: 15_000 }) // o esqueleto lê o localStorage depois de hidratar
      await expect(page.locator('[data-skel-linha]')).toHaveCount(nLinhas, { timeout: 15_000 })
      await semAnimacao(page)
      seguinte = (await page.getByRole('region', { name: 'Vídeos do A/B Lab' }).boundingBox())?.height ?? 0
      await foto(page, info, `r2-esqueleto-${nLinhas}`)
      const sk = await page.evaluate(() => ({ n: document.querySelectorAll('[data-skel-linha]').length, h: Math.round(document.querySelector('[data-skel-linha]')?.getBoundingClientRect().height ?? 0) }))
      registrar({ estado: `esqueleto-r2-${nLinhas}`, projeto: info.project.name, seguinte, pronta, linhasEsqueleto: sk.n, alturaPorLinha: sk.h })
      info.annotations.push({ type: 'altura', description: `${info.project.name}: esqueleto ${seguinte.toFixed(1)} | lista ${pronta.toFixed(1)} | ${sk.n} linhas de ${sk.h} px` })
      expect(sk.h, 'U-3: altura por linha do esqueleto').toBe(estreito(info) ? 220 : 128)
    } finally { await trava.query('rollback').catch(() => undefined); await trava.end() }
    expect(Math.abs(seguinte - pronta), `esqueleto ${seguinte} vs lista ${pronta}`).toBeLessThanOrEqual(4)
  })
}

// ── U-1: miniatura da ficha 160 px e "Miniatura" sem quebra no meio ──
/** Palavras do texto de `alvo` partidas em mais de uma linha (quebra no meio da palavra). */
async function palavrasPartidas(alvo: Locator): Promise<string[]> {
  return alvo.evaluate((el) => {
    const ruins: string[] = []
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let t = w.nextNode() as Text | null; t; t = w.nextNode() as Text | null) {
      const re = /\S+/g; let m: RegExpExecArray | null
      while ((m = re.exec(t.data))) {
        const r = document.createRange(); r.setStart(t, m.index); r.setEnd(t, m.index + m[0].length)
        const linhas = new Set(Array.from(r.getClientRects()).map((q) => Math.round(q.top)))
        if (linhas.size > 1) ruins.push(m[0])
      }
    }
    return ruins
  })
}
async function todasPartidas(l: Locator): Promise<string[]> {
  const out: string[] = []
  for (let i = 0; i < await l.count(); i++) out.push(...await palavrasPartidas(l.nth(i)))
  return out
}

test('U-1: miniatura da ficha tem 160 px; "Miniatura" (seletor, caixa, slot) não quebra no meio', async ({ page, context }, info) => {
  const a = await preparar(page, context, info)
  await abrirLista(page); await semAnimacao(page)
  const f = await abrirFichaDaLinha(page, a.m, 'mv', 'Continuar') // duas versões com imagem
  const imgs = f.locator('.cn-vimg img.cn-th')
  await expect(imgs.first()).toBeVisible()
  const larguras = await imgs.evaluateAll((l) => l.map((i) => Math.round(i.getBoundingClientRect().width * 10) / 10))
  registrar({ estado: 'u1-miniatura', projeto: info.project.name, larguras })
  expect(larguras.length).toBeGreaterThan(0)
  for (const w of larguras) expect.soft(w, 'U-1: miniatura da ficha 160 px').toBe(160)
  await foto(page, info, 'r2-ficha-miniatura', f)
  const alvos = f.locator('.cn-segc, .cn-th.nm, .cn-th.fail, .cn-slot')
  expect(await alvos.count()).toBeGreaterThan(0)
  expect(await todasPartidas(alvos), 'palavras partidas no meio (ficha com imagens)').toEqual([])
  // ficha nova do r66: seletor em "Miniatura" mostra a caixa "não medido" da A e o slot da B
  await page.keyboard.press('Escape')
  await expect(ficha(page)).toHaveCount(0)
  const f2 = await abrirFichaDaLinha(page, a.m, 'r66', 'Testar no YouTube')
  await f2.getByRole('radio', { name: 'Miniatura' }).click()
  const caixas = f2.locator('.cn-th.nm, .cn-slot, .cn-segc')
  const ruins = await todasPartidas(caixas)
  const nm = await f2.locator('.cn-th.nm').count(); const slot = await f2.locator('.cn-slot').count()
  registrar({ estado: 'u1-caixas', projeto: info.project.name, caixasNaoMedido: nm, slots: slot, palavrasPartidas: ruins })
  expect(nm + slot, 'há caixa "não medido" ou slot para medir').toBeGreaterThan(0)
  expect(ruins, 'palavras partidas no meio (ficha nova, Miniatura)').toEqual([])
  await foto(page, info, 'r2-ficha-miniatura-nova', f2)
  await medirEAfirmar(page, f2, 'u1-ficha-nova-miniatura', info, a.coleta)
})

// ── U-2: foco visível no seletor (teclado) ──
test('U-2: Tab chega ao seletor Título/Miniatura/Os dois e cada opção focada tem anel visível', async ({ page, context }, info) => {
  test.skip(estreito(info), 'teclado: 1440 basta (o seletor é o mesmo)')
  const a = await preparar(page, context, info)
  await abrirLista(page); await semAnimacao(page)
  const f = await abrirFichaDaLinha(page, a.m, 'r66', 'Testar no YouTube')
  const seletor = f.locator('.cn-segc')
  await expect(seletor).toBeVisible()
  type Foco = { rotulo: string; estilo: string; larg: number; cor: string; dentro: boolean }
  const lerFoco = (): Promise<Foco | null> => page.evaluate(() => {
    const e = document.activeElement as HTMLElement | null
    if (!e) return null
    const s = getComputedStyle(e)
    return { rotulo: (e.textContent ?? '').trim(), estilo: s.outlineStyle, larg: parseFloat(s.outlineWidth), cor: s.outlineColor, dentro: !!e.closest('.cn-segc') }
  })
  await page.locator('#cn-fh').focus()
  const vistos: Foco[] = []
  for (let i = 0; i < 30 && vistos.length < 3; i++) {
    await page.keyboard.press('Tab')
    const x = await lerFoco()
    if (x?.dentro && !vistos.some((v) => v.rotulo === x.rotulo)) {
      vistos.push(x)
      await foto(page, info, 'r2-foco-seletor', seletor)
      break // radiogroup: uma parada só; as demais opções vêm pelas setas
    }
  }
  let porSeta = false
  while (vistos.length < 3) { // radiogroup de uma parada só: as setas percorrem as demais
    await page.keyboard.press('ArrowRight')
    const x = await lerFoco()
    if (!x?.dentro || vistos.some((v) => v.rotulo === x.rotulo)) break
    porSeta = true; vistos.push(x)
  }
  registrar({ estado: 'u2-foco', projeto: info.project.name, porSeta, vistos })
  expect(vistos.length, `opções alcançadas por teclado: ${JSON.stringify(vistos.map((v) => v.rotulo))}`).toBe(3)
  for (const v of vistos) {
    expect(v.estilo, `${v.rotulo}: outline-style`).not.toBe('none')
    expect(v.larg, `${v.rotulo}: outline-width`).toBeGreaterThanOrEqual(2)
    expect(v.cor, `${v.rotulo}: outline-color visível`).not.toMatch(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/)
  }
  await foto(page, info, 'r2-foco-seletor-ultimo', seletor)
})

// ── U-4: hover e pressionado ──
test('U-4: hover e pressionado mudam o botão (secundário e primário), com os valores literais da Naksu', async ({ page, context }, info) => {
  test.skip(estreito(info), 'hover: só 1440')
  const a = await preparar(page, context, info)
  await abrirLista(page); await semAnimacao(page)
  const esc = tema(info) === 'dark'
  const esperado = esc
    ? { sec: { hover: 'rgb(47, 41, 32)', active: 'rgb(31, 27, 22)' }, pri: { hover: 'rgb(255, 149, 96)', active: 'rgb(229, 112, 47)' } }
    : { sec: { hover: 'rgb(237, 226, 207)', active: 'rgb(222, 208, 182)' }, pri: { hover: 'rgb(158, 60, 20)', active: 'rgb(138, 51, 16)' } }
  const bg = (b: Locator): Promise<string> => b.evaluate((e) => getComputedStyle(e).backgroundColor)
  const cobrar = async (b: Locator, par: { hover: string; active: string }, rotulo: string): Promise<void> => {
    await b.scrollIntoViewIfNeeded()
    await page.mouse.move(2, 2)
    const repouso = await bg(b)
    await b.hover()
    const hover = await bg(b)
    const box = (await b.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    const ativo = await bg(b)
    await page.mouse.move(2, 2) // solta fora do botão: cancela o clique
    await page.mouse.up()
    registrar({ estado: `u4-${rotulo}`, projeto: info.project.name, repouso, hover, ativo })
    expect(hover, `${rotulo}: hover difere do repouso`).not.toBe(repouso)
    expect(ativo, `${rotulo}: pressionado difere do hover`).not.toBe(hover)
    expect(hover, `${rotulo}: hover literal`).toBe(par.hover)
    expect(ativo, `${rotulo}: pressionado literal`).toBe(par.active)
  }
  const sec = linha(page, a.m, 'mu').getByRole('button', { name: 'Ver teste' })
  expect(await sec.getAttribute('class'), '"Ver teste" é botão secundário (.cn-btn sem .pri)').toMatch(/cn-btn(?!.*pri)/)
  await cobrar(sec, esperado.sec, 'secundario')
  // link (.cn-lnk): hover engrossa o sublinhado
  const lnk = linha(page, a.m, 'r66').getByRole('button', { name: 'Prefiro outro caminho' })
  await lnk.hover()
  registrar({ estado: 'u4-link', projeto: info.project.name, espessura: await lnk.evaluate((e) => getComputedStyle(e).textDecorationThickness) })
  expect(await lnk.evaluate((e) => getComputedStyle(e).textDecorationThickness), 'link: sublinhado engrossa no hover').toBe('2px')
  await cobrar(linha(page, a.m, 'sp').getByRole('button', { name: 'Responder' }), esperado.pri, 'primario')
})

// ── U-6: alvos ≥ 44 px com toque (pointer: coarse), inclusive em tela larga ──
test.describe('U-6: pointer coarse', () => {
  test.use({ hasTouch: true })
  test('botões, links, seletor e "Adicionar versão" têm ≥ 44 px de altura com toque', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'l1440-dark' && info.project.name !== 'l1440-light', 'tela larga: o @container não atua; só o pointer:coarse')
    const a = await preparar(page, context, info)
    await abrirLista(page); await semAnimacao(page)
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'emulação de toque ativa').toBe(true)
    const f = await abrirFichaDaLinha(page, a.m, 'r66', 'Testar no YouTube')
    await f.getByRole('radio', { name: 'Os dois' }).click()
    const r = await page.evaluate(() => {
      const pequenos: string[] = []; let n = 0
      document.querySelectorAll('.cn-raiz .cn-btn, .cn-raiz .cn-lnk, .cn-raiz .cn-segc button, .cn-raiz .cn-addv').forEach((e) => {
        const b = e.getBoundingClientRect(); if (b.width === 0 || b.height === 0 || (e as HTMLButtonElement).disabled) return
        n++; if (b.height < 43.5) pequenos.push(`${Math.round(b.height * 10) / 10}px "${(e.textContent ?? '').trim().slice(0, 30)}"`)
      })
      return { pequenos, n }
    })
    registrar({ estado: 'u6-coarse', projeto: info.project.name, medidos: r.n, pequenos: r.pequenos })
    expect(r.n).toBeGreaterThan(5)
    expect(r.pequenos, 'alvos com altura < 44 px sob pointer:coarse').toEqual([])
  })
})

// ── I-1 / M-1: retry da pausa chega a "conferir", com saída que persiste ao recarregar na mesma aba ──
test('I-1/M-1: retry sem desfecho leva a "conferir" com saída; a saída persiste ao recarregar e a faixa volta em outra aba', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info) && info.project.name !== 'l390-light', 'fluxo com escrita: um 1440 e um 390')
  const a = await preparar(page, context, info)
  // YouTube com título alheio: o retry não pode forçar
  // título e miniatura trocados por fora (nem a original nem a nossa): o retry encontra deriva nos dois campos e não escreve; sobra conferir no YouTube
  await ytCtl({ op: 'reset', titulo: 'Título trocado por fora, no Studio', thumbDhash: 'a1a1a1a1a1a1a1a1', blobs: { [BLOB('nosso-A')]: 'f0f0f0f0f0f0f0f0' } })
  await prepararNosso(a.m, 'mv', { status: 'paused', diasAtras: 5, pausadoHa: 1, restoreStatus: 'falhou' })
  await abrirLista(page); await semAnimacao(page)
  const f = await abrirFichaDaLinha(page, a.m, 'mv', 'Continuar')
  await expect(f.getByRole('button', { name: F.tentarDeNovo })).toBeVisible()
  await foto(page, info, 'r2-pausa-tentar')
  await f.getByRole('button', { name: F.tentarDeNovo }).click()
  const saida = f.getByRole('button', { name: F.conferiESeguir })
  await expect(saida, 'I-1: depois do retry há saída').toBeVisible({ timeout: 30_000 })
  await expect(f).toContainText(F.faixaRestaurarNaoVolta.titulo)
  await foto(page, info, 'r2-pausa-conferir')
  await medirEAfirmar(page, f, 'i1-conferir', info, a.coleta, { maxPri: 2 })
  const antes = await consultar<{ restore_status: unknown }>('select restore_status from ab_tests where id=$1', [a.m.testes.mv!.testId])
  await saida.click()
  await expect(f.getByText(F.faixaRestaurarNaoVolta.titulo)).toHaveCount(0)
  if (!estreito(info)) await expect(f.getByRole('button', { name: /Abrir no Studio/ }).first()).toBeVisible()
  await page.reload()
  await abrirLista(page)
  const f2 = await abrirFichaDaLinha(page, a.m, 'mv', 'Continuar')
  const chaves = await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('ab-conferido:')))
  const seqDb = (await consultar<{ s: number }>('select restore_seq s from ab_tests where id=$1', [a.m.testes.mv!.testId]))[0]!.s
  registrar({ estado: 'm1-sessionStorage', projeto: info.project.name, chaves, seqDb, testId: a.m.testes.mv!.testId })
  expect(chaves.length, 'chave ab-conferido gravada').toBe(1)
  await expect.soft(f2.getByText(F.faixaRestaurarNaoVolta.titulo), 'M-1 depois do retry: a faixa não volta ao recarregar (chave usa o restoreSeq de antes do retry)').toHaveCount(0)
  if (!estreito(info)) await expect.soft(f2.getByRole('button', { name: /Abrir no Studio/ }).first()).toBeVisible()
  await foto(page, info, 'r2-pausa-persistiu')
  const outra = await context.newPage()
  await abrirLista(outra)
  const f3 = await abrirFichaDaLinha(outra, a.m, 'mv', 'Continuar')
  const volta = await f3.getByText(F.faixaRestaurarNaoVolta.titulo).count()
  registrar({ estado: 'm1-outra-aba', projeto: info.project.name, faixaVolta: volta })
  expect(volta, 'em outra aba a faixa volta (a decisão vale só nesta aba)').toBeGreaterThan(0)
  await outra.close()
  const depois = await consultar<{ restore_status: unknown }>('select restore_status from ab_tests where id=$1', [a.m.testes.mv!.testId])
  expect(JSON.stringify(depois[0]!.restore_status), 'a saída "seguir" não grava no banco').toBe(JSON.stringify(antes[0]!.restore_status))
})

// ── I-3 / I-4: textos novos ──
test('I-3: linha não confirmada (lv) x confirmada (mu); I-4: cabeçalho "Nossos testes ativos"', async ({ page, context }, info) => {
  const a = await preparar(page, context, info)
  const lista = await abrirLista(page); await semAnimacao(page)
  const lv = linha(page, a.m, 'lv'); const mu = linha(page, a.m, 'mu')
  await expect(lv).toContainText(FRASES.s7.selo)
  await expect(lv).toContainText('Parece haver um teste no Studio: o título alterna desde')
  await expect(lv).toContainText('Lab pausado porque parece haver teste no Studio.')
  await expect(lv).not.toContainText('Lab pausado porque há teste no Studio')
  await expect(mu).toContainText('Em teste no Studio')
  await expect(mu).toContainText('Lab pausado porque há teste no Studio.')
  await expect(mu).not.toContainText('parece haver')
  const corpo = (await page.locator('body').textContent()) ?? ''
  expect(corpo).toContain('Nossos testes ativos')
  expect(corpo).toContain('Nenhum teste nosso ativo')
  expect(corpo).not.toMatch(/Testes ativos/)
  expect(corpo).not.toContain('Nenhum teste ativo')
  await foto(page, info, 'r2-cabecalho-lista')
  await medirEAfirmar(page, lista, 'i3-lista', info, a.coleta, { maxPri: 2 })
})

test('I-4: com um nosso teste rodando, o cabeçalho diz "1 teste nosso ativo"', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info) && info.project.name !== 'l390-light', 'um 1440 e um 390')
  const a = await preparar(page, context, info)
  await prepararNosso(a.m, 'sh', { status: 'active', diasAtras: 3, restoreStatus: null })
  await abrirLista(page)
  const corpo = (await page.locator('body').textContent()) ?? ''
  registrar({ estado: 'i4-ativo', projeto: info.project.name, trecho: (corpo.match(/.{0,30}nosso.{0,30}/g) ?? []).slice(0, 4) })
  expect(corpo).toMatch(/1 teste nosso ativo/)
  expect(corpo).toContain('Nossos testes ativos')
})

test('M-1 sem retry: a saída "seguir" persiste ao recarregar na mesma aba e volta em outra aba', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info) && info.project.name !== 'l390-light', 'um 1440 e um 390')
  const a = await preparar(page, context, info)
  await prepararNosso(a.m, 'mv', { status: 'paused', diasAtras: 5, pausadoHa: 1, restoreStatus: 'deriva' })
  await abrirLista(page); await semAnimacao(page)
  const f = await abrirFichaDaLinha(page, a.m, 'mv', 'Continuar')
  await expect(f).toContainText(F.faixaRestaurarNaoVolta.titulo)
  await foto(page, info, 'r2-conferir-direto')
  await f.getByRole('button', { name: F.conferiESeguir }).click()
  await expect(f.getByText(F.faixaRestaurarNaoVolta.titulo)).toHaveCount(0)
  await page.reload()
  await abrirLista(page)
  const f2 = await abrirFichaDaLinha(page, a.m, 'mv', 'Continuar')
  await expect(f2.getByText(F.faixaRestaurarNaoVolta.titulo), 'M-1: a faixa não volta ao recarregar').toHaveCount(0)
  if (!estreito(info)) await expect(f2.getByRole('button', { name: /Abrir no Studio/ }).first()).toBeVisible()
  const outra = await context.newPage()
  await abrirLista(outra)
  const f3 = await abrirFichaDaLinha(outra, a.m, 'mv', 'Continuar')
  expect(await f3.getByText(F.faixaRestaurarNaoVolta.titulo).count(), 'em outra aba a faixa volta').toBeGreaterThan(0)
  await outra.close()
})
