import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

/** O e-mail de quem abre a tela, para o texto do "Copiar pedido ao agente" (D8). Qualquer falha = null: o texto então pede para completar. */
export async function meuEmailDoSite(): Promise<string | null> {
  try {
    const { siteId } = await getSiteContext()
    const res = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
    if (!res.ok) return null
    const { data } = await getSupabaseServiceClient().auth.admin.getUserById(res.user.id)
    return data.user?.email ?? null
  } catch { return null }
}
