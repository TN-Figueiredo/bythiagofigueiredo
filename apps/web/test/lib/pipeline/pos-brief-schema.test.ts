import { describe, it, expect } from 'vitest'
import { PosBriefSchema, type PosBrief } from '@/lib/pipeline/video-schemas'

/**
 * Mirrors the savePostprod replace-not-merge guard in editor-client.tsx: only shallow-merge
 * onto an existing *valid current* brief; otherwise reset the base to `{ kind: 'brief' }`.
 */
function applyPatch(prev: unknown, patch: Partial<PosBrief>): unknown {
  const base: PosBrief | { kind: 'brief' } = PosBriefSchema.safeParse(prev).success
    ? (prev as PosBrief)
    : { kind: 'brief' }
  return { ...base, ...patch }
}

describe('PosBriefSchema — partial-patch resilience', () => {
  it('parses a brief with no ctas (ctas default applied)', () => {
    const parsed = PosBriefSchema.safeParse({ kind: 'brief' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.ctas).toEqual({ note: '', rows: [], display: '' })
      expect(parsed.data.style).toEqual([])
    }
  })

  it('a partial patch ({deliverables}) merged onto {kind:brief} still parses', () => {
    const next = applyPatch({ kind: 'brief' }, { deliverables: { editor: 'Ana', deadline: '2026-07-01' } })
    const parsed = PosBriefSchema.safeParse(next)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.deliverables).toEqual({ editor: 'Ana', deadline: '2026-07-01' })
      expect(parsed.data.ctas).toEqual({ note: '', rows: [], display: '' })
    }
  })
})

describe('savePostprod replace-not-merge guard', () => {
  it('seeding a patch onto a legacy {schema_version} payload yields a valid brief with no legacy keys', () => {
    const legacy = { schema_version: '2.0', editor_notes: 'old', timeline: [{ t: 0 }] }
    const next = applyPatch(legacy, { deliverables: { editor: 'Bia' } }) as Record<string, unknown>

    // legacy keys must NOT have been carried over
    expect(next).not.toHaveProperty('schema_version')
    expect(next).not.toHaveProperty('editor_notes')
    expect(next).not.toHaveProperty('timeline')

    const parsed = PosBriefSchema.safeParse(next)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.kind).toBe('brief')
      expect(parsed.data.deliverables).toEqual({ editor: 'Bia' })
    }
  })

  it('a payload missing `kind` is treated as invalid → reset base', () => {
    const noKind = { ctas: { note: 'x', rows: [], display: '' } }
    const next = applyPatch(noKind, { style: [{ k: 'mood', v: 'calm' }] }) as Record<string, unknown>
    expect(next.kind).toBe('brief')
    expect(PosBriefSchema.safeParse(next).success).toBe(true)
  })

  it('shallow-merges when prev IS already a valid brief (preserves existing fields)', () => {
    const valid: PosBrief = {
      kind: 'brief',
      ctas: { note: 'keep me', rows: [], display: 'end' },
      style: [{ k: 'pace', v: 'fast' }],
    }
    const next = applyPatch(valid, { deliverables: { editor: 'Caio' } }) as PosBrief
    expect(next.ctas).toEqual({ note: 'keep me', rows: [], display: 'end' })
    expect(next.style).toEqual([{ k: 'pace', v: 'fast' }])
    expect(next.deliverables).toEqual({ editor: 'Caio' })
    expect(PosBriefSchema.safeParse(next).success).toBe(true)
  })
})
