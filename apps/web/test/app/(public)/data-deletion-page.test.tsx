import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { createHash } from 'node:crypto'

vi.mock('next/link', () => ({
  default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...p}>{children}</a>,
}))
vi.mock('next/headers', () => ({ headers: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { headers } from 'next/headers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import DataDeletionPage, { metadata } from '@/app/(public)/data-deletion/page'

const CODE = 'a'.repeat(32)
const rpc = vi.fn()
const selectSpy = vi.fn()

function mockDb(row: { requested_at: string; completed_at: string | null } | null) {
  rpc.mockReset(); selectSpy.mockReset()
  rpc.mockResolvedValue({ data: true, error: null })
  vi.mocked(getSupabaseServiceClient).mockReturnValue({
    rpc,
    from: vi.fn(() => ({
      select: vi.fn((cols: string) => {
        selectSpy(cols)
        return { eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: row, error: null })) })) }
      }),
    })),
  } as never)
}

function setHeaders(h: Record<string, string>) {
  vi.mocked(headers).mockResolvedValue(new Headers(h) as never)
}

async function renderPage(params: Record<string, string>) {
  const el = await DataDeletionPage({ searchParams: Promise.resolve(params) })
  return render(el)
}

describe('/data-deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    setHeaders({ 'accept-language': 'en-US,en;q=0.9', 'x-forwarded-for': '203.0.113.7' })
    mockDb({ requested_at: '2026-09-06T10:00:00Z', completed_at: '2026-09-06T10:00:30Z' })
  })

  it('is noindex and out of the sitemap enumerator', async () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
    const { enumerateSiteRoutes } = await import('@/lib/seo/enumerator')
    expect(String(enumerateSiteRoutes)).not.toContain('/data-deletion')
  })

  it('renders both dates and the exact English sentence for a completed request', async () => {
    const { container } = await renderPage({ code: CODE })
    const text = container.textContent ?? ''
    expect(text).toContain('Request received on')
    expect(text).toContain('were deleted on')
    expect(text).toContain('If the site held no data for that account, nothing was stored to delete.')
    expect(text).toContain('The account handle configured in the CMS is kept as site configuration and is not personal data of the requester.')
    expect(text).toContain('A record of this request (account identifier and date) is retained for up to 180 days as proof of processing.')
    expect(selectSpy).toHaveBeenCalledWith('requested_at, completed_at')
  })

  it('says "in progress" — never a date — while completed_at is null', async () => {
    mockDb({ requested_at: '2026-09-06T10:00:00Z', completed_at: null })
    const { container } = await renderPage({ code: CODE })
    const text = container.textContent ?? ''
    expect(text).toContain('Deletion is in progress — this page will show the completion date once it finishes. Please check back in a few minutes.')
    expect(text).not.toContain('were deleted on')
  })

  it('renders the pt-BR text when asked by ?lang and by Accept-Language', async () => {
    const byParam = await renderPage({ code: CODE, lang: 'pt-BR' })
    expect(byParam.container.textContent).toContain('Pedido recebido em')

    setHeaders({ 'accept-language': 'pt-BR,pt;q=0.9' })
    const byHeader = await renderPage({ code: CODE })
    expect(byHeader.container.textContent).toContain('Pedido recebido em')
  })

  it('keeps ?code= when switching languages and shows no related documents', async () => {
    const { getByTestId, queryByTestId } = await renderPage({ code: CODE })
    expect(getByTestId('legal-shell-locale-other-pt-BR').getAttribute('href')).toBe(`?code=${CODE}&lang=pt-BR`)
    expect(queryByTestId('legal-shell-toc')).toBeNull()
  })

  it('answers generically WITHOUT touching the database for a malformed code', async () => {
    const { container } = await renderPage({ code: 'not-a-code' })
    expect(selectSpy).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
    expect(container.textContent).toContain('If the site held no data for that account, nothing was stored to delete.')
    expect(container.textContent).not.toContain('Request received on')
  })

  it('answers generically for an unknown code', async () => {
    mockDb(null)
    const { container } = await renderPage({ code: 'b'.repeat(32) })
    expect(container.textContent).not.toContain('Request received on')
  })

  it('salts the rate-limit key with CRON_SECRET, per IP and per UTC day', async () => {
    await renderPage({ code: CODE })
    const key = (rpc.mock.calls[0]?.[1] as { p_key: string }).p_key
    const day = new Date().toISOString().slice(0, 10)
    const salted = createHash('sha256').update(`cron-secret|203.0.113.7|${day}`).digest('hex')
    const unsalted = createHash('sha256').update(`203.0.113.7|${day}`).digest('hex')
    expect(key).toBe(`ddpage:${salted}`)
    expect(key).not.toContain(unsalted)
    expect((rpc.mock.calls[0]?.[1] as { p_min_interval: string }).p_min_interval).toBe('2 seconds')

    setHeaders({ 'x-forwarded-for': '198.51.100.9' })
    await renderPage({ code: CODE })
    expect((rpc.mock.calls[1]?.[1] as { p_key: string }).p_key).not.toBe(key)
  })

  it('answers generically when the rate limit denies, and fails open when the claim throws', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    const denied = await renderPage({ code: CODE })
    expect(denied.container.textContent).not.toContain('Request received on')
    expect(selectSpy).not.toHaveBeenCalled()

    mockDb({ requested_at: '2026-09-06T10:00:00Z', completed_at: '2026-09-06T10:00:30Z' })
    rpc.mockRejectedValue(new Error('rpc down'))
    const open = await renderPage({ code: CODE })
    expect(open.container.textContent).toContain('Request received on')
  })

  it('skips the claim entirely (and still serves the page) without CRON_SECRET', async () => {
    delete process.env.CRON_SECRET
    const { container } = await renderPage({ code: CODE })
    expect(rpc).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Request received on')
  })
})

describe('next.config.ts — /data-deletion headers', () => {
  it('declares a dedicated Referrer-Policy: no-referrer entry after the global block', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    // DESVIO do plano: `import.meta.url` não é uma URL `file:` sob o transform do
    // Vite (`The URL must be of scheme file`). `process.cwd()` é `apps/web` no
    // runner — o mesmo caminho usado por `test/middleware/*`.
    const src = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
    const globalIdx = src.indexOf("source: '/(.*)'")
    const entryIdx = src.indexOf("source: '/data-deletion'")
    expect(entryIdx).toBeGreaterThan(globalIdx)
    const entry = src.slice(entryIdx, entryIdx + 320)
    expect(entry).toContain('no-referrer')
    expect(entry).toContain('Referrer-Policy')
  })
})
