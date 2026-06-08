import Link from 'next/link'
import { pillarById } from '@/lib/pipeline/pillars'
import { channelByLang } from '@/lib/pipeline/channels'
import type { VideoHubCard } from '@/lib/pipeline/load-video-hub'

export function VideoCard({ card }: { card: VideoHubCard }) {
  const pillar = pillarById(card.pillar)
  return (
    <Link className="vcard" href={`/cms/video/${card.id}/edit`}>
      <div className="vcard-top">
        <span className="vcard-code">{card.code}</span>
        {pillar && (
          <span className="vcard-pillar" style={{ ['--vp' as string]: pillar.color }}>
            <span className="vp-dot" aria-hidden />
            {pillar.label.toUpperCase()}
          </span>
        )}
        <span className="vcard-langs">
          {card.hasPt && <span title={channelByLang('pt')?.name}>🇧🇷</span>}
          {card.hasEn && <span title={channelByLang('en')?.name}>🇬🇧</span>}
        </span>
      </div>
      <div className="vcard-title">{card.title}</div>
      <div className="vcard-foot">
        <span className="vf-dur">{card.duration}</span>
        <span className="vf-beats">{card.beatsLabel}</span>
      </div>
    </Link>
  )
}
