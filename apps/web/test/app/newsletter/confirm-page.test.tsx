import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ─── Hoisted spies (available inside vi.mock factories) ──────────────────────

const { captureServerActionErrorSpy, fromMock, rpcMock } =
  vi.hoisted(() => ({
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
  revalidateTag: vi.fn(),
}))

vi.mock('next/server', () => ({
  after: (fn: () => void) => fn(),
}))

vi.mock('../../../src/lib/sentry-wrap', () => ({
  captureServerActionError: captureServerActionErrorSpy,
}))

// Mock the ConfirmFlow client component to avoid 'use client' issues in tests
vi.mock('../../../src/app/newsletter/confirm/[token]/confirm-flow', () => ({
  ConfirmFlow: ({ token, copy }: { token: string; copy: { confirm_button: string; confirm_body: string }; locale: string }) =>
    React.createElement('div', { 'data-testid': 'confirm-flow' },
      React.createElement('p', null, copy.confirm_body),
      React.createElement('button', { type: 'button' }, copy.confirm_button),
    ),
}))

// ─── Import (after mocks) ────────────────────────────────────────────────────

import ConfirmPage from '../../../src/app/newsletter/confirm/[token]/page'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Valid 64-char hex tokens for tests (format: crypto.randomBytes(32).toString('hex')) */
const TOKENS = {
  nonexistent: 'aa' + '0'.repeat(62),
  expired:     'bb' + '0'.repeat(62),
  already:     'cc' + '0'.repeat(62),
  valid:       'dd' + '0'.repeat(62),
  en:          'ee' + '0'.repeat(62),
  error:       'ff' + '0'.repeat(62),
} as const

function ctx(token: string) {
  return { params: Promise.resolve({ token }) }
}

/** Build a chainable from().select().eq().maybeSingle() mock */
function makeSelectChain(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default locale lookup: returns pending subscription with pt-BR
  fromMock.mockReturnValue(
    makeSelectChain({
      data: {
        locale: 'pt-BR',
        status: 'pending_confirmation',
        confirmation_expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      error: null,
    }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('/newsletter/confirm/[token] page (two-step flow)', () => {
  it('renders invalid state when token is empty', async () => {
    const jsx = await ConfirmPage(ctx(''))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Link inválido')).toBeTruthy()
  })

  it('renders invalid state when token has wrong format (not 64 hex chars)', async () => {
    const jsx = await ConfirmPage(ctx('not-a-valid-hex-token'))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Link inválido')).toBeTruthy()
  })

  it('renders not_found state when token does not exist in DB', async () => {
    fromMock.mockReturnValue(
      makeSelectChain({ data: null, error: null }),
    )

    const jsx = await ConfirmPage(ctx(TOKENS.nonexistent))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Link não encontrado')).toBeTruthy()
  })

  it('renders expired state when token is expired', async () => {
    fromMock.mockReturnValue(
      makeSelectChain({
        data: {
          locale: 'pt-BR',
          status: 'pending_confirmation',
          confirmation_expires_at: new Date(Date.now() - 86400000).toISOString(),
        },
        error: null,
      }),
    )

    const jsx = await ConfirmPage(ctx(TOKENS.expired))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Link expirado')).toBeTruthy()
  })

  it('renders already-confirmed state when subscription is confirmed', async () => {
    fromMock.mockReturnValue(
      makeSelectChain({
        data: {
          locale: 'pt-BR',
          status: 'confirmed',
          confirmation_expires_at: new Date(Date.now() + 86400000).toISOString(),
        },
        error: null,
      }),
    )

    const jsx = await ConfirmPage(ctx(TOKENS.already))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Já confirmado')).toBeTruthy()
  })

  it('renders confirm prompt with button for valid pending token', async () => {
    const jsx = await ConfirmPage(ctx(TOKENS.valid))
    render(jsx as React.ReactElement)
    expect(screen.getByRole('heading', { name: 'Confirmar inscrição' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar inscrição' })).toBeTruthy()
  })

  it('renders confirm prompt with English text when locale is "en"', async () => {
    fromMock.mockReturnValue(
      makeSelectChain({
        data: {
          locale: 'en',
          status: 'pending_confirmation',
          confirmation_expires_at: new Date(Date.now() + 86400000).toISOString(),
        },
        error: null,
      }),
    )

    const jsx = await ConfirmPage(ctx(TOKENS.en))
    render(jsx as React.ReactElement)
    expect(screen.getByRole('heading', { name: 'Confirm subscription' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm subscription' })).toBeTruthy()
  })

  it('shows confirm prompt when DB query throws (best-effort fallback)', async () => {
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockRejectedValue(new Error('network')),
    })

    const jsx = await ConfirmPage(ctx(TOKENS.error))
    render(jsx as React.ReactElement)
    // Should still show the prompt — server action will handle the error
    expect(screen.getByRole('heading', { name: 'Confirmar inscrição' })).toBeTruthy()
  })

  it('does not call RPC on GET (scanner protection)', async () => {
    const jsx = await ConfirmPage(ctx(TOKENS.valid))
    render(jsx as React.ReactElement)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('exports metadata with robots noindex and dynamic=force-dynamic', async () => {
    const mod = await import('../../../src/app/newsletter/confirm/[token]/page')
    expect(mod.metadata.robots).toEqual({ index: false, follow: false })
    expect(mod.dynamic).toBe('force-dynamic')
  })
})
