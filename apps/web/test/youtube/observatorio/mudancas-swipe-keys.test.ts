// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { ObsChange } from '@/lib/youtube/observatorio/changes'
import { resolveSwipeKeys } from '@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-keys'

const ch = (id: string, video: string, type: ObsChange['type'], fromId: string, toId: string) => ({ id, video, type, fromId, toId }) as ObsChange
const L = (id: string, video: string, change_type: string, detected_at: string) => ({ id, video_id: video, change_type, detected_at })

describe('resolveSwipeKeys', () => {
  it('a real change uses its toId (to_version_id)', () => {
    expect(resolveSwipeKeys([ch('v/title/3', 'v', 'title', 'ver2', 'ver3')], []).get('v/title/3')).toBe('ver3')
  })
  it('a legacy row loaded as a version is its own key', () => {
    const k = resolveSwipeKeys([ch('v/title/1', 'v', 'title', 'L1/antes', 'L1')], [L('L1', 'v', 'title', '2026-06-01T12:00:00Z')])
    expect(k.get('v/title/1')).toBe('L1')
  })
  it('a single legacy row merged into the first real version is recovered from "<id>/antes"', () => {
    const k = resolveSwipeKeys([ch('v/title/1', 'v', 'title', 'L1/antes', 'real1')], [L('L1', 'v', 'title', '2026-06-01T12:00:00Z')])
    expect(k.get('v/title/1')).toBe('L1')
  })
  it('the last of several legacy rows is the one after fromId, in detection order and per field', () => {
    const legacy = [L('L2', 'v', 'description', '2026-07-01T12:00:00Z'), L('L1', 'v', 'description', '2026-06-01T12:00:00Z'), L('T1', 'v', 'title', '2026-06-15T12:00:00Z')]
    const k = resolveSwipeKeys([ch('v/desc/2', 'v', 'desc', 'L1', 'real1')], legacy)
    expect(k.get('v/desc/2')).toBe('L2')
  })
  it('unresolvable → null', () => {
    const k = resolveSwipeKeys([ch('v/title/2', 'v', 'title', 'L9', 'real1'), ch('w/title/1', 'w', 'title', 'X/antes', 'real2')], [L('L9', 'v', 'title', '2026-06-01T12:00:00Z')])
    expect(k.get('v/title/2')).toBeNull()
    expect(k.get('w/title/1')).toBeNull()
  })
})
