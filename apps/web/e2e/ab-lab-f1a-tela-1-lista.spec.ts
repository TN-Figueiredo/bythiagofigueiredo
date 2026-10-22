// Gio, F1a-tela-1 (T12): a lista do caminho do teste do YouTube. Cada estado é alcançado por interação (clique, Esc, banco travado),
// nunca por URL de mockup. Roda nos quatro projetos (1440/390 × escuro/claro): cada teste mede (Step 2) e captura (Step 4).
import { expect, test } from '@playwright/test'
import { FRASES, capitalizar } from '../src/lib/youtube/teste-youtube/nativo/frases'
import { AUTH_F1A, abrirLista, foto, linha, medirEAfirmar, preparar, semAnimacao, soNoProjeto, largura } from './ab-lab-f1a-tela-1-suporte/comum'
import { conectar, prepararFicha, T } from './ab-lab-f1a-tela-1-suporte/semente'

test.use({ storageState: AUTH_F1A })

const L = FRASES.lista

test('lista cheia: resumo, grupos, rodapé e uma linha por estado', async ({ page, context }, info) => {
  const a = await preparar(page, context, info)
  const lista = await abrirLista(page)
  await semAnimacao(page)
  // Resumo: contagem só depois da leitura, com a frase exata (D-7)
  await expect(lista).toContainText(L.esperam(2, 1, 1))
  await expect(lista).toContainText(`${capitalizar(L.emTesteNoStudio(2))}, ${L.emPreparo(1)}. ${L.labPausadoDeles(2)}`)
  await expect(lista.getByText('Precisa de você', { exact: true })).toBeVisible()
  await expect(lista.getByText('Outros vídeos', { exact: true })).toBeVisible()
  await expect(lista).toContainText(L.rodape)
  // Uma linha por vídeo, com o estado e o texto certos
  const esperado: Record<string, { estado: string; texto: string[]; botoes: string[] }> = {
    sp: { estado: 'sem_resposta', texto: ['Sem resposta', 'O prazo acabou em'], botoes: ['Responder'] },
    sm: { estado: 'resultado_pronto', texto: ['Resultado do YouTube pronto', 'Os 14 dias acabaram em'], botoes: ['Responder'] },
    lv: { estado: 'em_teste_studio', texto: ['Em teste no Studio', 'Parece haver um teste no Studio: o título alterna desde', 'Lab pausado porque há teste no Studio.'], botoes: ['Ver teste'] },
    mu: { estado: 'em_teste_studio', texto: ['Em teste no Studio', 'Você confirmou em', 'Lab pausado porque há teste no Studio.'], botoes: ['Ver teste'] },
    r66: { estado: 'sugerido_youtube', texto: ['Caminho sugerido: teste do YouTube', 'Impressões por dia: não medido'], botoes: ['Testar no YouTube', 'Prefiro outro caminho'] },
    sh: { estado: 'sugerido_nosso', texto: ['Caminho sugerido: nosso teste', 'Short: o Studio não oferece o teste.'], botoes: ['Iniciar teste'] },
    ut: { estado: 'formato_nao_confirmado', texto: ['Formato não confirmado', 'Escolha o caminho:'], botoes: ['Testar no YouTube', 'Iniciar teste'] },
    mv: { estado: 'em_preparo', texto: ['Teste do YouTube em preparo', 'Ficha salva. Falta ligar o teste no Studio.'], botoes: ['Continuar'] },
    fl: { estado: 'ficou_no_ar', texto: [FRASES.dia14.seloNova, FRASES.dia14.fraseNova, FRASES.dia14.oficial], botoes: ['Ver teste'] },
    ch: { estado: 'respostas_diferentes', texto: [FRASES.dia14.respostasDiferentes, FRASES.dia14.respostasDiferentesFrase], botoes: [] },
    gl: { estado: 'sem_volume', texto: ['Sem volume para teste', 'Publicado há 40 dias, 12 impressões por dia; o piso é 220.'], botoes: ['Trocar direto'] },
  }
  for (const [k, e] of Object.entries(esperado)) {
    const li = linha(page, a.m, k)
    await expect(li, `${k}: estado`).toHaveAttribute('data-estado', e.estado)
    for (const t of e.texto) await expect(li, `${k}: "${t}"`).toContainText(t)
    const rot = await li.locator('button').allInnerTexts()
    expect(rot.map((s) => s.trim()).filter(Boolean), `${k}: botões`).toEqual(expect.arrayContaining(e.botoes))
  }
  // Palavras proibidas na tela (glossário): "variante", "nativo", "detectado"
  const txt = await lista.innerText()
  for (const p of ['variante', 'nativo', 'detectado']) expect(txt.toLowerCase(), `palavra proibida "${p}"`).not.toContain(p)
  await foto(page, info, 'lista')
  await medirEAfirmar(page, lista, 'lista', info, a.coleta, { maxPri: 2 })
  // No máximo 1 `.pri` por LINHA/painel; a lista inteira admite os primários de sp e sm (as duas respostas pendentes) conforme o mockup
  expect(await lista.locator('.pri:visible').count()).toBeLessThanOrEqual(2)
})

