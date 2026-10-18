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

  test('E5: A abre o diálogo, B pausa o mesmo teste, A confirma: nada é escrito sobre a pausa, A vê mensagem ou estado novo', async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E5 ${info.project.name}`, status: 'active' })
    await abrir(page, t.url)
    const dlg = await escolherB(page)

    const outra = await context.newPage()
    await outra.goto(t.url)
    await outra.waitForLoadState('networkidle')
    await outra.getByRole('button', { name: 'Pausar', exact: true }).click()
    const pausa = outra.getByRole('dialog', { name: 'Pausar teste' })
    await pausa.getByRole('button', { name: /^Pausar/ }).last().click()
    await expect.poll(async () => (await lerTeste(t.testId)).status, { timeout: 15_000 }).toBe('paused')
    const antes = await estadoFalso()
    await outra.close()

    await dlg.getByRole('button', { name: 'Encerrar e ficar com B' }).click()
    await page.waitForTimeout(2500)
    const depois = await estadoFalso()
    const linha = await lerTeste(t.testId)
    const texto = await page.locator('body').innerText()
    info.annotations.push({ type: 'observado', description: JSON.stringify({ status: linha.status, escritasAntes: antes.escritas, escritasDepois: depois.escritas, dialogoAberto: await dlg.isVisible().catch(() => false), trecho: texto.match(/Outra tentativa[^\n]*|Não foi possível[^\n]*|ja_encerrado[^\n]*/)?.[0] ?? null }) })
    await foto(page, nomeDaFoto('E5', 'depois-da-pausa', info, tema))
    // Critério: A não escreve sobre a pausa de B. O teste pausado, se encerrado por A, não pode ter escrito o YouTube duas vezes.
    expect(linha.status === 'paused' || linha.status === 'completed').toBe(true)
    // Aceite estrito (P4a-E5): com a pausa já gravada, A recebe a mensagem de tentativa em andamento / estado novo e NADA é escrito.
    expect(depois.escritas, 'A não escreve sobre a pausa de B').toEqual(antes.escritas)
    esperarLimpo(coleta, 'E5')
  })

  test('E6: sessão expirada com o diálogo aberto: redireciona ao login ou avisa, e o estado do teste fica intocado', async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E6 ${info.project.name}`, status: 'active' }, { naoEsperadas: [/\/cms\/login/, /401/, /307/] })
    await abrir(page, t.url)
    const dlg = await escolherB(page)
    const antes = await lerTeste(t.testId)
    const cookies = await context.cookies()
    const sessao = cookies.filter((c) => /^sb-/.test(c.name))
    expect(sessao.length, 'há cookie de sessão para apagar').toBeGreaterThan(0)
    await context.clearCookies({ name: /^sb-/ })
    const trocas: string[] = []
    page.on('response', (r) => { if (r.request().headers()['next-action']) trocas.push(`${r.request().method()} ${r.status()} ${r.url().replace(baseURL!, '')} ${r.headers()['location'] ?? ''}`) })
    await dlg.getByRole('button', { name: 'Encerrar e ficar com B' }).click()
    await page.waitForTimeout(3000)
    info.annotations.push({ type: 'rede', description: JSON.stringify(trocas) })
    const url = page.url()
    const texto = await page.locator('body').innerText()
    const depois = await lerTeste(t.testId)
    const yt = await estadoFalso()
    info.annotations.push({ type: 'observado', description: JSON.stringify({ url, status: depois.status, escritas: yt.escritas, trecho: texto.match(/Sessão expirada[^\n]*|Não foi possível[^\n]*|Entrar[^\n]*/)?.[0] ?? null }) })
    await foto(page, nomeDaFoto('E6', 'sessao-expirada', info, tema))
    expect(depois.status, 'estado do teste intocado').toBe(antes.status)
    expect(yt.escritas, 'nada escrito no YouTube').toEqual([])
    const login = /\/cms\/login/.test(url) || /sess[ãa]o expirada/i.test(texto)
    expect(login, `redirecionou ao login ou disse "Sessão expirada" (url=${url})`).toBe(true)
    expect(texto).not.toMatch(/^Encerrado$/m)
    void coleta
  })

  test('E7a: título editado por fora: alertdialog "Trocar mesmo assim?", foco em Voltar, Voltar devolve à escolha com B marcada, só o botão de trocar envia forcar', async ({ page, context, baseURL }, info) => {
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
    // foco em Voltar
    const focado = await page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return a ? `${a.tagName}:${(a.textContent ?? '').trim().slice(0, 30)}` : '' })
    expect.soft(focado, 'foco inicial no alertdialog está em "Voltar"').toBe('BUTTON:Voltar')
    expect(corpos.length).toBe(1)
    expect(corpos[0]).not.toMatch(/"forcar":\s*true|forcar.{0,6}true/)
    // Voltar
    await alerta.getByRole('button', { name: 'Voltar' }).click()
    await expect(alerta).toHaveCount(0)
    await expect(dialogoEncerrar(page).getByRole('radio', { name: 'Variante B' })).toBeChecked()
    expect((await estadoFalso()).escritas).toEqual([])
    // confirmar de fato
    await dialogoEncerrar(page).getByRole('button', { name: 'Encerrar e ficar com B' }).click()
    await expect(alerta).toBeVisible()
    await alerta.getByRole('button', { name: 'Trocar pelo título de B e encerrar' }).click()
    await expect.poll(async () => (await lerTeste(t.testId)).status, { timeout: 20_000 }).toBe('completed')
    expect(corpos.at(-1)).toMatch(/true/)
    expect((await estadoFalso()).titulo).toBe(TITULOS.B)
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
    await foto(page, nomeDaFoto('E7', 'os-dois', info, tema))
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
    const corpo = p.corpo.split(t.testId).join(t2.testId).replace('{"destino":"original"}', `{"destino":"variante","varianteId":"${t2.varB}"}`)
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
