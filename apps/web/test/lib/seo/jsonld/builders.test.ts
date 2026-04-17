import { describe, it, expect } from 'vitest'
import {
  buildPersonNode, buildOrgNode, buildWebSiteNode, buildBlogPostingNode,
  buildArticleNode, buildBreadcrumbNode, buildFaqNode, buildHowToNode, buildVideoNode,
} from '@/lib/seo/jsonld/builders'
import { mockConfig, mockPersonProfile, mockOrgProfile, mockPost, mockTxs, mockExtras } from '../__fixtures__/seo'

describe('builders', () => {
  it('buildPersonNode emits Person with #person @id', () => {
    const n = buildPersonNode(mockConfig, mockPersonProfile)
    expect(n['@type']).toBe('Person')
    expect(n['@id']).toBe('https://example.com/#person')
    expect(n.name).toBe('Thiago Figueiredo')
    expect((n.sameAs as string[])).toHaveLength(2)
  })

  it('buildOrgNode emits Organization with #organization @id', () => {
    const n = buildOrgNode(mockConfig, mockOrgProfile)
    expect(n['@type']).toBe('Organization')
    expect(n['@id']).toBe('https://example.com/#organization')
  })

  it('buildWebSiteNode includes SearchAction', () => {
    const n = buildWebSiteNode(mockConfig)
    expect(n['@type']).toBe('WebSite')
    expect((n as any).potentialAction).toBeDefined()
  })

  it('buildBlogPostingNode links author to Person @id', () => {
    const n = buildBlogPostingNode(mockConfig, mockPost, mockTxs)
    expect(n['@type']).toBe('BlogPosting')
    expect((n as any).author).toEqual({ '@id': 'https://example.com/#person' })
    expect((n as any).image).toMatch(/\/og\/blog\//)
  })

  it('buildArticleNode emits Article for campaigns', () => {
    const n = buildArticleNode(mockConfig, mockPost, mockTxs)
    expect(n['@type']).toBe('Article')
  })

  it('buildBreadcrumbNode emits ordered ListItem array', () => {
    const n = buildBreadcrumbNode([
      { name: 'Home', url: 'https://example.com/' },
      { name: 'Blog', url: 'https://example.com/blog/pt-BR' },
    ])
    expect(n['@type']).toBe('BreadcrumbList')
    expect((n as any).itemListElement).toHaveLength(2)
    expect((n as any).itemListElement[0].position).toBe(1)
  })

  it('buildFaqNode emits FAQPage', () => {
    const n = buildFaqNode(mockExtras.faq!)
    expect(n['@type']).toBe('FAQPage')
    expect((n as any).mainEntity).toHaveLength(2)
  })

  it('buildHowToNode emits HowTo with steps', () => {
    const n = buildHowToNode(mockExtras.howTo!)
    expect(n['@type']).toBe('HowTo')
    expect((n as any).step).toHaveLength(2)
  })

  it('buildVideoNode emits VideoObject', () => {
    const n = buildVideoNode(mockExtras.video!)
    expect(n['@type']).toBe('VideoObject')
    expect((n as any).uploadDate).toBe('2026-04-10')
  })
})
