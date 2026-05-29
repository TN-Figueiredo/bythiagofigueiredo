'use client'

import { useState } from 'react'
import { Seg, Badge } from './ab-primitives'
import { HomeCard, SearchRow, SidebarRow, MobilePhone } from './context-renderers'
import { BehaviorStrip } from './behavior-strip'
import { FeedView } from './feed-view'
import { LayoutGrid, Search, ListVideo, Smartphone, Trophy, TrendingUp } from 'lucide-react'
import type { ClickMomentVariant } from '@/lib/youtube/ab-wizard-adapter'
import type { DisplayLabel } from '@/lib/youtube/ab-types'

type Mode = 'compare' | 'feed'
type Context = 'home' | 'search' | 'sidebar' | 'mobile'

interface ClickMomentProps {
  variants: ClickMomentVariant[]
  leaderId?: string
  winnerId?: string
}

const CONTEXT_BUTTONS: Array<{ ctx: Context; icon: typeof LayoutGrid; label: string }> = [
  { ctx: 'home', icon: LayoutGrid, label: 'Home' },
  { ctx: 'search', icon: Search, label: 'Search' },
  { ctx: 'sidebar', icon: ListVideo, label: 'Sidebar' },
  { ctx: 'mobile', icon: Smartphone, label: 'Mobile' },
]

const GRID_CLASSES: Record<Context, string> = {
  home: 'grid-cols-1 md:grid-cols-2',
  search: 'grid-cols-1',
  sidebar: 'grid-cols-1',
  mobile: 'grid-cols-[repeat(auto-fit,minmax(300px,1fr))]',
}

function ContextRenderer({ context, ...props }: { context: Context } & React.ComponentProps<typeof HomeCard>) {
  switch (context) {
    case 'home': return <HomeCard {...props} />
    case 'search': return <SearchRow {...props} />
    case 'sidebar': return <SidebarRow {...props} />
    case 'mobile': return <MobilePhone {...props} />
  }
}

export function ClickMoment({ variants, leaderId, winnerId }: ClickMomentProps) {
  const [mode, setMode] = useState<Mode>('compare')
  const [context, setContext] = useState<Context>('home')

  const maxCtr = Math.max(...variants.map(v => v.ctr), 0.01)
  const baseline = variants.find(v => v.label === 'A')

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2
          className="text-lg italic text-cms-text"
          style={{ fontFamily: 'var(--font-fraunces, serif)' }}
        >
          The click moment
        </h2>
        <Seg<Mode>
          options={['compare', 'feed'] as const}
          value={mode}
          onChange={setMode}
          labels={{ compare: 'Compare', feed: 'Feed' }}
          aria-label="View mode"
        />
      </div>

      {mode === 'compare' && (
        <>
          {/* Context switcher */}
          <div className="flex gap-1" role="radiogroup" aria-label="YouTube context">
            {CONTEXT_BUTTONS.map(({ ctx, icon: Icon, label }) => {
              const active = ctx === context
              return (
                <button
                  key={ctx}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={label}
                  onClick={() => setContext(ctx)}
                  className={[
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cms-accent',
                    active
                      ? 'bg-cms-accent/10 border-cms-accent text-cms-accent'
                      : 'border-cms-border bg-cms-surface text-cms-text-muted hover:text-cms-text',
                  ].join(' ')}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              )
            })}
          </div>

          {/* Compare grid */}
          <div className={`grid gap-4 ${GRID_CLASSES[context]}`}>
            {variants.map(v => {
              const isWinner = v.label === winnerId
              const isLeader = v.label === leaderId || v.isLeader
              const rendererProps = {
                thumbUrl: v.thumbUrl ?? undefined,
                thumbBg: v.thumbBg,
                title: v.title,
                channelName: 'Your Channel',
                views: '10K views',
                age: '2 days ago',
                duration: '12:34',
                label: isWinner ? 'Winner' : isLeader ? 'Leader' : undefined,
              }
              const borderColor = isWinner
                ? 'var(--cms-green, #22c55e)'
                : isLeader
                  ? 'var(--cms-amber, #f59e0b)'
                  : undefined

              return (
                <div
                  key={v.label}
                  className="rounded-xl border border-cms-border bg-cms-card p-3 space-y-3 transition-shadow duration-200"
                  style={
                    borderColor
                      ? { borderColor, boxShadow: `0 0 8px 1px ${borderColor}33` }
                      : undefined
                  }
                >
                  <ContextRenderer context={context} {...rendererProps} />

                  <BehaviorStrip
                    label={v.label}
                    color={v.color}
                    ctr={v.ctr}
                    maxCtr={maxCtr}
                    isLeader={v.label === leaderId || v.isLeader}
                    isBaseline={v.label === ('A' as DisplayLabel)}
                    delta={baseline ? ((v.ctr - baseline.ctr) / (baseline.ctr || 1)) * 100 : undefined}
                  />

                  {(isWinner || isLeader) && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {isWinner ? (
                        <Badge tone="green" className="gap-1">
                          <Trophy size={10} aria-hidden="true" />
                          Winner
                        </Badge>
                      ) : (
                        <Badge tone="amber" className="gap-1">
                          <TrendingUp size={10} aria-hidden="true" />
                          Leader
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {mode === 'feed' && <FeedView variants={variants} />}
    </section>
  )
}
