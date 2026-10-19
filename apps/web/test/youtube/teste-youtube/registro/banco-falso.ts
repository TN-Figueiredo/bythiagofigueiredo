// Cliente falso de PostgREST com tabelas em memória (T7 e T8 do registro do teste nativo).
export type Linha = Record<string, unknown>
export type Erro = { code?: string; message?: string }
export interface Pedido { tabela: string; op: 'select' | 'insert' | 'update' | 'delete' | 'upsert'; filtros: string[]; faixa: [number, number] | null; count: boolean }
export interface OpcoesBanco {
  /** Falha injetada: devolve o erro a responder (ou null para seguir). */
  falhar?: (p: Pedido) => Erro | null
  /** Handlers de `rpc`; ausente = erro 42883. */
  rpcs?: Record<string, (args: Record<string, unknown>) => { data: unknown; error: Erro | null }>
  /** Relógio do `updated_at` das linhas (microssegundos sintéticos). */
  agoraIso?: () => string
  /** Chamado em toda escrita (insert/update/delete/upsert) e rpc, antes de executar. */
  aoEscrever?: (tabela: string, op: string) => void
}

const ehData = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v)
function cmp(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1
  if (b === null || b === undefined) return 1
  if (ehData(a) && ehData(b)) return Date.parse(a) - Date.parse(b)
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}
const valor = (txt: string, ref: unknown): unknown => (typeof ref === 'number' ? Number(txt) : txt)

type Teste = (l: Linha) => boolean
function condicao(col: string, op: string, txt: string): Teste {
  return l => {
    const v = l[col]
    switch (op) {
      case 'eq': return cmp(v, valor(txt, v)) === 0 && v !== null && v !== undefined
      case 'neq': return cmp(v, valor(txt, v)) !== 0
      case 'gte': return v !== null && v !== undefined && cmp(v, valor(txt, v)) >= 0
      case 'gt': return v !== null && v !== undefined && cmp(v, valor(txt, v)) > 0
      case 'lte': return v !== null && v !== undefined && cmp(v, valor(txt, v)) <= 0
      case 'lt': return v !== null && v !== undefined && cmp(v, valor(txt, v)) < 0
      case 'is': return txt === 'null' ? v === null || v === undefined : v !== null && v !== undefined
      default: throw new Error('op não suportada no falso: ' + op)
    }
  }
}
function parteOr(p: string): Teste {
  const a = /^and\((.*)\)$/.exec(p)
  if (a) { const ts = a[1]!.split(',').map(parteOr); return l => ts.every(t => t(l)) }
  const [col, op, ...resto] = p.split('.')
  return condicao(col!, op!, resto.join('.'))
}
function listaEm(txt: string): string[] {
  return txt.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''))
}

