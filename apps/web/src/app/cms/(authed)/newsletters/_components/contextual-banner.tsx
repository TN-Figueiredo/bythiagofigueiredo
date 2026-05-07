'use client'

import { Info, Clock, Loader2, XCircle } from 'lucide-react'
import { formatSiteDateTime } from '@/lib/cms/format-site-datetime'

interface ContextualBannerProps {
  status: string | null
  scheduledAt: string | null
  sendProgress: { sent: number; total: number } | null
  errorMessage: string | null
  siteTimezone?: string
}

export function ContextualBanner({ status, scheduledAt, sendProgress, errorMessage, siteTimezone }: ContextualBannerProps) {
  if (status === null) {
    return (
      <div className="flex items-center gap-2 px-5 py-2.5 border-b" style={{ background: 'rgba(99,102,241,0.04)', borderColor: 'rgba(99,102,241,0.1)' }}>
        <Info size={14} className="text-[#818cf8] shrink-0" />
        <span className="text-xs text-[#9ca3af]">
          This edition will be created when you start typing. Navigate away to discard.
        </span>
      </div>
    )
  }

  if (status === 'scheduled' && scheduledAt) {
    const scheduledDate = new Date(scheduledAt)
    const diff = scheduledDate.getTime() - Date.now()
    const days = Math.max(0, Math.ceil(diff / 86_400_000))
    const timeLabel = days === 0 ? 'today' : days === 1 ? 'in 1 day' : `in ${days} days`
    const tz = siteTimezone ?? 'America/Sao_Paulo'
    const fmt = formatSiteDateTime(scheduledDate, tz, { mode: 'full', includeLocal: true })

    return (
      <div className="flex items-center justify-between px-5 py-2.5 border-b" style={{ background: 'rgba(168,85,247,0.05)', borderColor: 'rgba(168,85,247,0.12)' }}>
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-[#c084fc] shrink-0" />
          <span className="text-xs text-[#d1d5db]">
            Scheduled for{' '}
            <strong>{fmt.primary} {fmt.tzAbbr}</strong>
          </span>
          {fmt.local && (
            <>
              <span className="text-[#4b5563]">&middot;</span>
              <span className="text-xs text-[#6b7280]">{fmt.local} {fmt.localTzAbbr}</span>
              {fmt.crossDay && (
                <span className="text-[10px] font-medium text-amber-500">+1d</span>
              )}
            </>
          )}
        </div>
        <span className="text-xs text-[#9ca3af]">Sends {timeLabel}</span>
      </div>
    )
  }

  if (status === 'sending' && sendProgress) {
    const pct = sendProgress.total > 0 ? (sendProgress.sent / sendProgress.total) * 100 : 0
    return (
      <div className="border-b" style={{ background: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.12)' }}>
        <div className="flex items-center gap-2 px-5 py-2.5">
          <Loader2 size={14} className="text-[#60a5fa] shrink-0 animate-spin" />
          <span className="text-xs text-[#d1d5db]">Sending to subscribers...</span>
          <span className="text-xs text-[#9ca3af] ml-auto">{sendProgress.sent} / {sendProgress.total} sent</span>
        </div>
        <div className="h-[3px] bg-[#1e3a5f]">
          <div className="h-full bg-[#3b82f6] transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  if (status === 'failed' && errorMessage) {
    return (
      <div className="flex items-center gap-2 px-5 py-2.5 border-b" style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.15)' }}>
        <XCircle size={14} className="text-[#f87171] shrink-0" />
        <span className="text-xs text-[#f87171]">{errorMessage}</span>
      </div>
    )
  }

  return null
}
