import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { tokenizeText } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/parse-tokens'

describe('tokenizeText', () => {
  it('returns plain text unchanged when no tokens match', () => {
    const { container } = render(<span>{tokenizeText('hello world')}</span>)
    expect(container.textContent).toBe('hello world')
  })

  it('highlights timestamps like 01:42', () => {
    const { container } = render(<span>{tokenizeText('At 01:42 do something')}</span>)
    const chips = container.querySelectorAll('.font-mono')
    expect(chips.length).toBe(1)
    expect(chips[0].textContent).toBe('01:42')
  })

  it('highlights timestamp ranges like 00:00-00:03', () => {
    const { container } = render(<span>{tokenizeText('00:00-00:03: montage')}</span>)
    const chips = container.querySelectorAll('.font-mono')
    expect(chips.length).toBe(1)
    expect(chips[0].textContent).toBe('00:00-00:03')
  })

  it('highlights dB values like -20dB', () => {
    const { container } = render(<span>{tokenizeText('volume at -20dB under voice')}</span>)
    expect(container.textContent).toContain('-20dB')
    const dbChips = container.querySelectorAll('[style*="fbbf24"]')
    expect(dbChips.length).toBeGreaterThanOrEqual(1)
  })

  it('highlights NÃO as negative', () => {
    const { container } = render(<span>{tokenizeText('NÃO dramático')}</span>)
    const neg = container.querySelector('[style*="f87171"]')
    expect(neg).toBeTruthy()
    expect(neg!.textContent).toBe('NÃO')
  })

  it('highlights not (case-insensitive, word boundary) as negative', () => {
    const { container } = render(<span>{tokenizeText('feel deliberate, not dramatic')}</span>)
    const neg = container.querySelector('[style*="f87171"]')
    expect(neg).toBeTruthy()
    expect(neg!.textContent).toBe('not')
  })

  it('does not highlight "not" inside other words like "nothing"', () => {
    const { container } = render(<span>{tokenizeText('nothing to worry about notation')}</span>)
    const negs = container.querySelectorAll('[style*="f87171"]')
    expect(negs.length).toBe(0)
  })

  it('handles multiple tokens in one string', () => {
    const { container } = render(<span>{tokenizeText('At 01:42 drop to -25dB, NÃO silence')}</span>)
    expect(container.querySelectorAll('.font-mono').length).toBeGreaterThanOrEqual(1)
    expect(container.querySelector('[style*="f87171"]')).toBeTruthy()
  })
})
