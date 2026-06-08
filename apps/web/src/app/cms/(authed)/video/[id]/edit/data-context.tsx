'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { PillarId } from '@/lib/pipeline/pillars'
import type { RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'

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
