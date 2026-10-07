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
