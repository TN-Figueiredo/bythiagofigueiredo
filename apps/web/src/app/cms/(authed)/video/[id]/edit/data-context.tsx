'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { PillarId } from '@/lib/pipeline/pillars'
import type { RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'
import type { PosBrief, ABDraft } from '@/lib/pipeline/video-schemas'
import type { AbJoinFacts } from '@/lib/pipeline/video-ab-precondition'
import type { EditorModel } from './editor-model'

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
  /**
   * Design-handoff editor model: `{ pt, en }` Versions derived from the live
   * ideia/roteiro/metadata above (see editor-model.ts). `cur = versions[activeLang]`.
   * Stage components consume `cur` so they stay verbatim ports of the handoff.
   */
  versions: EditorModel
  pillar: PillarId | undefined
  durationRange: string | undefined
  saveIdeia: (lang: 'pt' | 'en', patch: Partial<IdeiaPayload>) => Promise<void>
  saveTitle: (lang: 'pt' | 'en', title: string) => Promise<void>
  appendSiblings: (lang: 'pt' | 'en') => void
  /**
   * Persist the roteiro for a lang. Pass `{ force: true }` for CREATE-from-empty seeds dispatched
   * in the same tick as SET_EDIT_MODE('edit') — the gate reads canEditRef which only updates next
   * render, so the explicit create would otherwise be dropped. Normal edits omit opts → gated.
   */
  saveRoteiro: (lang: 'pt' | 'en', content: RoteiroContentV3, opts?: { force?: boolean }) => Promise<void>
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
  /** Persist a partial Pós brief patch (postprod_<lang>). Pass `{ force: true }` for the
   *  CREATE-from-empty seed dispatched alongside SET_EDIT_MODE('edit') — see saveRoteiro. */
  savePostprod: (lang: 'pt' | 'en', patch: Partial<PosBrief>, opts?: { force?: boolean }) => Promise<void>
  /** Persist a partial Publicação A/B draft patch (publish_<lang>). */
  savePublish: (lang: 'pt' | 'en', patch: Partial<ABDraft>) => Promise<void>
  /** "Marcar como gravado" — advances the DB stage to gravacao, unlocking Pós+Publicação. */
  advanceToRecorded: (id: string, version: number) => Promise<{ ok: boolean; error?: string }>
  /** Publish-gated A/B materialize + stage→published. */
  publishVideo: (id: string, version: number) => Promise<{ ok: boolean; error?: string }>
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
