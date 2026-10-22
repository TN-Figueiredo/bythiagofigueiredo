// Gio, F1a-tela-1 (re-validação 1): o fluxo inteiro numa FICHA NOVA (sem A guardada): título B, imagem B, Abrir no Studio (a cópia da A
// roda, F-4), Já iniciei, Confirmar. Sem erro de console (o aviso de key, F-1, é afirmado à parte na spec da lista) e sem ficha vazia nova no banco.
import { expect, test } from '@playwright/test'
import { AUTH_F1A, abrirFichaDaLinha, abrirLista, ficha, foto, garantirCampoDaB, imagem1280, linha, preparar, semAnimacao, soNoProjeto } from './ab-lab-f1a-tela-1-suporte/comum'
import { consultar, contarFichas } from './ab-lab-f1a-tela-1-suporte/semente'

test.use({ storageState: AUTH_F1A })

test('ficha nova (r66): título B + imagem B + Abrir no Studio + Já iniciei + Confirmar, sem erro de console e sem ficha vazia', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info) && !soNoProjeto(info, 'l1440-light'), 'fluxo com escrita: dois projetos de 1440 bastam')
  const a = await preparar(page, context, info)
  const erros: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => { erros.push('pageerror: ' + e.message.slice(0, 200)) })
  await abrirLista(page); await semAnimacao(page)
  const id = a.m.v.r66!.id
  expect(await contarFichas(id), 'sem ficha antes').toBe(0)
  const f = await abrirFichaDaLinha(page, a.m, 'r66', 'Testar no YouTube')
  // F-3: o campo de título da B aparece logo ao abrir; a imagem aparece ao escolher "Os dois"
  await expect(f.locator('#cn-t2')).toBeVisible()
  await garantirCampoDaB(f, info)
  await f.locator('#cn-t2').fill('Rota 66 em 4 dias: o que ninguém conta')
  await f.locator('#cn-t2').blur()
  await expect(f).toContainText(/Salvo (às|em)/, { timeout: 15_000 })
  await f.locator('input[type=file][aria-label="Enviar imagem da versão B"]').setInputFiles({ name: 'b.png', mimeType: 'image/png', buffer: await imagem1280() })
  await expect(f.locator('.cn-ver[data-versao="B"] img.cn-th')).toBeVisible({ timeout: 30_000 })
  expect(await contarFichas(id), 'uma ficha depois de salvar').toBe(1)
  // Abrir no Studio (F-4: a cópia da A, que antes falhava calada, roda)
  await f.getByRole('button', { name: 'Abrir no Studio', exact: true }).first().click()
  await expect.poll(() => a.janelas.length, { message: 'window.open do Studio' }).toBe(1)
  await expect.poll(async () => (await consultar('select studio_aberto_em from ab_native_fichas where video_id=$1 and registro_id is null', [id]))[0]?.studio_aberto_em, { timeout: 15_000 }).not.toBeNull()
  const aposStudio = await consultar<{ variantes: Array<{ n: number; titulo?: string; imagem?: { url: string } }> }>(
    'select variantes from ab_native_fichas where video_id=$1 and registro_id is null and descartada_em is null', [id])
  expect(aposStudio, 'uma ficha aberta').toHaveLength(1)
  info.annotations.push({ type: 'A-gravada', description: JSON.stringify(aposStudio[0]!.variantes.find((v) => v.n === 1) ?? null).slice(0, 300) })
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')) })
  await expect(f).toContainText(/Você abriu o Studio (às|em) /, { timeout: 10_000 })
  await foto(page, info, 'nova-studio-aberto')
  await f.getByRole('button', { name: 'Já iniciei' }).click()
  await f.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(f).toContainText(/Teste registrado em /, { timeout: 20_000 })
  const reg = await consultar<{ origem: string; confirmado_em: string | null }>("select origem, confirmado_em from ab_native_tests where video_id=$1 and estado='em_andamento'", [id])
  expect(reg).toHaveLength(1)
  const fichas = await consultar<{ registro_id: string | null; variantes: unknown[]; descartada_em: string | null }>('select registro_id, variantes, descartada_em from ab_native_fichas where video_id=$1', [id])
  expect(fichas, 'só a ficha que virou registro').toHaveLength(1)
  expect(fichas.filter((x) => x.registro_id === null && x.descartada_em === null), 'nenhuma ficha aberta/vazia nova').toHaveLength(0)
  await expect(ficha(page)).toContainText(/Teste registrado|Em teste no Studio/)
  await expect(linha(page, a.m, 'r66')).toHaveAttribute('data-estado', 'em_teste_studio', { timeout: 20_000 })
  expect(await contarFichas(id), 'depois do refresh').toBe(1)
  await foto(page, info, 'nova-registrada')
  expect(erros.filter((e) => !/Failed to load resource.*(ytimg|blob)/i.test(e) && !/unique "key" prop/.test(e)), 'erros de console').toEqual([])
})
