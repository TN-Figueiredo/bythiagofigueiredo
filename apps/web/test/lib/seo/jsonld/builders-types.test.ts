import { describe, expect, expectTypeOf, test } from 'vitest'
import type {
  Article,
  BlogPosting,
  BreadcrumbList,
  FAQPage,
  HowTo,
  Organization,
  Person,
  VideoObject,
  WebSite,
} from 'schema-dts'
import {
  buildArticleNode,
  buildBlogPostingNode,
  buildBreadcrumbNode,
  buildFaqNode,
  buildHowToNode,
  buildOrgNode,
  buildPersonNode,
  buildVideoNode,
  buildWebSiteNode,
} from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import {
  mockConfig,
  mockExtras,
  mockOrgProfile,
  mockPersonProfile,
  mockPost,
  mockTxs,
} from '../__fixtures__/seo'

describe('schema-dts type equivalence (compile-time gate)', () => {
  test('Person', () => {
    const n = buildPersonNode(mockConfig, mockPersonProfile)
    expectTypeOf(n).toMatchTypeOf<Person>()
    expect(n['@id']).toMatch(/#person$/)
  })

  test('Organization', () => {
    const n = buildOrgNode(mockConfig, mockOrgProfile)
    expectTypeOf(n).toMatchTypeOf<Organization>()
    expect(n['@id']).toMatch(/#organization$/)
  })

  test('WebSite + SearchAction', () => {
    const n = buildWebSiteNode(mockConfig)
    expectTypeOf(n).toMatchTypeOf<WebSite>()
    expect((n as { potentialAction?: unknown }).potentialAction).toBeDefined()
  })

  test('BlogPosting linked to Person', () => {
    const n = buildBlogPostingNode(mockConfig, mockPost, mockTxs)
    expectTypeOf(n).toMatchTypeOf<BlogPosting>()
    expect((n as { author?: unknown }).author).toEqual({
      '@id': expect.stringMatching(/#person$/),
    })
  })

  test('Article for campaigns', () => {
    const n = buildArticleNode(mockConfig, mockPost, mockTxs)
    expectTypeOf(n).toMatchTypeOf<Article>()
  })

  test('BreadcrumbList', () => {
    const n = buildBreadcrumbNode([
      { name: 'Home', url: 'https://example.com/' },
      { name: 'Blog', url: 'https://example.com/blog/pt-BR' },
    ])
    expectTypeOf(n).toMatchTypeOf<BreadcrumbList>()
  })

  test('FAQPage', () => {
    const n = buildFaqNode(mockExtras.faq!)
    expectTypeOf(n).toMatchTypeOf<FAQPage>()
  })

  test('HowTo', () => {
    const n = buildHowToNode(mockExtras.howTo!)
    expectTypeOf(n).toMatchTypeOf<HowTo>()
  })

  test('VideoObject', () => {
    const n = buildVideoNode(mockExtras.video!)
    expectTypeOf(n).toMatchTypeOf<VideoObject>()
  })
})

describe('graph composition snapshots (output drift detection)', () => {
  test('blog post @graph — full extras', () => {
    const graph = composeGraph([
      buildWebSiteNode(mockConfig),
      buildPersonNode(mockConfig, mockPersonProfile),
      buildBlogPostingNode(mockConfig, mockPost, mockTxs),
      buildBreadcrumbNode([
        { name: 'Home', url: 'https://example.com/' },
        { name: 'Blog', url: 'https://example.com/blog/pt-BR' },
        {
          name: mockPost.translation.title,
          url: `https://example.com/blog/pt-BR/${mockPost.translation.slug}`,
        },
      ]),
      buildFaqNode(mockExtras.faq!),
    ])
    expect(graph).toMatchSnapshot()
  })

  test('blog post @graph — minimal (no extras)', () => {
    const graph = composeGraph([
      buildWebSiteNode(mockConfig),
      buildPersonNode(mockConfig, mockPersonProfile),
      buildBlogPostingNode(mockConfig, mockPost, mockTxs),
    ])
    expect(graph).toMatchSnapshot()
  })

  test('campaign @graph — Article + BreadcrumbList', () => {
    const graph = composeGraph([
      buildWebSiteNode(mockConfig),
      buildPersonNode(mockConfig, mockPersonProfile),
      buildArticleNode(mockConfig, mockPost, mockTxs),
      buildBreadcrumbNode([
        { name: 'Home', url: 'https://example.com/' },
        { name: 'Campaigns', url: 'https://example.com/campaigns/pt-BR' },
        {
          name: mockPost.translation.title,
          url: `https://example.com/campaigns/pt-BR/${mockPost.translation.slug}`,
        },
      ]),
    ])
    expect(graph).toMatchSnapshot()
  })
})
