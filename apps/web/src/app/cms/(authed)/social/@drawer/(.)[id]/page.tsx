import Link from 'next/link'
import { getSocialPost } from '@/lib/social/actions'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { DrawerShell } from '../../_components/drawer-shell'
import { DrawerContent } from '../../_components/drawer-content'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PostDrawerPage({ params }: Props) {
  const { id } = await params

  if (id === 'new' || id === 'accounts' || id === 'insights' || id === 'queue' || id === 'stories' || id === 'templates') {
    return null
  }

  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const result = await getSocialPost(id)
  if (!result.ok) {
    return (
      <DrawerShell>
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
          <p className="text-sm text-cms-text-muted">Post nao encontrado</p>
          <Link
            href="/cms/social"
            className="rounded-lg border border-cms-border px-4 py-2 text-sm text-cms-text hover:bg-cms-surface"
          >
            Voltar
          </Link>
        </div>
      </DrawerShell>
    )
  }

  return (
    <DrawerShell>
      <DrawerContent post={result.data} />
    </DrawerShell>
  )
}
