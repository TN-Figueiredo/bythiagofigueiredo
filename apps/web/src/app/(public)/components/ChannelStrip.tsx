import { PaperCard } from './PaperCard'
import { YOUTUBE_CHANNELS } from '@/lib/home/videos-data'
import type { HomeChannel } from '@/lib/home/types'

const CHANNEL_DESCRIPTIONS: Record<'en' | 'pt-BR', string> = {
  en: 'Software, travel, and building in public — in English.',
  'pt-BR': 'Dev, estrada e construção em público — em português.',
}

type Props = {
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

function ChannelCard({
  channel,
  isPrimary,
  t,
  index,
}: {
  channel: HomeChannel
  isPrimary: boolean
  t: Record<string, string>
  index: number
}) {
  return (
    <PaperCard
      index={index}
      variant={index % 2 === 0 ? 'paper' : 'paper2'}
      className="p-5 flex flex-col gap-4"
    >
      <div className="flex items-start gap-3">
        {/* Flag avatar */}
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl shrink-0 border border-[--pb-line]"
          style={{ background: 'var(--pb-bg)', lineHeight: 1 }}
          aria-hidden="true"
        >
          {channel.flag}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-fraunces text-pb-ink text-lg leading-tight">
            {channel.name}
          </p>
          <p className="font-mono text-pb-muted text-xs mt-0.5">{channel.handle}</p>
          <p className="text-pb-faint text-xs mt-1 leading-snug">
            {CHANNEL_DESCRIPTIONS[channel.locale]}
          </p>
        </div>
        {isPrimary && (
          <span className="font-mono text-xs bg-pb-marker text-pb-bg px-2 py-0.5 rounded shrink-0">
            {t['channels.primary']}
          </span>
        )}
      </div>

      <a
        href={channel.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${t['channels.subscribe']} ${channel.name}`}
        className="inline-flex items-center gap-2 bg-pb-yt text-white font-mono font-semibold text-sm px-4 py-2 rounded self-start hover:opacity-90 transition-opacity"
      >
        ▶ {t['channels.subscribe']}
      </a>
    </PaperCard>
  )
}

export function ChannelStrip({ locale, t }: Props) {
  const primary = YOUTUBE_CHANNELS[locale]
  const secondary = YOUTUBE_CHANNELS[locale === 'en' ? 'pt-BR' : 'en']

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '8px 28px 40px' }}>
      <h2
        className="font-fraunces text-pb-ink text-2xl mb-6"
        style={{ letterSpacing: '-0.02em' }}
      >
        {t['channels.title']}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChannelCard channel={primary} isPrimary index={0} t={t} />
        <ChannelCard channel={secondary} isPrimary={false} index={1} t={t} />
      </div>
    </section>
  )
}
