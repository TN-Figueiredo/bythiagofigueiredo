import { describe, it, expect } from 'vitest'
import ptBR from '../../../src/locales/pt-BR.json'
import en from '../../../src/locales/en.json'

describe('locale keys — nav rename', () => {
  it('pt-BR has nav.blog, not nav.writing', () => {
    const t = ptBR as Record<string, unknown>
    expect(t['nav.blog']).toBe('Blog')
    expect(t['nav.writing']).toBeUndefined()
  })

  it('en has nav.blog, not nav.writing', () => {
    const t = en as Record<string, unknown>
    expect(t['nav.blog']).toBe('Blog')
    expect(t['nav.writing']).toBeUndefined()
  })

  it('neither locale has nav.devSite', () => {
    const tPt = ptBR as Record<string, unknown>
    const tEn = en as Record<string, unknown>
    expect(tPt['nav.devSite']).toBeUndefined()
    expect(tEn['nav.devSite']).toBeUndefined()
  })
})

describe('locale keys — section strings', () => {
  const requiredKeys = [
    'home.stats.subscribers', 'home.stats.posts', 'home.stats.videos',
    'home.blog.title', 'home.blog.subtitle', 'home.blog.viewAll',
    'home.blog.emptyTitle', 'home.blog.emptyBody',
    'home.videos.title', 'home.videos.subtitle', 'home.videos.viewAll', 'home.videos.subscribe',
    'home.mostRead.title', 'home.mostRead.subtitle', 'home.tags.title',
    'home.subscribe.headline', 'home.subscribe.subheadline',
    'home.subscribe.nlKicker', 'home.subscribe.nlTitle', 'home.subscribe.nlSubtitle',
    'home.subscribe.ytKicker', 'home.subscribe.ytTitle', 'home.subscribe.ytSubtitle',
  ]

  it.each(requiredKeys)('pt-BR has key "%s"', (key) => {
    expect((ptBR as Record<string, unknown>)[key]).toBeDefined()
  })

  it.each(requiredKeys)('en has key "%s"', (key) => {
    expect((en as Record<string, unknown>)[key]).toBeDefined()
  })
})
