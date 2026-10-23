// Gio, F1a-tela-2 (T9, envio B): "Mudar minha resposta" de ponta a ponta (pergunta no modo mudar -> troca -> volta ao respondido), conferido no banco
// (`resposta_dono`, `variante_vencedora`, `respondido_em` preservado, `resposta_mudada_em`) e no `audit_log`; "Manter", Esc, conflito resolvido ou mantido,
// "o teste mudou" (nao_respondida), "já tinha respondido em outra tela", "a troca foi gravada; a lista ainda não atualizou" + Atualizar, rede lenta e
// foco/anúncio depois do sucesso (D-4 do envio A). Texto sempre a partir de `FRASES`.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { FRASES } from '../src/lib/youtube/teste-youtube/nativo/frases'
import { AUTH_F1A, abrirLista, abrirPergunta, fotoB, lerBanco, lerFoco, linha, prepararB, registrarB, semAnimacao, soNoProjeto, largura } from './ab-lab-f1a-tela-2-suporte/comum-b'
import { consultar, executar, T } from './ab-lab-f1a-tela-2-suporte/semente'
import { VIDEOS_B } from './ab-lab-f1a-tela-2-suporte/semente-b'

test.use({ storageState: AUTH_F1A })
const D = FRASES.dia14

const verTeste = (li: Locator): Locator => li.getByRole('button', { name: FRASES.conflito.verTeste, exact: true })
const mudarLink = (li: Locator): Locator => li.getByRole('button', { name: FRASES.respondido.mudar, exact: true })
const cartao = (b: Locator, i: number): Locator => b.locator('.cn-d14-vopt').nth(i)
const outra = (b: Locator, t: string): Locator => b.getByRole('group', { name: 'Outra resposta' }).getByRole('button', { name: t, exact: true })
const manter = (b: Locator): Locator => b.getByRole('button', { name: D.manter, exact: true })
const altura = async (l: Locator): Promise<number> => Math.round((await l.boundingBox())!.height * 10) / 10

async function abrirRespondido(page: Page, li: Locator): Promise<Locator> {
  await verTeste(li).click()
  const b = li.locator('section.cn-d14')
  await expect(b).toBeVisible()
  await expect(mudarLink(li)).toBeVisible()
  return b
}
interface Audit { action: string; after_data: Record<string, unknown> }
const auditorias = (registroId: string): Promise<Audit[]> => consultar<Audit>(`select action, after_data from audit_log where resource_id = $1 and action like 'ab_native_%' order by created_at`, [registroId])

/** Grava num array do window o texto de cada mudança da região viva da lista (o que o leitor de tela ouviria). */
async function vigiarAnuncios(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __anuncios: string[] }
    w.__anuncios = []
    // observa o documento (não um nó fixo): o React pode trocar o elemento da região viva na hidratação e um observador preso ao nó antigo perde a fala
    let ultimo = ''
    const ler = (): void => {
      const t = Array.from(document.querySelectorAll('[data-testid="anuncio-dia-14"]')).map((e) => (e.textContent ?? '').trim()).join('').trim()
      if (!t) { ultimo = ''; return }
      if (t !== ultimo) { ultimo = t; w.__anuncios.push(t) }
    }
    const ligar = (): void => {
      if (!document.documentElement) { setTimeout(ligar, 10); return }
      new MutationObserver(ler).observe(document.documentElement, { childList: true, characterData: true, subtree: true })
    }
    ligar()
  })
}
const anuncios = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __anuncios: string[] }).__anuncios)

