import { describe, it, expect } from 'vitest'
import { toSocialPost } from '@/lib/social/row-parsers'

describe('toSocialPost queue_position', () => {
  const baseRow = {
    id: 'test-1', site_id: 's1', created_by: 'u1', type: 'text',
    status: 'scheduled', content: {}, idempotency_key: 'k1',
    created_at: '2026-01-01', updated_at: '2026-01-01',
    user_timezone: 'America/Sao_Paulo',
  }

  it('parses queue_position when present', () => {
    const post = toSocialPost({ ...baseRow, queue_position: 3 })
    expect(post.queue_position).toBe(3)
  })

  it('defaults to null when queue_position is missing', () => {
    const post = toSocialPost(baseRow)
    expect(post.queue_position).toBeNull()
  })
})
