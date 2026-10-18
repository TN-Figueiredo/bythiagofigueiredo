// P4a-E13: console e rede limpos, com aviso de hidratação cobrado tela a tela (inclusive com o relógio do navegador em Tóquio).
import { test, expect } from '@playwright/test'
import { limpar, semearTeste } from './ab-lab-p4a-suporte/semente'
import { AUTH, abrir, botaoEncerrar, dialogoEncerrar, esperarLimpo, preparar, temaDoProjeto } from './ab-lab-p4a-suporte/comum'

test.use({ storageState: AUTH.admin })
test.beforeAll(async () => { await limpar() })

test('E13: zero aviso de hidratação, zero erro de console, zero 4xx/5xx em Lista, Detalhe ativo, pausado, encerrado e com o diálogo aberto', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E13 ativo ${info.project.name}`, status: 'active' })
  const pausado = await semearTeste({ nome: `E13 pausado ${info.project.name}`, status: 'paused' })
  const em = new Date(Date.now() - 3 * 86_400_000).toISOString()
  const encerrado = await semearTeste({ nome: `E13 encerrado ${info.project.name}`, status: 'completed', restoreStatus: { title: { estado: 'ok', destino: 'original', em }, thumbnail: { estado: 'ok', destino: 'original', em } } })
  const porTela: Record<string, string[]> = {}
  const marca = (rotulo: string) => { porTela[rotulo] = [...coleta.hidratacao]; coleta.hidratacao.length = 0 }
  await abrir(page, '/cms/youtube/ab-lab'); marca('lista')
  await abrir(page, t.url); marca('detalhe ativo')
  await botaoEncerrar(page).click()
  await expect(dialogoEncerrar(page)).toBeVisible()
  marca('diálogo encerrar')
  await abrir(page, pausado.url); marca('detalhe pausado')
  await abrir(page, encerrado.url); marca('detalhe encerrado')
  const sujas = Object.entries(porTela).filter(([, v]) => v.length > 0).map(([k, v]) => `${k}: ${v[0]}`)
  expect(sujas, 'avisos de hidratação por tela').toEqual([])
  esperarLimpo(coleta, 'E13')
})
