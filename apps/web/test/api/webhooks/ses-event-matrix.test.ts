// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── SES webhook FULL event-matrix suite (real processor) ─────────────────
// Companion to ses-delivered-e2e.test.ts: same architecture (REAL
// SesWebhookProcessor from @tn-figueiredo/email/webhooks, realistic SNS
// Notification envelopes wrapping realistic SES event payloads, only the
// cryptographic signature stubbed), but covering the ENTIRE event matrix:
//
//   Open / Click / Bounce(Permanent) / Bounce(Transient) / Complaint /
//   duplicate SNS MessageId (idempotency) / out-of-order Open→Delivery /
//   unknown messageId / SubscriptionConfirmation / garbage & unsigned input.
//
// These tests PIN ACTUAL BEHAVIOR as implemented — including deliberate
// last-write-wins status semantics (no monotonic guard: a Delivery arriving
// after an Open regresses status back to 'delivered'; the route comments
// call this out as the idempotency tradeoff for safe SNS retries).
//
// Notable implementation facts pinned here (verified against the compiled
// processor in node_modules/@tn-figueiredo/email/dist/webhooks.js):
//   • ALL event timestamps written to newsletter_sends come from
//     event.mail.timestamp (the SEND time) — NOT from the event-specific
//     timestamps (delivery.timestamp / open.timestamp / click.timestamp).
//   • Bounce: bounceType 'Permanent' → metadata 'hard' → bounce_type
//     'Permanent' + subscriber suppression. ANY other bounceType
//     ('Transient', 'Undetermined') → 'soft' → bounce_type 'Transient',
//     NO subscriber suppression.
//   • Bounce/Complaint subscriber suppression respects an existing
//     'unsubscribed' status (.neq('status','unsubscribed')).
//   • No bounced_at/complained_at timestamp columns are written — only
//     status (+ bounce_type for bounces).

const { mockCreateVerify, mockCaptureMessage, mockCaptureException, mockRevalidateTag, envState } =
  vi.hoisted(() => ({
    mockCreateVerify: vi.fn(),
    mockCaptureMessage: vi.fn(),
    mockCaptureException: vi.fn(),
    mockRevalidateTag: vi.fn(),
    // Mutable env so individual tests can set SNS_EXPECTED_TOPIC_ARN.
    envState: { SNS_EXPECTED_TOPIC_ARN: undefined as string | undefined },
  }))

// NOTE: @tn-figueiredo/email/webhooks is intentionally NOT mocked — the
// `svix` optional peer dep it imports is stubbed via vitest.config.ts alias.

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>()
  return { ...actual, createVerify: mockCreateVerify }
})

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
}))

vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({ SNS_EXPECTED_TOPIC_ARN: envState.SNS_EXPECTED_TOPIC_ARN }),
}))

vi.mock('next/cache', () => ({
  revalidateTag: mockRevalidateTag,
}))

// ── Stateful, history-tracking Supabase mock ──────────────────────────────
// Richer than the e2e test's mock: records EVERY update (data + .eq/.neq
// scoping per call) so multi-event tests (out-of-order, duplicates) can
// assert the full write sequence. webhook_events is genuinely stateful:
// inserted idempotency keys are visible to subsequent dedup SELECTs, so the
// duplicate-MessageId test exercises the real dedup loop.

type Eq = [string, unknown]
type UpdateRecord = { data: Record<string, unknown>; eqs: Eq[]; neqs: Eq[] }

interface TableMock {
  updates: UpdateRecord[]
  inserts: Array<Record<string, unknown>>
  selectEqs: Eq[][]
  /** Resolve the row a `.select(...).eq(...)…maybeSingle()` returns. */
  selectData: (eqs: Eq[]) => unknown
}

const tables = new Map<string, TableMock>()

function table(name: string): TableMock {
  let t = tables.get(name)
  if (!t) {
    t = { updates: [], inserts: [], selectEqs: [], selectData: () => null }
    tables.set(name, t)
  }
  return t
}

