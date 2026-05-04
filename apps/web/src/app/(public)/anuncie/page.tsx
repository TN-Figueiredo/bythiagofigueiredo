import { Suspense } from 'react'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { buildBreadcrumbNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { localePath } from '@/lib/i18n/locale-path'
import { AdInquiryForm } from '@/components/ad-inquiry-form'
import { submitAdInquiry } from './actions'

export const dynamic = 'force-dynamic'

const STRINGS = {
  'pt-BR': {
    title: 'Anuncie aqui',
    metaTitle: 'Anuncie aqui',
    metaDescription:
      'Anuncie seu produto, serviço ou projeto para uma audiência qualificada de desenvolvedores e criadores.',
    intro:
      'Espaços nativos, integrados ao conteúdo — sem banners invasivos, sem pop-ups, sem tracking de terceiros.',
    whoReadsTitle: 'Quem lê',
    whoReads: [
      'Desenvolvedores seniores e tech leads',
      'Founders e indie hackers',
      'Criadores de conteúdo técnico',
      'Profissionais de produto e design',
    ],
    formatsTitle: 'Formatos disponíveis',
    formats: [
      {
        name: 'Rail direito',
        desc: 'Card sticky na sidebar do artigo. Alta visibilidade, posição premium.',
      },
      {
        name: 'Inline meio',
        desc: 'Inserido naturalmente entre seções do artigo. Contextual e não-intrusivo.',
      },
      {
        name: 'Block inferior',
        desc: 'Card standalone após o conteúdo. Ideal para retargeting.',
      },
      {
        name: 'Banner topo',
        desc: 'Strip full-width acima do artigo. Dismissable pelo leitor.',
      },
    ],
    howTitle: 'Como funciona',
    howSteps: [
      'Preencha o formulário abaixo com informações sobre seu produto.',
      'Eu crio o copy e o visual do anúncio — nativo, no tom do blog.',
      'O anúncio roda por período combinado com métricas de impressões e cliques.',
      'Sem intermediários, sem plataforma. Direto e transparente.',
    ],
    pricingTitle: 'Preço',
    pricing:
      'CPM flexível, combinado caso a caso. Projetos open-source e indie têm desconto. Primeiro mês com report completo.',
    formTitle: 'Interessado? Preencha abaixo',
  },
  en: {
    title: 'Advertise here',
    metaTitle: 'Advertise here',
    metaDescription:
      'Advertise your product, service, or project to a qualified audience of developers and creators.',
    intro:
      'Native ad slots integrated into content — no invasive banners, no pop-ups, no third-party tracking.',
    whoReadsTitle: 'Who reads',
    whoReads: [
      'Senior developers and tech leads',
      'Founders and indie hackers',
      'Technical content creators',
      'Product and design professionals',
    ],
    formatsTitle: 'Available formats',
    formats: [
      {
        name: 'Right rail',
        desc: 'Sticky card on the article sidebar. High visibility, premium position.',
      },
      {
        name: 'Inline mid',
        desc: 'Naturally inserted between article sections. Contextual and non-intrusive.',
      },
      {
        name: 'Bottom block',
        desc: 'Standalone card after the content. Ideal for retargeting.',
      },
      {
        name: 'Top banner',
        desc: 'Full-width strip above the article. Dismissable by the reader.',
      },
    ],
    howTitle: 'How it works',
    howSteps: [
      'Fill out the form below with info about your product.',
      'I create the copy and visuals — native, matching the blog tone.',
      'The ad runs for an agreed period with impression and click metrics.',
      'No middlemen, no platform. Direct and transparent.',
    ],
    pricingTitle: 'Pricing',
    pricing:
      'Flexible CPM, agreed case by case. Open-source and indie projects get a discount. First month with full report.',
    formTitle: 'Interested? Fill out below',
  },
} as const

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const locale = (h.get('x-locale') ?? 'en') as 'en' | 'pt-BR'
  const s = STRINGS[locale] ?? STRINGS.en
  return {
    title: s.metaTitle,
    description: s.metaDescription,
    alternates: { canonical: localePath('/anuncie', locale) },
    robots: { index: true, follow: true },
  }
}

export default async function AnunciePage() {
  const h = await headers()
  const locale = (h.get('x-locale') ?? 'en') as 'en' | 'pt-BR'
  const s = STRINGS[locale] ?? STRINGS.en

  const ctx = await tryGetSiteContext()
  const host = h.get('host') ?? ctx?.primaryDomain ?? ''
  const config = ctx
    ? await getSiteSeoConfig(ctx.siteId, host).catch(() => null)
    : null
  const breadcrumbGraph = config
    ? composeGraph([
        buildBreadcrumbNode([
          { name: 'Home', url: config.siteUrl },
          { name: s.title, url: `${config.siteUrl}${localePath('/anuncie', locale)}` },
        ]),
      ])
    : null

  return (
    <>
      {breadcrumbGraph && <JsonLdScript graph={breadcrumbGraph} />}
      <main className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold mb-3">{s.title}</h1>
        <p className="text-lg text-muted-foreground mb-10">{s.intro}</p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">{s.whoReadsTitle}</h2>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            {s.whoReads.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">{s.formatsTitle}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {s.formats.map((f) => (
              <div key={f.name} className="rounded-lg border border-border p-4">
                <h3 className="font-medium mb-1">{f.name}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">{s.howTitle}</h2>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            {s.howSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-2">{s.pricingTitle}</h2>
          <p className="text-muted-foreground">{s.pricing}</p>
        </section>

        <section id="form">
          <h2 className="text-xl font-semibold mb-4">{s.formTitle}</h2>
          <Suspense>
            <AdInquiryForm locale={locale} submitAction={submitAdInquiry} />
          </Suspense>
        </section>
      </main>
    </>
  )
}