test('lista carregando: esqueleto ±4 px da lista pronta (1ª visita e visita seguinte) e sem contagem 0', async ({ page, context }, info) => {
  const a = await preparar(page, context, info)
  // Segura a leitura da lista travando a tabela de fichas: a página sai com o esqueleto (Suspense) até o banco soltar.
  const comEsqueleto = async (acao: () => Promise<void>, gruposEsperados: number): Promise<number> => {
    const trava = await conectar()
    try {
      await trava.query('begin')
      await trava.query('lock table public.ab_native_fichas in access exclusive mode')
      await acao()
      await expect(page.getByText(L.carregando.frase)).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText(L.contadorCarregando).first()).toBeVisible()
      await expect(page.locator('li[data-linha]')).toHaveCount(0)
      // O esqueleto lê o localStorage depois de hidratar: mede só quando os cabeçalhos de grupo chegaram.
      await expect(page.locator('[data-skel-grupo]')).toHaveCount(gruposEsperados, { timeout: 15_000 })
      await semAnimacao(page)
      const h = (await page.getByRole('region', { name: 'Vídeos do A/B Lab' }).boundingBox())?.height ?? 0
      expect(h, 'esqueleto medido').toBeGreaterThan(100)
      expect(await page.locator('body').innerText()).not.toMatch(/\b0 vídeos?\b/)
      return h
    } finally {
      await trava.query('rollback').catch(() => undefined)
      await trava.end()
    }
  }
  // 1ª visita: sem contagem guardada
  const primeira = await comEsqueleto(async () => { await page.goto('/cms/youtube/ab-lab', { waitUntil: 'commit' }) }, 0)
  await foto(page, info, 'lista-carregando')
  const lista = await abrirLista(page)
  await semAnimacao(page)
  const pronta = (await lista.boundingBox())?.height ?? 0
  // Visita seguinte: a lista gravou a contagem (localStorage) e o esqueleto a usa
  const seguinte = await comEsqueleto(async () => { await page.reload({ waitUntil: 'commit' }) }, 2)
  await foto(page, info, 'lista-carregando-2')
  test.info().annotations.push({ type: 'altura', description: `${info.project.name}: 1a visita ${primeira.toFixed(1)} | seguinte ${seguinte.toFixed(1)} | lista ${pronta.toFixed(1)}` })
  require('node:fs').appendFileSync('/Users/figueiredo/Workspace/bythiagofigueiredo/.superpowers/sdd/ab-lab/f1a-tela-1/gio-medidas.jsonl', JSON.stringify({ estado: 'esqueleto', projeto: info.project.name, primeira, seguinte, pronta }) + '\n')
  expect(Math.abs(seguinte - pronta), `esqueleto (visita seguinte) ${seguinte} vs lista ${pronta}`).toBeLessThanOrEqual(4)
  expect.soft(Math.abs(primeira - pronta), `esqueleto (1a visita, sem contagem guardada) ${primeira} vs lista ${pronta}`).toBeLessThanOrEqual(4)
  void a
})

