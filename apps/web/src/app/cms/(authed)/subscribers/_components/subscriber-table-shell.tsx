'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { SubscriberTable, type SubscriberRow } from './subscriber-table'

interface SubscriberTableShellProps {
  initialRows: SubscriberRow[]
  totalCount: number
  page: number
  perPage: number
  newsletterTypes: { id: string; name: string; color: string | null }[]
  currentSearch: string
  currentStatus: string
  currentType: string
}

export function SubscriberTableShell({
  initialRows,
  totalCount,
  page,
  perPage,
  newsletterTypes,
  currentSearch,
  currentStatus,
  currentType,
}: SubscriberTableShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function buildUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, val] of Object.entries(updates)) {
      if (val) {
        params.set(key, val)
      } else {
        params.delete(key)
      }
    }
    if (!('page' in updates)) {
      params.delete('page')
    }
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const handlePageChange = useCallback(
    (newPage: number) => {
      router.push(buildUrl({ page: String(newPage) }))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, pathname, searchParams],
  )

  const handleSearch = useCallback(
    (query: string) => {
      router.push(buildUrl({ search: query }))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, pathname, searchParams],
  )

  const handleStatusFilter = useCallback(
    (status: string) => {
      router.push(buildUrl({ status }))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, pathname, searchParams],
  )

  const handleTypeFilter = useCallback(
    (typeId: string) => {
      router.push(buildUrl({ type: typeId }))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, pathname, searchParams],
  )

  return (
    <SubscriberTable
      initialRows={initialRows}
      totalCount={totalCount}
      page={page}
      perPage={perPage}
      newsletterTypes={newsletterTypes}
      onPageChange={handlePageChange}
      onSearch={handleSearch}
      onStatusFilter={handleStatusFilter}
      onTypeFilter={handleTypeFilter}
      currentSearch={currentSearch}
      currentStatus={currentStatus}
      currentType={currentType}
    />
  )
}