const mockFrom = vi.fn((name: string) => {
  const t = table(name)
  return {
    select: vi.fn(() => {
      const eqs: Eq[] = []
      t.selectEqs.push(eqs)
      const obj: Record<string, unknown> = {
        maybeSingle: vi.fn(async () => ({ data: t.selectData(eqs), error: null })),
      }
      obj.eq = vi.fn((col: string, val: unknown) => {
        eqs.push([col, val])
        return obj
      })
      return obj
    }),
    update: vi.fn((data: Record<string, unknown>) => {
      const rec: UpdateRecord = { data, eqs: [], neqs: [] }
      t.updates.push(rec)
      const obj: Record<string, unknown> = {}
      obj.eq = vi.fn((col: string, val: unknown) => {
        rec.eqs.push([col, val])
        return obj
      })
      obj.neq = vi.fn((col: string, val: unknown) => {
        rec.neqs.push([col, val])
        return obj
      })
      return obj
    }),
    insert: vi.fn((data: Record<string, unknown>) => {
      t.inserts.push(data)
      return Promise.resolve({ error: null })
    }),
  }
})

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

import { POST } from '../../../src/app/api/webhooks/ses/route'

// ── Realistic fixtures ────────────────────────────────────────────────────
// SES MessageId in the exact format prod stores in provider_message_id
// (sa-east-1 SESv2): 16-hex prefix + uuid + '-000000'.
const SES_MESSAGE_ID =
  '0103019ea4f1c2d3-1b9c7a55-3e2f-4d18-9a44-7c0f5b6e2d31-000000'
const MAIL_TIMESTAMP = '2026-06-09T12:00:00.000Z'
const SUBSCRIBER = 'reader@example.com'
const SITE_ID = 'site-001'
const CLICK_URL = 'https://bythiagofigueiredo.com/blog/post-1?utm_source=newsletter'

const sesMail = {
  timestamp: MAIL_TIMESTAMP,
  messageId: SES_MESSAGE_ID,
  source: 'Thiago Figueiredo <newsletter@bythiagofigueiredo.com>',
  sourceArn:
    'arn:aws:ses:sa-east-1:793477410088:identity/bythiagofigueiredo.com',
  sendingAccountId: '793477410088',
  destination: [SUBSCRIBER],
  tags: { 'ses:configuration-set': ['bythiago-marketing'] },
}

// SES event-publishing payloads (configuration-set event destination → SNS),
// per AWS docs: eventType + mail + per-type object.
const sesEvents = {
  delivery: {
    eventType: 'Delivery',
    mail: sesMail,
    delivery: {
      timestamp: '2026-06-09T12:00:02.123Z',
      processingTimeMillis: 2123,
      recipients: [SUBSCRIBER],
      smtpResponse: '250 2.0.0 OK',
      reportingMTA: 'a8-50.smtp-out.amazonses.com',
    },
  },
  open: {
    eventType: 'Open',
    mail: sesMail,
    open: {
      timestamp: '2026-06-09T13:30:00.000Z',
      ipAddress: '177.55.10.20',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (Proxy)',
    },
  },
  click: {
    eventType: 'Click',
    mail: sesMail,
    click: {
      timestamp: '2026-06-09T13:31:00.000Z',
      ipAddress: '177.55.10.20',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      link: CLICK_URL,
      linkTags: null,
    },
  },
  bouncePermanent: {
    eventType: 'Bounce',
    mail: sesMail,
    bounce: {
      bounceType: 'Permanent',
      bounceSubType: 'General',
      bouncedRecipients: [
        {
          emailAddress: SUBSCRIBER,
          action: 'failed',
          status: '5.1.1',
          diagnosticCode: 'smtp; 550 5.1.1 user unknown',
        },
      ],
      timestamp: '2026-06-09T12:00:05.000Z',
      feedbackId: '0103019ea4f1c2d3-feedback-bounce-000000',
      reportingMTA: 'dns; a8-50.smtp-out.amazonses.com',
    },
  },
  bounceTransient: {
    eventType: 'Bounce',
    mail: sesMail,
    bounce: {
      bounceType: 'Transient',
      bounceSubType: 'MailboxFull',
      bouncedRecipients: [
        { emailAddress: SUBSCRIBER, action: 'failed', status: '4.2.2' },
      ],
      timestamp: '2026-06-09T12:00:05.000Z',
      feedbackId: '0103019ea4f1c2d3-feedback-soft-000000',
    },
  },
  complaint: {
    eventType: 'Complaint',
    mail: sesMail,
    complaint: {
      complainedRecipients: [{ emailAddress: SUBSCRIBER }],
      timestamp: '2026-06-09T14:00:00.000Z',
      feedbackId: '0103019ea4f1c2d3-feedback-complaint-000000',
      complaintFeedbackType: 'abuse',
      userAgent: 'Yahoo!-Mail-Feedback/2.0',
    },
  },
} as const

