import { describe, it, expect } from 'vitest'
import { compileMdx } from '../../src/mdx/compiler'

describe('compileMdx', () => {
  it('compiles simple markdown', async () => {
    const result = await compileMdx('# Hello\n\nWorld', {})
    expect(result.compiledSource).toContain('Hello')
    expect(result.toc).toEqual([{ depth: 1, text: 'Hello', slug: 'hello' }])
    expect(result.readingTimeMin).toBe(1)
  })

  it('compiles MDX with registered components', async () => {
    const result = await compileMdx('<Callout>test</Callout>', {
      Callout: () => null,
    })
    expect(result.compiledSource).toBeTruthy()
  })

  it('throws on invalid MDX syntax', async () => {
    await expect(compileMdx('<UnclosedTag', {})).rejects.toThrow()
  })
})
