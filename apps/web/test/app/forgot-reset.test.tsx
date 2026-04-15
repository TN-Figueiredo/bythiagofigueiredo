import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock @supabase/ssr createBrowserClient
const mockResetPasswordForEmail = vi.fn()
const mockUpdateUser = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser: mockUpdateUser,
    },
  })),
}))

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import ForgotPage from '../../src/app/signin/forgot/page'
import ResetPage from '../../src/app/signin/reset/page'

describe('ForgotPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  it('renders the forgot password form', () => {
    render(<ForgotPage />)
    expect(screen.getByRole('heading', { name: /Esqueci minha senha/i })).toBeTruthy()
    expect(screen.getByPlaceholderText('Email')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Enviar link/i })).toBeTruthy()
  })

  it('calls resetPasswordForEmail and shows success message on submit', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
    render(<ForgotPage />)

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enviar link/i }))

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
        redirectTo: expect.stringContaining('/signin/reset'),
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/Verifique seu email pra redefinir a senha/i)).toBeTruthy()
    })
  })

  it('shows error message when resetPasswordForEmail fails', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'Email not found' } })
    render(<ForgotPage />)

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'unknown@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enviar link/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText('Email not found')).toBeTruthy()
    })
  })
})

describe('ResetPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  it('renders the reset password form', () => {
    render(<ResetPage />)
    expect(screen.getByRole('heading', { name: /Nova senha/i })).toBeTruthy()
    expect(screen.getByPlaceholderText('Nova senha')).toBeTruthy()
    expect(screen.getByPlaceholderText('Confirme')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Atualizar senha/i })).toBeTruthy()
  })

  it('shows error when passwords do not match', async () => {
    render(<ResetPage />)

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

  it('calls updateUser and redirects to /cms on success', async () => {
    mockUpdateUser.mockResolvedValue({ error: null })
    render(<ResetPage />)

    fireEvent.change(screen.getByPlaceholderText('Nova senha'), {
      target: { value: 'newpassword123' },
    })
    fireEvent.change(screen.getByPlaceholderText('Confirme'), {
      target: { value: 'newpassword123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Atualizar senha/i }))

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpassword123' })
      expect(mockPush).toHaveBeenCalledWith('/cms')
    })
  })

  it('shows error when updateUser fails', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'Token expired' } })
    render(<ResetPage />)

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
    expect(mockPush).not.toHaveBeenCalled()
  })
})
