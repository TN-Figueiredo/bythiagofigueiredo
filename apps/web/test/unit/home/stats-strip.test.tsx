import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StatsStrip } from '../../../src/app/(public)/components/StatsStrip'

describe('StatsStrip', () => {
  it('renders post, video and subscriber counts', () => {
    const { container } = render(
      <StatsStrip postCount={42} videoCount={8} subscriberCount={1427} t={{ 'home.stats.subscribers': 'inscritos', 'home.stats.posts': 'posts', 'home.stats.videos': 'vídeos' }} />
    )
    expect(container.textContent).toContain('42')
    expect(container.textContent).toContain('posts')
  })

  it('renders nothing when all counts are 0', () => {
    const { container } = render(
      <StatsStrip postCount={0} videoCount={0} subscriberCount={0} t={{ 'home.stats.subscribers': 'subs', 'home.stats.posts': 'posts', 'home.stats.videos': 'videos' }} />
    )
    expect(container.firstChild).toBeNull()
  })
})
