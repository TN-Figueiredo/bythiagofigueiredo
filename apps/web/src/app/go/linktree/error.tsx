'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function LinktreeError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { component: 'linktree', boundary: 'error' } })
  }, [error])
  return (
    <div className="min-h-dvh bg-[#14110B] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-11 h-11 rounded-full border-2 border-[#FF8240] mx-auto mb-4 flex items-center justify-center">
          <span className="text-[22px] font-serif text-[#F0E8D6]">
            <span className="font-medium">T</span>
            <span className="italic text-[#FF8240]">F</span>
          </span>
        </div>
        <h2 className="text-lg font-semibold text-[#F0E8D6] mb-2">Algo deu errado · Something went wrong</h2>
        <p className="text-sm text-[#B5A890] mb-4">Tente novamente em alguns instantes. · Please try again shortly.</p>
        <button
          type="button"
          onClick={reset}
          className="text-sm font-medium text-[#FF8240] border border-[#FF8240] px-4 py-2 rounded hover:bg-[rgba(255,130,64,0.12)]"
        >
          Tentar de novo · Try again
        </button>
      </div>
    </div>
  )
}
