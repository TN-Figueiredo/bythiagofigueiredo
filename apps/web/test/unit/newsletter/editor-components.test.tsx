import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContextualBanner } from '@/app/cms/(authed)/newsletters/_components/contextual-banner'

describe('ContextualBanner', () => {
  it('renders ephemeral hint for null status', () => {
    render(<ContextualBanner status={null} scheduledAt={null} sendProgress={null} errorMessage={null} />)
    expect(screen.getByText(/will be created when you start typing/)).toBeTruthy()
  })

  it('renders schedule countdown for scheduled status', () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString()
    render(<ContextualBanner status="scheduled" scheduledAt={future} sendProgress={null} errorMessage={null} />)
    expect(screen.getByText(/Scheduled for/)).toBeTruthy()
  })

  it('renders sending progress', () => {
    render(<ContextualBanner status="sending" scheduledAt={null} sendProgress={{ sent: 84, total: 120 }} errorMessage={null} />)
    expect(screen.getByText(/84 \/ 120 sent/)).toBeTruthy()
  })

  it('renders error banner for failed status', () => {
    render(<ContextualBanner status="failed" scheduledAt={null} sendProgress={null} errorMessage="SMTP timeout" />)
    expect(screen.getByText(/SMTP timeout/)).toBeTruthy()
  })

  it('renders nothing for draft status', () => {
    const { container } = render(<ContextualBanner status="draft" scheduledAt={null} sendProgress={null} errorMessage={null} />)
    expect(container.firstChild).toBeNull()
  })
})
