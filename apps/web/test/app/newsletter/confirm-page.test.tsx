import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ─── Hoisted spies (available inside vi.mock factories) ──────────────────────

const { revalidateTagSpy, captureServerActionErrorSpy, fromMock, rpcMock } =
  vi.hoisted(() => ({
    revalidateTagSpy: vi.fn(),
    captureServerActionErrorSpy: vi.fn(),
    fromMock: vi.fn(),
    rpcMock: vi.fn(),
  }))

// ─── Module mocks (before imports) ───────────────────────────────────────────

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}))

vi.mock('next/cache', () => ({
  revalidateTag: revalidateTagSpy,
}))

vi.mock('../../../src/lib/sentry-wrap', () => ({
  captureServerActionError: captureServerActionErrorSpy,
}))

// ─── Import (after mocks) ────────────────────────────────────────────────────

import ConfirmPage from '../../../src/app/newsletter/confirm/[token]/page'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ctx(token: string) {
  return { params: Promise.resolve({ token }) }
}

/** Build a chainable from().select().eq().maybeSingle() mock */
function makeSelectChain(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default locale lookup: returns pt-BR
  fromMock.mockReturnValue(
    makeSelectChain({ data: { locale: 'pt-BR' }, error: null }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('/newsletter/confirm/[token] page', () => {
  it('renders invalid state when token is empty', async () => {
    const jsx = await ConfirmPage(ctx(''))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Link inválido')).toBeTruthy()
  })

  it('renders not_found state when RPC returns ok=false, error=not_found', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: false, error: 'not_found' },
      error: null,
    })

    const jsx = await ConfirmPage(ctx('some-valid-token'))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Link não encontrado')).toBeTruthy()
  })

  it('renders expired state when RPC returns ok=false, error=expired', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: false, error: 'expired' },
      error: null,
    })

    const jsx = await ConfirmPage(ctx('expired-token'))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Link expirado')).toBeTruthy()
  })

  it('renders already-confirmed state when RPC returns ok=true, already=true', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: true, already: true, site_id: 'site-1', email: 'a@b.com' },
      error: null,
    })

    const jsx = await ConfirmPage(ctx('already-token'))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Já confirmado')).toBeTruthy()
  })

  it('renders success state and calls revalidateTag on fresh confirmation', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: true, site_id: 'site-1', email: 'a@b.com' },
      error: null,
    })

    const jsx = await ConfirmPage(ctx('fresh-token'))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Inscrição confirmada!')).toBeTruthy()
    expect(revalidateTagSpy).toHaveBeenCalledWith('newsletter-suggestions')
  })

  it('renders error state and calls captureServerActionError on RPC error', async () => {
    const rpcError = { message: 'db timeout', code: '57014' }
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: rpcError,
    })

    const jsx = await ConfirmPage(ctx('error-token'))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Erro ao confirmar')).toBeTruthy()
    expect(captureServerActionErrorSpy).toHaveBeenCalledWith(
      rpcError,
      expect.objectContaining({ action: 'confirm_newsletter' }),
    )
  })
})
