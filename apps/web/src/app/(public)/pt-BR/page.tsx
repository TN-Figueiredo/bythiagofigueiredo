import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateRootMetadata } from '@/lib/seo/page-metadata'
import { PinboardHome } from '../components/PinboardHome'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await tryGetSiteContext()
  if (!ctx) {
    return {
      title: 'Thiago Figueiredo — Criador & Builder',
      description: 'Textos, vídeos e experimentos da beira do teclado.',
      alternates: { canonical: '/pt-BR' },
    }
  }
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    const meta = generateRootMetadata(config)
    return {
      ...meta,
      alternates: {
        ...meta.alternates,
        canonical: '/pt-BR',
        languages: { en: '/' },
      },
    }
  } catch {
    return { title: 'Thiago Figueiredo — Criador & Builder' }
  }
}

export default function HomePagePtBR() {
  return <PinboardHome locale="pt-BR" />
}
