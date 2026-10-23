// Gio, F1a-tela-2 (T9, envio A): a pergunta do dia 14 com 2 e 3 versões, ficha e derivada (com e sem o título de antes), "sem resposta", `sem_versoes`,
// as quatro respostas gravadas no banco, rede cortada, "Salvando…" sem salto de altura e o lembrete (sino, e-mail e link `?video=`).
// Texto sempre a partir de `FRASES`. "Mudar minha resposta", respondido e conflito são do envio B: fora daqui.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { FRASES } from '../src/lib/youtube/teste-youtube/nativo/frases'
import { AUTH_F1A, abrirLista, abrirPergunta, fecharPergunta, foto, linha, preparar, registrar, semAnimacao, soNoProjeto, medirEAfirmar } from './ab-lab-f1a-tela-2-suporte/comum'
import { consultar, DIA, refazer, T, TIT, type Mundo } from './ab-lab-f1a-tela-2-suporte/semente'

test.use({ storageState: AUTH_F1A })
const D = FRASES.dia14
const HORA = 3_600_000
const re = (s: string): RegExp => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

interface Esperado {
  chave: string
  rotulos: string[]
  titulos: string[]
  letras: string[]
  apoio: string
  miniaturas: number
  tardia?: Date
}
const letras = (n: number): string[] => ['A', 'B', 'C'].slice(0, n)
const dataDe = (m: Mundo, ms: number): Date => new Date(m.agora.getTime() - ms)

const esperados = (m: Mundo): Record<string, Esperado> => ({
  'd14-duas': { chave: 'sm', rotulos: [D.originalFicou, D.venceu('B')], titulos: [T.sm, T.SMB], letras: letras(2), apoio: D.apoio(dataDe(m, 14 * DIA + HORA)), miniaturas: 2 },
  'd14-tres': { chave: 'tres', rotulos: [D.originalFicou, D.venceu('B'), D.venceu('C')], titulos: [m.v.tres!.titulo, 'tres: a segunda versão', 'tres: a terceira versão'], letras: letras(3), apoio: D.apoio(dataDe(m, 14 * DIA + HORA)), miniaturas: 3 },
  'd14-derivada': { chave: 'derivada', rotulos: [D.ficou('A'), D.ficou('B')], titulos: [m.v.derivada!.titulo, TIT.novoDer], letras: letras(2), apoio: D.apoioDerivadaSemOriginal, miniaturas: 0 },
  'd14-derivada-com-original': { chave: 'sv_igual', rotulos: [D.originalFicou, D.venceu('B')], titulos: [TIT.antes, TIT.novoDerOrig], letras: letras(2), apoio: D.apoioDerivada, miniaturas: 0 },
  'd14-tardia-ask-tres': { chave: 'sv_navi', rotulos: [D.originalFicou, D.venceu('B'), D.venceu('C')], titulos: [m.v.sv_navi!.titulo, 'sv_navi: a segunda versão', 'sv_navi: a terceira versão'], letras: letras(3), apoio: D.apoio(dataDe(m, 17 * DIA + HORA)), miniaturas: 3, tardia: dataDe(m, 3 * DIA + HORA) },
  'd14-tardia-ask-derivada': { chave: 'sv_inconcl', rotulos: [D.originalFicou, D.venceu('B'), D.venceu('C')], titulos: [TIT.antes, TIT.tardiaDer[0], TIT.tardiaDer[1]], letras: letras(3), apoio: D.apoioDerivada, miniaturas: 0, tardia: dataDe(m, 11 * DIA + HORA) },
  'd14-tardia-ask-duas': { chave: 'tardia_lv', rotulos: [D.originalFicou, D.venceu('B')], titulos: [m.v.tardia_lv!.titulo, 'Tardia: a versão nova'], letras: letras(2), apoio: D.apoio(dataDe(m, 25 * DIA)), miniaturas: 2, tardia: dataDe(m, 11 * DIA) },
})

