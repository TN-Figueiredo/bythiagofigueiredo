'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'

interface CmsNotesEditorProps {
  videoId: string
  initialNotes: string
  version: number
  onSave: (videoId: string, notes: string, version: number) => Promise<{ version: number }>
}

export function CmsNotesEditor({ videoId, initialNotes, version: initialVersion, onSave }: CmsNotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [currentVersion, setCurrentVersion] = useState(initialVersion)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(async (text: string, ver: number) => {
    setSaving(true)
    try {
      const result = await onSave(videoId, text, ver)
      setCurrentVersion(result.version)
    } catch {
      toast.error('Conflito de versão — recarregue e tente novamente.')
    } finally {
      setSaving(false)
    }
  }, [videoId, onSave])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setNotes(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value, currentVersion), 800)
  }, [save, currentVersion])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-medium text-cms-text-muted">CMS Notes</label>
        {saving && <span className="text-[10px] text-cms-text-muted">Salvando…</span>}
      </div>
      <textarea
        value={notes}
        onChange={handleChange}
        rows={3}
        className="w-full resize-none rounded-md border border-cms-border bg-cms-surface px-2.5 py-1.5 text-xs text-cms-text placeholder:text-cms-text-muted focus:border-indigo-500 focus:outline-none"
        placeholder="Anotações sobre o vídeo…"
      />
    </div>
  )
}
