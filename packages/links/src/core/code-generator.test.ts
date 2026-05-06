import { describe, it, expect, vi } from 'vitest'
import { CodeGenerator, SAFE_ALPHABET } from './code-generator.js'

describe('CodeGenerator', () => {
  it('generates a code of default length 6', async () => {
    const gen = new CodeGenerator()
    const code = await gen.generate(async () => true) // always available
    expect(code).toHaveLength(6)
  })

  it('generates a code of custom length', async () => {
    const gen = new CodeGenerator(8)
    const code = await gen.generate(async () => true)
    expect(code).toHaveLength(8)
  })

  it('only contains characters from the safe 56-char alphabet', async () => {
    const gen = new CodeGenerator()
    for (let i = 0; i < 50; i++) {
      const code = await gen.generate(async () => true)
      for (const ch of code) {
        expect(SAFE_ALPHABET).toContain(ch)
      }
    }
  })

  it('does not contain confusable characters (0, O, l, 1, I)', async () => {
    const gen = new CodeGenerator()
    const confusables = ['0', 'O', 'l', '1', 'I']
    for (let i = 0; i < 50; i++) {
      const code = await gen.generate(async () => true)
      for (const ch of confusables) {
        expect(code).not.toContain(ch)
      }
    }
  })

  it('retries on collision and succeeds within max retries', async () => {
    const gen = new CodeGenerator()
    let attempt = 0
    const isAvailable = vi.fn(async () => {
      attempt++
      return attempt >= 3 // first two collide, third succeeds
    })
    const code = await gen.generate(isAvailable)
    expect(code).toHaveLength(6)
    expect(isAvailable).toHaveBeenCalledTimes(3)
  })

  it('throws after max retries on persistent collision', async () => {
    const gen = new CodeGenerator(6, 3)
    const isAvailable = vi.fn(async () => false) // always collides
    await expect(gen.generate(isAvailable)).rejects.toThrow(/max retries/i)
    expect(isAvailable).toHaveBeenCalledTimes(3)
  })

  it('SAFE_ALPHABET has exactly 54 characters (62 minus 0,O,l,1,I,i,o,L)', () => {
    expect(SAFE_ALPHABET).toHaveLength(54)
  })

  it('accepts a custom code without checking availability when valid', () => {
    const gen = new CodeGenerator()
    expect(gen.isValidCode('abc123')).toBe(false) // '1' is confusable
    expect(gen.isValidCode('abcdef')).toBe(true)
    expect(gen.isValidCode('Ab3Xz9')).toBe(true)
  })
})
