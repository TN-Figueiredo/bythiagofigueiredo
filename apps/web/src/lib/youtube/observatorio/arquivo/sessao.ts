/**
 * A5 · E10: a sessão de leitura do export e da conferência. Só `node:` e importação relativa (o `tsx` da raiz importa este módulo);
 * o cliente do banco chega por parâmetro (`ClienteSql`), quem o cria é `scripts/obs-arquivo.ts`.
 *
 * Toda coluna é lida como TEXTO (`coluna::text`) dentro de uma transação `repeatable read read only`, com a sessão fixada: o texto que
 * o Postgres devolve não depende da configuração do servidor, e o `sha256` do CSV é o mesmo no export e na conferência.
 */
import { createHash } from 'node:crypto'
import { linhaCsv } from './csv'
import type { ColunaDoManifesto } from './manifesto'

export interface ClienteSql {
  query(texto: string, valores?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>
}

/** Tempo máximo de cada instrução da leitura. */
export const TEMPO_DA_LEITURA = '60s'
/** Linhas por `fetch` do cursor. */
export const LINHAS_POR_BLOCO = 5_000

/** A ordem importa: `begin` primeiro, depois a sessão. Nenhuma leitura de dado vem antes destas instruções. */
export const INSTRUCOES_DA_LEITURA: readonly string[] = [
  'begin isolation level repeatable read read only',
  `set local time zone 'UTC'`,
  'set local extra_float_digits = 3',
  `set local datestyle = 'ISO, YMD'`,
  `set local intervalstyle = 'postgres'`,
  `set local bytea_output = 'hex'`,
  `set local statement_timeout = '${TEMPO_DA_LEITURA}'`,
]

export async function abrirLeitura(sql: ClienteSql): Promise<void> {
  for (const i of INSTRUCOES_DA_LEITURA) await sql.query(i)
}

export async function fechar(sql: ClienteSql, como: 'commit' | 'rollback'): Promise<void> {
  await sql.query(como)
}

const IDENT = /^[a-z0-9_]+$/
const aspas = (nome: string): string => '"' + nome.replace(/"/g, '""') + '"'

/**
 * `select t."c1"::text as "c1", … from public."tabela" t where <filtro> [and <mês> = $2] order by <ordem>`.
 * `$1` é o id do canal; `$2` (só com período) é o primeiro dia do mês. `filtro`, `periodo` e `ordem` vêm de `obs_archive_registry()`
 * (texto do dono do banco, não do usuário); a tabela e as colunas são conferidas aqui.
 */
export function consultaDoArquivo(e: { tabela: string; filtro: string; periodo: string | null; ordem: string; colunas: string[] }): string {
  if (!IDENT.test(e.tabela)) throw new Error('nome de tabela inválido')
  if (e.colunas.length === 0) throw new Error('tabela sem colunas')
  const lista = e.colunas.map(c => `t.${aspas(c)}::text as ${aspas(c)}`).join(', ')
  const mes = e.periodo === null ? '' : ` and date_trunc('month', (${e.periodo})::timestamp)::date = $2::date`
  return `select ${lista} from public.${aspas(e.tabela)} t where ${e.filtro}${mes} order by ${e.ordem}`
}

export interface CsvLido {
  csv: Buffer
  sha256: string
  linhas: number
  /** Os valores das colunas de ordem da primeira e da última linha, juntos por `|`; nulo se não for possível. */
  menorChave: string | null
  maiorChave: string | null
  /** Soma da coluna pedida, em texto (bigint passa de 2^53), ou nulo se não pediu. */
  soma: string | null
}

/**
 * Lê a consulta inteira por cursor (blocos de 5.000 linhas) e monta o CSV (cabeçalho + linhas). O cursor só existe dentro da
 * transação aberta. `colunaDaSoma` e `colunasDeOrdem` são nomes de coluna (não expressões); nulos pulam a soma e as chaves.
 */
export async function lerCsvDoBanco(
  sql: ClienteSql,
  o: { consulta: string; parametros: unknown[]; colunas: string[]; colunaDaSoma: string | null; colunasDeOrdem: string[] | null; nomeDoCursor?: string },
): Promise<CsvLido> {
  const cursor = o.nomeDoCursor ?? 'arquivo_cursor'
  if (!IDENT.test(cursor)) throw new Error('nome de cursor inválido')
  await sql.query(`declare ${cursor} no scroll cursor for ${o.consulta}`, o.parametros)
  const hash = createHash('sha256')
  const partes: Buffer[] = []
  const cabecalho = Buffer.from(linhaCsv(o.colunas) + '\n', 'utf8')
  hash.update(cabecalho)
  partes.push(cabecalho)
  let linhas = 0
  let primeira: Record<string, unknown> | null = null
  let ultima: Record<string, unknown> | null = null
  let soma: bigint | null = o.colunaDaSoma === null ? null : BigInt(0)
  try {
    for (;;) {
      const r = await sql.query(`fetch forward ${LINHAS_POR_BLOCO} from ${cursor}`)
      if (r.rows.length === 0) break
      const texto = r.rows.map(row => linhaCsv(o.colunas.map(c => textoOuNulo(row[c], c)))).join('\n') + '\n'
      const buf = Buffer.from(texto, 'utf8')
      hash.update(buf)
      partes.push(buf)
      linhas += r.rows.length
      if (primeira === null) primeira = r.rows[0]!
      ultima = r.rows[r.rows.length - 1]!
      if (soma !== null && o.colunaDaSoma !== null) {
        for (const row of r.rows) {
          const v = row[o.colunaDaSoma]
          if (v === null || v === undefined) continue
          soma += paraBigInt(v, o.colunaDaSoma)
        }
      }
    }
  } finally {
    await sql.query(`close ${cursor}`).catch(() => undefined)
  }
  const chave = (row: Record<string, unknown> | null): string | null => {
    if (row === null || o.colunasDeOrdem === null || o.colunasDeOrdem.length === 0) return null
    return o.colunasDeOrdem.map(c => String(row[c] ?? '')).join('|')
  }
  return { csv: Buffer.concat(partes), sha256: hash.digest('hex'), linhas, menorChave: chave(primeira), maiorChave: chave(ultima), soma: soma === null ? null : soma.toString() }
}

function textoOuNulo(v: unknown, coluna: string): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v
  throw new Error(`a coluna ${coluna} não veio como texto`)
}

/** Valor somável: o texto de um inteiro (as colunas somadas do registro são `bigint` e `integer`); soma em BigInt, que passa de 2^53. */
function paraBigInt(v: unknown, coluna: string): bigint {
  if (typeof v !== 'string' || !/^-?\d+$/.test(v)) throw new Error(`a coluna ${coluna} não é um inteiro somável`)
  return BigInt(v)
}

/** As colunas simples de uma expressão `t.a` ou `t.a, t.b`; nulo se alguma não for assim. */
export function colunasDaExpressao(expressao: string | null): string[] | null {
  if (expressao === null) return null
  const partes = expressao.split(',').map(p => p.trim())
  const out: string[] = []
  for (const p of partes) {
    const m = /^t\.([a-z0-9_]+)$/.exec(p)
    if (!m) return null
    out.push(m[1]!)
  }
  return out
}

// ───────────────────────── leituras do catálogo e do registro (as mesmas no export e na conferência) ─────────────────────────

export interface EntradaDoRegistro { tabela: string; filtro: string; periodo: string | null; soma: string | null; ordem: string }
export interface ContagemDoCanal { tabela: string; /** AAAA-MM-DD */ inicio: string; linhas: number; soma: string | null }
export interface MiniaturaDoBanco { url: string; video: string }

const texto = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''))
const textoOuNuloDe = (v: unknown): string | null => (v === null || v === undefined ? null : texto(v))

