'use client'

import React from 'react'
import Link from 'next/link'
import type { TestType, AbTestStatus } from '@/lib/youtube/ab-types'
import { TypeBadge, Badge, Seg, InfoTip } from './ab-primitives'
import { ArrowLeft } from 'lucide-react'
import type { BadgeTone } from './ab-primitives'

export interface DetailHeaderProps {
  title: string
  flag: TestType
  status: AbTestStatus
  roundNumber: number
  totalRounds: number
  hasPlayoff: boolean
  signalToggle?: { mode: 'confirmed' | 'live'; onToggle: () => void }
  actions?: React.ReactNode
}

const STATUS_TONE: Record<AbTestStatus, BadgeTone> = {
  active: 'green',
  paused: 'amber',
  completed: 'neutral',
  draft: 'neutral',
  archived: 'neutral',
}

const STATUS_LABEL: Record<AbTestStatus, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  completed: 'Concluído',
  draft: 'Rascunho',
  archived: 'Arquivado',
}

export function DetailHeader({
  title,
  flag,
  status,
  roundNumber,
  totalRounds,
  hasPlayoff,
  signalToggle,
  actions,
}: DetailHeaderProps) {
  return (
    <header className="space-y-2">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-1">
        <Link
          href="/cms/youtube/ab-lab"
          className="inline-flex items-center gap-1 text-2xs text-cms-text-muted hover:text-cms-accent transition-colors"
        >
          <ArrowLeft size={12} aria-hidden="true" />
          A/B Lab
        </Link>
      </nav>

      {/* Badge row + right side */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge type={flag} />
          {totalRounds > 1 && (
            <Badge tone="accent">
              R{roundNumber}/{totalRounds}
            </Badge>
          )}
          {hasPlayoff && <Badge tone="accent">Playoff</Badge>}
          <Badge tone={STATUS_TONE[status]} dot={status === 'active'}>
            {STATUS_LABEL[status]}
          </Badge>
        </div>

        {/* Right side: signal toggle or actions */}
        <div className="flex items-center gap-2">
          {signalToggle ? (
            <>
              <Seg<'confirmed' | 'live'>
                options={['confirmed', 'live'] as const}
                value={signalToggle.mode}
                onChange={() => signalToggle.onToggle()}
                labels={{ confirmed: 'Confirmado', live: 'Live' }}
                aria-label="Signal mode"
              />
              <InfoTip text="Confirmed uses verified data. Live shows real-time estimates." />
            </>
          ) : (
            actions
          )}
        </div>
      </div>

      {/* Title */}
      <h2 className="text-lg font-semibold text-cms-text">{title}</h2>
    </header>
  )
}
