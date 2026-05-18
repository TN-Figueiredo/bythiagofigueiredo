import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'

describe('CaptionVariableTextarea', () => {
  const defaultProps = {
    value: '{{title}}\n\n{{link}}',
    onChange: vi.fn(),
    platform: 'facebook' as const,
    charLimit: 63_206,
    contentTitle: 'Como configurar OAuth 2.0',
    contentUrl: 'https://bythiagofigueiredo.com/blog/oauth-guide',
    shortDomain: 'go.btf.com',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders textarea with the provided value', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    render(<CaptionVariableTextarea {...defaultProps} />)
    expect(screen.getByRole('textbox')).toBeDefined()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      '{{title}}\n\n{{link}}',
    )
  })

  it('renders overlay with highlighted variable spans', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    const { container } = render(<CaptionVariableTextarea {...defaultProps} />)
    const overlay = container.querySelector('[data-testid="variable-overlay"]')
    expect(overlay).toBeDefined()
    // Should contain highlighted spans for {{title}} and {{link}}
    const highlights = overlay?.querySelectorAll('[data-variable]')
    expect(highlights?.length).toBe(2)
  })

  it('does NOT highlight unknown variables like {{foo}}', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    const { container } = render(
      <CaptionVariableTextarea
        {...defaultProps}
        value="Hello {{foo}} world {{link}}"
      />,
    )
    const overlay = container.querySelector('[data-testid="variable-overlay"]')
    const highlights = overlay?.querySelectorAll('[data-variable]')
    // Only {{link}} should be highlighted, not {{foo}}
    expect(highlights?.length).toBe(1)
  })

  it('shows resolved preview panel with placeholder link', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    render(<CaptionVariableTextarea {...defaultProps} />)
    const preview = screen.getByTestId('resolved-preview')
    expect(preview.textContent).toContain('Como configurar OAuth 2.0')
    expect(preview.textContent).toContain('go.btf.com/______')
  })

  it('shows character count based on resolved length', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    render(<CaptionVariableTextarea {...defaultProps} />)
    const charCount = screen.getByTestId('resolved-char-count')
    // Resolved: "Como configurar OAuth 2.0\n\ngo.btf.com/______" = 25 + 2 + 17 = 44
    expect(charCount.textContent).toContain('/63206')
  })

  it('shows yellow warning when no {{link}} present', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    render(
      <CaptionVariableTextarea {...defaultProps} value="Just a plain caption" />,
    )
    expect(screen.getByTestId('no-link-warning')).toBeDefined()
    expect(screen.getByTestId('no-link-warning').textContent).toContain(
      'No link in caption',
    )
  })

  it('has an "Add {{link}}" quick-insert button', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    render(
      <CaptionVariableTextarea {...defaultProps} value="No link here" />,
    )
    const btn = screen.getByRole('button', { name: /add \{\{link\}\}/i })
    expect(btn).toBeDefined()
    fireEvent.click(btn)
    expect(defaultProps.onChange).toHaveBeenCalledWith('No link here\n\n{{link}}')
  })

  it('fires onChange on textarea input', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    render(<CaptionVariableTextarea {...defaultProps} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'New value {{url}}' } })
    expect(defaultProps.onChange).toHaveBeenCalledWith('New value {{url}}')
  })

  it('shows red counter when over platform limit', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    const { container } = render(
      <CaptionVariableTextarea
        {...defaultProps}
        value={'A'.repeat(301)}
        charLimit={300}
        platform="bluesky"
      />,
    )
    const charCount = container.querySelector('[data-testid="resolved-char-count"]')
    expect(charCount?.className).toContain('text-red')
  })
})
