import Link from 'next/link'
import { Layers } from 'lucide-react'
import { PILLARS } from '@/lib/pipeline/pillars'
import { CHANNELS } from '@/lib/pipeline/channels'
import type { VideoHubCard } from '@/lib/pipeline/load-video-hub'

const ptFlag = CHANNELS.find((c) => c.lang === 'pt')?.flag ?? '🇧🇷'
const enFlag = CHANNELS.find((c) => c.lang === 'en')?.flag ?? '🇺🇸'

export function VideoCard({ card }: { card: VideoHubCard }) {
  const pillar = PILLARS.find((p) => p.id === card.pillar)
  const langs: string[] = []
  if (card.hasPt) langs.push(ptFlag)
  if (card.hasEn) langs.push(enFlag)
  return (
    <Link className="vcard" href={`/cms/video/${card.id}/edit`}>
      <div className="vcard-top">
        <span className="vcard-code">{card.code}</span>
        {pillar && (
          <span className="vpill" style={{ ['--pc' as string]: pillar.color }}>
            <span className="vp-dot" /> {pillar.label}
          </span>
        )}
        <span className="vcard-langs">{langs.join(' ')}</span>
      </div>
      <div className="vcard-title">{card.title}</div>
      <div className="vcard-foot">
        <span className="vf-dur">{card.duration}</span>
        {card.beatsCount > 0 ? (
          <span className="vf-beats">
            <Layers size={12} /> {card.beatsCount} beats
          </span>
        ) : (
          <span className="vf-beats dim">{card.beatsLabel}</span>
        )}
      </div>
    </Link>
  )
}
