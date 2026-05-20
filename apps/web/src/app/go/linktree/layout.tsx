import type { Metadata } from 'next'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateLinktreeMetadata } from '@/lib/seo/page-metadata'
import { buildPersonNode, buildWebSiteNode, buildCollectionPageNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'

export async function generateMetadata(): Promise<Metadata> {
  const hdrs = await headers()
  const siteId = hdrs.get('x-site-id')
  const shortDomain = hdrs.get('x-short-domain') ?? 'go.bythiagofigueiredo.com'
  if (!siteId) return { title: 'Links' }

  const config = await getSiteSeoConfig(siteId, shortDomain)
  const personName = config.personIdentity?.name ?? config.siteName
  return generateLinktreeMetadata(config, shortDomain, personName)
}

export default async function LinktreeLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers()
  const siteId = hdrs.get('x-site-id')
  const shortDomain = hdrs.get('x-short-domain') ?? 'go.bythiagofigueiredo.com'

  let jsonLd = null
  if (siteId) {
    const config = await getSiteSeoConfig(siteId, shortDomain)
    const goUrl = `https://${shortDomain}`
    const personName = config.personIdentity?.name ?? config.siteName
    const nodes = [buildWebSiteNode(config)]
    if (config.personIdentity) {
      nodes.push(buildPersonNode(config, config.personIdentity))
    }
    nodes.push(
      buildCollectionPageNode(config, goUrl, `All links by ${personName} — blog, YouTube, newsletter and more`),
    )
    jsonLd = composeGraph(nodes)
  }

  return (
    <>
      {/* Preconnect hints for social domain clicks (~100-200ms saved) */}
      <link rel="preconnect" href="https://youtube.com" />
      <link rel="preconnect" href="https://instagram.com" />
      {jsonLd && <JsonLdScript graph={jsonLd} />}
      {children}
    </>
  )
}
