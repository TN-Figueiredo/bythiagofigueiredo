import type { Metadata } from 'next'
import { createHash } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { after } from 'next/server'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { deriveCadenceLabel } from '../../../../../lib/newsletter/format'
import { captureServerActionError } from '../../../../lib/sentry-wrap'
import { ConfirmLayout, localePath } from './_layouts/confirm-layout'
import type { NlType } from './_layouts/confirm-layout'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ token: string }>
}

interface ConfirmRpcResult {
  ok: boolean
  already?: boolean
  error?: 'not_found' | 'expired' | 'invalid_state'
  site_id?: string
  email?: string
}

// M3: minimal two-locale copy. Falls back to pt-BR for any other locale.
const COPY = {
  'pt-BR': {
    invalid_title: 'Link inválido',
    invalid_body: 'Este link de confirmação é inválido.',
    rpc_error_title: 'Erro ao confirmar',
    rpc_error_body: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
    not_found_title: 'Link não encontrado',
    not_found_body: 'Este link de confirmação não existe ou já foi utilizado.',
    expired_title: 'Link expirado',
    expired_body:
      'Este link de confirmação expirou. Faça uma nova inscrição para receber um novo link.',
    invalid_state_title: 'Não foi possível confirmar',
    invalid_state_body:
      'Ocorreu um problema com sua inscrição. Entre em contato caso o problema persista.',
    already_title: 'Já confirmado',
    already_body:
      'Seu email já estava confirmado. Você continuará recebendo as edições das suas newsletters.',
    ok_title: 'Inscrição confirmada!',
    ok_body: 'Você agora faz parte de:',
    ok_body_continuation: 'A próxima edição de cada uma vai direto para o seu email.',
    ok_signoff: 'Obrigado por estar aqui.',
    already_signoff: 'Obrigado por estar aqui.',
    go_to_site: 'Ir para o site',
    read_latest: 'Ou leia o último artigo →',
    back_home: 'Voltar ao início',
    subscribed_to: 'Suas newsletters:',
  },
  en: {
    invalid_title: 'Invalid link',
    invalid_body: 'This confirmation link is invalid.',
    rpc_error_title: 'Error confirming',
    rpc_error_body: 'An unexpected error occurred. Please try again later.',
    not_found_title: 'Link not found',
    not_found_body: 'This confirmation link does not exist or has already been used.',
    expired_title: 'Link expired',
    expired_body:
      'This confirmation link has expired. Please subscribe again to receive a new link.',
    invalid_state_title: 'Unable to confirm',
    invalid_state_body:
      'There was a problem with your subscription. Please contact us if the issue persists.',
    already_title: 'Already confirmed',
    already_body:
      'Your email was already confirmed. You will continue receiving editions of your newsletters.',
    ok_title: 'Subscription confirmed!',
    ok_body: 'You are now part of:',
    ok_body_continuation: 'The next edition of each will go straight to your inbox.',
    ok_signoff: 'Thank you for being here.',
    already_signoff: 'Thank you for being here.',
    go_to_site: 'Go to site',
    read_latest: 'Or read the latest article →',
    back_home: 'Back to home',
    subscribed_to: 'Your newsletters:',
  },
} as const

type Locale = keyof typeof COPY
function pickCopy(locale: string | null | undefined) {
  return COPY[(locale && locale in COPY ? locale : 'pt-BR') as Locale]
}

/* ── Newsletter list query ───────────────────────────────────────────────── */

async function getSubscribedTypes(siteId: string, email: string): Promise<NlType[]> {
  try {
    const supabase = getSupabaseServiceClient()
    const { data: subs } = await supabase
      .from('newsletter_subscriptions')
      .select('newsletter_id')
      .eq('site_id', siteId)
      .eq('email', email)
      .eq('status', 'confirmed')

    if (!subs?.length) return []

    const typeIds = subs.map((s) => s.newsletter_id)
    const { data: types } = await supabase
      .from('newsletter_types')
      .select('name, tagline, color, color_dark, cadence_label, cadence_days, cadence_start_date, locale')
      .in('id', typeIds)
      .eq('active', true)
      .order('sort_order')

    return (types ?? []).map((t) => {
      const typeLocale = (t.locale as string) === 'pt-BR' ? 'pt-BR' : 'en'
      return {
        name: t.name as string,
        tagline: t.tagline as string | null,
        color: (t.color as string | null) ?? '#FF8240',
        colorDark: t.color_dark as string | null,
        cadenceLabel: deriveCadenceLabel(
          t.cadence_label as string | null,
          t.cadence_days as number,
          typeLocale,
          t.cadence_start_date as string | null,
        ),
      }
    })
  } catch {
    return []
  }
}

