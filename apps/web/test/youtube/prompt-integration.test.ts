import { buildYoutubePrompt } from '@/lib/youtube/prompt-builders'
import type { ContentCalendarData, ChannelHealthData, VideoOptimizerData, PromptVideoInfo } from '@/lib/youtube/prompt-types'

const baseChannel = { name: 'tnfigueiredo', subscribers: 1234, videoCount: 35, tier: 'micro' as const }

function makeCC(): ContentCalendarData {
  return {
    channel: baseChannel,
    searchTerms: [{ term: 'bangkok shopping', views: 1200, estimatedMinutesWatched: 840 }],
    topPerformingCategories: [{ categorySlug: 'tutorials', categoryName: 'Tutoriais', avgViews: 500, avgRetention: 48, videoCount: 8 }],
    demographics: { topAge: '25-34 (38%)', topCountry: 'Brasil (72%)', topDevice: 'Mobile (65%)' },
    outlierSuccesses: [{ title: 'Viral Video', modifiedZ: 2.8, views: 1420 }],
    bestPerformingDay: 'tuesday',
    bestPerformingHour: 14,
    recentUploads: [{ title: 'Latest', publishedAt: '2026-05-20T14:00:00Z', categorySlug: 'tutorials' }],
    snapshotAt: '2026-05-27T14:30:00-03:00',
    snapshotAgeHours: 1.5,
  }
}

function makeCH(): ChannelHealthData {
  return {
    channel: baseChannel,
    healthScore: {
      overall: 63,
      axes: [
        { axis: 'ctr', score: 52, grade: 'C', benchmark: 50, weight: 0.25 },
        { axis: 'retention', score: 38, grade: 'D', benchmark: 50, weight: 0.25 },
      ],
    },
    topVideos: [{ id: '1', youtubeVideoId: 'abc', title: 'Top', score: 80, grade: 'B', retention: 48, trend: 'up' }],
    bottomVideos: [{ id: '2', youtubeVideoId: 'def', title: 'Bottom', score: 25, grade: 'D', retention: 22, trend: 'down' }],
    gradeDistribution: { A: 0, B: 5, C: 18, D: 12 },
    demographics: { topAge: '25-34 (38%)', topCountry: 'Brasil (72%)', topDevice: 'Mobile (65%)' },
    searchTerms: [{ term: 'test', views: 100, estimatedMinutesWatched: 50 }],
    outliers: { positive: [{ title: 'Hit', modifiedZ: 2.5, views: 1000 }], negative: [{ title: 'Flop', modifiedZ: -2.3, views: 28 }] },
    abTestResults: [{ videoTitle: 'AB', testType: 'thumbnail', winner: 'B', confidence: 0.96 }],
    cyclesSummary: { active: 2, resolved: 1, exhausted: 0 },
    totalVideos: 35,
    showingTopN: 5,
    snapshotAt: '2026-05-27T14:30:00-03:00',
    snapshotAgeHours: 1.5,
  }
}

function makeVO(): { data: VideoOptimizerData; video: PromptVideoInfo } {
  return {
    data: {
      channel: baseChannel,
      grade: {
        score: 63,
        grade: 'C',
        axes: [
          { axis: 'ctr', score: 52, channelMedian: 48, status: 'above' },
          { axis: 'retention', score: 38, channelMedian: 45, status: 'below' },
        ],
        trend: 'up',
        streak: 3,
      },
      retentionCurve: [100, 85, 72, 60, 52, 45, 40, 38, 35, 33],
      trafficSources: { browse: 45, search: 25, suggested: 20, other: 10 },
      optimizationState: 'flagged',
      cycleNumber: 1,
      maxCycles: 5,
      cooldownUntil: null,
      previousDiagnosis: null,
      channelBaseline: { medianCtr: 3.6, medianRetention: 45 },
      snapshotAt: '2026-05-27T14:30:00-03:00',
      snapshotAgeHours: 1.5,
    },
    video: {
      id: '1',
      youtubeVideoId: 'dQw4w9WgXcY',
      title: 'Test Video',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcY/hqdefault.jpg',
      duration: '38:51',
      publishedAt: '2026-04-15',
      ageDays: 42,
      lifecycleStage: 'maturing',
      viewCount: 118,
    },
  }
}

