'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { PostsFilters, type FilterChangeParams } from '@tn-figueiredo/cms-admin/blog/client'

interface PostsFiltersConnectedProps {
  counts: Record<string, number>
}

export function PostsFiltersConnected({ counts }: PostsFiltersConnectedProps) {
  const router = useRouter()
  const params = useSearchParams()

  const handleFilterChange = useCallback(
    (next: FilterChangeParams) => {
      const sp = new URLSearchParams(params.toString())
      if (next.status !== undefined) {
        if (next.status) sp.set('status', next.status)
        else sp.delete('status')
      }
      if (next.locale !== undefined) {
        if (next.locale) sp.set('locale', next.locale)
        else sp.delete('locale')
      }
      if (next.q !== undefined) {
        if (next.q) sp.set('q', next.q)
        else sp.delete('q')
      }
      sp.delete('page')
      router.push(`/cms/blog?${sp.toString()}`)
    },
    [params, router],
  )

  return (
    <PostsFilters
      counts={counts}
      currentStatus={params.get('status') ?? ''}
      currentLocale={params.get('locale') ?? ''}
      currentSearch={params.get('q') ?? ''}
      onFilterChange={handleFilterChange}
    />
  )
}
