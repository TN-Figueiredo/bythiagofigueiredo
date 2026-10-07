import { redirect } from 'next/navigation'

/** O mínimo do client do Supabase que o guard usa (facilita o teste). */
export interface OrgAdminRpcClient {
  rpc(
    fn: 'is_org_admin',
    args: { p_org_id: string },
  ): PromiseLike<{ data: unknown; error: unknown }>
}

/**
 * Guarda das páginas de /admin que exigem administrar a organização.
 *
 * Usa `is_org_admin` (SECURITY DEFINER; org_admin da org ou super_admin) com o
 * client do USUÁRIO, e falha fechado: erro de RPC ou qualquer coisa que não
 * seja `true` manda para /cms.
 *
 * Não use `org_role` aqui. Até a migration 20261007000003 ela recursava na
 * policy de `organization_members` (54001) e estas páginas redirecionavam o
 * próprio dono; `is_org_admin` funciona com ou sem aquela migration aplicada.
 */
export async function requireOrgAdmin(client: OrgAdminRpcClient, orgId: string): Promise<void> {
  const { data, error } = await client.rpc('is_org_admin', { p_org_id: orgId })
  if (error || data !== true) redirect('/cms')
}
