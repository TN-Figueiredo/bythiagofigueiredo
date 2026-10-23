// Auxiliares do ENVIO B (Gio, T9): `preparar` com a semente B, capturas em gio-shots-b, medidas em gio-medidas-b.jsonl e leitores de foco/altura.
import fs from 'node:fs'
import path from 'node:path'
import { expect, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test'
import type { Coleta } from '../ab-lab-p4a-suporte/comum'
import { medir, largura, tema, preparar as prepararA, type Ambiente } from './comum'
import { consultar } from './semente'
import { semearB } from './semente-b'

export { abrirLista, linha, semAnimacao, largura, tema, soNoProjeto, AUTH_F1A, BASE, medir, abrirPergunta } from './comum'
export type { Ambiente }

export const PASTA = '/Users/figueiredo/Workspace/bythiagofigueiredo/.superpowers/sdd/ab-lab/f1a-tela-2'
export const SHOTS_B = `${PASTA}/gio-shots-b`
export const MEDIDAS_B = `${PASTA}/gio-medidas-b.jsonl`

export async function prepararB(page: Page, ctx: BrowserContext, info: TestInfo, chaves: readonly string[], o: { naoEsperadas?: RegExp[] } = {}): Promise<Ambiente> {
  const a = await prepararA(page, ctx, info, o)
  await semearB(a.m, chaves)
  return a
}

export async function fotoB(page: Page, info: TestInfo, estado: string, alvo?: Locator): Promise<string> {
  fs.mkdirSync(SHOTS_B, { recursive: true })
  const f = path.join(SHOTS_B, `${largura(info)}-${tema(info)}-${estado}.png`)
  if (alvo) await alvo.screenshot({ path: f }); else await page.screenshot({ path: f })
  return f
}

export function registrarB(info: TestInfo, estado: string, dados: Record<string, unknown>): void {
  fs.mkdirSync(PASTA, { recursive: true })
  fs.appendFileSync(MEDIDAS_B, JSON.stringify({ estado, projeto: info.project.name, ...dados }) + '\n')
}

/** Medidas gerais do Step 2 sobre `raiz`; registra e afirma (soft). `maxPri` = botões primários permitidos no bloco (0). */
export async function medirB(page: Page, raiz: Locator, estado: string, info: TestInfo, c: Coleta, o: { ignorarAlvos?: RegExp } = {}): Promise<void> {
  const x = await medir(page, raiz, estado, info)
  const alvos = o.ignorarAlvos ? x.alvosPequenos.filter((a) => !o.ignorarAlvos!.test(a)) : x.alvosPequenos
  registrarB(info, estado, { ...x, alvosPequenos: alvos, erros: c.erros.length, hidratacao: c.hidratacao.length, rede: c.falhasDeRede.length + c.respostas4xx5xx.length })
  expect.soft(x.semTextoRuim, `${estado}: texto "undefined/NaN/null"`).toEqual([])
  expect.soft(x.contrasteBaixo, `${estado}: contraste abaixo de 4,5:1 (3:1 grande)`).toEqual([])
  expect.soft(alvos, `${estado}: alvos < 44 px a 390`).toEqual([])
  expect.soft(x.primarios, `${estado}: .pri dentro do bloco do dia 14`).toBe(0)
  expect.soft(x.scrollWidth, `${estado}: rolagem horizontal (scrollWidth <= innerWidth)`).toBeLessThanOrEqual(x.innerWidth)
  expect.soft(c.erros, `${estado}: erros de console`).toEqual([])
  expect.soft(c.hidratacao, `${estado}: hidratação`).toEqual([])
  expect.soft(c.falhasDeRede, `${estado}: falhas de rede`).toEqual([])
  expect.soft(c.respostas4xx5xx.filter((r) => !/\.png/.test(JSON.stringify(r))), `${estado}: 4xx/5xx`).toEqual([])
}

export interface FocoLido { acao: string | null; tag: string | null; texto: string; ehBody: boolean; naTela: boolean; topo: number; fundo: number; dentroDaLinha: boolean }
/** O que tem o foco agora, e se está dentro da janela. */
export async function lerFoco(page: Page, videoId: string): Promise<FocoLido> {
  return page.evaluate((id) => {
    const e = document.activeElement as HTMLElement | null
    const r = e?.getBoundingClientRect()
    return {
      acao: e?.getAttribute('data-acao') ?? null, tag: e?.tagName ?? null, texto: (e?.innerText ?? e?.textContent ?? '').trim().slice(0, 60), ehBody: e === document.body || e === null,
      naTela: !!r && r.top >= 0 && r.bottom <= window.innerHeight, topo: Math.round(r?.top ?? -1), fundo: Math.round(r?.bottom ?? -1),
      dentroDaLinha: !!e?.closest(`li[data-linha="${id}"]`),
    }
  }, videoId)
}

/** Linha do banco do registro do vídeo. */
export interface LinhaBanco {
  id: string; resposta_dono: string | null; variante_vencedora: number | null; estado: string; vencedor_titulo: string | null; vencedor_fonte: string | null
  respondido_em: string | null; resposta_mudada_em: string | null; updated_at: string; desfecho_em: string | null; confirmado_em: string | null
}
export async function lerBanco(videoId: string): Promise<LinhaBanco> {
  const r = await consultar<LinhaBanco>(
    `select id, resposta_dono, variante_vencedora, estado, vencedor_titulo, vencedor_fonte, ${['respondido_em', 'resposta_mudada_em', 'updated_at', 'desfecho_em', 'confirmado_em']
      .map((c) => `to_char(${c} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as ${c}`).join(', ')} from ab_native_tests where video_id=$1`, [videoId])
  expect(r, 'um registro só').toHaveLength(1)
  return r[0]!
}
