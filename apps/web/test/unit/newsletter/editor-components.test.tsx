import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { ContextualBanner } from '@/app/cms/(authed)/newsletters/_components/contextual-banner'
import { MoreMenu } from '@/app/cms/(authed)/newsletters/_components/more-menu'
import { TypeSelector } from '@/app/cms/(authed)/newsletters/_components/type-selector'
import { StatsStrip } from '@/app/cms/(authed)/newsletters/_components/stats-strip'
import { AutosaveIndicator } from '@/app/cms/(authed)/newsletters/_components/autosave-indicator'

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

describe('MoreMenu', () => {
  it('shows draft menu items on click', () => {
    const noop = vi.fn()
    render(<MoreMenu status="draft" onSendTest={noop} onDuplicate={noop} onSendNow={noop} onDelete={noop} />)
    fireEvent.click(screen.getByTitle('More actions'))
    expect(screen.getByText('Send Test Email')).toBeTruthy()
    expect(screen.getByText('Duplicate')).toBeTruthy()
    expect(screen.getByText('Send Now...')).toBeTruthy()
    expect(screen.getByText('Delete')).toBeTruthy()
  })

  it('shows sent menu items without delete', () => {
    render(<MoreMenu status="sent" onDuplicate={vi.fn()} webArchiveUrl="/newsletter/archive/123" />)
    fireEvent.click(screen.getByTitle('More actions'))
    expect(screen.getByText('Duplicate as New Draft')).toBeTruthy()
    expect(screen.getByText('View Web Archive')).toBeTruthy()
    expect(screen.queryByText('Delete')).toBeNull()
  })
})

describe('TypeSelector', () => {
  const types = [
    { id: 'type-1', name: 'Weekly Digest', color: '#ea580c' },
    { id: 'type-2', name: 'Product Updates', color: '#22c55e' },
  ]

  it('renders current type name', () => {
    render(<TypeSelector types={types} selectedTypeId="type-1" onChange={vi.fn()} />)
    expect(screen.getByText('Weekly Digest')).toBeTruthy()
  })

  it('shows all types on click', () => {
    render(<TypeSelector types={types} selectedTypeId="type-1" onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Product Updates')).toBeTruthy()
  })

  it('renders "No type" when null', () => {
    render(<TypeSelector types={types} selectedTypeId={null} onChange={vi.fn()} />)
    expect(screen.getByText('No type')).toBeTruthy()
  })
})

describe('StatsStrip', () => {
  it('renders sent stats', () => {
    render(<StatsStrip stats={{ delivered: 118, openRate: 64, clickRate: 12, bounces: 2 }} variant="sent" />)
    expect(screen.getByText('118')).toBeTruthy()
    expect(screen.getByText('64%')).toBeTruthy()
    expect(screen.getByText('12%')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('renders failed stats with pending', () => {
    render(<StatsStrip stats={{ delivered: 84, pending: 36, openRate: 42 }} variant="failed" />)
    expect(screen.getByText('84')).toBeTruthy()
    expect(screen.getByText('36')).toBeTruthy()
    expect(screen.getByText('42%')).toBeTruthy()
  })
})

describe('AutosaveIndicator', () => {
  it('shows saving state', () => {
    render(<AutosaveIndicator state="saving" lastSavedAt={null} />)
    expect(screen.getByText('Saving...')).toBeTruthy()
  })

  it('shows saved state with timestamp', () => {
    const now = new Date()
    render(<AutosaveIndicator state="saved" lastSavedAt={now} />)
    expect(screen.getByText(/Saved/)).toBeTruthy()
  })

  it('shows error with retry button', () => {
    const retry = vi.fn()
    render(<AutosaveIndicator state="error" lastSavedAt={null} onRetry={retry} />)
    const btn = screen.getByText(/retry/)
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    expect(retry).toHaveBeenCalledOnce()
  })

  it('shows offline state', () => {
    render(<AutosaveIndicator state="offline" lastSavedAt={null} />)
    expect(screen.getByText(/Offline/)).toBeTruthy()
  })
})
