'use client'

import { useCallback, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const messageListenerRef = useRef<((e: MessageEvent) => void) | null>(null)

  // Cleanup message listener on unmount to prevent leaks
  useEffect(() => {
    return () => {
      if (messageListenerRef.current) {
        window.removeEventListener('message', messageListenerRef.current)
        messageListenerRef.current = null
      }
    }
  }, [])

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

      // Remove any previous listener before adding a new one
      if (messageListenerRef.current) {
        window.removeEventListener('message', messageListenerRef.current)
      }

      const onMessage = (event: MessageEvent) => {
        if (event.data?.type === 'social-oauth-result') {
          window.removeEventListener('message', onMessage)
          messageListenerRef.current = null
          popup?.close()
          if (event.data.success) {
            router.refresh()
          }
        }
      }
      messageListenerRef.current = onMessage
      window.addEventListener('message', onMessage)
    })
  }, [provider, router])

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
