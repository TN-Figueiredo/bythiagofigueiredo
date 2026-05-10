'use client'

import { useState, useCallback, useRef } from 'react'
import type { SectionData } from '@/lib/pipeline/sections'

interface UseSectionOptions {
  itemId: string
  sectionKey: string
  initialData: SectionData | null
  itemVersion: number
  onSaveSuccess?: (newRev: number, newVersion: number) => void
}

interface UseSectionReturn {
  content: SectionData['content'] | null
  rev: number
  isDirty: boolean
  isSaving: boolean
  isEditing: boolean
  conflict: { remoteData: SectionData; localContent: SectionData['content'] } | null
  setContent: (content: SectionData['content']) => void
  setIsEditing: (editing: boolean) => void
  save: () => Promise<void>
  acceptRemote: () => void
  keepLocal: () => Promise<void>
  dismissConflict: () => void
  source: string | null
  edited: boolean
  coworkRev: number | null
}

export function useSection({ itemId, sectionKey, initialData, itemVersion, onSaveSuccess }: UseSectionOptions): UseSectionReturn {
  const [content, setContentState] = useState<SectionData['content'] | null>(initialData?.content ?? null)
  const [rev, setRev] = useState(initialData?.rev ?? 0)
  const [version, setVersion] = useState(itemVersion)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [conflict, setConflict] = useState<UseSectionReturn['conflict']>(null)
  const [source] = useState(initialData?.source ?? null)
  const [edited, setEdited] = useState(initialData?.edited ?? false)
  const [coworkRev] = useState(initialData?.cowork_rev ?? null)
  const contentRef = useRef(content)
  contentRef.current = content

  const setContent = useCallback((newContent: SectionData['content']) => {
    setContentState(newContent)
    setIsDirty(true)
    setEdited(true)
  }, [])

  const extractLangFromKey = useCallback((key: string): string => {
    if (key.endsWith('_shared')) return 'en'
    const parts = key.split('_')
    return parts[parts.length - 1] ?? 'en'
  }, [])

  const extractSectionBase = useCallback((key: string): string => {
    if (key.endsWith('_shared')) return key.replace(/_shared$/, '')
    return key.replace(/_(?:en|pt)$/, '')
  }, [])

  const save = useCallback(async () => {
    if (!isDirty || isSaving || !contentRef.current) return
    setIsSaving(true)

    const lang = extractLangFromKey(sectionKey)
    const sectionBase = extractSectionBase(sectionKey)

    try {
      const res = await fetch(`/api/pipeline/items/${itemId}/sections/${sectionBase}?lang=${lang}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'If-Match': String(version) },
        body: JSON.stringify({ content: contentRef.current, rev, source: 'user' }),
      })

      if (res.status === 409) {
        const error = await res.json()
        if (error.error?.current_rev !== undefined) {
          const remoteRes = await fetch(`/api/pipeline/items/${itemId}/sections/${sectionBase}?lang=${lang}`)
          if (remoteRes.ok) {
            const remote = await remoteRes.json()
            setConflict({ remoteData: remote.data as SectionData, localContent: contentRef.current })
          }
        }
        return
      }

      if (!res.ok) throw new Error('Save failed')

      const { data, meta } = await res.json()
      setRev(data.rev as number)
      setVersion(meta.item_version as number)
      setIsDirty(false)
      onSaveSuccess?.(data.rev as number, meta.item_version as number)
    } finally {
      setIsSaving(false)
    }
  }, [isDirty, isSaving, itemId, sectionKey, version, rev, onSaveSuccess, extractLangFromKey, extractSectionBase])

  const acceptRemote = useCallback(() => {
    if (!conflict) return
    setContentState(conflict.remoteData.content)
    setRev(conflict.remoteData.rev)
    setIsDirty(false)
    setConflict(null)
  }, [conflict])

  const keepLocal = useCallback(async () => {
    if (!conflict) return
    setRev(conflict.remoteData.rev)
    setConflict(null)
    await save()
  }, [conflict, save])

  const dismissConflict = useCallback(() => setConflict(null), [])

  return {
    content, rev, isDirty, isSaving, isEditing, conflict,
    setContent, setIsEditing, save, acceptRemote, keepLocal, dismissConflict,
    source, edited, coworkRev,
  }
}
