'use client'

import React from 'react'
import Link from 'next/link'
import type { TestType, AbTestStatus } from '@/lib/youtube/ab-types'
import { TypeBadge, Badge, Seg, InfoTip } from './ab-primitives'
import { ArrowLeft, Trophy } from 'lucide-react'
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

function StatusBadge({ status, outcome }: { status: AbTestStatus; outcome?: DetailOutcome }) {
  if (status === 'completed' && outcome === 'winner') {
    return (
      <Badge tone="green">
        <Trophy size={11} aria-hidden="true" className="-ml-0.5 -translate-y-px" />
        Concluído · Vencedor
      </Badge>
    )
  }

  if (status === 'completed' && outcome === 'playoff') {
    return <Badge tone="amber">Inconclusivo</Badge>
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
  signalToggle,
  actions,
}: DetailHeaderProps) {
  return (
    <header className="space-y-3">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <Link
          href="/cms/youtube/ab-lab"
          className="inline-flex items-center gap-1 text-xs text-cms-text-muted hover:text-cms-accent transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
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
          <StatusBadge status={status} outcome={outcome} />
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
              <InfoTip text="Confirmado usa dados verificados. Live mostra estimativas em tempo real." />
            </>
          ) : (
            actions
          )}
        </div>
      </div>

      {/* Title */}
      <h2 className="text-xl font-semibold text-cms-text leading-tight">{title}</h2>
    </header>
  )
}
