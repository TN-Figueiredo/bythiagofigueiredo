import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { sendWelcomeEmail } from '../../../../../lib/newsletter/welcome-email'
import { generateUnsubscribeToken } from '../../../../../lib/newsletter/confirm-email'
import { deriveCadenceLabel } from '../../../../../lib/newsletter/format'
import * as Sentry from '@sentry/nextjs'
import type { NewsletterListItem } from '../../../../emails/components/email-newsletter-list'

const BATCH_SIZE = 50
const THROTTLE_MS = 100

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  const { data: pending } = await supabase
    .from('newsletter_subscriptions')
    .select('id, email, locale, site_id, newsletter_id')
    .eq('status', 'confirmed')
    .eq('welcome_sent', false)
    .limit(BATCH_SIZE)

  if (!pending?.length) {
    return Response.json({ status: 'ok', sent: 0 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

  // Group by (site_id, email) to send one welcome email per subscriber
  const grouped = new Map<string, typeof pending>()
  for (const sub of pending) {
    const key = `${sub.site_id}:${sub.email}`
    const group = grouped.get(key) ?? []
    group.push(sub)
    grouped.set(key, group)
  }

  let sentCount = 0

  for (const [, subs] of grouped) {
    const first = subs[0]!  // subs always non-empty: only pushed groups enter the Map
    const typeIds = subs.map((s) => s.newsletter_id)

    const { data: types } = await supabase
      .from('newsletter_types')
      .select('name, tagline, color, cadence_label, cadence_days, cadence_start_date, locale')
      .in('id', typeIds)
      .eq('active', true)

    const newsletterNames: NewsletterListItem[] = (types ?? []).map((t) => {
      const typeLocale = (t.locale === 'pt-BR' ? 'pt-BR' : 'en') as 'en' | 'pt-BR'
      const cadence = deriveCadenceLabel(
        t.cadence_label,
        t.cadence_days as number,
        typeLocale,
        t.cadence_start_date as string | null,
      )
      return {
        name: t.name,
        tagline:
          t.tagline && cadence
            ? `${t.tagline} · ${cadence}`
            : (t.tagline ?? cadence ?? ''),
        color: t.color ?? '#FF8240',
      }
    })

    let latestArticle: { title: string; url: string; excerpt?: string } | undefined
    try {
      const { data: post } = await supabase
        .from('posts')
        .select('slug, title, excerpt')
        .eq('site_id', first.site_id)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (post) {
        const locale = first.locale ?? 'pt-BR'
        const prefix = locale === 'pt-BR' ? '/pt' : ''
        latestArticle = {
          title: post.title,
          url: `${appUrl}${prefix}/blog/${post.slug}`,
          excerpt: post.excerpt ?? undefined,
        }
      }
    } catch {
      // best-effort
    }

    try {
      const { raw: rawToken, hash: tokenHash } = generateUnsubscribeToken(first.site_id, first.email)

      await supabase
        .from('unsubscribe_tokens')
        .upsert(
          { site_id: first.site_id, email: first.email, token_hash: tokenHash },
          { onConflict: 'site_id,email', ignoreDuplicates: false },
        )

      const unsubscribeUrl = `${appUrl}/api/newsletters/unsubscribe?token=${rawToken}`

      const sent = await sendWelcomeEmail({
        to: first.email,
        locale: first.locale ?? 'pt-BR',
        newsletterNames,
        latestArticle,
        unsubscribeUrl,
      })

      if (sent) {
        const ids = subs.map((s) => s.id)
        await supabase
          .from('newsletter_subscriptions')
          .update({ welcome_sent: true })
          .in('id', ids)

        sentCount++
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { component: 'cron', job: 'send-welcome-emails' },
      })
    }

    await sleep(THROTTLE_MS)
  }

  return Response.json({ status: 'ok', sent: sentCount })
}
