'use client'

import { ConflictBanner } from '@/app/cms/(authed)/pipeline/_components/detail/conflict-banner'
import type { SectionData } from '@/lib/pipeline/sections'

interface SectionConflictProps {
  conflict: { remoteData: SectionData; localContent: SectionData['content'] } | null
  onKeepLocal: () => void
  onAcceptRemote: () => void
}

export function SectionConflict({ conflict, onKeepLocal, onAcceptRemote }: SectionConflictProps) {
  if (!conflict) return null
  return (
    <ConflictBanner
      onKeepLocal={onKeepLocal}
      onAcceptRemote={onAcceptRemote}
      localContent={conflict.localContent}
      remoteContent={conflict.remoteData.content}
    />
  )
}
