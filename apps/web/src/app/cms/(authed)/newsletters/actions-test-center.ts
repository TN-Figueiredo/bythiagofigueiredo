'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { render } from '@react-email/render'
import { ConfirmEmail } from '@/emails/confirm'
import { WelcomeEmail } from '@/emails/welcome'
import { getEmailService } from '@/lib/email/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

// ─── Types ─────────────────────────────────────────────────────────────────

type TestTemplate = 'confirm' | 'welcome' | 'edition'

type RenderResult =
  | { ok: true; html: string; sizeBytes: number }
  | { ok: false; error: string }

type SendResult =
  | { ok: true }
  | { ok: false; error: string }

// ─── Rate limiting (in-memory, per-process) ────────────────────────────────

const lastSendMap = new Map<string, number>()
const hourlySendMap = new Map<string, { count: number; windowStart: number }>()

const COOLDOWN_MS = 60_000
const HOURLY_CAP = 10
const HOUR_MS = 60 * 60 * 1000

function checkRateLimit(userId: string): string | null {
  const now = Date.now()

  // 60s cooldown
  const lastSend = lastSendMap.get(userId)
  if (lastSend && now - lastSend < COOLDOWN_MS) {
    return 'rate_limited'
  }

  // Hourly cap
  const hourly = hourlySendMap.get(userId)
  if (hourly) {
    if (now - hourly.windowStart > HOUR_MS) {
      // Reset window
      hourlySendMap.set(userId, { count: 0, windowStart: now })
    } else if (hourly.count >= HOURLY_CAP) {
      return 'hourly_limit_exceeded'
    }
  }

  return null
}

function recordSend(userId: string): void {
  const now = Date.now()
  lastSendMap.set(userId, now)

  const hourly = hourlySendMap.get(userId)
  if (!hourly || now - hourly.windowStart > HOUR_MS) {
    hourlySendMap.set(userId, { count: 1, windowStart: now })
  } else {
    hourly.count += 1
  }
}

// Exported for testing — allows tests to clear rate limit state between runs
export async function _resetRateLimits(): Promise<void> {
  lastSendMap.clear()
  hourlySendMap.clear()
}

// ─── Auth helper ───────────────────────────────────────────────────────────

async function getUserClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(c: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of c) cookieStore.set(name, value, options)
        },
      },
    },
  )
}

// ─── Mock data for template rendering ──────────────────────────────────────

function getMockUrls() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
  return {
    confirm: `${base}/newsletter/confirm/test-token-123`,
    unsubscribe: `${base}/newsletter/unsubscribe`,
    archive: `${base}/newsletter`,
  }
}

const CONFIRM_SUBJECTS: Record<string, string> = {
  'pt-BR': 'Confirme sua inscrição',
  en: 'Confirm your subscription',
}

const WELCOME_SUBJECTS: Record<string, string> = {
  'pt-BR': 'Bem-vindo às newsletters',
  en: 'Welcome to the newsletters',
}

// ─── renderTestTemplate ────────────────────────────────────────────────────

export async function renderTestTemplate(
  template: TestTemplate,
  locale: 'en' | 'pt-BR',
  opts?: { editionId?: string },
): Promise<RenderResult> {
  const ctx = await getSiteContext()
  const authRes = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!authRes.ok) {
    return { ok: false, error: authRes.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden' }
  }

  switch (template) {
    case 'confirm': {
      const urls = getMockUrls()
      const html = await render(
        ConfirmEmail({
          confirmUrl: urls.confirm,
          locale,
          newsletterNames: ['Weekly Digest', 'Dev Notes'],
        }),
      )
      const sizeBytes = Buffer.byteLength(html, 'utf-8')
      return { ok: true, html, sizeBytes }
    }

    case 'welcome': {
      const urls = getMockUrls()
      const html = await render(
        WelcomeEmail({
          locale,
          newsletterNames: [
            { name: 'Weekly Digest', tagline: 'Curated links every Friday', color: '#FF8240' },
            { name: 'Dev Notes', tagline: 'Technical deep dives', color: '#3b82f6' },
          ],
          unsubscribeUrl: urls.unsubscribe,
          archiveUrl: urls.archive,
        }),
      )
      const sizeBytes = Buffer.byteLength(html, 'utf-8')
      return { ok: true, html, sizeBytes }
    }

    case 'edition': {
      if (!opts?.editionId) {
        return { ok: false, error: 'edition_id_required' }
      }
      const { renderEmailPreview } = await import('./actions')
      const result = await renderEmailPreview(opts.editionId)
      if (!result.ok) return result
      const sizeBytes = Buffer.byteLength(result.html, 'utf-8')
      return { ok: true, html: result.html, sizeBytes }
    }

    default:
      return { ok: false, error: 'invalid_template' }
  }
}

// ─── sendTestTemplate ──────────────────────────────────────────────────────

export async function sendTestTemplate(
  template: TestTemplate,
  locale: 'en' | 'pt-BR',
  opts?: { editionId?: string },
): Promise<SendResult> {
  const ctx = await getSiteContext()
  const authRes = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!authRes.ok) {
    return { ok: false, error: authRes.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden' }
  }

  // Get user email from session
  const userClient = await getUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user?.email) return { ok: false, error: 'no_user_email' }
  const toEmail = user.email

  // Rate limit check
  const userId = user.id
  const limitError = checkRateLimit(userId)
  if (limitError) return { ok: false, error: limitError }

  // Render
  const renderResult = await renderTestTemplate(template, locale, opts)
  if (!renderResult.ok) return { ok: false, error: renderResult.error }

  // Determine subject
  let subject: string
  switch (template) {
    case 'confirm':
      subject = `[TEST] ${CONFIRM_SUBJECTS[locale] ?? CONFIRM_SUBJECTS.en}`
      break
    case 'welcome':
      subject = `[TEST] ${WELCOME_SUBJECTS[locale] ?? WELCOME_SUBJECTS.en}`
      break
    case 'edition': {
      // For edition, we need to fetch the actual subject from DB
      if (opts?.editionId) {
        const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
        const supabase = getSupabaseServiceClient()
        const { data: edition } = await supabase
          .from('newsletter_editions')
          .select('subject')
          .eq('id', opts.editionId)
          .single()
        subject = `[TEST] ${edition?.subject ?? 'Newsletter'}`
      } else {
        subject = '[TEST] Newsletter'
      }
      break
    }
    default:
      subject = '[TEST] Newsletter'
  }

  // Send
  try {
    const emailService = getEmailService()
    await emailService.send({
      from: {
        name: 'Thiago Figueiredo',
        email: `newsletter@${process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'}`,
      },
      to: toEmail,
      subject,
      html: renderResult.html,
    })
  } catch (err) {
    console.error('[test-center] email send failed:', err)
    return { ok: false, error: 'email_send_failed' }
  }

  // Record send for rate limiting
  recordSend(userId)

  return { ok: true }
}