/** Texto exato do bloco: título, apoio, aviso ACIMA da grade, cartões (letra, título, rótulo), "Outra resposta" e nenhum primário. */
async function conferirPergunta(bloco: Locator, e: Esperado): Promise<void> {
  await expect(bloco.getByRole('heading', { name: D.pergunta })).toBeVisible()
  await expect(bloco).toContainText(e.apoio)
  const prazo = e.tardia ? FRASES.resposta.tardia(e.tardia) : null
  if (prazo) await expect(bloco).toContainText(prazo)
  else await expect(bloco).not.toContainText('O prazo acabou')
  await expect(bloco.locator('.cn-d14-aviso')).toHaveText(D.avisoResponder)
  const ordem = await bloco.evaluate((s) => {
    const av = s.querySelector('.cn-d14-aviso')!; const gr = s.querySelector('.cn-d14-grid')!; const ou = s.querySelector('.cn-d14-other')!
    return { avisoAntesDaGrade: !!(av.compareDocumentPosition(gr) & Node.DOCUMENT_POSITION_FOLLOWING), gradeAntesDeOutra: !!(gr.compareDocumentPosition(ou) & Node.DOCUMENT_POSITION_FOLLOWING) }
  })
  expect(ordem, 'aviso -> grade -> outras respostas').toEqual({ avisoAntesDaGrade: true, gradeAntesDeOutra: true })
  const grupo = bloco.getByRole('group', { name: D.versoes })
  const cartoes = grupo.locator('.cn-d14-vopt')
  await expect(cartoes).toHaveCount(e.rotulos.length)
  await expect(cartoes.locator('.cn-d14-lbl')).toHaveText(e.rotulos)
  await expect(cartoes.locator('.cn-d14-top q')).toHaveText(e.titulos)
  const chips = await cartoes.evaluateAll((els) => els.map((el) => (el.querySelector('.cn-d14-top > :first-child') as HTMLElement).innerText.trim()))
  expect(chips).toEqual(e.letras)
  const titulosDoAtributo = await cartoes.locator('.cn-d14-top q').evaluateAll((qs) => qs.map((q) => q.getAttribute('title')))
  expect(titulosDoAtributo, 'title traz o texto completo').toEqual(e.titulos)
  await expect(grupo.locator('.cn-d14-th')).toHaveCount(e.miniaturas)
  const outra = bloco.getByRole('group', { name: 'Outra resposta' })
  await expect(outra).toContainText(D.outra)
  for (const t of [D.ficouIgual, D.inconclusivo, D.naoVi]) await expect(outra.getByRole('button', { name: t, exact: true })).toBeVisible()
  expect(await bloco.locator('.pri:visible').count(), 'o bloco do dia 14 não tem botão primário').toBe(0)
  expect(await bloco.getByText(/variante/i).count(), 'nunca "variante" na pergunta').toBe(0)
}

for (const estado of ['d14-duas', 'd14-tres', 'd14-derivada', 'd14-derivada-com-original', 'd14-tardia-ask-tres', 'd14-tardia-ask-derivada', 'd14-tardia-ask-duas'] as const) {
  test(`${estado}: chega pela interação ("Responder"), texto exato e rótulos por versão`, async ({ page, context }, info) => {
    test.skip(!soNoProjeto(info), 'texto exato: um projeto basta; as medidas por largura e tema estão no spec de medidas')
    const a = await preparar(page, context, info)
    const e = esperados(a.m)[estado]!
    await abrirLista(page); await semAnimacao(page)
    const li = linha(page, a.m, e.chave)
    await expect(li).toHaveAttribute('data-estado', e.tardia ? 'sem_resposta' : 'resultado_pronto')
    const bloco = await abrirPergunta(page, li)
    await conferirPergunta(bloco, e)
    await foto(page, info, estado, bloco)
    // "Responder" de novo fecha, sem gravar nada
    await fecharPergunta(li)
    expect(await consultar('select 1 from ab_native_tests where video_id=$1 and resposta_dono is not null and resposta_dono <> $2', [a.m.v[e.chave]!.id, 'sem_resposta'])).toHaveLength(0)
    expect(a.posts, 'abrir e fechar não chama nenhuma action').toHaveLength(0)
    expect.soft(a.coleta.erros).toEqual([])
  })
}

test('"A ficou" (derivada sem original) se distingue de "A (original) ficou" pelo texto, não só pelo chip (Naksu S-2)', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info))
  const a = await preparar(page, context, info)
  await abrirLista(page); await semAnimacao(page)
  const sem = await abrirPergunta(page, linha(page, a.m, 'derivada'))
  const rotulosSem = await sem.locator('.cn-d14-lbl').allInnerTexts()
  await fecharPergunta(linha(page, a.m, 'derivada'))
  const com = await abrirPergunta(page, linha(page, a.m, 'sv_igual'))
  const rotulosCom = await com.locator('.cn-d14-lbl').allInnerTexts()
  registrar(test.info(), 'rotulos-derivada', { sem: rotulosSem, com: rotulosCom })
  expect(rotulosSem[0]).toBe('A ficou')
  expect(rotulosCom[0]).toBe('A (original) ficou')
  expect(rotulosSem[0]).not.toContain('original')
})