test('linha-outro: "Prefiro outro caminho" troca a linha sem chamar o servidor, guarda por vídeo e volta', async ({ page, context }, info) => {
  const a = await preparar(page, context, info)
  const lista = await abrirLista(page)
  await semAnimacao(page)
  const li = linha(page, a.m, 'r66')
  const antes = a.posts.length
  await li.getByRole('button', { name: 'Prefiro outro caminho' }).click()
  await expect(li).toContainText('Caminho escolhido por você: nosso teste')
  await expect(li.getByRole('button', { name: 'Iniciar teste' })).toBeVisible()
  await expect(li.getByRole('button', { name: 'Prefiro o teste do YouTube' })).toBeVisible()
  expect(a.posts.length, 'D-2: sem chamada ao servidor').toBe(antes)
  await foto(page, info, 'linha-outro', li)
  await medirEAfirmar(page, lista, 'linha-outro', info, a.coleta, { maxPri: 2 })
  // Recarregar: a escolha continua (sessionStorage por vídeo)
  await page.reload()
  await expect(linha(page, a.m, 'r66')).toContainText('Caminho escolhido por você: nosso teste')
  // Voltar
  await linha(page, a.m, 'r66').getByRole('button', { name: 'Prefiro o teste do YouTube' }).click()
  await expect(linha(page, a.m, 'r66')).toContainText('Caminho sugerido: teste do YouTube')
  // sessionStorage lançando: a lista segue sem erro
  await page.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('bloqueado') } }) })
  await page.reload()
  await expect(linha(page, a.m, 'r66')).toBeVisible()
  await linha(page, a.m, 'r66').getByRole('button', { name: 'Prefiro outro caminho' }).click()
  await expect(linha(page, a.m, 'r66')).toContainText('Caminho escolhido por você: nosso teste')
  expect(a.coleta.erros.filter((e) => !/bloqueado/.test(e))).toEqual([])
})

test('D-8: pergunta na linha (ficha sem B), sem .pri, sem dialog, foco, Esc e vizinha sem salto', async ({ page, context }, info) => {
  const a = await preparar(page, context, info)
  // ficha só com a A, enviada ao Studio há 3 dias (a linha ut, formato não confirmado, continua com "Iniciar teste")
  await prepararFicha(a.m, 'ut', { variantes: [{ n: 1, titulo: T.ut, imagem: null }] as never, criadaEm: new Date(a.m.agora.getTime() - 4 * 86_400_000), studioAbertoEm: new Date(a.m.agora.getTime() - 3 * 86_400_000) })
  const lista = await abrirLista(page)
  await semAnimacao(page)
  const li = linha(page, a.m, 'ut')
  const iniciar = li.getByRole('button', { name: 'Iniciar teste' })
  const proxima = li.locator('xpath=following-sibling::li[1]')
  const yAntes = (await proxima.boundingBox())?.y ?? 0
  await iniciar.click()
  await expect(li).toContainText(FRASES.guarda.pergunta)
  await expect(li).toContainText(FRASES.guarda.perguntaIncompleta)
  await expect(li.getByRole('button', { name: FRASES.guarda.aindaNaoSeguir })).toBeVisible()
  expect(await page.getByRole('dialog').count(), 'sem role=dialog').toBe(0)
  await expect(iniciar).toBeDisabled()
  expect(await li.locator('.pri:visible').count(), 'pergunta sem .pri').toBe(0)
  const foco = await page.evaluate(() => document.activeElement?.textContent ?? '')
  expect(foco, 'foco no título da pergunta').toContain(FRASES.guarda.pergunta)
  const yDepois = (await proxima.boundingBox())?.y ?? 0
  const alturaDoBloco = (await li.locator('.cn-pergunta, [class*=pergunta]').first().boundingBox().catch(() => null))?.height ?? 400
  expect(yDepois - yAntes, 'a vizinha não pula mais que o bloco aberto').toBeLessThanOrEqual(alturaDoBloco + 8)
  await foto(page, info, 'd8-pergunta', li)
  await medirEAfirmar(page, lista, 'd8-pergunta', info, a.coleta, { maxPri: 2 })
  await page.keyboard.press('Escape')
  await expect(li).not.toContainText(FRASES.guarda.pergunta)
  await expect(iniciar).toBeFocused()
  // "Ainda não, seguir com o nosso teste" abre o assistente sem gravar nada
  const fichasAntes = (await import('./ab-lab-f1a-tela-1-suporte/semente')).contarFichas
  const n0 = await fichasAntes(a.m.v.ut!.id)
  await iniciar.click()
  await li.getByRole('button', { name: FRASES.guarda.aindaNaoSeguir }).click()
  await expect(page.getByRole('dialog').first()).toBeVisible()
  expect(await fichasAntes(a.m.v.ut!.id), 'nada gravado').toBe(n0)
})