// ── Step 3 do envio B: a troca grava no banco ─────────────────────────────────────────────────────────────────────────────────────────────
interface Troca { para: string; botao: (b: Locator) => Locator; mudada: string; resposta: string; variante: number | null; selo: string; estado?: string }
const FLUXOS: Array<{ nome: string; chave: string; troca1: Troca; troca2: Troca }> = [
  { nome: 'ficha de 2 versões: B -> "Não vi" -> B', chave: 'm2',
    troca1: { para: 'Não vi', botao: (b) => outra(b, D.naoVi), mudada: D.mudadaSemVersao.nao_vi, resposta: 'nao_vi', variante: null, selo: D.seloSemVencedor.nao_vi },
    troca2: { para: 'B', botao: (b) => cartao(b, 1), mudada: D.mudadaPara('B', false), resposta: 'venceu_nova', variante: 2, selo: D.seloNoAr('B') } },
  { nome: 'ficha de 3 versões: B -> C -> A (original)', chave: 'm3',
    troca1: { para: 'C', botao: (b) => cartao(b, 2), mudada: D.mudadaPara('C', false), resposta: 'venceu_nova', variante: 3, selo: D.seloNoAr('C') },
    troca2: { para: 'A (original)', botao: (b) => cartao(b, 0), mudada: D.mudadaPara('A', true), resposta: 'venceu_original', variante: 1, selo: D.seloOriginal } },
  { nome: 'derivada sem original: B -> "Inconclusivo" -> A', chave: 'md',
    troca1: { para: 'Inconclusivo', botao: (b) => outra(b, D.inconclusivo), mudada: D.mudadaSemVersao.inconclusivo, resposta: 'inconclusivo', variante: null, selo: D.seloSemVencedor.inconclusivo },
    troca2: { para: 'A', botao: (b) => cartao(b, 0), mudada: D.mudadaPara('A', false), resposta: 'venceu_nova', variante: 1, selo: D.seloNoArTitulo(VIDEOS_B.md!.titulo) } },
]
for (const f of FLUXOS) {
  test(`Step 3 (B), ${f.nome}: "Mudar minha resposta" grava no banco (respondido_em preservado, resposta_mudada_em) e no audit_log`, async ({ page, context }, info) => {
    test.skip(!soNoProjeto(info), 'fluxo com escrita: um projeto basta')
    test.setTimeout(240_000)
    await vigiarAnuncios(page)
    const a = await prepararB(page, context, info, [f.chave])
    const v = a.m.v[f.chave]!
    const antes = await lerBanco(v.id)
    expect(antes.resposta_mudada_em, 'ponto de partida: nunca mudada').toBeNull()
    await abrirLista(page); await semAnimacao(page)
    const li = linha(page, a.m, f.chave)
    const b0 = await abrirRespondido(page, li)
    const h0 = await altura(b0)
    await fotoB(page, info, `mudar-${f.chave}-0-respondido`, li)

    // 1) abre a pergunta em modo mudar
    await mudarLink(li).click()
    const bm = li.locator('section.cn-d14')
    await expect(bm.getByRole('heading', { name: D.pergunta })).toBeVisible()
    await expect(bm.locator('.cn-d14-aviso')).toHaveText(D.avisoMudar)
    await expect(manter(bm)).toBeVisible()
    expect(await bm.locator('.pri:visible').count(), 'nenhum primário no modo mudar').toBe(0)
    await expect(bm.locator('.cn-d14-vopt[aria-pressed="true"]'), 'exatamente uma resposta atual marcada').toHaveCount(1)
    await expect(bm.locator('.cn-d14-vopt[aria-pressed="true"] .cn-d14-lbl')).toContainText(D.suaRespostaCartao)
    const foco0 = await lerFoco(page, v.id)
    expect(foco0, 'foco no título da pergunta ao abrir o modo mudar').toMatchObject({ tag: 'H3', dentroDaLinha: true })
    const h1 = await altura(bm)
    await fotoB(page, info, `mudar-${f.chave}-1-pergunta`, li)

    // 2) a 1ª troca
    const n0 = a.posts.length
    await f.troca1.botao(bm).click()
    await expect(li.getByText(f.troca1.mudada, { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => (await lerBanco(v.id)).resposta_dono, { timeout: 20_000 }).toBe(f.troca1.resposta)
    const r1 = await lerBanco(v.id)
    expect.soft({ resposta_dono: r1.resposta_dono, variante: r1.variante_vencedora }, 'banco depois da 1ª troca').toEqual({ resposta_dono: f.troca1.resposta, variante: f.troca1.variante })
    expect.soft(r1.respondido_em, 'respondido_em (1ª resposta) preservado').toBe(antes.respondido_em)
    expect.soft(r1.resposta_mudada_em, 'resposta_mudada_em gravado').not.toBeNull()
    expect.soft(r1.estado, 'a troca nunca devolve a linha a em_andamento').not.toBe('em_andamento')
    expect(a.posts.length - n0, 'uma action só').toBe(1)
    // a lista releu: volta ao bloco respondido, com a resposta nova e "Resposta mudada em …"
    await expect(li.locator('.cn-d14-res')).toContainText(f.troca1.selo, { timeout: 20_000 })
    await expect(li.locator('section.cn-d14')).toContainText(FRASES.respondido.mudadaEm(new Date(r1.resposta_mudada_em!)))
    const foco1 = await lerFoco(page, v.id)
    registrarB(info, `mudar:${f.chave}:foco-depois-da-troca`, { foco1, h0, h1 })
    expect(foco1, 'depois da troca o foco está no link "Mudar minha resposta", dentro da janela').toMatchObject({ acao: 'mudar-resposta', naTela: true })
    await fotoB(page, info, `mudar-${f.chave}-2-depois-da-1a-troca`, li)

    // 3) a 2ª troca (de volta)
    await mudarLink(li).click()
    const bm2 = li.locator('section.cn-d14')
    await expect(bm2.getByRole('heading', { name: D.pergunta })).toBeVisible()
    await f.troca2.botao(bm2).click()
    await expect(li.getByText(f.troca2.mudada, { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => (await lerBanco(v.id)).resposta_dono, { timeout: 20_000 }).toBe(f.troca2.resposta)
    const r2 = await lerBanco(v.id)
    expect.soft({ resposta_dono: r2.resposta_dono, variante: r2.variante_vencedora }, 'banco depois da 2ª troca').toEqual({ resposta_dono: f.troca2.resposta, variante: f.troca2.variante })
    expect.soft(r2.respondido_em, 'respondido_em segue o da 1ª resposta').toBe(antes.respondido_em)
    expect.soft(Date.parse(r2.resposta_mudada_em!), 'resposta_mudada_em avança').toBeGreaterThanOrEqual(Date.parse(r1.resposta_mudada_em!))
    await expect(li.locator('.cn-d14-res')).toContainText(f.troca2.selo, { timeout: 20_000 })
    registrarB(info, `mudar:${f.chave}:banco`, { antes, r1, r2 })

    // audit_log: duas linhas "resposta_mudada" com o estado anterior de cada troca
    const aud = (await auditorias(r2.id)).filter((x) => x.action === 'ab_native_resposta_mudada')
    expect(aud, 'duas linhas de auditoria da troca').toHaveLength(2)
    expect.soft(aud[0]!.after_data).toMatchObject({ resposta_dono: f.troca1.resposta, resposta_anterior: 'venceu_nova', variante_anterior: 2 })
    expect.soft(aud[1]!.after_data).toMatchObject({ resposta_dono: f.troca2.resposta, resposta_anterior: f.troca1.resposta })
    expect.soft(Date.parse(String(aud[0]!.after_data.respondido_em_anterior)), 'a auditoria guarda o respondido_em da 1ª resposta').toBe(Date.parse(antes.respondido_em!))
    // anúncio (o que um leitor de tela ouve): cada confirmação uma vez
    const falas = await anuncios(page)
    registrarB(info, `mudar:${f.chave}:anuncios`, { falas })
    expect.soft(falas.filter((t) => t === f.troca1.mudada), `anúncio "${f.troca1.mudada}" uma vez`).toHaveLength(1)
    expect.soft(falas.filter((t) => t === f.troca2.mudada), `anúncio "${f.troca2.mudada}" uma vez`).toHaveLength(1)
    expect.soft(a.coleta.erros, 'console').toEqual([])
  })
}

// ── Manter, Esc, tocar na resposta que já vale: nada é gravado; o foco volta ao link ────────────────────────────────────────────────────────
for (const [nome, sair] of [
  ['"Manter a resposta atual"', async (b: Locator): Promise<void> => { await manter(b).click() }],
  ['Esc', async (b: Locator): Promise<void> => { await b.page().keyboard.press('Escape') }],
  ['tocar na versão que já vale', async (b: Locator): Promise<void> => { await cartao(b, 1).click() }],
] as const) {
  test(`${nome} fecha o modo mudar sem gravar nada e devolve o foco ao link visível (sem salto do bloco)`, async ({ page, context }, info) => {
    test.skip(!soNoProjeto(info) && !soNoProjeto(info, 'l390-dark'), '1440 e 390')
    const a = await prepararB(page, context, info, ['m2'])
    const v = a.m.v.m2!
    const antes = await lerBanco(v.id)
    await abrirLista(page); await semAnimacao(page)
    const li = linha(page, a.m, 'm2')
    const b0 = await abrirRespondido(page, li)
    const h0 = await altura(b0)
    const doc = (): Promise<number> => page.evaluate(() => document.documentElement.scrollHeight)
    const y0 = await doc()
    await mudarLink(li).click()
    const bm = li.locator('section.cn-d14')
    await expect(bm.getByRole('heading', { name: D.pergunta })).toBeVisible()
    const yMudar = await doc()
    const posts = a.posts.length
    await sair(bm)
    await expect(mudarLink(li)).toBeVisible()
    await page.waitForTimeout(300)
    const h1 = await altura(li.locator('section.cn-d14'))
    const y1 = await doc()
    const foco = await lerFoco(page, v.id)
    registrarB(info, `sair-do-mudar:${nome}`, { h0, h1, diferenca: h1 - h0, alturaDaPaginaAntes: y0, alturaDaPaginaMudar: yMudar, alturaDaPaginaDepois: y1, foco })
    expect(a.posts.length - posts, 'nenhuma action').toBe(0)
    expect(await lerBanco(v.id), 'banco intacto').toEqual(antes)
    expect(foco, 'o foco volta ao link "Mudar minha resposta", dentro da janela').toMatchObject({ acao: 'mudar-resposta', naTela: true })
    expect(Math.abs(h1 - h0), 'bloco respondido: mesma altura antes e depois (0 px)').toBeLessThanOrEqual(1)
    expect(Math.abs(y1 - y0), 'a página volta à altura de antes (nada empurrado)').toBeLessThanOrEqual(1)
  })
}

// ── Conflito: troca que resolve, troca que mantém ──────────────────────────────────────────────────────────────────────────────────────────
test('conflito resolvido: mudar para a versão que está no ar tira a linha de "Respostas diferentes" (vira "Ficou no ar")', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info))
  const a = await prepararB(page, context, info, ['c_regra'])
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'c_regra')
  await expect(li).toHaveAttribute('data-estado', 'respostas_diferentes')
  await li.getByRole('button', { name: FRASES.conflito.verAsDuas, exact: true }).click()
  await mudarLink(li).click()
  const bm = li.locator('section.cn-d14')
  await expect(bm.locator('.cn-d14-vopt[aria-pressed="true"] .cn-d14-lbl')).toContainText(D.suaRespostaCartao)
  await cartao(bm, 0).click()
  await expect(li).toHaveAttribute('data-estado', 'ficou_no_ar', { timeout: 20_000 })
  const r = await lerBanco(a.m.v.c_regra!.id)
  expect(r.resposta_dono).toBe('venceu_original')
  expect(r.variante_vencedora).toBe(1)
  registrarB(info, 'conflito-resolvido', { r })
  await expect(li.locator('.st, .cn-d14-res').first()).toContainText(D.seloOriginal)
  expect(await li.getByText(FRASES.conflito.selo).count(), 'sai o selo de conflito').toBe(0)
})

