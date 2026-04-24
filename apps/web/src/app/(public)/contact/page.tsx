import { Suspense } from 'react'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { ContactForm } from '@/components/contact-form'
import { submitContact } from './actions'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateContactMetadata } from '@/lib/seo/page-metadata'
import { buildBreadcrumbNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'

export const dynamic = 'force-dynamic'

// Sprint 5b PR-C C.5 — add generateMetadata (previously none, page was
// unindexed/inherited root only). Uses generateContactMetadata(config,
// locale) so the canonical + OG site name + Twitter handle stay in sync.
// Locale is hardcoded pt-BR here because the page's ContactForm is also
// hardcoded pt-BR (see the JSX below). When a real /contact/[locale]
// split lands, swap to params.locale.
export async function generateMetadata(): Promise<Metadata> {
  const locale = 'pt-BR'
  const ctx = await tryGetSiteContext()
  if (!ctx) {
    return {
      title: 'Fale comigo',
      alternates: { canonical: '/contact' },
      robots: { index: true, follow: true },
    }
  }
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    return generateContactMetadata(config, locale)
  } catch {
    return {
      title: 'Fale comigo',
      alternates: { canonical: '/contact' },
      robots: { index: true, follow: true },
    }
  }
}

const noticeMessages: Record<string, string> = {
  contact_received:
    'Mensagem enviada com sucesso! Você receberá uma confirmação por email.',
}

const errorMessages: Record<string, string> = {
  validation_error: 'Dados inválidos. Verifique os campos e tente novamente.',
  bot_check_failed: 'Verificação anti-bot falhou. Recarregue a página e tente novamente.',
  submit_failed: 'Erro ao enviar. Por favor, tente novamente.',
  rate_limited: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
}

interface Props {
  searchParams: Promise<{ notice?: string; error?: string }>
}

export default async function ContactPage({ searchParams }: Props) {
  const { notice, error } = await searchParams
  const noticeMessage = notice != null ? (noticeMessages[notice] ?? null) : null
  const errorMessage = error != null ? (errorMessages[error] ?? null) : null

  // Sprint 5b PR-C C.5 — BreadcrumbList JSON-LD (Home -> Contact). Root
  // WebSite + Person/Org nodes come from the public layout.
  const ctx = await tryGetSiteContext()
  const host = (await headers()).get('host') ?? ctx?.primaryDomain ?? ''
  const config = ctx
    ? await getSiteSeoConfig(ctx.siteId, host).catch(() => null)
    : null
  const breadcrumbGraph = config
    ? composeGraph([
        buildBreadcrumbNode([
          { name: 'Home', url: config.siteUrl },
          { name: 'Fale comigo', url: `${config.siteUrl}/contact` },
        ]),
      ])
    : null

  return (
    <>
      {breadcrumbGraph && <JsonLdScript graph={breadcrumbGraph} />}
      <main className="max-w-xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold mb-2">Fale comigo</h1>
        <p className="text-gray-600 mb-8">
          Quer conversar sobre um projeto, parceria ou só trocar uma ideia? Manda mensagem!
        </p>

        {noticeMessage && (
          <div
            role="status"
            aria-live="polite"
            className="mb-6 rounded-lg px-4 py-3 text-sm bg-green-50 text-green-700 border border-green-200"
          >
            {noticeMessage}
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-6 rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200"
          >
            {errorMessage}
          </div>
        )}

        {!noticeMessage && (
          <Suspense>
            <ContactForm locale="pt-BR" submitAction={submitContact} />
          </Suspense>
        )}
      </main>
    </>
  )
}
