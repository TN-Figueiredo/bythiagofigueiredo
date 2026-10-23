// Cliente Supabase falso em memória, o bastante para os núcleos da ficha: select/update com eq, is, in, not, lt, order, limit.
// Todo `update` em `ab_native_fichas` troca `atualizada_em` (como o trigger do banco).
type Linha = Record<string, unknown>
export type Tabelas = Record<string, Linha[]>

export function criarSupabaseMemoria(tabelas: Tabelas): { sb: never; tabelas: Tabelas; leituras: string[] } {
  let seq = 0
  const leituras: string[] = []
  const from = (nome: string) => {
    leituras.push(nome)
    const filtros: Array<(r: Linha) => boolean> = []
    let patch: Linha | null = null
    let ordem: { col: string; asc: boolean } | null = null
    let limite = Infinity
    let devolve = false
    const q: Record<string, unknown> = {}
    const executa = async (): Promise<{ data: Linha[]; error: null }> => {
      await Promise.resolve() // cede a vez: chamadas concorrentes se intercalam
      let alvo = (tabelas[nome] ?? []).filter((r) => filtros.every((f) => f(r)))
      if (ordem) { const { col, asc } = ordem; alvo = [...alvo].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1)) }
      alvo = alvo.slice(0, limite)
      if (patch) {
        for (const r of alvo) { Object.assign(r, patch); if (nome === 'ab_native_fichas') r.atualizada_em = `t${++seq}` }
        return { data: devolve ? alvo.map((r) => structuredClone(r)) : [], error: null }
      }
      return { data: alvo.map((r) => structuredClone(r)), error: null }
    }
    q.select = () => { if (patch) devolve = true; return q }
    q.update = (p: Linha) => { patch = p; return q }
    q.eq = (c: string, v: unknown) => { filtros.push((r) => r[c] === v); return q }
    q.is = (c: string, v: unknown) => { filtros.push((r) => (r[c] ?? null) === v); return q }
    q.in = (c: string, vs: unknown[]) => { filtros.push((r) => vs.includes(r[c])); return q }
    q.not = (c: string, _op: string, v: unknown) => { filtros.push((r) => (r[c] ?? null) !== v); return q }
    q.lt = (c: string, v: string) => { filtros.push((r) => String(r[c]) < v); return q }
    q.order = (col: string, o?: { ascending?: boolean }) => { ordem = { col, asc: o?.ascending ?? true }; return q }
    q.limit = (n: number) => { limite = n; return q }
    q.returns = () => q
    q.maybeSingle = async () => { const r = await executa(); return { data: r.data[0] ?? null, error: null } }
    q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => executa().then(res, rej)
    return q
  }
  return { sb: { from } as never, tabelas, leituras }
}