test('sem_versoes: só a frase de apoio e as três respostas; sem cartões de versão', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info))
  const a = await preparar(page, context, info)
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'gl')
  await expect(li).toHaveAttribute('data-estado', 'resultado_pronto')
  const bloco = await abrirPergunta(page, li)
  await expect(bloco).toContainText(D.apoioSemVersoes)
  await expect(bloco.locator('.cn-d14-aviso')).toHaveText(D.avisoResponder)
  await expect(bloco.locator('.cn-d14-vopt')).toHaveCount(0)
  await expect(bloco.locator('.cn-d14-grid')).toHaveCount(0)
  await expect(bloco.getByRole('heading')).toHaveCount(0)
  const outra = bloco.getByRole('group', { name: D.suaResposta.replace(/:$/, '') })
  await expect(outra).toContainText(D.suaResposta)
  for (const t of [D.ficouIgual, D.inconclusivo, D.naoVi]) await expect(outra.getByRole('button', { name: t, exact: true })).toBeVisible()
  expect(await bloco.getByText(re(D.pergunta)).count(), 'sem versões não pergunta "qual versão"').toBe(0)
  await foto(page, info, 'sem_versoes', bloco)
  // grava "Não vi" sem versão
  await outra.getByRole('button', { name: D.naoVi, exact: true }).click()
  await expect.poll(async () => (await consultar<{ resposta_dono: string }>('select resposta_dono from ab_native_tests where video_id=$1', [a.m.v.gl!.id]))[0]?.resposta_dono, { timeout: 20_000 }).toBe('nao_vi')
})