const TOPIC_ARN = 'arn:aws:sns:sa-east-1:793477410088:ses-bythiago-events'
const CERT_URL =
  'https://sns.sa-east-1.amazonaws.com/SimpleNotificationService-9c6465fa7f48f5cacd23014631ec1136.pem'

function snsNotification(
  sesEvent: unknown,
  snsMessageId: string,
  overrides: Record<string, string> = {},
): Request {
  return new Request('https://bythiagofigueiredo.com/api/webhooks/ses', {
    method: 'POST',
    headers: { 'content-type': 'text/plain; charset=UTF-8' },
    body: JSON.stringify({
      Type: 'Notification',
      MessageId: snsMessageId,
      TopicArn: TOPIC_ARN,
      Message: typeof sesEvent === 'string' ? sesEvent : JSON.stringify(sesEvent),
      Timestamp: '2026-06-09T12:00:06.000Z',
      SignatureVersion: '1',
      Signature: 'ZmFrZS1zaWduYXR1cmU=',
      SigningCertURL: CERT_URL,
      UnsubscribeURL:
        'https://sns.sa-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=' +
        TOPIC_ARN +
        ':abc',
      ...overrides,
    }),
  })
}

const SUBSCRIBE_URL =
  'https://sns.sa-east-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=' +
  TOPIC_ARN +
  '&Token=2336412f37fb687f5d51e6e2425ba1f25c4ceb2c'

function snsSubscriptionConfirmation(
  overrides: Record<string, string> = {},
): Request {
  return new Request('https://bythiagofigueiredo.com/api/webhooks/ses', {
    method: 'POST',
    headers: { 'content-type': 'text/plain; charset=UTF-8' },
    body: JSON.stringify({
      Type: 'SubscriptionConfirmation',
      MessageId: 'a1b2c3d4-sub-confirm-0001',
      Token: '2336412f37fb687f5d51e6e2425ba1f25c4ceb2c',
      TopicArn: TOPIC_ARN,
      Message:
        'You have chosen to subscribe to the topic ' +
        TOPIC_ARN +
        '.\nTo confirm the subscription, visit the SubscribeURL included in this message.',
      SubscribeURL: SUBSCRIBE_URL,
      Timestamp: '2026-06-09T12:00:00.000Z',
      SignatureVersion: '1',
      Signature: 'ZmFrZS1zaWduYXR1cmU=',
      SigningCertURL: CERT_URL,
      ...overrides,
    }),
  })
}

const originalFetch = globalThis.fetch
const mockFetch = vi.fn()

/** Seed the newsletter_sends lookup so provider_message_id resolves a row. */
function seedSend(
  overrides: Partial<{
    id: string
    link_rewrite_enabled: boolean
  }> = {},
) {
  const sendRow = {
    id: 'send-001',
    edition_id: 'ed-001',
    subscriber_email: SUBSCRIBER,
    link_rewrite_enabled: true,
    newsletter_editions: { site_id: SITE_ID, newsletter_type_id: 'nl-type-001' },
    ...overrides,
  }
  table('newsletter_sends').selectData = (eqs) =>
    eqs.some(([c, v]) => c === 'provider_message_id' && v === SES_MESSAGE_ID)
      ? sendRow
      : null
  return sendRow
}

/** Make webhook_events stateful: dedup SELECT sees previously-inserted keys. */
function statefulWebhookEvents() {
  const t = table('webhook_events')
  t.selectData = (eqs) => {
    const key = eqs.find(([c]) => c === 'idempotency_key')?.[1]
    return t.inserts.some((row) => row.idempotency_key === key)
      ? { id: 'evt-existing' }
      : null
  }
}

