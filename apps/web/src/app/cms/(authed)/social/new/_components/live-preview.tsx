'use client'

import type { DestId } from '@/lib/social/destinations'
import { DESTINATIONS } from '@/lib/social/destinations'
import { DestPreview } from '../../_components/platform-previews/dest-preview'

interface LivePreviewProps {
  destId: DestId
  caption: string
  imageUrl: string | null
  accountName: string
  avatarUrl?: string | null
  poll?: Array<{ text: string; percentage?: number }>
}

export function LivePreview({ destId, caption, imageUrl, accountName, avatarUrl, poll }: LivePreviewProps) {
  const dest = DESTINATIONS[destId]

  return (
    <div className="sticky top-6">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: dest.tint }} />
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cms-text-dim">
          Preview {dest.label} {dest.sublabel}
        </p>
      </div>
      <DestPreview
        destId={destId}
        caption={caption}
        imageUrl={imageUrl}
        accountName={accountName}
        avatarUrl={avatarUrl}
        poll={poll}
      />
    </div>
  )
}
