// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { aggregateTags } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { LearningsPanel } from '@/app/cms/(authed)/youtube/ab-lab/_components/learnings-panel'
import type { LearningsData } from '@/lib/youtube/ab-types'

describe('aggregateTags com lift ausente', () => {
  it('avgLift é null (nunca 0) quando nenhuma vitória tem lift medido', () => {
    const winners = [{ id: 'v1', metadata: { thumbnail_tags: ['rosto'] } }]
    const tests = [{ id: 't1', winner_variant_id: 'v1', result_metadata: null, test_type: 'thumbnail' }]
    const [tag] = aggregateTags(winners, tests as never)
    expect(tag.wins).toBe(1)
    expect(tag.avgLift).toBeNull()
    expect(tag.negative).toBeUndefined()
  })

  it('média usa só os lifts medidos', () => {
    const winners = [
      { id: 'v1', metadata: { thumbnail_tags: ['rosto'] } },
      { id: 'v2', metadata: { thumbnail_tags: ['rosto'] } },
    ]
    const tests = [
      { id: 't1', winner_variant_id: 'v1', result_metadata: { ctr_lift_percent: 10 }, test_type: 'thumbnail' },
      { id: 't2', winner_variant_id: 'v2', result_metadata: null, test_type: 'thumbnail' },
    ]
    expect(aggregateTags(winners, tests as never)[0].avgLift).toBe(10)
  })
})

describe('LearningsPanel com avgLift null', () => {
  it('não mostra número nem +0%', () => {
    const data: LearningsData = {
      tags: [{ tag: 'rosto', wins: 3, avgLift: null, kind: 'thumb' }],
      totalTests: 3,
      insightText: '',
    }
    const { container } = render(<LearningsPanel learnings={data} />)
    expect(container.textContent).toContain('rosto')
    expect(container.textContent).not.toMatch(/\+?0%/)
    expect(container.textContent).not.toMatch(/NaN/)
  })
})
