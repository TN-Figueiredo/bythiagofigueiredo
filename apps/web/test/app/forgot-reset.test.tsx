import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ── Mock forgot/actions server action ────────────────────────────────────────
const mockForgotPasswordAction = vi.fn()
vi.mock('../../src/app/signin/forgot/actions', () => ({
  forgotPasswordAction: (...args: unknown[]) => mockForgotPasswordAction(...args),
}))

// ── Mock @supabase/ssr createBrowserClient (for reset page) ──────────────────
const mockUpdateUser = vi.fn()
const mockOnAuthStateChange = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      updateUser: mockUpdateUser,
      onAuthStateChange: mockOnAuthStateChange,
    },
  })),
}))

// ── Mock next/navigation ─────────────────────────────────────────────────────
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import ForgotPage from '../../src/app/signin/forgot/page'
import ResetPage from '../../src/app/signin/reset/page'

// ── Turnstile simulation helpers ─────────────────────────────────────────────
let turnstileCallback: ((token: string) => void) | null = null

function simulateTurnstile() {
  ;(window as unknown as { turnstile: unknown }).turnstile = {
    render: (_el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }) => {
      turnstileCallback = opts.callback
      opts.callback('TOKEN_XYZ')
      return 'widget-id'
    },
    reset: vi.fn(),
  }
  const origAppend = document.head.appendChild.bind(document.head)
  vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
    const el = node as HTMLScriptElement
    if (el.tagName === 'SCRIPT' && typeof el.onload === 'function') {
      queueMicrotask(() => (el.onload as () => void)())
    }
    return origAppend(node)
  })
}

// ── ForgotPage ────────────────────────────────────────────────────────────────

describe('ForgotPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    turnstileCallback = null
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-site-key'
    simulateTurnstile()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (window as unknown as { turnstile?: unknown }).turnstile
  })

  it('renders the forgot password form with Turnstile', async () => {
    render(<ForgotPage />)
    await act(async () => { await Promise.resolve() })
    expect(screen.getByLabelText(/email/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Enviar link/i })).toBeTruthy()
  })

  it('submit button is disabled when token is not present', () => {
    delete (window as unknown as { turnstile?: unknown }).turnstile
    vi.restoreAllMocks()
    render(<ForgotPage />)
    const btn = screen.getByRole('button', { name: /Enviar link/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows generic success message on success — regardless of email (C2 enum-resistant)', async () => {
    mockForgotPasswordAction.mockResolvedValue({ ok: true })
    render(<ForgotPage />)
    await act(async () => { await Promise.resolve() })

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'known@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enviar link/i }))

    await waitFor(() => {
      expect(screen.getByText(/Se essa conta existir/i)).toBeTruthy()
    })
    // No mention of account existence
    expect(screen.queryByText(/não encontrado/i)).toBeNull()
    expect(screen.queryByText(/não existe/i)).toBeNull()
  })

  it('shows same success message for unknown email as for known email (C2 no enumeration)', async () => {
    // Both return ok:true — action itself never surfaces the real error
    mockForgotPasswordAction.mockResolvedValue({ ok: true })
    render(<ForgotPage />)
    await act(async () => { await Promise.resolve() })

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'unknown@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enviar link/i }))

    await waitFor(() => {
      expect(screen.getByText(/Se essa conta existir/i)).toBeTruthy()
    })
  })

  it('calls forgotPasswordAction with email and Turnstile token', async () => {
    mockForgotPasswordAction.mockResolvedValue({ ok: true })
    render(<ForgotPage />)
    await act(async () => { await Promise.resolve() })

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enviar link/i }))

    await waitFor(() => {
      expect(mockForgotPasswordAction).toHaveBeenCalledWith({
        email: 'test@example.com',
        turnstileToken: 'TOKEN_XYZ',
      })
    })
  })

  it('shows anti-bot error when turnstile check fails (ok=false)', async () => {
    mockForgotPasswordAction.mockResolvedValue({ ok: false, error: 'Verificação anti-bot falhou' })
    render(<ForgotPage />)
    await act(async () => { await Promise.resolve() })

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'x@y.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Enviar link/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
  })
})

