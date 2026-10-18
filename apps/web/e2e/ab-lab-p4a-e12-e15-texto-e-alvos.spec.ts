// P4a-E12 (texto hostil), E14 (varredura de texto proibido; caminho "Ver Detalhes" na lista de vídeos), E15 (alvo de toque e foco visível).
import { test, expect, type Page } from '@playwright/test'
import { limpar, lerTeste } from './ab-lab-p4a-suporte/semente'
import { AUTH, abrir, botaoEncerrar, dialogoEncerrar, esperarLimpo, foto, nomeDaFoto, preparar, temaDoProjeto, larguraDoProjeto } from './ab-lab-p4a-suporte/comum'

test.use({ storageState: AUTH.admin })
test.beforeAll(async () => { await limpar() })

const PROIBIDOS = /Aplicar vencedor|Cancelar car[eê]ncia|Aplicar variante l[ií]der|Arquivar sem aplicar/i
const HOSTIL = (`<script>alert(1)</script>👨‍👩‍👧‍👦 ÁÉÍÓÚ ñ "aspas" 'simples'   ${'x'.repeat(60)} fim`).slice(0, 100)

const semRolagemHorizontal = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)

test('E12: título original de 100 caracteres com emoji, quebra exótica e <script>: quebra dentro do card, vira texto, nenhum diálogo nativo', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  expect(HOSTIL.length).toBe(100)
  const nativos: string[] = []
  page.on('dialog', async (d) => { nativos.push(d.message()); await d.dismiss() })
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E12 ${info.project.name}`, status: 'active', tituloOriginal: HOSTIL })
  await abrir(page, t.url)
  expect(await semRolagemHorizontal(page), 'página sem rolagem horizontal').toBe(true)
  await botaoEncerrar(page).click()
  const dlg = dialogoEncerrar(page)
  await expect(dlg).toBeVisible()
  const opcao = dlg.locator('.etd-ttl').first()
  await expect(opcao).toContainText('<script>alert(1)</script>')
  const caixa = await dlg.boundingBox()
  const opc = await opcao.boundingBox()
  expect(opc!.x + opc!.width, 'título dentro do diálogo').toBeLessThanOrEqual(caixa!.x + caixa!.width + 1)
  expect(await dlg.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'diálogo sem rolagem horizontal').toBe(true)
  expect(await semRolagemHorizontal(page), 'página sem rolagem horizontal com o diálogo').toBe(true)
  expect(await page.locator('script', { hasText: 'alert(1)' }).count(), 'nenhum <script> injetado').toBe(0)
  await foto(page, nomeDaFoto('E12', 'titulo-hostil-dialogo', info, tema))
  await dlg.getByRole('button', { name: 'Cancelar' }).click()
  expect(nativos, 'nenhum diálogo nativo').toEqual([])
  esperarLimpo(coleta, 'E12')
})

test('E12b: o mesmo título na faixa de um teste encerrado (G: "Continua o da variante") e no detalhe', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const nativos: string[] = []
  page.on('dialog', async (d) => { nativos.push(d.message()); await d.dismiss() })
  const em = new Date(Date.now() - 3 * 86_400_000).toISOString()
  const { t, coleta } = await preparar(page, context, baseURL!, tema, {
    nome: `E12b ${info.project.name}`, status: 'completed', tituloOriginal: HOSTIL,
    restoreStatus: { title: { estado: 'ok', destino: 'original', em }, thumbnail: { estado: 'ok', destino: 'original', em } },
  })
  await abrir(page, t.url)
  expect(await semRolagemHorizontal(page), 'página sem rolagem horizontal').toBe(true)
  expect(await page.locator('script', { hasText: 'alert(1)' }).count()).toBe(0)
  expect(nativos).toEqual([])
  await foto(page, nomeDaFoto('E12', 'titulo-hostil-detalhe', info, tema))
  esperarLimpo(coleta, 'E12b')
})

test('E14: varredura de texto proibido em Lista, Detalhe (ativo, pausado, encerrado), Diálogo; e a lista de vídeos só leva ao detalhe', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E14 ativo ${info.project.name}`, status: 'active' })
  const pausado = await (await import('./ab-lab-p4a-suporte/semente')).semearTeste({ nome: `E14 pausado ${info.project.name}`, status: 'paused' })
  const encerrado = await (await import('./ab-lab-p4a-suporte/semente')).semearTeste({ nome: `E14 encerrado ${info.project.name}`, status: 'completed', restoreStatus: { title: { estado: 'ok', destino: 'original', em: new Date().toISOString() } } })
  const achados: string[] = []
  const varrer = async (rotulo: string) => {
    const txt = await page.locator('body').innerText()
    const m = txt.match(PROIBIDOS)
    if (m) achados.push(`${rotulo}: "${m[0]}"`)
  }
  await abrir(page, '/cms/youtube/ab-lab')
  await varrer('lista')
  await foto(page, nomeDaFoto('E14', 'lista', info, tema))
  for (const [nome, u] of [['detalhe ativo', t.url], ['detalhe pausado', pausado.url], ['detalhe encerrado', encerrado.url]] as const) {
    await abrir(page, u)
    await varrer(nome)
  }
  await abrir(page, t.url)
  await botaoEncerrar(page).click()
  await varrer('diálogo encerrar')
  await dialogoEncerrar(page).getByRole('button', { name: 'Cancelar' }).click()
  await page.getByRole('button', { name: 'Pausar', exact: true }).click()
  await varrer('diálogo pausar')
  await page.keyboard.press('Escape')
  expect(achados, 'nenhum texto proibido').toEqual([])

  // Lista de vídeos: o menu da linha só tem "Ver Detalhes do Teste"; Encerrar e Pausar saíram.
  await page.goto('/cms/youtube/videos')
  await page.waitForLoadState('networkidle')
  const linhas = page.locator('button[aria-label="Mais acoes"]')
  const n = await linhas.count()
  let achouVer = false
  const itens = new Set<string>()
  for (let i = 0; i < n; i++) {
    await linhas.nth(i).click()
    const menu = page.locator('div.absolute.right-0 a')
    for (const x of await menu.allInnerTexts()) itens.add(x.trim())
    if ((await menu.filter({ hasText: 'Ver Detalhes do Teste' }).count()) > 0) achouVer = true
    await page.keyboard.press('Escape')
  }
  info.annotations.push({ type: 'menu-da-lista', description: JSON.stringify([...itens]) })
  expect(achouVer, 'algum menu de linha traz "Ver Detalhes do Teste"').toBe(true)
  for (const i of itens) expect(i).not.toMatch(/^(Encerrar|Pausar)/i)
  expect(await page.getByRole('menuitem', { name: /Encerrar|Pausar/ }).count()).toBe(0)
  await foto(page, nomeDaFoto('E14', 'lista-de-videos', info, tema))
  esperarLimpo(coleta, 'E14')
})

