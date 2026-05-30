'use client'

import React from 'react'
import Link from 'next/link'
import type { TestType, AbTestStatus } from '@/lib/youtube/ab-types'
import { TypeBadge, Badge, Seg, InfoTip } from './ab-primitives'
import { ArrowLeft, Trophy, Swords, AlertCircle } from 'lucide-react'
import type { BadgeTone } from './ab-primitives'

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

function StatusBadge({ status, outcome, dayInfo }: { status: AbTestStatus; outcome?: DetailOutcome; dayInfo?: { dayOf: number; total: number } }) {
  if (status === 'completed' && outcome === 'winner') {
    return (
      <Badge tone="green">
        <Trophy size={11} aria-hidden="true" className="-translate-y-px" />
        Concluído · Vencedor
      </Badge>
    )
  }

  if (status === 'completed' && outcome === 'playoff') {
    return (
      <Badge tone="amber">
        <AlertCircle size={11} aria-hidden="true" className="-translate-y-px" />
        Inconclusivo
      </Badge>
    )
  }

  if (status === 'active' && dayInfo) {
    return (
      <Badge tone={STATUS_TONE[status]} dot>
        Ativo · dia {dayInfo.dayOf}/{dayInfo.total}
      </Badge>
    )
  }

  return (
    <Badge tone={STATUS_TONE[status]} dot={status === 'active'}>
      {STATUS_LABEL[status]}
    </Badge>
  )
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
  signalToggle,
  actions,
}: DetailHeaderProps) {
  return (
    <header>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-3">
        <Link
          href="/cms/youtube/ab-lab"
          className="inline-flex items-center gap-1 text-xs text-cms-text-muted hover:text-cms-accent transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          A/B Lab
        </Link>
      </nav>

      {/* Main row: badges+title (left) | actions (right) */}
      <div className="flex items-start justify-between gap-[18px] flex-wrap">
        {/* Left: badges + title */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-[10px] flex-wrap">
            <TypeBadge type={flag} />
            {totalRounds > 1 && (
              <Badge tone="cowork">
                <Swords size={11} aria-hidden="true" className="-translate-y-px" />
                Round {roundNumber}/{totalRounds}
              </Badge>
            )}
            <StatusBadge status={status} outcome={outcome} dayInfo={dayInfo} />
          </div>
          <h2 className="text-[24px] font-semibold text-cms-text leading-[1.2] max-w-[720px]">{title}</h2>
        </div>

        {/* Right: signal toggle + actions */}
        <div className="flex items-center gap-[9px] shrink-0">
          {signalToggle && (
            <div className="flex items-center gap-2">
              <Seg<'confirmed' | 'live'>
                options={['confirmed', 'live'] as const}
                value={signalToggle.mode}
                onChange={() => signalToggle.onToggle()}
                labels={{ confirmed: 'Confirmado', live: 'Live' }}
                aria-label="Signal mode"
              />
              <InfoTip text="Confirmado usa dados verificados. Live mostra estimativas em tempo real." />
            </div>
          )}
          {actions}
        </div>
      </div>
    </header>
  )
}
