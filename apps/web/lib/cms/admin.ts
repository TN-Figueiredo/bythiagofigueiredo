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
  revalidateTag,
})