export function criarBanco(tabelas: Record<string, Linha[]>, o: OpcoesBanco = {}) {
  const pedidos: Pedido[] = []
  const rpcChamadas: Array<{ nome: string; args: Record<string, unknown> }> = []
  let micro = 0
  const agora = o.agoraIso ?? ((): string => '2026-10-18T21:00:00.000000+00:00')
  const carimbo = (): string => agora().replace(/\.\d+\+00:00$|Z$/, '') + `.${String(++micro).padStart(6, '0')}+00:00`
  let seq = 0

  function from(tabela: string) {
    const p: Pedido = { tabela, op: 'select', filtros: [], faixa: null, count: false }
    const testes: Teste[] = []
    const ordens: Array<{ col: string; asc: boolean }> = []
    let faixa: [number, number] | null = null
    let limite: number | null = null
    let payload: Linha | Linha[] | null = null
    let retorna = false
    const rows = (): Linha[] => (tabelas[tabela] ??= [])
    const q: Record<string, unknown> = {}
    q.select = (_c?: string, op?: { count?: string }) => {
      if (p.op === 'select') { if (op?.count) p.count = true } else retorna = true
      return q
    }
    q.insert = (x: Linha | Linha[]) => { p.op = 'insert'; payload = x; return q }
    q.update = (x: Linha) => { p.op = 'update'; payload = x; return q }
    q.delete = () => { p.op = 'delete'; return q }
    q.upsert = (x: Linha | Linha[]) => { p.op = 'upsert'; payload = x; return q }
    const filtro = (nome: string, args: unknown[], t: Teste): unknown => { p.filtros.push(`${nome}:${args.map(String).join(',')}`); testes.push(t); return q }
    q.eq = (c: string, v: unknown) => filtro('eq', [c, v], l => (l[c] ?? null) !== null && cmp(l[c], v) === 0)
    q.neq = (c: string, v: unknown) => filtro('neq', [c, v], l => cmp(l[c], v) !== 0)
    q.is = (c: string, v: null) => filtro('is', [c, v], l => (l[c] === null || l[c] === undefined) === (v === null))
    q.in = (c: string, vs: unknown[]) => filtro('in', [c, vs.join('|')], l => vs.some(v => cmp(l[c], v) === 0 && l[c] !== null))
    q.gte = (c: string, v: unknown) => filtro('gte', [c, v], condicao(c, 'gte', String(v)))
    q.gt = (c: string, v: unknown) => filtro('gt', [c, v], condicao(c, 'gt', String(v)))
    q.lte = (c: string, v: unknown) => filtro('lte', [c, v], condicao(c, 'lte', String(v)))
    q.lt = (c: string, v: unknown) => filtro('lt', [c, v], condicao(c, 'lt', String(v)))
    q.not = (c: string, op: string, v: unknown) => {
      if (op === 'in') { const xs = listaEm(String(v)); return filtro('not.in', [c, xs.join('|')], l => !xs.some(x => String(l[c]) === x)) }
      const t = condicao(c, op, String(v))
      return filtro('not.' + op, [c, v], l => !t(l))
    }
    q.or = (expr: string) => {
      const partes: string[] = []
      let prof = 0, atual = ''
      for (const ch of expr) {
        if (ch === '(') prof++
        if (ch === ')') prof--
        if (ch === ',' && prof === 0) { partes.push(atual); atual = '' } else atual += ch
      }
      partes.push(atual)
      const ts = partes.map(parteOr)
      return filtro('or', [expr], l => ts.some(t => t(l)))
    }
    q.order = (c: string, op?: { ascending?: boolean }) => { ordens.push({ col: c, asc: op?.ascending !== false }); return q }
    q.range = (de: number, ate: number) => { faixa = [de, ate]; p.faixa = faixa; return q }
    q.limit = (n: number) => { limite = n; return q }
    q.abortSignal = () => q
    q.then = (ok: (r: unknown) => unknown, err: (e: unknown) => unknown) => Promise.resolve().then(() => executar()).then(ok, err)

    function executar(): { data: unknown; error: Erro | null; count?: number | null } {
      pedidos.push(p)
      if (p.op !== 'select') o.aoEscrever?.(tabela, p.op)
      const f = o.falhar?.(p)
      if (f) return { data: null, error: f }
      const ok = (l: Linha): boolean => testes.every(t => t(l))
      if (p.op === 'select') {
        let r = rows().filter(ok)
        const total = r.length
        for (const { col, asc } of [...ordens].reverse()) r = [...r].sort((a, b) => (asc ? 1 : -1) * cmp(a[col], b[col]))
        if (faixa) r = r.slice(faixa[0], faixa[1] + 1)
        if (limite !== null) r = r.slice(0, limite)
        return { data: r.map(x => ({ ...x })), error: null, count: p.count ? total : null }
      }
      if (p.op === 'insert' || p.op === 'upsert') {
        const novas = (Array.isArray(payload) ? payload : [payload as Linha]).map(x => ({ id: `id-${++seq}`, ...x, updated_at: carimbo() }))
        if (tabela === 'ab_native_tests') {
          for (const n of novas) {
            if (n.estado === 'em_andamento' && rows().some(x => x.estado === 'em_andamento' && x.site_id === n.site_id && x.video_id === n.video_id)) {
              return { data: null, error: { code: '23505' } }
            }
          }
        }
        if (tabela === 'ab_native_avaliacoes') for (const n of novas) if (typeof n.id === 'string') n.id = ++seq
        rows().push(...novas)
        return { data: retorna ? novas.map(x => ({ ...x })) : null, error: null }
      }
      if (p.op === 'update') {
        const alvos = rows().filter(ok)
        for (const a of alvos) { Object.assign(a, payload); if (tabela === 'ab_native_tests') a.updated_at = carimbo() }
        return { data: retorna ? alvos.map(x => ({ ...x })) : null, error: null }
      }
      const mantidas = rows().filter(l => !ok(l))
      tabelas[tabela] = mantidas
      return { data: null, error: null }
    }
    return q
  }

  const sb = {
    from,
    rpc: (nome: string, args: Record<string, unknown>) => {
      const exec = (): { data: unknown; error: Erro | null } => {
        rpcChamadas.push({ nome, args })
        o.aoEscrever?.('rpc:' + nome, 'rpc')
        const h = o.rpcs?.[nome]
        return h ? h(args) : { data: null, error: { code: '42883' } }
      }
      const r: Record<string, unknown> = {}
      r.abortSignal = () => r
      r.then = (ok: (x: unknown) => unknown, err: (e: unknown) => unknown) => Promise.resolve().then(exec).then(ok, err)
      return r
    },
  } as never
  return { sb, tabelas, pedidos, rpcChamadas }
}
