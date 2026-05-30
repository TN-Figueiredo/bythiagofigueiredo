'use client'

import type { SuggestedVideo, TestType } from '@/lib/youtube/ab-types'
import { FlaskConical, Info } from 'lucide-react'

const TYPE_LABELS: Record<TestType, string> = {
  combo: 'combo',
  thumbnail: 'thumbnail',
  title: 'título',
  description: 'descrição',
}

const GRADE_COLORS: Record<string, string> = {
  A: 'var(--cms-green)',
  B: 'var(--cms-green)',
  C: 'var(--cms-amber, #E0A23C)',
  D: 'var(--cms-red, #ef4444)',
  F: 'var(--cms-red, #ef4444)',
}

export interface SuggestedCardProps {
  video: SuggestedVideo
  onCreate: (videoId: string, type: TestType) => void
}

export function SuggestedCard({ video, onCreate }: SuggestedCardProps) {
  const gradeColor = GRADE_COLORS[video.grade] ?? GRADE_COLORS.C
  const ctrColor = video.grade === 'D' || video.grade === 'F' ? 'var(--cms-red, #ef4444)' : gradeColor

  return (
    <div className="rounded-[14px] bg-cms-surface overflow-hidden">
      {/* Thumbnail */}
      <div className="relative">
        <div
          className="relative w-full overflow-hidden rounded-[10px]"
          style={{
            aspectRatio: '16/9',
            background: 'linear-gradient(135deg, rgb(58,47,40), rgb(31,26,22))',
            boxShadow: 'rgba(0,0,0,0.4) 0px 0px 60px inset',
          }}
        >
          {video.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.thumbnailUrl} alt={video.title} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <>
              <div className="absolute" style={{ left: '8%', bottom: '-6%', width: '46%', height: '92%', background: 'radial-gradient(at 50% 40%, rgba(255,255,255,0.14), transparent 65%)' }} />
              <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.024) 0px, rgba(255,255,255,0.024) 2px, transparent 2px, transparent 9px)' }} />
            </>
          )}
        </div>
        {/* Grade badge */}
        <span
          className="absolute flex items-center gap-[5px] rounded-[7px] font-mono text-[11px] font-bold"
          style={{
            left: 9, top: 9,
            padding: '3px 8px',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            color: gradeColor,
          }}
        >
          NOTA {video.grade}
        </span>
      </div>

      {/* Content */}
      <div className="py-[14px] px-[16px]">
        {/* Title */}
        <div className="text-[14px] font-semibold leading-[1.3] min-h-[36px]" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {video.title}
        </div>

        {/* Stats row */}
        <div className="flex gap-[14px] my-[12px] text-[11.5px]">
          <div>
            <div className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[3px]">CTR atual</div>
            <span className="font-mono text-[14px] font-bold" style={{ color: ctrColor }}>{video.ctr.toFixed(1)}%</span>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[3px]">mediana canal</div>
            <span className="font-mono text-[14px] font-bold text-cms-text-dim">{video.channelMedianCtr.toFixed(1)}%</span>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[3px]">impressões</div>
            <span className="font-mono text-[14px] font-bold text-cms-text">{video.impressions ?? '—'}</span>
          </div>
        </div>

        {/* Reason box */}
        <div
          className="text-[12px] text-cms-text-dim leading-[1.45] py-[10px] px-[12px] rounded-[8px] mb-[14px]"
          style={{ background: 'var(--cms-surface-hover)' }}
        >
          <Info size={12} className="text-cms-accent inline align-[-2px] mr-[5px]" aria-hidden="true" />
          {video.reason}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-[10px]">
          <button
            type="button"
            onClick={() => onCreate(video.id, video.suggest)}
            className="flex-1 inline-flex items-center gap-[7px] justify-center py-[6px] px-[11px] text-[12.5px] font-semibold rounded-[9px] whitespace-nowrap transition-[0.15s] tracking-[-0.01em] bg-cms-accent"
            style={{ border: '1px solid var(--cms-accent)', color: 'rgb(26,18,12)' }}
          >
            <FlaskConical size={14} aria-hidden="true" />
            Testar {TYPE_LABELS[video.suggest]}
          </button>
          <span className="font-mono text-[10.5px] text-cms-text-dim shrink-0">
            {video.confidence ?? 85}% conf.
          </span>
        </div>
      </div>
    </div>
  )
}
