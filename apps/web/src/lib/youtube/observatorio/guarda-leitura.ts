import * as Sentry from '@sentry/nextjs'
import { criarClienteDeSessao } from '@/lib/cms/cliente-de-sessao'

/**
 * A guarda de LEITURA do Observatório (A2, MG19). Ler o Observatório = ter vínculo no site (`can_view_observatorio`), qualquer papel;
 * o resto do CMS pede `edit`. Mesma forma de retorno de `requireSiteScope` (troca sem mexer no resto), com um motivo a mais:
 * `nao_foi_possivel_conferir` (erro da RPC, exceção ou resposta fora de boolean) nunca vira `insufficient_access`. Só `true` passa.
 * Não cria cliente: o cliente da sessão vem de `lib/cms/cliente-de-sessao`.
 */
export type GuardaDeLeitura =
  | { ok: true; user: { id: string } }
  | { ok: false; reason: 'unauthenticated' | 'insufficient_access' | 'nao_foi_possivel_conferir' }

const TAGS = { guarda: 'leitura-do-observatorio' }

export async function exigirLeituraDoObservatorio(siteId: string): Promise<GuardaDeLeitura> {
  try {
    const sb = await criarClienteDeSessao()
    const { data: u, error: ue } = await sb.auth.getUser()
    if (ue || !u?.user) return { ok: false, reason: 'unauthenticated' }
    const { data, error } = await sb.rpc('can_view_observatorio', { p_site_id: siteId })
    if (error) {
      Sentry.captureException(new Error('guarda de leitura do Observatório: a RPC falhou'), { tags: TAGS, extra: { code: error.code } })
      return { ok: false, reason: 'nao_foi_possivel_conferir' }
    }
    if (data === true) return { ok: true, user: { id: u.user.id } }
    if (data === false) return { ok: false, reason: 'insufficient_access' }
    Sentry.captureMessage('can_view_observatorio devolveu forma inesperada', { level: 'warning', tags: TAGS })
    return { ok: false, reason: 'nao_foi_possivel_conferir' }
  } catch (e) {
    Sentry.captureException(e, { tags: TAGS })
    return { ok: false, reason: 'nao_foi_possivel_conferir' }
  }
}
