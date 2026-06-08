import { describe, it, expect } from 'vitest'
import { CHANNELS, type Channel } from '@/lib/pipeline/channels'

describe('CHANNELS', () => {
  it('exposes per-language channel display config (pt + en)', () => {
    expect(CHANNELS.map(c => c.lang)).toEqual(['pt', 'en'])
  })

  it('carries name + flag per channel', () => {
    const pt = CHANNELS.find(c => c.lang === 'pt')!
    const en = CHANNELS.find(c => c.lang === 'en')!
    expect(pt.name).toBe('tnFigueiredo')
    expect(pt.flag).toBe('🇧🇷')
    expect(en.name).toBe('Thiago Figueiredo')
    expect(en.flag).toBe('🇺🇸')
  })

  it('Channel type smoke', () => {
    const c: Channel = CHANNELS[0]!
    expect(typeof c.name).toBe('string')
  })
})
