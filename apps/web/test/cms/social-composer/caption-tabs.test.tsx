import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'

describe('CaptionTabs', () => {
  const defaultCaptions: Record<string, Record<string, string>> = {
    facebook: { pt: 'Caption FB em PT', en: '' },
    bluesky: { pt: '', en: '' },
  }

  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a tab per platform', async () => {
    const { CaptionTabs } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-tabs'
    )

    render(
      <CaptionTabs
        captions={defaultCaptions}
        onChange={mockOnChange}
        platforms={['facebook', 'bluesky']}
      />,
    )

    expect(screen.getByRole('tab', { name: /facebook/i })).toBeDefined()
    expect(screen.getByRole('tab', { name: /bluesky/i })).toBeDefined()
  })

  it('shows character count for active platform', async () => {
    const { CaptionTabs } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-tabs'
    )

    render(
      <CaptionTabs
        captions={defaultCaptions}
        onChange={mockOnChange}
        platforms={['facebook', 'bluesky']}
      />,
    )

    // "Caption FB em PT" = 16 chars
    expect(screen.getByTestId('char-count')).toBeDefined()
    expect(screen.getByTestId('char-count').textContent).toContain('16/63206')
  })

  it('switches platform tab and shows correct char limit', async () => {
    const { CaptionTabs } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-tabs'
    )

    render(
      <CaptionTabs
        captions={defaultCaptions}
        onChange={mockOnChange}
        platforms={['facebook', 'bluesky']}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: /bluesky/i }))

    // Bluesky limit is 300 — check via char-count testid
    expect(screen.getByTestId('char-count').textContent).toContain('/300')
  })

  it('fires onChange when caption is edited', async () => {
    const { CaptionTabs } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-tabs'
    )

    render(
      <CaptionTabs
        captions={defaultCaptions}
        onChange={mockOnChange}
        platforms={['facebook', 'bluesky']}
      />,
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'New caption text' } })

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        facebook: expect.objectContaining({ pt: 'New caption text' }),
      }),
    )
  })

  it('toggles language between PT and EN', async () => {
    const { CaptionTabs } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-tabs'
    )

    render(
      <CaptionTabs
        captions={{
          facebook: { pt: 'Texto PT', en: 'Text EN' },
        }}
        onChange={mockOnChange}
        platforms={['facebook']}
      />,
    )

    // Default is PT
    expect(screen.getByDisplayValue('Texto PT')).toBeDefined()

    // Toggle to EN
    fireEvent.click(screen.getByText('EN'))

    expect(screen.getByDisplayValue('Text EN')).toBeDefined()
  })

  it('shows auto-fill badge for non-empty pre-populated captions', async () => {
    const { CaptionTabs } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-tabs'
    )

    render(
      <CaptionTabs
        captions={{ facebook: { pt: 'Auto-generated caption' } }}
        onChange={mockOnChange}
        platforms={['facebook']}
        autoFilled
      />,
    )

    // "Auto-preenchido" matches /auto/i — use more specific query
    expect(screen.getAllByText(/auto/i).length).toBeGreaterThan(0)
    // Badge span specifically
    const badge = screen.getByText('Auto-preenchido')
    expect(badge).toBeDefined()
  })

  it('hides auto-fill badge after editing', async () => {
    const { CaptionTabs } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-tabs'
    )

    const { rerender } = render(
      <CaptionTabs
        captions={{ facebook: { pt: 'Auto' } }}
        onChange={mockOnChange}
        platforms={['facebook']}
        autoFilled
      />,
    )

    expect(screen.getByText('Auto-preenchido')).toBeDefined()

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Manual edit' } })

    // After onChange, parent re-renders without autoFilled
    rerender(
      <CaptionTabs
        captions={{ facebook: { pt: 'Manual edit' } }}
        onChange={mockOnChange}
        platforms={['facebook']}
        autoFilled={false}
      />,
    )

    expect(screen.queryByText(/auto/i)).toBeNull()
  })

  it('shows warning color when caption exceeds threshold', async () => {
    const { CaptionTabs } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-tabs'
    )

    // Bluesky limit is 300, warning at >250
    const longCaption = 'A'.repeat(260)

    const { container } = render(
      <CaptionTabs
        captions={{ bluesky: { pt: longCaption } }}
        onChange={mockOnChange}
        platforms={['bluesky']}
      />,
    )

    const charCount = container.querySelector('[data-testid="char-count"]')
    expect(charCount?.className).toContain('text-amber')
  })
})