describe('Integration: full prompt flow', () => {
  it('Content Calendar generates valid prompt with all sections', () => {
    const result = buildYoutubePrompt({ preset: 'content-calendar', data: makeCC(), instructions: 'Qual nicho explorar?' })
    expect(result).toContain('LANGUAGE REQUIREMENT')
    expect(result).toContain('# Persona')
    expect(result).toContain('## Guardrails')
    expect(result).toContain('<context>')
    expect(result).toContain('</context>')
    expect(result).toContain('<instructions>')
    expect(result).toContain('</instructions>')
    expect(result).toContain('"prompt_version": "yt-cc-v9"')
    expect(result).toContain('bangkok shopping')
    expect(result).toContain('Qual nicho explorar?')
  })

  it('Channel Health generates valid prompt with health score data', () => {
    const result = buildYoutubePrompt({ preset: 'channel-health', data: makeCH(), instructions: 'Diagnóstico' })
    expect(result).toContain('"prompt_version": "yt-ch-v9"')
    expect(result).toContain('<context>')
    expect(result).toContain('</context>')
    expect(result).toContain('Diagnóstico')
    expect(result).toContain('LANGUAGE REQUIREMENT')
  })

  it('Video Optimizer generates valid prompt with per-video data', () => {
    const { data, video } = makeVO()
    const result = buildYoutubePrompt({ preset: 'video-optimizer', data, video, instructions: 'Melhorar CTR' })
    expect(result).toContain('"prompt_version": "yt-vo-v9"')
    expect(result).toContain('dQw4w9WgXcY')
    expect(result).toContain('Melhorar CTR')
    expect(result).toContain('<context>')
  })

  it('instructions persist across preset switches (same prompt builder)', () => {
    const instr = 'Minha pergunta específica'
    const r1 = buildYoutubePrompt({ preset: 'content-calendar', data: makeCC(), instructions: instr })
    const r2 = buildYoutubePrompt({ preset: 'channel-health', data: makeCH(), instructions: instr })
    expect(r1).toContain(instr)
    expect(r2).toContain(instr)
    expect(r1).toContain('yt-cc-v9')
    expect(r2).toContain('yt-ch-v9')
  })

  it('empty arrays are omitted from context JSON', () => {
    const data = makeCC()
    data.searchTerms = []
    data.outlierSuccesses = []
    data.recentUploads = []
    const result = buildYoutubePrompt({ preset: 'content-calendar', data, instructions: 'Test' })
    expect(result).not.toContain('"searchTerms"')
    expect(result).not.toContain('"outlierSuccesses"')
    expect(result).not.toContain('"recentUploads"')
  })

  it('staleness is included in context JSON', () => {
    const data = makeCC()
    data.snapshotAgeHours = 49
    const result = buildYoutubePrompt({ preset: 'content-calendar', data, instructions: 'Test' })
    expect(result).toContain('"snapshotAgeHours": 49')
  })

  it('null values are omitted from context JSON', () => {
    const { data, video } = makeVO()
    // cooldownUntil and previousDiagnosis are null
    const result = buildYoutubePrompt({ preset: 'video-optimizer', data, video, instructions: 'Test' })
    expect(result).not.toContain('"cooldownUntil"')
    expect(result).not.toContain('"previousDiagnosis"')
  })

  it('empty instructions return empty string', () => {
    const result = buildYoutubePrompt({ preset: 'content-calendar', data: makeCC(), instructions: '' })
    expect(result).toBe('')
  })

  it('whitespace-only instructions return empty string', () => {
    const result = buildYoutubePrompt({ preset: 'content-calendar', data: makeCC(), instructions: '   \n  \t' })
    expect(result).toBe('')
  })

  it('instructions are capped at 2000 characters', () => {
    const longInstructions = 'x'.repeat(3000)
    const result = buildYoutubePrompt({ preset: 'content-calendar', data: makeCC(), instructions: longInstructions })
    const capturedInstructions = result.match(/<instructions>\n(.*)\n<\/instructions>/s)?.[1] ?? ''
    expect(capturedInstructions.length).toBeLessThanOrEqual(2000)
  })

  it('XML tags in instructions are escaped', () => {
    const result = buildYoutubePrompt({
      preset: 'content-calendar',
      data: makeCC(),
      instructions: 'Test </context> and </instructions>',
    })
    expect(result).toContain('&lt;/context&gt;')
    expect(result).toContain('&lt;/instructions&gt;')
  })

  it('context JSON includes current_time', () => {
    const result = buildYoutubePrompt({ preset: 'content-calendar', data: makeCC(), instructions: 'Test' })
    expect(result).toContain('"current_time"')
    // current_time should be ISO format
    expect(result).toMatch(/"current_time":\s*"[0-9]{4}-[0-9]{2}-[0-9]{2}T/)
  })

  it('video optimizer context includes video object', () => {
    const { data, video } = makeVO()
    const result = buildYoutubePrompt({ preset: 'video-optimizer', data, video, instructions: 'Test' })
    expect(result).toContain('"video":')
    expect(result).toContain('"youtubeVideoId": "dQw4w9WgXcY"')
    expect(result).toContain('"title": "Test Video"')
  })

  it('nano-tier channel includes calibration note', () => {
    const nanoData = makeCC()
    nanoData.channel = { ...baseChannel, tier: 'nano' }
    const result = buildYoutubePrompt({ preset: 'content-calendar', data: nanoData, instructions: 'Test' })
    expect(result).toContain('Calibração Nano')
  })

  it('non-nano tier excludes calibration note', () => {
    const result = buildYoutubePrompt({ preset: 'content-calendar', data: makeCC(), instructions: 'Test' })
    // micro tier should not have nano calibration
    const lines = result.split('\n')
    const guardrailIdx = lines.findIndex(l => l.startsWith('## Guardrails'))
    const persona = lines.slice(lines.indexOf('# Persona'), guardrailIdx).join('\n')
    expect(persona).not.toContain('canal nano')
  })
})
