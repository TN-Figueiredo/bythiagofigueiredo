import { describe, it, expect } from 'vitest'
import { buildAbBriefingPrompt } from '@/lib/youtube/prompt-builders-ab'
import type { AbBriefingData } from '@/lib/youtube/prompt-types'

function makeAbBriefingData(overrides?: Partial<AbBriefingData>): AbBriefingData {
  return {
    channel: { name: 'Test Channel', subscribers: 5000, tier: 'micro' },
    video: {
      title: 'O Que Esperar Do MBK Center em Bangkok',
      thumbnailUrl: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      ctr: 4.2,
      avgViewPercentage: 38,
      score: 72,
      grade: 'B',
    },
    testHistory: [],
    snapshotAgeHours: 2,
    ...overrides,
  }
}

describe('buildAbBriefingPrompt', () => {
  it('includes buildSharedBase output (persona, guardrails)', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('# Persona')
    expect(prompt).toContain('Guardrails')
    expect(prompt).toContain('Guia de Confiança')
  })

  it('thumbnail template includes visual composition instructions', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('<instructions>')
    expect(prompt).toContain('composição visual')
    expect(prompt).toContain('3 variações')
  })

  it('title template includes hook and power word instructions', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'title',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('hook emocional')
    expect(prompt).toContain('power words')
  })

  it('description template includes fold and CTA instructions', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'description',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('CTA')
    expect(prompt).toContain('3 primeiras linhas')
  })

  it('combo template includes synergy instructions', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'combo',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('sinergia')
    expect(prompt).toContain('3 combos')
  })

  it('includes cross-test history when available', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData({
        testHistory: [
          { test_type: 'thumbnail', winner_label: 'B', ctr_lift_percent: 12.5 },
          { test_type: 'title', winner_label: 'C', ctr_lift_percent: 8.3 },
        ],
      }),
    })
    expect(prompt).toContain('historico_ab')
    expect(prompt).toContain('testes_anteriores')
  })

  it('handles channel-only fallback when video data is null', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData({
        video: {
          title: 'Video sem dados',
          thumbnailUrl: null,
          ctr: null,
          avgViewPercentage: null,
          score: null,
          grade: null,
        },
      }),
    })
    expect(prompt).toContain('sem dados de performance')
    expect(prompt).toContain('Test Channel')
  })

  it('appends custom focus text escaped', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
      focus: 'Focar em <cores quentes> e expressões faciais',
    })
    expect(prompt).toContain('Focar em &lt;cores quentes> e expressões faciais')
    expect(prompt).not.toContain('<cores quentes>')
  })

  it('omits historico_ab when test history is empty', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'title',
      data: makeAbBriefingData({ testHistory: [] }),
    })
    expect(prompt).not.toContain('historico_ab')
  })

  it('includes prompt version yt-ab-v1 in context', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('yt-ab-v1')
  })

  it('includes video metrics in context block', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('<context>')
    expect(prompt).toContain('"ctr": 4.2')
    expect(prompt).toContain('"grade": "B"')
  })

  it('includes channel info in context block', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'title',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('"name": "Test Channel"')
    expect(prompt).toContain('"subscribers": 5000')
  })
})
