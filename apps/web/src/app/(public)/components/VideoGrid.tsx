import Image from 'next/image'
import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import { SectionHeader } from './SectionHeader'
import { VideoLightbox } from './VideoLightbox'
import type { HomeVideo, HomeChannel } from '../../../../lib/home/types'

type Props = {
  videos: HomeVideo[]
  channels: HomeChannel[]
  hasVideos: boolean
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function VideoGrid({ videos, channels, hasVideos, locale, t }: Props) {
  if (channels.length === 0) return null

  const isPt = locale === 'pt-BR'
  const primary = channels.find(c => c.locale === locale) ?? channels[0]!
  const channelUrl = primary.url

  if (!hasVideos) {
    return (
      <section aria-labelledby="videos-heading" className="px-[18px] md:px-7" style={{ maxWidth: 1280, margin: '0 auto', paddingTop: 64, paddingBottom: 32, borderTop: '1px dashed var(--pb-line)', marginTop: 32, scrollMarginTop: 110 }}>
        <SectionHeader
          number="03"
          label={isPt ? 'do canal' : 'from the channel'}
          title={t['home.youtube.title'] ?? ''}
          subtitle={t['home.youtube.subtitle']}
          linkText={t['home.youtube.viewAll']}
          linkHref={channelUrl}
          kickerColor="var(--pb-yt)"
          linkColor="var(--pb-yt)"
          marker={false}
        />
        <h2 id="videos-heading" className="sr-only">{t['home.youtube.title']}</h2>
        <div style={{ textAlign: 'center', padding: '48px 24px', opacity: 0.75 }}>
          <div style={{ width: 56, height: 40, background: 'rgba(255,45,32,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,45,32,0.6)"><path d="M8 5v14l11-7z" /></svg>
          </div>
          <p className="font-caveat" style={{ fontSize: 18, color: 'var(--pb-accent)', transform: 'rotate(-1deg)' }}>
            {t['home.youtube.comingSoon']}
          </p>
          <p style={{ fontSize: 13, color: 'var(--pb-muted)', marginTop: 4 }}>
            {t['home.youtube.comingSoonSub']}
          </p>
          <a
            href={`${channelUrl}?sub_confirmation=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono inline-flex items-center gap-1.5"
            style={{ marginTop: 12, background: 'var(--pb-yt)', color: '#FFF', padding: '8px 16px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            {t['home.youtube.subscribe']}
          </a>
        </div>
      </section>
    )
  }

  if (videos.length === 0) return null

  const gridCols = videos.length >= 3 ? 'lg:grid-cols-3' : videos.length === 2 ? 'md:grid-cols-2' : ''

  return (
    <section aria-labelledby="videos-heading" className="px-[18px] md:px-7" style={{ maxWidth: 1280, margin: '0 auto', paddingTop: 64, paddingBottom: 32, borderTop: '1px dashed var(--pb-line)', marginTop: 32, scrollMarginTop: 110 }}>
      <div>
        <SectionHeader
          number="03"
          label={isPt ? 'do canal' : 'from the channel'}
          title={t['home.youtube.title'] ?? ''}
          subtitle={t['home.youtube.subtitle']}
          linkText={t['home.youtube.viewAll']}
          linkHref={channelUrl}
          kickerColor="var(--pb-yt)"
          linkColor="var(--pb-yt)"
          marker={false}
        />
        <h2 id="videos-heading" className="sr-only">{t['home.youtube.title']}</h2>

        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gridCols} gap-6 md:gap-8`} style={{ rowGap: 48, paddingTop: 12 }}>
          {videos.map((video, i) => (
            <div key={video.id} className="group animate-on-scroll" style={{ position: 'relative', paddingTop: 16 }}>
              <PaperCard index={i + 11} variant="paper" style={{ padding: '12px 12px 18px' }}>
                <Tape variant="tapeR" className="-top-2 left-5" rotate={-6 + (i % 4)} />
                <VideoLightbox youtubeVideoId={video.youtubeVideoId}>
                  <div style={{ position: 'relative', aspectRatio: '4 / 3', overflow: 'hidden', background: video.thumbnailUrl ? undefined : 'linear-gradient(135deg, color-mix(in srgb, var(--pb-yt) 20%, var(--pb-bg)), var(--pb-bg))' }}>
                    {video.thumbnailUrl && (
                      <Image src={video.thumbnailUrl} alt={video.title} fill sizes="(max-width: 768px) 100vw, 33vw" style={{ objectFit: 'cover' }} referrerPolicy="no-referrer" loading="lazy" placeholder="blur" blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8+P/BfwAJhAPk+kC8WQAAAABJRU5ErkJggg==" />
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.55))' }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 52, height: 36, background: 'var(--pb-yt)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,51,51,0.4)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                    <div className="font-mono" style={{ position: 'absolute', top: 8, left: 8, background: 'var(--pb-yt)', color: '#FFF', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, padding: '3px 7px' }}>
                      ▶ YouTube
                    </div>
                    <div className="font-mono" style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.85)', color: '#FFF', fontSize: 11, padding: '2px 7px' }}>
                      {video.duration}
                    </div>
                  </div>
                  <div style={{ paddingTop: 14, paddingLeft: 4, paddingRight: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      {video.categoryName && (
                        <span className="font-mono" style={{ padding: '2px 7px', background: video.categoryColor ?? 'var(--pb-yt)', color: '#FFF', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
                          {video.categoryName}
                        </span>
                      )}
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--pb-faint)', letterSpacing: '0.08em' }}>
                        {new Date(video.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <h3 className="font-fraunces" style={{ fontSize: 19, lineHeight: 1.2, letterSpacing: '-0.01em', margin: '0 0 8px', fontWeight: 500, color: 'var(--pb-ink)' }}>
                      {video.title}
                    </h3>
                    <p className="line-clamp-2" style={{ fontSize: 13, color: 'var(--pb-muted)', lineHeight: 1.5, margin: '0 0 10px' }}>
                      {video.description}
                    </p>
                    <p className="font-mono" style={{ fontSize: 11, color: 'var(--pb-faint)', letterSpacing: '0.06em', margin: 0 }}>
                      {video.duration}{video.viewCount > 0 ? ` · ${video.viewCount.toLocaleString()}` : ''}
                    </p>
                  </div>
                </VideoLightbox>
              </PaperCard>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <a href={`${channelUrl}?sub_confirmation=1`} target="_blank" rel="noopener noreferrer" className="font-mono uppercase inline-block" style={{ fontSize: 12, letterSpacing: '0.16em', background: 'var(--pb-yt)', color: '#FFF', padding: '12px 26px', fontWeight: 600, textDecoration: 'none', border: '1.5px solid var(--pb-yt)' }}>
            ▶ {isPt ? 'inscreve no canal' : 'subscribe on yt'}
          </a>
        </div>
      </div>
    </section>
  )
}
