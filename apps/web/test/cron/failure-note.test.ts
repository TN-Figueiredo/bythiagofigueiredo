import { describe, it, expect } from 'vitest'
import { channelNote, joinNotes, MAX_NOTE_LENGTH } from '@/lib/cron/failure-note'

describe('failure-note', () => {
  it('rótulo de canal: uma linha, recortado em 80 caracteres', () => {
    const note = channelNote('Canal\ncom\nquebras ' + 'x'.repeat(200), 'causa')
    expect(note).not.toContain('\n')
    expect(note.split(': ')[0]!.length).toBeLessThanOrEqual(80)
    expect(note.endsWith(': causa')).toBe(true)
  })

  it('joinNotes: ≤ 500 chars com "…and K more" quando não cabem', () => {
    const notes = Array.from({ length: 40 }, (_, i) => channelNote(`Canal ${i}`, 'Google token refresh failed (HTTP 500)'))
    const out = joinNotes(notes, '40 cycle(s) failed')
    expect(out.length).toBeLessThanOrEqual(MAX_NOTE_LENGTH)
    expect(out).toMatch(/…and \d+ more$/)
    expect(out).toContain('Canal 0')
  })

  it('joinNotes: poucas notas entram inteiras e duplicatas somem', () => {
    expect(joinNotes(['a: x', 'a: x', 'b: y'], 'P')).toBe('P — a: x; b: y')
  })
})
