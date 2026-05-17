import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import type { HomeNewsletter, HomeChannel } from '../../../../lib/home/types'

type Props = {
  newsletter: HomeNewsletter | null
  channels: HomeChannel[]
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function SubscribePair({ newsletter, channels, locale, t }: Props) {
  const primary = channels.find(c => c.locale === locale)
  const secondary = channels.find(c => c.locale !== locale)
  const allChannels = [primary, secondary].filter(Boolean) as HomeChannel[]

  const gridCols = allChannels.length === 0 ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-1 md:grid-cols-2'

  return (
    <section id="newsletter" aria-labelledby="subscribe-heading" className="px-[18px] md:px-7" style={{ maxWidth: 1280, margin: '0 auto', paddingTop: 64, paddingBottom: 48 }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <p className="font-caveat" style={{ fontSize: 28, color: 'var(--pb-accent)', transform: 'rotate(-1deg)', display: 'inline-block', marginBottom: 4 }}>
          {t['home.subscribe.headline']}
        </p>
        <h2 id="subscribe-heading" className="font-fraunces italic" style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--pb-ink)', margin: '6px 0 0' }}>
          {t['home.subscribe.subheadline']}
        </h2>
      </div>

      <div className={`grid ${gridCols} gap-7 md:gap-10`}>
        <div style={{ position: 'relative', paddingTop: 18 }}>
          <PaperCard index={30} variant="paper" style={{ padding: '36px 36px 32px' }}>
            <Tape variant="tape" className="-top-2 left-6" rotate={-3} />
            <Tape variant="tape2" className="-top-2 right-6" rotate={4} />
            <div style={{ transform: 'rotate(-0.6deg)' }}>
              <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--pb-accent)', marginBottom: 10, display: 'block' }}>
                {t['home.subscribe.nlKicker']}
              </span>
              <h3 className="font-fraunces italic" style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--pb-ink)', margin: 0, lineHeight: 1 }}>
                {t['home.subscribe.nlTitle']}
              </h3>
              <p style={{ fontSize: 15, color: 'var(--pb-muted)', marginTop: 14, lineHeight: 1.55 }}>
                {t['home.subscribe.nlSubtitle']}
              </p>

              <form action={newsletter ? `/newsletters/${newsletter.slug}` : '/newsletters'} method="get" className="flex flex-col sm:flex-row gap-2" style={{ marginTop: 18 }}>
                <label htmlFor="subscribe-email" className="sr-only">{t['newsletter.emailPlaceholder']}</label>
                <input
                  id="subscribe-email"
                  name="email"
                  type="email"
                  required
                  placeholder={t['newsletter.emailPlaceholder']}
                  className="font-mono"
                  style={{ flex: 1, padding: '12px 16px', border: '2px dashed var(--pb-line)', borderRadius: 0, background: 'var(--pb-bg)', color: 'var(--pb-ink)', fontSize: 14, outline: 'none', minWidth: 0 }}
                />
                <button
                  type="submit"
                  aria-label={t['newsletter.submit']}
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pb-accent)]"
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

        {allChannels.length > 0 && (
          <div style={{ position: 'relative', paddingTop: 18 }}>
            <PaperCard index={31} variant="paper" style={{ border: '2px solid var(--pb-yt)', padding: '36px 36px 32px', backgroundColor: 'var(--pb-channel-card-bg)' }}>
              <Tape variant="tapeR" className="-top-2 left-7" rotate={3} />
              <div style={{ transform: 'rotate(0.6deg)' }}>
                <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--pb-yt)', marginBottom: 10, display: 'block' }}>
                  {t['home.subscribe.ytKicker']}
                </span>
                <h3 className="font-fraunces italic" style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--pb-ink)', margin: 0, lineHeight: 1 }}>
                  {t['home.subscribe.ytTitle']}
                </h3>
                <p style={{ fontSize: 15, color: 'var(--pb-muted)', marginTop: 14, lineHeight: 1.55 }}>
                  {t['home.subscribe.ytSubtitle2'] ?? t['home.subscribe.ytSubtitle']}
                </p>

                <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {allChannels.map((ch) => (
                    <div key={ch.locale} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--pb-bg)', border: '1px solid var(--pb-line)' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--pb-yt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }} aria-hidden="true">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z" /></svg>
                        <div style={{ position: 'absolute', bottom: -3, right: -3, width: 18, height: 18, borderRadius: '50%', background: 'var(--pb-bg)', border: '1.5px solid var(--pb-yt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                          {ch.flag}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="font-fraunces" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.1, color: 'var(--pb-ink)', margin: 0 }}>{ch.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--pb-muted)', marginTop: 1, margin: 0 }}>
                          {ch.subscriberCount > 0 ? `${ch.subscriberCount.toLocaleString()} ` : '— '}
                          {t['home.subscribe.subscribersSuffix']}
                        </p>
                      </div>
                      <a
                        href={ch.url + '?sub_confirmation=1'}
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

                {allChannels.some(ch => ch.scheduleLabel) && (
                  <p className="font-caveat" style={{ fontSize: 16, color: 'var(--pb-yt)', marginTop: 12, transform: 'rotate(1deg)', display: 'block' }}>
                    {allChannels.length >= 2
                      ? allChannels.map(ch => ch.scheduleLabel).filter(Boolean).join(' · ')
                      : allChannels[0]?.scheduleLabel}
                  </p>
                )}
              </div>
            </PaperCard>
          </div>
        )}
      </div>
    </section>
  )
}
