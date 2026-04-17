import { describe, it, expect } from 'vitest'
import { buildRobotsRules } from '@/lib/seo/robots-config'
import { mockConfig } from './__fixtures__/seo'

describe('buildRobotsRules', () => {
  it('emits Allow:/ + Disallow protected paths', () => {
    const rules = buildRobotsRules({
      config: mockConfig,
      host: 'example.com',
      aiCrawlersBlocked: false,
      protectedPaths: ['/admin', '/cms'],
    })
    const main = rules.find((r) => (r as { userAgent?: string }).userAgent === '*') as {
      userAgent: string
      allow: string
      disallow: string[]
    }
    expect(main.allow).toBe('/')
    expect(main.disallow).toEqual(expect.arrayContaining(['/admin', '/cms']))
  })

  it('appends AI crawler rules when aiCrawlersBlocked=true', () => {
    const rules = buildRobotsRules({
      config: mockConfig,
      host: 'example.com',
      aiCrawlersBlocked: true,
      protectedPaths: [],
    })
    const agents = rules.map((r) => (r as { userAgent: string }).userAgent)
    expect(agents).toEqual(expect.arrayContaining(['GPTBot', 'CCBot', 'anthropic-ai']))
  })

  it('falls back to permissive rules when config is null', () => {
    const rules = buildRobotsRules({
      config: null,
      host: 'example.com',
      aiCrawlersBlocked: false,
      protectedPaths: [],
    })
    expect(rules[0]).toMatchObject({ userAgent: '*', allow: '/' })
  })
})
