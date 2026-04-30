'use client'

import type { TabId } from './hub-types'

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-[10px] bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-[length:200%_100%] ${className ?? ''}`}
    />
  )
}

export function TabSkeleton({ tab }: { tab: TabId }) {
  return (
    <div className="space-y-4 p-1" aria-busy="true" aria-label="Loading tab content">
      <div className="flex gap-3">
        {Array.from({ length: tab === 'audience' ? 6 : 5 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-[72px] min-w-[140px] flex-1" />
        ))}
      </div>
      {tab === 'editorial' ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex w-[200px] shrink-0 flex-col gap-2">
              <ShimmerBlock className="h-8 w-full" />
              <ShimmerBlock className="h-[120px] w-full" />
              <ShimmerBlock className="h-[120px] w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <ShimmerBlock className="h-[200px]" />
          <ShimmerBlock className="h-[200px]" />
          <ShimmerBlock className="h-[160px]" />
          <ShimmerBlock className="h-[160px]" />
        </div>
      )}
    </div>
  )
}
