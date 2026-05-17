'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getVideoTestHistory } from '../actions'

interface AbVideoHistoryProps {
  youtubeVideoId: string
  currentTestId?: string
}

const typeLabels: Record<string, string> = {
  thumbnail: 'Thumb',
  title: 'Título',
  description: 'Desc',
  combo: 'Combo',
}

const typeBadgeColors: Record<string, string> = {
  thumbnail: 'bg-blue-500/20 text-blue-400',
  title: 'bg-green-500/20 text-green-400',
  description: 'bg-purple-500/20 text-purple-400',
  combo: 'bg-orange-500/20 text-orange-400',
}

const statusIcons: Record<string, string> = {
  active: '🟢',
  paused: '🟡',
  completed: '✅',
  draft: '📝',
  archived: '📦',
}

export function AbVideoHistory({ youtubeVideoId, currentTestId }: AbVideoHistoryProps) {
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getVideoTestHistory>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getVideoTestHistory(youtubeVideoId).then(data => {
      setHistory(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [youtubeVideoId])

  const pastTests = history.filter(t => t.id !== currentTestId)

  if (loading) return null
  if (pastTests.length === 0) return null

  return (
    <section className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-5 space-y-3">
      <h3 className="text-sm font-semibold text-cms-text">Histórico de Testes</h3>
      <div className="space-y-2">
        {pastTests.map(t => (
          <Link
            key={t.id}
            href={`/cms/youtube/ab-lab/${t.id}`}
            className="flex items-center justify-between p-3 rounded-[var(--cms-radius)] bg-cms-surface-hover border border-cms-border hover:border-cms-accent/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs">{statusIcons[t.status] ?? ''}</span>
              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${typeBadgeColors[t.test_type] ?? 'bg-cms-surface-hover text-cms-text-muted'}`}>
                {typeLabels[t.test_type] ?? t.test_type}
              </span>
              <span className="text-sm text-cms-text">{t.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {t.ctr_lift_percent !== null && (
                <span className={`text-xs font-medium ${t.ctr_lift_percent > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {t.ctr_lift_percent > 0 ? '+' : ''}{t.ctr_lift_percent}%
                </span>
              )}
              {t.confidence_at_completion !== null && (
                <span className="text-[10px] text-cms-text-muted">
                  {Math.round(t.confidence_at_completion * 100)}% conf
                </span>
              )}
              {t.completed_at && (
                <span className="text-[10px] text-cms-text-dim">
                  {new Date(t.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
