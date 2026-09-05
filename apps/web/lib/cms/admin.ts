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
  // Next 16: revalidateTag exige o 2o argumento; a interface do
  // @tn-figueiredo/cms-admin ainda e (tag: string) => void. { expire: 0 } e
  // purga imediata — o unico equivalente ao revalidateTag de 1 argumento do
  // Next 15. Perfil nomeado ('seconds' etc.) serviria conteudo velho.
  revalidateTag: (tag: string) => revalidateTag(tag, { expire: 0 }),
})
