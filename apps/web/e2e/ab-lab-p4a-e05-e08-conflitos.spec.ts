// P4a-E5 (duas abas), E6 (sessão expirada), E7 (edição por fora: confirmação), E8 (sem permissão de administrar).
import { test, expect } from '@playwright/test'
import { estadoFalso, lerTeste, semearTeste, HASH, TITULOS } from './ab-lab-p4a-suporte/semente'
import { AUTH, abrir, botaoEncerrar, dialogoEncerrar, esperarLimpo, foto, nomeDaFoto, preparar, temaDoProjeto, larguraDoProjeto } from './ab-lab-p4a-suporte/comum'
import { limpar } from './ab-lab-p4a-suporte/semente'

test.beforeAll(async () => { await limpar() })

async function escolherB(page: import('@playwright/test').Page) {
  await botaoEncerrar(page).click()
  const dlg = dialogoEncerrar(page)
  await dlg.getByRole('radio', { name: 'Variante B' }).check()
  return dlg
}

test.describe('admin', () => {
  test.use({ storageState: AUTH.admin })

  test('E5: A abre Encerrar, B pausa, A confirma: resultado "mudou" (frase, Recarregar), ZERO escrita nova no YouTube, status segue paused', async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E5 ${info.project.name}`, status: 'active' }, { naoEsperadas: [/409/] })
    await abrir(page, t.url)
    const dlg = await escolherB(page)

    const outra = await context.newPage()
    await outra.goto(t.url)
    await outra.waitForLoadState('networkidle')
    await outra.getByRole('button', { name: 'Pausar', exact: true }).click()
    const pausa = outra.getByRole('dialog', { name: 'Pausar teste' })
    await pausa.getByRole('button', { name: /^Pausar/ }).last().click()
    await expect.poll(async () => (await lerTeste(t.testId)).status, { timeout: 15_000 }).toBe('paused')
    // o status vira paused ANTES das escritas no YouTube: espera as 2 escritas da pausa por condição antes de medir
    await expect.poll(async () => (await estadoFalso()).escritas.length, { timeout: 20_000 }).toBe(2)
    const antes = await estadoFalso()
    await outra.close()

    await dlg.getByRole('button', { name: 'Encerrar e ficar com B' }).click()
    await expect(dlg.getByText('O teste mudou em outra aba.')).toBeVisible({ timeout: 15_000 })
    await expect(dlg.getByText('Reabra para decidir.')).toBeVisible()
    await expect(dlg.getByRole('button', { name: 'Recarregar' })).toBeVisible()
    await expect(dlg.getByRole('button', { name: /^Encerrar e ficar com/ })).toHaveCount(0)
    await foto(page, nomeDaFoto('E5', 'mudou-r2', info, tema))
    const depois = await estadoFalso()
    const linha = await lerTeste(t.testId)
    expect(depois.escritas, 'A não escreve nada sobre a pausa de B').toEqual(antes.escritas)
    expect(linha.status).toBe('paused')
    esperarLimpo(coleta, 'E5')
  })

  test('E5b (inverso): A abre Pausar, B encerra, A confirma: "mudou" no diálogo de pausa, Recarregar, nada escrito depois, status completed', async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E5b ${info.project.name}`, status: 'active' }, { naoEsperadas: [/409/] })
    await abrir(page, t.url)
    await page.getByRole('button', { name: 'Pausar', exact: true }).click()
    const pausa = page.getByRole('dialog', { name: 'Pausar teste' })
    await expect(pausa).toBeVisible()

    const outra = await context.newPage()
    await outra.goto(t.url)
    await outra.waitForLoadState('networkidle')
    await botaoEncerrar(outra).click()
    const d2 = dialogoEncerrar(outra)
    await d2.getByRole('radio', { name: 'Variante B' }).check()
    await d2.getByRole('button', { name: 'Encerrar e ficar com B' }).click()
    await expect.poll(async () => (await lerTeste(t.testId)).status, { timeout: 20_000 }).toBe('completed')
    // o status vira completed ANTES das escritas no YouTube (a faixa lê em_andamento nesse intervalo): espera as 2 escritas de B antes de medir
    await expect.poll(async () => (await estadoFalso()).escritas.length, { timeout: 20_000 }).toBe(2)
    const antes = await estadoFalso()
    await outra.close()

    await pausa.getByRole('button', { name: /^Pausar/ }).last().click()
    await expect(pausa.getByText('O teste mudou em outra aba. Reabra para decidir.')).toBeVisible({ timeout: 15_000 })
    await expect(pausa.getByRole('button', { name: 'Recarregar' })).toBeVisible()
    await expect(pausa.getByRole('button', { name: 'Fechar', exact: true }).last(), 'R4: Fechar ao lado do Recarregar').toBeVisible()
    const fundo = (l: import('@playwright/test').Locator) => l.evaluate((e) => getComputedStyle(e).backgroundColor)
    expect(await fundo(pausa.getByRole('button', { name: 'Recarregar' })), 'Recarregar é o primário (fundo âmbar), Fechar não').not.toBe(await fundo(pausa.getByRole('button', { name: 'Fechar', exact: true }).last()))
    await foto(page, nomeDaFoto('E5b', 'mudou-r3', info, tema))
    expect((await estadoFalso()).escritas, 'A não escreve depois do encerramento de B').toEqual(antes.escritas)
    expect((await lerTeste(t.testId)).status).toBe('completed')
    esperarLimpo(coleta, 'E5b')
  })

  test('E6: sessão expirada com o diálogo aberto: fase "Sessão expirada" com a frase e o link "Entrar de novo" para /cms/login?next=, estado do teste intocado', async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E6 ${info.project.name}`, status: 'active' }, { naoEsperadas: [/\/cms\/login/, /401/, /307/] })
    await abrir(page, t.url)
    const dlg = await escolherB(page)
    const antes = await lerTeste(t.testId)
    const sessao = (await context.cookies()).filter((c) => /^sb-/.test(c.name))
    expect(sessao.length, 'há cookie de sessão para apagar').toBeGreaterThan(0)
    await context.clearCookies({ name: /^sb-/ })
    await dlg.getByRole('button', { name: 'Encerrar e ficar com B' }).click()
    await expect(dlg.getByText('Sessão expirada')).toBeVisible({ timeout: 15_000 })
    await expect(dlg.getByText('Sua sessão expirou. Entre de novo para encerrar o teste.')).toBeVisible()
    const entrar = dlg.getByRole('link', { name: 'Entrar de novo' })
    await expect(entrar).toBeVisible()
    expect(await entrar.getAttribute('href')).toMatch(/^\/cms\/login\?next=/)
    await expect(dlg.getByText('Sem resposta')).toHaveCount(0)
    await foto(page, nomeDaFoto('E6', 'sessao-expirada-r2', info, tema))
    const yt = await estadoFalso()
    expect((await lerTeste(t.testId)).status, 'estado do teste intocado').toBe(antes.status)
    expect(yt.escritas, 'nada escrito no YouTube').toEqual([])
    void coleta
  })

  test('E7a: título editado por fora: alertdialog "Trocar mesmo assim?", foco em Cancelar, Cancelar devolve à escolha com B marcada, só o botão de trocar envia forcar', async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E7a ${info.project.name}`, status: 'active' }, { youtube: { titulo: 'Título que alguém editou por fora' } })
    const corpos: string[] = []
    page.on('request', (r) => { if (r.method() === 'POST' && r.headers()['next-action']) corpos.push(r.postData() ?? '') })
    await abrir(page, t.url)
    const dlg = await escolherB(page)
    await dlg.getByRole('button', { name: 'Encerrar e ficar com B' }).click()
    const alerta = page.getByRole('alertdialog', { name: 'Trocar mesmo assim?' })
    await expect(alerta).toBeVisible()
    await expect(alerta.getByRole('heading', { name: 'No YouTube agora' })).toBeVisible()
    await expect(alerta.getByText('Título que alguém editou por fora')).toBeVisible()
    await expect(alerta.getByText(TITULOS.B)).toBeVisible()
    await expect(alerta.getByRole('button', { name: 'Trocar pelo título de B e encerrar' })).toBeVisible()
    expect((await estadoFalso()).escritas, 'nada escrito antes da confirmação').toEqual([])
    await foto(page, nomeDaFoto('E7', 'titulo-por-fora', info, tema))
    // foco em Cancelar
    const focado = await page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return a ? `${a.tagName}:${(a.textContent ?? '').trim().slice(0, 30)}` : '' })
    expect.soft(focado, 'foco inicial no alertdialog está em "Cancelar"').toBe('BUTTON:Cancelar')
    expect(corpos.length).toBe(1)
    expect(corpos[0]).not.toMatch(/"forcar":\s*true|forcar.{0,6}true/)
    // Cancelar
    await alerta.getByRole('button', { name: 'Cancelar' }).click()
    await expect(alerta).toHaveCount(0)
    await expect(dialogoEncerrar(page).getByRole('radio', { name: 'Variante B' })).toBeChecked()
    expect((await estadoFalso()).escritas).toEqual([])
    // confirmar de fato
    await dialogoEncerrar(page).getByRole('button', { name: 'Encerrar e ficar com B' }).click()
    await expect(alerta).toBeVisible()
    await alerta.getByRole('button', { name: 'Trocar pelo título de B e encerrar' }).click()
    await expect.poll(async () => (await lerTeste(t.testId)).status, { timeout: 20_000 }).toBe('completed')
    expect(corpos.at(-1)).toMatch(/true/)
    // completed é gravado antes da escrita no YouTube: espera o título chegar (spec, não produto)
    await expect.poll(async () => (await estadoFalso()).titulo, { timeout: 20_000 }).toBe(TITULOS.B)
    esperarLimpo(coleta, 'E7a')
  })

  test('E7b: só a thumbnail editada por fora: um alertdialog com as duas imagens', async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E7b ${info.project.name}`, status: 'active' }, { youtube: { thumbDhash: HASH.FORA } })
    await abrir(page, t.url)
    const dlg = await escolherB(page)
    await dlg.getByRole('button', { name: 'Encerrar e ficar com B' }).click()
    const alerta = page.getByRole('alertdialog', { name: 'Trocar mesmo assim?' })
    await expect(alerta).toBeVisible()
    await expect(alerta.getByRole('button', { name: 'Trocar pela thumbnail de B e encerrar' })).toBeVisible()
    await expect(alerta.getByText('No YouTube agora')).toBeVisible()
    await foto(page, nomeDaFoto('E7', 'thumb-por-fora', info, tema))
    expect((await estadoFalso()).escritas).toEqual([])
    esperarLimpo(coleta, 'E7b')
  })

  test('E7c: título e thumbnail por fora: UM alertdialog só, com as duas comparações; a 390 o corpo rola', async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E7c ${info.project.name}`, status: 'active' }, { youtube: { titulo: 'Título por fora', thumbDhash: HASH.FORA } })
    await abrir(page, t.url)
    const dlg = await escolherB(page)
    await dlg.getByRole('button', { name: 'Encerrar e ficar com B' }).click()
    const alerta = page.getByRole('alertdialog', { name: 'Trocar mesmo assim?' })
    await expect(alerta).toBeVisible()
    expect(await page.getByRole('alertdialog').count(), 'um diálogo só').toBe(1)
    await expect(alerta.getByRole('heading', { name: 'Título' })).toBeVisible()
    await expect(alerta.getByRole('heading', { name: 'Thumbnail' })).toBeVisible()
    await expect(alerta.getByRole('button', { name: 'Trocar título e thumbnail por B e encerrar' })).toBeVisible()
    const medidas = await alerta.locator('.etd-b').evaluate((el) => ({ rolagem: el.scrollHeight, visivel: el.clientHeight, overflowY: getComputedStyle(el).overflowY }))
    info.annotations.push({ type: 'medidas', description: JSON.stringify(medidas) })
    const caixa = await alerta.boundingBox()
    expect(caixa!.y, 'o diálogo cabe na janela (topo)').toBeGreaterThanOrEqual(0)
    expect(caixa!.y + caixa!.height, 'o diálogo cabe na janela (base)').toBeLessThanOrEqual(page.viewportSize()!.height + 1)
    if (larguraDoProjeto(info) === 390) expect(['auto', 'scroll']).toContain(medidas.overflowY)
    // B2: nenhum elemento fixo da página (barra inferior) cobre o rodapé do diálogo: o ponto central de cada botão pertence ao diálogo.
    const cobertos = await alerta.evaluate((el) => [...el.querySelectorAll('button, a')].map((b) => {
      const r = b.getBoundingClientRect(); const x = r.left + r.width / 2; const y = r.top + r.height / 2
      const topo = document.elementFromPoint(x, y)
      return { nome: (b.textContent ?? '').trim().slice(0, 30), visivel: r.bottom <= innerHeight + 1 && r.top >= 0, doDialogo: !!topo && el.contains(topo) }
    }))
    const fixos = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).position === 'fixed').map((e) => ({ el: `${e.tagName}.${(e.getAttribute('class') ?? '').slice(0, 30)}`, z: getComputedStyle(e).zIndex, topo: Math.round(e.getBoundingClientRect().top), alto: Math.round(e.getBoundingClientRect().height) })))
    info.annotations.push({ type: 'B2', description: JSON.stringify({ cobertos, fixos }) })
    expect(cobertos.filter((c) => !c.doDialogo || !c.visivel), 'botões do rodapé visíveis e não cobertos').toEqual([])
    await foto(page, nomeDaFoto('E7', 'os-dois-r2', info, tema))
    esperarLimpo(coleta, 'E7c')
  })
})

