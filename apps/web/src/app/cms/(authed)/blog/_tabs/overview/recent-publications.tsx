'use client'

import Link from 'next/link'
import { Clock } from 'lucide-react'
import type { OverviewTabData } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { formatRelativeDate } from '../../_hub/hub-utils'

interface RecentPublicationsProps {
  data: OverviewTabData['recentPublications']
  strings?: BlogHubStrings
}

export function RecentPublications({ data, strings }: RecentPublicationsProps) {
  const s = strings?.overview

  if (data.length === 0) {
    return (
      <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {s?.recentPublications ?? 'Recent Publications'}
        </h3>
        <p className="text-xs text-gray-600">{strings?.empty.noPosts ?? 'No posts yet'}</p>
      </div>
    )
  }

  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {s?.recentPublications ?? 'Recent Publications'}
      </h3>
      <ul className="flex flex-col divide-y divide-gray-800">
        {data.slice(0, 5).map((post) => (
          <li key={post.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <Link
                href={`/cms/blog/${post.id}/edit`}
                className="line-clamp-1 text-[11px] font-medium text-gray-200 hover:text-indigo-300 transition-colors"
              >
                {post.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {/* Tag badge */}
                {post.tagName && (
                  <span
                    className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                    style={{
                      backgroundColor: post.tagColor ? `${post.tagColor}20` : '#37415120',
                      color: post.tagColor ?? '#9ca3af',
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: post.tagColor ?? '#9ca3af' }}
                    />
                    {post.tagName}
                  </span>
                )}
                {/* Locale badges */}
                {post.locales.map((loc) => (
                  <span
                    key={loc}
                    className="rounded bg-gray-800 px-1 py-0.5 text-[8px] font-medium uppercase text-gray-500"
                  >
                    {loc}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <time className="text-[9px] text-gray-600">
                {formatRelativeDate(post.publishedAt)} {s?.publishedAgo ?? 'ago'}
              </time>
              {post.readingTimeMin != null && (
                <span className="flex items-center gap-0.5 text-[9px] tabular-nums text-gray-600">
                  <Clock className="h-2.5 w-2.5" />
                  {post.readingTimeMin} {s?.readingTime ?? 'min read'}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
