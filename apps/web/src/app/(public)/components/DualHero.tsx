import Link from 'next/link'
import Image from 'next/image'
import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import { coverGradient } from '../../../../lib/home/cover-image'
import type { HomePost, HomeVideo } from '../../../../lib/home/types'

type Props = {
  post: HomePost | null
  video: HomeVideo | null
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
  isDark: boolean
}

export function DualHero({ post, video, locale, t, isDark }: Props) {
  const blogBase = locale === 'pt-BR' ? '/blog/pt-BR' : '/blog/en'

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-8 py-10 px-6">
      {/* Featured Post — rotationDeg prop overrides the computed index-based rotation */}
      <PaperCard index={0} rotationDeg={-0.8} className="overflow-hidden pb-fade-in">
        <Tape variant="tape" className="-top-2 left-6" rotate={-6} />
        <Tape variant="tape2" className="-top-2 right-6" rotate={5} />

        {post ? (
          <Link href={`${blogBase}/${post.slug}`} className="block group">
            {/* Cover */}
            <div className="h-52 w-full overflow-hidden">
              {post.coverImageUrl ? (
                <Image
                  src={post.coverImageUrl}
                  alt={post.title}
                  width={600}
                  height={208}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{ background: coverGradient(post.category, isDark) }}
                />
              )}
            </div>

            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-xs font-bold text-pb-accent tracking-widest">
                  ▤ {t['hero.post.badge']}
                </span>
                {post.category && (
                  <span className="font-mono text-xs text-pb-muted capitalize">{post.category}</span>
                )}
                <span className="font-mono text-xs text-pb-faint ml-auto">
                  {post.readingTimeMin} {t['feed.readMin']}
                </span>
              </div>
              <h2 className="font-fraunces text-pb-ink text-2xl md:text-3xl leading-tight mb-2 group-hover:text-pb-accent transition-colors" style={{ letterSpacing: '-0.02em' }}>
                {post.title}
              </h2>
              {post.excerpt && (
                <p className="text-pb-muted text-sm leading-relaxed line-clamp-3">{post.excerpt}</p>
              )}
            </div>
          </Link>
        ) : (
          <div className="p-5 h-64 flex items-center justify-center">
            <span className="font-fraunces text-pb-faint text-xl">{t['hero.comingSoon']}</span>
          </div>
        )}

        <p className="font-caveat text-pb-muted text-base px-5 pb-4">{t['hero.post.mustRead']}</p>
      </PaperCard>

      {/* Featured Video */}
      {video && (
        <PaperCard index={1} variant="paper2" rotationDeg={0.8} className="overflow-hidden pb-fade-in">
          <Tape variant="tapeR" className="-top-2 left-1/2 -translate-x-1/2" rotate={-2} />

          <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer" className="block group">
            {/* Thumbnail */}
            <div className="h-52 w-full relative overflow-hidden bg-pb-bg">
              {video.thumbnailUrl ? (
                <Image src={video.thumbnailUrl} alt={video.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#1a0a0a 0%,#3a1010 100%)' }}>
                  <span className="text-5xl text-pb-yt opacity-80">▶</span>
                </div>
              )}
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-6xl text-white drop-shadow-lg">▶</span>
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-xs font-bold text-pb-yt tracking-widest">▶ {t['hero.video.badge']}</span>
                <span className="font-mono text-xs text-pb-muted">{video.series}</span>
                <span className="font-mono text-xs text-pb-faint ml-auto">{video.duration}</span>
              </div>
              <h2 className="font-fraunces text-pb-ink text-2xl md:text-3xl leading-tight mb-2 group-hover:text-pb-yt transition-colors" style={{ letterSpacing: '-0.02em' }}>
                {video.title}
              </h2>
              <p className="text-pb-muted text-sm leading-relaxed line-clamp-2">{video.description}</p>
            </div>
          </a>

          <p className="font-caveat text-pb-muted text-base px-5 pb-4 text-right">{t['hero.video.fresh']}</p>
        </PaperCard>
      )}
    </section>
  )
}
