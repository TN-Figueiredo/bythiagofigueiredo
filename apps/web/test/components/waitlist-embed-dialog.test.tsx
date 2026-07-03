// No sanitized-HTML rendering here (the snippet renders as escaped text in a <pre>),
// so the default happy-dom environment is fine — matches the other dialog tests.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { EmbedDialog, WaitlistEmbedButton } from '../../src/app/cms/(authed)/waitlists/_components/embed-dialog'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const APP_URL = 'https://bythiagofigueiredo.com'

describe('<EmbedDialog>', () => {
  it('Esc closes the dialog', () => {
    const onClose = vi.fn()
    render(<EmbedDialog slug="launch-a" appUrl={APP_URL} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('snippet points at {APP_URL}/embed/waitlists/{slug} with sensible iframe attributes', () => {
    render(<EmbedDialog slug="launch-a" appUrl={APP_URL} onClose={vi.fn()} />)
    const snippet = screen.getByTestId('embed-snippet').textContent ?? ''
    expect(snippet).toContain(`src="${APP_URL}/embed/waitlists/launch-a"`)
    expect(snippet).toContain('width:100%')
    expect(snippet).toContain('border:0')
    expect(snippet).toContain('height="520"')
    expect(snippet).not.toContain('?accent=') // no accent until one is set
  })

  it('snippet includes the waitlist:resize auto-height listener in the copyable block', () => {
    render(<EmbedDialog slug="launch-a" appUrl={APP_URL} onClose={vi.fn()} />)
    const snippet = screen.getByTestId('embed-snippet').textContent ?? ''
    expect(snippet).toContain('waitlist:resize')
    expect(snippet).toContain('addEventListener')
  })

  it('a valid 6-hex accent live-updates ?accent= (hash stripped) and paints the swatch', () => {
    render(<EmbedDialog slug="launch-a" appUrl={APP_URL} onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('embed-accent'), { target: { value: '#C14513' } })
    const snippet = screen.getByTestId('embed-snippet').textContent ?? ''
    expect(snippet).toContain(`src="${APP_URL}/embed/waitlists/launch-a?accent=C14513"`)
    const swatch = screen.getByTestId('embed-accent-swatch') as HTMLElement
    expect(swatch.style.background).toBeTruthy()
  })

  it('an invalid hex is not applied to the snippet and shows a warning', () => {
    render(<EmbedDialog slug="launch-a" appUrl={APP_URL} onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('embed-accent'), { target: { value: '#C145' } })
    const snippet = screen.getByTestId('embed-snippet').textContent ?? ''
    expect(snippet).not.toContain('?accent=')
    expect(screen.getByRole('alert').textContent).toMatch(/6-digit hex/i)
  })

  it('Copy snippet calls the clipboard API with the snippet and announces via aria-live', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    render(<EmbedDialog slug="launch-a" appUrl={APP_URL} onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('embed-accent'), { target: { value: 'FF8240' } })

    fireEvent.click(screen.getByRole('button', { name: /copy snippet/i }))

    expect(writeText).toHaveBeenCalledTimes(1)
    const copied = writeText.mock.calls[0][0] as string
    expect(copied).toContain(`${APP_URL}/embed/waitlists/launch-a?accent=FF8240`)
    expect(copied).toContain('waitlist:resize')
    const status = await screen.findByRole('status')
    expect(status.textContent).toMatch(/copied/i)
  })

  it('falls back to execCommand when the clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    const execCommand = vi.fn().mockReturnValue(true)
    ;(document as Document & { execCommand: typeof execCommand }).execCommand = execCommand
    render(<EmbedDialog slug="launch-a" appUrl={APP_URL} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /copy snippet/i }))

    const status = await screen.findByRole('status')
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(status.textContent).toMatch(/copied/i)
  })

  it('mentions that embed signups arrive tagged with source `embed`', () => {
    render(<EmbedDialog slug="launch-a" appUrl={APP_URL} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog').textContent).toMatch(/tagged with source\s*embed/i)
  })
})

describe('<WaitlistEmbedButton>', () => {
  it('opens the dialog on click and closes it again on Esc', () => {
    render(<WaitlistEmbedButton slug="launch-a" appUrl={APP_URL} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /embed/i }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
