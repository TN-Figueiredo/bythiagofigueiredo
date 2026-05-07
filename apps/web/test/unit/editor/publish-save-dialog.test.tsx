import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PublishSaveDialog } from '@/app/cms/(authed)/_shared/editor/publish-save-dialog'

describe('PublishSaveDialog', () => {
  it('renders when open', () => {
    render(<PublishSaveDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Update published post?')).toBeDefined()
    expect(screen.getByText(/this post is live/i)).toBeDefined()
  })

  it('does not render when not open', () => {
    const { container } = render(<PublishSaveDialog open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('calls onConfirm when Update clicked', () => {
    const onConfirm = vi.fn()
    render(<PublishSaveDialog open onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /update/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Cancel clicked', () => {
    const onCancel = vi.fn()
    render(<PublishSaveDialog open onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('has accessible dialog role', () => {
    render(<PublishSaveDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeDefined()
  })
})
