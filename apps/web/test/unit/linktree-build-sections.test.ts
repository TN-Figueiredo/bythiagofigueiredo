import { describe, it, expect } from 'vitest'
import { buildLangSections } from '../../src/app/go/linktree/_lib/build-sections'
import type { LinktreeConfig, NewsletterTypeInfo, YouTubeChannelInfo } from '../../src/app/go/linktree/_lib/types'

const baseConfig: LinktreeConfig = {
  highlight: { active: false, badge_pt: '', badge_en: '', title_pt: '', title_en: '', desc_pt: '', desc_en: '', cta_pt: '', cta_en: '', url: '' },
  tagline_pt: '',
  tagline_en: '',
  blog_desc_pt: 'Artigos sobre código',
  blog_desc_en: 'Posts on code',
  shared_links: [],
}

describe('buildLangSections', () => {
  it('generates sections for both locales with newsletter + youtube', () => {
    const newsletters: NewsletterTypeInfo[] = [
      { name: 'Diário', slug: 'diario', locale: 'pt-BR', cadenceLabel: 'semanal · sextas' },
      { name: 'Journal', slug: 'journal', locale: 'en', cadenceLabel: 'weekly · Fridays' },
    ]
    const channels: YouTubeChannelInfo[] = [
      { handle: 'bythiagofigueiredo', locale: 'pt', scheduleLabel: 'toda quinta', subscriberCount: 2400 },
      { handle: 'thiagofigueiredo', locale: 'en', scheduleLabel: 'every 2 weeks', subscriberCount: 500 },
    ]
    const sections = buildLangSections(['pt-BR', 'en'], newsletters, channels, baseConfig, 'bythiagofigueiredo.com')
    expect(sections).toHaveLength(2)
    expect(sections[0].locale).toBe('pt-BR')
    expect(sections[0].items).toHaveLength(3) // blog + newsletter + youtube
    expect(sections[0].items[0].type).toBe('blog')
    expect(sections[0].items[1].type).toBe('newsletter')
    expect(sections[0].items[2].type).toBe('youtube')
    expect(sections[0].items[2].subscriberCount).toBe(2400)
    expect(sections[1].locale).toBe('en')
    expect(sections[1].items).toHaveLength(3)
  })

  it('includes blog row even when no newsletter or youtube', () => {
    const sections = buildLangSections(['pt-BR'], [], [], baseConfig, 'bythiagofigueiredo.com')
    expect(sections).toHaveLength(1)
    expect(sections[0].items).toHaveLength(1)
    expect(sections[0].items[0].type).toBe('blog')
    expect(sections[0].items[0].desc).toBe('Artigos sobre código')
  })

  it('handles empty locales array', () => {
    const sections = buildLangSections([], [], [], baseConfig, 'bythiagofigueiredo.com')
    expect(sections).toHaveLength(0)
  })

  it('still includes blog item when newsletters and channels are empty', () => {
    const sections = buildLangSections(['pt-BR', 'en'], [], [], baseConfig, 'bythiagofigueiredo.com')
    expect(sections).toHaveLength(2)
    sections.forEach((section) => {
      expect(section.items).toHaveLength(1)
      expect(section.items[0].type).toBe('blog')
    })
  })

  it('uses fallback metadata for unknown locale', () => {
    const sections = buildLangSections(['fr'], [], [], baseConfig, 'bythiagofigueiredo.com')
    expect(sections).toHaveLength(1)
    expect(sections[0].flag).toBe('🌐')
    expect(sections[0].label).toBe('fr')
    expect(sections[0].hand).toBe('fr')
  })

  it('generates expected item IDs', () => {
    const newsletters: NewsletterTypeInfo[] = [
      { name: 'Diário', slug: 'diario', locale: 'pt-BR', cadenceLabel: 'semanal' },
    ]
    const channels: YouTubeChannelInfo[] = [
      { handle: 'bythiagofigueiredo', locale: 'pt', scheduleLabel: 'toda quinta', subscriberCount: 2400 },
    ]
    const sections = buildLangSections(['pt-BR'], newsletters, channels, baseConfig, 'bythiagofigueiredo.com')
    const ids = sections[0].items.map((i) => i.id)
    expect(ids).toEqual(['blog-pt-BR', 'nl-diario', 'yt-bythiagofigueiredo'])
  })

  it('constructs correct URLs for EN items (no prefix)', () => {
    const newsletters: NewsletterTypeInfo[] = [
      { name: 'Journal', slug: 'journal', locale: 'en', cadenceLabel: 'weekly' },
    ]
    const channels: YouTubeChannelInfo[] = [
      { handle: 'thiagofigueiredo', locale: 'en', scheduleLabel: null, subscriberCount: 500 },
    ]
    const sections = buildLangSections(['en'], newsletters, channels, baseConfig, 'bythiagofigueiredo.com')
    const items = sections[0].items
    expect(items[0].url).toBe('https://bythiagofigueiredo.com/blog')
    expect(items[1].url).toBe('https://bythiagofigueiredo.com/newsletters/journal')
    expect(items[2].url).toBe('https://youtube.com/@thiagofigueiredo')
  })

  it('constructs correct URLs for PT items (with /pt prefix)', () => {
    const newsletters: NewsletterTypeInfo[] = [
      { name: 'Diário', slug: 'diario', locale: 'pt-BR', cadenceLabel: 'semanal' },
    ]
    const channels: YouTubeChannelInfo[] = [
      { handle: 'bythiagofigueiredo', locale: 'pt', scheduleLabel: null, subscriberCount: 2400 },
    ]
    const sections = buildLangSections(['pt-BR'], newsletters, channels, baseConfig, 'bythiagofigueiredo.com')
    const items = sections[0].items
    expect(items[0].url).toBe('https://bythiagofigueiredo.com/pt/blog')
    expect(items[1].url).toBe('https://bythiagofigueiredo.com/pt/newsletters/diario')
    expect(items[2].url).toBe('https://youtube.com/@bythiagofigueiredo')
  })
})
