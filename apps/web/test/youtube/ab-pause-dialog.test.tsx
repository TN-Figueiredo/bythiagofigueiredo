import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers'),
    Lock: icon('Lock'), Plus: icon('Plus'), Trash2: icon('Trash2'), Sparkles: icon('Sparkles'),
    CheckCircle: icon('CheckCircle'), Play: icon('Play'), ChevronDown: icon('ChevronDown'),
    ChevronRight: icon('ChevronRight'), ArrowLeft: icon('ArrowLeft'), Copy: icon('Copy'),
    Download: icon('Download'), Pause: icon('Pause'), Square: icon('Square'),
    LayoutGrid: icon('LayoutGrid'), Search: icon('Search'), ListVideo: icon('ListVideo'),
    Smartphone: icon('Smartphone'), Trophy: icon('Trophy'), TrendingUp: icon('TrendingUp'),
    TrendingDown: icon('TrendingDown'),
  }
})

vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  pauseAbTest: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { AbPauseDialog } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-pause-dialog'

const mockTest = {
  id: 'test-123',
  config: { confidence_threshold: 0.95 },
  variants: [
    { id: 'v1', label: 'A', is_original: true, blob_url: null },
    { id: 'v2', label: 'B', is_original: false, blob_url: 'https://example.com/thumb.jpg' },
  ],
} as any

describe('AbPauseDialog', () => {
  it('renders with "Pause Test" title', () => {
    render(<AbPauseDialog test={mockTest} onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Pause Test' })).toBeTruthy()
  })

  it('shows explanation text about restoring original thumbnail', () => {
    render(<AbPauseDialog test={mockTest} onClose={vi.fn()} />)
    expect(screen.getByText('Pausing will restore the original thumbnail immediately.')).toBeTruthy()
    expect(screen.getByText(/All collected data is preserved/)).toBeTruthy()
    expect(screen.getByText(/You can resume at any time/)).toBeTruthy()
  })

  it('cancel button calls onClose', () => {
    const onClose = vi.fn()
    render(<AbPauseDialog test={mockTest} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('escape key calls onClose', () => {
    const onClose = vi.fn()
    render(<AbPauseDialog test={mockTest} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Pause Test button renders', () => {
    render(<AbPauseDialog test={mockTest} onClose={vi.fn()} />)
    // There's the title "Pause Test" and the button "Pause Test"
    const buttons = screen.getAllByText('Pause Test')
    const pauseButton = buttons.find((el) => el.tagName === 'BUTTON')
    expect(pauseButton).toBeTruthy()
  })

  it('clicking backdrop calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(<AbPauseDialog test={mockTest} onClose={onClose} />)
    const backdrop = container.querySelector('[aria-hidden="true"]')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
