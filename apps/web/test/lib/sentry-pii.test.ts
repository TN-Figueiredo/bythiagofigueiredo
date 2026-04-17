// Sprint 4 H1 — unit tests for the Sentry PII scrubber. These exercise the
// pure helper in isolation; the SDK integration in `sentry.*.config.ts`
// inherits the same behavior via direct import.
import { describe, it, expect } from 'vitest'
import {
  scrubBreadcrumbPii,
  scrubEmail,
  scrubEventPii,
  scrubPiiString,
  CPF_RE,
  EMAIL_RE,
  PHONE_RE,
} from '@/lib/sentry-pii'

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

  it('scrubs phone numbers in exception values', () => {
    const out = scrubEventPii({
      exception: { values: [{ value: 'contato +55 (11) 98765-4321 pediu exclusão' }] },
    })
    expect(out.exception?.values?.[0]!.value).toContain('[REDACTED_PHONE]')
    expect(out.exception?.values?.[0]!.value).not.toContain('98765-4321')
  })

  it('scrubs CPF in messages (both punctuated and raw)', () => {
    const out1 = scrubEventPii({ message: 'CPF 123.456.789-00 inválido' })
    expect(out1.message).toBe('CPF [REDACTED_CPF] inválido')
    const out2 = scrubEventPii({ message: 'CPF 12345678900 inválido' })
    expect(out2.message).toBe('CPF [REDACTED_CPF] inválido')
  })

  it('scrubs breadcrumb.data string values (fetch URLs, request bodies)', () => {
    const out = scrubEventPii({
      breadcrumbs: [
        { message: 'fetch', data: { url: 'https://api/foo?email=alice@x.com', status: 400 } },
      ],
    })
    expect(out.breadcrumbs?.[0]!.data?.url).toBe('https://api/foo?email=<email>')
    // Non-string values are preserved.
    expect(out.breadcrumbs?.[0]!.data?.status).toBe(400)
  })

  it('scrubs request.headers and request.data string payloads', () => {
    const out = scrubEventPii({
      request: {
        headers: { cookie: 'session=abc; user=alice@x.com' },
        data: '{"cpf":"123.456.789-00"}',
      },
    })
    expect(out.request?.headers?.cookie).toBe('session=abc; user=<email>')
    expect(out.request?.data).toBe('{"cpf":"[REDACTED_CPF]"}')
  })
})

describe('scrubBreadcrumbPii', () => {
  it('scrubs breadcrumb.message + breadcrumb.data strings', () => {
    const out = scrubBreadcrumbPii({
      message: 'fetch https://x/y?email=a@b.co',
      data: { body: 'CPF 12345678900', method: 'POST' },
    })
    expect(out.message).toBe('fetch https://x/y?email=<email>')
    expect(out.data?.body).toBe('CPF [REDACTED_CPF]')
    expect(out.data?.method).toBe('POST')
  })

  it('returns the same reference on no-op breadcrumb', () => {
    const bc = { message: 'navigation: /foo' }
    expect(scrubBreadcrumbPii(bc)).toBe(bc)
  })
})

describe('scrubPiiString / individual regexes', () => {
  it('PHONE_RE matches BR phone shape', () => {
    PHONE_RE.lastIndex = 0
    expect(PHONE_RE.test('+55 (11) 98765-4321')).toBe(true)
  })

  it('CPF_RE matches punctuated and raw forms', () => {
    CPF_RE.lastIndex = 0
    expect(CPF_RE.test('123.456.789-00')).toBe(true)
    CPF_RE.lastIndex = 0
    expect(CPF_RE.test('12345678900')).toBe(true)
  })

  it('scrubPiiString handles a single CPF, phone, and email in one go', () => {
    expect(
      scrubPiiString('cpf=123.456.789-00 fone=+55 (11) 98765-4321 email=a@b.co'),
    ).toBe('cpf=[REDACTED_CPF] fone=[REDACTED_PHONE] email=<email>')
  })
})
