'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { SubscriberRow } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'

const PAGE_SIZE = 20

interface SubscriberTableProps {
  rows: SubscriberRow[]
  total: number
  page: number
  strings?: NewsletterHubStrings
}

const STATUS_COLORS: Record<SubscriberRow['status'], string> = {
  active: 'bg-green-500/20 text-green-400',
  at_risk: 'bg-amber-500/20 text-amber-400',
  bounced: 'bg-red-500/20 text-red-400',
  unsubscribed: 'bg-gray-500/20 text-gray-400',
  anonymized: 'bg-gray-700/20 text-gray-500',
}

export function SubscriberTable({ rows, total, page, strings }: SubscriberTableProps) {
  const a = strings?.audience
  const st = strings?.status
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasPrev = page > 1
  const hasNext = page < totalPages

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (p > 1) params.set('page', String(p))
    else params.delete('page')
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left">
          <thead>
            <tr className="border-b border-gray-800">
              <th scope="col" className="px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">{a?.subscriber ?? 'Subscriber'}</th>
              <th scope="col" className="px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">{a?.types ?? 'Types'}</th>
              <th scope="col" className="px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">{a?.engagement ?? 'Engagement'}</th>
              <th scope="col" className="px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-[8px] font-bold text-gray-400">
                      {r.initials}
                    </span>
                    <span className="text-[11px] text-gray-300">{r.emailMasked}</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    {r.types.map((t) => (
                      <span key={t.id} className="rounded-full px-1.5 py-0.5 text-[8px] text-white" style={{ backgroundColor: t.color }}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${r.engagementScore}%` }} />
                    </div>
                    <span className="text-[9px] tabular-nums text-gray-500">{r.engagementScore}</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[8px] font-medium ${STATUS_COLORS[r.status]}`}>
                    {st?.[r.status === 'at_risk' ? 'atRisk' : r.status] ?? r.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-gray-800 px-4 py-2">
        <span className="text-[9px] text-gray-500">
          {a?.showing ?? 'Showing'} {total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, total)} {a?.of ?? 'of'} {total}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={!hasPrev}
              className="flex h-6 w-6 items-center justify-center rounded border border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label={a?.prevPage ?? 'Previous page'}
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="px-2 text-[9px] tabular-nums text-gray-500">{page}/{totalPages}</span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={!hasNext}
              className="flex h-6 w-6 items-center justify-center rounded border border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label={a?.nextPage ?? 'Next page'}
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