test.describe('respostas sem vencedor, dia 14 sem botão e prazo tardio', () => {
  test('selos neutros: ficou igual, inconclusivo, não vi (sem "Ficou no ar")', async ({ page, context }, info) => {
    const a = await preparar(page, context, info, { extras: ['sv_igual', 'sv_inconcl', 'sv_navi'] })
    const lista = await abrirLista(page)
    await semAnimacao(page)
    const casos = [['sv_igual', 'ficou_igual', FRASES.resposta.ficouIgual], ['sv_inconcl', 'inconclusivo', FRASES.resposta.inconclusivo], ['sv_navi', 'nao_vi', FRASES.resposta.naoVi]] as const
    for (const [k, r, frase] of casos) {
      const li = linha(page, a.m, k)
      await expect(li).toHaveAttribute('data-estado', 'respondido_sem_vencedor')
      await expect(li).toContainText(FRASES.dia14.seloSemVencedor[r])
      await expect(li).toContainText(frase)
      await expect(li).not.toContainText('Ficou no ar')
      await expect(li).not.toContainText('Mudar minha resposta')
    }
    await foto(page, info, 'sem-vencedor', lista)
    await medirEAfirmar(page, lista, 'sem-vencedor', info, a.coleta, { maxPri: 2 })
  })
  test('dia 14 com três versões ou derivada: frase honesta de D-1, sem botão Responder', async ({ page, context }, info) => {
    const a = await preparar(page, context, info, { extras: ['tres', 'derivada'] })
    const lista = await abrirLista(page)
    await semAnimacao(page)
    for (const k of ['tres', 'derivada']) {
      const li = linha(page, a.m, k)
      await expect(li).toContainText(FRASES.resposta.semBotao)
      await expect(li.getByRole('button', { name: 'Responder' })).toHaveCount(0)
    }
    await foto(page, info, 'd14-sem-botao', lista)
    await medirEAfirmar(page, lista, 'd14-sem-botao', info, a.coleta, { maxPri: 2 })
  })
  test('título hostil (90 letras sem espaço, emoji, aspas, <script>) não estoura a largura', async ({ page, context }, info) => {
    const a = await preparar(page, context, info, { extras: ['hostil'] })
    const lista = await abrirLista(page)
    await semAnimacao(page)
    await expect(linha(page, a.m, 'hostil')).toBeVisible()
    const sw = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, w: window.innerWidth }))
    expect(sw.s, 'scrollWidth == innerWidth').toBeLessThanOrEqual(sw.w)
    await foto(page, info, 'titulo-hostil', linha(page, a.m, 'hostil'))
    await medirEAfirmar(page, lista, 'titulo-hostil', info, a.coleta, { maxPri: 2 })
  })
})
void soNoProjeto

test('console limpo na lista: nenhum aviso de `key` do React (F-1)', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info), 'um projeto basta: o aviso é do render, não do tema')
  const a = await preparar(page, context, info, { naoEsperadas: [] })
  const avisos: string[] = []
  page.on('console', (m) => { if (/unique "key" prop/.test(m.text())) avisos.push(m.text().replace(/\s+/g, ' ').slice(0, 220)) })
  await abrirLista(page)
  expect(avisos, 'aviso de key no console (AbLabDashboard, "passed a child from AbLabPage")').toEqual([])
  void a
})
