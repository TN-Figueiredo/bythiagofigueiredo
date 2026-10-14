/**
 * Banco falso PRÓPRIO da E9 (não edita o falso de outra etapa). Entende só o que `saiu/*` usa: select (com count/head), eq, is, not, in, gte, or,
 * order, range, limit, e `rpc`. Linhas aninhadas (`competitor_channels: { … }`) vêm prontas na fixture; filtro por caminho com ponto lê o aninhado.
 * Toda lista paginada (`range`) exige `order` e `count: 'exact'`: o falso recusa a chamada sem os dois, como a API cortaria sem aviso.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type Linha = Record<string, unknown>
export interface Chamada {
  tabela: string
  colunas: string
  count: string | null
  head: boolean
  filtros: string[]
  ordem: string[]
  faixa: [number, number] | null
  limite: number | null
}
export interface RespostaDeRpc { data: unknown; error: { message: string; code?: string } | null }
type ErroDoBanco = { message: string; code?: string } | null

export interface OpcoesDoFalso {
  tabelas: Record<string, Linha[]>
  rpc?: Record<string, (args: Record<string, unknown>) => RespostaDeRpc | Promise<RespostaDeRpc>>
  /** Devolve erro nesta leitura (a chamada já montada + o índice dela naquela tabela). `string` = código do erro; 'lancar' faz a promessa rejeitar. */
  falhar?: (c: Chamada, n: number) => boolean | string
  /** Faz a contagem devolvida divergir: `(tabela, nDaPagina, contagemReal) => contagem a devolver`. */
  contagem?: (tabela: string, nDaPagina: number, real: number) => number
}

export interface FalsoSaiu { sb: SupabaseClient; chamadas: Chamada[]; rpcs: Array<{ nome: string; args: Record<string, unknown> }> }

const ler = (linha: Linha, caminho: string): unknown => caminho.split('.').reduce<unknown>((a, k) => (a && typeof a === 'object' ? (a as Linha)[k] : undefined), linha)
const igual = (v: unknown, alvo: string): boolean => {
  if (Array.isArray(v)) return alvo === '{}' ? v.length === 0 : false
  return String(v) === alvo
}

function condicao(linha: Linha, expr: string): boolean {
  // formas usadas: "col.eq.val", "col.neq.val", "col.is.null", "col.not.is.null"
  const m = /^([a-z_]+)\.(not\.)?(eq|neq|is)\.(.*)$/.exec(expr)
  if (!m) throw new Error(`fake: or() não entendido: ${expr}`)
  const [, col, negado, op, val] = m
  const v = ler(linha, col)
  let r: boolean
  if (op === 'is') r = val === 'null' ? v == null : String(v) === val
  else if (op === 'eq') r = igual(v, val)
  else r = !igual(v, val)
  return negado ? !r : r
}

export function fakeSaiu(o: OpcoesDoFalso): FalsoSaiu {
  const chamadas: Chamada[] = []
  const rpcs: Array<{ nome: string; args: Record<string, unknown> }> = []
  const porTabela = new Map<string, number>()

  function from(tabela: string) {
    const n = porTabela.get(tabela) ?? 0
    porTabela.set(tabela, n + 1)
    const c: Chamada = { tabela, colunas: '', count: null, head: false, filtros: [], ordem: [], faixa: null, limite: null }
    chamadas.push(c)
    const preds: Array<(l: Linha) => boolean> = []
    const ordens: Array<{ col: string; asc: boolean }> = []
    const b = {
      select(colunas: string, opts?: { count?: string; head?: boolean }) { c.colunas = colunas; c.count = opts?.count ?? null; c.head = opts?.head === true; return b },
      eq(col: string, val: unknown) { c.filtros.push(`eq:${col}`); preds.push(l => igual(ler(l, col), String(val))); return b },
      is(col: string, val: null) { c.filtros.push(`is:${col}`); preds.push(l => (val === null ? ler(l, col) == null : false)); return b },
      not(col: string, op: string, val: unknown) {
        c.filtros.push(`not:${col}`)
        preds.push(l => (op === 'is' && val === null ? ler(l, col) != null : !igual(ler(l, col), String(val))))
        return b
      },
      in(col: string, vals: unknown[]) { c.filtros.push(`in:${col}`); preds.push(l => vals.map(String).includes(String(ler(l, col)))); return b },
      gte(col: string, val: unknown) { c.filtros.push(`gte:${col}`); preds.push(l => String(ler(l, col)) >= String(val)); return b },
      or(expr: string) { c.filtros.push(`or:${expr}`); preds.push(l => expr.split(',').some(e => condicao(l, e))); return b },
      order(col: string, opts?: { ascending?: boolean }) { c.ordem.push(col); ordens.push({ col, asc: opts?.ascending !== false }); return b },
      range(a: number, z: number) { c.faixa = [a, z]; return b },
      limit(k: number) { c.limite = k; return b },
      then(ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) {
        let r: { data: Linha[] | null; error: ErroDoBanco; count: number | null }
        const f = o.falhar?.(c, n)
        if (f === 'lancar') return Promise.reject(new Error('o falso lançou')).then(ok, ko)
        if (f) r = { data: null, error: { message: 'falha do falso', code: typeof f === 'string' ? f : undefined }, count: null }
        else if (c.faixa && (c.ordem.length === 0 || c.count !== 'exact')) r = { data: null, error: { message: 'fake: leitura de lista sem order ou sem count exact' }, count: null }
        else {
          let rows = (o.tabelas[tabela] ?? []).filter(l => preds.every(p => p(l)))
          for (const { col, asc } of [...ordens].reverse()) {
            rows = [...rows].sort((x, y) => {
              const a = ler(x, col), z = ler(y, col)
              const cmp = a === z ? 0 : (a as string | number) < (z as string | number) ? -1 : 1
              return asc ? cmp : -cmp
            })
          }
          const real = rows.length
          const contagem = c.count === 'exact' ? (o.contagem ? o.contagem(tabela, n, real) : real) : null
          if (c.faixa) rows = rows.slice(c.faixa[0], c.faixa[1] + 1)
          if (c.limite !== null) rows = rows.slice(0, c.limite)
          r = { data: c.head ? null : rows, error: null, count: contagem }
        }
        return Promise.resolve(r).then(ok, ko)
      },
    }
    return b
  }

  const sb = {
    from,
    async rpc(nome: string, args: Record<string, unknown>): Promise<RespostaDeRpc> {
      rpcs.push({ nome, args })
      const f = o.rpc?.[nome]
      if (!f) return { data: null, error: { message: `fake: rpc sem resposta (${nome})`, code: 'PGRST202' } }
      return f(args)
    },
  } as unknown as SupabaseClient
  return { sb, chamadas, rpcs }
}
