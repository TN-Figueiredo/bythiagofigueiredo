import { getSiteContext } from '@/lib/cms/site-context'
import { getInstagramFeedData } from '@/lib/instagram/queries'
import { PolaroidCard } from './polaroid-card'
import type { InstagramAccountPublic } from '@/lib/instagram/types'

interface InstagramFeedProps {
  accountId?: string
  layout?: 'grid' | 'scatter'
  count?: number
  locale?: string
  className?: string
}

const INSTAGRAM_STRINGS = {
  pt: {
    subtitle: 'últimos cliques',
    title: 'do iPhone, sem filtro',
    autoUpdated: 'atualizado automaticamente',
    follow: 'Siga no Instagram',
  },
  en: {
    subtitle: 'latest shots',
    title: 'from the iPhone, no filter',
    autoUpdated: 'auto-updated',
    follow: 'Follow on Instagram',
  },
} as const

const SCATTER_POSITIONS: Record<number, { top: string; left: string }[]> = {
  3: [
    { top: '5%', left: '5%' },
    { top: '10%', left: '38%' },
    { top: '0%', left: '68%' },
  ],
  4: [
    { top: '0%', left: '2%' },
    { top: '15%', left: '26%' },
    { top: '5%', left: '50%' },
    { top: '12%', left: '74%' },
  ],
  5: [
    { top: '0%', left: '2%' },
    { top: '15%', left: '22%' },
    { top: '5%', left: '42%' },
    { top: '18%', left: '60%' },
    { top: '2%', left: '78%' },
  ],
  6: [
    { top: '0%', left: '0%' },
    { top: '12%', left: '18%' },
    { top: '2%', left: '36%' },
    { top: '15%', left: '52%' },
    { top: '5%', left: '68%' },
    { top: '10%', left: '84%' },
  ],
  8: [
    { top: '0%', left: '0%' },
    { top: '10%', left: '13%' },
    { top: '2%', left: '26%' },
    { top: '14%', left: '38%' },
    { top: '4%', left: '50%' },
    { top: '12%', left: '62%' },
    { top: '0%', left: '74%' },
    { top: '8%', left: '86%' },
  ],
  12: [
    { top: '0%', left: '0%' },
    { top: '8%', left: '9%' },
    { top: '2%', left: '18%' },
    { top: '12%', left: '27%' },
    { top: '4%', left: '36%' },
    { top: '10%', left: '45%' },
    { top: '0%', left: '54%' },
    { top: '14%', left: '63%' },
    { top: '6%', left: '72%' },
    { top: '10%', left: '81%' },
    { top: '2%', left: '88%' },
    { top: '8%', left: '94%' },
  ],
}

function generateScatterPositions(count: number): { top: string; left: string }[] {
  return Array.from({ length: count }, (_, i) => ({
    top: `${(i * 7 + 3) % 20}%`,
    left: `${(i / count) * 85}%`,
  }))
}

function getGridCols(count: number): string {
  if (count <= 3) return 'grid-cols-3'
  if (count <= 4) return 'grid-cols-4'
  if (count <= 6) return 'grid-cols-3'
  if (count <= 8) return 'grid-cols-4'
  return 'grid-cols-4'
}

export async function InstagramFeed({
  layout,
  count,
  locale,
  className = '',
}: InstagramFeedProps) {
  try {
    const { siteId, defaultLocale } = await getSiteContext()
    const effectiveLocale = locale ?? defaultLocale ?? 'pt-BR'

    const { account, slots } = await getInstagramFeedData(siteId, effectiveLocale, count)

    if (!account || slots.length === 0) return null

    const effectiveLayout = layout ?? (account as InstagramAccountPublic).layout_type
    const handle = (account as InstagramAccountPublic).handle
    const lang = effectiveLocale.startsWith('en') ? 'en' : 'pt'
    const strings = INSTAGRAM_STRINGS[lang]

    return (
      <section className={`${className}`}>
        <div className="mb-6 text-center">
          <p className="text-lg text-indigo-400 dark:text-indigo-300" style={{ fontFamily: 'var(--font-caveat-var), cursive', transform: 'rotate(-2deg)' }}>
            {strings.subtitle}
          </p>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'var(--font-fraunces-var), serif' }}>
            {strings.title}
          </h2>
          <p className="mt-1 font-mono text-xs text-slate-500">
            {handle} · {strings.autoUpdated}
          </p>
        </div>

        {effectiveLayout === 'grid' && (
          <div className={`grid gap-4 ${getGridCols(slots.length)} max-md:grid-cols-2`}>
            {slots.map((slot, i) => (
              <div
                key={slot.post.id}
                className="transition-transform"
                style={{ transform: `translateY(${i % 2 === 0 ? 14 : -4}px)` }}
              >
                <PolaroidCard post={slot.post} index={i} pinned={slot.pinned} />
              </div>
            ))}
          </div>
        )}

        {effectiveLayout === 'scatter' && (
          <>
            <div className="relative hidden min-h-[500px] md:block">
              {slots.map((slot, i) => {
                const positions = SCATTER_POSITIONS[slots.length] ?? generateScatterPositions(slots.length)
                const pos = positions[i % positions.length]!
                return (
                  <div
                    key={slot.post.id}
                    className="absolute w-[180px]"
                    style={{ top: pos.top, left: pos.left, animation: `float ${3 + (i % 3)}s ease-in-out ${i * 0.5}s infinite` }}
                  >
                    <PolaroidCard post={slot.post} index={i} pinned={slot.pinned} />
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 md:hidden">
              {slots.map((slot, i) => (
                <div
                  key={slot.post.id}
                  style={{ transform: `translateY(${i % 2 === 0 ? 14 : -4}px)` }}
                >
                  <PolaroidCard post={slot.post} index={i} pinned={slot.pinned} />
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-8 text-center">
          <a
            href={`https://instagram.com/${handle.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded bg-slate-900 px-6 py-2.5 font-mono text-xs font-medium uppercase tracking-wider text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {strings.follow}
          </a>
        </div>
      </section>
    )
  } catch {
    return null
  }
}
