import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import {
  WaitlistEmbedInPost,
  normalizeWaitlistLocale,
} from '../../src/components/waitlists/waitlist-embed-in-post'
import { FORM_STRINGS } from '../../src/components/waitlists/form-strings'

const pt = FORM_STRINGS['pt-BR']
const en = FORM_STRINGS.en

function stubStatusFetch(payload: unknown, status = 200) {
  const fn = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }))
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('WaitlistEmbedInPost', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('renders nothing when slug is empty or not a string', () => {
    stubStatusFetch({})
    const { container: c1 } = render(<WaitlistEmbedInPost slug="" />)
    expect(c1).toBeEmptyDOMElement()
    const { container: c2 } = render(<WaitlistEmbedInPost slug={undefined} />)
    expect(c2).toBeEmptyDOMElement()
    const { container: c3 } = render(<WaitlistEmbedInPost slug={42} />)
    expect(c3).toBeEmptyDOMElement()
  })

  it('resolves an open waitlist via the public status route and renders the inline form (pt-BR default)', async () => {
    const fetchFn = stubStatusFetch({ status: 'open', name: 'Meu Produto' })
    render(<WaitlistEmbedInPost slug="meu-produto" />)

    // Surface 3 lead-in (handwritten "curtiu? entra na lista.")
    expect(screen.getByText('curtiu? entra na lista.')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: pt.button })).toBeInTheDocument()
    })
    expect(screen.getByPlaceholderText(pt.emailPlaceholder)).toBeInTheDocument()
    expect(fetchFn).toHaveBeenCalledWith('/api/waitlists/meu-produto')
  })

  it('renders English copy when locale is en', async () => {
    stubStatusFetch({ status: 'open', name: 'My Product' })
    render(<WaitlistEmbedInPost slug="my-product" locale="en" />)

    expect(screen.getByText('liked it? join the list.')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: en.button })).toBeInTheDocument()
    })
  })

  it('shows the unavailable message when the waitlist does not exist (404)', async () => {
    stubStatusFetch({ error: 'not_found' }, 404)
    render(<WaitlistEmbedInPost slug="ghost" locale="en" />)

    await waitFor(() => {
      expect(screen.getByText(en.unavailable)).toBeInTheDocument()
    })
  })

  it('shows the closed message for a closed waitlist (no form)', async () => {
    stubStatusFetch({ status: 'closed', name: 'My Product' })
    render(<WaitlistEmbedInPost slug="my-product" locale="en" />)

    await waitFor(() => {
      expect(screen.getByText(en.closed)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('normalizeWaitlistLocale', () => {
  it('defaults to pt-BR', () => {
    expect(normalizeWaitlistLocale(undefined)).toBe('pt-BR')
    expect(normalizeWaitlistLocale(null)).toBe('pt-BR')
    expect(normalizeWaitlistLocale('pt-BR')).toBe('pt-BR')
    expect(normalizeWaitlistLocale('pt')).toBe('pt-BR')
    expect(normalizeWaitlistLocale(7)).toBe('pt-BR')
  })

  it('maps en variants to en', () => {
    expect(normalizeWaitlistLocale('en')).toBe('en')
    expect(normalizeWaitlistLocale('en-US')).toBe('en')
    expect(normalizeWaitlistLocale('EN')).toBe('en')
  })
})
