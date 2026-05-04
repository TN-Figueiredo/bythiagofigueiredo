import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import { SectionHeader } from './SectionHeader'
import { YOUTUBE_CHANNELS } from '../../../../lib/home/videos-data'
import type { HomeVideo } from '../../../../lib/home/types'

type Props = {
  videos: HomeVideo[]
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function VideoGrid({ videos, locale, t }: Props) {
  if (videos.length === 0) return null

  const isPt = locale === 'pt-BR'
  const channelUrl = YOUTUBE_CHANNELS[locale].url
  const gridCols = videos.length >= 3 ? 'lg:grid-cols-3' : videos.length === 2 ? 'md:grid-cols-2' : ''

  return (
    <section aria-labelledby="videos-heading" style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 28px 32px', borderTop: '1px dashed var(--pb-line)', marginTop: 32, scrollMarginTop: 110 }}>
      <div>
        <SectionHeader
          number="03"
          label={isPt ? 'do canal' : 'from the channel'}
          title={t['home.videos.title'] ?? ''}
          subtitle={t['home.videos.subtitle']}
          linkText={t['home.videos.viewAll']}
          linkHref={channelUrl}
          kickerColor="var(--pb-yt)"
          linkColor="var(--pb-yt)"
        />
        <h2 id="videos-heading" className="sr-only">{t['home.videos.title']}</h2>

        <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols}`} style={{ gap: 32, rowGap: 48 }}>
          {videos.map((video, i) => (
            <PaperCard key={video.id} index={i + 11} variant="paper" className="overflow-hidden">
              <Tape variant="tapeR" className="-top-2 left-5" rotate={-6 + (i % 4)} />
              <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer" className="block group" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ position: 'relative', aspectRatio: '4 / 3', overflow: 'hidden', background: 'linear-gradient(135deg, #51201F 0%, #142229 100%)' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.55))' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 52, height: 36, background: 'var(--pb-yt)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,51,51,0.4)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </div>
                  <div className="font-mono" style={{ position: 'absolute', top: 6, left: 6, background: 'var(--pb-yt)', color: '#FFF', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, padding: '2px 6px' }}>
                    ▶ YouTube
                  </div>
                  <div className="font-mono" style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.85)', color: '#FFF', fontSize: 10, padding: '2px 6px' }}>
                    {video.duration}
                  </div>
                </div>
                <div style={{ padding: '12px 14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className="font-mono" style={{ padding: '2px 6px', background: 'var(--pb-yt)', color: '#FFF', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                      {video.series}
                    </span>
                    <span className="font-mono" style={{ fontSize: 10, color: 'var(--pb-faint)' }}>
                      {new Date(video.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <h3 className="font-fraunces" style={{ fontSize: 19, lineHeight: 1.15, letterSpacing: '-0.01em', margin: 0, fontWeight: 500, color: 'var(--pb-ink)' }}>
                    {video.title}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--pb-muted)', lineHeight: 1.45, marginTop: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {video.description}
                  </p>
                  <p className="font-mono" style={{ fontSize: 11, color: 'var(--pb-faint)', marginTop: 10 }}>
                    {video.duration}{video.viewCount !== '—' ? ` · ${video.viewCount}` : ''}
                  </p>
                </div>
              </a>
            </PaperCard>
          ))}
        </div>

        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="font-mono uppercase inline-block" style={{ fontSize: 12, letterSpacing: '0.16em', background: 'var(--pb-yt)', color: '#FFF', padding: '12px 26px', fontWeight: 600, textDecoration: 'none', border: '1.5px solid var(--pb-yt)' }}>
            ▶ {isPt ? 'inscreve no canal' : 'subscribe on yt'}
          </a>
        </div>
      </div>
    </section>
  )
}
