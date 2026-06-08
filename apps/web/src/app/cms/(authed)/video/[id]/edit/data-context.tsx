'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { PillarId } from '@/lib/pipeline/pillars'
import type { RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'
import type { PosBrief, ABDraft } from '@/lib/pipeline/video-schemas'
import type { AbJoinFacts } from '@/lib/pipeline/video-ab-precondition'

export interface IdeiaPayload {
  title: string
  direction: string
  siblings: string[]
  logline: string
  angles: string
  framework: string
}

export interface VideoData {
  ideia: { pt: IdeiaPayload; en: IdeiaPayload }
  roteiro: { pt: RoteiroContentV3 | null; en: RoteiroContentV3 | null }
  pillar: PillarId | undefined
  durationRange: string | undefined
  saveIdeia: (lang: 'pt' | 'en', patch: Partial<IdeiaPayload>) => Promise<void>
  saveTitle: (lang: 'pt' | 'en', title: string) => Promise<void>
  appendSiblings: (lang: 'pt' | 'en') => void
  saveRoteiro: (lang: 'pt' | 'en', content: RoteiroContentV3) => Promise<void>
  hasUnsavedChanges: boolean
  saveAll: () => Promise<void>
  autosaveState: 'saving' | 'saved' | 'unsaved' | 'error' | 'offline'

  // --- P3: Pós / Publicação / gating wiring (§5.5) ---
  /** Raw per-(section,lang) payload map (postprod_<lang> / publish_<lang>) for stage reads. */
  sections: Record<string, unknown>
  /** A/B publish-CTA facts from the youtube_videos join (drives the precondition gate). */
  abJoinFacts: AbJoinFacts
  /** ab-lab winner_variant_id — trophy shows on the winner ONLY when published (§3.8). */
  winnerVariantId: string | null
  /** Persist a partial Pós brief patch (postprod_<lang>). */
  savePostprod: (lang: 'pt' | 'en', patch: Partial<PosBrief>) => Promise<void>
  /** Persist a partial Publicação A/B draft patch (publish_<lang>). */
  savePublish: (lang: 'pt' | 'en', patch: Partial<ABDraft>) => Promise<void>
  /** "Marcar como gravado" — advances the DB stage to gravacao, unlocking Pós+Publicação. */
  advanceToRecorded: (id: string, version: number) => Promise<{ ok: boolean; error?: string }>
  /** Publish-gated A/B materialize + stage→published. */
  publishVideo: (id: string, version: number) => Promise<{ ok: boolean; error?: string }>
  /**
   * Cowork submit — routes a free-text prompt through the batch section update / Cowork
   * API path (source:'cowork', format-aware getSectionKey → video writes land on
   * ideia_<lang>/publish_<lang>, §7). Consumed by the CoworkPopover's `onSubmit`.
   */
  coworkSubmit: (prompt: string) => Promise<void>
}

const Ctx = createContext<VideoData | null>(null)

export function VideoDataProvider({ value, children }: { value: VideoData; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useVideoData(): VideoData {
  const v = useContext(Ctx)
  if (!v) throw new Error('useVideoData must be used within VideoDataProvider')
  return v
}
