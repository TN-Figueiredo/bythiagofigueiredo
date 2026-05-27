'use client'

import Image from 'next/image'
import type { Grade } from '@/lib/youtube/scoring-types'

interface ThumbnailWithGradeProps {
  thumbnailUrl: string | null
  grade: Grade
  score: number
}

const GRADE_COLORS: Record<Grade, string> = {
  A: 'bg-emerald-500',
  B: 'bg-blue-500',
  C: 'bg-amber-500',
  D: 'bg-red-500',
}

export function ThumbnailWithGrade({ thumbnailUrl, grade, score }: ThumbnailWithGradeProps) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md bg-cms-surface-hover">
      {thumbnailUrl ? (
        <Image src={thumbnailUrl} alt="" fill className="object-cover" sizes="480px" />
      ) : (
        <div className="flex h-full items-center justify-center text-cms-text-muted text-sm">
          No thumbnail
        </div>
      )}
      <div className={`absolute bottom-2 right-2 flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold text-white ${GRADE_COLORS[grade]}`} aria-label={`Grade ${grade}, score ${score}`}>
        <span>{grade}</span>
        <span className="text-[10px] font-normal opacity-80">{score}</span>
      </div>
    </div>
  )
}
