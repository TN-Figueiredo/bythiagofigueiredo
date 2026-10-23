// Gio, F1a-tela-1 (T12): estados da ficha que dependem de idade, tamanho de imagem e conclusão do Studio, alcançados por interação sobre dado semeado.
import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { FRASES } from '../src/lib/youtube/teste-youtube/nativo/frases'
import { AUTH_F1A, abrirFichaDaLinha, abrirLista, ficha, foto, linha, medirEAfirmar, preparar, semAnimacao, soNoProjeto } from './ab-lab-f1a-tela-1-suporte/comum'
import { BLOB, consultar, contarFichas, prepararFicha, T } from './ab-lab-f1a-tela-1-suporte/semente'

test.use({ storageState: AUTH_F1A })
const F = FRASES.ficha
const estreito = (i: { project: { name: string } }): boolean => i.project.name.startsWith('l390')
const DIA = 86_400_000
const im = (nome: string, largura = 1280, altura = 720) => ({ url: BLOB(nome), sha256: createHash('sha256').update(nome).digest('hex'), largura, altura })
const tres = (baixa: boolean) => [
  { n: 1, tipo: 'combo', titulo: T.ut, imagem: im('a-orig') },
  { n: 2, tipo: 'combo', titulo: 'Utah em 12 horas: B', imagem: im('b-img') },
  { n: 3, tipo: 'combo', titulo: 'Utah em 12 horas: C', imagem: baixa ? im('c-baixa', 640, 360) : im('c-img') },
] as never

test('ficha de três versões: frase de três, passo 2 cita A, B, C, sem "Resolução baixa"', async ({ page, context }, info) => {
  const a = await preparar(page, context, info)
  await prepararFicha(a.m, 'ut', { variantes: tres(false), criadaEm: new Date(a.m.agora.getTime() - DIA) })
  await abrirLista(page); await semAnimacao(page)
  const f = await abrirFichaDaLinha(page, a.m, 'ut', 'Continuar')
  if (estreito(info)) await expect(f).toContainText(FRASES.ficha.bloco2.ledeEstreita)
  else await expect(f).toContainText(/na ordem A, B, C/)
  await expect(f).not.toContainText('Resolução baixa')
  await foto(page, info, 'ficha-tres')
  await medirEAfirmar(page, f, 'ficha-tres', info, a.coleta)
})

test('ficha com imagem de resolução baixa: frase "Três versões prontas; …" com a letra', async ({ page, context }, info) => {
  const a = await preparar(page, context, info)
  await prepararFicha(a.m, 'ut', { variantes: tres(true), criadaEm: new Date(a.m.agora.getTime() - DIA) })
  await abrirLista(page); await semAnimacao(page)
  const f = await abrirFichaDaLinha(page, a.m, 'ut', 'Continuar')
  await expect(f).toContainText(/Três versões prontas; .*C/)
  await expect(f).toContainText('Com uma imagem menor, o Studio reduz todas as versões.')
  await foto(page, info, 'ficha-resolucao-baixa')
  await medirEAfirmar(page, f, 'ficha-resolucao-baixa', info, a.coleta)
})

test('imagem da versão B não carrega (404): "A imagem da versão B não carregou." e o resto continua salvo', async ({ page, context }, info) => {
  const a = await preparar(page, context, info, { naoEsperadas: [/status of 404/] })
  await page.route('**/ab-native-ficha/b-img.png', (r) => r.fulfill({ status: 404, body: 'nao' }))
  await prepararFicha(a.m, 'ut', { variantes: [{ n: 1, tipo: 'combo', titulo: T.ut, imagem: im('a-orig') }, { n: 2, tipo: 'combo', titulo: 'Utah em 12 horas: B', imagem: im('b-img') }] as never, criadaEm: new Date(a.m.agora.getTime() - DIA) })
  await abrirLista(page); await semAnimacao(page)
  const f = await abrirFichaDaLinha(page, a.m, 'ut', 'Continuar')
  await expect(f).toContainText(F.imagemFalhou('B').frase, { timeout: 15_000 })
  await expect(f).toContainText(F.imagemFalhou('B').apoio ?? '')
  await expect(f.locator('#cn-t2')).toHaveValue('Utah em 12 horas: B')
  await foto(page, info, 'ficha-imagem-falhou')
  await medirEAfirmar(page, f, 'ficha-imagem-falhou', info, a.coleta)
})

test('ficha parada há 13 dias: faixa "parada desde", frase "Amanhã ela é descartada"', async ({ page, context }, info) => {
  const a = await preparar(page, context, info)
  const velha = new Date(a.m.agora.getTime() - 13 * DIA - 3_600_000)
  await prepararFicha(a.m, 'ut', { variantes: tres(false), criadaEm: velha, atualizadaEm: velha })
  await abrirLista(page); await semAnimacao(page)
  const f = await abrirFichaDaLinha(page, a.m, 'ut', 'Continuar')
  await expect(f).toContainText(/Ficha parada desde \d\d\/\d\d/)
  await expect(f).toContainText('Amanhã ela é descartada se nada mudar.')
  await foto(page, info, 'ficha-parada-13d')
  await medirEAfirmar(page, f, 'ficha-parada-13d', info, a.coleta)
})

