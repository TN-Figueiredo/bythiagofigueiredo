/** Manutenção M3b (Tarefa 11): a leitura de uma unidade pelo banco, em chamadas de `obs_archive_read_unit`, e a divisão em partes. Sem rota aqui, só o `rpc`. */
import { NextResponse } from 'next/server'
import { gzipSync } from 'node:zlib'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import type { PipelineAuth } from '@/lib/pipeline/auth'
import { pipelineError } from '@/lib/pipeline/helpers'
import { linhaCsv } from '../arquivo/csv'
import { CODIGOS, STATUS_DO_CODIGO, TENTATIVAS_DE_LEITURA, TETO_BYTES_POR_PARTE, TETO_LINHAS_DA_UNIDADE, TETO_LINHAS_POR_CHAMADA, TETO_PARTES, type Classe, type CodigoArquivo } from './contrato'

// PromiseLike: o rpc do supabase-js devolve PostgrestFilterBuilder, que não é Promise (Yannis I3; com Promise o typecheck recusa)
export interface Rpc { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: ErroDoRpc | null }> }
export interface ErroDoRpc { code?: string; message: string; details?: string | null }
export class MudouDuranteALeitura extends Error {}
export class GrandeDemais extends Error {}

type Unidade = { site: string; classe: Classe; tabela: string; canal: string; mes: string }
type Linha = Array<string | null>

const Pagina = z.array(z.object({
  rows: z.array(z.array(z.string().nullable())),
  row_count: z.union([z.number().int().min(0), z.string().regex(/^\d+$/).transform(Number)]),
  control_sum: z.string().nullable(),
  hash_conteudo: z.string().min(1),
  columns: z.array(z.object({ nome: z.string().min(1) }).passthrough()),
  schema_fp: z.string().min(1),
}).passthrough()).length(1)

const ehCodigo = (m: string): m is CodigoArquivo => (CODIGOS as readonly string[]).includes(m)

/** 57014 → 504; código de CODIGOS (P0001 com a mensagem do código) → o status dele; outro → 500 com a causa no Sentry (nunca na resposta). */
export function erroDoRpc(e: ErroDoRpc, auth: PipelineAuth): NextResponse {
  if (e.code === '57014') return pipelineError('tempo_esgotado', 'tempo esgotado', 504, auth)
  if (e.code === 'P0001' && ehCodigo(e.message)) {
    const det = typeof e.details === 'string' && e.details.length > 0 ? e.details.split(',') : undefined
    return pipelineError(e.message, e.message.replaceAll('_', ' '), STATUS_DO_CODIGO[e.message], auth, det)
  }
  Sentry.captureMessage(`archive rpc: ${e.code ?? '?'} ${e.message}`, 'error')
  return pipelineError('erro_do_banco', 'erro do banco', 500, auth)
}

/** Chama a função, e lê o `data` pelo esquema (nunca `as`): fora do esquema é 500 com a causa no Sentry, nunca a resposta parcial. */
export async function chamar<S extends z.ZodTypeAny>(sb: Rpc, fn: string, args: Record<string, unknown>, esquema: S, auth: PipelineAuth):
  Promise<{ ok: true; data: z.output<S> } | { ok: false; res: NextResponse }> {
  const r = await sb.rpc(fn, args)
  if (r.error) return { ok: false, res: erroDoRpc(r.error, auth) }
  const lido = esquema.safeParse(r.data)
  if (!lido.success) {
    Sentry.captureMessage(`archive ${fn} fora do esquema`, 'error')
    return { ok: false, res: pipelineError('erro_do_banco', 'erro do banco', 500, auth) }
  }
  return { ok: true, data: lido.data }
}

class ErroDoBanco extends Error {
  constructor(readonly erro: ErroDoRpc) { super(erro.message) }
}

async function pagina(rpc: Rpc, u: Unidade, offset: number, limite: number) {
  const r = await rpc.rpc('obs_archive_read_unit', { p_site: u.site, p_class: u.classe, p_table: u.tabela, p_channel: u.canal, p_month: `${u.mes}-01`, p_offset: offset, p_limit: limite })
  if (r.error) throw new ErroDoBanco(r.error)
  const p = Pagina.safeParse(r.data)
  if (!p.success) throw new Error('obs_archive_read_unit fora do esquema')
  return p.data[0]!
}

