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

// Qualquer forma de importar (com ou sem `from`, em várias linhas): o arquivo inteiro é testado, não linha a linha.
const PROIBIDO = /(?:from|import)\s*['"](?:@sentry\/nextjs|@\/lib\/notifications[^'"]*|(?:\.\/|@\/lib\/youtube\/teste-youtube\/nativo\/)(?:ficha|resposta)|@\/lib\/youtube\/observatorio\/[^'"]*)['"]/

describe('arquitetura: o bundle do cliente não arrasta código de servidor', () => {
  it.each([
    "import {\n x,\n} from '@sentry/nextjs'",
    "import { y } from '@/lib/youtube/teste-youtube/nativo/ficha'",
    "import '@sentry/nextjs'",
    "export { z } from './ficha'",
    "import { t } from '@/lib/youtube/observatorio/proprio-versoes/ler'",
  ])('a regra pega o mutante %j', (txt) => {
    expect(txt).toMatch(PROIBIDO)
  })
  it('a regra deixa passar import legítimo', () => {
    expect(["import { z } from 'zod'", "import type { X } from './ficha'", "import { a } from './ficha-schema'"].join('\n').replace(/import type[^\n]*/g, '')).not.toMatch(PROIBIDO)
  })
  it.each(['versoes.ts', 'ficha-schema.ts', 'ficha-url.ts', 'titulo.ts'])('%s não importa Sentry, notifications, ./ficha nem leitor de servidor', (arq) => {
    const dir = resolve(__dirname, '../../../../src/lib/youtube/teste-youtube/nativo')
    const src = readFileSync(resolve(dir, arq), 'utf8').replace(/\/\/[^\n]*/g, '')
    expect(src).not.toMatch(PROIBIDO)
  })
})
