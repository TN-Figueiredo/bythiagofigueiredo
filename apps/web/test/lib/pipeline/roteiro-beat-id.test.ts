// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { RoteiroBeatSchemaV3, RoteiroContentSchemaV3 } from '@/lib/pipeline/roteiro-schemas'

describe('RoteiroBeatSchemaV3 — optional beat id (back-compat)', () => {
  it('parses an old beat with no id (back-compat)', () => {
    const r = RoteiroBeatSchemaV3.safeParse({ idx: 0, name: 'HOOK', script: [] })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.id).toBeUndefined()
  })
  it('parses a new beat carrying an id', () => {
    const r = RoteiroBeatSchemaV3.safeParse({ idx: 0, name: 'HOOK', id: 'beat-1', script: [] })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.id).toBe('beat-1')
  })
  it('rejects an empty-string id (min 1)', () => {
    const r = RoteiroBeatSchemaV3.safeParse({ idx: 0, name: 'HOOK', id: '', script: [] })
    expect(r.success).toBe(false)
  })
  it('still parses v3 content with no ids on beats (version not bumped)', () => {
    const r = RoteiroContentSchemaV3.safeParse({
      version: 3,
      meta: {},
      beats: [{ idx: 0, name: 'HOOK', script: [{ type: 'line', text: 'Oi' }] }],
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.version).toBe(3)
  })
})
