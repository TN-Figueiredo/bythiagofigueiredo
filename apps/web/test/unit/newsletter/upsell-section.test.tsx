import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { SubscribeForm } from '@/app/(public)/newsletters/[slug]/subscribe-form'
import type { ScoredSuggestion } from '@/lib/newsletter/suggestions'

// ── Shared fixtures ──────────────────────────────────────────────────────────

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
  submitting: 'Sending...',
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

const suggestionStrings = {
  moreNewsletters: 'More newsletters',
  anotherNewsletter: 'Another newsletter',
  youMightAlsoLike: 'You might also like',
  addNewsletter: '+ Add',
  addedNewsletter: 'Added!',
  subscribedToAll: "You're subscribed to everything!",
  upsellTitle: 'While you wait...',
  allNewsletters: 'See all newsletters',
}

function makeSuggestion(overrides: Partial<ScoredSuggestion> = {}): ScoredSuggestion {
  return {
    id: 'sugg-1',
    slug: 'other-newsletter',
    name: 'Other Newsletter',
    tagline: 'A great tagline',
    cadence_label: 'Weekly',
    cadence_days: 7,
    cadence_start_date: null,
    color: '#3B82F6',
    color_dark: null,
    locale: 'en',
    created_at: '2025-01-01T00:00:00Z',
    subscriber_count: 50,
    last_sent_at: null,
    score: 0.6,
    ...overrides,
  }
}

async function submitAndWaitForPending(
  onSubscribe = vi.fn().mockResolvedValue({ success: true }),
  suggestions: ScoredSuggestion[] = [makeSuggestion()],
) {
  render(
    <SubscribeForm
      newsletterId="main-en"
      locale="en"
      accentColor="#C14513"
      newsletterName="Main Newsletter"
      strings={defaultStrings}
      privacyHref="/privacy"
      onSubscribe={onSubscribe}
      suggestions={suggestions}
      suggestionStrings={suggestionStrings}
      currentSlug="main"
    />,
  )

  const input = screen.getByLabelText('Your email') as HTMLInputElement
  const checkbox = screen.getByRole('checkbox')
  fireEvent.change(input, { target: { value: 'test@example.com' } })
  fireEvent.click(checkbox)
  fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }))

  await waitFor(() => {
    expect(screen.getByText('Check your inbox')).toBeDefined()
  })

  return onSubscribe
}

// ── UpsellSection tests (rendered inside SubscribeForm) ──────────────────────

describe('UpsellSection (within SubscribeForm)', () => {
  it('renders upsell section in pending phase when suggestions are provided', async () => {
    await submitAndWaitForPending()

    expect(screen.getByText('While you wait...')).toBeDefined()
    expect(screen.getByText('Other Newsletter')).toBeDefined()
    expect(screen.getByText('+ Add')).toBeDefined()
  })

  it('does not render upsell section when no suggestions', async () => {
    await submitAndWaitForPending(
      vi.fn().mockResolvedValue({ success: true }),
      [],
    )

    expect(screen.queryByText('While you wait...')).toBeNull()
  })

  it('shows "Added!" state after clicking +Add button', async () => {
    const onSubscribe = vi.fn()
      .mockResolvedValueOnce({ success: true }) // main subscribe
      .mockResolvedValueOnce({ success: true, subscribedIds: ['sugg-1'] }) // add suggestion

    await submitAndWaitForPending(onSubscribe, [makeSuggestion()])

    // Click the +Add button
    const addBtn = screen.getByText('+ Add')
    fireEvent.click(addBtn)

    await waitFor(() => {
      // After successful add, should show "subscribed to everything" since it was the only suggestion
      expect(screen.getByText(suggestionStrings.subscribedToAll)).toBeDefined()
    })
  })

  it('shows "subscribed to everything" when all suggestions have been added', async () => {
    const suggestions = [
      makeSuggestion({ id: 'sugg-1', name: 'Newsletter A' }),
      makeSuggestion({ id: 'sugg-2', name: 'Newsletter B' }),
    ]
    const onSubscribe = vi.fn()
      .mockResolvedValueOnce({ success: true }) // main subscribe
      .mockResolvedValueOnce({ success: true, subscribedIds: ['sugg-1'] }) // add first
      .mockResolvedValueOnce({ success: true, subscribedIds: ['sugg-2'] }) // add second

    await submitAndWaitForPending(onSubscribe, suggestions)

    // Add first newsletter
    const addBtns = screen.getAllByText('+ Add')
    fireEvent.click(addBtns[0]!)

    await waitFor(() => {
      // First add completes, second still available
      expect(screen.getByText('Newsletter B')).toBeDefined()
    })

    // Add second newsletter
    const remainingBtn = screen.getByText('+ Add')
    fireEvent.click(remainingBtn)

    await waitFor(() => {
      expect(screen.getByText(suggestionStrings.subscribedToAll)).toBeDefined()
    })
  })
})
