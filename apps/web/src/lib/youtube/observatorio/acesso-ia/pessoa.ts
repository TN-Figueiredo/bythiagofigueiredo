// As três conferências da porta que vão ao banco (plano, 4.2, passos 5 e 6), todas com o cliente de serviço e prazo por ida.
// Regra de todas: NÃO TER RESPOSTA NÃO É NEGAÇÃO. Erro do banco, exceção, prazo estourado e resposta fora de forma dão
// `nao_conferido` (a porta responde 503), nunca "sem acesso" (que acusaria a pessoa) nem "ok". Nenhuma lança.
import 'server-only'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ACESSO_IA_RULES } from './regras'

export type EstadoDaPessoa = 'ativa' | 'banida' | 'ausente' | 'nao_conferido'

interface Opcoes { prazoMs?: number }

type ComPrazo<T> = { ok: true; valor: T } | { ok: false; code: 'tempo' | 'excecao' }

/**
 * Roda `fazer` com um sinal de cancelamento de `prazoMs` (AbortSignal.timeout) e NÃO espera além dele, mesmo que a chamada
 * ignore o sinal (a API de administração não aceita sinal): a corrida é contra o próprio sinal.
 */
async function comPrazo<T>(prazoMs: number, fazer: (sinal: AbortSignal) => PromiseLike<T>): Promise<ComPrazo<T>> {
  const sinal = AbortSignal.timeout(prazoMs)
  const estouro = new Promise<typeof ESTOUROU>((resolve) => {
    if (sinal.aborted) resolve(ESTOUROU)
    else sinal.addEventListener('abort', () => resolve(ESTOUROU), { once: true })
  })
  try {
    const r = await Promise.race([Promise.resolve(fazer(sinal)), estouro])
    return r === ESTOUROU ? { ok: false, code: 'tempo' } : { ok: true, valor: r }
  } catch {
    return { ok: false, code: 'excecao' }
  }
}
const ESTOUROU = Symbol('estourou')

const codigoDe = (e: unknown): string => {
  if (typeof e === 'object' && e !== null) {
    const { code, status } = e as { code?: unknown; status?: unknown }
    if (typeof code === 'string' && code !== '') return code
    if (typeof status === 'number') return `http_${status}`
  }
  return 'desconhecido'
}

const prazoDe = (o?: Opcoes): number => o?.prazoMs ?? ACESSO_IA_RULES.prazoPorIdaMs

/**
 * A pessoa existe e não está banida? (`auth.admin.getUserById`.) Banida = `banned_until` preenchida e no futuro; texto que não é
 * data (`banned_until` sem fim legível) também vale banida: na dúvida entre abrir e fechar a conta, fecha.
 */
export async function estadoDaPessoa(userId: string, opcoes?: Opcoes & { agora?: number }): Promise<{ estado: EstadoDaPessoa; code?: string }> {
  const agora = opcoes?.agora ?? Date.now()
  let sb
  try { sb = getSupabaseServiceClient() } catch { return { estado: 'nao_conferido', code: 'cliente' } }
  const r = await comPrazo(prazoDe(opcoes), () => sb.auth.admin.getUserById(userId))
  if (!r.ok) return { estado: 'nao_conferido', code: r.code }
  const { data, error } = (r.valor ?? {}) as { data?: { user?: { banned_until?: unknown } | null } | null; error?: unknown }
  if (error) {
    const e = error as { status?: unknown; code?: unknown }
    if (e.status === 404 || e.code === 'user_not_found') return { estado: 'ausente' }
    return { estado: 'nao_conferido', code: codigoDe(error) }
  }
  const user = data?.user
  if (!user || typeof user !== 'object') return { estado: 'nao_conferido', code: 'forma_invalida' }
  const ate = user.banned_until
  if (ate === null || ate === undefined || ate === '') return { estado: 'ativa' }
  if (typeof ate !== 'string') return { estado: 'nao_conferido', code: 'forma_invalida' }
  const ms = Date.parse(ate)
  if (!Number.isFinite(ms)) return { estado: 'banida' }
  return { estado: ms > agora ? 'banida' : 'ativa' }
}

/**
 * `can_view_site_as(p_user, p_site)`: só `true` é `sim`, só `false` é `nao`. Qualquer outra coisa (null, o texto 'true', 1, erro,
 * função ausente, exceção, prazo) é `nao_conferido`.
 */
export async function veOSite(userId: string, siteId: string, opcoes?: Opcoes): Promise<'sim' | 'nao' | 'nao_conferido'> {
  let sb
  try { sb = getSupabaseServiceClient() } catch { return 'nao_conferido' }
  const r = await comPrazo(prazoDe(opcoes), (sinal) => sb.rpc('can_view_site_as', { p_user: userId, p_site: siteId }).abortSignal(sinal))
  if (!r.ok) return 'nao_conferido'
  const { data, error } = (r.valor ?? {}) as { data?: unknown; error?: unknown }
  if (error) return 'nao_conferido'
  if (data === true) return 'sim'
  if (data === false) return 'nao'
  return 'nao_conferido'
}

/**
 * A pessoa tem pedido de apagamento confirmado e não cancelado? (`lgpd_requests`: `type = 'account_deletion'`, fase 1 concluída,
 * `cancelled_at` nula.) O banimento da fase 1 é de melhor esforço; o pedido é gravado pelo banco. Lista vazia LIDA SEM ERRO é
 * `nao`; erro, prazo, tabela ausente (42P01, PGRST205) e dado nulo são `nao_conferido`, nunca `nao`.
 */
export async function pediuApagamento(userId: string, opcoes?: Opcoes): Promise<'sim' | 'nao' | 'nao_conferido'> {
  let sb
  try { sb = getSupabaseServiceClient() } catch { return 'nao_conferido' }
  const r = await comPrazo(prazoDe(opcoes), (sinal) =>
    sb.from('lgpd_requests')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'account_deletion')
      .not('phase_1_completed_at', 'is', null)
      .is('cancelled_at', null)
      .limit(1)
      .abortSignal(sinal),
  )
  if (!r.ok) return 'nao_conferido'
  const { data, error } = (r.valor ?? {}) as { data?: unknown; error?: unknown }
  if (error) return 'nao_conferido'
  if (!Array.isArray(data)) return 'nao_conferido'
  return data.length > 0 ? 'sim' : 'nao'
}
