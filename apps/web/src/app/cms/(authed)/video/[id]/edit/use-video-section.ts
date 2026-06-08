'use client'

import { getSectionKey } from '@/lib/pipeline/sections'
import { useSection } from '@/app/cms/(authed)/pipeline/_components/detail/use-section'
import type { SectionData } from '@/lib/pipeline/sections'
import type { Format } from '@/lib/pipeline/schemas'

interface UseVideoSectionOptions {
  itemId: string
  sectionBase: string                 // 'ideia' | 'roteiro' | 'postprod' | 'publish'
  lang: 'pt' | 'en'
  format: Format
  itemVersion: number
  initialData: SectionData | null
  onSaveSuccess?: (newRev: number, newVersion: number) => void
}

export function useVideoSection({
  itemId, sectionBase, lang, format, itemVersion, initialData, onSaveSuccess,
}: UseVideoSectionOptions) {
  // Format-aware key: video ideia → ideia_pt/ideia_en (never ideia_shared). The pipeline
  // useSection derives the base+lang back from this key for the PATCH URL.
  const sectionKey = getSectionKey(sectionBase, lang, format)
  return useSection({ itemId, sectionKey, initialData, itemVersion, onSaveSuccess })
}
