'use client'

import { useState } from 'react'
import type { Provider } from '@tn-figueiredo/social'
import {
  PlatformIcon,
  platformLabel,
} from '@/app/cms/(authed)/_shared/social/platform-icon'
import type { SocialStrings } from '../../_i18n/types'

interface PlatformMetrics {
  provider: Provider
  likes: number
  comments: number
  shares: number
  impressions: number | null
  reach: number | null
  linkClicks: number | null
  polledAt: string
}

interface MetricsDetailProps {
  metrics: PlatformMetrics[]
  strings: SocialStrings
}

export function MetricsDetail({ metrics, strings: t }: MetricsDetailProps) {
  const [open, setOpen] = useState(false)

  if (metrics.length === 0) return null

  const totalEngagement = metrics.reduce(
    (sum, m) => sum + m.likes + m.comments + m.shares,
    0,
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-cms-accent hover:underline"
      >
        {totalEngagement} engagement{totalEngagement !== 1 ? 's' : ''} — View
        details
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Metrics detail"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="w-full max-w-lg rounded-xl border border-cms-border bg-cms-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-cms-text">
                Engagement Breakdown
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-cms-text-muted hover:text-cms-text"
              >
                x
              </button>
            </div>

            <div className="space-y-3">
              {metrics.map((m) => (
                <div
                  key={m.provider}
                  className="rounded-lg border border-cms-border bg-cms-bg p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <PlatformIcon provider={m.provider} />
                    <span className="font-medium text-cms-text">
                      {platformLabel(m.provider)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-cms-text-muted">
                        {t.detail.metrics.likes}
                      </p>
                      <p className="font-medium text-cms-text">{m.likes}</p>
                    </div>
                    <div>
                      <p className="text-cms-text-muted">
                        {t.detail.metrics.comments}
                      </p>
                      <p className="font-medium text-cms-text">{m.comments}</p>
                    </div>
                    <div>
                      <p className="text-cms-text-muted">
                        {t.detail.metrics.shares}
                      </p>
                      <p className="font-medium text-cms-text">{m.shares}</p>
                    </div>
                  </div>

                  {(m.impressions !== null ||
                    m.reach !== null ||
                    m.linkClicks !== null) && (
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      {m.impressions !== null && (
                        <div>
                          <p className="text-cms-text-muted">Impressions</p>
                          <p className="font-medium text-cms-text">
                            {m.impressions}
                          </p>
                        </div>
                      )}
                      {m.reach !== null && (
                        <div>
                          <p className="text-cms-text-muted">Reach</p>
                          <p className="font-medium text-cms-text">
                            {m.reach}
                          </p>
                        </div>
                      )}
                      {m.linkClicks !== null && (
                        <div>
                          <p className="text-cms-text-muted">Link Clicks</p>
                          <p className="font-medium text-cms-text">
                            {m.linkClicks}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-cms-text-dim">
                    Last updated:{' '}
                    {new Date(m.polledAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
