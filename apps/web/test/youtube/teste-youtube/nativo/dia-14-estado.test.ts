// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  versoesDoDia14, pedidoDaVersao, letraDoNoAr, letraDaResposta,
} from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/dia-14-estado'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'

const v = (n: number) => ({ n, titulo: `T${n}`, imagem: null })

type Reg = NonNullable<LinhaDoCaminho['registro']>
const reg = (o: Partial<Reg> = {}): Reg => ({
  id: 'r', updatedAt: '2026-11-01T00:00:00Z', confirmadoEm: null, primeiraVista: null, diaDe14: 15, variantes: null, variantesTitulo: null,
  campos: ['titulo'], respostaDono: null, tituloAntes: null, varianteVencedora: null, respondidoEm: null, respostaMudadaEm: null,
  vencedorFonte: null, vencedorTitulo: null, desfechoEm: null, inicio: '2026-10-20T00:00:00Z', ...o,
})
const ficha = (...ts: (string | null)[]): Reg['variantes'] =>
  ts.map((titulo, i) => ({ n: i + 1, titulo, imagem: i === 1 ? { url: 'https://x/b.png' } : null }))
const versoes = (r: Reg) => {
  const p = versoesDoDia14(r)
  if (p.tipo !== 'versoes') throw new Error('esperava versões')
  return p
}

describe('versoesDoDia14', () => {
  it('ficha com 2 versões: A é o original, B leva a imagem', () => {
    const p = versoes(reg({ variantes: ficha('Velho', 'Novo') }))
    expect(p.origem).toBe('ficha')
    expect(p.originalConhecido).toBe(true)
    expect(p.versoes).toEqual([
      { letra: 'A', n: 1, titulo: 'Velho', imagem: null, original: true },
      { letra: 'B', n: 2, titulo: 'Novo', imagem: { url: 'https://x/b.png' }, original: false },
    ])
  })
  it('ficha com 3 versões: letras A, B, C e só a A é original', () => {
    const p = versoes(reg({ variantes: ficha('a', 'b', 'c') }))
    expect(p.versoes.map((x) => [x.letra, x.n, x.original])).toEqual([['A', 1, true], ['B', 2, false], ['C', 3, false]])
  })
  it('ficha só de título (imagens nulas) e versão só de miniatura (título nulo)', () => {
    const p = versoes(reg({ variantes: ficha('a', null) }))
    expect(p.versoes[1]).toMatchObject({ letra: 'B', titulo: null, imagem: { url: 'https://x/b.png' } })
  })
  it('derivada conhecida: o título de antes vai para A, com original', () => {
    const p = versoes(reg({ variantesTitulo: ['Novo', 'Velho'], tituloAntes: ' Velho ' }))
    expect(p.origem).toBe('derivada')
    expect(p.originalConhecido).toBe(true)
    expect(p.versoes.map((x) => [x.letra, x.titulo, x.original])).toEqual([['A', 'Velho', true], ['B', 'Novo', false]])
  })
  it('derivada desconhecida (sem título de antes ou sem par): ordem vista e nenhuma original', () => {
    for (const tituloAntes of [null, 'Outro']) {
      const p = versoes(reg({ variantesTitulo: ['x', 'y', 'z'], tituloAntes }))
      expect(p.originalConhecido).toBe(false)
      expect(p.versoes.map((a) => [a.titulo, a.original])).toEqual([['x', false], ['y', false], ['z', false]])
    }
  })
  it('caixa diferente NÃO casa o título de antes (normalizarTitulo só ignora espaços)', () => {
    expect(versoes(reg({ variantesTitulo: ['Novo', 'velho'], tituloAntes: 'Velho' })).originalConhecido).toBe(false)
  })
  it('ilegível (nenhuma fonte, ou JSON de outra forma) -> sem_versoes', () => {
    expect(versoesDoDia14(reg())).toEqual({ tipo: 'sem_versoes' })
    expect(versoesDoDia14(reg({ variantesTitulo: [1, 2] as unknown as string[] }))).toEqual({ tipo: 'sem_versoes' })
    expect(versoesDoDia14(reg({ variantes: [] }))).toEqual({ tipo: 'sem_versoes' })
  })
  it('4 títulos -> sem_versoes (o banco recusa, a unidade garante)', () => {
    expect(versoesDoDia14(reg({ variantesTitulo: ['a', 'b', 'c', 'd'] }))).toEqual({ tipo: 'sem_versoes' })
    expect(versoesDoDia14(reg({ variantes: ficha('a', 'b', 'c', 'd') }))).toEqual({ tipo: 'sem_versoes' })
  })
  it('uma versão só -> sem_versoes', () => {
    expect(versoesDoDia14(reg({ variantesTitulo: ['a'] }))).toEqual({ tipo: 'sem_versoes' })
  })
  it('é pura: duas chamadas dão o mesmo resultado e não mexem na entrada', () => {
    const r = reg({ variantesTitulo: ['Novo', 'Velho'], tituloAntes: 'Velho' })
    const copia = JSON.stringify(r)
    expect(versoesDoDia14(r)).toEqual(versoesDoDia14(r))
    expect(JSON.stringify(r)).toBe(copia)
  })
})

