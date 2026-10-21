import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSiteContext } from '@/lib/cms/site-context'
import { canAdminSiteUsers } from '@/lib/youtube/competitor-admin'

/**
 * O e-mail de quem abre a tela, para o texto do "Copiar pedido ao agente" (D8). Vem da SESSÃO (`auth.getUser()` com o cliente do usuário), nunca do
 * cliente de serviço. Só para quem administra o site (os outros não veem o botão): para eles, nenhuma ida ao Auth. Qualquer falha = null: o texto
 * então pede para completar. A página chama em paralelo com `montarCanais`.
 */
export async function meuEmailDoSite(): Promise<string | null> {
  try {
    const { siteId } = await getSiteContext()
    if (!(await canAdminSiteUsers(siteId))) return null
    const cookieStore = await cookies()
    const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(c: Array<{ name: string; value: string; options?: CookieOptions }>) { for (const { name, value, options } of c) cookieStore.set(name, value, options) },
      },
    })
    const { data, error } = await sb.auth.getUser()
    return error ? null : data.user?.email ?? null
  } catch { return null }
}
