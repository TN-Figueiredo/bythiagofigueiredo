// Acesso das ações do A/B Lab. Sem `'use server'` de propósito: exportado de um arquivo `'use server'`, vira endpoint.
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

/** Como requireEditAccess, mas também devolve quem agiu (para o rastro em audit_log). Lança 'unauthenticated' | 'forbidden'. */
export async function requireEditUser(): Promise<{ siteId: string; userId: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return { siteId, userId: res.user.id }
}
