'use client'

import { useState } from 'react'
import type { Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from '@/app/cms/(authed)/_shared/social/platform-icon'
import type { SocialStrings } from '../../_i18n/types'

interface PlatformPreviewsProps {
  content: string
  url: string
  hashtags: string[]
  platforms: Provider[]
  strings: SocialStrings
}

export function PlatformPreviews({ content, url, hashtags, platforms, strings: t }: PlatformPreviewsProps) {
  const [activeTab, setActiveTab] = useState<Provider | null>(platforms[0] ?? null)

  if (platforms.length === 0) {
    return <p className="text-center text-xs text-cms-text-dim py-8">Select a platform to see preview</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-cms-border pb-1">
        {platforms.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setActiveTab(p)}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-t ${activeTab === p ? 'text-cms-accent border-b-2 border-cms-accent' : 'text-cms-text-muted'}`}
          >
            <PlatformIcon provider={p} size="sm" />
            {platformLabel(p)}
          </button>
        ))}
      </div>

      {activeTab === 'facebook' && <FacebookPreview content={content} url={url} />}
      {activeTab === 'instagram' && <InstagramPreview content={content} hashtags={hashtags} />}
      {activeTab === 'bluesky' && <BlueskyPreview content={content} url={url} />}
    </div>
  )
}

/**
 * Platform preview sub-components below use hardcoded English strings intentionally.
 * They simulate the real platform UIs (Facebook, Instagram, Bluesky) which are always
 * rendered in their native language/format, not the CMS locale.
 */
function FacebookPreview({ content, url }: { content: string; url: string }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-blue-600" />
        <div>
          <p className="text-xs font-semibold text-gray-200">Your Page</p>
          <p className="text-[10px] text-gray-500">Just now</p>
        </div>
      </div>
      {content && <p className="text-sm text-gray-200 whitespace-pre-wrap">{content}</p>}
      {url && (
        <div className="rounded border border-gray-700 bg-gray-900 p-2">
          <p className="text-xs text-gray-400 truncate">{url}</p>
        </div>
      )}
      <div className="flex gap-4 border-t border-gray-700 pt-2 text-xs text-gray-500">
        <span>Like</span><span>Comment</span><span>Share</span>
      </div>
    </div>
  )
}

function InstagramPreview({ content, hashtags }: { content: string; hashtags: string[] }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-yellow-500" />
        <p className="text-xs font-semibold text-gray-200">your_account</p>
      </div>
      <div className="aspect-square rounded bg-gray-700 flex items-center justify-center text-gray-500 text-xs">[Image]</div>
      {content && <p className="text-xs text-gray-200"><strong>your_account</strong> {content}</p>}
      {hashtags.length > 0 && <p className="text-xs text-blue-400">{hashtags.join(' ')}</p>}
    </div>
  )
}

function BlueskyPreview({ content, url }: { content: string; url: string }) {
  const truncated = content.length > 300 ? content.slice(0, 297) + '...' : content
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-sky-500" />
        <div>
          <p className="text-xs font-semibold text-gray-200">You</p>
          <p className="text-[10px] text-gray-500">@you.bsky.social</p>
        </div>
      </div>
      {truncated && <p className="text-sm text-gray-200 whitespace-pre-wrap">{truncated}</p>}
      {url && (
        <div className="rounded border border-gray-700 bg-gray-900 p-2">
          <p className="text-xs text-sky-400 truncate">{url}</p>
        </div>
      )}
    </div>
  )
}
