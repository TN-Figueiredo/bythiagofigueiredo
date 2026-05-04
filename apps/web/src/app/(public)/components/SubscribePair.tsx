import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import { YOUTUBE_CHANNELS } from '../../../../lib/home/videos-data'
import type { HomeNewsletter } from '../../../../lib/home/types'

type Props = {
  newsletter: HomeNewsletter | null
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function SubscribePair({ newsletter, locale, t }: Props) {
  const isPt = locale === 'pt-BR'
  const hasNl = !!newsletter
  const channels = [YOUTUBE_CHANNELS[locale], YOUTUBE_CHANNELS[locale === 'en' ? 'pt-BR' : 'en']]
  const gridCols = hasNl ? 'md:grid-cols-2' : ''

  return (
    <section aria-labelledby="subscribe-heading" style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <p className="font-caveat" style={{ fontSize: 24, color: 'var(--pb-muted)', transform: 'rotate(-1deg)', display: 'inline-block' }}>
          {t['home.subscribe.headline']}
        </p>
        <h2 id="subscribe-heading" className="font-fraunces italic" style={{ fontSize: 'clamp(32px, 4vw, 44px)', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--pb-ink)', marginTop: 6 }}>
          {t['home.subscribe.subheadline']}
        </h2>
      </div>

      <div className={`grid grid-cols-1 ${gridCols}`} style={{ gap: 40 }}>
        {hasNl && (
          <div style={{ position: 'relative', paddingTop: 18 }}>
            <PaperCard index={30} variant="paper" style={{ padding: '36px 36px 32px' }}>
              <Tape variant="tape" className="-top-2 left-6" rotate={-3} />
              <Tape variant="tape2" className="-top-2 right-6" rotate={4} />
              <div style={{ transform: 'rotate(-0.6deg)' }}>
                <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--pb-accent)', marginBottom: 10, display: 'block' }}>
                  {t['home.subscribe.nlKicker']}
                </span>
                <h3 className="font-fraunces italic" style={{ fontSize: 38, fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--pb-ink)', margin: 0, lineHeight: 1 }}>
                  {t['home.subscribe.nlTitle']}
                </h3>
                <p style={{ fontSize: 15, color: 'var(--pb-muted)', marginTop: 14, lineHeight: 1.55 }}>
                  {t['home.subscribe.nlSubtitle']}
                </p>

                <form onSubmit={(e) => e.preventDefault()} style={{ marginTop: 18, display: 'flex', gap: 8 }}>
                  <input type="hidden" name="newsletter_id" value={newsletter!.id} />
                  <input type="hidden" name="locale" value={locale} />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder={t['newsletter.emailPlaceholder']}
                    className="font-mono"
                    style={{ flex: 1, padding: '12px 16px', border: '1.5px dashed var(--pb-line)', borderRadius: 0, background: 'var(--pb-bg)', color: 'var(--pb-ink)', fontSize: 14, outline: 'none', minWidth: 0 }}
                  />
                  <button
                    type="submit"
                    style={{ padding: '12px 20px', background: 'var(--pb-ink)', color: 'var(--pb-bg)', border: 'none', borderRadius: 0, fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em' }}
                  >
                    {t['newsletter.submit']}
                  </button>
                </form>

                <p className="font-caveat" style={{ fontSize: 16, color: 'var(--pb-accent)', marginTop: 12, transform: 'rotate(-1deg)', display: 'block' }}>
                  {t['newsletter.consent']}
                </p>
              </div>
            </PaperCard>
          </div>
        )}

        <div style={{ position: 'relative', paddingTop: 18 }}>
          <PaperCard index={31} variant="paper" style={{ border: '2px solid var(--pb-yt)', padding: '36px 36px 32px' }}>
            <Tape variant="tapeR" className="-top-2 left-7" rotate={3} />
            <div style={{ transform: 'rotate(0.6deg)' }}>
              <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--pb-yt)', marginBottom: 10, display: 'block' }}>
                {t['home.subscribe.ytKicker']}
              </span>
              <h3 className="font-fraunces italic" style={{ fontSize: 38, fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--pb-ink)', margin: 0, lineHeight: 1 }}>
                {t['home.subscribe.ytTitle']}
              </h3>
              <p style={{ fontSize: 15, color: 'var(--pb-muted)', marginTop: 14, lineHeight: 1.55 }}>
                {isPt
                  ? 'Live-coding, tours de setup, retrospectivas de bug. Um vídeo novo toda quinta, às vezes dois.'
                  : 'Live-coding, setup tours, bug retrospectives. A new video every Thursday, sometimes two.'}
              </p>

              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {channels.map((ch) => (
                  <div key={ch.locale} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--pb-bg)', border: '1px solid var(--pb-line)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--pb-yt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="font-fraunces" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.1, color: 'var(--pb-ink)', margin: 0 }}>{ch.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--pb-muted)', marginTop: 1 }}>{ch.handle}</p>
                    </div>
                    <a
                      href={ch.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono shrink-0"
                      style={{ padding: '7px 12px', background: 'var(--pb-yt)', color: '#FFF', fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
                    >
                      {t['channels.subscribe']}
                    </a>
                  </div>
                ))}
              </div>

              <p className="font-caveat" style={{ fontSize: 16, color: 'var(--pb-yt)', marginTop: 12, transform: 'rotate(1deg)', display: 'block' }}>
                {isPt ? 'quinta que vem: vídeos novos nos dois canais' : 'next Thursday: new videos on both'}
              </p>
            </div>
          </PaperCard>
        </div>
      </div>
    </section>
  )
}
