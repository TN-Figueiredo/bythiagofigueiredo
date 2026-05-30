'use client'

import type { DestId } from '@/lib/social/destinations'
import { DESTINATIONS } from '@/lib/social/destinations'

interface CaptionEditorProps {
  destId: DestId
  value: string
  onChange: (value: string) => void
  onAddPoll?: () => void
}

const PLACEHOLDERS: Record<DestId, string> = {
  ig_story: 'Texto opcional (aparece na arte)',
  yt_community: 'Escreva o texto do post...',
  fb_page: 'O que voce quer compartilhar?',
  ig_feed: 'Escreva a legenda...',
}

const PLATFORM_NOTES: Record<DestId, string | null> = {
  ig_story: 'Texto e link moram na arte, nao na legenda. Use o Canvas para adicionar.',
  yt_community: 'Post preparado para copy-paste no YouTube Studio.',
  fb_page: null,
  ig_feed: null,
}

export function CaptionEditor({ destId, value, onChange, onAddPoll }: CaptionEditorProps) {
  const dest = DESTINATIONS[destId]
  const limit = dest.captionLimit
  const charCount = value.length
  const isNearLimit = limit > 0 && charCount >= limit * 0.9
  const isOverLimit = limit > 0 && charCount > limit

  if (destId === 'ig_story') {
    return (
      <div className="space-y-2">
        <p className="text-xs text-cms-text-dim">{PLATFORM_NOTES.ig_story}</p>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={PLACEHOLDERS.ig_story}
          className="w-full rounded-lg border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {PLATFORM_NOTES[destId] && (
        <p className="text-xs text-cms-text-dim">{PLATFORM_NOTES[destId]}</p>
      )}

      <div className="relative">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={PLACEHOLDERS[destId]}
          rows={5}
          className="w-full resize-none rounded-lg border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
        />

        {/* Character counter */}
        {limit > 0 && (
          <span className={`absolute bottom-2 right-2 text-xs ${
            isOverLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-cms-text-dim'
          }`}>
            {charCount}/{limit}
          </span>
        )}
      </div>

      {/* Poll button for YouTube Community */}
      {destId === 'yt_community' && onAddPoll && (
        <button
          type="button"
          onClick={onAddPoll}
          className="flex items-center gap-1.5 rounded-lg border border-cms-border px-3 py-1.5 text-xs font-medium text-cms-text-muted hover:text-cms-text transition-colors"
        >
          Adicionar enquete
        </button>
      )}
    </div>
  )
}
