import { describe, it, expect } from 'vitest'
import { distributionToSocialConfig } from '@/lib/social/distribution-to-config'

describe('distributionToSocialConfig', () => {
  it('mapeia plataformas selecionadas e habilita', () => {
    const cfg = distributionToSocialConfig({ instagram: 'with', bluesky: 'plus1' }, ['#ai'])
    expect(cfg.enabled).toBe(true)
    expect(cfg.platforms.sort()).toEqual(['bluesky', 'instagram'])
    expect(cfg.hashtags).toEqual(['#ai'])
  })

  it('plano vazio desabilita', () => {
    const cfg = distributionToSocialConfig({}, [])
    expect(cfg.enabled).toBe(false)
    expect(cfg.platforms).toEqual([])
  })
})
