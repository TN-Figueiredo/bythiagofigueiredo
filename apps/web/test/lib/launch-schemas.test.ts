import { describe, it, expect } from 'vitest'
import { LaunchContentSchema } from '@/lib/pipeline/launch-schemas'

describe('LaunchContentSchema', () => {
  it('parses empty launch with defaults', () => {
    const result = LaunchContentSchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data!.launch_type).toBe('seed')
    expect(result.data!.plc_sequence).toHaveLength(3)
    expect(result.data!.plc_sequence[0].theme).toBe('opportunity')
    expect(result.data!.plc_sequence[1].theme).toBe('teaching')
    expect(result.data!.plc_sequence[2].theme).toBe('ownership')
  })

  it('parses full launch', () => {
    const result = LaunchContentSchema.safeParse({
      launch_type: 'internal',
      cart_open_date: '2026-07-10',
      cart_close_date: '2026-07-17',
      bonuses: [{ title: 'Prompt Library', type: 'content' }],
      mental_triggers: { authority: '10 years of AI experience' },
    })
    expect(result.success).toBe(true)
  })
})
