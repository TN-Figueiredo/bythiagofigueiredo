import { cookies } from 'next/headers'
import { createServerClient } from '@tn-figueiredo/auth-nextjs'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '../supabase/service'

export type SiteAdminScopeResult =
  | { ok: true; user: { id: string } }
  | { ok: false; reason: 'unauthenticated' | 'insufficient_access' }

/**
 * O degrau "administrar o site", acima de editar: ações caras ou irreversíveis
 * (disparar newsletter, exportar/apagar dados pessoais, aplicar vencedor de
 * A/B, remover canal, mexer em integração, sync caro em cota).
 *
 * Passa: super_admin (org_admin da organização raiz) e org_admin da
 * organização dona do site — `can_admin_site_users(site_id)`. Editora de site
 * (`site_memberships.role='editor'`) NÃO passa. Não existe papel novo em
 * tabela: o degrau é só esta pergunta ao banco.
 *
 * Pergunta pelo cliente da SESSÃO: a função é SECURITY DEFINER e lê
 * `auth.uid()`, então um service client (sem uid) responderia sempre false.
 * Falha FECHADO: sem usuário, erro de RPC, exceção ou qualquer resposta que
 * não seja exatamente `true` negam. Chame no TOPO da action, antes de
 * qualquer `getSupabaseServiceClient()`.
 *
 * Mesmo formato de retorno do `requireSiteScope` do pacote (que só conhece
 * view/edit/publish), para os chamadores tratarem os dois do mesmo jeito.
 */
export async function requireSiteAdminScope(siteId: string): Promise<SiteAdminScopeResult> {
  try {
    const cookieStore = await cookies()
    const userClient = createServerClient({
      env: {
        apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          // Num Server Component (a tela pergunta "mostro o botão?") o Next
          // proíbe gravar cookie; a renovação do token não pode virar "negado".
          try {
            for (const { name, value, options } of list) cookieStore.set(name, value, options)
          } catch {
            /* render: sem escrita de cookie */
          }
        },
      },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) return { ok: false, reason: 'unauthenticated' }
    const { data, error } = await userClient.rpc('can_admin_site_users', { p_site_id: siteId })
    if (error || data !== true) return { ok: false, reason: 'insufficient_access' }
    return { ok: true, user: { id: userData.user.id } }
  } catch {
    return { ok: false, reason: 'insufficient_access' }
  }
}

/** Frase única de recusa do degrau: "Só quem administra o site pode <ação>." */
export function siteAdminOnlyMessage(acao: string): string {
  return `Só quem administra o site pode ${acao}.`
}

export type AuthorizableTable = 'blog_posts' | 'campaigns' | 'newsletter_editions'

/**
 * Authorization guard for write server actions on site-scoped rows.
 *
 * Looks up the row's `site_id` via the service-role client (so the guard
 * works even when RLS would otherwise hide the row), then delegates the
 * actual authorisation check to
 * `requireSiteScope({ area: 'cms', siteId, mode: 'edit' })` from
 * `@tn-figueiredo/auth-nextjs` (Track C). The helper exercises the
 * `can_edit_site` RPC introduced in Sprint 4.75 Track A — which reads
 * `site_memberships` with cascade-up to `organization_members`, replacing
 * the ad-hoc `can_admin_site` lookup this guard used to do inline.
 *
 * Throws on failure: 'row_not_found', 'unauthenticated', 'forbidden'.
 */
export async function requireSiteAdminForRow(
  table: AuthorizableTable,
  rowId: string,
): Promise<{ siteId: string }> {
  const supabase = getSupabaseServiceClient()
  const { data: row, error: rowErr } = await supabase
    .from(table)
    .select('site_id')
    .eq('id', rowId)
    .maybeSingle()

  if (rowErr) throw new Error(`row_lookup_failed: ${rowErr.message}`)
  if (!row) throw new Error('row_not_found')

  const res = await requireSiteScope({
    area: 'cms',
    siteId: row.site_id as string,
    mode: 'edit',
  })
  if (!res.ok) {
    // Translate the richer `requireSiteScope` result into the coarse
    // 'forbidden' / 'unauthenticated' strings the existing callers (blog
    // actions, campaign actions) already recognise.
    throw new Error(
      res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden',
    )
  }

  return { siteId: row.site_id as string }
}
