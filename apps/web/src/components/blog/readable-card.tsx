'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { ReadProgressStore } from '@/lib/tracking/read-progress-store'
import { READ_INDICATORS_ENABLED, READ_COMPLETE_THRESHOLD } from '@/lib/tracking/config'

type Props = {
  postId: string
  children: ReactNode
  dimTitle?: boolean
}

export function ReadableCard({ postId, children, dimTitle = true }: Props) {
  const [depth, setDepth] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!READ_INDICATORS_ENABLED) return
    const store = new ReadProgressStore()
    const p = store.getProgress(postId)
    if (p) setDepth(p.depth)
    setMounted(true)
  }, [postId])

  const isRead = depth >= READ_COMPLETE_THRESHOLD
  const hasProgress = depth > 0
  const isInProgress = hasProgress && !isRead

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          opacity: mounted ? 1 : 0,
          transition: 'opacity 200ms',
        }}
      >
        {isRead && (
          <div
            data-testid="read-badge"
            className="font-mono"
            style={{
              position: 'absolute',
              top: 24,
              right: 12,
              zIndex: 10,
              background: 'rgba(0,0,0,0.75)',
              color: '#8eda8e',
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 2,
              letterSpacing: '0.05em',
              pointerEvents: 'none',
            }}
          >
            ✓ lido
          </div>
        )}
        {isInProgress && (
          <div
            data-testid="progress-badge"
            className="font-mono"
            style={{
              position: 'absolute',
              top: 24,
              right: 12,
              zIndex: 10,
              background: 'rgba(0,0,0,0.75)',
              color: '#ccc',
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 2,
              letterSpacing: '0.05em',
              pointerEvents: 'none',
            }}
          >
            {Math.round(depth)}%
          </div>
        )}
      </div>
      <div style={isRead && dimTitle ? { opacity: 0.6 } : undefined}>
        {children}
      </div>
      <div
        style={{
          opacity: mounted ? 1 : 0,
          transition: 'opacity 200ms',
        }}
      >
        {hasProgress && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background: 'var(--pb-line, #332D25)',
            }}
          >
            <div
              data-testid="read-bar"
              style={{
                width: `${Math.min(depth, 100)}%`,
                height: '100%',
                background: 'var(--pb-yt, #FF3333)',
                borderRadius: depth < 100 ? '0 2px 2px 0' : undefined,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