// ── Step 3: as quatro ações respondem e ficam gravadas ──────────────────────────────────────────────────────────────────────────────────────────
interface Caso { botao: (b: Locator) => Locator; resposta: string; variante: number | null; estado: string; vencedor_titulo: string | null; vencedor_fonte: string | null; selo: string | RegExp; nome: string }
const outras = (b: Locator, t: string): Locator => b.getByRole('group', { name: 'Outra resposta' }).getByRole('button', { name: t, exact: true })
const versao = (b: Locator, rotulo: string): Locator => b.locator('.cn-d14-vopt', { hasText: re(rotulo) })
const casosSemVencedor = (): Caso[] => [
  { nome: 'Ficou igual', botao: (b) => outras(b, D.ficouIgual), resposta: 'ficou_igual', variante: null, estado: 'encerrado', vencedor_titulo: null, vencedor_fonte: null, selo: D.seloSemVencedor.ficou_igual },
  { nome: 'Inconclusivo', botao: (b) => outras(b, D.inconclusivo), resposta: 'inconclusivo', variante: null, estado: 'encerrado', vencedor_titulo: null, vencedor_fonte: null, selo: D.seloSemVencedor.inconclusivo },
  { nome: 'Não vi', botao: (b) => outras(b, D.naoVi), resposta: 'nao_vi', variante: null, estado: 'sem_desfecho', vencedor_titulo: null, vencedor_fonte: null, selo: D.seloSemVencedor.nao_vi },
]
const FLUXOS: Array<{ nome: string; chave: string; casos: (m: Mundo) => Caso[] }> = [
  { nome: 'ficha de 2 versões', chave: 'sm', casos: () => [
    { nome: 'B venceu', botao: (b) => versao(b, 'B venceu'), resposta: 'venceu_nova', variante: 2, estado: 'encerrado', vencedor_titulo: T.SMB, vencedor_fonte: 'dono', selo: D.seloNoAr('B') },
    { nome: 'A (original) ficou', botao: (b) => versao(b, 'A (original) ficou'), resposta: 'venceu_original', variante: 1, estado: 'encerrado', vencedor_titulo: T.sm, vencedor_fonte: 'dono', selo: D.seloOriginal },
    ...casosSemVencedor()] },
  { nome: 'ficha de 3 versões', chave: 'tres', casos: (m) => [
    { nome: 'C venceu', botao: (b) => versao(b, 'C venceu'), resposta: 'venceu_nova', variante: 3, estado: 'encerrado', vencedor_titulo: 'tres: a terceira versão', vencedor_fonte: 'dono', selo: D.seloNoAr('C') },
    { nome: 'B venceu', botao: (b) => versao(b, 'B venceu'), resposta: 'venceu_nova', variante: 2, estado: 'encerrado', vencedor_titulo: 'tres: a segunda versão', vencedor_fonte: 'dono', selo: D.seloNoAr('B') },
    { nome: 'A (original) ficou', botao: (b) => versao(b, 'A (original) ficou'), resposta: 'venceu_original', variante: 1, estado: 'encerrado', vencedor_titulo: m.v.tres!.titulo, vencedor_fonte: 'dono', selo: D.seloOriginal },
    ...casosSemVencedor()] },
  { nome: 'derivada sem original', chave: 'derivada', casos: (m) => [
    { nome: 'B ficou', botao: (b) => versao(b, 'B ficou'), resposta: 'venceu_nova', variante: 2, estado: 'encerrado', vencedor_titulo: TIT.novoDer, vencedor_fonte: 'dono', selo: D.seloNoAr('B') },
    { nome: 'A ficou', botao: (b) => versao(b, 'A ficou'), resposta: 'venceu_nova', variante: 1, estado: 'encerrado', vencedor_titulo: m.v.derivada!.titulo, vencedor_fonte: 'dono', selo: D.seloNoAr('A') },
    ...casosSemVencedor()] },
  { nome: 'derivada com original', chave: 'sv_igual', casos: () => [
    { nome: 'A (original) ficou', botao: (b) => versao(b, 'A (original) ficou'), resposta: 'venceu_original', variante: 1, estado: 'encerrado', vencedor_titulo: TIT.antes, vencedor_fonte: 'dono', selo: D.seloOriginal },
    { nome: 'B venceu', botao: (b) => versao(b, 'B venceu'), resposta: 'venceu_nova', variante: 2, estado: 'encerrado', vencedor_titulo: TIT.novoDerOrig, vencedor_fonte: 'dono', selo: D.seloNoAr('B') }] },
  // Linha ainda "em_andamento" no banco, mas já "Sem resposta" na tela (o prazo passou, o fechamento por silêncio não rodou): a resposta fecha o teste.
  { nome: 'sem resposta (prazo passado, ainda em andamento) de 3 versões', chave: 'sv_navi', casos: () => [
    { nome: 'B venceu', botao: (b) => versao(b, 'B venceu'), resposta: 'venceu_nova', variante: 2, estado: 'encerrado', vencedor_titulo: 'sv_navi: a segunda versão', vencedor_fonte: 'dono', selo: D.seloNoAr('B') },
    { nome: 'C venceu', botao: (b) => versao(b, 'C venceu'), resposta: 'venceu_nova', variante: 3, estado: 'encerrado', vencedor_titulo: 'sv_navi: a terceira versão', vencedor_fonte: 'dono', selo: D.seloNoAr('C') }] },
  // Linha já fechada por silêncio (`sem_desfecho` + `sem_resposta`): a resposta tardia grava a resposta e a posição; o estado fica como está (D-6).
  { nome: 'resposta tardia (fechada por silêncio) de ficha de 2 versões', chave: 'tardia_lv', casos: (m) => [
    { nome: 'B venceu', botao: (b) => versao(b, 'B venceu'), resposta: 'venceu_nova', variante: 2, estado: 'encerrado', vencedor_titulo: 'Tardia: a versão nova', vencedor_fonte: 'dono', selo: D.seloNoAr('B') },
    { nome: 'A (original) ficou', botao: (b) => versao(b, 'A (original) ficou'), resposta: 'venceu_original', variante: 1, estado: 'encerrado', vencedor_titulo: m.v.tardia_lv!.titulo, vencedor_fonte: 'dono', selo: D.seloOriginal }] },
  { nome: 'resposta tardia (fechada por silêncio) de derivada de 3 títulos com original', chave: 'sv_inconcl', casos: () => [
    { nome: 'C venceu', botao: (b) => versao(b, 'C venceu'), resposta: 'venceu_nova', variante: 3, estado: 'encerrado', vencedor_titulo: TIT.tardiaDer[1], vencedor_fonte: 'dono', selo: D.seloNoAr('C') },
    { nome: 'A (original) ficou', botao: (b) => versao(b, 'A (original) ficou'), resposta: 'venceu_original', variante: 1, estado: 'encerrado', vencedor_titulo: TIT.antes, vencedor_fonte: 'dono', selo: D.seloOriginal }] },
]

