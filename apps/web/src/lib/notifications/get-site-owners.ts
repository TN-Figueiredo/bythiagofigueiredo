import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveUserIdentities } from '@/app/admin/(authed)/users/user-directory'

/** Resultado do aviso quando nenhuma rotina achou destinatário. Visível no JSON do cron e no log. */
export const SEM_DESTINATARIO = 'sem_destinatario'

export interface ISiteOwner {
  userId: string
  email: string | null
}

type OwnersClient = Pick<SupabaseClient, 'from' | 'rpc' | 'auth'>

const MAX_DEPTH = 8

/**
 * Dono(s) do site para avisos operacionais: membros `org_admin` da organização RAIZ
 * do site (a própria org do site, ou subindo por `parent_org_id` até a que não tem
 * mãe). "super_admin" não existe em `organization_members` (o CHECK só aceita
 * `org_admin`) — é org_admin da raiz.
 *
 * E-mail: RPC `admin_user_directory` quando existe; senão `auth.admin.getUserById`.
 * Nunca lança: sem site/org/membros devolve `[]` (quem chama DEVE registrar
 * `sem_destinatario`, nunca terminar como sucesso mudo).
 * Só com service client.
 */
export async function getSiteOwners(client: OwnersClient, siteId: string): Promise<ISiteOwner[]> {
  try {
    const { data: site } = await client.from('sites').select('org_id').eq('id', siteId).maybeSingle()
    let orgId = (site as { org_id?: string } | null)?.org_id ?? null
    if (!orgId) return []

    for (let i = 0; i < MAX_DEPTH; i++) {
      const { data: org } = await client
        .from('organizations')
        .select('id, parent_org_id')
        .eq('id', orgId)
        .maybeSingle()
      const row = org as { id: string; parent_org_id: string | null } | null
      if (!row) return []
      if (!row.parent_org_id) break
      orgId = row.parent_org_id
    }

    const { data: members } = await client
      .from('organization_members')
      .select('user_id')
      .eq('org_id', orgId)
      .eq('role', 'org_admin')
    const ids = [...new Set(((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id))]
    if (ids.length === 0) return []

    let identities: Awaited<ReturnType<typeof resolveUserIdentities>> | null = null
    try {
      identities = await resolveUserIdentities(client, ids)
    } catch {
      identities = null // sem e-mail não é sem dono: o aviso in-app ainda tem user_id
    }
    return ids.map((userId) => ({ userId, email: identities?.get(userId)?.email ?? null }))
  } catch (err) {
    console.warn('[get-site-owners] falhou', err instanceof Error ? err.message : 'unknown')
    return []
  }
}

/** Registro estruturado de "a rotina rodou e não havia a quem avisar". */
export function logSemDestinatario(routine: string, siteId: string): void {
  console.warn(JSON.stringify({ level: 'warn', event: SEM_DESTINATARIO, routine, site_id: siteId }))
}
