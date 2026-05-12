'use client'

import { useState, useCallback } from 'react'
import type { ContactPageVisibility, ContactAuthorData } from '@/lib/contact/types'

const SOCIAL_ICONS: Record<string, string> = {
  email: '✉',
  instagram: '📸',
  youtube: '▶️',
  x: '𝕏',
  github: '🐙',
  rss: '📡',
}

const SOCIAL_LABELS: Record<string, string> = {
  email: 'Email',
  instagram: 'Instagram',
  youtube: 'YouTube',
  x: 'X (Twitter)',
  github: 'GitHub',
  rss: 'RSS',
}

function getHandle(key: string, value: string): string {
  if (key === 'email') return value
  // Extract handle from URL if present
  try {
    const url = new URL(value)
    const parts = url.pathname.replace(/^\//, '').split('/')
    return parts[0] ? `@${parts[0]}` : value
  } catch {
    return value.startsWith('@') ? value : `@${value}`
  }
}

interface Props {
  visibility: ContactPageVisibility
  author: ContactAuthorData | null
  locale: string
}

export function SocialLinksColumn({ visibility, author, locale }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const handleClick = useCallback(
    async (key: string, value: string) => {
      if (key === 'email') {
        try {
          await navigator.clipboard.writeText(value)
          setCopiedKey(key)
          setTimeout(() => setCopiedKey(null), 1800)
        } catch {
          window.location.href = `mailto:${value}`
        }
        return
      }
      const url = value.startsWith('http') ? value : `https://${value}`
      window.open(url, '_blank', 'noopener,noreferrer')
    },
    [],
  )

  if (!visibility.show_social_links || !author) return null

  const socialLinks = author.social_links
  const orderedKeys = visibility.social_order.length > 0
    ? visibility.social_order
    : Object.keys(socialLinks)

  const visibleKeys = orderedKeys.filter(
    (key) => socialLinks[key] && visibility.social_visible[key] !== false,
  )

  if (visibleKeys.length === 0 && !visibility.handwritten_note) return null

  const copiedLabel = locale === 'pt-BR' ? 'copiado ✓' : 'copied ✓'

  return (
    <div className="flex flex-col gap-3">
      {visibleKeys.map((key) => {
        const value = socialLinks[key]
        if (!value) return null
        const icon = SOCIAL_ICONS[key] ?? '🔗'
        const label = SOCIAL_LABELS[key] ?? key
        const handle = getHandle(key, value)
        const isEmailHighlighted = key === 'email' && visibility.email_highlight
        const isCopied = copiedKey === key

        return (
          <button
            key={key}
            type="button"
            onClick={() => void handleClick(key, value)}
            className={[
              'flex items-center gap-3 w-full rounded-lg px-4 py-3 text-left',
              'bg-pb-paper border transition-all duration-150',
              'hover:border-pb-accent hover:shadow-sm',
              isEmailHighlighted
                ? 'border-pb-accent ring-1 ring-pb-accent/20'
                : 'border-pb-line',
            ].join(' ')}
            aria-label={`${label}: ${handle}`}
          >
            <span
              className="text-xl leading-none"
              aria-hidden="true"
            >
              {icon}
            </span>
            <div className="flex flex-col min-w-0 flex-1">
              <span
                className="text-xs text-pb-muted leading-none mb-0.5 uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-jetbrains-var)', fontSize: 10 }}
              >
                {label}
              </span>
              <span className="text-pb-ink text-sm truncate">
                {isCopied ? (
                  <span className="text-green-500 font-medium">{copiedLabel}</span>
                ) : (
                  handle
                )}
              </span>
            </div>
            {key === 'email' && (
              <span className="text-xs text-pb-muted shrink-0">
                {isCopied ? '' : (locale === 'pt-BR' ? 'copiar' : 'copy')}
              </span>
            )}
          </button>
        )
      })}

      {/* Handwritten note */}
      {visibility.handwritten_note && (
        <p
          className="text-pb-accent text-center mt-2 text-lg"
          style={{ fontFamily: 'var(--font-caveat-var)' }}
        >
          {locale === 'pt-BR'
            ? 'Fico feliz em receber sua mensagem!'
            : "I'm happy to hear from you!"}
        </p>
      )}
    </div>
  )
}
