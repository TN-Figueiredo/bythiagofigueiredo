import { PROMPT_VERSIONS, STALENESS_THRESHOLDS, EXAMPLE_PROMPTS } from '@/lib/youtube/prompt-types'
import type { ContextPreset } from '@/lib/youtube/prompt-types'

describe('prompt-types', () => {
  it('PROMPT_VERSIONS has all 3 presets with v9 suffix', () => {
    expect(PROMPT_VERSIONS['content-calendar']).toBe('yt-cc-v9')
    expect(PROMPT_VERSIONS['channel-health']).toBe('yt-ch-v9')
    expect(PROMPT_VERSIONS['video-optimizer']).toBe('yt-vo-v9')
  })
  it('STALENESS_THRESHOLDS has warn and critical', () => {
    expect(STALENESS_THRESHOLDS.warn).toBe(24)
    expect(STALENESS_THRESHOLDS.critical).toBe(48)
  })
  it('EXAMPLE_PROMPTS has 2-3 examples per preset', () => {
    const presets: ContextPreset[] = ['content-calendar', 'channel-health', 'video-optimizer']
    for (const preset of presets) {
      expect(EXAMPLE_PROMPTS[preset].length).toBeGreaterThanOrEqual(2)
      expect(EXAMPLE_PROMPTS[preset].length).toBeLessThanOrEqual(3)
    }
  })
})
