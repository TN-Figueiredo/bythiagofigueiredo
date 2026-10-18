// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { normalizarTitulo, compararCodePoint } from '@/lib/youtube/teste-youtube/normalizar-titulo'

describe('normalizarTitulo', () => {
  it('texto comum fica igual', () => {
    expect(normalizarTitulo('Consistência e Compromisso (Part 4)')).toBe('Consistência e Compromisso (Part 4)')
  })
  it('NFC: composto e decomposto viram o mesmo', () => {
    expect(normalizarTitulo('Consistência')).toBe('Consistência')
  })
  it('espaços: duplo, NBSP, NNBSP e tab viram um espaço; trim', () => {
    expect(normalizarTitulo('a  b')).toBe('a b')
    expect(normalizarTitulo('a b')).toBe('a b')
    expect(normalizarTitulo('a b')).toBe('a b')
    expect(normalizarTitulo('a\tb')).toBe('a b')
    expect(normalizarTitulo('  x  ')).toBe('x')
  })
  it('seletores de variação e invisíveis saem', () => {
    expect(normalizarTitulo('\u{1F525}︎ x')).toBe(normalizarTitulo('\u{1F525} x'))
    expect(normalizarTitulo('a​b')).toBe('ab')
    expect(normalizarTitulo('a﻿b')).toBe('ab')
    expect(normalizarTitulo('a⁠b')).toBe('ab')
  })
  it('ZWJ é preservado (família)', () => {
    const familia = '\u{1F468}‍\u{1F469}‍\u{1F467}'
    expect(normalizarTitulo(familia)).toBe(familia)
  })
  it('caixa e entidade não são tocadas', () => {
    expect(normalizarTitulo('PART 4')).not.toBe(normalizarTitulo('Part 4'))
    expect(normalizarTitulo('&amp;')).toBe('&amp;')
  })
})

describe('compararCodePoint', () => {
  it('ordena por code point, não por UTF-16', () => {
    expect(compararCodePoint('\u{1F600}', '￿')).toBeGreaterThan(0)
    expect('\u{1F600}' < '￿').toBe(true)
  })
  it('igual, menor, maior', () => {
    expect(compararCodePoint('a', 'a')).toBe(0)
    expect(compararCodePoint('a', 'b')).toBeLessThan(0)
    expect(compararCodePoint('b', 'a')).toBeGreaterThan(0)
    expect(compararCodePoint('a', 'ab')).toBeLessThan(0)
  })
})
