import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StatsStrip } from '../../../src/app/(public)/components/StatsStrip'

describe('StatsStrip', () => {
  it('renders post, video and subscriber counts', () => {
    const { container } = render(
      <StatsStrip postCount={42} videoCount={8} subscriberCount={1427} locale="pt-BR" t={{ 'home.stats.subscribers': 'inscritos', 'home.stats.posts': 'posts', 'home.stats.youtube': 'no YouTube' }} />
    )
    expect(container.textContent).toContain('42')
    expect(container.textContent).toContain('posts')
  })

  it('renders nothing when all counts are 0', () => {
    const { container } = render(
      <StatsStrip postCount={0} videoCount={0} subscriberCount={0} locale="en" t={{ 'home.stats.subscribers': 'subs', 'home.stats.posts': 'posts', 'home.stats.youtube': 'on YouTube' }} />
    )
    expect(container.firstChild).toBeNull()
  })
})
