import { describe, it, expect } from 'vitest'
import { buildAbBriefingPrompt, buildAbWritePrompt, buildAbReviewPrompt } from '@/lib/youtube/prompt-builders-ab'
import type { AbBriefingData } from '@/lib/youtube/prompt-types'

function makeAbBriefingData(overrides?: Partial<AbBriefingData>): AbBriefingData {
  return {
    channel: { name: 'Test Channel', subscribers: 5000, tier: 'micro' },
    locale: 'pt',
    testId: '00000000-0000-0000-0000-000000000000',
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

  it('includes prompt version yt-ab-v2 in context', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('yt-ab-v2')
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

  it('locale en produces English instructions for thumbnail', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData({ locale: 'en' }),
    })
    expect(prompt).toContain('Visual composition')
    expect(prompt).toContain('All output MUST be in English')
  })

  it('locale pt produces Portuguese instructions for thumbnail', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData({ locale: 'pt' }),
    })
    expect(prompt).toContain('Composição visual')
    expect(prompt).toContain('PT-BR')
  })
})

describe('edge cases', () => {
  it('very long focus string (1000+ chars) — included in prompt', () => {
    const longFocus = 'A'.repeat(1200)
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
      focus: longFocus,
    })
    // The focus must appear somewhere in the instructions section
    expect(prompt).toContain('Instruções adicionais do usuário:')
    // At least the first 1000 chars must be present (no truncation enforced by this layer)
    expect(prompt).toContain('A'.repeat(1000))
  })

  it('special characters in focus — HTML tags are escaped', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
      focus: '<script>alert("xss")</script>',
    })
    expect(prompt).not.toContain('<script>')
    expect(prompt).toContain('&lt;script>alert("xss")&lt;/script>')
  })

  it('multiple test history entries with mixed null winner_label and ctr_lift_percent', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'title',
      data: makeAbBriefingData({
        testHistory: [
          { test_type: 'thumbnail', winner_label: null, ctr_lift_percent: null },
          { test_type: 'title', winner_label: 'B', ctr_lift_percent: null },
          { test_type: 'combo', winner_label: null, ctr_lift_percent: 5.0 },
          { test_type: 'description', winner_label: 'C', ctr_lift_percent: 7.5 },
        ],
      }),
    })
    // History should still be included (4 entries > 0)
    expect(prompt).toContain('historico_ab')
    expect(prompt).toContain('testes_anteriores')
    // lift_medio should average only completed tests that have a numeric ctr_lift_percent
    // winner 'C' with 7.5 is the only one with both non-null winner AND non-null lift
    // winner 'B' with null lift → contributes 0 to sum
    // avg of [0, 7.5] over 2 completed = 3.75 → "+3.8%"
    expect(prompt).toContain('+3.8%')
    // padroes_vencedores lists all non-null winners
    expect(prompt).toContain('"B"')
    expect(prompt).toContain('"C"')
  })

  it('all 4 test types — each includes focus text when provided', () => {
    const focus = 'Priorizar contraste alto'
    const testTypes = ['thumbnail', 'title', 'description', 'combo'] as const
    for (const testType of testTypes) {
      const prompt = buildAbBriefingPrompt({
        testType,
        data: makeAbBriefingData(),
        focus,
      })
      expect(prompt).toContain('Instruções adicionais do usuário:')
      expect(prompt).toContain(focus)
    }
  })

  it('channel with very high subscriber count — tier is reflected in context', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData({
        channel: { name: 'Big Channel', subscribers: 5_000_000, tier: 'large' },
      }),
    })
    expect(prompt).toContain('"subscribers": 5000000')
    expect(prompt).toContain('"tier": "large"')
    // Large channels should NOT include nano calibration text
    expect(prompt).not.toContain('Calibração Nano')
  })

  it('video title with unicode and emoji characters — included after sanitization', () => {
    const emojiTitle = '🔥 TOP 10 Lugares Incríveis 🌏 — Parte Nº 1'
    const prompt = buildAbBriefingPrompt({
      testType: 'title',
      data: makeAbBriefingData({
        video: {
          title: emojiTitle,
          thumbnailUrl: null,
          ctr: 3.1,
          avgViewPercentage: 40,
          score: 80,
          grade: 'A',
        },
      }),
    })
    // Emojis should survive sanitization
    expect(prompt).toContain('🔥')
    expect(prompt).toContain('🌏')
    // Markdown-sensitive chars like # and | are stripped/escaped by sanitizeForMarkdown
    // but the base text should still be present
    expect(prompt).toContain('TOP 10 Lugares')
  })

  it('empty string focus — treated the same as no focus (no extra instructions block)', () => {
    const promptWithEmpty = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
      focus: '',
    })
    const promptWithUndefined = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
    })
    // Both should omit the "Instruções adicionais" section
    expect(promptWithEmpty).not.toContain('Instruções adicionais do usuário:')
    expect(promptWithUndefined).not.toContain('Instruções adicionais do usuário:')
  })

  it('XSS-like content in video title — angle brackets stripped by sanitizeForMarkdown', () => {
    const xssTitle = '<img src=x onerror=alert(1)> Great Video'
    const prompt = buildAbBriefingPrompt({
      testType: 'combo',
      data: makeAbBriefingData({
        video: {
          title: xssTitle,
          thumbnailUrl: null,
          ctr: 2.5,
          avgViewPercentage: 35,
          score: 60,
          grade: 'C',
        },
      }),
    })
    // sanitizeForMarkdown removes < and > characters
    expect(prompt).not.toContain('<img')
    expect(prompt).not.toContain('onerror=alert(1)>')
    // The safe parts of the title should survive
    expect(prompt).toContain('Great Video')
  })
})

