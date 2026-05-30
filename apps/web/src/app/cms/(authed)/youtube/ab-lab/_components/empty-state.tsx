'use client'

import { FlaskConical, Plus } from 'lucide-react'
import type { SuggestedVideo, TestType } from '@/lib/youtube/ab-types'
import { SuggestedCard } from './suggested-card'

export interface EmptyStateProps {
  suggested: SuggestedVideo[]
  onCreate: (videoId: string, type: TestType) => void
}

function Hero({ onCreate }: { onCreate: EmptyStateProps['onCreate'] }) {
  return (
    <div
      data-hero
      className="relative rounded-lg border border-cms-border bg-gradient-to-br from-cms-accent/10 to-transparent p-8 text-center overflow-hidden"
    >
      <FlaskConical
        size={80}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cms-accent/10"
        aria-hidden="true"
      />
      <div className="relative z-10">
        <h3 className="text-lg font-semibold text-cms-text mb-2">
          Comece a testar
        </h3>
        <p className="text-sm text-cms-text-muted mb-4 max-w-md mx-auto">
          Crie seu primeiro teste A/B para descobrir qual thumbnail/título maximiza o CTR.
        </p>
        <button
          type="button"
          onClick={() => onCreate('', 'thumbnail')}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded bg-cms-accent text-white hover:bg-cms-accent/90 transition-colors focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
        >
          <Plus size={14} aria-hidden="true" />
          + Novo teste
        </button>
      </div>
    </div>
  )
}

export function EmptyState({ suggested, onCreate }: EmptyStateProps) {
  if (suggested.length === 0) {
    return <Hero onCreate={onCreate} />
  }

  const visible = suggested.slice(0, 3)

  return (
    <div className="space-y-6">
      <Hero onCreate={onCreate} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map(video => (
          <SuggestedCard key={video.id} video={video} onCreate={onCreate} />
        ))}
      </div>
    </div>
  )
}
