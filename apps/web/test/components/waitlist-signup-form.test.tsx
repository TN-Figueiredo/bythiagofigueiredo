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

// Embed/inline variants do NOT trust initialStatus — they resolve lifecycle via a
// mount-GET against the public status route. These helpers exercise that path (M4).
function renderEmbed(extra?: Partial<Parameters<typeof WaitlistSignupForm>[0]>) {
  return render(
    <WaitlistSignupForm
      slug="my-waitlist"
      locale="en"
      name="My Product"
      variant="embed"
      {...extra}
    />,
  )
}

function fillEmail(value: string) {
  fireEvent.change(screen.getByPlaceholderText(en.emailPlaceholder), { target: { value } })
}

// A fetch stub that never settles — lets us assert the in-flight "submitting" state
// before the POST resolves. Returns the controls to resolve it later if needed.
function deferredFetch() {
  let resolve!: (value: unknown) => void
  const promise = new Promise((r) => {
    resolve = r
  })
  return { fn: vi.fn(() => promise), resolve }
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

  it('wires the email input ARIA attributes for screen readers (idle = not invalid)', () => {
    renderIdle()
    const input = screen.getByPlaceholderText(en.emailPlaceholder)
    expect(input).toHaveAttribute('type', 'email')
    // Accessible name comes from the bound sr-only <label htmlFor> (localized
    // strings.emailLabel), not a duplicate aria-label — getByLabelText resolves it.
    expect(screen.getByLabelText(en.emailLabel)).toBe(input)
    // no error yet → aria-invalid must be the literal "false", never absent/true
    expect(input).toHaveAttribute('aria-invalid', 'false')
  })

  it('keeps submit disabled until email is valid AND consent is checked (no turnstile key)', () => {
    renderIdle()
    const button = screen.getByRole('button', { name: new RegExp(en.button, 'i') })
    // starts disabled before any interaction (no email, no consent)
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
    const region = screen.getByRole('status')
    // the result region must be a polite live region AND programmatically focusable
    // so focus can be moved into it after submit (a11y, spec §7)
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('tabindex', '-1')
    expect(screen.getByText(en.successHeadline)).toBeInTheDocument()
    // reassurance line appended under success (spec §7)
    expect(screen.getByText(en.reassurance)).toBeInTheDocument()
    // form is replaced — the email field is gone
    expect(screen.queryByPlaceholderText(en.emailPlaceholder)).not.toBeInTheDocument()
  })

  // NOTE (WL-11 cross-file follow-up): the assertion that the signup RPC's
  // `email_hash` equals sha256(email) belongs to the DB-gated integration suite
  // `apps/web/test/integration/waitlist-signup-rpc.test.ts` (it inspects the RPC
  // payload, not this client component) — apply the sha256 equality there, not here.

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

  // ---- M4 mount-GET lifecycle (embed/inline variants resolve status via fetch) ----

  it('shows the loading lifecycle (aria-busy, no form) on mount for embed before the GET resolves', () => {
    // never-settling status GET → lifecycle stays "loading"
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    renderEmbed()
    // the loading block is busy and carries the buttonLoading copy; the form is not shown
    expect(screen.getByText(en.buttonLoading)).toBeInTheDocument()
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByPlaceholderText(en.emailPlaceholder)).not.toBeInTheDocument()
  })

  it('resolves the embed mount-GET to an open form and adopts the server-resolved name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: 'open', name: 'Resolved Name' }),
      })),
    )
    renderEmbed()
    // once the GET resolves, the form renders with the name from the payload (not the prop)
    await waitFor(() => expect(screen.getByPlaceholderText(en.emailPlaceholder)).toBeInTheDocument())
    expect(screen.getByText(/Resolved Name/)).toBeInTheDocument()
  })

  it('maps a 404 mount-GET to the unavailable message (no form) for embed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
    )
    renderEmbed()
    await waitFor(() => expect(screen.getByText(en.unavailable)).toBeInTheDocument())
    expect(screen.queryByPlaceholderText(en.emailPlaceholder)).not.toBeInTheDocument()
  })

  it('maps a non-ok (5xx) mount-GET to the transient-error block with a retry control for embed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
    )
    renderEmbed()
    // transient-error is a role=alert block that keeps a retry button (the lifecycle is recoverable)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.error))
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(en.emailPlaceholder)).not.toBeInTheDocument()
  })

  it('maps a thrown (network) mount-GET to the transient-error block for embed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    renderEmbed()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.error))
    expect(screen.queryByPlaceholderText(en.emailPlaceholder)).not.toBeInTheDocument()
  })

  // ---- M4 submit state machine: submitting / 5xx / no-key ----

  it('reflects the submitting state while the POST is in flight (aria-busy button, disabled input)', async () => {
    const { fn } = deferredFetch()
    vi.stubGlobal('fetch', fn)
    renderIdle()
    fillEmail('reader@example.com')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.button, 'i') }))

    // the POST promise never resolves, so the form stays in "submitting"
    const button = await screen.findByRole('button', { name: new RegExp(en.buttonLoading, 'i') })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
    // the email field is disabled mid-flight so the payload can't change under the request
    expect(screen.getByPlaceholderText(en.emailPlaceholder)).toBeDisabled()
  })

  it('maps a 503 to the unavailable error (role=alert, form still present to retry)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({ error: 'unavailable' }),
      })),
    )
    renderIdle()
    fillEmail('reader@example.com')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.button, 'i') }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.unavailable))
    // an error keeps the form visible so the reader can retry
    expect(screen.getByPlaceholderText(en.emailPlaceholder)).toBeInTheDocument()
  })

  it('maps any other non-ok status (500) to the generic error block (form still present)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: 'boom' }),
      })),
    )
    renderIdle()
    fillEmail('reader@example.com')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.button, 'i') }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.error))
    expect(screen.getByPlaceholderText(en.emailPlaceholder)).toBeInTheDocument()
  })

  it('submits with the no-turnstile placeholder token when no site key is configured (keyless dev)', async () => {
    // no NEXT_PUBLIC_TURNSTILE_SITE_KEY → needsToken=false → button enables without a token,
    // and the POST body carries the "no-turnstile" placeholder the route accepts in keyless mode.
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, duplicate: false }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    renderIdle()
    fillEmail('reader@example.com')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.button, 'i') }))

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/waitlists/my-waitlist/signup',
      expect.objectContaining({ method: 'POST' }),
    )
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body) as {
      turnstile_token: string
    }
    expect(body.turnstile_token).toBe('no-turnstile')
  })
})
