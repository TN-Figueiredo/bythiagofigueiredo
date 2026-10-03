// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { titleDiff, diffLines, stripUtm } from '@/lib/youtube/observatorio/text-diff'

describe('titleDiff', () => {
  it('a word present in both titles is "mudou de lugar", not removed/added', () => {
    const d = titleDiff('Claude Opus 5.5 Is Crazy Good', 'Claude Opus 5.5 Didn’t Need to Go This Hard')
    expect(d.removed).not.toContain('Claude')
  })
  it('case-only changes are op "case"', () => {
    const d = titleDiff('this ai model is insanely fast', 'This AI Model Is INSANELY Fast')
    expect(d.hasCaseChange).toBe(true); expect(d.removed).toEqual([]); expect(d.added).toEqual([])
  })
  it('repeated words match by count ($1M twice → once)', () => {
    const d = titleDiff('How I Built a $1M Solo AI Business ($0 to $1M)', 'I Forced Myself to Build $1M Business with AI')
    expect(d.removed.filter(w => w.includes('$1M')).length).toBe(1)
  })
})
describe('diffLines', () => {
  it('UTM-only edits are "utm", not add/rem', () => {
    const d = diffLines(['https://x.co/?utm_source=a'], ['https://x.co/?utm_source=b'])
    expect(d).toMatchObject({ add: 0, rem: 0, utm: 1, label: '+0 −0 linhas + 1 UTM' })
  })
  it('stripUtm keeps other params', () => expect(stripUtm('https://x.co/?a=1&utm_x=2')).toBe('https://x.co/?a=1'))
})