describe('buildAbWritePrompt', () => {
  it('includes workflow steps with test_id', () => {
    const prompt = buildAbWritePrompt({
      testType: 'title',
      data: makeAbBriefingData({ testId: 'abc-123' }),
    })
    expect(prompt).toContain('abc-123')
    expect(prompt).toContain('/api/pipeline/youtube/ab-tests/')
    expect(prompt).toContain('X-Pipeline-Key')
  })

  it('includes API endpoint path with POST method and full baseUrl', () => {
    const prompt = buildAbWritePrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
      baseUrl: 'https://bythiagofigueiredo.com',
    })
    expect(prompt).toContain('POST https://bythiagofigueiredo.com/api/pipeline/youtube/ab-tests/')
    expect(prompt).toContain('/variants')
  })

  it('uses relative path when baseUrl is empty', () => {
    const prompt = buildAbWritePrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('POST /api/pipeline/youtube/ab-tests/')
  })

  it('includes type-specific instructions for title', () => {
    const prompt = buildAbWritePrompt({
      testType: 'title',
      data: makeAbBriefingData({ locale: 'pt' }),
    })
    expect(prompt).toContain('Hook emocional')
    expect(prompt).toContain('power words')
  })

  it('en locale produces English workflow steps', () => {
    const prompt = buildAbWritePrompt({
      testType: 'title',
      data: makeAbBriefingData({ locale: 'en' }),
    })
    expect(prompt).toContain('Discuss ideas with the user')
  })

  it('does NOT contain persona text or guardrails', () => {
    const prompt = buildAbWritePrompt({
      testType: 'title',
      data: makeAbBriefingData(),
    })
    expect(prompt).not.toContain('# Persona')
    expect(prompt).not.toContain('Guardrails')
    expect(prompt).not.toContain('Guia de Confiança')
    expect(prompt).not.toContain('Você é um consultor de YouTube')
    expect(prompt).not.toContain('All output MUST be in English')
    expect(prompt).not.toContain('Não tente fazer requisições HTTP')
  })

  it('contains --- separator between context and API workflow', () => {
    const prompt = buildAbWritePrompt({
      testType: 'title',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('---')
    expect(prompt).toContain('# Auth: include X-Pipeline-Key header in ALL requests.')
  })

  it('includes On 400 and On 409 error handling', () => {
    const prompt = buildAbWritePrompt({
      testType: 'title',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('On 400')
    expect(prompt).toContain('On 409')
  })

  it('appends focus text escaped', () => {
    const prompt = buildAbWritePrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
      focus: 'Focar em <cores quentes>',
    })
    expect(prompt).toContain('&lt;cores quentes>')
    expect(prompt).not.toContain('<cores quentes>')
  })

  it('omits focus section when focus is empty string', () => {
    const prompt = buildAbWritePrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
      focus: '',
    })
    expect(prompt).not.toContain('Instruções adicionais do usuário:')
  })

  it('includes channel info in context header', () => {
    const prompt = buildAbWritePrompt({
      testType: 'title',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('Test Channel')
    expect(prompt).toContain('5000 subs')
    expect(prompt).toContain('micro')
  })

  it('includes video metrics when available', () => {
    const prompt = buildAbWritePrompt({
      testType: 'title',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('CTR: 4.2%')
    expect(prompt).toContain('Grade: B')
  })

  it('notes no performance data when video metrics are null', () => {
    const prompt = buildAbWritePrompt({
      testType: 'title',
      data: makeAbBriefingData({
        video: { title: 'Sem dados', thumbnailUrl: null, ctr: null, avgViewPercentage: null, score: null, grade: null },
      }),
    })
    expect(prompt).toContain('Sem dados de performance disponíveis')
  })

  it('includes test history summary when available', () => {
    const prompt = buildAbWritePrompt({
      testType: 'title',
      data: makeAbBriefingData({
        testHistory: [
          { test_type: 'thumbnail', winner_label: 'B', ctr_lift_percent: 12.5 },
        ],
      }),
    })
    expect(prompt).toContain('Histórico:')
    expect(prompt).toContain('1 testes anteriores')
  })
})

describe('buildAbReviewPrompt', () => {
  it('includes blob URLs for multimodal analysis', () => {
    const prompt = buildAbReviewPrompt({
      testId: 'test-1',
      locale: 'pt',
      variants: [
        { label: 'B', title_text: 'Title B', description_text: null, blob_url: 'https://blob.vercel-storage.com/img.png', metadata: {} },
      ],
      channel: { tier: 'micro' as const, subscribers: 5000 },
    })
    expect(prompt).toContain('https://blob.vercel-storage.com/img.png')
    expect(prompt).toContain('Title B')
  })

  it('does NOT contain persona text or language directive', () => {
    const prompt = buildAbReviewPrompt({
      testId: 'test-1',
      locale: 'en',
      variants: [
        { label: 'B', title_text: 'Title B', description_text: null, blob_url: null, metadata: {} },
      ],
      channel: { tier: 'micro' as const, subscribers: 5000 },
    })
    expect(prompt).not.toContain('# Persona')
    expect(prompt).not.toContain('Guardrails')
    expect(prompt).not.toContain('All output MUST be in English')
    expect(prompt).not.toContain('Você é um consultor de YouTube')
  })

  it('contains auth line with X-Pipeline-Key', () => {
    const prompt = buildAbReviewPrompt({
      testId: 'test-1',
      locale: 'pt',
      variants: [
        { label: 'B', title_text: 'Título B', description_text: null, blob_url: null, metadata: {} },
      ],
      channel: { tier: 'micro' as const, subscribers: 5000 },
    })
    expect(prompt).toContain('# Auth: include X-Pipeline-Key header in ALL requests.')
  })

  it('contains --- separator', () => {
    const prompt = buildAbReviewPrompt({
      testId: 'test-1',
      locale: 'pt',
      variants: [
        { label: 'B', title_text: 'Título B', description_text: null, blob_url: null, metadata: {} },
      ],
      channel: { tier: 'micro' as const, subscribers: 5000 },
    })
    expect(prompt).toContain('---')
  })

  it('includes channel tier and subscribers in header', () => {
    const prompt = buildAbReviewPrompt({
      testId: 'test-1',
      locale: 'pt',
      variants: [
        { label: 'B', title_text: 'Título B', description_text: null, blob_url: null, metadata: {} },
      ],
      channel: { tier: 'micro' as const, subscribers: 5000 },
    })
    expect(prompt).toContain('micro')
    expect(prompt).toContain('5000 subs')
  })

  it('includes variant count in header', () => {
    const prompt = buildAbReviewPrompt({
      testId: 'test-1',
      locale: 'en',
      variants: [
        { label: 'B', title_text: 'Title B', description_text: null, blob_url: null, metadata: {} },
        { label: 'C', title_text: 'Title C', description_text: null, blob_url: null, metadata: {} },
      ],
      channel: { tier: 'micro' as const, subscribers: 5000 },
    })
    expect(prompt).toContain('2 variants')
    expect(prompt).toContain('test-1')
  })
})
