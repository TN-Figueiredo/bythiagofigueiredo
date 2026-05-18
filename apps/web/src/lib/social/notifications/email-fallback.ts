import * as Sentry from '@sentry/nextjs'
import { ResendEmailAdapter } from '@tn-figueiredo/email'

const SENTRY_TAG = { component: 'social-email-notification' }

interface EmailNotificationInput {
  to: string
  imageUrl: string
  shortUrl: string
  readyPageUrl: string
  title: string
}

interface EmailResult {
  ok: boolean
  error?: string
}

export async function sendStoryEmailNotification(
  input: EmailNotificationInput,
): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  const fromDomain =
    process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'

  try {
    const adapter = new ResendEmailAdapter(apiKey)

    const result = await adapter.send({
      from: { email: `noreply@${fromDomain}`, name: 'Social Hub' },
      to: input.to,
      subject: `Story Ready: ${input.title}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0a0a0a; font-size: 20px; margin-bottom: 16px;">Story Ready to Post</h2>
          <p style="color: #525252; font-size: 14px; margin-bottom: 16px;">"${input.title}"</p>
          <img src="${input.imageUrl}" alt="Story preview" style="width: 100%; max-width: 270px; border-radius: 12px; margin-bottom: 16px;" />
          <div style="background: #f5f5f5; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
            <p style="color: #525252; font-size: 12px; margin: 0 0 4px;">Link sticker URL:</p>
            <p style="color: #0a0a0a; font-size: 16px; font-family: monospace; margin: 0; word-break: break-all;">${input.shortUrl}</p>
          </div>
          <a href="${input.readyPageUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500;">Open in CMS</a>
          <ol style="color: #525252; font-size: 13px; line-height: 1.8; margin-top: 24px; padding-left: 20px;">
            <li>Open Instagram and create a new Story</li>
            <li>Upload the image from your gallery</li>
            <li>Add a Link Sticker and paste the URL above</li>
          </ol>
        </div>
      `,
    })

    if (!result.success) {
      Sentry.captureMessage(
        `Resend story email failed: ${result.error ?? 'unknown'}`,
        {
          level: 'warning',
          tags: SENTRY_TAG,
        },
      )
      return { ok: false, error: result.error ?? 'Email send failed' }
    }

    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    Sentry.captureException(err, { tags: SENTRY_TAG })
    return { ok: false, error: message }
  }
}
