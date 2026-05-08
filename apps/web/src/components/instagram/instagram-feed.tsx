import { getSiteContext } from '@/lib/cms/site-context'
import { getInstagramFeedData } from '@/lib/instagram/queries'
import { PolaroidCard } from './polaroid-card'

function extractUsername(handle: string): string {
  const stripped = handle.replace(/^@/, '').trim()
  try {
    const url = new URL(stripped.startsWith('http') ? stripped : `https://${stripped}`)
    if (url.hostname.includes('instagram.com')) {
      return url.pathname.replace(/^\//, '').replace(/\/$/, '')
    }
  } catch { /* not a URL */ }
  return stripped
}

interface InstagramFeedProps {
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
    autoUpdated: 'auto-synced',
    follow: 'Follow on Instagram',
  },
} as const

type LangKey = keyof typeof INSTAGRAM_STRINGS

const SCATTER_LAYOUT = [
  { left: '2%',  top: 8,   rot: -4.5, z: 2, size: 220 },
  { left: '20%', top: 90,  rot: 2.8,  z: 4, size: 230 },
  { left: '39%', top: 0,   rot: -1.2, z: 5, size: 240 },
  { left: '58%', top: 100, rot: 3.6,  z: 3, size: 220 },
  { left: '76%', top: 20,  rot: -2.4, z: 2, size: 225 },
]

function getGridCols(count: number): string {
  if (count <= 3) return 'grid-cols-3'
  if (count <= 4) return 'grid-cols-4'
  if (count <= 6) return 'grid-cols-3'
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

    const effectiveLayout = layout ?? account.layout_type
    const lang: LangKey = effectiveLocale.startsWith('en') ? 'en' : 'pt'
    const strings = INSTAGRAM_STRINGS[lang]
    const profileHandle = extractUsername(account.handle)
    const sectionTitle = (lang === 'en' ? account.section_title_en : account.section_title_pt) ?? strings.title
    const sectionSubtitle = (lang === 'en' ? account.section_subtitle_en : account.section_subtitle_pt) ?? strings.subtitle

    return (
      <section
        className={className}
        aria-label="Instagram feed"
        style={{ maxWidth: 1280, margin: '0 auto', padding: '72px 28px 48px', borderTop: '1px dashed rgba(149,138,117,0.3)', marginTop: 32 }}
      >
        {/* Header — flex row like the design */}
        <div className="mb-9 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <div
              className="inline-block text-[26px] text-orange-400 dark:text-orange-300"
              style={{ fontFamily: 'var(--font-caveat-var), cursive', transform: 'rotate(-1.5deg)' }}
            >
              {sectionSubtitle}
            </div>
            <h2
              className="mt-0.5 text-[38px] font-bold leading-none tracking-tight text-slate-900 dark:text-[#EFE6D2]"
              style={{ fontFamily: 'var(--font-fraunces-var), serif', letterSpacing: '-0.01em' }}
            >
              {sectionTitle}
            </h2>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#6A5F48] dark:text-[#958A75]">
              @{profileHandle} · {strings.autoUpdated}
            </div>
          </div>

          <a
            href={`https://instagram.com/${profileHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 bg-slate-900 px-[18px] py-3 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-white no-underline transition-colors hover:bg-slate-800 dark:bg-[#EFE6D2] dark:text-[#14110B] dark:hover:bg-[#DFD5BF]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
            </svg>
            {strings.follow}
          </a>
        </div>

        {effectiveLayout === 'grid' && (
          <div className={`grid gap-4 ${getGridCols(slots.length)} max-md:grid-cols-2`} style={{ maxWidth: 1080, margin: '0 auto' }}>
            {slots.map((slot, i) => (
              <div
                key={slot.post.id}
                className="transition-transform"
                style={{ transform: `translateY(${i % 2 === 0 ? 14 : -4}px)` }}
              >
                <PolaroidCard post={slot.post} index={i} pinned={slot.pinned} locale={effectiveLocale} />
              </div>
            ))}
          </div>
        )}

        {effectiveLayout === 'scatter' && (
          <>
            {/* Desktop: absolute-positioned scatter */}
            <div className="relative hidden md:block" style={{ height: 460, maxWidth: 1080, margin: '0 auto' }}>
              {slots.map((slot, i) => {
                const pos = SCATTER_LAYOUT[i % SCATTER_LAYOUT.length]!
                return (
                  <div
                    key={slot.post.id}
                    className="absolute transition-transform duration-200 hover:scale-[1.04]"
                    style={{
                      left: pos.left,
                      top: pos.top,
                      width: pos.size,
                      zIndex: pos.z,
                    }}
                  >
                    <PolaroidCard post={slot.post} index={i} pinned={slot.pinned} locale={effectiveLocale} rotation={pos.rot} />
                  </div>
                )
              })}
            </div>

            {/* Mobile: 2-col grid */}
            <div className="grid grid-cols-2 gap-3 md:hidden">
              {slots.map((slot, i) => (
                <div
                  key={slot.post.id}
                  style={{ transform: `translateY(${i % 2 === 0 ? 14 : -4}px)` }}
                >
                  <PolaroidCard post={slot.post} index={i} pinned={slot.pinned} locale={effectiveLocale} />
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    )
  } catch {
    return null
  }
}
