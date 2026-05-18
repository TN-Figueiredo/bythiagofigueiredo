'use client'

import type { DeliveryStatus, ErrorType, Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from '@/app/cms/(authed)/_shared/social/platform-icon'
import type { SocialStrings } from '../../_i18n/types'

interface DeliveryStatusItem {
  id: string
  provider: Provider
  status: DeliveryStatus
  error: string | null
  errorType: ErrorType | null
}

interface PublishStatusBannerProps {
  deliveries: DeliveryStatusItem[]
  onRetry: (deliveryId: string) => void
  strings: SocialStrings
}

export function PublishStatusBanner({
  deliveries,
  onRetry,
  strings: t,
}: PublishStatusBannerProps) {
  if (deliveries.length === 0) return null

  return (
    <div
      role="status"
      className="rounded-lg border border-cms-border bg-cms-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-4">
        {deliveries.map((d) => (
          <div key={d.id} className="flex items-center gap-2">
            <PlatformIcon provider={d.provider} size="sm" />
            <span className="text-sm text-cms-text">
              {platformLabel(d.provider)}
            </span>

            {/* Success indicator */}
            {d.status === 'published' && (
              <span
                aria-label="success"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20 text-green-400 text-xs"
              >
                OK
              </span>
            )}

            {/* Failed / skipped indicator + retry or reconnect */}
            {(d.status === 'failed' || d.status === 'skipped') && (
              <>
                <span
                  aria-label="failed"
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-red-400 text-xs"
                >
                  X
                </span>

                {d.errorType === 'auth' ? (
                  <a
                    href="/cms/social/accounts"
                    className="text-xs text-cms-accent hover:underline"
                  >
                    {t.detail.reconnect}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRetry(d.id)}
                    aria-label={`Retry ${platformLabel(d.provider)}`}
                    className="text-xs text-cms-accent hover:underline"
                  >
                    {t.detail.retry}
                  </button>
                )}
              </>
            )}

            {/* In-progress indicator */}
            {(d.status === 'publishing' || d.status === 'retrying' || d.status === 'pending') && (
              <span
                aria-label="in-progress"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs animate-pulse"
              >
                ...
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Error details */}
      {deliveries.some((d) => d.error) && (
        <div className="mt-3 space-y-1">
          {deliveries
            .filter((d) => d.error)
            .map((d) => (
              <p key={d.id} className="text-xs text-red-400">
                {platformLabel(d.provider)}: {d.error}
              </p>
            ))}
        </div>
      )}
    </div>
  )
}
