import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { TestSendCard } from '@/app/cms/(authed)/newsletters/_tabs/test-center/test-send-card'
import { en } from '@/app/cms/(authed)/newsletters/_i18n/en'

vi.mock('lucide-react', () => ({
  Mail: (p: Record<string, unknown>) => <span data-testid="icon-mail" {...p} />,
  Send: (p: Record<string, unknown>) => <span data-testid="icon-send" {...p} />,
  Loader2: (p: Record<string, unknown>) => <span data-testid="icon-loader" {...p} />,
  CheckCircle2: (p: Record<string, unknown>) => <span data-testid="icon-check" {...p} />,
}))

const tc = en.testCenter
const USER_EMAIL = 'admin@test.com'

function renderCard(overrides: { userEmail?: string; onSend?: (toEmail: string) => Promise<{ ok: true } | { ok: false; error: string }> } = {}) {
  const onSend = overrides.onSend ?? vi.fn().mockResolvedValue({ ok: true })
  return {
    onSend,
    ...render(<TestSendCard userEmail={overrides.userEmail ?? USER_EMAIL} onSend={onSend} strings={tc} />),
  }
}

describe('TestSendCard', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  // ─── Idle state ──────────────────────────────────────────────────────────

  it('renders with userEmail as default input value', () => {
    renderCard()
    const input = screen.getByLabelText(tc.recipientLabel) as HTMLInputElement
    expect(input.value).toBe(USER_EMAIL)
  })

  it('can change recipient email via input', () => {
    renderCard()
    const input = screen.getByLabelText(tc.recipientLabel) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'new@test.com' } })
    expect(input.value).toBe('new@test.com')
  })

  it('send button shows sendTestEmail in idle state', () => {
    renderCard()
    expect(screen.getByRole('button').textContent).toContain(tc.sendTestEmail)
  })

  // ─── Send flow ───────────────────────────────────────────────────────────

  it('clicking send calls onSend with current recipient', async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: true })
    renderCard({ onSend })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(onSend).toHaveBeenCalledWith(USER_EMAIL)
  })

  it('sends changed recipient email to onSend', async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: true })
    renderCard({ onSend })

    const input = screen.getByLabelText(tc.recipientLabel)
    fireEvent.change(input, { target: { value: 'custom@test.com' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(onSend).toHaveBeenCalledWith('custom@test.com')
  })

  it('sending state: button disabled + shows loading text', async () => {
    const onSend = vi.fn().mockReturnValue(new Promise(() => {}))
    renderCard({ onSend })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const button = screen.getByRole('button') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.textContent).toContain(tc.sending)
  })

  it('success state: after ok resolves, shows testSent', async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: true })
    renderCard({ onSend })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(screen.getByRole('button').textContent).toContain(tc.testSent)
  })

  // ─── Timer transitions ──────────────────────────────────────────────────

  it('success → cooldown after 2000ms', async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: true })
    renderCard({ onSend })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(screen.getByRole('button').textContent).toContain(tc.testSent)

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByRole('button').textContent).toContain(tc.waitCooldown)
  })

  it('cooldown countdown decrements on tick', async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: true })
    renderCard({ onSend })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    const getText = () => screen.getByRole('button').textContent
    expect(getText()).toContain('60s')

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(getText()).toContain('59s')
  })

  it('error → idle recovery after 3000ms', async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: false, error: 'forbidden' })
    renderCard({ onSend })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(screen.getByRole('button').textContent).toContain(tc.failedToSend)

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByRole('button').textContent).toContain(tc.sendTestEmail)
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false)
  })

  // ─── Error handling ──────────────────────────────────────────────────────

  it('forbidden error shows errorForbidden in aria-live region', async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: false, error: 'forbidden' })
    renderCard({ onSend })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const liveRegion = document.querySelector('[aria-live="polite"]')!
    expect(liveRegion.textContent).toContain(tc.errorForbidden)
  })

  it('rate_limited triggers cooldown directly (no success flash)', async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: false, error: 'rate_limited' })
    renderCard({ onSend })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(screen.getByRole('button').textContent).toContain(tc.waitCooldown)
  })

  it('hourly_limit_exceeded triggers cooldown directly', async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: false, error: 'hourly_limit_exceeded' })
    renderCard({ onSend })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(screen.getByRole('button').textContent).toContain(tc.waitCooldown)
  })

  it('onSend throws → shows unexpectedError', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('network'))
    renderCard({ onSend })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const liveRegion = document.querySelector('[aria-live="polite"]')!
    expect(liveRegion.textContent).toContain(tc.unexpectedError)
  })

  it('invalid_email error shows invalidEmail message', async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: false, error: 'invalid_email' })
    renderCard({ onSend })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const liveRegion = document.querySelector('[aria-live="polite"]')!
    expect(liveRegion.textContent).toContain(tc.invalidEmail)
  })

  it('email_send_failed shows failedToSend message', async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: false, error: 'email_send_failed' })
    renderCard({ onSend })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const liveRegion = document.querySelector('[aria-live="polite"]')!
    expect(liveRegion.textContent).toContain(tc.failedToSend)
  })

  // ─── Edge cases ──────────────────────────────────────────────────────────

  it('button disabled when recipient empty or whitespace-only', () => {
    renderCard()
    const input = screen.getByLabelText(tc.recipientLabel)
    fireEvent.change(input, { target: { value: '   ' } })
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('has aria-live="polite" and aria-live="assertive" regions', () => {
    renderCard()
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy()
    expect(document.querySelector('[aria-live="assertive"]')).toBeTruthy()
  })

  it('unmount during send does not throw', async () => {
    const onSend = vi.fn().mockReturnValue(new Promise(() => {}))
    const { unmount } = renderCard({ onSend })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    unmount()
  })
})
