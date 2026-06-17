import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WaitlistSignupForm } from '../../src/components/waitlists/waitlist-signup-form'
import { FORM_STRINGS } from '../../src/components/waitlists/form-strings'

const en = FORM_STRINGS.en

// Landing variant skips the mount-GET (it trusts initialStatus), so these tests
// exercise the idle/submit state machine without stubbing the status fetch.
function renderIdle(extra?: Partial<Parameters<typeof WaitlistSignupForm>[0]>) {
  return render(
    <WaitlistSignupForm
      slug="my-waitlist"
      locale="en"
      name="My Product"
      variant="landing"
      initialStatus="open"
      {...extra}
    />,
  )
}

function fillEmail(value: string) {
  fireEvent.change(screen.getByPlaceholderText(en.emailPlaceholder), { target: { value } })
}

describe('WaitlistSignupForm', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('renders the email input and consent checkbox in idle', () => {
    renderIdle()
    expect(screen.getByPlaceholderText(en.emailPlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
    // consent label interpolates the waitlist name verbatim (LGPD proof-of-consent)
    expect(screen.getByText(/My Product/)).toBeInTheDocument()
  })

  it('keeps submit disabled until email is valid AND consent is checked (no turnstile key)', () => {
    renderIdle()
    const button = screen.getByRole('button', { name: new RegExp(en.button, 'i') })
    expect(button).toBeDisabled()

    fillEmail('reader@example.com')
    // email valid but consent not checked → still disabled
    expect(button).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox'))
    // M4: empty NEXT_PUBLIC_TURNSTILE_SITE_KEY → needsToken=false → enabled now
    expect(button).toBeEnabled()
  })

  it('keeps submit disabled when a turnstile key is set but no token has arrived', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'test-site-key')
    renderIdle()
    const button = screen.getByRole('button', { name: new RegExp(en.button, 'i') })

    fillEmail('reader@example.com')
    fireEvent.click(screen.getByRole('checkbox'))
    // happy-dom has no real Turnstile widget → token stays null → still disabled
    expect(button).toBeDisabled()
  })

  it('renders the success block in place (role=status, no email field) after a successful POST', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, duplicate: false }),
      })),
    )
    renderIdle()
    fillEmail('reader@example.com')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.button, 'i') }))

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    expect(screen.getByText(en.successHeadline)).toBeInTheDocument()
    // reassurance line appended under success (spec §7)
    expect(screen.getByText(en.reassurance)).toBeInTheDocument()
    // form is replaced — the email field is gone
    expect(screen.queryByPlaceholderText(en.emailPlaceholder)).not.toBeInTheDocument()
  })

  it('renders the duplicate block after a 200 duplicate POST', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, duplicate: true }),
      })),
    )
    renderIdle()
    fillEmail('reader@example.com')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.button, 'i') }))

    await waitFor(() => expect(screen.getByText(en.duplicateHeadline)).toBeInTheDocument())
    expect(screen.getByText(en.reassurance)).toBeInTheDocument()
  })

  it('maps a 409 to the raceClosed message (distinct from the closed/launched blocks)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({ error: 'waitlist_not_open' }),
      })),
    )
    renderIdle()
    fillEmail('reader@example.com')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.button, 'i') }))

    await waitFor(() => expect(screen.getByText(en.raceClosed)).toBeInTheDocument())
  })

  it('maps a 429 to the rateLimited error (role=alert, form still present)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: 'rate_limited' }),
      })),
    )
    renderIdle()
    fillEmail('reader@example.com')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.button, 'i') }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.rateLimited))
    // an error keeps the form visible so the reader can retry
    expect(screen.getByPlaceholderText(en.emailPlaceholder)).toBeInTheDocument()
  })

  it('renders the closed message block (no email field) for initialStatus=closed', () => {
    renderIdle({ initialStatus: 'closed' })
    expect(screen.getByText(en.closed)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(en.emailPlaceholder)).not.toBeInTheDocument()
  })
})
