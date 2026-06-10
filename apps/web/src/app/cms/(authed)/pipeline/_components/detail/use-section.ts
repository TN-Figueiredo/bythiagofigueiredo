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
  /**
   * Toast policy. `'all'` (default) keeps today's behavior: success + error toasts.
   * `'errors'` suppresses the per-save success toast (for editors that save on every
   * inline-field blur — e.g. the video Pós/Publicação stages); errors ALWAYS toast.
   */
  notify?: 'all' | 'errors'
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

export function useSection({ itemId, sectionKey, initialData, itemVersion, onSaveSuccess, notify = 'all' }: UseSectionOptions): UseSectionReturn {
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
  // Tracks dirtiness synchronously so an explicit `save()` called in the SAME tick as
  // `setContent()` (e.g. the video editor's saveRoteiro/saveIdeia) PATCHes the fresh
  // content instead of being gated out by a stale `isDirty` state value. The `isDirty`
  // state is kept for UI (nav guard / autosave indicator).
  const dirtyRef = useRef(false)
  // Sync in-flight gate. The `isSaving` STATE the old gate used is captured per render, so a
  // `setContent() + save()` pair landing before React re-renders could slip past it and fire
  // a concurrent PATCH. The ref closes that window; `isSaving` state stays for UI.
  const savingRef = useRef(false)
  const revRef = useRef(rev)
  revRef.current = rev
  const versionRef = useRef(version)
  versionRef.current = version

  const setContent = useCallback((newContent: SectionData['content']) => {
    contentRef.current = newContent // sync: an immediate save() must see the fresh content
    dirtyRef.current = true // sync: an immediate save() must not be gated by stale isDirty
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
    if (!dirtyRef.current || savingRef.current || !contentRef.current) return
    savingRef.current = true
    setIsSaving(true)

    const lang = extractLangFromKey(sectionKey)
    const sectionBase = extractSectionBase(sectionKey)

    try {
      // Trailing-save loop. Each PATCH persists a SNAPSHOT of the content taken when it
      // fires. If `setContent()` lands while that PATCH is in flight (e.g. the user tabs
      // through inline fields in the video Pós editor — blur A saves, blur B edits), the
      // resolved save must NOT mark the section clean: the newer edit would be flagged
      // saved (invisible to the nav guard / ⌘S flush) and silently lost. Instead we keep
      // it dirty and immediately re-run with the fresh content. The loop only repeats
      // when content actually changed since the snapshot, so it cannot spin.
      for (;;) {
        const snapshot: SectionData['content'] | null = contentRef.current
        const res = await fetch(`/api/pipeline/items/${itemId}/sections/${sectionBase}?lang=${lang}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Expected-Version': String(versionRef.current) },
          body: JSON.stringify({ content: snapshot, rev: revRef.current, source: 'user' }),
        })

        if (res.status === 412) {
          const err = await res.json()
          const currentVersion = err.error?.current as number | undefined
          if (currentVersion != null) {
            setVersion(currentVersion)
            versionRef.current = currentVersion
          }
          // No auto-retry here — the refreshed version is stored above, so the NEXT
          // save (blur/⌘S) goes through. The copy must not promise a retry.
          toast.error('Versão desatualizada. Salve novamente para aplicar.')
          return
        }

        if (res.status === 409) {
          const remoteRes = await fetch(`/api/pipeline/items/${itemId}/sections/${sectionBase}?lang=${lang}`)
          if (remoteRes.ok) {
            const remote = await remoteRes.json()
            if (remote.data) {
              setConflict({ remoteData: remote.data as SectionData, localContent: contentRef.current })
            }
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
        onSaveSuccess?.(newRev, newVersion)

        if (contentRef.current !== snapshot) continue // edited mid-flight → trailing save with fresh content

        dirtyRef.current = false
        setIsDirty(false)
        if (notify === 'all') toast.success('Seção salva')
        return
      }
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }, [itemId, sectionKey, onSaveSuccess, notify, extractLangFromKey, extractSectionBase])

  const acceptRemote = useCallback(() => {
    if (!conflict) return
    setContentState(conflict.remoteData.content)
    contentRef.current = conflict.remoteData.content
    setRev(conflict.remoteData.rev)
    revRef.current = conflict.remoteData.rev
    setSource(conflict.remoteData.source)
    setEdited(conflict.remoteData.edited)
    setCoworkRev(conflict.remoteData.cowork_rev ?? null)
    setUpdatedAt(conflict.remoteData.updated_at)
    dirtyRef.current = false
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
