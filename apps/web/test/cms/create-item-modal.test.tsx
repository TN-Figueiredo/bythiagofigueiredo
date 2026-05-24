import { describe, it, expect, vi } from 'vitest'
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
})
