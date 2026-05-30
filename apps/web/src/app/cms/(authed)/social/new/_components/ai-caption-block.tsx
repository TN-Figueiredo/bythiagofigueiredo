'use client'

import { useState } from 'react'
import type { DestId } from '@/lib/social/destinations'
import type { AISuggestion } from './use-composer'

interface AICaptionBlockProps {
  destId: DestId
  lang: 'pt' | 'en'
  source?: { title: string; excerpt: string | null; url?: string }
  onApplyVariation: (text: string) => void
  onApplyHashtags: (tags: string[]) => void
  onApplyBestTime: (time: string) => void
  onGenerateCaption: (destId: DestId, lang: 'pt' | 'en', source?: { title: string; excerpt: string | null; url?: string }) => Promise<AISuggestion | null>
}

export function AICaptionBlock({
  destId, lang, source, onApplyVariation, onApplyHashtags, onApplyBestTime, onGenerateCaption,
}: AICaptionBlockProps) {
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)

  async function handleGenerate() {
    setLoading(true)
    try {
      const result = await onGenerateCaption(destId, lang, source)
      if (result) setSuggestion(result)
    } finally {
      setLoading(false)
    }
  }

  if (!suggestion) {
    return (
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-[var(--cms-cowork,#7c3aed)]/30 bg-[var(--cms-cowork,#7c3aed)]/10 px-3 py-2 text-sm font-medium text-[var(--cms-cowork,#7c3aed)] hover:bg-[var(--cms-cowork,#7c3aed)]/20 transition-colors disabled:opacity-50"
      >
        {loading ? 'Gerando...' : 'Gerar com IA'}
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--cms-cowork,#7c3aed)]/20 bg-[var(--cms-cowork,#7c3aed)]/5 p-3">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--cms-cowork,#7c3aed)]">
        Sugestoes da IA
      </p>
      <div className="space-y-2">
        {suggestion.variations.map((text, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onApplyVariation(text)}
            className="block w-full rounded-lg border border-cms-border bg-cms-surface p-2 text-left text-sm text-cms-text hover:border-[var(--cms-cowork,#7c3aed)]/40 transition-colors"
          >
            {text}
          </button>
        ))}
      </div>
      {suggestion.hashtags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {suggestion.hashtags.map(tag => (
            <span key={tag} className="rounded-full bg-cms-surface px-2 py-0.5 text-xs text-cms-text-muted">
              #{tag}
            </span>
          ))}
          <button
            type="button"
            onClick={() => onApplyHashtags(suggestion.hashtags)}
            className="text-xs font-medium text-[var(--cms-cowork,#7c3aed)] hover:underline"
          >
            Adicionar
          </button>
        </div>
      )}
      {suggestion.bestTime && (
        <button
          type="button"
          onClick={() => onApplyBestTime(suggestion.bestTime!)}
          className="text-xs text-cms-text-muted hover:text-[var(--cms-cowork,#7c3aed)]"
        >
          Melhor horario: {suggestion.bestTime}
        </button>
      )}
    </div>
  )
}
