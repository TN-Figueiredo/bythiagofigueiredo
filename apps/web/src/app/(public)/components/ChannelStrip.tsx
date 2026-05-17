import Link from 'next/link'
import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import { localePath } from '@/lib/i18n/locale-path'
import type { HomeNewsletter, HomeChannel } from '@/lib/home/types'

type Props = {
  newsletter?: HomeNewsletter | null
  channels: HomeChannel[]
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function ChannelStrip({ newsletter, channels, locale, t }: Props) {
  if (channels.length === 0) return null

  const primary = channels.find(c => c.locale === locale) ?? channels[0]!
  const secondary = channels.find(c => c.locale !== primary.locale)
  const allChannels = secondary ? [primary, secondary] : [primary]
  const hasNl = !!newsletter
  const isSingle = allChannels.length === 1

  return (
    <section aria-labelledby="channels-heading" className="px-[18px] md:px-7 animate-on-scroll" style={{ maxWidth: 1280, margin: '0 auto', paddingTop: 56, paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 24 }}>
        <div className="font-caveat" style={{ color: 'var(--pb-yt)', fontSize: 26, transform: 'rotate(-1.5deg)', display: 'inline-block', whiteSpace: 'nowrap' }}>
          ▶ {isSingle ? t['home.channels.headlineSingle'] : t['home.channels.headline']}
        </div>
        <div style={{ flex: 1, height: 1, background: 'var(--pb-line)' }} />
        <span className="font-mono uppercase" style={{ fontSize: 11, color: 'var(--pb-muted)', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
          {isSingle ? t['home.channels.sublineSingle'] : t['home.channels.subline']}
        </span>
      </div>
      <h2 id="channels-heading" className="sr-only">{t['channels.title']}</h2>

      <div className={`grid grid-cols-1 ${hasNl ? 'lg:grid-cols-2' : isSingle ? '' : 'md:grid-cols-2'}`} style={{ gap: 28 }}>
        {/* Newsletter card (left side) */}
        {hasNl && (
          <div style={{ position: 'relative', paddingTop: 14 }}>
            <PaperCard index={32} variant="paper" style={{ padding: '32px 30px 28px' }}>
              <Tape variant="tape" className="-top-2 left-1/4" rotate={-3} />
              <Tape variant="tape2" className="-top-2 right-1/4" rotate={5} />
              <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--pb-accent)', marginBottom: 10, display: 'block' }}>
                ✉ NEWSLETTER
              </span>
              <h3 className="font-fraunces italic" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--pb-ink)', margin: 0, lineHeight: 1.05 }}>
                {newsletter!.name}
              </h3>
              {newsletter!.tagline && (
                <p style={{ fontSize: 14, color: 'var(--pb-muted)', marginTop: 10, lineHeight: 1.5 }}>
                  {newsletter!.tagline}
                </p>
              )}
              <Link
                href={localePath(`/newsletters/${newsletter!.slug}`, locale)}
                prefetch={true}
                className="font-mono inline-block hover:brightness-110 hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pb-accent)]"
                style={{
                  fontSize: 12,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  color: 'var(--pb-bg)',
                  background: 'var(--pb-accent)',
                  padding: '10px 20px',
                  textDecoration: 'none',
                  marginTop: 16,
                }}
              >
                {t['home.channels.subscribe']}
              </Link>
              <p className="font-caveat" style={{ fontSize: 15, color: 'var(--pb-accent)', marginTop: 10, transform: 'rotate(-0.8deg)' }}>
                {t['home.channels.noSpam']}
              </p>
            </PaperCard>
          </div>
        )}

        {/* Channels column */}
        <div className={hasNl ? '' : 'contents'}>
          {hasNl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {allChannels.map((ch, idx) => (
                <ChannelCard key={ch.locale} ch={ch} idx={idx} locale={locale} t={t} />
              ))}
            </div>
          ) : (
            allChannels.map((ch, idx) => (
              <ChannelCard key={ch.locale} ch={ch} idx={idx} locale={locale} t={t} />
            ))
          )}
        </div>
      </div>
    </section>
  )
}

function ChannelCard({ ch, idx, locale, t }: {
  ch: HomeChannel
  idx: number
  locale: string
  t: Record<string, string>
}) {
  const isCurrent = ch.locale === locale
  const langLabel = ch.locale === 'pt-BR'
    ? t['home.channels.channelPtBr']
    : t['home.channels.channelEn']

  return (
    <div data-testid="channel-card" style={{ position: 'relative', paddingTop: 14 }}>
      <div
        className="transition-all duration-200"
        style={{
          background: 'var(--pb-channel-card-bg, var(--pb-paper))',
          padding: '22px 26px',
          position: 'relative',
          transform: `rotate(${idx === 0 ? -0.4 : 0.5}deg)`,
          border: '2px solid var(--pb-yt)',
          boxShadow: 'var(--pb-card-shadow)',
        }}
      >
        <Tape variant="tapeR" className={`-top-2 ${idx === 0 ? 'left-1/3' : 'left-[44%]'}`} rotate={idx === 0 ? -2 : 3} />
        <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] gap-3 sm:gap-[18px] items-center">
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--pb-yt)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,51,51,0.3)', position: 'relative' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z" /></svg>
            <div style={{ position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: '50%', background: 'var(--pb-channel-card-bg, var(--pb-paper))', border: '2px solid var(--pb-yt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
              <span role="img" aria-label={ch.locale === 'pt-BR' ? 'Brazil flag' : 'United States flag'}>{ch.flag}</span>
            </div>
          </div>
          <div>
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--pb-yt)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 1 }}>
              ▶ {langLabel}
              {isCurrent && (
                <span style={{ marginLeft: 8, color: 'var(--pb-muted)', fontWeight: 400, letterSpacing: '0.1em' }}>
                  · {t['home.channels.thisLocale']}
                </span>
              )}
            </div>
            <div className="font-fraunces" style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.015em', color: 'var(--pb-ink)' }}>
              {ch.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--pb-muted)', marginTop: 2 }}>
              {ch.subscriberCount > 0 ? `${ch.subscriberCount.toLocaleString()} ` : '— '}
              {t['channels.subscribersSuffix']}
            </div>
            {ch.scheduleLabel && (
              <div style={{ fontSize: 12, color: 'var(--pb-faint)', marginTop: 2, fontStyle: 'italic' }}>
                {ch.scheduleLabel}
              </div>
            )}
          </div>
          <a
            href={ch.url + '?sub_confirmation=1'}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${t['channels.subscribe']} ${ch.name}`}
            className="col-span-2 sm:col-span-1 text-center sm:text-left hover:brightness-110 hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pb-accent)]"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'var(--pb-yt)', color: '#FFF', padding: '10px 16px',
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              boxShadow: '0 3px 0 rgba(0,0,0,0.12)', whiteSpace: 'nowrap',
            }}
          >
            {t['channels.subscribe']}
          </a>
        </div>
      </div>
    </div>
  )
}
