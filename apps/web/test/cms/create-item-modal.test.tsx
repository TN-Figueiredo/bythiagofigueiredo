import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/app/cms/(authed)/pipeline/actions', () => ({
  createPipelineItem: vi.fn().mockResolvedValue({ ok: true, data: { id: '1' } }),
}))

describe('CreateItemModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('renders form fields when open', async () => {
    const { CreateItemModal } = await import('@/app/cms/(authed)/pipeline/_components/create-item-modal')
    render(<CreateItemModal format="course" open={true} onClose={vi.fn()} />)
    expect(screen.getByLabelText(/título/i)).toBeTruthy()
    expect(screen.getByLabelText(/idioma/i)).toBeTruthy()
  })

  it('calls onClose when backdrop clicked', async () => {
    const { CreateItemModal } = await import('@/app/cms/(authed)/pipeline/_components/create-item-modal')
    const onClose = vi.fn()
    render(<CreateItemModal format="course" open={true} onClose={onClose} />)
    fireEvent.mouseDown(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when closed', async () => {
    const { CreateItemModal } = await import('@/app/cms/(authed)/pipeline/_components/create-item-modal')
    render(<CreateItemModal format="course" open={false} onClose={vi.fn()} />)
    expect(screen.queryByLabelText(/título/i)).toBeNull()
  })

  it('submitting with pt-br language calls createPipelineItem with title_pt, format, language and stage', async () => {
    const { createPipelineItem } = await import('@/app/cms/(authed)/pipeline/actions')
    const { CreateItemModal } = await import('@/app/cms/(authed)/pipeline/_components/create-item-modal')

    render(<CreateItemModal format="course" open={true} onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Meu Curso' } })
    // language select defaults to pt-br — no need to change it
    fireEvent.submit(document.querySelector('form')!)

    await vi.waitFor(() => {
      expect(createPipelineItem).toHaveBeenCalledWith({
        format: 'course',
        title_pt: 'Meu Curso',
        language: 'pt-br',
        stage: 'idea',
      })
    })
  })

  it('submitting with both language calls createPipelineItem with title_pt and title_en', async () => {
    const { createPipelineItem } = await import('@/app/cms/(authed)/pipeline/actions')
    const { CreateItemModal } = await import('@/app/cms/(authed)/pipeline/_components/create-item-modal')

    render(<CreateItemModal format="course" open={true} onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Bilingual Course' } })
    fireEvent.change(screen.getByLabelText(/idioma/i), { target: { value: 'both' } })
    fireEvent.submit(document.querySelector('form')!)

    await vi.waitFor(() => {
      expect(createPipelineItem).toHaveBeenCalledWith({
        format: 'course',
        title_pt: 'Bilingual Course',
        title_en: 'Bilingual Course',
        language: 'both',
        stage: 'idea',
      })
    })
  })
})
