// Sessão falsa para os testes do degrau "administrar o site" (`requireSiteAdminScope`).
// O guarda real roda; o que se troca é só a resposta do banco a `can_admin_site_users`:
//   'admin'     → true  (org_admin / super_admin)
//   'editor'    → false (editora de site: pode editar, não administra)
//   'rpc_error' → erro da RPC de permissão (tem de negar — falha fechado)
//   'anon'      → sem usuário na sessão
// Uso (no arquivo de teste, porque vi.mock é içado):
//   const sess = vi.hoisted(() => ({ who: 'admin' as SessionWho, rpcCalls: [] as string[] }))
//   vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
//   vi.mock('@tn-figueiredo/auth-nextjs/server', async () => {
//     const { fakeSessionClient } = await import('../helpers/site-admin-session')
//     return { createServerClient: () => fakeSessionClient(sess), requireSiteScope: ... }
//   })
// ATENÇÃO: '@tn-figueiredo/auth-nextjs' e '@tn-figueiredo/auth-nextjs/server' resolvem para o MESMO
// arquivo — o último vi.mock vence. Um mock só, com createServerClient E requireSiteScope.
export type SessionWho = 'admin' | 'editor' | 'rpc_error' | 'anon'

export interface SessionState {
  who: SessionWho
  /** Nome de cada RPC pedida pela sessão, em ordem. */
  rpcCalls: string[]
}

export const SESSION_USER_ID = '00000000-0000-4000-8000-0000000000aa'

export function fakeSessionClient(state: SessionState) {
  return {
    auth: {
      getUser: async () =>
        state.who === 'anon'
          ? { data: { user: null }, error: { message: 'no session' } }
          : { data: { user: { id: SESSION_USER_ID, email: 'sessao@example.test' } }, error: null },
    },
    rpc: async (name: string, _args?: Record<string, unknown>) => {
      state.rpcCalls.push(name)
      if (name !== 'can_admin_site_users') return { data: null, error: { message: `rpc inesperada: ${name}` } }
      if (state.who === 'rpc_error') return { data: null, error: { message: 'permission rpc boom' } }
      return { data: state.who === 'admin', error: null }
    },
  }
}

/** Os três não-administradores que todo teste do degrau percorre. */
export const DENIED: ReadonlyArray<Exclude<SessionWho, 'admin'>> = ['editor', 'rpc_error', 'anon']

// ── Service client gravador ──────────────────────────────────────────────────
// Aceita qualquer cadeia `.from().select().eq()…` e anota o que foi tocado. Serve
// para provar "negado e NENHUM efeito": `clients === 0` (o service client nem
// foi criado) e nenhuma escrita/RPC.
export interface ServiceLog {
  /** Quantas vezes getSupabaseServiceClient() foi chamado. */
  clients: number
  writes: Array<{ table: string; op: string }>
  reads: string[]
  rpcs: string[]
  /** Linha devolvida por toda leitura (`.single()` → a linha; lista → [linha]). */
  row: Record<string, unknown>
  /** Resposta das RPCs do service client. */
  rpcData: unknown
}

export function newServiceLog(): ServiceLog {
  return { clients: 0, writes: [], reads: [], rpcs: [], row: {}, rpcData: { ok: true } }
}

export function resetServiceLog(log: ServiceLog, row: Record<string, unknown> = {}): void {
  log.clients = 0
  log.writes.length = 0
  log.reads.length = 0
  log.rpcs.length = 0
  log.row = row
  log.rpcData = { ok: true }
}

const WRITE_OPS = ['update', 'delete', 'insert', 'upsert'] as const
const CHAIN_OPS = [
  'select', 'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'limit', 'order', 'is', 'not', 'or', 'ilike', 'like',
  'range', 'match', 'contains', 'filter', 'returns', 'overrideTypes',
] as const

export function recordingServiceClient(log: ServiceLog) {
  log.clients++
  const from = (table: string) => {
    let single = false
    const q: Record<string, unknown> = {}
    for (const m of CHAIN_OPS) q[m] = () => q
    for (const op of WRITE_OPS) {
      q[op] = () => {
        log.writes.push({ table, op })
        return q
      }
    }
    q.single = () => { single = true; return q }
    q.maybeSingle = q.single
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
      log.reads.push(table)
      return Promise.resolve(
        single ? { data: log.row, error: null } : { data: [log.row], error: null, count: 7 },
      ).then(ok, ko)
    }
    return q
  }
  return {
    from,
    rpc: async (name: string) => {
      log.rpcs.push(name)
      return { data: log.rpcData, error: null }
    },
    storage: {
      from: () => ({
        list: async () => ({ data: [], error: null }),
        remove: async () => ({ data: [], error: null }),
        upload: async () => ({ data: {}, error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: 'https://x.test/s' }, error: null }),
      }),
    },
  }
}

/** Houve algum efeito no banco? (escrita ou RPC pelo service client) */
export function hadEffect(log: ServiceLog): boolean {
  return log.writes.length > 0 || log.rpcs.length > 0
}
