import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { SubmitForm } from '../../src/app/(public)/campaigns/[locale]/[slug]/submit-form'

const fields = [
  { name: 'name', label: 'Nome', type: 'name', required: true },
  { name: 'email', label: 'E-mail', type: 'email', required: true },
]

function renderForm(locale: string = 'pt-BR') {
  return render(
    <SubmitForm
      slug="oferta"
      locale={locale}
      formFields={fields}
      buttonLabel="Enviar"
      loadingLabel="Enviando..."
      contextTag="Prévia"
    />,
  )
}

let turnstileReset: ReturnType<typeof vi.fn>

beforeEach(() => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'site-key-test'
  turnstileReset = vi.fn()
  ;(window as unknown as { turnstile: unknown }).turnstile = {
    render: (_el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }) => {
      opts.callback('TOKEN_XYZ')
      return 'widget-id'
    },
    reset: turnstileReset,
  }
  const origAppend = document.head.appendChild.bind(document.head)
  vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
    const el = node as HTMLScriptElement
    if (el.tagName === 'SCRIPT' && typeof el.onload === 'function') {
      queueMicrotask(() => (el.onload as () => void)())
    }
    return origAppend(node)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as unknown as { turnstile?: unknown }).turnstile
})

describe('<SubmitForm>', () => {
  it('refuses to post until consent + token are present', async () => {
    renderForm()
    const btn = screen.getByRole('button', { name: /Enviar/ })
    expect((btn as HTMLButtonElement).disabled).toBe(false)

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Thiago' } })

    fireEvent.click(btn)
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  it('POSTs with turnstile_token and consent=true when the form is fully filled', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        duplicate: false,
        pdfUrl: null,
        successCopy: {
          headline: 'OK',
          subheadline: 'Sub',
          checkMailText: 'Check',
          downloadButtonLabel: 'Download',
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    renderForm()

    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Thiago' } })
    fireEvent.click(screen.getByLabelText(/Concordo/))

    fireEvent.click(screen.getByRole('button', { name: /Enviar/ }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/campaigns/oferta/submit')
    const body = JSON.parse((init as { body: string }).body)
    expect(body).toMatchObject({
      email: 'a@b.com',
      name: 'Thiago',
      locale: 'pt-BR',
      consent_marketing: true,
      turnstile_token: 'TOKEN_XYZ',
    })
    expect(body.consent_text_version).toMatch(/^v1/)

    await screen.findByText('OK')
  })

  it('renders English consent label when locale=en', async () => {
    renderForm('en')
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText(/I agree to receive communications/)).toBeTruthy()
  })

  it('resets turnstile and clears token when fetch returns non-ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    renderForm()
    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Test' } })
    fireEvent.click(screen.getByLabelText(/Concordo/))
    fireEvent.click(screen.getByRole('button', { name: /Enviar/ }))

    // fetch is called synchronously in onSubmit; the mock's resolved value
    // is delivered on the next microtask tick.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    // After fetch resolves (ok: false), the handler calls resetTurnstile().
    // Flush the async continuation:
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(turnstileReset).toHaveBeenCalledWith('widget-id')

    // Internal token state cleared — re-clicking submit without new token
    // should NOT fire another fetch.
    fireEvent.click(screen.getByRole('button', { name: /Enviar/ }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})
