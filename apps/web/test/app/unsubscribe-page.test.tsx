import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ─── Hoisted spies ──────────────────────────────────────────────────────────

const { captureServerActionErrorSpy, fromMock, rpcMock } = vi.hoisted(() => ({
  captureServerActionErrorSpy: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}))

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}))

vi.mock('../../src/lib/sentry-wrap', () => ({
  captureServerActionError: captureServerActionErrorSpy,
}))

// ─── Import ─────────────────────────────────────────────────────────────────

import UnsubscribePage from '../../src/app/unsubscribe/[token]/page'

// ─── Helpers ────────────────────────────────────────────────────────────────

function ctx(token: string, confirmed?: string) {
  return {
    params: Promise.resolve({ token }),
    searchParams: Promise.resolve(confirmed !== undefined ? { confirmed } : {}),
  }
}

function makeSelectChain(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  fromMock.mockReturnValue(
    makeSelectChain({ data: { locale: 'pt-BR' }, error: null }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('/unsubscribe/[token] page', () => {
  it('renders invalid state when token is empty', async () => {
    const jsx = await UnsubscribePage(ctx(''))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Link inválido')).toBeTruthy()
  })

  it('renders initial state with confirm button on GET (no confirmed param)', async () => {
    const jsx = await UnsubscribePage(ctx('valid-token'))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Cancelar inscrição')).toBeTruthy()
    expect(screen.getByText('Cancelar minha inscrição')).toBeTruthy()
  })

  it('renders ok state with signoff and manage link on confirmed=ok', async () => {
    const jsx = await UnsubscribePage(ctx('valid-token', 'ok'))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Cancelamento confirmado')).toBeTruthy()
    expect(screen.getByText(/Sem ressentimentos/)).toBeTruthy()
    const manageLink = screen.getByText('Gerenciar preferências')
    expect(manageLink).toBeTruthy()
    expect(manageLink.getAttribute('href')).toBe('/pt/newsletter')
  })

  it('renders already state with manage link on confirmed=already', async () => {
    const jsx = await UnsubscribePage(ctx('valid-token', 'already'))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Já cancelado')).toBeTruthy()
    expect(screen.getByText('Gerenciar preferências')).toBeTruthy()
  })

  it('renders not_found state on confirmed=not_found', async () => {
    const jsx = await UnsubscribePage(ctx('valid-token', 'not_found'))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Link não encontrado')).toBeTruthy()
  })

  it('renders error state on confirmed=error', async () => {
    const jsx = await UnsubscribePage(ctx('valid-token', 'error'))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Erro ao processar')).toBeTruthy()
  })

  it('rejects invalid confirmed values and shows initial state', async () => {
    const jsx = await UnsubscribePage(ctx('valid-token', 'hacked'))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Cancelar inscrição')).toBeTruthy()
    expect(screen.queryByText('Cancelamento confirmado')).toBeNull()
  })

  it('renders English copy when locale is en', async () => {
    fromMock.mockReturnValue(
      makeSelectChain({ data: { locale: 'en' }, error: null }),
    )
    const jsx = await UnsubscribePage(ctx('valid-token', 'ok'))
    render(jsx as React.ReactElement)
    expect(screen.getByText('Unsubscribe confirmed')).toBeTruthy()
    const manageLink = screen.getByText('Manage preferences')
    expect(manageLink).toBeTruthy()
    expect(manageLink.getAttribute('href')).toBe('/newsletter')
  })

  it('does not render manage link on error/not_found states', async () => {
    const jsx = await UnsubscribePage(ctx('valid-token', 'error'))
    render(jsx as React.ReactElement)
    expect(screen.queryByText('Gerenciar preferências')).toBeNull()
  })

  it('has noindex robots meta and force-dynamic', async () => {
    const mod = await import('../../src/app/unsubscribe/[token]/page')
    expect(mod.metadata.robots).toEqual({ index: false, follow: false })
    expect(mod.dynamic).toBe('force-dynamic')
  })
})