describe('POST /api/webhooks/ses — full event matrix (real processor)', () => {
  beforeEach(() => {
    tables.clear()
    statefulWebhookEvents()
    mockFrom.mockClear()
    mockCaptureMessage.mockReset()
    mockCaptureException.mockReset()
    mockRevalidateTag.mockReset()
    envState.SNS_EXPECTED_TOPIC_ARN = undefined
    mockCreateVerify.mockReset().mockReturnValue({
      update: vi.fn(),
      verify: vi.fn().mockReturnValue(true),
    })
    mockFetch.mockReset().mockResolvedValue({
      text: () =>
        Promise.resolve(
          '-----BEGIN CERTIFICATE-----\nFAKE\n-----END CERTIFICATE-----',
        ),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // ── 1. Open ──────────────────────────────────────────────────────────
  it('Open → status "opened" + opened_at = mail.timestamp (NOT open.timestamp); no PII without consent', async () => {
    seedSend()

    const res = await POST(snsNotification(sesEvents.open, 'sns-open-001'))
    expect(res.status).toBe(200)

    const sends = table('newsletter_sends')
    expect(sends.updates).toHaveLength(1)
    // Pinned: opened_at is mail.timestamp (send time), not open.timestamp —
    // the processor normalizes every event to event.mail.timestamp. The
    // realistic fixture has a 13:30 open; the row still records 12:00.
    // Pinned: NO open_ip/open_user_agent keys at all when the subscriber
    // consent lookup returns no row (fail-closed PII gating).
    expect(sends.updates[0].data).toEqual({
      status: 'opened',
      opened_at: MAIL_TIMESTAMP,
    })
    expect(sends.updates[0].eqs).toContainEqual(['id', 'send-001'])

    // Edition flagged stale + idempotency recorded with the normalized type.
    expect(table('newsletter_editions').updates[0]?.data).toEqual({
      stats_stale: true,
    })
    expect(table('webhook_events').inserts[0]).toMatchObject({
      idempotency_key: 'sns-open-001',
      event_type: 'opened',
    })

    // Opens never invalidate the suggestion cache (only bounce/complaint do).
    expect(mockRevalidateTag).not.toHaveBeenCalled()
  })

  // FLAGGED (potential bug — fix lives in @tn-figueiredo/email, not this
  // repo's src): SesWebhookProcessor normalizes EVERY event's timestamp to
  // event.mail.timestamp (the SEND time) and ignores the event-specific
  // timestamps AWS provides (open.timestamp / click.timestamp /
  // delivery.timestamp). Result: opened_at/clicked_at/delivered_at all equal
  // the send time, so open/click analytics ("when do readers open?") are
  // meaningless and delivery latency is unmeasurable. The passing test above
  // pins the CURRENT behavior; this skipped test pins the arguably-intended
  // behavior and will fail until the processor uses event.open.timestamp.
  it.skip('Open → opened_at should be the OPEN time (open.timestamp), not the send time [known processor limitation]', async () => {
    seedSend()
    await POST(snsNotification(sesEvents.open, 'sns-open-ts'))
    expect(table('newsletter_sends').updates[0].data.opened_at).toBe(
      sesEvents.open.open.timestamp, // 13:30 open — currently records 12:00 send time
    )
  })

  it('Open with tracking_consent=true → records open_ip + open_user_agent from the SES open object', async () => {
    seedSend()
    table('newsletter_subscriptions').selectData = (eqs) =>
      eqs.some(([c, v]) => c === 'email' && v === SUBSCRIBER)
        ? { tracking_consent: true }
        : null

    const res = await POST(snsNotification(sesEvents.open, 'sns-open-002'))
    expect(res.status).toBe(200)

    expect(table('newsletter_sends').updates[0].data).toEqual({
      status: 'opened',
      opened_at: MAIL_TIMESTAMP,
      open_ip: sesEvents.open.open.ipAddress,
      open_user_agent: sesEvents.open.open.userAgent,
    })
    // Consent lookup is scoped to (email, site_id).
    expect(table('newsletter_subscriptions').selectEqs[0]).toEqual([
      ['email', SUBSCRIBER],
      ['site_id', SITE_ID],
    ])
  })

  // ── 2. Click ─────────────────────────────────────────────────────────
  it('Click → status "clicked" + clicked_at, tracked_link resolved by destination URL, link_clicks insert', async () => {
    seedSend({ link_rewrite_enabled: true })
    table('tracked_links').selectData = (eqs) =>
      eqs.some(([c, v]) => c === 'destination_url' && v === CLICK_URL)
        ? { id: 'tl-001' }
        : null

    const res = await POST(snsNotification(sesEvents.click, 'sns-click-001'))
    expect(res.status).toBe(200)

    // Send row: clicked_at = mail.timestamp (same normalization as Open).
    expect(table('newsletter_sends').updates[0].data).toEqual({
      status: 'clicked',
      clicked_at: MAIL_TIMESTAMP,
    })

    // tracked_links lookup scoped to (site_id, destination_url) — SES fires
    // the event with the ORIGINAL destination (it follows the short-link
    // redirect first), so the lookup is by destination_url, not short code.
    expect(table('tracked_links').selectEqs[0]).toEqual([
      ['site_id', SITE_ID],
      ['destination_url', CLICK_URL],
    ])

    // link_clicks row: link_id + site_id + clicked_at; NO ip/user_agent keys
    // without tracking consent (fail-closed).
    expect(table('link_clicks').inserts).toHaveLength(1)
    expect(table('link_clicks').inserts[0]).toEqual({
      link_id: 'tl-001',
      site_id: SITE_ID,
      clicked_at: MAIL_TIMESTAMP,
    })

    expect(table('webhook_events').inserts[0]).toMatchObject({
      idempotency_key: 'sns-click-001',
      event_type: 'clicked',
    })
    expect(mockRevalidateTag).not.toHaveBeenCalled()
  })

  it('Click with no matching tracked_link → clicked_at still recorded, no link_clicks row, Sentry warning', async () => {
    seedSend({ link_rewrite_enabled: true })
    // tracked_links.selectData default → null (no match).

    const res = await POST(snsNotification(sesEvents.click, 'sns-click-002'))
    expect(res.status).toBe(200)

    expect(table('newsletter_sends').updates[0].data).toMatchObject({
      status: 'clicked',
      clicked_at: MAIL_TIMESTAMP,
    })
    expect(table('link_clicks').inserts).toHaveLength(0)
    // Attribution loss is surfaced, not swallowed.
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('no tracked_link for destination'),
      expect.objectContaining({ level: 'warning' }),
    )
  })

  // ── 3. Bounce ────────────────────────────────────────────────────────
  it('Bounce (Permanent) → send "bounced" + bounce_type "Permanent" + SUBSCRIBER suppressed (status "bounced")', async () => {
    seedSend()

    const res = await POST(
      snsNotification(sesEvents.bouncePermanent, 'sns-bounce-001'),
    )
    expect(res.status).toBe(200)

    // Send row. Pinned: no bounced_at timestamp column is written.
    expect(table('newsletter_sends').updates[0].data).toEqual({
      status: 'bounced',
      bounce_type: 'Permanent',
    })
    expect(table('newsletter_sends').updates[0].eqs).toContainEqual([
      'id',
      'send-001',
    ])

    // LGPD/reputation-critical: subscriber suppressed across the site,
    // scoped (email, site_id), WITHOUT clobbering an explicit unsubscribe.
    const subs = table('newsletter_subscriptions')
    expect(subs.updates).toHaveLength(1)
    expect(subs.updates[0].data).toEqual({ status: 'bounced' })
    expect(subs.updates[0].eqs).toEqual([
      ['email', SUBSCRIBER],
      ['site_id', SITE_ID],
    ])
    expect(subs.updates[0].neqs).toEqual([['status', 'unsubscribed']])

    // Subscriber-count change invalidates the suggestions cache.
    expect(mockRevalidateTag).toHaveBeenCalledWith('newsletter-suggestions')

    expect(table('webhook_events').inserts[0]).toMatchObject({
      idempotency_key: 'sns-bounce-001',
      event_type: 'bounced',
    })
  })

  it('Bounce (Transient) → send "bounced" + bounce_type "Transient", subscriber NOT suppressed', async () => {
    seedSend()

    const res = await POST(
      snsNotification(sesEvents.bounceTransient, 'sns-bounce-002'),
    )
    expect(res.status).toBe(200)

    // Pinned: soft bounces DO flip the send to status 'bounced' (same as
    // hard) — only bounce_type differs; suppression is the hard-only part.
    expect(table('newsletter_sends').updates[0].data).toEqual({
      status: 'bounced',
      bounce_type: 'Transient',
    })

    // No subscriber suppression for transient bounces.
    expect(table('newsletter_subscriptions').updates).toHaveLength(0)

    // The route still treats it as a subscriber-affecting event class for
    // cache purposes (event.type === 'bounced'), so revalidation fires.
    expect(mockRevalidateTag).toHaveBeenCalledWith('newsletter-suggestions')
  })

  // ── 4. Complaint ─────────────────────────────────────────────────────
  it('Complaint → send "complained" + subscriber "complained" (global opt-out, unsubscribed preserved)', async () => {
    seedSend()

    const res = await POST(
      snsNotification(sesEvents.complaint, 'sns-complaint-001'),
    )
    expect(res.status).toBe(200)

    // Pinned: status only — no complained_at timestamp column.
    expect(table('newsletter_sends').updates[0].data).toEqual({
      status: 'complained',
    })

    const subs = table('newsletter_subscriptions')
    expect(subs.updates).toHaveLength(1)
    expect(subs.updates[0].data).toEqual({ status: 'complained' })
    expect(subs.updates[0].eqs).toEqual([
      ['email', SUBSCRIBER],
      ['site_id', SITE_ID],
    ])
    expect(subs.updates[0].neqs).toEqual([['status', 'unsubscribed']])

    expect(mockRevalidateTag).toHaveBeenCalledWith('newsletter-suggestions')
    expect(table('webhook_events').inserts[0]).toMatchObject({
      idempotency_key: 'sns-complaint-001',
      event_type: 'complained',
    })
  })

  // ── 5. Idempotency ───────────────────────────────────────────────────
  it('duplicate SNS MessageId → second delivery of the same event is a dedup no-op', async () => {
    seedSend()
    const envelope = () => snsNotification(sesEvents.open, 'sns-dup-001')

    const first = await POST(envelope())
    expect(first.status).toBe(200)
    expect((await first.json()).dedup).toBeUndefined()

    const second = await POST(envelope())
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ ok: true, dedup: true })

    // Exactly ONE processing pass: one send update, one stale flag, one
    // idempotency record — the duplicate touched nothing.
    expect(table('newsletter_sends').updates).toHaveLength(1)
    expect(table('newsletter_editions').updates).toHaveLength(1)
    expect(table('webhook_events').inserts).toHaveLength(1)
  })

  // ── 6. Out-of-order ──────────────────────────────────────────────────
  it('out-of-order: Open before Delivery → both timestamps land; final status REGRESSES to "delivered" (last-write-wins, as implemented)', async () => {
    seedSend()

    const openRes = await POST(snsNotification(sesEvents.open, 'sns-ooo-open'))
    expect(openRes.status).toBe(200)
    const deliveryRes = await POST(
      snsNotification(sesEvents.delivery, 'sns-ooo-delivery'),
    )
    expect(deliveryRes.status).toBe(200)

    const sends = table('newsletter_sends')
    expect(sends.updates).toHaveLength(2)

    // Both timestamps are written — each event sets only its own column,
    // so opened_at survives the later Delivery update.
    expect(sends.updates[0].data).toEqual({
      status: 'opened',
      opened_at: MAIL_TIMESTAMP,
    })
    expect(sends.updates[1].data).toEqual({
      status: 'delivered',
      delivered_at: MAIL_TIMESTAMP,
    })

    // PINNED BEHAVIOR: there is NO monotonic status guard — the late
    // Delivery overwrites status 'opened' → 'delivered'. The route comments
    // document this as deliberate ("all DB updates are idempotent
    // (overwrite), so double-processing on SNS retry is safe"). Funnel
    // queries must therefore rely on the *_at timestamps, not on status,
    // for accurate open/click attribution.
    const finalStatus = sends.updates[sends.updates.length - 1].data.status
    expect(finalStatus).toBe('delivered')
  })

  // ── 7. Unknown messageId ─────────────────────────────────────────────
  it('Bounce for an unknown provider_message_id → clean no-op (no send/subscription writes), idempotency still recorded', async () => {
    // No seedSend(): newsletter_sends lookup resolves null.
    const res = await POST(
      snsNotification(sesEvents.bouncePermanent, 'sns-unknown-001'),
    )
    expect(res.status).toBe(200)

    expect(table('newsletter_sends').updates).toHaveLength(0)
    expect(table('newsletter_subscriptions').updates).toHaveLength(0)
    expect(table('newsletter_editions').updates).toHaveLength(0)

    // SNS retries of the same MessageId still dedup.
    expect(table('webhook_events').inserts[0]).toMatchObject({
      idempotency_key: 'sns-unknown-001',
      event_type: 'bounced',
    })
  })

  // ── 8. SubscriptionConfirmation ──────────────────────────────────────
  it('SubscriptionConfirmation → handler confirms by fetching the SubscribeURL', async () => {
    const res = await POST(snsSubscriptionConfirmation())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, subscribed: true })

    // The processor confirms via plain fetch(SubscribeURL) — single-arg
    // call distinguishes it from the cert fetch (url + { signal }).
    expect(mockFetch).toHaveBeenCalledWith(SUBSCRIBE_URL)

    // Confirmations short-circuit before dedup/processing: nothing written.
    expect(table('webhook_events').inserts).toHaveLength(0)
    expect(table('newsletter_sends').updates).toHaveLength(0)
  })

  it('SubscriptionConfirmation with a non-AWS SubscribeURL → 500, SSRF fetch blocked', async () => {
    const evil = 'https://evil.example.com/exfiltrate'
    const res = await POST(
      snsSubscriptionConfirmation({ SubscribeURL: evil }),
    )
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'subscription_failed' })
    expect(mockFetch).not.toHaveBeenCalledWith(evil)
    expect(mockCaptureException).toHaveBeenCalled()
  })

  // ── 9. Garbage / unsigned ────────────────────────────────────────────
  it('non-JSON body → 400 invalid_json, nothing touched', async () => {
    const res = await POST(
      new Request('https://bythiagofigueiredo.com/api/webhooks/ses', {
        method: 'POST',
        body: 'this is not json {{{',
      }),
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_json' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('invalid SNS signature → 401 invalid_signature, nothing written (Notification)', async () => {
    seedSend()
    mockCreateVerify.mockReturnValue({
      update: vi.fn(),
      verify: vi.fn().mockReturnValue(false),
    })

    const res = await POST(snsNotification(sesEvents.open, 'sns-bad-sig'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'invalid_signature' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('unsigned SubscriptionConfirmation → 401, SubscribeURL NOT fetched (blind-SSRF guard)', async () => {
    mockCreateVerify.mockReturnValue({
      update: vi.fn(),
      verify: vi.fn().mockReturnValue(false),
    })

    const res = await POST(snsSubscriptionConfirmation())
    expect(res.status).toBe(401)
    expect(mockFetch).not.toHaveBeenCalledWith(SUBSCRIBE_URL)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('missing/non-AWS SigningCertURL → 401 without fetching the cert', async () => {
    const res = await POST(
      snsNotification(sesEvents.open, 'sns-no-cert', {
        SigningCertURL: 'https://attacker.example.com/cert.pem',
      }),
    )
    expect(res.status).toBe(401)
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('TopicArn mismatch (SNS_EXPECTED_TOPIC_ARN set) → 403, nothing written', async () => {
    envState.SNS_EXPECTED_TOPIC_ARN = TOPIC_ARN
    const res = await POST(
      snsNotification(sesEvents.open, 'sns-wrong-topic', {
        TopicArn: 'arn:aws:sns:us-east-1:999999999999:someone-elses-topic',
      }),
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'topic_arn_mismatch' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('validly-signed envelope with an unknown SNS Type → acknowledged but ignored, nothing written', async () => {
    const res = await POST(
      snsNotification(sesEvents.open, 'sns-unsub-confirm', {
        Type: 'UnsubscribeConfirmation',
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, ignored: true })
    expect(table('newsletter_sends').updates).toHaveLength(0)
    expect(table('webhook_events').inserts).toHaveLength(0)
  })

  it('validly-signed Notification with garbage SES Message → 200, no send writes, idempotency keyed with raw SNS Type', async () => {
    seedSend()
    const res = await POST(
      snsNotification('not-json-at-all {{{', 'sns-garbage-msg'),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    expect(table('newsletter_sends').updates).toHaveLength(0)
    // Pinned: processor returns [] → event_type falls back to body.Type.
    expect(table('webhook_events').inserts[0]).toMatchObject({
      idempotency_key: 'sns-garbage-msg',
      event_type: 'Notification',
    })
  })

  it('validly-signed Notification whose SES payload lacks mail.messageId → 200 no-op (validateSesEvent rejects)', async () => {
    seedSend()
    const res = await POST(
      snsNotification(
        { eventType: 'Delivery', mail: { timestamp: MAIL_TIMESTAMP } },
        'sns-no-msgid',
      ),
    )
    expect(res.status).toBe(200)
    expect(table('newsletter_sends').updates).toHaveLength(0)
    expect(table('webhook_events').inserts[0]).toMatchObject({
      idempotency_key: 'sns-no-msgid',
      event_type: 'Notification',
    })
  })
})
