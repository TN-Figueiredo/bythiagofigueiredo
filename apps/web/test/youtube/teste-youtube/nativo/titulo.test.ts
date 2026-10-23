import { describe, it, expect } from 'vitest'
import { contarCaracteresDoTitulo } from '@/lib/youtube/teste-youtube/nativo/titulo'
import { FichaRascunhoSchema, VarianteFichaSchema } from '@/lib/youtube/teste-youtube/nativo/ficha'

const FAMILIA = '👨‍👩‍👧‍👦' // 7 code points, 1 grafema
const base = { n: 2, tipo: 'titulo' as const }

describe('contarCaracteresDoTitulo', () => {
  it('conta grafemas, não unidades UTF-16', () => {
    expect(contarCaracteresDoTitulo('abc')).toBe(3)
    expect(contarCaracteresDoTitulo('🎬')).toBe(1)
    expect(contarCaracteresDoTitulo(FAMILIA)).toBe(1)
    expect(contarCaracteresDoTitulo('')).toBe(0)
  })
  it('100 grafemas com 4 emojis gravam; 101 recusa (mesma função nos dois lados)', () => {
    const emojis = FAMILIA.repeat(2) + '🎬🎬'
    const t100 = emojis + 'x'.repeat(96)
    const t101 = t100 + 'x'
    expect(contarCaracteresDoTitulo(t100)).toBe(100)
    expect(t100.length).toBeGreaterThan(100) // o .max(100) por UTF-16 recusaria
    expect(contarCaracteresDoTitulo(t101)).toBe(101)
    expect(VarianteFichaSchema.safeParse({ ...base, titulo: t100 }).success).toBe(true)
    expect(VarianteFichaSchema.safeParse({ ...base, titulo: t101 }).success).toBe(false)
  })
  it('título vazio da B: sem a chave `titulo` grava; string vazia é recusada (o cliente omite a chave)', () => {
    const sem = FichaRascunhoSchema.safeParse({ campos: ['titulo'], variantes: [{ n: 2, tipo: 'titulo' }] })
    expect(sem.success).toBe(true)
    if (sem.success) expect('titulo' in sem.data.variantes[0]!).toBe(false)
    expect(VarianteFichaSchema.safeParse({ ...base, titulo: '' }).success).toBe(false)
  })
  it('título hostil (aspas, <script>) é só texto', () => {
    expect(VarianteFichaSchema.safeParse({ ...base, titulo: `"<script>alert(1)</script>"` }).success).toBe(true)
  })
})
