'use client'

import { useState, useTransition } from 'react'
import type { SocialDelivery } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from '@/app/cms/(authed)/_shared/social/platform-icon'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import type { SocialStrings } from '../_i18n/types'

interface DeliveryCardProps {
  delivery: SocialDelivery
  strings: SocialStrings
  onRetry: (deliveryId: string) => Promise<{ ok: boolean; error?: string }>
}

export function DeliveryCard({ delivery, strings: t, onRetry }: DeliveryCardProps) {
  const [isPending, startTransition] = useTransition()
  const [retryError, setRetryError] = useState<string | null>(null)
  const statusLabel = t.status[delivery.status as keyof typeof t.status] ?? delivery.status

  function handleRetry() {
    setRetryError(null)
    startTransition(async () => {
      try {
        const result = await onRetry(delivery.id)
        if (!result.ok) {
          setRetryError(result.error ?? t.common.error)
        }
      } catch {
        setRetryError(t.common.error)
      }
    })
  }

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlatformIcon provider={delivery.provider} />
          <span className="font-medium text-cms-text">{platformLabel(delivery.provider)}</span>
        </div>
        <SocialStatusBadge status={delivery.status} label={statusLabel} />
      </div>

      {delivery.status === 'published' && delivery.platform_url && (
        <a href={delivery.platform_url} target="_blank" rel="noopener noreferrer" className="text-sm text-cms-accent hover:underline">
          {t.detail.viewOn.replace('{platform}', platformLabel(delivery.provider))} →
        </a>
      )}

      {delivery.status === 'failed' && (
        <div className="space-y-2">
          {delivery.last_error && (
            <p className="text-sm text-red-400">{delivery.last_error}</p>
          )}
          {delivery.error_type && (
            <span className="inline-block rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">{delivery.error_type}</span>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={handleRetry} disabled={isPending} aria-label={`Retry delivery to ${platformLabel(delivery.provider)}`} className="text-sm text-cms-accent hover:underline disabled:opacity-50">
              {t.detail.retry}
            </button>
          </div>
          {retryError && (
            <p role="alert" className="text-sm text-red-400">{retryError}</p>
          )}
        </div>
      )}

      {delivery.attempt > 0 && (
        <p className="text-xs text-cms-text-dim">{t.detail.attempt.replace('{attempt}', String(delivery.attempt)).replace('{max}', String(delivery.max_attempts))}</p>
      )}
    </div>
  )
}
