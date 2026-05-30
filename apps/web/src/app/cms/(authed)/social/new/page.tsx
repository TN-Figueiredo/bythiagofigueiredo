import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import Link from 'next/link'
import { CompositorNew } from './_components/compositor-new'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    mode?: string
    post?: string
    draft?: string
    lang?: string
  }>
}

export default async function CompositorPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const params = await searchParams
  const sourceMode: 'cms' | 'freeform' =
    params.mode === 'blank' ? 'freeform' : 'cms'
  const modeLabel = sourceMode === 'cms' ? 'Do CMS' : 'Em branco'

  return (
    <div className="flex min-h-screen flex-col px-[30px] pt-5 pb-[70px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-[7px] mb-2.5 flex-nowrap min-w-0">
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-cms-text-dim shrink-0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 3L3 10l7 3 3 7z" />
          </svg>
          Social
        </span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-cms-text-dim/50 shrink-0"><path d="M9 6l6 6-6 6" /></svg>
        <Link href="/cms/social" className="text-[12.5px] font-medium text-cms-text-dim hover:text-cms-text transition-colors shrink-0 cursor-pointer">
          Posts
        </Link>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-cms-text-dim/50 shrink-0"><path d="M9 6l6 6-6 6" /></svg>
        <span className="text-[12.5px] font-medium text-cms-text-dim shrink-0">
          {modeLabel}
        </span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-cms-text-dim/50 shrink-0"><path d="M9 6l6 6-6 6" /></svg>
        <span className="text-[12.5px] font-semibold text-cms-text truncate max-w-[220px] shrink">
          Instagram · Story
        </span>
      </div>

      {/* Title + segmented control */}
      <div className="flex items-end justify-between gap-3.5 flex-wrap mb-0">
        <h1 className="font-fraunces text-[29px] font-semibold tracking-[-0.01em] whitespace-nowrap m-0">
          Novo post
        </h1>
        <div className="flex gap-2.5 flex-wrap">
          {/* Segmented control */}
          <div className="inline-flex rounded-[9px] p-[3px] gap-[2px]" style={{ background: 'var(--surface-2, var(--color-cms-surface))' }}>
            <Link
              href="/cms/social/new?mode=cms"
              className={`inline-flex items-center gap-1.5 rounded-[7px] border-none px-[13px] py-1.5 text-[12.5px] font-semibold transition-colors ${
                sourceMode === 'cms'
                  ? 'bg-cms-accent text-[#1a120c]'
                  : 'bg-transparent text-cms-text-dim'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M9 12h7" /><path d="M9 16h7" />
              </svg>
              Do CMS
            </Link>
            <Link
              href="/cms/social/new?mode=blank"
              className={`inline-flex items-center gap-1.5 rounded-[7px] border-none px-[13px] py-1.5 text-[12.5px] font-semibold transition-colors ${
                sourceMode === 'freeform'
                  ? 'bg-cms-accent text-[#1a120c]'
                  : 'bg-transparent text-cms-text-dim'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" /><path d="M5 12h14" />
              </svg>
              Em branco
            </Link>
          </div>
        </div>
      </div>

      <div className="h-[18px]" />

      <CompositorNew />
    </div>
  )
}