/** Lê `quantas` linhas a partir de `offset`, em chamadas de até `porChamada`. A soma da faixa é nula (C3). */
export async function lerFaixa(rpc: Rpc, u: Unidade, offset: number, quantas: number, porChamada: number = TETO_LINHAS_POR_CHAMADA):
  Promise<{ colunas: string[]; linhas: Linha[]; contagem: number; soma: string | null }> {
  const linhas: Linha[] = []
  let colunas: string[] | null = null
  let hash: string | null = null
  while (linhas.length < quantas) {
    const falta = quantas - linhas.length
    const p = await pagina(rpc, u, offset + linhas.length, Math.min(porChamada, falta))
    if (hash !== null && p.hash_conteudo !== hash) throw new MudouDuranteALeitura('faixa')
    hash = p.hash_conteudo
    colunas ??= p.columns.map(c => c.nome)
    if (p.rows.length === 0) throw new MudouDuranteALeitura('faixa curta')   // a unidade encolheu entre o registro e a leitura
    linhas.push(...p.rows)
  }
  return { colunas: colunas ?? [], linhas, contagem: linhas.length, soma: null }
}

/**
 * A unidade inteira em chamadas de `porChamada` linhas (item 75). O `hash_conteudo` é da unidade, igual em toda chamada: se mudar,
 * ou se a contagem ou a soma mudarem, alguém gravou no meio e a leitura recomeça; depois de 3 tentativas, `MudouDuranteALeitura`.
 * Acima de `TETO_LINHAS_DA_UNIDADE` lança `GrandeDemais` na primeira chamada, sem ler mais nada.
 */
export async function lerUnidadeInteira(rpc: Rpc, u: Unidade, porChamada: number = TETO_LINHAS_POR_CHAMADA):
  Promise<{ colunas: string[]; linhas: Linha[]; contagem: number; soma: string | null; hash: string; schemaFp: string }> {
  for (let tentativa = 0; tentativa < TENTATIVAS_DE_LEITURA; tentativa++) {
    const primeira = await pagina(rpc, u, 0, porChamada)
    const total = primeira.row_count
    if (total > TETO_LINHAS_DA_UNIDADE) throw new GrandeDemais('unidade')
    const linhas: Linha[] = [...primeira.rows]
    let mudou = false
    while (linhas.length < total) {
      const p = await pagina(rpc, u, linhas.length, porChamada)
      if (p.hash_conteudo !== primeira.hash_conteudo || p.row_count !== total || p.control_sum !== primeira.control_sum || p.rows.length === 0) { mudou = true; break }
      linhas.push(...p.rows)
    }
    if (mudou || linhas.length !== total) continue
    return { colunas: primeira.columns.map(c => c.nome), linhas, contagem: total, soma: primeira.control_sum, hash: primeira.hash_conteudo, schemaFp: primeira.schema_fp }
  }
  throw new MudouDuranteALeitura('unidade')
}

/** Pede o erro do banco que `lerFaixa`/`lerUnidadeInteira` guardaram, se for um (para a rota responder com `erroDoRpc`). */
export const erroDoBancoDe = (e: unknown): ErroDoRpc | null => (e instanceof ErroDoBanco ? e.erro : null)

const gzBytes = (linhas: Linha[], cabecalho: string): number => gzipSync(Buffer.from(cabecalho + linhas.map(l => linhaCsv(l) + '\n').join(''), 'utf8'), { level: 9 }).byteLength

/**
 * Divide por tamanho do `.gz`, nunca trunca: cada parte tem o cabeçalho e no máximo `teto` bytes comprimidos; a soma das linhas é o total.
 * A unidade que cabe numa parte vai inteira. Uma linha sozinha maior que o teto, ou mais de 99 partes, lança `GrandeDemais`.
 */
export function dividirEmPartes(colunas: string[], linhas: Linha[], teto: number = TETO_BYTES_POR_PARTE):
  Array<{ parte: number; rowOffset: number; linhas: Linha[] }> {
  const cab = linhaCsv(colunas) + '\n'
  const total = gzBytes(linhas, cab)
  if (total <= teto) return [{ parte: 1, rowOffset: 0, linhas }]
  const cortes: Array<{ de: number; ate: number }> = []
  const dividir = (de: number, ate: number): void => {
    if (cortes.length > TETO_PARTES) throw new GrandeDemais('partes')
    const fatia = linhas.slice(de, ate)
    if (gzBytes(fatia, cab) <= teto) { cortes.push({ de, ate }); return }
    if (ate - de <= 1) throw new GrandeDemais('linha')
    const meio = de + Math.ceil((ate - de) / 2)
    dividir(de, meio)
    dividir(meio, ate)
  }
  const k = Math.max(2, Math.ceil(total / (teto * 0.9)))
  const passo = Math.ceil(linhas.length / k)
  for (let de = 0; de < linhas.length; de += passo) dividir(de, Math.min(de + passo, linhas.length))
  if (cortes.length > TETO_PARTES) throw new GrandeDemais('partes')
  return cortes.map((c, i) => ({ parte: i + 1, rowOffset: c.de, linhas: linhas.slice(c.de, c.ate) }))
}
