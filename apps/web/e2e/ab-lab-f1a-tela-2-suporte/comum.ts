// Auxiliares da suíte do Gio (F1a-tela-2, envio A): reaproveita os da tela-1 (tema, coleta, rotas falsas, `medir`) e troca a semente, a pasta de
// capturas e o arquivo de medidas. Nada aqui escreve fora do banco local padrão e da pasta de capturas.
import fs from 'node:fs'
import path from 'node:path'
import { expect, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test'
import { abrirLista, linha, medir, preparar as prepararBase, semAnimacao, largura, tema, soNoProjeto, AUTH_F1A, BASE, type Ambiente } from '../ab-lab-f1a-tela-1-suporte/comum'
import type { Coleta } from '../ab-lab-p4a-suporte/comum'
import { ajustarT2, EXTRAS } from './semente'

export { abrirLista, linha, semAnimacao, largura, tema, soNoProjeto, AUTH_F1A, BASE, medir }
export type { Ambiente }

export const PASTA = '/Users/figueiredo/Workspace/bythiagofigueiredo/.superpowers/sdd/ab-lab/f1a-tela-2'
export const SHOTS = `${PASTA}/gio-shots`
export const MEDIDAS = `${PASTA}/gio-medidas-a.jsonl`

export async function preparar(page: Page, ctx: BrowserContext, info: TestInfo, o: { naoEsperadas?: RegExp[] } = {}): Promise<Ambiente> {
  const a = await prepararBase(page, ctx, info, { extras: [...EXTRAS], ...(o.naoEsperadas ? { naoEsperadas: o.naoEsperadas } : {}) })
  await ajustarT2(a.m)
  return a
}

export async function foto(page: Page, info: TestInfo, estado: string, alvo?: Locator): Promise<string> {
  fs.mkdirSync(SHOTS, { recursive: true })
  const f = path.join(SHOTS, `${largura(info)}-${tema(info)}-${estado}.png`)
  if (alvo) await alvo.screenshot({ path: f }); else await page.screenshot({ path: f })
  return f
}

/** Registra uma medida solta (número, texto) no JSONL do relatório. */
export function registrar(info: TestInfo, estado: string, dados: Record<string, unknown>): void {
  fs.mkdirSync(PASTA, { recursive: true })
  fs.appendFileSync(MEDIDAS, JSON.stringify({ estado, projeto: info.project.name, ...dados }) + '\n')
}

/** Medidas do Step 2 (texto ruim, contraste, alvos de 44 px a 390, primário, rolagem, console, rede) sobre `raiz`; registra e afirma. */
export async function medirEAfirmar(page: Page, raiz: Locator, estado: string, info: TestInfo, c: Coleta, o: { maxPri?: number; soft?: boolean } = {}): Promise<void> {
  const x = await medir(page, raiz, estado, info)
  registrar(info, estado, { ...x, erros: c.erros.length, hidratacao: c.hidratacao.length, rede: c.falhasDeRede.length + c.respostas4xx5xx.length })
  expect.soft(x.semTextoRuim, `${estado}: texto "undefined/NaN/null"`).toEqual([])
  expect.soft(x.contrasteBaixo, `${estado}: contraste abaixo de 4,5:1 (3:1 grande)`).toEqual([])
  expect.soft(x.alvosPequenos, `${estado}: alvos < 44 px a 390`).toEqual([])
  expect.soft(x.primarios, `${estado}: .pri dentro do bloco do dia 14`).toBeLessThanOrEqual(o.maxPri ?? 0)
  expect.soft(x.scrollWidth, `${estado}: rolagem horizontal (scrollWidth == innerWidth)`).toBeLessThanOrEqual(x.innerWidth)
  expect.soft(c.erros, `${estado}: erros de console`).toEqual([])
  expect.soft(c.hidratacao, `${estado}: hidratação`).toEqual([])
  expect.soft(c.falhasDeRede, `${estado}: falhas de rede`).toEqual([])
  expect.soft(c.respostas4xx5xx.filter((r) => !/\/(tres-B|hostil-|r66-)[A-Za-z0-9-]*\.png/.test(r)), `${estado}: 4xx/5xx`).toEqual([])
}

/** O bloco do dia 14 da linha, depois de "Responder" (a linha abre a pergunta; a página não troca de rota). */
export async function abrirPergunta(page: Page, li: Locator): Promise<Locator> {
  await li.getByRole('button', { name: 'Responder' }).click()
  const bloco = li.locator('section.cn-d14')
  await expect(bloco).toBeVisible({ timeout: 15_000 })
  return bloco
}
export async function fecharPergunta(li: Locator): Promise<void> {
  await li.getByRole('button', { name: 'Responder' }).click()
  await expect(li.locator('section.cn-d14')).toHaveCount(0)
}
