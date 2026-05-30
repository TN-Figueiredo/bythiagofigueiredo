'use client'

import { Plus } from 'lucide-react'
import type { SuggestedVideo, TestType } from '@/lib/youtube/ab-types'
import { SuggestedCard } from './suggested-card'

export interface EmptyStateProps {
  suggested: SuggestedVideo[]
  onCreate: (videoId: string, type: TestType) => void
}

export function EmptyState({ suggested, onCreate }: EmptyStateProps) {
  if (suggested.length === 0) {
    return (
      <div className="rounded-[14px] border border-cms-border bg-cms-surface p-[28px] text-center">
        <h3 className="text-[18px] font-semibold mb-[8px]">Comece a testar</h3>
        <p className="text-[13px] text-cms-text-dim mb-[16px] max-w-[400px] mx-auto">
          Crie seu primeiro teste A/B para descobrir qual thumbnail/título maximiza o CTR.
        </p>
        <button
          type="button"
          onClick={() => onCreate('', 'thumbnail')}
          className="inline-flex items-center gap-[7px] justify-center py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] bg-cms-accent tracking-[-0.01em]"
          style={{ border: '1px solid var(--cms-accent)', color: 'rgb(26,18,12)' }}
        >
          <Plus size={16} aria-hidden="true" />
          + Novo teste
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[16px]">
        {suggested.slice(0, 3).map(video => (
          <SuggestedCard key={video.id} video={video} onCreate={onCreate} />
        ))}
      </div>
      <div className="flex items-center justify-center gap-[8px] mt-[22px] text-[13px] text-cms-text-dim">
        Quer testar outro vídeo?
        <button
          type="button"
          onClick={() => onCreate('', 'thumbnail')}
          className="inline-flex items-center gap-[5px] text-[13px] text-cms-text-dim hover:text-cms-text transition-colors"
        >
          <Plus size={14} aria-hidden="true" />
          Começar do zero
        </button>
      </div>
    </div>
  )
}
