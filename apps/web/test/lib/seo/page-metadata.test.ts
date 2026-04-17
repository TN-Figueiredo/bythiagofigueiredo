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
    expect(langs).toMatchObject({ 'pt-BR': '/blog/pt-BR', en: '/blog/en' })
    expect(langs['x-default']).toBe('/blog/pt-BR')
  })

  it('blog post metadata has per-translation hreflang', () => {
    const m = generateBlogPostMetadata(mockConfig, mockPost, mockTxs)
    const langs = (m.alternates as { languages: Record<string, string> }).languages
    expect(langs['pt-BR']).toBe('/blog/pt-BR/hello-world')
    expect(langs['en']).toBe('/blog/en/hello-world-en')
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
