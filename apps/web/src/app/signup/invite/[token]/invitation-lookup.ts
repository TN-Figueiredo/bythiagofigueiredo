import type { SupabaseClient } from '@supabase/supabase-js'

export interface PendingInvitation {
  email: string
  role: string
  org_name: string
  expires_at: string
}

/**
 * Lê um convite pendente pelo token cru do link.
 *
 * Contrato real da função no banco (conferido contra o Supabase local):
 * `get_invitation_by_token(p_token_hash text) RETURNS jsonb`.
 *
 * - O parâmetro chama `p_token_hash`, mas a comparação é `token = p_token_hash`
 *   contra a coluna `invitations.token`, que guarda o token CRU (64 hex). Não há
 *   hash em lugar nenhum; o nome é herança.
 * - Devolve UM objeto jsonb, ou `null` quando o convite não existe, já foi
 *   aceito, foi revogado ou expirou — a função filtra os quatro casos, então não
 *   existe campo `expired` para distinguir.
 *
 * Chamar com `{ p_token: ... }` responde PGRST202 (função não encontrada) e a
 * tela mostrava "Convite inválido" para todo convite; tratar o retorno como
 * array (`rows[0]`) tinha o mesmo efeito.
 */
export async function fetchPendingInvitation(
  service: SupabaseClient,
  token: string,
): Promise<PendingInvitation | null> {
  const { data, error } = await service.rpc('get_invitation_by_token', {
    p_token_hash: token,
  })
  if (error || data === null || typeof data !== 'object' || Array.isArray(data)) {
    return null
  }
  const row = data as Record<string, unknown>
  if (typeof row.email !== 'string' || row.email === '') return null
  return {
    email: row.email,
    role: typeof row.role === 'string' ? row.role : '',
    org_name: typeof row.org_name === 'string' ? row.org_name : '',
    expires_at: typeof row.expires_at === 'string' ? row.expires_at : '',
  }
}