for (const fluxo of FLUXOS) {
  test(`Step 3, ${fluxo.nome}: cada ação responde e fica gravada (resposta_dono, variante_vencedora, estado, vencedor_titulo)`, async ({ page, context }, info) => {
    test.skip(!soNoProjeto(info), 'fluxo com escrita: um projeto basta')
    test.setTimeout(240_000)
    const a = await preparar(page, context, info)
    for (const caso of fluxo.casos(a.m)) {
      await refazer(a.m, fluxo.chave)
      await abrirLista(page); await semAnimacao(page)
      const li = linha(page, a.m, fluxo.chave)
      const bloco = await abrirPergunta(page, li)
      const antesPosts = a.posts.length
      await caso.botao(bloco).click()
      await expect.poll(async () => (await consultar<{ resposta_dono: string | null }>('select resposta_dono from ab_native_tests where video_id=$1', [a.m.v[fluxo.chave]!.id]))[0]?.resposta_dono, { timeout: 20_000, message: `${fluxo.nome} / ${caso.nome}: resposta_dono` }).toBe(caso.resposta)
      const linhas = await consultar<{ resposta_dono: string; variante_vencedora: number | null; estado: string; vencedor_titulo: string | null; vencedor_fonte: string | null; respondido_em: string | null; resposta_mudada_em: string | null }>(
        'select resposta_dono, variante_vencedora, estado, vencedor_titulo, vencedor_fonte, respondido_em, resposta_mudada_em from ab_native_tests where video_id=$1', [a.m.v[fluxo.chave]!.id])
      expect(linhas, `${fluxo.nome} / ${caso.nome}: um registro só`).toHaveLength(1)
      expect.soft({ resposta_dono: linhas[0]!.resposta_dono, variante_vencedora: linhas[0]!.variante_vencedora, estado: linhas[0]!.estado, vencedor_titulo: linhas[0]!.vencedor_titulo, vencedor_fonte: linhas[0]!.vencedor_fonte },
        `${fluxo.nome} / ${caso.nome}: o que ficou no banco`).toEqual({ resposta_dono: caso.resposta, variante_vencedora: caso.variante, estado: caso.estado, vencedor_titulo: caso.vencedor_titulo, vencedor_fonte: caso.vencedor_fonte })
      expect.soft(linhas[0]!.respondido_em, `${fluxo.nome} / ${caso.nome}: respondido_em gravado`).not.toBeNull()
      expect.soft(linhas[0]!.resposta_mudada_em, `${fluxo.nome} / ${caso.nome}: 1ª resposta não é troca`).toBeNull()
      expect.soft(a.posts.length - antesPosts, `${fluxo.nome} / ${caso.nome}: exatamente uma action`).toBe(1)
      // a tela mostra o resultado certo (selo com a letra, nunca "Ficou no ar" para "sem vencedor")
      await expect.soft(li, `${fluxo.nome} / ${caso.nome}: selo`).toContainText(caso.selo, { timeout: 20_000 })
      if (/ficou_igual|inconclusivo|nao_vi/.test(caso.resposta)) await expect.soft(li).not.toContainText('Ficou no ar')
      await expect.soft(li.locator('section.cn-d14 [role=alert]'), `${fluxo.nome} / ${caso.nome}: sem alerta`).toHaveCount(0)
      registrar(info, `step3:${fluxo.nome}:${caso.nome}`, { banco: linhas[0] })
      // o resultado de um caso por tema/largura para a comparação com o mockup
      if (fluxo.nome === 'ficha de 3 versões' && caso.nome === 'C venceu') await foto(page, info, 'd14-tres-respondido-C', li)
    }
    expect.soft(a.coleta.erros, 'erros de console').toEqual([])
  })
}

