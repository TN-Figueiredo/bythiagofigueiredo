import Link from 'next/link'
import { cms } from '@/lib/cms/admin'
import { CmsTopbar, CmsButton } from '@tn-figueiredo/cms-ui/client'
import { EditionsTable } from '@tn-figueiredo/cms-admin/newsletters/client'
import { TypeCards } from './_components/type-cards'

export const dynamic = 'force-dynamic'

export default async function NewsletterDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>
}) {
  const params = await searchParams

  const [types, { editions }] = await Promise.all([
    cms.newsletters.listTypes(),
    cms.newsletters.listEditions({
      typeId: params.type,
      status: params.status,
    }),
  ])

  return (
    <div>
      <CmsTopbar
        title="Newsletters"
        actions={
          <Link href="/cms/newsletters/new">
            <CmsButton variant="primary" size="sm">
              + New Edition
            </CmsButton>
          </Link>
        }
      />
      <div className="p-6 lg:p-8 space-y-6">
        <TypeCards
          types={types}
          selectedTypeId={params.type ?? null}
          currentStatus={params.status}
        />

        <div className="flex items-center gap-1 text-xs">
          {['all', 'draft', 'ready', 'scheduled', 'sending', 'sent', 'failed'].map((s) => {
            const isActive = (params.status ?? 'all') === s
            return (
              <Link
                key={s}
                href={`/cms/newsletters?${new URLSearchParams({
                  ...(params.type ? { type: params.type } : {}),
                  ...(s !== 'all' ? { status: s } : {}),
                }).toString()}`}
                className={`rounded-full px-3 py-1.5 font-medium capitalize transition-colors ${
                  isActive
                    ? 'bg-cms-accent text-white'
                    : 'text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text'
                }`}
              >
                {s}
              </Link>
            )
          })}
        </div>

        <EditionsTable editions={editions} />
      </div>
    </div>
  )
}
