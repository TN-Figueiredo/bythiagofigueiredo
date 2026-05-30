'use client'

import { useState } from 'react'
import { translateCaption } from '@/lib/social/actions'

interface TranslateButtonProps {
  text: string
  currentLang: 'pt' | 'en'
  onTranslated: (text: string, lang: 'pt' | 'en') => void
}

export function TranslateButton({ text, currentLang, onTranslated }: TranslateButtonProps) {
  const [loading, setLoading] = useState(false)
  const targetLang = currentLang === 'pt' ? 'en' : 'pt'

  async function handleTranslate() {
    if (!text.trim()) return
    setLoading(true)
    try {
      const result = await translateCaption(text, currentLang, targetLang)
      if (result.ok) {
        onTranslated(result.data, targetLang)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleTranslate}
      disabled={loading || !text.trim()}
      className="flex items-center gap-1.5 rounded-lg border border-cms-border px-2.5 py-1 text-xs font-medium text-cms-text-muted hover:text-cms-text disabled:opacity-50 transition-colors"
    >
      {loading ? '...' : `${currentLang.toUpperCase()} → ${targetLang.toUpperCase()}`}
    </button>
  )
}