// ── Rede cortada e "Salvando…" ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('rede cortada no meio do envio (390): "Sem conexão. Nada foi registrado." visível e com foco; "Tentar de novo" reenvia UMA vez e grava', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info, 'l390-dark'), 'celular: 390 px')
  const a = await preparar(page, context, info, { naoEsperadas: [/ERR_INTERNET_DISCONNECTED/, /Failed to fetch/, /Failed to load resource/] })
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'tres')
  const bloco = await abrirPergunta(page, li)
  await context.setOffline(true)
  await versao(bloco, 'B venceu').click()
  const alerta = bloco.getByRole('alert')
  await expect(alerta).toContainText(D.semConexao, { timeout: 20_000 })
  const foco = await page.evaluate(() => { const e = document.activeElement as HTMLElement | null; return { tag: e?.tagName ?? null, role: e?.getAttribute('role') ?? null, texto: (e?.innerText ?? '').slice(0, 60) } })
  expect(foco, 'foco no aviso de erro (não no body)').toMatchObject({ role: 'alert' })
  const box = await alerta.boundingBox()
  const vp = page.viewportSize()!
  expect(box!.y >= 0 && box!.y + box!.height <= vp.height, `o aviso está na tela de ${vp.height} px (y=${Math.round(box!.y)}, h=${Math.round(box!.height)})`).toBe(true)
  expect(await consultar('select 1 from ab_native_tests where video_id=$1 and resposta_dono is not null', [a.m.v.tres!.id]), 'nada gravado').toHaveLength(0)
  await foto(page, info, 'd14-sem-conexao', bloco)
  await medirEAfirmar(page, bloco, 'd14-sem-conexao', info, a.coleta)
  await context.setOffline(false)
  const antes = a.posts.length
  await alerta.getByRole('button', { name: D.tentarDeNovo }).click()
  await expect(li).toContainText(D.seloNoAr('B'), { timeout: 20_000 })
  expect(a.posts.length - antes, '"Tentar de novo" reenvia o pedido uma vez só').toBe(1)
  const r = await consultar<{ resposta_dono: string; variante_vencedora: number }>('select resposta_dono, variante_vencedora from ab_native_tests where video_id=$1', [a.m.v.tres!.id])
  expect(r).toEqual([{ resposta_dono: 'venceu_nova', variante_vencedora: 2 }])
})

test('enviando: a altura do bloco é a mesma antes e durante "Salvando…" (0 px) e nenhum botão aceita o 2º toque', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info) && !soNoProjeto(info, 'l390-dark'), '1440 e 390')
  const a = await preparar(page, context, info)
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'tres')
  const bloco = await abrirPergunta(page, li)
  let solta: () => void = () => undefined
  const segura = new Promise<void>((ok) => { solta = ok })
  await page.route('**/cms/youtube/ab-lab**', async (rota) => {
    if (rota.request().method() === 'POST' && rota.request().headers()['next-action']) { await segura }
    await rota.continue()
  })
  const antes = (await bloco.boundingBox())!.height
  const botao = versao(bloco, 'C venceu')
  await botao.click()
  await expect(bloco.locator('.cn-d14-lbl', { hasText: D.salvando })).toBeVisible()
  const durante = (await bloco.boundingBox())!.height
  registrar(info, 'enviando', { alturaAntes: antes, alturaDurante: durante, diferenca: durante - antes })
  await foto(page, info, 'd14-salvando', bloco)
  const desabilitados = await bloco.locator('button').evaluateAll((bs) => bs.map((b) => (b as HTMLButtonElement).disabled))
  expect(desabilitados.every(Boolean), 'todos os botões ficam desabilitados enquanto salva').toBe(true)
  expect(Math.abs(durante - antes), 'diferença de altura antes/durante o envio').toBeLessThanOrEqual(1)
  // 2º toque (forçado) no mesmo botão e em outro: nenhuma action nova
  const n0 = a.posts.length
  await botao.click({ force: true, timeout: 2000 }).catch(() => undefined)
  await versao(bloco, 'B venceu').click({ force: true, timeout: 2000 }).catch(() => undefined)
  solta()
  await expect(li).toContainText(/Ficou no ar: C/, { timeout: 20_000 })
  expect(a.posts.length - n0, 'os toques durante o envio não geram action').toBeLessThanOrEqual(0)
  const r = await consultar<{ resposta_dono: string; variante_vencedora: number }>('select resposta_dono, variante_vencedora from ab_native_tests where video_id=$1', [a.m.v.tres!.id])
  expect(r).toEqual([{ resposta_dono: 'venceu_nova', variante_vencedora: 3 }])
})

