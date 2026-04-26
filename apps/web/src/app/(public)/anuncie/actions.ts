'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getClientIp, isValidInet } from '../../../../lib/request-ip'
import { verifyTurnstileToken } from '../../../../lib/turnstile'
import { captureServerActionError } from '@/lib/sentry-wrap'

const AD_INQUIRY_CONSENT_VERSION = 'ad-inquiry-v1-2026-04'

const InquirySchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().max(320),
  company: z.string().max(200).optional().transform((v) => v || null),
  website: z.string().url().max(500).optional().or(z.literal('')).transform((v) => v || null),
  message: z.string().min(10).max(5000),
  budget: z.enum(['under_500', '500_2000', '2000_5000', 'above_5000', 'not_sure', '']).optional().transform((v) => v || null),
  turnstile_token: z.string().min(1),
  locale: z.enum(['pt-BR', 'en']).optional(),
})

type InquiryResult =
  | { status: 'ok' }
  | { status: 'validation' }
  | { status: 'captcha_failed' }
  | { status: 'rate_limited' }
  | { status: 'error' }

export async function submitAdInquiry(formData: FormData): Promise<InquiryResult> {
  const h = await headers()
  const ip = getClientIp(h)
  const userAgent = h.get('user-agent') ?? undefined

  const raw = {
    name: formData.get('name'),
    email: formData.get('email'),
    company: formData.get('company') ?? undefined,
    website: formData.get('website') ?? undefined,
    message: formData.get('message'),
    budget: formData.get('budget') ?? undefined,
    turnstile_token: formData.get('turnstile_token'),
    locale: formData.get('locale') ?? undefined,
  }

  const parsed = InquirySchema.safeParse(raw)
  if (!parsed.success) {
    return { status: 'validation' }
  }

  const input = parsed.data

  const turnstileOk = await verifyTurnstileToken(input.turnstile_token, ip ?? undefined)
  if (!turnstileOk) {
    return { status: 'captcha_failed' }
  }

  const supabase = getSupabaseServiceClient()

  // Simple IP-based rate limit: max 3 inquiries per IP per hour
  if (ip && isValidInet(ip)) {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const { count } = await supabase
      .from('ad_inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('submitted_at', oneHourAgo)

    if (count !== null && count >= 3) {
      return { status: 'rate_limited' }
    }
  }

  const { error } = await supabase.from('ad_inquiries').insert({
    app_id: 'bythiagofigueiredo',
    name: input.name,
    email: input.email,
    company: input.company,
    website: input.website,
    message: input.message,
    budget: input.budget,
    consent_processing: true,
    consent_version: AD_INQUIRY_CONSENT_VERSION,
    ip: isValidInet(ip) ? ip : null,
    user_agent: userAgent ?? null,
  })

  if (error) {
    captureServerActionError(error, {
      action: 'submit_ad_inquiry',
      branch: 'insert',
    })
    return { status: 'error' }
  }

  return { status: 'ok' }
}
