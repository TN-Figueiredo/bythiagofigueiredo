'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { logPromptCopy } from '../_actions/youtube-prompt-actions'
import type { ContextPreset } from '@/lib/youtube/prompt-types'

interface UsePromptCopyOptions {
  preset: ContextPreset
  charCount: number
  snapshotAgeHours: number
}

export function usePromptCopy({ preset, charCount, snapshotAgeHours }: UsePromptCopyOptions) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const copy = useCallback(async (prompt: string) => {
    if (!prompt) return
    if (/pk_[a-zA-Z0-9]{20,}/.test(prompt)) {
      toast.error('Pipeline key detectada no prompt — remova antes de copiar.')
      return
    }
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
      void logPromptCopy(preset, charCount, snapshotAgeHours)
      toast.success('Prompt copiado!')
    } catch {
      toast.error('Falha ao copiar')
    }
  }, [preset, charCount, snapshotAgeHours])

  return { copied, setCopied, copy }
}
