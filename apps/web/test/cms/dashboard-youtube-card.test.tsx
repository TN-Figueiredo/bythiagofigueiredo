// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardYoutubeCard } from '@/app/cms/(authed)/_components/dashboard-youtube-card'

describe('DashboardYoutubeCard', () => {
  it('o título diz de qual canal são os números', () => {
    render(
      <DashboardYoutubeCard
        data={{
          channelName: 'Thiago Figueiredo', healthScore: 60, views30d: 10, viewsDelta: 1, subscribers: 0, subsNet: 2,
          ctr: 1, avgPercentage: 40, milestoneTarget: null, milestoneAway: null, activeAbTest: null,
        }}
      />,
    )
    expect(screen.getByRole('heading', { name: 'YouTube · Thiago Figueiredo' })).toBeTruthy()
  })
})
