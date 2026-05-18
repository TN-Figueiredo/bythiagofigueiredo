import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock Supabase
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { telegram_chat_id: '123456789', email: 'user@example.com' },
            error: null,
          })),
        })),
      })),
    })),
  })),
}))

// Mock @tn-figueiredo/email — ResendEmailAdapter used by email-fallback
vi.mock('@tn-figueiredo/email', () => ({
  ResendEmailAdapter: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({
      messageId: 'msg-123',
      provider: 'resend' as const,
    }),
  })),
}))

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

describe('Telegram notification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
    process.env.TELEGRAM_BOT_USERNAME = 'TestStoryBot'
  })

  it('sends a photo with caption and inline keyboard to Telegram', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
    })

    const { sendTelegramStoryNotification } = await import(
      '@/lib/social/notifications/telegram'
    )

    const result = await sendTelegramStoryNotification({
      chatId: '123456789',
      imageUrl: 'https://blob.vercel.com/stories/post-1-1716000000.png',
      shortUrl: 'https://go.btf.com/abc123',
      readyPageUrl:
        'https://bythiagofigueiredo.com/cms/social/posts/post-1/ready',
      title: 'My Blog Post',
    })

    expect(result.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-bot-token/sendPhoto',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string)
    expect(body.chat_id).toBe('123456789')
    expect(body.photo).toBe(
      'https://blob.vercel.com/stories/post-1-1716000000.png',
    )
    expect(body.caption).toContain('go.btf.com/abc123')
    expect(body.reply_markup.inline_keyboard).toBeDefined()
    expect(body.reply_markup.inline_keyboard[0][0].text).toBe('Open in CMS')
  })

  it('returns error when Telegram API fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request: chat not found'),
    })

    const { sendTelegramStoryNotification } = await import(
      '@/lib/social/notifications/telegram'
    )

    const result = await sendTelegramStoryNotification({
      chatId: 'invalid',
      imageUrl: 'https://blob.vercel.com/stories/test.png',
      shortUrl: 'https://go.btf.com/abc',
      readyPageUrl:
        'https://bythiagofigueiredo.com/cms/social/posts/post-1/ready',
      title: 'Test',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Bad Request')
  })

  it('returns error when TELEGRAM_BOT_TOKEN is not set', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN

    const { sendTelegramStoryNotification } = await import(
      '@/lib/social/notifications/telegram'
    )

    const result = await sendTelegramStoryNotification({
      chatId: '123456789',
      imageUrl: 'https://blob.vercel.com/stories/test.png',
      shortUrl: 'https://go.btf.com/abc',
      readyPageUrl:
        'https://bythiagofigueiredo.com/cms/social/posts/post-1/ready',
      title: 'Test',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('TELEGRAM_BOT_TOKEN')
  })
})

describe('Email fallback notification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.NEWSLETTER_FROM_DOMAIN = 'bythiagofigueiredo.com'
  })

  it('sends an email with story details via Resend', async () => {
    const { sendStoryEmailNotification } = await import(
      '@/lib/social/notifications/email-fallback'
    )

    const result = await sendStoryEmailNotification({
      to: 'user@example.com',
      imageUrl: 'https://blob.vercel.com/stories/test.png',
      shortUrl: 'https://go.btf.com/abc',
      readyPageUrl:
        'https://bythiagofigueiredo.com/cms/social/posts/post-1/ready',
      title: 'My Blog Post',
    })

    expect(result.ok).toBe(true)
  })

  it('returns error when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY

    const { sendStoryEmailNotification } = await import(
      '@/lib/social/notifications/email-fallback'
    )

    const result = await sendStoryEmailNotification({
      to: 'user@example.com',
      imageUrl: 'https://blob.vercel.com/stories/test.png',
      shortUrl: 'https://go.btf.com/abc',
      readyPageUrl:
        'https://bythiagofigueiredo.com/cms/social/posts/post-1/ready',
      title: 'Test',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('RESEND_API_KEY')
  })
})

