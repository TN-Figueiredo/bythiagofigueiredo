'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CmsButton, formatRelativeTime } from '@tn-figueiredo/cms-ui/client'

interface LastEdited {
  id: string
  title: string
  updatedAt: string
}

export function ContinueEditing({ siteId }: { siteId: string }) {
  const [item, setItem] = useState<LastEdited | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`cms:lastEdited:${siteId}`)
      if (raw) setItem(JSON.parse(raw) as LastEdited)
    } catch {
      // ignore parse errors
    }
  }, [siteId])

  if (!item) return null

  const timeAgo = formatRelativeTime(item.updatedAt)

  return (
    <div className="flex items-center gap-4 p-4 bg-cms-surface border border-cms-border rounded-[var(--cms-radius)]">
      <span className="text-2xl">📝</span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-cms-text-dim uppercase tracking-wide">Continue editing</div>
        <div className="text-[13px] font-medium text-cms-text truncate">{item.title}</div>
        <div className="text-[11px] text-cms-text-dim">Last edited {timeAgo}</div>
      </div>
      <Link href={`/cms/blog/${item.id}/edit`}>
        <CmsButton variant="primary" size="sm">Resume</CmsButton>
      </Link>
    </div>
  )
}
