import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { FORM_STRINGS } from '../../src/components/waitlists/form-strings'

// The embed page resolves the site exactly like the hosted landing: getSiteContext
// (middleware-set x-site-id) → slug lookup scoped to that site. Mock both, same as
// waitlist-landing.test.tsx.
vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () =>
    Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'en', timezone: 'UTC' }),
  tryGetSiteContext: () =>
    Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'en', timezone: 'UTC' }),
}))

const h = vi.hoisted(() => ({ row: null as unknown }))
vi.mock('@/lib/supabase/service', () => {
  const chain: Record<string, unknown> = {}
  chain.eq = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: h.row, error: null }))
  return {
    getSupabaseServiceClient: vi.fn(() => ({
      from: vi.fn(() => ({ select: vi.fn(() => chain) })),
    })),
  }
})

import WaitlistEmbedPage from '../../src/app/(embed)/embed/waitlists/[slug]/page'

const en = FORM_STRINGS.en
const ptBR = FORM_STRINGS['pt-BR']

function row(status: 'open' | 'closed' | 'launched' | 'draft') {
  return { id: 'w1', status, name: 'My Product' }
}

async function renderPage(
  slug = 'my-product',
  searchParams: { accent?: string | string[]; lang?: string | string[] } = {},
) {
  const jsx = await WaitlistEmbedPage({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(searchParams),
  })
  return render(jsx as never)
}

describe('WaitlistEmbedPage (/embed/waitlists/[slug])', () => {
  beforeEach(() => {
    h.row = null
  })

  it('renders ONLY the card — form + name, no site nav/footer chrome', async () => {
    h.row = row('open')
    const { queryByPlaceholderText, container } = await renderPage('my-product', { lang: 'en' })
    expect(queryByPlaceholderText(en.emailPlaceholder)).not.toBeNull()
    expect(container.textContent).toContain('My Product')
    // the postMessage resize wrapper is mounted around the card
    expect(container.querySelector('[data-waitlist-embed-frame]')).not.toBeNull()
    // no shell landmarks besides the card's own <main>
    expect(container.querySelector('nav')).toBeNull()
    expect(container.querySelector('footer')).toBeNull()
  })

  it('renders the form immediately from the server-resolved status (no mount-GET loading flash)', async () => {
    h.row = row('open')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    try {
      const { queryByPlaceholderText, container } = await renderPage('my-product', { lang: 'en' })
      // form is there synchronously — never the aria-busy loading block
      expect(queryByPlaceholderText(en.emailPlaceholder)).not.toBeNull()
      expect(container.querySelector('[aria-busy="true"]')).toBeNull()
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('defaults to pt-BR copy when ?lang is absent', async () => {
    h.row = row('open')
    const { queryByPlaceholderText, container } = await renderPage()
    expect(queryByPlaceholderText(ptBR.emailPlaceholder)).not.toBeNull()
    expect(container.textContent).toContain('lista de espera')
  })

  it('renders English copy for ?lang=en', async () => {
    h.row = row('open')
    const { queryByPlaceholderText, container } = await renderPage('my-product', { lang: 'en' })
    expect(queryByPlaceholderText(en.emailPlaceholder)).not.toBeNull()
    expect(container.textContent).toContain('waitlist')
  })

  it('falls back to pt-BR for an unsupported ?lang value', async () => {
    h.row = row('open')
    const { queryByPlaceholderText } = await renderPage('my-product', { lang: 'fr' })
    expect(queryByPlaceholderText(ptBR.emailPlaceholder)).not.toBeNull()
  })

  it('applies a valid ?accent=RRGGBB as the --pb-accent CSS var on the card', async () => {
    h.row = row('open')
    const { container } = await renderPage('my-product', { accent: 'C14513' })
    const main = container.querySelector('main')
    expect(main?.getAttribute('style') ?? '').toContain('--pb-accent: #c14513')
  })

  it('ignores an invalid ?accent (theme default stays — no inline override)', async () => {
    h.row = row('open')
    const { container } = await renderPage('my-product', { accent: 'not-a-color' })
    const main = container.querySelector('main')
    expect(main?.getAttribute('style') ?? '').not.toContain('--pb-accent')
  })

  it('renders the closed message block and NO email field when status=closed', async () => {
    h.row = row('closed')
    const { queryByPlaceholderText, container } = await renderPage('my-product', { lang: 'en' })
    expect(container.textContent).toContain(en.closed)
    expect(queryByPlaceholderText(en.emailPlaceholder)).toBeNull()
  })

  it('calls notFound (throws) for a non-existent slug', async () => {
    h.row = null
    await expect(
      WaitlistEmbedPage({
        params: Promise.resolve({ slug: 'missing' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow()
  })

  it('calls notFound (throws) for a non-public status (draft) — same no-oracle 404 as the landing', async () => {
    h.row = row('draft')
    await expect(
      WaitlistEmbedPage({
        params: Promise.resolve({ slug: 'my-product' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow()
  })
})
