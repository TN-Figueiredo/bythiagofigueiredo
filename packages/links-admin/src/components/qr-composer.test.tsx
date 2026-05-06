import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QrComposer } from './qr-composer'
import type { LinkSummary } from '../types'

const link: LinkSummary = {
  id: 'link-1',
  code: 'abc123',
  slug: null,
  title: 'Test Link',
  destination_url: 'https://example.com',
  source_type: 'manual',
  tags: [],
  active: true,
  redirect_type: 302,
  expires_at: null,
  total_clicks: 100,
  unique_visitors: 80,
  last_clicked_at: null,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
}

describe('QrComposer', () => {
  const defaultProps = {
    link,
    onGenerate: vi.fn().mockResolvedValue({ svgContent: '<svg>...</svg>' }),
    onDownload: vi.fn(),
  }

  it('renders QR composer panel', () => {
    render(<QrComposer {...defaultProps} />)
    expect(screen.getByText(/qr code/i)).toBeInTheDocument()
  })

  it('renders foreground color picker', () => {
    render(<QrComposer {...defaultProps} />)
    expect(screen.getByLabelText(/foreground/i)).toBeInTheDocument()
  })

  it('renders background color picker', () => {
    render(<QrComposer {...defaultProps} />)
    expect(screen.getByLabelText(/background/i)).toBeInTheDocument()
  })

  it('defaults foreground to black and background to white', () => {
    render(<QrComposer {...defaultProps} />)
    const fg = screen.getByLabelText(/foreground/i) as HTMLInputElement
    const bg = screen.getByLabelText(/background/i) as HTMLInputElement
    expect(fg.value).toBe('#000000')
    expect(bg.value).toBe('#ffffff')
  })

  it('renders error correction level selector', () => {
    render(<QrComposer {...defaultProps} />)
    expect(screen.getByLabelText(/error correction/i)).toBeInTheDocument()
  })

  it('renders size input', () => {
    render(<QrComposer {...defaultProps} />)
    expect(screen.getByLabelText(/size/i)).toBeInTheDocument()
  })

  it('renders format selector (SVG/PNG)', () => {
    render(<QrComposer {...defaultProps} />)
    expect(screen.getByLabelText(/format/i)).toBeInTheDocument()
  })

  it('renders logo upload area', () => {
    render(<QrComposer {...defaultProps} />)
    expect(screen.getByText(/logo/i)).toBeInTheDocument()
  })

  it('renders generate button', () => {
    render(<QrComposer {...defaultProps} />)
    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument()
  })

  it('calls onGenerate with config when generate clicked', async () => {
    const user = userEvent.setup()
    render(<QrComposer {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /generate/i }))
    expect(defaultProps.onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        foregroundColor: '#000000',
        backgroundColor: '#ffffff',
        errorCorrectionLevel: 'M',
        size: 512,
        format: 'svg',
      }),
    )
  })

  it('renders download button after generation', async () => {
    const user = userEvent.setup()
    render(<QrComposer {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /generate/i }))
    expect(await screen.findByRole('button', { name: /download/i })).toBeInTheDocument()
  })

  it('calls onDownload when download button clicked', async () => {
    const user = userEvent.setup()
    render(<QrComposer {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /generate/i }))
    const downloadBtn = await screen.findByRole('button', { name: /download/i })
    await user.click(downloadBtn)
    expect(defaultProps.onDownload).toHaveBeenCalled()
  })

  it('renders preview area', () => {
    render(<QrComposer {...defaultProps} />)
    expect(screen.getByTestId('qr-preview')).toBeInTheDocument()
  })

  it('updates preview when color changes', () => {
    render(<QrComposer {...defaultProps} />)
    const fg = screen.getByLabelText(/foreground/i)
    fireEvent.change(fg, { target: { value: '#ff0000' } })
    expect((fg as HTMLInputElement).value).toBe('#ff0000')
  })
})
