'use client'

import { useState, useTransition } from 'react'
import type { Provider } from '@tn-figueiredo/social'
import {
  PlatformIcon,
  platformLabel,
} from '@/app/cms/(authed)/_shared/social/platform-icon'
import { OgFacebookCard } from './og-facebook-card'
import { OgBlueskyCard } from './og-bluesky-card'
import { OgInstagramPreview } from './og-instagram-preview'
import { scrapeOgTags } from '@/lib/social/actions'

// ---------------------------------------------------------------------------
// OG validation badge types
// ---------------------------------------------------------------------------

interface OgBadge {
  label: string
  severity: 'red' | 'amber' | 'green'
}

function computeOgBadges(ogData: OgData | null): OgBadge[] {
  if (!ogData) return [{ label: 'Not scraped', severity: 'amber' }]

  const badges: OgBadge[] = []

  if (!ogData.image) {
    badges.push({ label: 'og:image missing', severity: 'red' })
  } else if (
    ogData.imageWidth &&
    ogData.imageHeight &&
    (ogData.imageWidth < 600 || ogData.imageHeight < 314)
  ) {
    badges.push({ label: 'Image too small', severity: 'amber' })
  }

  if (!ogData.title) {
    badges.push({ label: 'Title missing', severity: 'red' })
  }

  if (ogData.description && ogData.description.length > 200) {
    badges.push({ label: 'Description too long', severity: 'amber' })
  }

  if (badges.length === 0) {
    badges.push({ label: 'All checks passed', severity: 'green' })
  }

  return badges
}

const SEVERITY_COLORS: Record<string, string> = {
  red: 'text-red-400 bg-red-500/10',
  amber: 'text-amber-400 bg-amber-500/10',
  green: 'text-emerald-400 bg-emerald-500/10',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OgData {
  title: string
  description: string
  image: string | null
  imageWidth?: number
  imageHeight?: number
  domain: string
  scrapedAt?: string
}

interface OgPreviewSidebarProps {
  platforms: Provider[]
  ogData: OgData | null
  postId?: string
  onForceRescrape?: () => void
}

// Platforms that show OG previews (YouTube excluded — no link cards)
const OG_PLATFORMS: Provider[] = ['facebook', 'bluesky', 'instagram']

export function OgPreviewSidebar({
  platforms,
  ogData,
  postId,
  onForceRescrape,
}: OgPreviewSidebarProps) {
  const visiblePlatforms = platforms.filter((p) => OG_PLATFORMS.includes(p))
  const [activeTab, setActiveTab] = useState<Provider>(
    visiblePlatforms[0] ?? 'facebook',
  )
  const [isPending, startTransition] = useTransition()

  if (visiblePlatforms.length === 0) {
    return null
  }

  const badges = computeOgBadges(ogData)

  // Cache status
  const isCached = ogData?.scrapedAt != null
  const cacheAge = ogData?.scrapedAt
    ? Math.floor(
        (Date.now() - new Date(ogData.scrapedAt).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null
  const isCacheStale = cacheAge != null && cacheAge > 7

  function handleForceRescrape() {
    if (postId) {
      startTransition(async () => {
        await scrapeOgTags(postId)
        onForceRescrape?.()
      })
    }
  }

  return (
    <div className="sticky top-20 w-[380px] shrink-0 space-y-4">
      {/* Platform tabs */}
      <div className="flex border-b border-cms-border">
        {visiblePlatforms.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setActiveTab(p)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium ${
              activeTab === p
                ? 'border-b-2 border-cms-accent text-cms-accent'
                : 'text-cms-text-muted hover:text-cms-text'
            }`}
          >
            <PlatformIcon provider={p} size="sm" />
            {platformLabel(p)}
          </button>
        ))}
      </div>

      {/* Card preview */}
      <div className="rounded-lg border border-cms-border bg-cms-surface p-3">
        {activeTab === 'facebook' && (
          <OgFacebookCard
            imageUrl={ogData?.image ?? null}
            title={ogData?.title ?? ''}
            description={ogData?.description ?? ''}
            domain={ogData?.domain ?? ''}
          />
        )}
        {activeTab === 'bluesky' && (
          <OgBlueskyCard
            imageUrl={ogData?.image ?? null}
            title={ogData?.title ?? ''}
            description={ogData?.description ?? ''}
            domain={ogData?.domain ?? ''}
          />
        )}
        {activeTab === 'instagram' && (
          <OgInstagramPreview
            imageUrl={ogData?.image ?? null}
            title={ogData?.title ?? ''}
          />
        )}
      </div>

      {/* Validation badges */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-cms-text-muted">
          Validation
        </p>
        <div className="flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <span
              key={badge.label}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SEVERITY_COLORS[badge.severity]}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      </div>

      {/* Scrape status footer */}
      <div className="flex items-center justify-between border-t border-cms-border pt-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isCached && !isCacheStale ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span className="text-xs text-cms-text-muted">
            {isCached && !isCacheStale
              ? `Cached (${cacheAge}d ago)`
              : 'Not scraped'}
          </span>
        </div>

        {postId && (
          <button
            type="button"
            onClick={handleForceRescrape}
            disabled={isPending}
            className="rounded-md border border-cms-border px-2.5 py-1 text-[10px] font-medium text-cms-text hover:bg-cms-surface disabled:opacity-50"
          >
            {isPending ? 'Scraping...' : 'Force Scrape'}
          </button>
        )}
      </div>
    </div>
  )
}
