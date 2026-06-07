// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'

import { VariantTable } from '@/app/cms/(authed)/youtube/ab-lab/_components/variant-table'
import { EarlyVariantTable } from '@/app/cms/(authed)/youtube/ab-lab/_components/early-variant-table'
import type { FullChartVariant, VariantThumb } from '@/lib/youtube/ab-types'

afterEach(() => cleanup())

const ORIGINAL = 'Sukhumvit Road: Um mergulho profundo na rua mais selvagem de Bangkok'

function variant(label: 'A' | 'B' | 'C' | 'D', pBest: number): FullChartVariant {
  return { label, color: '#fff', ctr: 0, impressions: 0, clicks: 0, pBest, pTop2: 0 }
}

function thumb(label: 'A' | 'B' | 'C' | 'D', titleText: string | null, isOriginal = false): VariantThumb {
  return { label, color: '#fff', thumbUrl: null, isOriginal, titleText }
}

describe('VariantTable — per-variant title', () => {
  it('renders each variant own title, not the parent video title for all', () => {
    const variants: FullChartVariant[] = [
      variant('A', 0.4),
      variant('B', 0.3),
      variant('C', 0.2),
      variant('D', 0.1),
    ]
    const thumbs: VariantThumb[] = [
      thumb('A', null, true), // original → falls back to videoTitle
      thumb('B', 'Bangkok antes da cidade acordar'),
      thumb('C', 'Uma manhã sozinho em Bangkok'),
      thumb('D', 'O coco de R$13,65 e a melhor manhã em Bangkok'),
    ]

    render(
      <VariantTable variants={variants} metric="pBest" thumbs={thumbs} videoTitle={ORIGINAL} />,
    )

    // Each distinct variant title must be on screen
    expect(screen.getByText('Bangkok antes da cidade acordar')).toBeTruthy()
    expect(screen.getByText('Uma manhã sozinho em Bangkok')).toBeTruthy()
    expect(screen.getByText('O coco de R$13,65 e a melhor manhã em Bangkok')).toBeTruthy()

    // Original (A) shows the parent title exactly once (not 4x)
    const originalMatches = screen.getAllByText((_content, node) => node?.textContent === `${ORIGINAL} · original`)
    expect(originalMatches.length).toBe(1)
  })
})

describe('EarlyVariantTable — per-variant title', () => {
  it('renders each variant own title in the early (no-data) state', () => {
    render(
      <EarlyVariantTable
        videoTitle={ORIGINAL}
        variants={[
          { label: 'A', color: '#fff', thumbUrl: null, titleText: null, isOriginal: true },
          { label: 'B', color: '#fff', thumbUrl: null, titleText: 'Bangkok antes da cidade acordar', isOriginal: false },
          { label: 'C', color: '#fff', thumbUrl: null, titleText: 'Uma manhã sozinho em Bangkok', isOriginal: false },
        ]}
      />,
    )
    expect(screen.getByText('Bangkok antes da cidade acordar')).toBeTruthy()
    expect(screen.getByText('Uma manhã sozinho em Bangkok')).toBeTruthy()
    // Original (titleText null) falls back to the video title
    expect(screen.getByText(ORIGINAL)).toBeTruthy()
  })
})
