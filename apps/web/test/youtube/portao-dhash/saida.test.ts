// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { PassThrough } from 'node:stream'
import { protegerSaida, sinalRepetido } from '@/lib/youtube/portao-dhash/saida'

describe('protegerSaida', () => {
  it('um erro de escrita (EIO) no stream não lança', () => {
    const a = new PassThrough(), b = new PassThrough()
    protegerSaida([a, b])
    expect(() => { a.emit('error', new Error('write EIO')); b.emit('error', new Error('write EIO')) }).not.toThrow()
  })
  it('sem a proteção o mesmo erro lança (o teste enxerga a diferença)', () => {
    expect(() => new PassThrough().emit('error', new Error('write EIO'))).toThrow()
  })
})

describe('sinalRepetido', () => {
  it('menos de 1 s depois do primeiro é o mesmo Ctrl-C; depois disso é um novo', () => {
    expect(sinalRepetido(null, 5_000)).toBe(false)
    expect(sinalRepetido(5_000, 5_030)).toBe(true)
    expect(sinalRepetido(5_000, 6_500)).toBe(false)
  })
})
