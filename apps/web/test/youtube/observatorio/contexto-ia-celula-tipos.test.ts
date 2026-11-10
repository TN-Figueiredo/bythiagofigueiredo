// @vitest-environment node
// A5 F0.5a (Yannis I1): o tipo `Celula` medida tem duas formas e nenhuma outra. Quem prova é o `tsc` (`@ts-expect-error` falha se a forma passar a compilar).
import { describe, it, expect } from 'vitest'
import type { Celula } from '@/lib/youtube/observatorio/contexto-ia/tipos'

describe('Celula medida: com x, ou sem x e com motivo', () => {
  it('as duas formas válidas compilam; a que falta e a que sobra não', () => {
    const comX: Celula = { papel: 'numero', estado: 'medido', texto: '1', x: 1, origem: 'a' }
    const comXNulo: Celula = { papel: 'numero', estado: 'zero_medido', texto: '0', x: null, origem: 'a' }
    const semX: Celula = { papel: 'numero', estado: 'medido', texto: 'sem variação', origem: 'a', semXMotivo: 'dentro do arredondamento' }
    // @ts-expect-error medida sem x e sem motivo
    const faltaTudo: Celula = { papel: 'numero', estado: 'medido', texto: '1', origem: 'a' }
    // @ts-expect-error x e motivo juntos
    const sobra: Celula = { papel: 'numero', estado: 'medido', texto: '1', x: 1, origem: 'a', semXMotivo: 'm' }
    // @ts-expect-error zero medido sem x também precisa do x (o motivo é só do "sem variação")
    const zeroSemX: Celula = { papel: 'numero', estado: 'zero_medido', texto: '0', origem: 'a', semXMotivo: 'm' }
    expect([comX, comXNulo, semX, faltaTudo, sobra, zeroSemX]).toHaveLength(6)
  })
})
