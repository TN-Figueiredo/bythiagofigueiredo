'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@tn-figueiredo/auth-nextjs'
import { render } from '@react-email/render'
import { ConfirmEmail } from '@/emails/confirm'
import { WelcomeEmail } from '@/emails/welcome'
import { Newsletter } from '@/emails/newsletter'
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
  return createServerClient({
    env: {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) cookieStore.set(name, value, options)
      },
    },
  })
}

// ─── Mock data for template rendering ──────────────────────────────────────

function getMockUrls() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
  return {
    confirm: `${base}/newsletter/confirm/test-token-123`,
    unsubscribe: `${base}/unsubscribe/mock-token-test`,
    archive: `${base}/newsletter`,
  }
}

function getMockEditionContent(locale: 'en' | 'pt-BR'): string {
  if (locale === 'pt-BR') {
    return `
<h1>Título da Edição de Exemplo</h1>
<p>Este é um <strong>preview de exemplo</strong> para testar o sistema visual da newsletter. Ele exercita todos os elementos que seu editor pode produzir — cabeçalhos, parágrafos, listas, citações, links e separadores.</p>

<h2>O que você vai encontrar</h2>
<p>Cada edição traz uma curadoria de <em>conteúdo relevante</em> para manter você atualizado. Aqui está um exemplo do que esperar:</p>
<ul>
<li><strong>Análises aprofundadas</strong> — mergulhos em temas que importam</li>
<li><strong>Links selecionados</strong> — o melhor da semana, filtrado pra você</li>
<li><strong>Notas rápidas</strong> — atualizações curtas e diretas</li>
</ul>

<blockquote><p>"A melhor forma de prever o futuro é criá-lo." — Peter Drucker</p></blockquote>

<h3>Seção com detalhes</h3>
<p>Este parágrafo testa <a href="https://example.com">links inline</a>, texto em <strong>negrito</strong>, <em>itálico</em> e <code>código inline</code> para garantir que a estilização esteja correta em todos os clientes de email.</p>
<ol>
<li>Primeiro item numerado</li>
<li>Segundo item numerado</li>
<li>Terceiro item numerado</li>
</ol>

<hr>

<p>Se este preview está bonito, seu sistema visual está funcionando perfeitamente. ✌️</p>
`.trim()
  }
  return `
<h1>Sample Edition Title</h1>
<p>This is a <strong>sample preview</strong> to test the newsletter visual system. It exercises all elements your editor can produce — headings, paragraphs, lists, blockquotes, links, and dividers.</p>

<h2>What you'll find</h2>
<p>Each edition brings a curated set of <em>relevant content</em> to keep you up to date. Here's an example of what to expect:</p>
<ul>
<li><strong>Deep dives</strong> — long-form analysis on topics that matter</li>
<li><strong>Curated links</strong> — the best of the week, filtered for you</li>
<li><strong>Quick notes</strong> — short, direct updates</li>
</ul>

<blockquote><p>"The best way to predict the future is to create it." — Peter Drucker</p></blockquote>

<h3>Section with details</h3>
<p>This paragraph tests <a href="https://example.com">inline links</a>, <strong>bold</strong>, <em>italic</em>, and <code>inline code</code> to ensure styling is correct across all email clients.</p>
<ol>
<li>First numbered item</li>
<li>Second numbered item</li>
<li>Third numbered item</li>
</ol>

<hr>

<p>If this preview looks good, your visual system is working perfectly. ✌️</p>
`.trim()
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
      if (opts?.editionId) {
        const { renderEmailPreview } = await import('./actions')
        const result = await renderEmailPreview(opts.editionId)
        if (!result.ok) return result
        const sizeBytes = Buffer.byteLength(result.html, 'utf-8')
        return { ok: true, html: result.html, sizeBytes }
      }
      const mockHtml = getMockEditionContent(locale)
      const typeColor = '#FF8240'
      const html = await render(
        Newsletter({
          subject: locale === 'pt-BR' ? 'Preview de exemplo' : 'Sample preview',
          preheader: locale === 'pt-BR' ? 'Visualize o sistema visual da newsletter' : 'Preview the newsletter visual system',
          contentHtml: mockHtml,
          typeName: locale === 'pt-BR' ? 'Exemplo' : 'Sample',
          typeColor,
          unsubscribeUrl: `${getMockUrls().unsubscribe}`,
          archiveUrl: `${getMockUrls().archive}`,
          locale,
        }),
      )
      const sizeBytes = Buffer.byteLength(html, 'utf-8')
      return { ok: true, html, sizeBytes }
    }

    default:
      return { ok: false, error: 'invalid_template' }
  }
}

// ─── sendTestTemplate ──────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function sendTestTemplate(
  template: TestTemplate,
  locale: 'en' | 'pt-BR',
  opts?: { editionId?: string; toEmail?: string },
): Promise<SendResult> {
  const ctx = await getSiteContext()
  const authRes = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!authRes.ok) {
    return { ok: false, error: authRes.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden' }
  }

  const userClient = await getUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user?.id) return { ok: false, error: 'no_user_email' }

  const customEmail = opts?.toEmail?.trim()
  if (customEmail && !EMAIL_RE.test(customEmail)) return { ok: false, error: 'invalid_email' }
  const toEmail = customEmail || user.email
  if (!toEmail) return { ok: false, error: 'no_user_email' }

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
      if (opts?.editionId) {
        const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
        const supabase = getSupabaseServiceClient()
        const { data: edition } = await supabase
          .from('newsletter_editions')
          .select('subject')
          .eq('id', opts.editionId)
          .eq('site_id', ctx.siteId)
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
    console.error('[test-center] email send failed:', err instanceof Error ? err.message : 'unknown')
    return { ok: false, error: 'email_send_failed' }
  }

  // Record send for rate limiting
  recordSend(userId)

  return { ok: true }
}
