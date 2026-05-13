import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import { PlatformIcon } from '@/app/cms/(authed)/_shared/social/platform-icon'
import { PlatformSelector } from '@/app/cms/(authed)/_shared/social/platform-selector'

describe('SocialStatusBadge', () => {
  it('renders Published in green', () => {
    render(<SocialStatusBadge status="completed" label="Published" />)
    const badge = screen.getByText('Published')
    expect(badge.className).toContain('green')
  })

  it('renders Scheduled in blue', () => {
    render(<SocialStatusBadge status="scheduled" label="Scheduled" />)
    const badge = screen.getByText('Scheduled')
    expect(badge.className).toContain('blue')
  })

  it('renders Failed in red', () => {
    render(<SocialStatusBadge status="failed" label="Failed" />)
    const badge = screen.getByText('Failed')
    expect(badge.className).toContain('red')
  })

  it('renders Draft in yellow', () => {
    render(<SocialStatusBadge status="draft" label="Draft" />)
    const badge = screen.getByText('Draft')
    expect(badge.className).toContain('yellow')
  })
})

describe('PlatformIcon', () => {
  it('renders YouTube icon', () => {
    render(<PlatformIcon provider="youtube" />)
    expect(screen.getByTitle('YouTube')).toBeDefined()
  })

  it('renders Bluesky icon', () => {
    render(<PlatformIcon provider="bluesky" />)
    expect(screen.getByTitle('Bluesky')).toBeDefined()
  })
})

describe('PlatformSelector', () => {
  it('renders all 4 platform chips', () => {
    render(
      <PlatformSelector
        selected={['facebook', 'instagram']}
        onChange={() => {}}
        connections={[
          { provider: 'youtube', account_name: 'Ch1' },
          { provider: 'facebook', account_name: 'Page1' },
          { provider: 'instagram', account_name: '@ig' },
          { provider: 'bluesky', account_name: '@bs' },
        ]}
      />
    )
    expect(screen.getByText('YouTube')).toBeDefined()
    expect(screen.getByText('Facebook')).toBeDefined()
    expect(screen.getByText('Instagram')).toBeDefined()
    expect(screen.getByText('Bluesky')).toBeDefined()
  })

  it('highlights selected platforms', () => {
    render(
      <PlatformSelector
        selected={['facebook']}
        onChange={() => {}}
        connections={[{ provider: 'facebook', account_name: 'P' }]}
      />
    )
    const fb = screen.getByText('Facebook').closest('button')!
    expect(fb.className).toContain('ring')
  })
})
