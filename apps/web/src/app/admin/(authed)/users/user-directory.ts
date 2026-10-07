import type { SupabaseClient } from '@supabase/supabase-js'

export interface UserIdentity {
  email: string | null
  name: string | null
}

type DirectoryClient = Pick<SupabaseClient, 'rpc' | 'auth'>

function metaName(meta: unknown): string | null {
  if (meta == null || typeof meta !== 'object') return null
  const m = meta as Record<string, unknown>
  for (const key of ['full_name', 'name']) {
    const v = m[key]
    if (typeof v === 'string' && v.trim() !== '') return v.trim()
  }
  return null
}

/**
 * E-mail e nome de cada usuário de /admin/users.
 *
 * 1. `admin_user_directory` (migration 20261007000004): uma leitura só, direto
 *    em auth.users.
 * 2. Quem a RPC não devolveu — ou todos, se ela ainda não existe no banco ou
 *    falhou — cai em `auth.admin.getUserById`, um por um (o caminho antigo).
 *
 * Só chame com o service client, DEPOIS do guard de org_admin.
 */
export async function resolveUserIdentities(
  service: DirectoryClient,
  userIds: readonly string[],
): Promise<Map<string, UserIdentity>> {
  const ids = [...new Set(userIds)]
  const out = new Map<string, UserIdentity>()
  if (ids.length === 0) return out

  const { data, error } = await service.rpc('admin_user_directory', { p_user_ids: ids })
  if (error) {
    console.warn('[admin_user_directory] indisponível, usando getUserById', error.code ?? 'unknown')
  } else {
    for (const row of (data ?? []) as Array<{
      user_id: string
      email: string | null
      display_name: string | null
    }>) {
      out.set(row.user_id, { email: row.email || null, name: row.display_name || null })
    }
  }

  await Promise.all(
    ids
      .filter((id) => !out.get(id)?.email)
      .map(async (id) => {
        try {
          const { data: res } = await service.auth.admin.getUserById(id)
          if (res.user) {
            out.set(id, {
              email: res.user.email ?? null,
              name: metaName(res.user.user_metadata) ?? out.get(id)?.name ?? null,
            })
          }
        } catch {
          // segue sem identidade: o rótulo cai no UUID
        }
      }),
  )
  return out
}

/** "Nome · email", só o e-mail, só o nome — e o UUID apenas como último recurso. */
export function userLabel(userId: string, identity: UserIdentity | undefined): string {
  const email = identity?.email?.trim() || null
  const name = identity?.name?.trim() || null
  if (name && email) return `${name} · ${email}`
  return email ?? name ?? userId
}
