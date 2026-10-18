import 'server-only'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

/** Pode editar o site? Mesma guarda das ações do A/B Lab; erro da guarda = false (nada aparece). */
export async function podeEditarSite(siteId: string): Promise<boolean> {
  try {
    const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
    return res.ok
  } catch {
    return false
  }
}
