import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock the package component — test only that the consumer wires it correctly
const mockAdminLogin = vi.fn((_props: unknown) => (
  <div data-testid="admin-login-component">AdminLogin mounted</div>
))
vi.mock('@tn-figueiredo/admin/login', () => ({
  AdminLogin: (props: unknown) => mockAdminLogin(props),
  AdminForgotPassword: (_props: unknown) => <div data-testid="admin-forgot-component">AdminForgotPassword mounted</div>,
  AdminResetPassword: (_props: unknown) => <div data-testid="admin-reset-component">AdminResetPassword mounted</div>,
}))

// Mock the actions re-exports (these are 'use server' — cannot run in vitest)
vi.mock('../../src/app/admin/login/actions', () => ({
  signInWithPassword: vi.fn(),
  signInWithGoogle: vi.fn(),
}))
vi.mock('../../src/app/admin/forgot/actions', () => ({
  forgotPassword: vi.fn(),
}))
vi.mock('../../src/app/admin/reset/actions', () => ({
  resetPassword: vi.fn(),
}))

import AdminLoginPage from '../../src/app/admin/login/page'
import AdminForgotPage from '../../src/app/admin/forgot/page'
import AdminResetPage from '../../src/app/admin/reset/page'

describe('admin login pages', () => {
  it('mounts <AdminLogin> with actions and optional turnstile prop', () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-key'
    render(<AdminLoginPage />)
    expect(screen.getByTestId('admin-login-component')).toBeTruthy()
    const callProps = mockAdminLogin.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callProps).toHaveProperty('actions')
    expect(callProps).toHaveProperty('turnstile')
    expect((callProps.turnstile as { siteKey: string }).siteKey).toBe('test-key')
  })

  it('passes undefined turnstile when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset', () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    mockAdminLogin.mockClear()
    render(<AdminLoginPage />)
    const callProps = mockAdminLogin.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callProps.turnstile).toBeUndefined()
  })

  it('mounts <AdminForgotPassword>', () => {
    render(<AdminForgotPage />)
    expect(screen.getByTestId('admin-forgot-component')).toBeTruthy()
  })

  it('mounts <AdminResetPassword>', () => {
    render(<AdminResetPage />)
    expect(screen.getByTestId('admin-reset-component')).toBeTruthy()
  })
})