test('conflito mantido: mudar para OUTRA versão que também difere do título no ar mostra "Respostas diferentes" (não "Ficou no ar")', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info))
  const a = await prepararB(page, context, info, ['c_data'])
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'c_data')
  await li.getByRole('button', { name: FRASES.conflito.verAsDuas, exact: true }).click()
  await mudarLink(li).click()
  const bm = li.locator('section.cn-d14')
  await cartao(bm, 0).click() // A (original); o Lab leu B no ar -> segue diferente
  await expect.poll(async () => (await lerBanco(a.m.v.c_data!.id)).resposta_dono, { timeout: 20_000 }).toBe('venceu_original')
  await expect(li).toHaveAttribute('data-estado', 'respostas_diferentes', { timeout: 20_000 })
  await expect(li.locator('p.fr')).toContainText(FRASES.conflito.linha('B', 'A'))
  await fotoB(page, info, 'mudar-c_data-conflito-mantido', li)
  expect(await li.getByText(D.seloNoAr('A')).count(), 'nunca "Ficou no ar" num conflito').toBe(0)
})

// ── "O teste mudou" (nao_respondida) e "já tinha respondido em outra tela" ─────────────────────────────────────────────────────────────────
test('mudou (nao_respondida): a resposta sumiu por fora; a troca não grava e mostra "O teste mudou enquanto a tela estava aberta." + Atualizar', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info))
  const a = await prepararB(page, context, info, ['m2'])
  const v = a.m.v.m2!
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'm2')
  await abrirRespondido(page, li)
  await mudarLink(li).click()
  const bm = li.locator('section.cn-d14')
  await expect(bm.getByRole('heading', { name: D.pergunta })).toBeVisible()
  // por fora (outra aba): a resposta é apagada e o registro volta a "sem resposta"
  await executar(`update ab_native_tests set resposta_dono=null, respondido_em=null, variante_vencedora=null, vencedor_fonte=null, vencedor_titulo=null, estado='em_andamento', encerrado_em=null where video_id=$1`, [v.id])
  const antes = await lerBanco(v.id)
  const posts = a.posts.length
  await outra(bm, D.ficouIgual).click()
  const alerta = li.getByRole('alert')
  await expect(alerta).toContainText(FRASES.guarda.estadoMudou, { timeout: 20_000 })
  expect(a.posts.length - posts, 'uma tentativa só').toBe(1)
  expect(await lerBanco(v.id), 'nada foi gravado').toEqual(antes)
  const foco = await lerFoco(page, v.id)
  registrarB(info, 'mudou-nao-respondida', { foco })
  await fotoB(page, info, 'mudar-m2-mudou', li)
  await alerta.getByRole('button', { name: FRASES.guarda.atualizar, exact: true }).click()
  await expect(li).toHaveAttribute('data-estado', 'sem_resposta', { timeout: 20_000 }) // m2 foi confirmado há 16 d: sem resposta e já passou do prazo
  await expect(li.getByRole('button', { name: D.responder })).toBeVisible()
})

