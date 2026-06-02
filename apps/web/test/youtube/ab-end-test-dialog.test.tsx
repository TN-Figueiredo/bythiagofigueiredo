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
  endAbTest: vi.fn().mockResolvedValue(undefined),
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
  it('renders with "Encerrar teste" title', () => {
    render(<AbEndTestDialog testId={mockTest.id} variants={mockTest.variants} confidenceThreshold={mockTest.config.confidence_threshold} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Encerrar teste' })).toBeTruthy()
  })

  it('shows 3 radio options', () => {
    render(<AbEndTestDialog testId={mockTest.id} variants={mockTest.variants} confidenceThreshold={mockTest.config.confidence_threshold} onClose={vi.fn()} />)
    expect(screen.getByText('Aplicar variante lider')).toBeTruthy()
    expect(screen.getByText('Manter original')).toBeTruthy()
    expect(screen.getByText('Arquivar sem aplicar')).toBeTruthy()
  })

  it('"leading" is selected by default', () => {
    render(<AbEndTestDialog testId={mockTest.id} variants={mockTest.variants} confidenceThreshold={mockTest.config.confidence_threshold} onClose={vi.fn()} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const leadingRadio = radios.find((r) => r.value === 'leading')!
    expect(leadingRadio.checked).toBe(true)
  })

  it('clicking option changes selection', () => {
    render(<AbEndTestDialog testId={mockTest.id} variants={mockTest.variants} confidenceThreshold={mockTest.config.confidence_threshold} onClose={vi.fn()} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const archiveRadio = radios.find((r) => r.value === 'archive')!
    fireEvent.click(archiveRadio)
    expect(archiveRadio.checked).toBe(true)
  })

  it('confirm button shows "Aplicar e encerrar" for leading option', () => {
    render(<AbEndTestDialog testId={mockTest.id} variants={mockTest.variants} confidenceThreshold={mockTest.config.confidence_threshold} onClose={vi.fn()} />)
    expect(screen.getByText('Aplicar e encerrar')).toBeTruthy()
  })

  it('confirm button shows "Manter original e encerrar" for original option', () => {
    render(<AbEndTestDialog testId={mockTest.id} variants={mockTest.variants} confidenceThreshold={mockTest.config.confidence_threshold} onClose={vi.fn()} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const originalRadio = radios.find((r) => r.value === 'original')!
    fireEvent.click(originalRadio)
    expect(screen.getByText('Manter original e encerrar')).toBeTruthy()
  })

  it('confirm button shows "Arquivar teste" for archive option', () => {
    render(<AbEndTestDialog testId={mockTest.id} variants={mockTest.variants} confidenceThreshold={mockTest.config.confidence_threshold} onClose={vi.fn()} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const archiveRadio = radios.find((r) => r.value === 'archive')!
    fireEvent.click(archiveRadio)
    expect(screen.getByText('Arquivar teste')).toBeTruthy()
  })

  it('cancel button calls onClose', () => {
    const onClose = vi.fn()
    render(<AbEndTestDialog testId={mockTest.id} variants={mockTest.variants} confidenceThreshold={mockTest.config.confidence_threshold} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking backdrop calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(<AbEndTestDialog testId={mockTest.id} variants={mockTest.variants} confidenceThreshold={mockTest.config.confidence_threshold} onClose={onClose} />)
    const backdrop = container.querySelector('[aria-hidden="true"]')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
