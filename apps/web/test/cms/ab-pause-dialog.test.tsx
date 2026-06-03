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
    TrendingDown: icon('TrendingDown'), X: icon('X'),
  }
})

vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  pauseAbTest: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

// Mock YtPortal to render children directly (no createPortal in test env)
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock useModalFocusTrap (no-op in tests)
vi.mock('@/app/cms/(authed)/_shared/editor/use-modal-focus-trap', () => ({
  useModalFocusTrap: vi.fn(),
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
  it('renders with "Pausar teste" title', () => {
    render(<AbPauseDialog testId={mockTest.id} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Pausar teste' })).toBeTruthy()
  })

  it('shows explanation text about restoring original thumbnail', () => {
    render(<AbPauseDialog testId={mockTest.id} onClose={vi.fn()} />)
    expect(screen.getByText(/restaurar a thumbnail original/)).toBeTruthy()
    expect(screen.getByText(/dados coletados ficam preservados/)).toBeTruthy()
    expect(screen.getByText(/retomar a qualquer momento/)).toBeTruthy()
  })

  it('cancel button calls onClose', () => {
    const onClose = vi.fn()
    render(<AbPauseDialog testId={mockTest.id} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Pausar teste button renders', () => {
    render(<AbPauseDialog testId={mockTest.id} onClose={vi.fn()} />)
    const buttons = screen.getAllByText('Pausar teste')
    const pauseButton = buttons.find((el) => el.tagName === 'BUTTON')
    expect(pauseButton).toBeTruthy()
  })

  it('clicking backdrop calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(<AbPauseDialog testId={mockTest.id} onClose={onClose} />)
    const backdrop = container.querySelector('[aria-hidden="true"]')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
