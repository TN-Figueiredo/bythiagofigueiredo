// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { boundedArray, boundedRecord, limitedZodMessage } from './bounded-array'

describe('boundedArray', () => {
  const schema = boundedArray(z.string().min(1), 8)

  it('aceita array válido dentro do teto', () => {
    expect(schema.safeParse(['a', 'b']).success).toBe(true)
  })

  it('um elemento inválido dentro do teto gera 1 issue', () => {
    const r = schema.safeParse(['a', ''])
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues).toHaveLength(1)
  })

  it('rejeita não-array', () => {
    expect(schema.safeParse('x').success).toBe(false)
  })

  it('array de 1.000.000 itens inválidos gera 1 issue, rápido', () => {
    const big = new Array<string>(1_000_000).fill('')
    const t = performance.now()
    const r = schema.safeParse(big)
    expect(performance.now() - t).toBeLessThan(200)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues).toHaveLength(1)
  })

  it('o teto vale também para elementos válidos', () => {
    expect(schema.safeParse(new Array<string>(9).fill('a')).success).toBe(false)
  })
})

describe('boundedRecord', () => {
  const schema = boundedRecord(z.enum(['a', 'b']), z.boolean(), 2)
  it('aceita dentro do teto e rejeita acima', () => {
    expect(schema.safeParse({ a: true }).success).toBe(true)
    const many: Record<string, boolean> = {}
    for (let i = 0; i < 100_000; i++) many[`k${i}`] = true
    const r = schema.safeParse(many)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues).toHaveLength(1)
  })
})

describe('limitedZodMessage', () => {
  it('devolve no máximo 5 mensagens', () => {
    const r = z.array(z.string()).safeParse(new Array(1000).fill(1))
    expect(r.success).toBe(false)
    if (!r.success) {
      const msg = limitedZodMessage(r.error)
      expect(msg).toBe(r.error.issues.slice(0, 5).map((i) => i.message).join(', '))
      expect(msg.length).toBeLessThan(r.error.issues.map((i) => i.message).join(', ').length)
    }
  })
  it('usa fallback quando não há mensagens', () => {
    expect(limitedZodMessage(new z.ZodError([]))).toBe('Validation failed')
  })
})