test('ficha vencida (15 dias): só consulta, sem "Abrir no Studio", "Começar outra" cria ficha nova com as versões', async ({ page, context }, info) => {
  const a = await preparar(page, context, info)
  const velha = new Date(a.m.agora.getTime() - 15 * DIA)
  await prepararFicha(a.m, 'ut', { variantes: tres(false), criadaEm: velha, atualizadaEm: velha })
  await abrirLista(page); await semAnimacao(page)
  const li = linha(page, a.m, 'ut')
  const estado = await li.getAttribute('data-estado')
  test.info().annotations.push({ type: 'estado-da-linha', description: String(estado) })
  await li.getByRole('button').first().click()
  const f = ficha(page)
  await expect(f).toBeVisible({ timeout: 20_000 })
  await expect(f).toContainText(/Esta ficha venceu em \d\d\/\d\d/)
  await expect(f).toContainText(F.vencida.frase)
  await expect(f.getByRole('button', { name: FRASES.ficha.bloco2.abrirNoStudio })).toHaveCount(0)
  await foto(page, info, 'ficha-vencida')
  await medirEAfirmar(page, f, 'ficha-vencida', info, a.coleta)
  if (!soNoProjeto(info)) return
  const antes = await contarFichas(a.m.v.ut!.id)
  await f.getByRole('button', { name: F.comecarOutra }).click()
  await expect(f.getByRole('button', { name: F.comecarOutra })).toHaveCount(0, { timeout: 20_000 }).catch(() => undefined)
  const todas = await consultar<{ atualizada_em: Date; descartada_em: Date | null; n: number }>('select atualizada_em, descartada_em, jsonb_array_length(variantes) n from ab_native_fichas where video_id=$1 and registro_id is null order by criada_em', [a.m.v.ut!.id])
  test.info().annotations.push({ type: 'fichas-depois', description: JSON.stringify(todas) + ` antes=${antes}` })
  const vivas = todas.filter((x) => !x.descartada_em && x.atualizada_em.getTime() > a.m.agora.getTime() - DIA)
  expect(vivas.length, 'uma ficha viva e recente com as versões (' + JSON.stringify(todas) + ')').toBeGreaterThanOrEqual(1)
  expect(vivas[0]!.n).toBe(3)
})

test('studio aberto (ficha enviada): pergunta "Você iniciou o teste no Studio?", "Já iniciei" abre a confirmação com o prazo', async ({ page, context }, info) => {
  test.skip(estreito(info), 'não se aplica a 390: no celular o Studio não abre (a ficha só vai ao computador)')
  const a = await preparar(page, context, info)
  await prepararFicha(a.m, 'ut', { variantes: tres(false), criadaEm: new Date(a.m.agora.getTime() - 3_600_000), studioAbertoEm: new Date(a.m.agora.getTime() - 600_000) })
  await abrirLista(page); await semAnimacao(page)
  const f = await abrirFichaDaLinha(page, a.m, 'ut', 'Continuar')
  await expect(f).toContainText(F.studioAberto.frase)
  await expect(f).toContainText(/Você abriu o Studio às \d\d:\d\d\./)
  await foto(page, info, 'ficha-studio-aberto')
  await medirEAfirmar(page, f, 'ficha-studio-aberto', info, a.coleta)
  await f.getByRole('button', { name: F.bloco3.jaIniciei }).click()
  await expect(f).toContainText(/O Lab não mexe neste vídeo até você responder o resultado \(prazo: \d\d\/\d\d/)
  await foto(page, info, 'ficha-ja-iniciei')
  await medirEAfirmar(page, f, 'ficha-ja-iniciei', info, a.coleta)
  void estreito
})

test('a 1440 a ação do estado fica a até 450 px do topo da tela de 900 px (ficha, S7, dia 14)', async ({ page, context }, info) => {
  test.skip(estreito(info), 'medida de 1440')
  const a = await preparar(page, context, info)
  await prepararFicha(a.m, 'ut', { variantes: tres(false), criadaEm: new Date(a.m.agora.getTime() - DIA) })
  await abrirLista(page); await semAnimacao(page)
  const topo = async (loc: import('@playwright/test').Locator): Promise<number> => { await loc.scrollIntoViewIfNeeded(); return (await loc.boundingBox())!.y }
  // ficha: depois do clique a tela rola até a ficha; a ação principal (Abrir no Studio) é medida sem rolar de novo
  const li = linha(page, a.m, 'ut')
  await li.getByRole('button', { name: 'Continuar' }).click()
  const f = ficha(page); await expect(f).toBeVisible(); await expect(f.getByText(/Carregando a ficha/)).toHaveCount(0, { timeout: 20_000 })
  const b1 = (await f.locator('.pri').first().boundingBox())!; const t1 = (await f.boundingBox())!.y
  test.info().annotations.push({ type: 'ficha: ação (px do topo da ficha | da tela)', description: `${Math.round(b1.y - t1)} | ${Math.round(b1.y)}` })
  expect(b1.y - t1, 'ficha: ação principal a ≤450 px do topo da ficha').toBeLessThanOrEqual(450)
  await page.keyboard.press('Escape')
  // S7
  await linha(page, a.m, 'lv').getByRole('button', { name: 'Ver teste' }).click()
  const c = page.locator('section[aria-label="Teste do YouTube"]'); const b2 = (await c.locator('.pri').first().boundingBox())!; const t2 = (await c.boundingBox())!.y
  test.info().annotations.push({ type: 'S7: ação (px do topo do cartão | da tela)', description: `${Math.round(b2.y - t2)} | ${Math.round(b2.y)}` })
  expect(b2.y - t2, 'S7: ação a ≤450 px do topo do cartão').toBeLessThanOrEqual(450)
  await page.keyboard.press('Escape')
  void topo
})
