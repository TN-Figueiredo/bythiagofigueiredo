// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) } }))
import { competitorChannelRedirect, legacyTabRedirect } from '@/app/cms/(authed)/youtube/competitors/_canais/legacy'
describe('legacy ?tab=', () => {
  it('maps tabs to routes', () => {
    expect(() => legacyTabRedirect('mudancas')).toThrow('REDIRECT /cms/youtube/competitors/mudancas')
    expect(() => legacyTabRedirect('outliers')).toThrow('REDIRECT /cms/youtube/competitors/outliers')
    expect(() => legacyTabRedirect('insights')).toThrow('REDIRECT /cms/youtube/competitors/insights')
    expect(legacyTabRedirect('canais')).toBeUndefined()
    expect(legacyTabRedirect(undefined)).toBeUndefined()
  })
})

describe('competitorChannelRedirect (?channel= do painel antigo)', () => {
  const obs = { channel: (id: string) => ({ comp: { id: 'comp', own: false }, mine: { id: 'mine', own: true } } as Record<string, { id: string; own: boolean }>)[id] }
  it('concorrente: vai para a página do canal', () => {
    expect(() => competitorChannelRedirect(obs, 'comp')).toThrow('REDIRECT /cms/youtube/competitors/canal/comp')
  })
  it('canal próprio, id desconhecido e ausência de ?channel= não redirecionam', () => {
    expect(competitorChannelRedirect(obs, 'mine')).toBeUndefined()
    expect(competitorChannelRedirect(obs, 'nope')).toBeUndefined()
    expect(competitorChannelRedirect(obs, undefined)).toBeUndefined()
    expect(competitorChannelRedirect(obs, '')).toBeUndefined()
  })
})