describe('pedidoDaVersao', () => {
  it('ficha: A -> venceu_original n=1; B -> venceu_nova n=2 com o título visto', () => {
    const p = versoes(reg({ variantes: ficha('Velho', 'Novo') }))
    expect(pedidoDaVersao(p.versoes[0]!, p)).toEqual({ resposta: 'venceu_original', n: 1, tituloVisto: 'Velho' })
    expect(pedidoDaVersao(p.versoes[1]!, p)).toEqual({ resposta: 'venceu_nova', n: 2, tituloVisto: 'Novo' })
  })
  it('ficha só de miniatura: tituloVisto nulo', () => {
    const p = versoes(reg({ variantes: ficha(null, null) }))
    expect(pedidoDaVersao(p.versoes[1]!, p)).toEqual({ resposta: 'venceu_nova', n: 2, tituloVisto: null })
  })
  it('derivada conhecida: A -> venceu_original; C -> venceu_nova n=3', () => {
    const p = versoes(reg({ variantesTitulo: ['x', 'Velho', 'z'], tituloAntes: 'Velho' }))
    expect(pedidoDaVersao(p.versoes[0]!, p)).toEqual({ resposta: 'venceu_original', n: 1, tituloVisto: 'Velho' })
    expect(pedidoDaVersao(p.versoes[2]!, p)).toEqual({ resposta: 'venceu_nova', n: 3, tituloVisto: 'z' })
  })
  it('derivada desconhecida: a A também é venceu_nova por posição (nunca venceu_original)', () => {
    const p = versoes(reg({ variantesTitulo: ['x', 'y'] }))
    expect(pedidoDaVersao(p.versoes[0]!, p)).toEqual({ resposta: 'venceu_nova', n: 1, tituloVisto: 'x' })
    expect(pedidoDaVersao(p.versoes[1]!, p)).toEqual({ resposta: 'venceu_nova', n: 2, tituloVisto: 'y' })
  })
})

describe('letraDoNoAr', () => {
  const p = versoes(reg({ variantes: ficha('Velho', 'Novo') }))
  it('com par: a versão pelo título, ignorando espaços', () => {
    expect(letraDoNoAr(reg({ variantes: ficha('Velho', 'Novo'), vencedorTitulo: '  Novo ' }), p)?.letra).toBe('B')
  })
  it('sem par ou com vencedor_titulo nulo: nulo', () => {
    expect(letraDoNoAr(reg({ vencedorTitulo: 'Outro' }), p)).toBeNull()
    expect(letraDoNoAr(reg({ vencedorTitulo: null }), p)).toBeNull()
  })
  it('sem versões: nulo', () => {
    expect(letraDoNoAr(reg({ vencedorTitulo: 'Novo' }), { tipo: 'sem_versoes' })).toBeNull()
  })
})

describe('letraDaResposta', () => {
  it('ficha: a letra sai de variante_vencedora', () => {
    const r = reg({ variantes: ficha('Velho', 'Novo'), respostaDono: 'venceu_nova', varianteVencedora: 2 })
    expect(letraDaResposta(r, versoes(r))?.letra).toBe('B')
  })
  it('venceu_original: sempre a versão 1', () => {
    const r = reg({ variantes: ficha('Velho', 'Novo'), respostaDono: 'venceu_original', varianteVencedora: 1 })
    expect(letraDaResposta(r, versoes(r))?.letra).toBe('A')
  })
  it('derivada respondida com variante_vencedora que não bate com a numeração nova: a letra sai do vencedor_titulo', () => {
    // respondeu "B" (n=2, 'Novo') numa numeração sem original; agora o título de antes ('Velho') virou A e 'Novo' é C
    const r = reg({
      variantesTitulo: ['Novo', 'Outro', 'Velho'], tituloAntes: 'Velho', respostaDono: 'venceu_nova', varianteVencedora: 1,
      vencedorFonte: 'dono', vencedorTitulo: 'Novo',
    })
    const p = versoes(r)
    expect(p.versoes.map((x) => x.titulo)).toEqual(['Velho', 'Novo', 'Outro'])
    expect(letraDaResposta(r, p)?.letra).toBe('B')
    expect(r.varianteVencedora).toBe(1) // o n gravado apontaria a A
  })
  it('derivada sem par no vencedor_titulo: nulo (o título sem letra é da tela)', () => {
    const r = reg({ variantesTitulo: ['a', 'b'], respostaDono: 'venceu_nova', varianteVencedora: 2, vencedorFonte: 'dono', vencedorTitulo: 'Sumiu' })
    expect(letraDaResposta(r, versoes(r))).toBeNull()
  })
  it('sem vencedor (ficou_igual) ou sem resposta: nulo', () => {
    const r = reg({ variantes: ficha('a', 'b'), respostaDono: 'ficou_igual' })
    expect(letraDaResposta(r, versoes(r))).toBeNull()
    const s = reg({ variantes: ficha('a', 'b') })
    expect(letraDaResposta(s, versoes(s))).toBeNull()
  })
  it('sem versões: nulo', () => {
    expect(letraDaResposta(reg({ respostaDono: 'venceu_nova', varianteVencedora: 2 }), { tipo: 'sem_versoes' })).toBeNull()
  })
})