test('"Você já tinha respondido em outra tela.": a 1ª resposta é recusada porque outra aba respondeu antes; Atualizar mostra o respondido', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info))
  const a = await prepararB(page, context, info, [])
  const v = a.m.v.sm!
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'sm')
  const bloco = await abrirPergunta(page, li)
  await executar(`update ab_native_tests set resposta_dono='venceu_nova', variante_vencedora=2, respondido_em=now(), vencedor_fonte='dono', vencedor_titulo=$2, estado='encerrado', encerrado_em=now() where video_id=$1`, [v.id, T.SMB])
  await outra(bloco, D.inconclusivo).click()
  const alerta = li.getByRole('alert')
  await expect(alerta).toContainText(FRASES.respondido.jaTinhaRespondido, { timeout: 20_000 })
  expect((await lerBanco(v.id)).resposta_dono, 'a resposta da outra aba não foi sobrescrita').toBe('venceu_nova')
  await fotoB(page, info, 'ja-respondido-outra-tela', li)
  await alerta.getByRole('button', { name: FRASES.guarda.atualizar, exact: true }).click()
  await expect(li).toHaveAttribute('data-estado', 'ficou_no_ar', { timeout: 20_000 })
  await expect(li).toContainText(D.seloNoAr('B'))
})

// ── Foco depois do sucesso da 1ª resposta (D-4 do envio A) e anúncio ───────────────────────────────────────────────────────────────────────
test('D-4 (envio A): depois da 1ª resposta o foco NÃO cai no body: fica no link "Mudar minha resposta" (na janela) e o leitor ouve "Registrado: …" uma vez', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info) && !soNoProjeto(info, 'l390-dark'), '1440 e 390')
  await vigiarAnuncios(page)
  const a = await prepararB(page, context, info, [])
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'sm')
  const bloco = await abrirPergunta(page, li)
  await cartao(bloco, 1).click()
  await expect(li).toHaveAttribute('data-estado', 'ficou_no_ar', { timeout: 20_000 })
  await expect(mudarLink(li)).toBeVisible({ timeout: 20_000 })
  // espera por condição (nunca por tempo fixo): o anúncio aparece na região viva e o observador o registra
  await expect.poll(async () => (await anuncios(page)).filter((t) => t === FRASES.respondido.registradaVersao('B')).length, { timeout: 5_000, message: 'o anúncio "Registrado: …" chegou à região viva' }).toBeGreaterThan(0)
  const foco = await lerFoco(page, a.m.v.sm!.id)
  const falas = await anuncios(page)
  const status = await li.locator('[role=status]').allInnerTexts()
  registrarB(info, 'D-4-foco-depois-da-1a-resposta', { foco, falas, status })
  expect(foco.ehBody, `o foco não caiu no body (${JSON.stringify(foco)})`).toBe(false)
  expect(foco, 'foco no link "Mudar minha resposta", dentro da janela').toMatchObject({ acao: 'mudar-resposta', naTela: true, dentroDaLinha: true })
  expect(falas.filter((t) => t === FRASES.respondido.registradaVersao('B')), 'anúncio "Registrado: …" uma vez').toHaveLength(1)
  await fotoB(page, info, 'primeira-resposta-foco', li)
})

