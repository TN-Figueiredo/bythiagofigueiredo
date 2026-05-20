import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/i18n/locale-path', () => ({
  localePath: (path: string, locale: string) => locale === 'en' ? path : `/${locale}${path}`,
  DEFAULT_LOCALE: 'en',
  LOCALE_PREFIX_MAP: { pt: 'pt-BR' },
}))

import { buildCollectionPageNode } from '../../lib/seo/jsonld/builders'
import type { SiteSeoConfig } from '../../lib/seo/config'

const mockConfig: SiteSeoConfig = {
  siteId: 'site-1',
  siteName: 'byThiagoFigueiredo',
  siteUrl: 'https://bythiagofigueiredo.com',
  defaultLocale: 'pt-BR',
  supportedLocales: ['pt-BR', 'en'],
  identityType: 'person',
  primaryColor: '#FF8240',
  logoUrl: null,
  twitterHandle: 'bythiagofig',
  defaultOgImageUrl: null,
  contentPaths: { blog: '/blog', campaigns: '/campaigns' },
  personIdentity: { type: 'person', name: 'Thiago Figueiredo', jobTitle: 'Creator', imageUrl: '/img.jpg', sameAs: [] },
  orgIdentity: null,
}

describe('buildCollectionPageNode', () => {
  it('produces valid CollectionPage JSON-LD', () => {
    const node = buildCollectionPageNode(mockConfig, 'https://go.bythiagofigueiredo.com', 'Test description')
    expect(node['@type']).toBe('CollectionPage')
    expect(node['@id']).toBe('https://go.bythiagofigueiredo.com/#linktree')
    expect(node.url).toBe('https://go.bythiagofigueiredo.com')
    expect(node.name).toBe('Links — byThiagoFigueiredo')
    expect(node.description).toBe('Test description')
    expect(node.mainEntity).toEqual({ '@id': 'https://bythiagofigueiredo.com/#person' })
    expect(node.publisher).toEqual({ '@id': 'https://bythiagofigueiredo.com/#website' })
  })
})

describe('LinktreeOgTemplate', () => {
  it('exports LinktreeOgTemplate from template module', async () => {
    const mod = await import('../../lib/seo/og/template')
    expect(typeof mod.LinktreeOgTemplate).toBe('function')
  })
})
