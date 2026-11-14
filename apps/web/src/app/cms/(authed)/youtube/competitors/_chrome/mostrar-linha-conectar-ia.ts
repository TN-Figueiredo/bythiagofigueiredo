import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@tn-figueiredo/auth-nextjs'
import { getSiteContext } from '@/lib/cms/site-context'
import { oauthLigado } from '@/lib/youtube/observatorio/acesso-ia/oauth/config'
import { acessoExternoLigado } from '@/lib/youtube/observatorio/acesso-ia/interruptor'
import { estadoDaSessao } from '@/lib/youtube/observatorio/acesso-ia/estado-da-sessao'

/** q10: a linha do Observatório só aparece com liberação ATIVA e as travas ligadas. Qualquer falha ou dúvida = false (nunca derruba a página). */
export async function mostrarLinhaConectarIa(): Promise<boolean> {
  try {
    if (!oauthLigado() || !acessoExternoLigado().ligado) return false
    const store = await cookies()
    const sb = createServerClient({
      env: {
        apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      cookies: { getAll: () => store.getAll(), setAll: () => {} },
    })
    const { data, error } = await sb.auth.getUser()
    if (error || !data?.user) return false
    const { siteId } = await getSiteContext()
    const estado = await estadoDaSessao(data.user.id, siteId)
    return estado.tipo === 'ativa'
  } catch {
    return false
  }
}
