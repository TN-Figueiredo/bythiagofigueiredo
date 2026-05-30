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
  endAbTest: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { AbEndTestDialog } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-end-test-dialog'

const mockTest = {
  id: 'test-123',
  config: { confidence_threshold: 0.95 },
  variants: [
    { id: 'v1', label: 'A', is_original: true, blob_url: null },
    { id: 'v2', label: 'B', is_original: false, blob_url: 'https://example.com/thumb.jpg' },
  ],
} as any

describe('AbEndTestDialog', () => {
  it('renders with "End Test" title', () => {
    render(<AbEndTestDialog test={mockTest} onClose={vi.fn()} />)
    expect(screen.getByText('End Test')).toBeTruthy()
  })

  it('shows 3 radio options: Apply leading, Keep original, Archive', () => {
    render(<AbEndTestDialog test={mockTest} onClose={vi.fn()} />)
    expect(screen.getByText('Apply leading variant')).toBeTruthy()
    expect(screen.getByText('Keep original')).toBeTruthy()
    expect(screen.getByText('Archive without applying')).toBeTruthy()
  })

  it('"Apply leading" is selected by default', () => {
    render(<AbEndTestDialog test={mockTest} onClose={vi.fn()} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const leadingRadio = radios.find((r) => r.value === 'leading')!
    expect(leadingRadio.checked).toBe(true)
  })

  it('clicking option changes selection', () => {
    render(<AbEndTestDialog test={mockTest} onClose={vi.fn()} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const archiveRadio = radios.find((r) => r.value === 'archive')!
    fireEvent.click(archiveRadio)
    expect(archiveRadio.checked).toBe(true)
  })

  it('confirm button shows "Apply & End" for leading option', () => {
    render(<AbEndTestDialog test={mockTest} onClose={vi.fn()} />)
    expect(screen.getByText('Apply & End')).toBeTruthy()
  })

  it('confirm button shows "Keep Original & End" for original option', () => {
    render(<AbEndTestDialog test={mockTest} onClose={vi.fn()} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const originalRadio = radios.find((r) => r.value === 'original')!
    fireEvent.click(originalRadio)
    expect(screen.getByText('Keep Original & End')).toBeTruthy()
  })

  it('confirm button shows "Archive Test" for archive option', () => {
    render(<AbEndTestDialog test={mockTest} onClose={vi.fn()} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const archiveRadio = radios.find((r) => r.value === 'archive')!
    fireEvent.click(archiveRadio)
    expect(screen.getByText('Archive Test')).toBeTruthy()
  })

  it('cancel button calls onClose', () => {
    const onClose = vi.fn()
    render(<AbEndTestDialog test={mockTest} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('escape key calls onClose', () => {
    const onClose = vi.fn()
    render(<AbEndTestDialog test={mockTest} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking backdrop calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(<AbEndTestDialog test={mockTest} onClose={onClose} />)
    const backdrop = container.querySelector('[aria-hidden="true"]')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