test('salto de layout "pergunta -> respondido": a vizinha não sobe/desce mais que a altura do bloco e o bloco fica na vista', async ({ page, context }, info) => {
  const a = await preparar(page, context, info)
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'tres')
  const viz = li.locator('xpath=following-sibling::li[1]')
  const y0 = (await viz.boundingBox())!.y
  const bloco = await abrirPergunta(page, li)
  const y1 = (await viz.boundingBox())!.y
  const alturaDoBloco = (await bloco.boundingBox())!.height
  expect(y1 - y0, 'a vizinha desce, e no máximo a altura do bloco').toBeLessThanOrEqual(alturaDoBloco + 2)
  if (!soNoProjeto(info) && !soNoProjeto(info, 'l390-dark')) { registrar(info, 'salto-aberto', { desceu: y1 - y0, bloco: alturaDoBloco }); return }
  await versao(bloco, 'B venceu').click()
  await expect(li).toContainText(D.seloNoAr('B'), { timeout: 20_000 })
  const y2 = (await viz.boundingBox())!.y
  const top = (await li.boundingBox())!.y
  const vp = page.viewportSize()!
  registrar(info, 'salto-layout', { vizinhaAntes: y0, vizinhaAberto: y1, vizinhaRespondido: y2, bloco: alturaDoBloco, saltoPerguntaParaRespondido: y2 - y1, topoDaLinha: top, viewportAltura: vp.height })
  expect(Math.abs(y2 - y1), 'a vizinha não pula mais que a altura do bloco ao responder').toBeLessThanOrEqual(alturaDoBloco)
  expect(top > -alturaDoBloco && top < vp.height, 'a linha respondida continua na vista').toBe(true)
})

// ── Foco depois do sucesso (item 11 de "Gio mede"): informa onde fica o foco e o que se anuncia ──────────────────────────────────────────────
test('depois do sucesso: onde fica o foco e o que é anunciado', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info))
  const a = await preparar(page, context, info)
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'sm')
  const bloco = await abrirPergunta(page, li)
  await versao(bloco, 'B venceu').click()
  await expect(li).toContainText(D.seloNoAr('B'), { timeout: 20_000 })
  await page.waitForTimeout(800)
  const foco = await page.evaluate(() => {
    const e = document.activeElement as HTMLElement | null
    const li = e?.closest('li[data-linha]')
    return { tag: e?.tagName ?? null, id: e?.id ?? null, texto: (e?.innerText ?? '').slice(0, 80), role: e?.getAttribute('role') ?? null, dentroDaLinha: !!li, ehBody: e === document.body }
  })
  const status = await li.locator('[role=status]').allInnerTexts()
  registrar(info, 'foco-depois-do-sucesso', { foco, status })
  test.info().annotations.push({ type: 'foco', description: `depois do sucesso o foco está em ${foco.ehBody ? 'BODY (perdido)' : `${foco.tag} ${foco.id}`}; status: ${JSON.stringify(status)}` })
})

