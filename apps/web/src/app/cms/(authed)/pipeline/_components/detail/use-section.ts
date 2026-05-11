'use client'

import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
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
  updatedAt: string | null
}

export function useSection({ itemId, sectionKey, initialData, itemVersion, onSaveSuccess }: UseSectionOptions): UseSectionReturn {
  const [content, setContentState] = useState<SectionData['content'] | null>(initialData?.content ?? null)
  const [rev, setRev] = useState(initialData?.rev ?? 0)
  const [version, setVersion] = useState(itemVersion)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [conflict, setConflict] = useState<UseSectionReturn['conflict']>(null)
  const [source, setSource] = useState(initialData?.source ?? null)
  const [edited, setEdited] = useState(initialData?.edited ?? false)
  const [coworkRev, setCoworkRev] = useState(initialData?.cowork_rev ?? null)
  const [updatedAt, setUpdatedAt] = useState(initialData?.updated_at ?? null)

  const contentRef = useRef(content)
  contentRef.current = content
  const revRef = useRef(rev)
  revRef.current = rev
  const versionRef = useRef(version)
  versionRef.current = version

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
        headers: { 'Content-Type': 'application/json', 'If-Match': String(versionRef.current) },
        body: JSON.stringify({ content: contentRef.current, rev: revRef.current, source: 'user' }),
      })

      if (res.status === 409) {
        const remoteRes = await fetch(`/api/pipeline/items/${itemId}/sections/${sectionBase}?lang=${lang}`)
        if (remoteRes.ok) {
          const remote = await remoteRes.json()
          setConflict({ remoteData: remote.data as SectionData, localContent: contentRef.current })
          setVersion(remote.meta.item_version as number)
          versionRef.current = remote.meta.item_version as number
        }
        toast.error('Conflito detectado. Revise as diferenças.')
        return
      }

      if (!res.ok) {
        toast.error('Erro ao salvar seção. Tente novamente.')
        return
      }

      const { data, meta } = await res.json()
      const newRev = data.rev as number
      const newVersion = meta.item_version as number
      setRev(newRev)
      revRef.current = newRev
      setVersion(newVersion)
      versionRef.current = newVersion
      setSource(data.source as string)
      setEdited(data.edited as boolean)
      setCoworkRev((data.cowork_rev as number | null) ?? null)
      setUpdatedAt(data.updated_at as string)
      setIsDirty(false)
      toast.success('Seção salva')
      onSaveSuccess?.(newRev, newVersion)
    } finally {
      setIsSaving(false)
    }
  }, [isDirty, isSaving, itemId, sectionKey, onSaveSuccess, extractLangFromKey, extractSectionBase])

  const acceptRemote = useCallback(() => {
    if (!conflict) return
    setContentState(conflict.remoteData.content)
    setRev(conflict.remoteData.rev)
    revRef.current = conflict.remoteData.rev
    setSource(conflict.remoteData.source)
    setEdited(conflict.remoteData.edited)
    setCoworkRev(conflict.remoteData.cowork_rev ?? null)
    setUpdatedAt(conflict.remoteData.updated_at)
    setIsDirty(false)
    setConflict(null)
  }, [conflict])

  const keepLocal = useCallback(async () => {
    if (!conflict) return
    const newRev = conflict.remoteData.rev
    setRev(newRev)
    revRef.current = newRev
    setConflict(null)
    await save()
  }, [conflict, save])

  const dismissConflict = useCallback(() => setConflict(null), [])

  return {
    content, rev, isDirty, isSaving, isEditing, conflict,
    setContent, setIsEditing, save, acceptRemote, keepLocal, dismissConflict,
    source, edited, coworkRev, updatedAt,
  }
}
