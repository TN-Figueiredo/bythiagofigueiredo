// Sprint 4 H1 — unit tests for the Sentry PII scrubber. These exercise the
// pure helper in isolation; the SDK integration in `sentry.*.config.ts`
// inherits the same behavior via direct import.
import { describe, it, expect } from 'vitest'
import { scrubEmail, scrubEventPii, EMAIL_RE } from '@/lib/sentry-pii'

describe('scrubEmail', () => {
  it('redacts a single email', () => {
    expect(scrubEmail('failed to send to alice@example.com'))
      .toBe('failed to send to <email>')
  })

  it('redacts multiple emails in the same string', () => {
    expect(
      scrubEmail('from=a@b.co to=c@d.co status=bounced'),
    ).toBe('from=<email> to=<email> status=bounced')
  })

  it('handles plus-addressed and dotted locals', () => {
    expect(scrubEmail('user.name+tag@sub.example.co.uk'))
      .toBe('<email>')
  })

  it('leaves strings without emails untouched', () => {
    expect(scrubEmail('connection reset by peer')).toBe('connection reset by peer')
  })

  it('EMAIL_RE is exported for ad-hoc reuse', () => {
    expect(EMAIL_RE.test('x@y.zz')).toBe(true)
  })
})

describe('scrubEventPii', () => {
  it('scrubs event.message', () => {
    const out = scrubEventPii({ message: 'rpc failed for admin@ring.com' })
    expect(out.message).toBe('rpc failed for <email>')
  })

  it('scrubs each exception.values[].value', () => {
    const out = scrubEventPii({
      exception: {
        values: [
          { value: 'duplicate key on user@x.com' },
          { value: 'no email here' },
        ],
      },
    })
    expect(out.exception?.values?.[0]!.value).toBe('duplicate key on <email>')
    expect(out.exception?.values?.[1]!.value).toBe('no email here')
  })

  it('scrubs each breadcrumb.message', () => {
    const out = scrubEventPii({
      breadcrumbs: [
        { message: 'click: [data-email="a@b.co"]' },
        { message: 'navigation: /cms' },
      ],
    })
    expect(out.breadcrumbs?.[0]!.message).toBe('click: [data-email="<email>"]')
    expect(out.breadcrumbs?.[1]!.message).toBe('navigation: /cms')
  })

  it('is a no-op on events without any of the scrubbable fields', () => {
    const event = {}
    expect(scrubEventPii(event)).toBe(event)
  })

  it('returns the same reference (mutation, not copy)', () => {
    const event = { message: 'x@y.z' }
    const out = scrubEventPii(event)
    expect(out).toBe(event)
    expect(event.message).toBe('<email>')
  })
})