// ── Lembrete: núcleo de `avisos_pendentes`, sino, e-mail e link ?video= ────────────────────────────────────────────────────────────────────────
test('lembrete do dia 14: o sino traz "Teste do YouTube: os 14 dias acabaram", o clique abre a linha COM a pergunta; a entrega email existe e o link do html abre a mesma linha', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info))
  test.setTimeout(240_000)
  const porta = process.env.F1A_PORTA ?? '3094'
  const a = await preparar(page, context, info)
  // só o site do Gio tem registros neste banco (conferido); aborta se houver registro de outro site: o núcleo lê a tabela inteira
  const outros = await consultar<{ n: string }>(`select count(*)::int as n from ab_native_tests t join sites s on s.id = t.site_id where s.slug <> 'gio-f1a-tela-1' and t.confirmado_em is not null and t.resposta_dono is null`)
  expect(Number(outros[0]!.n), 'nenhum registro de outro site seria lembrado').toBe(0)
  const saida = execFileSync('npx', ['tsx', '--tsconfig', 'tsconfig.json', 'e2e/ab-lab-f1a-tela-2-suporte/lembrete-nucleo.ts', a.m.v.tres!.yt], {
    cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 120_000,
    env: { ...process.env, NEXT_PUBLIC_APP_URL: `http://f1a.localhost:${porta}`, AWS_SES_ACCESS_KEY_ID: 'LOCALDUMMY', AWS_SES_SECRET_ACCESS_KEY: 'localdummy', NTFY_URL: 'http://127.0.0.1:9' },
  })
  const r = JSON.parse(saida.split('@@RESULTADO@@')[1]!) as {
    resultado: { estado: string; feitas: number; detalhe?: Record<string, number> }
    registro: { id: string; lembrete_notificado_em: string | null }
    notificacoes: Array<{ id: string; title: string; message: string; action_href: string }>
    entregas: Array<{ channel: string; status: string }>
    envio: { success: boolean } | null; enviosCapturados: number; html: string | null; assunto: string | null
  }
  registrar(info, 'lembrete-nucleo', r)
  expect(['ok', 'parcial'], `rodarAvisos: ${JSON.stringify(r.resultado)}`).toContain(r.resultado.estado)
  expect(r.resultado.detalhe?.lembrados ?? 0, 'ao menos o lembrete do dia 14 saiu').toBeGreaterThanOrEqual(1)
  expect(r.registro.lembrete_notificado_em, 'lembrete gravado no registro').not.toBeNull()
  expect(r.notificacoes.length, 'uma notificação por administrador do site').toBeGreaterThanOrEqual(1)
  expect(r.notificacoes[0]!.title).toBe('Teste do YouTube: os 14 dias acabaram')
  expect(r.notificacoes[0]!.message).toBe(`${a.m.v.tres!.titulo}. ${D.pergunta}`)
  expect(r.notificacoes[0]!.action_href).toBe(`/cms/youtube/ab-lab?video=${a.m.v.tres!.yt}`)
  expect(r.entregas.map((e) => e.channel), 'a entrega email existe (dono sem preferência -> canal padrão)').toContain('email')
  expect(r.envio, 'adaptador de e-mail real contra o sorvedouro local').toEqual({ success: true })
  expect(r.enviosCapturados, 'um e-mail montado; nenhum saiu da máquina').toBe(1)
  const href = /href="([^"]+)"/.exec(r.html ?? '')?.[1]
  expect(href, `link do html do e-mail (${r.html})`).toBe(`http://f1a.localhost:${porta}/cms/youtube/ab-lab?video=${a.m.v.tres!.yt}`)
  expect(r.html).toContain(`${a.m.v.tres!.titulo}. ${D.pergunta}`)
  const regTres = { youtube_video_id: a.m.v.tres!.yt }

  // Sino: do outro lugar do CMS, o aviso aparece e o clique abre a linha com a pergunta
  await page.goto('/cms')
  const sino = page.getByRole('button', { name: /Notifica/i }).first()
  await expect(sino).toBeVisible({ timeout: 30_000 })
  await sino.click()
  const item = page.getByText(a.m.v.tres!.titulo, { exact: false }).first()
  await expect(page.getByText('Teste do YouTube: os 14 dias acabaram').first()).toBeVisible({ timeout: 20_000 })
  await expect(item).toBeVisible()
  await foto(page, info, 'lembrete-sino')
  // A ação primária do aviso é o botão da própria linha do sino (o texto não navega); ele leva ao href gravado.
  const acao = item.locator('xpath=ancestor::*[.//button[@aria-label]][1]').getByRole('button', { name: /Abrir|Open|Ver|Responder/i }).first()
  await expect(acao, 'o aviso tem botão de ação').toBeVisible()
  await acao.click()
  await expect(page).toHaveURL(new RegExp(`/cms/youtube/ab-lab\\?video=${regTres.youtube_video_id}`), { timeout: 20_000 })
  const li = page.locator(`li[data-linha="${a.m.v.tres!.id}"]`)
  await expect(li, 'o link do aviso cai na linha do vídeo').toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1500)
  const abriu3 = await li.locator('section.cn-d14').count()
  registrar(info, 'lembrete-link-abre-pergunta', { ficha3: abriu3 > 0 })
  await foto(page, info, 'lembrete-aberto-pelo-sino')
  // Link do e-mail: a mesma linha. Para cada tipo de linha, a pergunta já vem aberta?
  const quem: Array<[string, string]> = [['tres', 'ficha de 3 versões'], ['sm', 'ficha de 2 versões'], ['derivada', 'derivada sem original'], ['sv_igual', 'derivada com original']]
  const achados: Record<string, boolean> = {}
  for (const [k] of quem) {
    await page.goto(`/cms/youtube/ab-lab?video=${a.m.v[k]!.yt}`)
    const l = page.locator(`li[data-linha="${a.m.v[k]!.id}"]`)
    await expect(l).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(1500)
    achados[k] = (await l.locator('section.cn-d14').count()) > 0
    if (k === 'tres') await foto(page, info, 'lembrete-aberto-pelo-email')
  }
  registrar(info, 'lembrete-link-por-tipo', achados)
  for (const [k, rot] of quem) expect.soft(achados[k], `?video= abre a pergunta já aberta: ${rot}`).toBe(true)
  void (null as unknown as Page)
})
