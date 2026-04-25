import { describe, it, expect } from 'vitest'
import {
  generateRootMetadata,
  generateBlogIndexMetadata,
  generateBlogPostMetadata,
  generateCampaignMetadata,
  generateLegalMetadata,
  generateContactMetadata,
  generateNoindexMetadata,
} from '@/lib/seo/page-metadata'
import { mockConfig, mockPost, mockTxs } from './__fixtures__/seo'

describe('page-metadata factories', () => {
  it('root metadata has siteName + metadataBase', () => {
    const m = generateRootMetadata(mockConfig)
    expect(m.title).toMatchObject({ default: expect.any(String), template: expect.any(String) })
    expect(m.metadataBase?.href).toBe('https://example.com/')
    expect((m.openGraph as { siteName?: string }).siteName).toBe('Example')
  })

  it('blog index has hreflang for supported locales', () => {
    const m = generateBlogIndexMetadata(mockConfig, 'pt-BR')
    const langs = (m.alternates as { languages: Record<string, string> }).languages
    expect(langs).toMatchObject({ pt: '/pt/blog', en: '/blog' })
    expect(langs['x-default']).toBe('/pt/blog')
  })

  it('blog post metadata has per-translation hreflang', () => {
    const m = generateBlogPostMetadata(mockConfig, mockPost, mockTxs)
    const langs = (m.alternates as { languages: Record<string, string> }).languages
    expect(langs['pt']).toBe('/pt/blog/hello-world')
    expect(langs['en']).toBe('/blog/hello-world-en')
    expect((m.openGraph as { type?: string }).type).toBe('article')
  })

  it('legal metadata has noindex=false (indexable)', () => {
    const m = generateLegalMetadata(mockConfig, 'privacy', 'pt-BR')
    expect((m.robots as { index?: boolean } | null)?.index).not.toBe(false)
  })

  it('noindex metadata has robots.index=false', () => {
    const m = generateNoindexMetadata(mockConfig)
    expect((m.robots as { index: boolean; follow: boolean }).index).toBe(false)
    expect((m.robots as { index: boolean; follow: boolean }).follow).toBe(false)
  })

  it('campaign metadata preserves og_image_url when set', () => {
    const m = generateCampaignMetadata(mockConfig, {
      slug: 'c1',
      locale: 'pt-BR',
      meta_title: 'T',
      meta_description: 'D',
      og_image_url: 'https://x.com/og.png',
    })
    const images = (m.openGraph as { images?: Array<{ url: string }> }).images
    expect(images?.[0]).toMatchObject({ url: 'https://x.com/og.png' })
  })

  it('contact metadata is indexable with ContactPage-relevant OG', () => {
    const m = generateContactMetadata(mockConfig, 'pt-BR')
    expect(String(m.title)).toMatch(/contact|fale/i)
    expect((m.robots as { index?: boolean } | null)?.index).not.toBe(false)
  })
})

// C.1 — Snapshot tests that lock the metadata SHAPE before the PR-C page
// refactors wire these factories into real pages. If a refactor changes the
// metadata shape unintentionally, these snapshots will fail. Intentional
// shape changes must be accompanied by an updated snapshot AND a note on
// why the change is backwards-compatible (or why we accept breakage).
//
// Each snapshot uses JSON.stringify(..., null, 2) to get stable diffs — the
// URL instance in metadataBase is serialized to a string via toString(),
// which vitest's default inline snapshot would otherwise drop.
function serialize(m: unknown): string {
  return JSON.stringify(
    m,
    (_key, value) => (value instanceof URL ? value.toString() : value),
    2,
  )
}

describe('page-metadata factories — snapshots', () => {
  it('generateRootMetadata shape', () => {
    expect(serialize(generateRootMetadata(mockConfig))).toMatchSnapshot()
  })

  it('generateBlogIndexMetadata shape', () => {
    expect(serialize(generateBlogIndexMetadata(mockConfig, 'pt-BR'))).toMatchSnapshot()
  })

  it('generateBlogPostMetadata shape', () => {
    expect(
      serialize(generateBlogPostMetadata(mockConfig, mockPost, mockTxs)),
    ).toMatchSnapshot()
  })

  it('generateCampaignMetadata shape', () => {
    expect(
      serialize(
        generateCampaignMetadata(mockConfig, {
          slug: 'c1',
          locale: 'pt-BR',
          meta_title: 'Título da campanha',
          meta_description: 'Descrição da campanha',
          og_image_url: 'https://example.com/og/c1.png',
        }),
      ),
    ).toMatchSnapshot()
  })

  it('generateLegalMetadata shape (privacy pt-BR)', () => {
    expect(
      serialize(generateLegalMetadata(mockConfig, 'privacy', 'pt-BR')),
    ).toMatchSnapshot()
  })

  it('generateContactMetadata shape (pt-BR)', () => {
    expect(serialize(generateContactMetadata(mockConfig, 'pt-BR'))).toMatchSnapshot()
  })

  it('generateNoindexMetadata shape', () => {
    expect(serialize(generateNoindexMetadata(mockConfig))).toMatchSnapshot()
  })
})