// ── ResetPage ─────────────────────────────────────────────────────────────────

describe('ResetPage', () => {
  let authStateCallback: ((event: string) => void) | null = null
  let unsubscribeMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    authStateCallback = null
    unsubscribeMock = vi.fn()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

    mockOnAuthStateChange.mockImplementation((cb: (event: string) => void) => {
      authStateCallback = cb
      return { data: { subscription: { unsubscribe: unsubscribeMock } } }
    })
  })

  it('shows blocking message before PASSWORD_RECOVERY event (C4)', () => {
    render(<ResetPage />)
    expect(screen.getByText(/Use o link enviado por email/i)).toBeTruthy()
    expect(screen.queryByPlaceholderText('Nova senha')).toBeNull()
  })

  it('shows form after PASSWORD_RECOVERY event (C4)', async () => {
    render(<ResetPage />)
    // Before event: form not shown
    expect(screen.queryByPlaceholderText('Nova senha')).toBeNull()

    // Fire PASSWORD_RECOVERY
    await act(async () => {
      authStateCallback?.('PASSWORD_RECOVERY')
    })

    expect(screen.getByPlaceholderText('Nova senha')).toBeTruthy()
    expect(screen.getByPlaceholderText('Confirme')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Atualizar senha/i })).toBeTruthy()
  })

  it('shows error when passwords do not match', async () => {
    render(<ResetPage />)
    await act(async () => { authStateCallback?.('PASSWORD_RECOVERY') })

    fireEvent.change(screen.getByPlaceholderText('Nova senha'), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByPlaceholderText('Confirme'), {
      target: { value: 'different456' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Atualizar senha/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText(/Senhas não coincidem/i)).toBeTruthy()
    })
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('shows error when password is too short', async () => {
    render(<ResetPage />)
    await act(async () => { authStateCallback?.('PASSWORD_RECOVERY') })

    fireEvent.change(screen.getByPlaceholderText('Nova senha'), {
      target: { value: 'short' },
    })
    fireEvent.change(screen.getByPlaceholderText('Confirme'), {
      target: { value: 'short' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Atualizar senha/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText(/pelo menos 8 caracteres/i)).toBeTruthy()
    })
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('calls updateUser and does window.location.href redirect on success (I25)', async () => {
    mockUpdateUser.mockResolvedValue({ error: null })

    // Mock window.location.href setter
    const hrefSetter = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, set href(v: string) { hrefSetter(v) } },
    })

    render(<ResetPage />)
    await act(async () => { authStateCallback?.('PASSWORD_RECOVERY') })

    fireEvent.change(screen.getByPlaceholderText('Nova senha'), {
      target: { value: 'newpassword123' },
    })
    fireEvent.change(screen.getByPlaceholderText('Confirme'), {
      target: { value: 'newpassword123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Atualizar senha/i }))

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpassword123' })
    })

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith('/cms')
    })

    // Ensure router.push was NOT used (I25: must be full reload)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows error when updateUser fails', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'Token expired' } })
    render(<ResetPage />)
    await act(async () => { authStateCallback?.('PASSWORD_RECOVERY') })

    fireEvent.change(screen.getByPlaceholderText('Nova senha'), {
      target: { value: 'newpassword123' },
    })
    fireEvent.change(screen.getByPlaceholderText('Confirme'), {
      target: { value: 'newpassword123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Atualizar senha/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText('Token expired')).toBeTruthy()
    })
  })

  it('unsubscribes auth listener on unmount', () => {
    const { unmount } = render(<ResetPage />)
    unmount()
    expect(unsubscribeMock).toHaveBeenCalled()
  })
})
