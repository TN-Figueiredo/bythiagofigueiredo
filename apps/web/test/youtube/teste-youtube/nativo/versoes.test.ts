// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { derivadasDeVariantesTitulo, patchDaResposta, variantesDaResposta } from '@/lib/youtube/teste-youtube/nativo/versoes'

const deriv = (variantes_titulo: unknown, titulo_antes: string | null) => variantesDaResposta({ variantes: null, variantes_titulo, titulo_antes })!

describe('derivadasDeVariantesTitulo', () => {
  it("['B','A'] com tituloAntes 'A': o par vai para n=1 e o original é conhecido", () => {
    const d = derivadasDeVariantesTitulo(['B', 'A'], 'A')!
    expect(d.originalConhecido).toBe(true)
    expect(d.itens.map((x) => [x.n, x.titulo])).toEqual([[1, 'A'], [2, 'B']])
  })
  it('espaços diferentes casam (normalizarTitulo)', () => {
    const d = derivadasDeVariantesTitulo(['B', 'Olá  mundo'], '  Olá mundo ')!
    expect(d.originalConhecido).toBe(true)
    expect(d.itens[0]!.titulo).toBe('Olá  mundo')
  })
  it('tituloAntes nulo ou sem par: ordem vista e originalConhecido false', () => {
    for (const antes of [null, 'Z']) {
      const d = derivadasDeVariantesTitulo(['B', 'A'], antes)!
      expect(d.originalConhecido).toBe(false)
      expect(d.itens.map((x) => x.titulo)).toEqual(['B', 'A'])
    }
  })
  it('mais de 3 títulos, vazio e lixo: null', () => {
    expect(derivadasDeVariantesTitulo(['a', 'b', 'c', 'd'], 'a')).toBeNull()
    expect(derivadasDeVariantesTitulo([], null)).toBeNull()
    expect(derivadasDeVariantesTitulo(null, null)).toBeNull()
  })
  it('Studio aplicou o vencedor: a coluna titulo_oficial (hoje B) é ignorada, A segue original', () => {
    // `variantesDaResposta` não aceita titulo_oficial; só o título vigente em primeira_vista decide.
    const v = variantesDaResposta({ variantes: null, variantes_titulo: ['A', 'B'], titulo_antes: 'A', ...{ titulo_oficial: 'B' } })!
    expect(v.itens[0]!.titulo).toBe('A')
    expect(v.originalConhecido).toBe(true)
  })
})

describe('patchDaResposta com derivada', () => {
  it('venceu_original com original conhecido: variante 1 e o título de antes', () => {
    expect(patchDaResposta('venceu_original', null, deriv(['B', 'A'], 'A'))).toMatchObject({
      sempre: { resposta_dono: 'venceu_original', variante_vencedora: 1 }, seEmAndamento: { vencedor_titulo: 'A', vencedor_fonte: 'dono' },
    })
  })
  it('venceu_original sem original conhecido: variante_invalida', () => {
    expect(patchDaResposta('venceu_original', null, deriv(['B', 'A'], null))).toEqual({ erro: 'variante_invalida' })
  })
  it('venceu_nova n=1: recusado com original conhecido, grava por posição sem ele', () => {
    expect(patchDaResposta('venceu_nova', 1, deriv(['B', 'A'], 'A'))).toEqual({ erro: 'variante_invalida' })
    expect(patchDaResposta('venceu_nova', 1, deriv(['B', 'A'], null))).toMatchObject({ sempre: { variante_vencedora: 1 }, seEmAndamento: { vencedor_titulo: 'B' } })
    expect(patchDaResposta('venceu_nova', 2, deriv(['B', 'A'], 'A'))).toMatchObject({ seEmAndamento: { vencedor_titulo: 'B' } })
  })
  it('ficha: sempre originalConhecido', () => {
    expect(variantesDaResposta({ variantes: [{ n: 1, tipo: 'titulo', titulo: 'X' }, { n: 2, tipo: 'titulo', titulo: 'Y' }], variantes_titulo: null, titulo_antes: null }))
      .toMatchObject({ origem: 'ficha', originalConhecido: true })
  })
})

describe('arquitetura: o bundle do cliente não arrasta código de servidor', () => {
  it.each(['versoes.ts', 'ficha-schema.ts'])('%s não importa Sentry, notifications nem ./ficha', (arq) => {
    const src = readFileSync(resolve(__dirname, '../../../../src/lib/youtube/teste-youtube/nativo', arq), 'utf8')
    const imports = src.split('\n').filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l)).join('\n')
    expect(imports).not.toMatch(/@sentry\/nextjs|@\/lib\/notifications|from '\.\/ficha'/)
  })
})