// ── "A troca foi gravada; a lista ainda não atualizou" + Atualizar; a confirmação nunca dá lugar ao dado velho ───────────────────────────
test('a troca foi gravada e a releitura não vem: a confirmação fica (nunca volta ao dado velho), em 8 s aparece "A troca foi gravada; a lista ainda não atualizou." + Atualizar', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info) && !soNoProjeto(info, 'l390-dark'), '1440 e 390')
  test.setTimeout(180_000)
  const a = await prepararB(page, context, info, ['m2'])
  const v = a.m.v.m2!
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'm2')
  await abrirRespondido(page, li)
  await mudarLink(li).click()
  const bm = li.locator('section.cn-d14')
  await expect(bm.getByRole('heading', { name: D.pergunta })).toBeVisible()
  // segura TODA releitura RSC (GET com _rsc) até eu soltar
  let solto = false
  const presas: Array<() => void> = []
  await page.route(/[?&]_rsc=/, async (rota) => {
    if (!solto && rota.request().method() === 'GET') await new Promise<void>((ok) => { presas.push(ok) })
    await rota.continue().catch(() => undefined)
  })
  const velho = [D.seloNoAr('B'), D.fraseNoAr('B')]
  await outra(bm, D.naoVi).click()
  const conf = D.mudadaSemVersao.nao_vi
  await expect(li.getByText(conf, { exact: true }).first()).toBeVisible({ timeout: 20_000 })
  const amostras: Array<{ t: number; confirmacao: boolean; velho: boolean; aviso: boolean; atualizar: boolean; altura: number }> = []
  const t0 = Date.now()
  while (Date.now() - t0 < 11_000) {
    amostras.push(await li.evaluate((el, [c, vs, aviso]) => {
      const txt = (el as HTMLElement).innerText
      const sec = el.querySelector('section.cn-d14') as HTMLElement | null
      return { t: Math.round(performance.now()), confirmacao: txt.includes(c as string), velho: (vs as string[]).some((x) => txt.includes(x)), aviso: txt.includes(aviso as string), atualizar: !!Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Atualizar'), altura: sec ? Math.round(sec.getBoundingClientRect().height) : -1 }
    }, [conf, velho, D.trocaSemReleitura] as const))
    await page.waitForTimeout(500)
  }
  const algumVelho = amostras.filter((x) => x.velho)
  const semConf = amostras.filter((x) => !x.confirmacao)
  const aviso = amostras.find((x) => x.aviso)
  registrarB(info, 'troca-sem-releitura', { n: amostras.length, algumVelho: algumVelho.length, semConfirmacao: semConf.length, primeiroAviso: aviso ? aviso.t - amostras[0]!.t : null, alturas: [...new Set(amostras.map((x) => x.altura))], presas: presas.length })
  expect(algumVelho, 'em nenhum instante a tela mostra o selo/frase da resposta antiga').toHaveLength(0)
  expect(semConf, 'a confirmação fica enquanto a releitura não vem').toHaveLength(0)
  expect(aviso, 'depois de ~8 s aparece "A troca foi gravada; a lista ainda não atualizou."').toBeDefined()
  expect(aviso!.atualizar, 'com o botão Atualizar').toBe(true)
  expect(amostras.slice(0, 6).filter((x) => x.aviso), 'o aviso não aparece antes de ~8 s').toHaveLength(0)
  expect((await lerBanco(v.id)).resposta_dono, 'a troca está gravada no banco').toBe('nao_vi')
  await fotoB(page, info, 'mudar-m2-troca-sem-releitura', li)
  // solta a releitura e clica Atualizar: volta ao respondido com o dado novo
  solto = true; presas.forEach((f) => f())
  await li.getByRole('button', { name: FRASES.guarda.atualizar, exact: true }).click().catch(() => undefined)
  await expect(li.locator('.cn-d14-res')).toContainText(D.seloSemVencedor.nao_vi, { timeout: 30_000 })
  await expect(mudarLink(li)).toBeVisible()
})

