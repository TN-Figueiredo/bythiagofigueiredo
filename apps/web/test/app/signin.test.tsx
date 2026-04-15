import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// Mock next/navigation before importing the component
const mockPush = vi.fn()
const mockRefresh = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => mockSearchParams,
}))

// Mock server actions
const mockSignInWithPassword = vi.fn()
const mockSignInWithGoogle = vi.fn()

vi.mock('../../src/app/signin/actions', () => ({
  signInWithPasswordAction: (...args: unknown[]) => mockSignInWithPassword(...args),
  signInWithGoogleAction: (...args: unknown[]) => mockSignInWithGoogle(...args),
}))

import SignInPage from '../../src/app/signin/page'

let turnstileReset: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockPush.mockReset()
  mockRefresh.mockReset()
  mockSignInWithPassword.mockReset()
  mockSignInWithGoogle.mockReset()
  mockSearchParams = new URLSearchParams()

  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-site-key'

  turnstileReset = vi.fn()
  ;(window as unknown as { turnstile: unknown }).turnstile = {
    render: (_el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }) => {
      opts.callback('TOKEN_XYZ')
      return 'widget-id'
    },
    reset: turnstileReset,
  }

  // Simulate script onload firing
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

describe('<SignInPage>', () => {
  it('renders email, password fields and Google button', async () => {
    render(<SignInPage />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Senha')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Entrar com Google/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Entrar$/i })).toBeTruthy()
  })

  it('submit button is disabled when token is not yet set', () => {
    // Override: render will NOT simulate turnstile
    delete (window as unknown as { turnstile?: unknown }).turnstile
    render(<SignInPage />)
    const btn = screen.getByRole('button', { name: /^Entrar$/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows error when submitted without turnstile token', async () => {
    // Clear turnstile so token stays null
    delete (window as unknown as { turnstile?: unknown }).turnstile
    vi.restoreAllMocks() // stop appendChild mock

    render(<SignInPage />)
    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'secret123' } })

    fireEvent.submit(screen.getByRole('button', { name: /^Entrar$/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
    expect(mockSignInWithPassword).not.toHaveBeenCalled()
  })

  it('calls signInWithPasswordAction with email, password, and turnstile token', async () => {
    mockSignInWithPassword.mockResolvedValue({ ok: true })

    render(<SignInPage />)

    // Let the Turnstile onload fire
    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'mypassword' } })

    fireEvent.click(screen.getByRole('button', { name: /^Entrar$/i }))

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'mypassword',
        turnstileToken: 'TOKEN_XYZ',
      })
    })
  })

  it('navigates to /cms after successful sign-in', async () => {
    mockSignInWithPassword.mockResolvedValue({ ok: true })

    render(<SignInPage />)
    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'mypassword' } })
    fireEvent.click(screen.getByRole('button', { name: /^Entrar$/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/cms')
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('respects ?redirect param for post-signin navigation', async () => {
    mockSearchParams = new URLSearchParams('redirect=/admin')
    mockSignInWithPassword.mockResolvedValue({ ok: true })

    render(<SignInPage />)
    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'pass' } })
    fireEvent.click(screen.getByRole('button', { name: /^Entrar$/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin')
    })
  })

  it('shows error message and resets turnstile on failed sign-in', async () => {
    mockSignInWithPassword.mockResolvedValue({ ok: false, error: 'Email ou senha incorretos' })

    render(<SignInPage />)
    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bad@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByRole('button', { name: /^Entrar$/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
    expect(screen.getByRole('alert').textContent).toBe('Email ou senha incorretos')
    expect(turnstileReset).toHaveBeenCalledWith('widget-id')
  })

  it('pre-fills email from ?hint query param', async () => {
    mockSearchParams = new URLSearchParams('hint=invited@example.com')

    render(<SignInPage />)
    await act(async () => {
      await Promise.resolve()
    })

    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('invited@example.com')
  })

  it('calls signInWithGoogleAction and redirects to OAuth URL', async () => {
    const googleUrl = 'https://accounts.google.com/oauth?foo=bar'
    mockSignInWithGoogle.mockResolvedValue({ ok: true, url: googleUrl })

    const originalLocation = window.location
    const hrefSetter = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      get: () => ({ ...originalLocation, set href(v: string) { hrefSetter(v) } }),
    })

    render(<SignInPage />)
    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.click(screen.getByRole('button', { name: /Entrar com Google/i }))

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalledWith({ redirectTo: '/cms' })
    })

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  })

  it('shows error on failed Google sign-in', async () => {
    // I9: action now returns generic 'Falha ao iniciar login com Google'
    mockSignInWithGoogle.mockResolvedValue({ ok: false, error: 'Falha ao iniciar login com Google' })

    render(<SignInPage />)
    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.click(screen.getByRole('button', { name: /Entrar com Google/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Falha ao iniciar login com Google')
    })
  })
})