describe('Notification orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.NEWSLETTER_FROM_DOMAIN = 'bythiagofigueiredo.com'
  })

  it('tries Telegram first when chat_id is available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
    })

    const { notifyStoryReady } = await import(
      '@/lib/social/notifications/notify-story-ready'
    )

    const result = await notifyStoryReady({
      userId: 'user-1',
      postId: 'post-1',
      imageUrl: 'https://blob.vercel.com/stories/test.png',
      shortUrl: 'https://go.btf.com/abc',
      title: 'Test Post',
    })

    expect(result.channel).toBe('telegram')
    expect(result.ok).toBe(true)
  })

  it('falls back to email when Telegram not configured', async () => {
    // Override mock to return no chat_id
    const { getSupabaseServiceClient } = await import(
      '@/lib/supabase/service'
    )
    vi.mocked(getSupabaseServiceClient).mockReturnValueOnce({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { telegram_chat_id: null, email: 'user@example.com' },
              error: null,
            })),
          })),
        })),
      })),
    } as never)

    const { notifyStoryReady } = await import(
      '@/lib/social/notifications/notify-story-ready'
    )

    const result = await notifyStoryReady({
      userId: 'user-1',
      postId: 'post-1',
      imageUrl: 'https://blob.vercel.com/stories/test.png',
      shortUrl: 'https://go.btf.com/abc',
      title: 'Test Post',
    })

    expect(result.channel).toBe('email')
  })

  it('returns none when user has no notification channels', async () => {
    const { getSupabaseServiceClient } = await import(
      '@/lib/supabase/service'
    )
    vi.mocked(getSupabaseServiceClient).mockReturnValueOnce({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { telegram_chat_id: null, email: null },
              error: null,
            })),
          })),
        })),
      })),
    } as never)

    const { notifyStoryReady } = await import(
      '@/lib/social/notifications/notify-story-ready'
    )

    const result = await notifyStoryReady({
      userId: 'user-1',
      postId: 'post-1',
      imageUrl: 'https://blob.vercel.com/stories/test.png',
      shortUrl: 'https://go.btf.com/abc',
      title: 'Test Post',
    })

    expect(result.ok).toBe(false)
    expect(result.channel).toBe('none')
  })

  it('falls back to email when Telegram fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request: chat not found'),
    })

    const { notifyStoryReady } = await import(
      '@/lib/social/notifications/notify-story-ready'
    )

    const result = await notifyStoryReady({
      userId: 'user-1',
      postId: 'post-1',
      imageUrl: 'https://blob.vercel.com/stories/test.png',
      shortUrl: 'https://go.btf.com/abc',
      title: 'Test Post',
    })

    expect(result.channel).toBe('email')
  })
})

describe('Telegram webhook handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
  })

  it('handles /start command and saves chat_id', async () => {
    // Mock the Supabase update — must be set before importing route
    const { getSupabaseServiceClient } = await import(
      '@/lib/supabase/service'
    )
    vi.mocked(getSupabaseServiceClient).mockReturnValueOnce({
      from: vi.fn(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })),
    } as never)

    // Mock the confirmation fetch
    mockFetch.mockResolvedValueOnce({ ok: true })

    const { POST } = await import('@/app/api/webhooks/telegram/route')

    const update = {
      message: {
        from: { id: 999888777 },
        chat: { id: 999888777, type: 'private' },
        text: '/start a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      },
    }

    const request = new Request('http://localhost:3000/api/webhooks/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
  })

  it('ignores non-start commands', async () => {
    const { POST } = await import('@/app/api/webhooks/telegram/route')

    const update = {
      message: {
        from: { id: 999888777 },
        chat: { id: 999888777, type: 'private' },
        text: '/help',
      },
    }

    const request = new Request('http://localhost:3000/api/webhooks/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
  })

  it('ignores /start with invalid UUID', async () => {
    const { POST } = await import('@/app/api/webhooks/telegram/route')

    const update = {
      message: {
        from: { id: 999888777 },
        chat: { id: 999888777, type: 'private' },
        text: '/start not-a-valid-uuid',
      },
    }

    const request = new Request('http://localhost:3000/api/webhooks/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
  })
})
