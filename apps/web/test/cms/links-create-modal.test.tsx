// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    X: icon('X'),
    Link2: icon('Link2'),
    Copy: icon('Copy'),
    Check: icon('Check'),
    Loader2: icon('Loader2'),
    ChevronDown: icon('ChevronDown'),
  }
})

import { CreateLinkModal } from '@/app/cms/(authed)/links/_components/create-link-modal'

afterEach(() => cleanup())

describe('CreateLinkModal', () => {
  it('renders modal with title', () => {
    const { getByText } = render(<CreateLinkModal open onClose={() => {}} onSubmit={async () => ({ ok: true, linkId: '1' })} />)
    expect(getByText('Novo link')).toBeTruthy()
  })

  it('renders destination URL input', () => {
    const { container } = render(<CreateLinkModal open onClose={() => {}} onSubmit={async () => ({ ok: true, linkId: '1' })} />)
    const input = container.querySelector('input[placeholder*="https://"]')
    expect(input).toBeTruthy()
  })

  it('renders title input', () => {
    const { container } = render(<CreateLinkModal open onClose={() => {}} onSubmit={async () => ({ ok: true, linkId: '1' })} />)
    const inputs = container.querySelectorAll('input')
    expect(inputs.length).toBeGreaterThanOrEqual(2)
  })

  it('renders source type selector', () => {
    const { getByText } = render(<CreateLinkModal open onClose={() => {}} onSubmit={async () => ({ ok: true, linkId: '1' })} />)
    expect(getByText('Origem')).toBeTruthy()
  })

  it('renders submit button "Criar link"', () => {
    const { getByText } = render(<CreateLinkModal open onClose={() => {}} onSubmit={async () => ({ ok: true, linkId: '1' })} />)
    expect(getByText('Criar link')).toBeTruthy()
  })

  it('calls onClose when X clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<CreateLinkModal open onClose={onClose} onSubmit={async () => ({ ok: true, linkId: '1' })} />)
    const closeBtn = container.querySelector('[aria-label="Fechar"]')
    if (closeBtn) fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onSubmit with form data', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, linkId: 'new-id' })
    const { container, getByText } = render(<CreateLinkModal open onClose={() => {}} onSubmit={onSubmit} />)

    const urlInput = container.querySelector('input[placeholder*="https://"]') as HTMLInputElement
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } })

    fireEvent.click(getByText('Criar link'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
    })
  })

  it('does not render when open=false', () => {
    const { container } = render(<CreateLinkModal open={false} onClose={() => {}} onSubmit={async () => ({ ok: true, linkId: '1' })} />)
    expect(container.querySelector('[role="dialog"]')).toBeFalsy()
  })

  it('renders close button with accessible label', () => {
    const { container } = render(<CreateLinkModal open onClose={() => {}} onSubmit={async () => ({ ok: true, linkId: '1' })} />)
    expect(container.querySelector('[aria-label="Fechar"]')).toBeTruthy()
  })

  it('shows error message on failed submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, error: 'code_taken' })
    const { container, getByText } = render(<CreateLinkModal open onClose={() => {}} onSubmit={onSubmit} />)

    const urlInput = container.querySelector('input[placeholder*="https://"]') as HTMLInputElement
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } })
    fireEvent.click(getByText('Criar link'))

    await waitFor(() => {
      expect(container.textContent).toContain('code_taken')
    })
  })
})
