import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { LegalShell } from '@/components/legal/legal-shell'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Data deletion request',
  robots: { index: false, follow: false },
}

const CODE_RE = /^[0-9a-f]{32}$/

interface Props {
  searchParams: Promise<{ code?: string; lang?: string }>
}

const COPY = {
  en: {
    heading: 'Data deletion request',
    received: (d: string) => `Request received on ${d}.`,
    deleted: (d: string) =>
      `Any Instagram access token, cached posts and cached images that this site held for the account identified in the request were deleted on ${d}.`,
    inProgress:
      'Deletion is in progress — this page will show the completion date once it finishes. Please check back in a few minutes.',
    none: 'If the site held no data for that account, nothing was stored to delete.',
    handle:
      'The account handle configured in the CMS is kept as site configuration and is not personal data of the requester.',
    retention:
      'A record of this request (account identifier and date) is retained for up to 180 days as proof of processing.',
  },
  'pt-BR': {
    heading: 'Pedido de exclusão de dados',
    received: (d: string) => `Pedido recebido em ${d}.`,
    deleted: (d: string) =>
      `Todo token de acesso do Instagram, posts em cache e imagens em cache que este site mantinha para a conta identificada no pedido foram excluídos em ${d}.`,
    inProgress:
      'A exclusão está em andamento — esta página mostrará a data de conclusão assim que terminar. Volte em alguns minutos.',
    none: 'Se o site não mantinha dados dessa conta, não havia nada armazenado para excluir.',
    handle:
      'O nome de usuário configurado no CMS é mantido como configuração do site e não é dado pessoal do solicitante.',
    retention:
      'Um registro deste pedido (identificador da conta e data) é mantido por até 180 dias como prova do tratamento.',
  },
} as const

function pickLocale(lang: string | undefined, acceptLanguage: string | null, fallback: string): 'pt-BR' | 'en' {
  if (lang === 'pt-BR' || lang === 'en') return lang
  const accept = (acceptLanguage ?? '').toLowerCase()
  if (accept.startsWith('pt')) return 'pt-BR'
  if (accept.startsWith('en')) return 'en'
  return fallback.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
}

function clientIp(h: Headers): string {
  const fwd = h.get('x-forwarded-for')
  return (fwd?.split(',')[0] ?? '').trim() || (h.get('x-real-ip') ?? 'unknown')
}

function formatDate(iso: string, locale: 'pt-BR' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'pt-BR' ? 'pt-BR' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC', timeZoneName: 'short',
  }).format(new Date(iso))
}

export default async function DataDeletionPage({ searchParams }: Props) {
  const params = await searchParams
  const h = await headers()
  const locale = pickLocale(params.lang, h.get('accept-language'), h.get('x-default-locale') ?? 'en')
  const t = COPY[locale]
  const code = params.code ?? ''

  let row: { requested_at: string; completed_at: string | null } | null = null

  // `code` MUST casar a forma ANTES de qualquer query. Rate limit por (IP × dia
  // UTC) salgado com CRON_SECRET: `sha256(ip + dia)` puro é reversível em
  // segundos sobre ~4·10⁹ IPv4, e cada linha seria dado pessoal pseudonimizado
  // de alguém exercendo um direito LGPD.
  if (CODE_RE.test(code)) {
    const supabase = getSupabaseServiceClient()
    const salt = process.env.CRON_SECRET
    let allowed = true
    if (salt) {
      try {
        const day = new Date().toISOString().slice(0, 10)
        const digest = createHash('sha256').update(`${salt}|${clientIp(h)}|${day}`).digest('hex')
        const { data } = await supabase.rpc('ops_alert_claim', {
          p_key: `ddpage:${digest}`,
          p_min_interval: '2 seconds',
        })
        allowed = data === true
      } catch {
        allowed = true                                   // fail-open, deliberado
      }
    }
    if (allowed) {
      const { data } = await supabase
        .from('instagram_deletion_requests')
        .select('requested_at, completed_at')
        .eq('confirmation_code', code)
        .maybeSingle()
      row = (data ?? null) as { requested_at: string; completed_at: string | null } | null
    }
  }

  return (
    <LegalShell
      locale={locale}
      lastUpdated={new Date().toISOString().slice(0, 10)}
      relatedDocs={[]}
      localeSwitcherHref={(other) => `?code=${encodeURIComponent(code)}&lang=${other}`}
    >
      <h1>{t.heading}</h1>
      {row && <p>{t.received(formatDate(row.requested_at, locale))}</p>}
      {row && (
        <p>{row.completed_at ? t.deleted(formatDate(row.completed_at, locale)) : t.inProgress}</p>
      )}
      <p>{t.none}</p>
      <p>{t.handle}</p>
      <p>{t.retention}</p>
    </LegalShell>
  )
}