/** O que o export cobre: a MESMA lista que a função do banco usa para contar (`obs_archive_registry()`). */
export async function lerRegistro(sql: ClienteSql): Promise<EntradaDoRegistro[]> {
  const r = await sql.query('select table_name, filter_sql, period_sql, sum_sql, order_sql from public.obs_archive_registry()')
  return r.rows.map(l => ({ tabela: texto(l.table_name), filtro: texto(l.filter_sql), periodo: textoOuNuloDe(l.period_sql), soma: textoOuNuloDe(l.sum_sql), ordem: texto(l.order_sql) }))
}

export async function lerExcluidas(sql: ClienteSql): Promise<Array<{ tabela: string; motivo: string }>> {
  const r = await sql.query('select table_name, reason from public.obs_archive_excluded()')
  return r.rows.map(l => ({ tabela: texto(l.table_name), motivo: texto(l.reason) }))
}

export async function tabelaExiste(sql: ClienteSql, tabela: string): Promise<boolean> {
  if (!IDENT.test(tabela)) return false
  const r = await sql.query(`select to_regclass('public.' || quote_ident($1)) is not null as existe`, [tabela])
  return r.rows[0]?.existe === true
}

/** As colunas e os tipos do catálogo, em ordem (`format_type`: o tipo que o `create table` escreveria). */
export async function lerColunasDaTabela(sql: ClienteSql, tabela: string): Promise<ColunaDoManifesto[]> {
  const r = await sql.query(
    `select a.attname::text as nome, format_type(a.atttypid, a.atttypmod) as tipo, not a.attnotnull as nulo
       from pg_attribute a where a.attrelid = to_regclass('public.' || quote_ident($1)) and a.attnum > 0 and not a.attisdropped order by a.attnum`,
    [tabela],
  )
  return r.rows.map(l => ({ nome: texto(l.nome), tipo: texto(l.tipo), nulo: l.nulo === true }))
}

/** Uma linha por tabela e mês com dado do canal; datas e números como texto (`bigint` passa de 2^53, `date` do driver vira Date local). */
export async function lerContagens(sql: ClienteSql, canal: string): Promise<ContagemDoCanal[]> {
  const r = await sql.query('select table_name, period_start::text as inicio, row_count::text as linhas, control_sum::text as soma from public.obs_archive_channel_counts($1) order by 1, 2', [canal])
  return r.rows.map(l => ({ tabela: texto(l.table_name), inicio: texto(l.inicio), linhas: Number(texto(l.linhas)), soma: textoOuNuloDe(l.soma) }))
}

/** As URLs distintas de miniatura das versões dos vídeos do canal, com o id (do YouTube) de um vídeo que a usa. */
export async function lerMiniaturasDoBanco(sql: ClienteSql, canal: string): Promise<MiniaturaDoBanco[]> {
  const r = await sql.query(
    `select x.thumb_blob_url as url, min(v.video_id) as video
       from public.competitor_video_versions x join public.competitor_videos v on v.id = x.video_id
      where v.competitor_channel_id = $1 and x.thumb_blob_url is not null group by 1 order by 1`,
    [canal],
  )
  return r.rows.map(l => ({ url: texto(l.url), video: texto(l.video) }))
}
