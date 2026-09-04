import { createCmsAdmin } from '@tn-figueiredo/cms-admin'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { revalidatePath, revalidateTag } from 'next/cache'

export const cms = createCmsAdmin({
  getClient: getSupabaseServiceClient,
  getSiteContext,
  requireAuth: async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    const ctx = await getSiteContext()
    const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
    if (!res.ok) {
      throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
    }
  },
  revalidatePath,
  // Next 16: revalidateTag exige o perfil como 2o argumento; a interface do
  // @tn-figueiredo/cms-admin ainda e (tag: string) => void. O pacote invalida
  // telas de staff do CMS -> 'seconds'. Contrato do pacote a atualizar (WP-6).
  revalidateTag: (tag: string) => revalidateTag(tag, 'seconds'),
})
