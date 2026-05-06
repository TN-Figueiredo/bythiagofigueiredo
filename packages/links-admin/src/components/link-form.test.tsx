import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LinkForm } from './link-form'

describe('LinkForm', () => {
  const defaultProps = {
    onSubmit: vi.fn().mockResolvedValue({ ok: true }),
    onCancel: vi.fn(),
    siteId: 'site-123',
  }

  it('renders in create mode when no link prop', () => {
    render(<LinkForm {...defaultProps} />)
    expect(screen.getByLabelText(/destination url/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
  })

  it('renders in edit mode when link prop is provided', () => {
    const link = {
      id: 'link-1',
      destination_url: 'https://existing.com',
      title: 'Existing Link',
      slug: 'existing',
      source_type: 'manual' as const,
      redirect_type: 301 as const,
      active: true,
      tags: ['tag1'],
      utm_source: '',
      utm_medium: '',
      utm_campaign: '',
      utm_term: '',
      utm_content: '',
      expires_at: '',
      click_limit: null,
      password: '',
    }
    render(<LinkForm {...defaultProps} link={link} />)
    expect(screen.getByLabelText(/destination url/i)).toHaveValue('https://existing.com')
    expect(screen.getByLabelText(/title/i)).toHaveValue('Existing Link')
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('shows validation error for empty destination URL on submit', async () => {
    const user = userEvent.setup()
    render(<LinkForm {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /create/i }))
    expect(await screen.findByText(/destination url is required/i)).toBeInTheDocument()
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('shows validation error for invalid URL format', async () => {
    const user = userEvent.setup()
    render(<LinkForm {...defaultProps} />)
    await user.type(screen.getByLabelText(/destination url/i), 'not-a-url')
    await user.click(screen.getByRole('button', { name: /create/i }))
    expect(await screen.findByText(/valid url/i)).toBeInTheDocument()
  })

  it('calls onSubmit with form data when valid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue({ ok: true })
    render(<LinkForm {...defaultProps} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/destination url/i), 'https://example.com/page')
    await user.type(screen.getByLabelText(/title/i), 'My Link')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          destination_url: 'https://example.com/page',
          title: 'My Link',
        }),
      )
    })
  })

  it('calls onCancel when cancel button clicked', async () => {
    const user = userEvent.setup()
    render(<LinkForm {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(defaultProps.onCancel).toHaveBeenCalled()
  })

  it('renders source type select with all options', () => {
    render(<LinkForm {...defaultProps} />)
    const select = screen.getByLabelText(/source type/i)
    expect(select).toBeInTheDocument()
  })

  it('renders redirect type radio buttons', () => {
    render(<LinkForm {...defaultProps} />)
    expect(screen.getByLabelText(/301/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/302/i)).toBeInTheDocument()
  })

  it('renders UTM fields section', () => {
    render(<LinkForm {...defaultProps} />)
    expect(screen.getByText(/utm parameters/i)).toBeInTheDocument()
  })

  it('renders active toggle defaulting to true', () => {
    render(<LinkForm {...defaultProps} />)
    const toggle = screen.getByRole('checkbox', { name: /active/i })
    expect(toggle).toBeChecked()
  })

  it('disables submit button while submitting', async () => {
    const user = userEvent.setup()
    let resolveSubmit: (v: unknown) => void
    const onSubmit = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveSubmit = resolve }),
    )
    render(<LinkForm {...defaultProps} onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText(/destination url/i), 'https://example.com')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create/i })).toBeDisabled()
    })

    resolveSubmit!({ ok: true })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create/i })).not.toBeDisabled()
    })
  })
})
