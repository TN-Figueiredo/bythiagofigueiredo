'use client'

import React from 'react'
import Link from 'next/link'
import type { TestType, AbTestStatus } from '@/lib/youtube/ab-types'
import { TypeBadge, Badge } from './ab-primitives'
import { ChevronLeft, Swords } from 'lucide-react'

export type DetailOutcome = 'winner' | 'playoff' | undefined

export interface DetailHeaderProps {
  title: string
  flag: TestType
  status: AbTestStatus
  roundNumber: number
  totalRounds: number
  hasPlayoff: boolean
  outcome?: DetailOutcome
  dayInfo?: { dayOf: number; total: number }
  actions?: React.ReactNode
}

export function DetailHeader({
  title,
  flag,
  status,
  roundNumber,
  totalRounds,
  hasPlayoff,
  outcome,
  dayInfo,
  actions,
}: DetailHeaderProps) {
  return (
    <header>
      {/* Row 1: breadcrumb + badges */}
      <div className="flex items-center gap-[10px] flex-wrap mb-[14px]">
        <Link
          href="/cms/youtube/ab-lab"
          className="inline-flex items-center gap-[5px] text-[12.5px] text-cms-text-dim hover:text-cms-text transition-colors font-medium"
        >
          <ChevronLeft size={15} aria-hidden="true" />
          A/B Lab
        </Link>
        <span className="text-cms-text-dim text-[12px]">/</span>
        <TypeBadge type={flag} />
        {totalRounds > 1 && (
          <Badge tone="neutral">
            <Swords size={11} aria-hidden="true" className="-translate-y-px" />
            Round {roundNumber}/{totalRounds}
          </Badge>
        )}
        {dayInfo && (
          <Badge tone="green" dot={status === 'active'}>
            Dia {dayInfo.dayOf}/{dayInfo.total}
          </Badge>
        )}
      </div>

      {/* Row 2: Title */}
      <h2 className="text-[28px] font-bold text-cms-text leading-[1.15] max-w-[720px] tracking-[-0.01em]">{title}</h2>

      {/* Row 3: Toolbar */}
      {actions && (
        <div className="flex items-center justify-end gap-[8px] mt-[14px] flex-nowrap">
          {actions}
        </div>
      )}
    </header>
  )
}