test('rede lenta (CDP: latência 1,5 s, 400 kbit/s): a troca termina com o dado novo e a tela nunca mostra a resposta antiga depois da confirmação', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info, 'l390-dark'), 'celular com rede ruim: 390')
  test.setTimeout(180_000)
  const a = await prepararB(page, context, info, ['m2'])
  const v = a.m.v.m2!
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'm2')
  await abrirRespondido(page, li)
  await mudarLink(li).click()
  const bm = li.locator('section.cn-d14')
  await expect(bm.getByRole('heading', { name: D.pergunta })).toBeVisible()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 1500, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 })
  const conf = D.mudadaSemVersao.nao_vi
  const t0 = Date.now()
  await outra(bm, D.naoVi).click()
  const amostras: Array<{ ms: number; salvando: boolean; confirmacao: boolean; velho: boolean; novo: boolean }> = []
  const velho = [D.seloNoAr('B'), D.fraseNoAr('B')]
  while (Date.now() - t0 < 25_000) {
    amostras.push(await li.evaluate((el, [c, vs, novo, t]) => {
      const txt = (el as HTMLElement).innerText
      return { ms: Date.now() - (t as number), salvando: txt.includes('Salvando'), confirmacao: txt.includes(c as string), velho: (vs as string[]).some((x) => txt.includes(x)), novo: txt.includes(novo as string) }
    }, [conf, velho, D.seloSemVencedor.nao_vi, t0] as const))
    if (amostras[amostras.length - 1]!.novo && !amostras[amostras.length - 1]!.confirmacao) break
    await page.waitForTimeout(300)
  }
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  const iConf = amostras.findIndex((x) => x.confirmacao)
  const aposConf = iConf < 0 ? [] : amostras.slice(iConf)
  const velhoDepois = aposConf.filter((x) => x.velho)
  const fim = amostras[amostras.length - 1]!
  registrarB(info, 'rede-lenta', { amostras: amostras.length, ateConfirmacaoMs: iConf < 0 ? null : amostras[iConf]!.ms, ateDadoNovoMs: fim.novo ? fim.ms : null, velhoDepoisDaConfirmacao: velhoDepois.length })
  expect(velhoDepois, 'depois da confirmação nunca aparece a resposta antiga').toHaveLength(0)
  await expect(li.locator('.cn-d14-res')).toContainText(D.seloSemVencedor.nao_vi, { timeout: 30_000 })
  expect((await lerBanco(v.id)).resposta_dono).toBe('nao_vi')
  expect(largura(info)).toBe(390)
})