test('E15: alvo de toque >= 44 px no X e nos botões do diálogo e foco visível ao teclar', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E15 ${info.project.name}`, status: 'active' })
  await abrir(page, t.url)
  await botaoEncerrar(page).click()
  const dlg = dialogoEncerrar(page)
  await dlg.getByRole('radio', { name: 'Variante B' }).check()
  const medidas = await dlg.evaluate((el) => {
    const m = (e: Element) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } }
    return {
      x: m(el.querySelector('.etd-x')!),
      botoes: [...el.querySelectorAll('.etd-f button')].map((b) => ({ nome: (b.textContent ?? '').trim(), ...m(b) })),
      opcoes: [...el.querySelectorAll('.etd-opt')].map((o) => m(o)),
    }
  })
  info.annotations.push({ type: 'alvos', description: JSON.stringify(medidas) })
  const toque = larguraDoProjeto(info) === 390
  const min = 44
  const abaixo: string[] = []
  if (medidas.x.w < min || medidas.x.h < min) abaixo.push(`X ${medidas.x.w}x${medidas.x.h}`)
  for (const b of medidas.botoes) if (b.h < min || b.w < min) abaixo.push(`botão "${b.nome}" ${b.w}x${b.h}`)
  await foto(page, nomeDaFoto('E15', 'alvos', info, tema))
  // foco visível: teclar até um botão e ler o contorno
  await page.keyboard.press('Tab')
  const foco = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null
    if (!a || a === document.body) return null
    const cs = getComputedStyle(a)
    return { tag: a.tagName, texto: (a.textContent ?? '').trim().slice(0, 20), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, sombra: cs.boxShadow }
  })
  info.annotations.push({ type: 'foco', description: JSON.stringify(foco) })
  await foto(page, nomeDaFoto('E15', 'foco', info, tema))
  expect(foco, 'um elemento recebe o foco ao teclar Tab dentro do diálogo').not.toBeNull()
  if (foco) {
    const visivel = (foco.outline !== 'none 0px' && !/^none/.test(foco.outline) && !/ 0px /.test(foco.outline)) || (foco.sombra && foco.sombra !== 'none')
    expect(visivel, `foco visível (${JSON.stringify(foco)})`).toBeTruthy()
  }
  expect(abaixo, `alvos abaixo de ${min}px${toque ? ' (toque)' : ''}`).toEqual([])
  esperarLimpo(coleta, 'E15')
})

test('E-extra/D6a: teste no começo (sem ciclo fechado) tem Encerrar e Pausar, e Pausar funciona: abre o detalhe com Retomar e sem Pausar', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `D6a ${info.project.name}`, status: 'active', ciclosFechados: 0 })
  await abrir(page, t.url)
  await expect(page.getByTestId('early-detail')).toBeVisible()
  await foto(page, nomeDaFoto('D6', 'comeco-com-botoes-r2', info, tema))
  await expect(botaoEncerrar(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pausar', exact: true }).click()
  const pausa = page.getByRole('dialog', { name: 'Pausar teste' })
  await pausa.getByRole('button', { name: /^Pausar/ }).last().click()
  await expect.poll(async () => (await lerTeste(t.testId)).status, { timeout: 15_000 }).toBe('paused')
  await expect(page.getByRole('button', { name: /Retomar Teste/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toHaveCount(0)
  await foto(page, nomeDaFoto('D6', 'pausado-no-comeco-r2', info, tema))
  esperarLimpo(coleta, 'D6a')
})

test('D6b: Encerrar no começo do teste funciona (original) e grava completed', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `D6b ${info.project.name}`, status: 'active', ciclosFechados: 0 })
  await abrir(page, t.url)
  await botaoEncerrar(page).click()
  const dlg = dialogoEncerrar(page)
  await dlg.getByRole('radio', { name: 'A (original)' }).check()
  await dlg.getByRole('button', { name: /^Encerrar e ficar com A/ }).click()
  await expect.poll(async () => (await lerTeste(t.testId)).status, { timeout: 20_000 }).toBe('completed')
  esperarLimpo(coleta, 'D6b')
})

test('D6c: teste pausado no 1o dia (sem ciclo fechado) abre o detalhe com Retomar, sem Pausar, com Encerrar', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `D6c ${info.project.name}`, status: 'paused', ciclosFechados: 0 })
  await abrir(page, t.url)
  await expect(page.getByRole('button', { name: /Retomar Teste/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toHaveCount(0)
  await expect(botaoEncerrar(page)).toBeVisible()
  await foto(page, nomeDaFoto('D6', 'pausado-1o-dia-r2', info, tema))
  esperarLimpo(coleta, 'D6c')
})

test('L2: teste encerrado com a variante B no ar não mostra "Encerrado sem vencedor" junto de "Variante B aplicada"', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const em = new Date(Date.now() - 3 * 86_400_000).toISOString()
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `L2 ${info.project.name}`, status: 'completed', restoreStatus: { title: { estado: 'ok', destino: 'B', em }, thumbnail: { estado: 'ok', destino: 'B', em } } })
  await abrir(page, t.url)
  const corpo = await page.locator('body').innerText()
  info.annotations.push({ type: 'trechos', description: JSON.stringify(corpo.match(/Encerrado sem vencedor|Variante B aplicada|sem vencedor[^\n]*/g)) })
  await foto(page, nomeDaFoto('L2', 'b-aplicada-r2', info, tema))
  expect(corpo).not.toMatch(/Encerrado sem vencedor/)
  esperarLimpo(coleta, 'L2')
})
