'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { ChannelLearningsData, LearningsData, LearningsTag } from '@/lib/youtube/ab-types'

export interface LearningsPanelProps {
  learnings: LearningsData | null
  channelLearnings?: ChannelLearningsData | null
  totalTests?: number
}

function StrengthBar({ wins, maxWins }: { wins: number; maxWins: number }) {
  const segments = 5
  const filled = maxWins > 0 ? Math.round((wins / maxWins) * segments) : 0

  return (
    <div className="flex gap-[3px]" role="meter" aria-valuenow={wins} aria-valuemin={0} aria-valuemax={maxWins}>
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className="rounded-[2px]"
          style={{
            width: 5,
            height: 14,
            background: i < filled ? 'var(--accent)' : 'var(--surface-3, var(--cms-surface-3, #333))',
          }}
        />
      ))}
    </div>
  )
}

function TagRow({ tag, maxWins }: { tag: LearningsTag; maxWins: number }) {
  const isNegative = tag.negative || tag.avgLift < 0

  return (
    <div className="flex items-center gap-[10px]">
      <span
        className="flex-1 text-[13px] min-w-0 truncate"
        style={{
          color: isNegative ? 'var(--ink-faint, var(--cms-text-dim))' : 'var(--ink, var(--cms-text))',
          textDecoration: isNegative ? 'line-through' : 'none',
        }}
      >
        {tag.tag}
      </span>
      <StrengthBar wins={tag.wins} maxWins={maxWins} />
      <span
        className="font-mono text-[12px] font-bold w-[44px] text-right"
        style={{ color: isNegative ? 'var(--cms-red, #ef4444)' : 'var(--green, var(--cms-green))' }}
      >
        {tag.avgLift >= 0 ? '+' : ''}{Math.round(tag.avgLift)}%
      </span>
    </div>
  )
}

function LearningsContent({ data }: { data: LearningsData }) {
  const maxWins = Math.max(...data.tags.map(t => t.wins), 1)

  return (
    <>
      <p className="text-[12px] text-cms-text-dim m-0 mb-[16px]">
        Padrões aprendidos em {data.totalTests} testes. O Cowork usa isso pra sugerir variantes melhores.
      </p>

      {/* Tags */}
      <div className="flex flex-col gap-[9px]">
        {data.tags.map(tag => (
          <TagRow key={tag.tag} tag={tag} maxWins={maxWins} />
        ))}
      </div>

      {/* Insight box */}
      {data.insightText && (
        <div
          className="mt-[16px] py-[12px] px-[14px] rounded-[10px] text-[12px] text-cms-text-dim leading-[1.5]"
          style={{ background: 'var(--accent-soft, rgba(255,130,64,0.08))' }}
        >
          <b className="text-cms-accent">Insight:</b> {data.insightText}
        </div>
      )}
    </>
  )
}

export function LearningsPanel({ learnings, channelLearnings, totalTests = 0 }: LearningsPanelProps) {
  const [activeTab, setActiveTab] = useState<string>('combined')

  if (!learnings) {
    const progress = Math.min(totalTests, 3)
    return (
      <div className="rounded-[14px] p-[20px]" style={{ background: 'var(--cms-surface)', border: '1px solid var(--cms-border, #332D25)' }}>
        <div className="flex flex-col items-center py-4">
          <p className="text-[13px] text-cms-text-dim">
            Coletando dados... ({progress}/3 testes completados)
          </p>
          <div className="mt-2 h-1.5 w-32 rounded-full bg-zinc-700">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${Math.min((totalTests / 3) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  // Only show channel tabs when 2+ channels have enough data
  const showChannelTabs = (channelLearnings?.channels.length ?? 0) >= 2

  // Determine which data to display
  let activeData: LearningsData = learnings
  if (activeTab !== 'combined' && channelLearnings) {
    const channel = channelLearnings.channels.find(c => c.channelId === activeTab)
    if (channel) activeData = channel.learnings
  }

  return (
    <div className="rounded-[14px] p-[20px]" style={{ background: 'var(--cms-surface)', border: '1px solid var(--cms-border, #332D25)' }}>
      {/* Header */}
      <div className="flex items-center gap-[9px] mb-[4px]">
        <Sparkles size={17} className="text-cms-accent" aria-hidden="true" />
        <h3 className="text-[15px] font-semibold text-cms-text m-0">O que já funciona pra você</h3>
      </div>

      {/* Channel tabs */}
      {showChannelTabs && (
        <div className="flex gap-[6px] mt-[12px] mb-[12px] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('combined')}
            className="px-[10px] py-[4px] rounded-[8px] text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors border-0"
            style={{
              background: activeTab === 'combined' ? 'var(--accent)' : 'var(--surface-3, var(--cms-surface-3, #333))',
              color: activeTab === 'combined' ? '#fff' : 'var(--ink-faint, var(--cms-text-dim))',
            }}
          >
            Todos os canais
          </button>
          {channelLearnings!.channels.map(ch => (
            <button
              key={ch.channelId}
              type="button"
              onClick={() => setActiveTab(ch.channelId)}
              className="px-[10px] py-[4px] rounded-[8px] text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors border-0"
              style={{
                background: activeTab === ch.channelId ? 'var(--accent)' : 'var(--surface-3, var(--cms-surface-3, #333))',
                color: activeTab === ch.channelId ? '#fff' : 'var(--ink-faint, var(--cms-text-dim))',
              }}
            >
              {ch.channelName}
            </button>
          ))}
        </div>
      )}

      <LearningsContent data={activeData} />
    </div>
  )
}
