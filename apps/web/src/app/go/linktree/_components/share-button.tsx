'use client'

import { useState } from 'react'
import { ShareIcon } from './icons'

interface ShareButtonProps {
  url: string
  title: string
  locale: string
}

export function ShareButton({ url, title, locale }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const isPt = locale.startsWith('pt')

  async function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // User cancelled or not supported — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard not available
    }
  }

  return (
    <div className="flex justify-center my-1">
      <button
        onClick={handleShare}
        className="inline-flex items-center gap-1.5 text-[11px] text-[var(--pb-faint)] border border-[var(--pb-line)] px-3 py-1 rounded-full transition-colors hover:text-[var(--pb-accent)] hover:border-[var(--pb-accent)]"
      >
        <ShareIcon size={12} />
        {copied ? (isPt ? 'Copiado!' : 'Copied!') : (isPt ? 'Compartilhar' : 'Share')}
      </button>
    </div>
  )
}
