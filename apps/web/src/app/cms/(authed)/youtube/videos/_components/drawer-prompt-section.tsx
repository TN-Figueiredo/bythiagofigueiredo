'use client'

import { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { buildYoutubePrompt } from '@/lib/youtube/prompt-builders'
import type { VideoOptimizerData, PromptVideoInfo } from '@/lib/youtube/prompt-types'
import { logPromptCopy } from '../../_actions/youtube-prompt-actions'

interface DrawerPromptSectionProps {
  data: VideoOptimizerData
  video: PromptVideoInfo
}

export function DrawerPromptSection({ data, video }: DrawerPromptSectionProps) {
  const [instructions, setInstructions] = useState('')
  const [copied, setCopied] = useState(false)

  const prompt = useMemo(
    () => instructions.trim() ? buildYoutubePrompt({ preset: 'video-optimizer', data, video, instructions: instructions.trim() }) : '',
    [instructions, data, video],
  )

  const handleCopy = useCallback(async () => {
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      logPromptCopy('video-optimizer', prompt.length, data.snapshotAgeHours)
      toast.success('Prompt copiado!')
    } catch {
      toast.error('Falha ao copiar')
    }
  }, [prompt, data.snapshotAgeHours])

  return (
    <div className="space-y-2 border-t border-cms-border pt-3">
      <label className="text-[10px] font-medium text-cms-text-muted">Cowork Prompt</label>
      <textarea
        value={instructions}
        onChange={e => { setInstructions(e.target.value); setCopied(false) }}
        rows={3}
        maxLength={2000}
        className="min-h-[72px] w-full resize-none rounded-md border border-cms-border bg-cms-surface px-2.5 py-1.5 text-xs text-cms-text placeholder:text-cms-text-muted focus:border-indigo-500 focus:outline-none"
        placeholder="O que quer melhorar neste vídeo? Ex: O CTR caiu de 5% para 3%"
        aria-label="O que quer melhorar neste vídeo?"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!prompt}
          className="rounded border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-400 hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copied ? 'Copiado!' : 'Copiar Prompt'}
        </button>
      </div>
    </div>
  )
}
