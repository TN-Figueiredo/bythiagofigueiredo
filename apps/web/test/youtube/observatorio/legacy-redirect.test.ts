// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) } }))
import { canalDoPainel, competitorChannelRedirect, legacyTabRedirect } from '@/app/cms/(authed)/youtube/competitors/_canais/legacy'
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
  const chs = { comp: { id: 'comp', own: false, undated: [] }, mine: { id: 'mine', own: true, undated: [] }, novo: { id: 'novo', own: true, undated: [] }, soSemData: { id: 'soSemData', own: true, undated: [{}] } } as Record<string, { id: string; own: boolean; undated: unknown[] }>
  const obs = { channel: (id: string) => chs[id], videos: [{ ch: 'mine' }] } as unknown as Parameters<typeof competitorChannelRedirect>[0]
  it('concorrente: vai para a página do canal', () => {
    expect(() => competitorChannelRedirect(obs, 'comp')).toThrow('REDIRECT /cms/youtube/competitors/canal/comp')
  })
  it('A4: canal próprio COM vídeos (datados ou só sem data) também vai para a página do canal', () => {
    expect(() => competitorChannelRedirect(obs, 'mine')).toThrow('REDIRECT /cms/youtube/competitors/canal/mine')
    expect(() => competitorChannelRedirect(obs, 'soSemData')).toThrow('REDIRECT /cms/youtube/competitors/canal/soSemData')
  })
  it('canal próprio SEM vídeos (não tem página), id desconhecido e ausência de ?channel= não redirecionam', () => {
    expect(competitorChannelRedirect(obs, 'novo')).toBeUndefined()
    expect(competitorChannelRedirect(obs, 'nope')).toBeUndefined()
    expect(competitorChannelRedirect(obs, undefined)).toBeUndefined()
    expect(competitorChannelRedirect(obs, '')).toBeUndefined()
  })
})

describe('canalDoPainel: o painel lateral não abre para canal que o site conhece', () => {
  const obs = { channel: (id: string) => (id === 'novo' ? { id } : undefined) }
  it('canal conhecido (o próprio sem vídeos que sobrou do redirecionamento): a lista abre sem painel; id desconhecido segue como veio; sem id, undefined', () => {
    expect(canalDoPainel(obs, 'novo')).toBeUndefined()
    expect(canalDoPainel(obs, 'nope')).toBe('nope')
    expect(canalDoPainel(obs, undefined)).toBeUndefined()
    expect(canalDoPainel(obs, '')).toBeUndefined()
  })
})
