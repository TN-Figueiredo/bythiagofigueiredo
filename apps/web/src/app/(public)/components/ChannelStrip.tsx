import { PaperCard } from './PaperCard'
import { YOUTUBE_CHANNELS } from '@/lib/home/videos-data'
import type { HomeChannel } from '@/lib/home/types'

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
      <div className="flex items-center gap-3">
        {/* Avatar placeholder */}
        <div className="w-12 h-12 rounded-full bg-pb-yt flex items-center justify-center text-white font-bold text-lg shrink-0">
          TF
        </div>
        <div>
          <p className="font-fraunces text-pb-ink text-lg leading-tight">
            {channel.name}
          </p>
          <p className="font-mono text-pb-muted text-xs">{channel.handle}</p>
        </div>
        {isPrimary && (
          <span className="ml-auto font-mono text-xs bg-pb-marker text-pb-bg px-2 py-0.5 rounded">
            {t['channels.primary']}
          </span>
        )}
      </div>

      <a
        href={channel.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${t['channels.subscribe']} ${channel.name}`}
        className="inline-flex items-center gap-2 bg-pb-yt text-white font-mono font-semibold text-sm px-4 py-2 rounded self-start"
      >
        {channel.flag} {t['channels.subscribe']}
      </a>
    </PaperCard>
  )
}

export function ChannelStrip({ locale, t }: Props) {
  const primary = YOUTUBE_CHANNELS[locale]
  const secondary = YOUTUBE_CHANNELS[locale === 'en' ? 'pt-BR' : 'en']

  return (
    <section className="px-6 py-8">
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
