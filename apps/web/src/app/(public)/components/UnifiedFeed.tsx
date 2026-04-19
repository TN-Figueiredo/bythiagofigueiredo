import Link from 'next/link'
import Image from 'next/image'
import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import { coverGradient } from '@/lib/home/cover-image'
import type { HomePost, HomeVideo } from '@/lib/home/types'

type FeedItem =
  | ({ kind: 'post' } & HomePost)
  | ({ kind: 'video' } & HomeVideo)

type Props = {
  posts: HomePost[]
  videos: HomeVideo[]
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
  isDark: boolean
}

export function UnifiedFeed({ posts, videos, locale, t, isDark }: Props) {
  const blogBase = locale === 'pt-BR' ? '/blog/pt-BR' : '/blog/en'

  const items: FeedItem[] = [
    ...posts.map((p) => ({ kind: 'post' as const, ...p })),
    ...videos.map((v) => ({ kind: 'video' as const, ...v })),
  ]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 9)

  if (items.length === 0) return null

  return (
    <section className="px-6 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item, i) => (
          <FeedCard
            key={`${item.kind}-${item.id}`}
            item={item}
            index={i}
            blogBase={blogBase}
            t={t}
            isDark={isDark}
          />
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link href={blogBase} className="font-mono text-sm text-pb-accent hover:underline">
          {t['feed.seeAll']}
        </Link>
      </div>
    </section>
  )
}

function FeedCard({
  item,
  index,
  blogBase,
  t,
  isDark,
}: {
  item: FeedItem
  index: number
  blogBase: string
  t: Record<string, string>
  isDark: boolean
}) {
  const tapeVariants = ['tape', 'tape2', 'tapeR'] as const
  const tape = tapeVariants[index % 3]

  if (item.kind === 'post') {
    return (
      <PaperCard
        index={index}
        variant={index % 2 === 0 ? 'paper' : 'paper2'}
        className="overflow-hidden"
      >
        <Tape variant={tape} className="-top-2 left-4" rotate={-7 + (index % 5)} />
        <Link href={`${blogBase}/${item.slug}`} className="block group">
          <div
            className="h-32 w-full"
            style={{
              background: item.coverImageUrl
                ? undefined
                : coverGradient(item.category, isDark),
            }}
          >
            {item.coverImageUrl && (
              <Image
                src={item.coverImageUrl}
                alt={item.title}
                width={400}
                height={128}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold text-pb-accent">
                ▤ {t['feed.type.post']}
              </span>
              {item.category && (
                <span className="font-mono text-xs text-pb-muted capitalize">
                  {item.category}
                </span>
              )}
              <span className="font-mono text-xs text-pb-faint ml-auto">
                {item.readingTimeMin}
                {t['feed.readMin']}
              </span>
            </div>
            <h3
              className="font-fraunces text-pb-ink text-lg leading-snug group-hover:text-pb-accent transition-colors"
              style={{ letterSpacing: '-0.01em' }}
            >
              {item.title}
            </h3>
            {item.excerpt && (
              <p className="text-pb-muted text-xs mt-1 line-clamp-2">{item.excerpt}</p>
            )}
          </div>
        </Link>
      </PaperCard>
    )
  }

  return (
    <PaperCard
      index={index}
      variant={index % 2 === 0 ? 'paper' : 'paper2'}
      className="overflow-hidden"
    >
      <Tape variant={tape} className="-top-2 left-4" rotate={-7 + (index % 5)} />
      <a href={item.youtubeUrl} target="_blank" rel="noopener noreferrer" className="block group">
        <div
          className="h-32 w-full relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#1a0808 0%,#3a1010 100%)' }}
        >
          {item.thumbnailUrl && (
            <Image
              src={item.thumbnailUrl}
              alt={item.title}
              fill
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl text-white opacity-70 group-hover:opacity-100 transition-opacity">
              ▶
            </span>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs font-bold text-pb-yt">
              ▶ {t['feed.type.video']}
            </span>
            <span className="font-mono text-xs text-pb-muted">{item.series}</span>
            <span className="font-mono text-xs text-pb-faint ml-auto">{item.duration}</span>
          </div>
          <h3
            className="font-fraunces text-pb-ink text-lg leading-snug group-hover:text-pb-yt transition-colors"
            style={{ letterSpacing: '-0.01em' }}
          >
            {item.title}
          </h3>
        </div>
      </a>
    </PaperCard>
  )
}
