'use client'

import { useRef, useEffect } from 'react'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'
import { AudioCard } from './audio-card'

interface AudioGridV2Props {
  assets: AudioAssetRow[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function AudioGridV2({ assets, selectedId, onSelect }: AudioGridV2Props) {
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!gridRef.current) return
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          el.style.animationPlayState = 'running'
          observer.unobserve(el)
        }
      }
    }, { threshold: 0.1 })

    const cards = gridRef.current.querySelectorAll('[data-card-animate]')
    cards.forEach(card => observer.observe(card))
    return () => observer.disconnect()
  }, [assets])

  if (assets.length === 0) return null

  return (
    <div
      ref={gridRef}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 340px))',
        gap: 14,
      }}
    >
      {assets.map((asset, i) => (
        <div
          key={asset.id}
          data-card-animate
          style={{
            animation: 'fade-in-up 0.3s ease-out both',
            animationDelay: `${Math.min(i * 30, 300)}ms`,
            animationPlayState: 'paused',
          }}
        >
          <AudioCard
            asset={asset}
            selected={asset.id === selectedId}
            onSelect={onSelect}
          />
        </div>
      ))}
    </div>
  )
}
