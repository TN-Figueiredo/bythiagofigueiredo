// @vitest-environment node
// S8-F4 consertos (Phil D1 / Yannis D3): uma única regra de teto para decisão, rede, projeção e aviso.
import { describe, it, expect } from 'vitest'
import { tetoDoTesteV2 } from '@/lib/youtube/ab-gravacao/decisao-v2'

describe('tetoDoTesteV2', () => {
  it('sem max_duration_days (delete): padrão 15 com V=2 e 17 com V=3', () => {
    expect(tetoDoTesteV2({}, 2)).toBe(15)
    expect(tetoDoTesteV2({}, 3)).toBe(17)
    expect(tetoDoTesteV2(null, 3)).toBe(17)
    expect(tetoDoTesteV2(undefined, 2)).toBe(15)
  })
  it('max_duration_days positivo vale; inválido cai no padrão', () => {
    expect(tetoDoTesteV2({ max_duration_days: 21 }, 3)).toBe(21)
    expect(tetoDoTesteV2({ max_duration_days: 0 }, 2)).toBe(15)
    expect(tetoDoTesteV2({ max_duration_days: '14' }, 2)).toBe(15)
  })
  it('soExplicito: o max_duration_days do rascunho só vale com teto_explicito', () => {
    expect(tetoDoTesteV2({ max_duration_days: 14 }, 3, { soExplicito: true })).toBe(17)
    expect(tetoDoTesteV2({ max_duration_days: 30, teto_explicito: true }, 3, { soExplicito: true })).toBe(30)
  })
  it('D4: teto_explicito false (rascunho v2) usa o padrão; config legada sem a chave segue valendo', () => {
    expect(tetoDoTesteV2({ max_duration_days: 14, teto_explicito: false }, 2)).toBe(15)
    expect(tetoDoTesteV2({ max_duration_days: 14 }, 2)).toBe(14)
    expect(tetoDoTesteV2({ max_duration_days: 14, teto_explicito: true }, 2)).toBe(14)
  })
  it('V fora de 2..3 é limitado ao intervalo', () => {
    expect(tetoDoTesteV2({}, 1)).toBe(15)
    expect(tetoDoTesteV2({}, 7)).toBe(17)
  })
})
