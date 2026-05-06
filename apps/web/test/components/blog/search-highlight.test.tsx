import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

import { highlightText } from '../../../src/app/(public)/blog/search-highlight'

describe('highlightText', () => {
  it('returns plain text when query is empty', () => {
    const result = highlightText('Hello World', '')
    expect(result).toBe('Hello World')
  })

  it('returns text as-is when text is empty', () => {
    const result = highlightText('', 'query')
    expect(result).toBe('')
  })

  it('highlights an exact match (case-insensitive)', () => {
    const result = highlightText('Hello World', 'hello')
    const { container } = render(<>{result}</>)
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('Hello')
    expect(marks[0].style.background).toBe('#FFE37A')
  })

  it('handles special regex characters in query', () => {
    const text = 'value (x) and [y] are $100'
    const result = highlightText(text, '(x)')
    const { container } = render(<>{result}</>)
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('(x)')
  })

  it('handles brackets in query', () => {
    const text = 'array[0] is first'
    const result = highlightText(text, '[0]')
    const { container } = render(<>{result}</>)
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('[0]')
  })

  it('handles dollar sign and caret in query', () => {
    const text = 'price is $50 total'
    const result = highlightText(text, '$50')
    const { container } = render(<>{result}</>)
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('$50')
  })

  it('returns original text when no match found', () => {
    const result = highlightText('Hello World', 'xyz')
    expect(result).toBe('Hello World')
  })

  it('handles multiple occurrences', () => {
    const text = 'the cat and the dog and the bird'
    const result = highlightText(text, 'the')
    const { container } = render(<>{result}</>)
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(3)
    for (const mark of marks) {
      expect(mark.textContent).toBe('the')
    }
  })

  it('handles query longer than text', () => {
    const result = highlightText('Hi', 'Hello World')
    expect(result).toBe('Hi')
  })

  it('preserves surrounding text around highlights', () => {
    const text = 'start hello end'
    const result = highlightText(text, 'hello')
    const { container } = render(<>{result}</>)
    expect(container.textContent).toBe('start hello end')
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('hello')
  })
})