test.describe('editor (sem administrar o site)', () => {
  test.use({ storageState: AUTH.editor })

  test('E8: opções de variante desabilitadas com a frase; "Sem imagem" quando a miniatura não carrega; faixa sem botão; forçar a variante não dá 500', async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E8 ${info.project.name}`, status: 'active' }, { semImagem: /\.png|ytimg|ggpht/, naoEsperadas: [/\.png/, /ytimg/, /404/] })
    const respostas: number[] = []
    page.on('response', (r) => { if (r.request().method() === 'POST' && r.request().headers()['next-action']) respostas.push(r.status()) })
    await abrir(page, t.url)
    const botao = botaoEncerrar(page)
    if (await botao.count() === 0) {
      info.annotations.push({ type: 'observado', description: 'editor não vê o botão Encerrar' })
      await foto(page, nomeDaFoto('E8', 'editor-sem-botao', info, tema))
      expect(await botao.count(), 'se o editor não vê Encerrar, o critério da frase não se aplica: registrar').toBe(1)
      return
    }
    await botao.click()
    const dlg = dialogoEncerrar(page)
    await expect(dlg.getByText('Só quem administra o site pode deixar uma variante no ar. Você pode voltar ao original.')).toBeVisible()
    await expect(dlg.getByRole('radio', { name: 'Variante B' })).toBeDisabled()
    await expect(dlg.getByRole('radio', { name: 'Variante C' })).toBeDisabled()
    await expect(dlg.getByText('Sem imagem').first()).toBeVisible()
    await foto(page, nomeDaFoto('E8', 'sem-permissao', info, tema))
    // O original continua permitido ao editor; é o caminho legítimo e dele sai o pedido que vamos reenviar com a variante B.
    await expect(dlg.getByRole('radio', { name: 'A (original)' }).or(dlg.getByRole('radio', { name: /original/ })).first()).toBeChecked()
    const pedidos: Array<{ url: string; headers: Record<string, string>; corpo: string }> = []
    page.on('request', (r) => { if (r.method() === 'POST' && r.headers()['next-action']) pedidos.push({ url: r.url(), headers: r.headers(), corpo: r.postData() ?? '' }) })
    await dlg.getByRole('button', { name: /^Encerrar e ficar com A/ }).click()
    await expect.poll(async () => (await lerTeste(t.testId)).status, { timeout: 20_000 }).toBe('completed')
    expect(pedidos.length).toBe(1)
    // 2º teste: reenvia o mesmo pedido com a variante B no lugar da A (cliente adulterado). Sem permissão de administrar: deve recusar, nunca 500.
    const t2 = await semearTeste({ nome: `E8b ${info.project.name}`, status: 'active' })
    const antes = (await estadoFalso()).escritas.length
    const p = pedidos[0]!
    info.annotations.push({ type: 'corpo-original', description: p.corpo.slice(0, 600) })
    const corpo = p.corpo.split(t.testId).join(t2.testId).replace(/\{"destino":"original"(,"seqVisto":\d+)?\}/, (_m, seq) => `{"destino":"variante","varianteId":"${t2.varB}"${seq ?? ''}}`)
    expect(corpo).toContain(t2.varB)
    const h: Record<string, string> = {}
    for (const k of ['next-action', 'content-type', 'accept', 'next-router-state-tree', 'next-url']) if (p.headers[k]) h[k] = p.headers[k]!
    const r = await page.request.post(p.url.replace(t.testId, t2.testId), { headers: h, data: corpo })
    const txt = await r.text()
    const resultado = txt.match(/"?resultado"?:"?\\?"?[a-z_]+/g) ?? []
    info.annotations.push({ type: 'forcado', description: JSON.stringify({ status: r.status(), resultado, erro: txt.match(/Só quem[^"\\]*/)?.[0] ?? null, tamanho: txt.length }) })
    expect(r.status(), 'recusa sem 5xx').toBeLessThan(500)
    expect(txt).toMatch(/sem_permissao|Só quem administra|forbidden/)
    expect((await lerTeste(t2.testId)).status, 'o 2º teste segue ativo').toBe('active')
    expect((await estadoFalso()).escritas.length, 'nenhuma escrita nova no YouTube').toBe(antes)
    esperarLimpo(coleta, 'E8')
  })
})
