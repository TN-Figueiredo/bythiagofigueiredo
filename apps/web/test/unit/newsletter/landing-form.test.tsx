import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import { SubscribeForm } from '@/app/(public)/newsletters/[slug]/subscribe-form'

const defaultStrings = {
  stepLabel: 'STEP {current}/{total}',
  formTitle: 'Subscribe',
  formSubtitle: 'Free. No spam. Cancel anytime.',
  emailLabel: 'Your email',
  emailPlaceholder: 'your@email.com',
  consentPrefix: 'I agree to receive ',
  consentSuffix: ' and accept the ',
  privacy: 'Privacy Policy',
  submit: 'Subscribe',
  submitting: 'Sending…',
  noSpam: 'no spam',
  noPitch: 'no pitch',
  oneClickLeave: '1-click leave',
  pendingTitle: 'Check your inbox',
  pendingBody: 'I sent a confirmation link to {email}.',
  pendingStep1: 'Email sent',
  pendingStep2: 'Click the link',
  pendingStep3: "You're in",
  pendingTip: "Don't see it? Check spam.",
  pendingResend: 'resend email',
  pendingResent: 'resent!',
  pendingChangeEmail: 'use another email',
  confirmedTitle: "You're subscribed!",
  confirmedBody: 'You will receive each new edition.',
  confirmedExclamation: 'thanks!',
  successAgain: 'Subscribe another email',
  errorRateLimit: 'Easy there.',
  errorAlreadySubscribed: 'Already subscribed.',
  errorInvalid: 'Email invalid.',
  errorServer: 'Something broke.',
}

function setup(onSubscribe = vi.fn().mockResolvedValue({ success: true })) {
  return render(
    <SubscribeForm
      newsletterId="main-en"
      locale="en"
      accentColor="#C14513"
      newsletterName="The bythiago diary"
      strings={defaultStrings}
      privacyHref="/privacy"
      onSubscribe={onSubscribe}
    />,
  )
}

describe('SubscribeForm', () => {
  it('renders idle phase with email input, consent checkbox, and submit button', () => {
    setup()
    expect(screen.getByLabelText('Your email')).toBeDefined()
    expect(screen.getByRole('checkbox')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDefined()
  })

  it('disables submit when email missing @ or consent unchecked', () => {
    setup()
    const btn = screen.getByRole('button', { name: 'Subscribe' })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables submit when email has @ and consent checked', async () => {
    setup()
    const input = screen.getByLabelText('Your email') as HTMLInputElement
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'test@example.com' } })
    fireEvent.click(checkbox)
    const btn = screen.getByRole('button', { name: 'Subscribe' })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('transitions to pending phase on success', async () => {
    const onSubscribe = vi.fn().mockResolvedValue({ success: true })
    setup(onSubscribe)
    const input = screen.getByLabelText('Your email') as HTMLInputElement
    const checkbox = screen.getByRole('checkbox')
    fireEvent.change(input, { target: { value: 'test@example.com' } })
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }))
    await waitFor(() => {
      expect(screen.getByText('Check your inbox')).toBeDefined()
    })
  })

  it('shows error on action failure', async () => {
    const onSubscribe = vi.fn().mockResolvedValue({ error: 'rate' })
    setup(onSubscribe)
    const input = screen.getByLabelText('Your email') as HTMLInputElement
    const checkbox = screen.getByRole('checkbox')
    fireEvent.change(input, { target: { value: 'test@example.com' } })
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
    })
  })

  it('renders privacy link with correct href and target', () => {
    setup()
    const link = screen.getByText('Privacy Policy') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/privacy')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })
})
