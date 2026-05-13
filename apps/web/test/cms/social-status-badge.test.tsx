import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('renders Publishing in blue with pulse', () => {
    render(<SocialStatusBadge status="publishing" label="Publishing" />)
    const badge = screen.getByText('Publishing')
    expect(badge.className).toContain('blue')
    expect(badge.className).toContain('pulse')
  })

  it('renders Partial Failure in orange', () => {
    render(<SocialStatusBadge status="partial_failure" label="Partial Failure" />)
    const badge = screen.getByText('Partial Failure')
    expect(badge.className).toContain('orange')
  })

  it('renders Cancelled in gray', () => {
    render(<SocialStatusBadge status="cancelled" label="Cancelled" />)
    const badge = screen.getByText('Cancelled')
    expect(badge.className).toContain('gray')
  })

  it('renders Pending in gray', () => {
    render(<SocialStatusBadge status="pending" label="Pending" />)
    const badge = screen.getByText('Pending')
    expect(badge.className).toContain('gray')
  })

  it('renders Retrying in orange with pulse', () => {
    render(<SocialStatusBadge status="retrying" label="Retrying" />)
    const badge = screen.getByText('Retrying')
    expect(badge.className).toContain('orange')
    expect(badge.className).toContain('pulse')
  })

  it('renders Skipped in gray', () => {
    render(<SocialStatusBadge status="skipped" label="Skipped" />)
    const badge = screen.getByText('Skipped')
    expect(badge.className).toContain('gray')
  })

  it('renders Queued in purple', () => {
    render(<SocialStatusBadge status="queued" label="Queued" />)
    const badge = screen.getByText('Queued')
    expect(badge.className).toContain('purple')
  })

  it('renders published (delivery status) in green', () => {
    render(<SocialStatusBadge status="published" label="Published" />)
    const badge = screen.getByText('Published')
    expect(badge.className).toContain('green')
  })

  it('applies custom className', () => {
    render(<SocialStatusBadge status="draft" label="Draft" className="my-custom" />)
    const badge = screen.getByText('Draft')
    expect(badge.className).toContain('my-custom')
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

  it('renders Facebook icon', () => {
    render(<PlatformIcon provider="facebook" />)
    expect(screen.getByTitle('Facebook')).toBeDefined()
  })

  it('renders Instagram icon', () => {
    render(<PlatformIcon provider="instagram" />)
    expect(screen.getByTitle('Instagram')).toBeDefined()
  })

  it('applies size class for sm', () => {
    render(<PlatformIcon provider="youtube" size="sm" />)
    const icon = screen.getByTitle('YouTube')
    expect(icon.className).toContain('text-sm')
  })

  it('applies size class for lg', () => {
    render(<PlatformIcon provider="youtube" size="lg" />)
    const icon = screen.getByTitle('YouTube')
    expect(icon.className).toContain('text-2xl')
  })
})

describe('PlatformSelector', () => {
  const allConnections = [
    { provider: 'youtube' as const, account_name: 'Ch1' },
    { provider: 'facebook' as const, account_name: 'Page1' },
    { provider: 'instagram' as const, account_name: '@ig' },
    { provider: 'bluesky' as const, account_name: '@bs' },
  ]

  it('renders all 4 platform chips', () => {
    render(
      <PlatformSelector
        selected={['facebook', 'instagram']}
        onChange={() => {}}
        connections={allConnections}
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

  it('calls onChange with provider added when clicking unselected platform', () => {
    const onChange = vi.fn()
    render(
      <PlatformSelector
        selected={['facebook']}
        onChange={onChange}
        connections={allConnections}
      />
    )
    fireEvent.click(screen.getByText('Instagram'))
    expect(onChange).toHaveBeenCalledWith(['facebook', 'instagram'])
  })

  it('calls onChange with provider removed when clicking selected platform', () => {
    const onChange = vi.fn()
    render(
      <PlatformSelector
        selected={['facebook', 'instagram']}
        onChange={onChange}
        connections={allConnections}
      />
    )
    fireEvent.click(screen.getByText('Facebook'))
    expect(onChange).toHaveBeenCalledWith(['instagram'])
  })

  it('does not call onChange when clicking disabled platform', () => {
    const onChange = vi.fn()
    render(
      <PlatformSelector
        selected={[]}
        onChange={onChange}
        connections={allConnections}
        disabled={['youtube']}
        disabledReason={{ youtube: 'Video mode only' }}
      />
    )
    fireEvent.click(screen.getByText('YouTube'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('sets aria-pressed correctly', () => {
    render(
      <PlatformSelector
        selected={['bluesky']}
        onChange={() => {}}
        connections={allConnections}
      />
    )
    const bsButton = screen.getByText('Bluesky').closest('button')!
    expect(bsButton.getAttribute('aria-pressed')).toBe('true')
    const fbButton = screen.getByText('Facebook').closest('button')!
    expect(fbButton.getAttribute('aria-pressed')).toBe('false')
  })
})