// ── Sem conexão no modo mudar ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('modo mudar com a rede cortada: "Sem conexão. A resposta continua a mesma. Tente de novo." com foco; "Tentar de novo" reenvia uma vez', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info, 'l390-dark'), 'celular: 390')
  const a = await prepararB(page, context, info, ['m2'], { naoEsperadas: [/ERR_INTERNET_DISCONNECTED/, /Failed to fetch/, /Failed to load resource/] })
  const v = a.m.v.m2!
  const antes = await lerBanco(v.id)
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'm2')
  await abrirRespondido(page, li)
  await mudarLink(li).click()
  const bm = li.locator('section.cn-d14')
  await expect(bm.getByRole('heading', { name: D.pergunta })).toBeVisible()
  await context.setOffline(true)
  await outra(bm, D.naoVi).click()
  const alerta = bm.getByRole('alert')
  await expect(alerta).toContainText(D.semConexaoMudar, { timeout: 20_000 })
  const foco = await page.evaluate(() => { const e = document.activeElement as HTMLElement; return { role: e?.getAttribute('role') } })
  expect(foco, 'foco no aviso').toMatchObject({ role: 'alert' })
  expect(await lerBanco(v.id), 'nada gravado').toEqual(antes)
  await fotoB(page, info, 'mudar-m2-sem-conexao', bm)
  await context.setOffline(false)
  const posts = a.posts.length
  await alerta.getByRole('button', { name: D.tentarDeNovo, exact: true }).click()
  await expect.poll(async () => (await lerBanco(v.id)).resposta_dono, { timeout: 20_000 }).toBe('nao_vi')
  expect(a.posts.length - posts, 'reenvia uma vez só').toBe(1)
})