export default async function NewsletterConfirmPage({ params }: Props) {
  const { token } = await params

  if (!token || typeof token !== 'string') {
    const c = pickCopy(null)
    return (
      <ConfirmLayout
        state="invalid"
        title={c.invalid_title}
        body={c.invalid_body}
        backLabel={c.back_home}
        locale="pt-BR"
      />
    )
  }

  try {
    const supabase = getSupabaseServiceClient()
    const tokenHash = createHash('sha256').update(token).digest('hex')

    let locale: string | null = null
    try {
      const { data: row } = await supabase
        .from('newsletter_subscriptions')
        .select('locale')
        .eq('confirmation_token_hash', tokenHash)
        .maybeSingle()
      locale = (row?.locale as string | null) ?? null
    } catch {
      /* best-effort */
    }

    const { data, error: rpcError } = await supabase.rpc('confirm_newsletter_subscription', {
      p_token_hash: tokenHash,
    })

    const result = (data ?? null) as ConfirmRpcResult | null

    if (!locale && result?.email && result.site_id) {
      try {
        const { data: row2 } = await supabase
          .from('newsletter_subscriptions')
          .select('locale')
          .eq('site_id', result.site_id)
          .eq('email', result.email)
          .limit(1)
          .maybeSingle()
        locale = (row2?.locale as string | null) ?? null
      } catch {
        /* best-effort */
      }
    }

    const c = pickCopy(locale)
    const lang = locale === 'en' ? 'en' : 'pt-BR'

    if (rpcError || !result) {
      if (rpcError) {
        captureServerActionError(rpcError, { action: 'confirm_newsletter' })
      }
      return (
        <ConfirmLayout
          state="error"
          title={c.rpc_error_title}
          body={c.rpc_error_body}
          backLabel={c.back_home}
          lang={lang}
          locale={lang}
        />
      )
    }

    if (!result.ok) {
      if (result.error === 'not_found') {
        return (
          <ConfirmLayout
            state="not_found"
            title={c.not_found_title}
            body={c.not_found_body}
            backLabel={c.back_home}
            lang={lang}
            locale={lang}
          />
        )
      }
      if (result.error === 'expired') {
        return (
          <ConfirmLayout
            state="expired"
            title={c.expired_title}
            body={c.expired_body}
            backLabel={c.back_home}
            lang={lang}
            locale={lang}
          />
        )
      }
      return (
        <ConfirmLayout
          state="error"
          title={c.invalid_state_title}
          body={c.invalid_state_body}
          backLabel={c.back_home}
          lang={lang}
          locale={lang}
        />
      )
    }

    if (result.already) {
      const newsletters =
        result.site_id && result.email
          ? await getSubscribedTypes(result.site_id, result.email)
          : []

      return (
        <ConfirmLayout
          state="already"
          title={c.already_title}
          body={c.already_body}
          backLabel={c.back_home}
          lang={lang}
          locale={lang}
          newsletters={newsletters}
          subscribedToLabel={c.subscribed_to}
          signoff={c.already_signoff}
        />
      )
    }

    after(() => revalidateTag('newsletter-suggestions'))

    const newsletters =
      result.site_id && result.email
        ? await getSubscribedTypes(result.site_id, result.email)
        : []

    return (
      <ConfirmLayout
        state="success"
        title={c.ok_title}
        body={c.ok_body}
        bodyContinuation={c.ok_body_continuation}
        backLabel={c.back_home}
        lang={lang}
        locale={lang}
        newsletters={newsletters}
        subscribedToLabel={c.subscribed_to}
        signoff={c.ok_signoff}
        showCta
        ctaLabel={c.go_to_site}
        readLatestLabel={c.read_latest}
      />
    )
  } catch (err) {
    captureServerActionError(err, { action: 'confirm_newsletter', branch: 'outer_catch' })
    const c = pickCopy(null)
    return (
      <ConfirmLayout
        state="error"
        title={c.rpc_error_title}
        body={c.rpc_error_body}
        backLabel={c.back_home}
        locale="pt-BR"
      />
    )
  }
}
