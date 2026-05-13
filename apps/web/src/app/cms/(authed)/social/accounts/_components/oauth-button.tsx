'use client'

import { useCallback, useTransition } from 'react'
import type { Provider } from '@tn-figueiredo/social'

interface OauthButtonProps {
  provider: Provider
  label: string
  className?: string
}

const OAUTH_PROVIDERS: Record<string, string> = {
  youtube: 'google',
  facebook: 'meta',
  instagram: 'meta',
  bluesky: 'bluesky',
}

export function OauthButton({ provider, label, className = '' }: OauthButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handleConnect = useCallback(() => {
    startTransition(() => {
      const oauthProvider = OAUTH_PROVIDERS[provider]
      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      const popup = window.open(
        `/api/social/oauth/${oauthProvider}`,
        'social-oauth',
        `width=${width},height=${height},left=${left},top=${top}`,
      )

      const onMessage = (event: MessageEvent) => {
        if (event.data?.type === 'social-oauth-result') {
          window.removeEventListener('message', onMessage)
          popup?.close()
          if (event.data.success) {
            window.location.reload()
          }
        }
      }
      window.addEventListener('message', onMessage)
    })
  }, [provider])

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={isPending}
      className={`inline-flex items-center gap-2 rounded-md bg-cms-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-cms-accent-hover disabled:opacity-50 ${className}`}
    >
      {isPending ? 'Connecting…' : label}
    </button>
  )
}
