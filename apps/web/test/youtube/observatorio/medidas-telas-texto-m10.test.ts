// @vitest-environment node
// apps/web/test/youtube/observatorio/medidas-telas-texto-m10.test.ts
import { describe, it, expect } from 'vitest'
import { TEXTO_M10 } from '@/lib/youtube/observatorio/medidas-telas/texto-m10'
import { TEXTO_OBRIGATORIO_M10 } from '@/lib/youtube/observatorio/medidas/pico'

describe('texto de M10 (E5a T1)', () => {
  it('as três frases, na ordem, com o título, são o texto obrigatório da E4 letra por letra', () => {
    expect([TEXTO_M10.titulo, TEXTO_M10.oQueVimos, TEXTO_M10.hipoteseNossa, TEXTO_M10.oQueNinguemDeForaVe].join(' ')).toBe(TEXTO_OBRIGATORIO_M10)
  })
  it('o título é "Indício, não medição." e nenhuma parte é vazia', () => {
    expect(TEXTO_M10.titulo).toBe('Indício, não medição.')
    for (const p of Object.values(TEXTO_M10)) expect(p.length).toBeGreaterThan(10)
  })
})
