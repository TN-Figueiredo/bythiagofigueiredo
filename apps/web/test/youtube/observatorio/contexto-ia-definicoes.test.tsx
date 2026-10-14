// @vitest-environment jsdom
/** E17 degrau 1, Tarefa 5b (Comparar): o texto do ⓘ "Como ler esta tabela" sai de `_comparar/definicoes.ts`; o que a tela pinta não mudou. */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { canalDe, pacoteDe, type OpcoesCanal } from './par-helpers'
import { NUMEROS } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { CompararScreen } from '@/app/cms/(authed)/youtube/competitors/_comparar/comparar-screen'
import { definicoesDaTabela } from '@/app/cms/(authed)/youtube/competitors/_comparar/definicoes'
import type { Conjunto } from '@/lib/youtube/observatorio/posicao'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => { throw new Error('a tela não usa o router') } }))

const ALL = (v: number): OpcoesCanal['n'] => Object.fromEntries(NUMEROS.map(k => [k, v])) as OpcoesCanal['n']
const mk = (id: string, subs: number | null, o: OpcoesCanal = {}) => canalDe(id, { subs, ...o })

// O texto de antes da extração, capturado do componente (lista <ul> do ⓘ) com o código antigo, nos três ramos.
const ANTES_NICHOCOMFORA = `<ul><li><b>Os lados:</b> laranja é o seu canal, azul é o outro; quando nenhum dos dois é seu, o lado A é areia. Cada lado também tem a sua letra, A ou B, para não depender da cor.</li><li><b>Régua:</b> um traço por canal de Viagem, do menor ao maior; os dois traços destacados e com letra são os lados A e B. A posição escrita ao lado de cada valor é a do mesmo número (1º = o maior). Escala comprimida em inscritos, para o maior canal não apagar os pequenos; as demais, em escala linear. Lado sem dado não ganha traço, e a linha diz de quem falta.</li><li><b>Barras finas:</b> nos números que só existem para os dois canais, uma barra por lado, no mesmo eixo, proporcional ao maior dos dois. Se a menor passa a ser menos de 3% da maior, ela ganha 3 px e a linha avisa.</li><li><b>Relação:</b> a partir de 2× a frase usa “×”; abaixo, percentual. Diferença menor que 10% é “praticamente igual”. ▲ marca o lado maior, ＝ os praticamente iguais. Sem relação quando um lado não foi medido.</li><li><b>Dias desde o último vídeo:</b> sem barra nem régua (menor é mais recente, e a barra cheia leria como vantagem).</li><li><b>Não medido</b> (hachura): o dado não existe para esse lado; não é zero.</li><li><b>Ficaram de fora</b> porque nenhum dos dois tem o dado: trocas de título e thumbnail em 30 dias.</li></ul>`
const ANTES_NICHOSEMFORA = `<ul><li><b>Os lados:</b> laranja é o seu canal, azul é o outro; quando nenhum dos dois é seu, o lado A é areia. Cada lado também tem a sua letra, A ou B, para não depender da cor.</li><li><b>Régua:</b> um traço por canal de Viagem, do menor ao maior; os dois traços destacados e com letra são os lados A e B. A posição escrita ao lado de cada valor é a do mesmo número (1º = o maior). Escala linear em todas as réguas. Lado sem dado não ganha traço, e a linha diz de quem falta.</li><li><b>Barras finas:</b> nos números que só existem para os dois canais, uma barra por lado, no mesmo eixo, proporcional ao maior dos dois. Se a menor passa a ser menos de 3% da maior, ela ganha 3 px e a linha avisa.</li><li><b>Relação:</b> a partir de 2× a frase usa “×”; abaixo, percentual. Diferença menor que 10% é “praticamente igual”. ▲ marca o lado maior, ＝ os praticamente iguais. Sem relação quando um lado não foi medido.</li><li><b>Dias desde o último vídeo:</b> sem barra nem régua (menor é mais recente, e a barra cheia leria como vantagem).</li><li><b>Não medido</b> (hachura): o dado não existe para esse lado; não é zero.</li></ul>`
const ANTES_GERAL = `<ul><li><b>Os lados:</b> laranja é o seu canal, azul é o outro; quando nenhum dos dois é seu, o lado A é areia. Cada lado também tem a sua letra, A ou B, para não depender da cor.</li><li><b>Régua:</b> um traço por canal do site, do menor ao maior; os dois traços destacados e com letra são os lados A e B. A posição escrita ao lado de cada valor é a do mesmo número (1º = o maior). Escala linear em todas as réguas. Lado sem dado não ganha traço, e a linha diz de quem falta.</li><li><b>Barras finas:</b> nos números que só existem para os dois canais, uma barra por lado, no mesmo eixo, proporcional ao maior dos dois. Se a menor passa a ser menos de 3% da maior, ela ganha 3 px e a linha avisa.</li><li><b>Relação:</b> a partir de 2× a frase usa “×”; abaixo, percentual. Diferença menor que 10% é “praticamente igual”. ▲ marca o lado maior, ＝ os praticamente iguais. Sem relação quando um lado não foi medido.</li><li><b>Dias desde o último vídeo:</b> sem barra nem régua (menor é mais recente, e a barra cheia leria como vantagem).</li><li><b>Não medido</b> (hachura): o dado não existe para esse lado; não é zero.</li></ul>`

function abreODica(p: ReturnType<typeof pacoteDe>, a: string, b: string): string {
  window.history.replaceState(null, '', `/cms/youtube/competitors/comparar?a=${a}&b=${b}`)
  render(<div data-obs=""><CompararScreen pack={p} inicial={{ a, b }} /></div>)
  fireEvent.click(screen.getByRole('button', { name: 'Como ler esta tabela' }))
  return document.getElementById('flut')!.querySelector('ul')!.outerHTML
}
const pNichoComFora = () => {
  const p = pacoteDe([100, 110, 120, 130, 140].map((s, i) => mk(`${'abcde'[i]}1`, s, { n: { ...ALL(1), inscritos: s } })).concat(mk('f1', 5_000_000, { n: { ...ALL(1), inscritos: 5_000_000 } })))
  for (const c of p.canais) c.numeros.trocas30 = { x: null, texto: null, motivo: 'sem dado', nota: null }
  return p
}
const pNichoSemFora = () => pacoteDe([mk('a1', 100, { n: { ...ALL(1), inscritos: 100 } }), mk('b1', 110, { n: { ...ALL(1), inscritos: 110 } })])
const pGeral = () => pacoteDe([mk('a1', 100, { n: { ...ALL(1), inscritos: 100 } }), mk('g1', 110, { niche: 'ia', nicheLabel: 'IA', n: { ...ALL(1), inscritos: 110 } })])

beforeEach(() => { window.history.replaceState(null, '', '/cms/youtube/competitors/comparar?a=eu&b=c1') })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.resetModules(); vi.doUnmock('@/app/cms/(authed)/youtube/competitors/_comparar/par-model'); document.getElementById('flut')?.remove() })

describe('Comparar: definições do ⓘ fora do JSX', () => {
  it('o texto pintado do ⓘ de Comparar é o mesmo de antes da extração (innerHTML, três ramos)', () => {
    expect(abreODica(pNichoComFora(), 'a1', 'f1')).toBe(ANTES_NICHOCOMFORA)
    cleanup(); document.getElementById('flut')?.remove()
    expect(abreODica(pNichoSemFora(), 'a1', 'b1')).toBe(ANTES_NICHOSEMFORA)
    cleanup(); document.getElementById('flut')?.remove()
    expect(abreODica(pGeral(), 'a1', 'g1')).toBe(ANTES_GERAL)
  })

  it('o "10%" sai de LIMITE_IGUAL (com a constante simulada em 1,2 o texto diz 20%)', async () => {
    const normal = definicoesDaTabela({ conjunto: { tipo: 'geral' }, fora: [], comprimidas: [] }).map(i => i.frase).join(' ')
    expect(normal).toContain('Diferença menor que 10% é “praticamente igual”')
    vi.resetModules()
    vi.doMock('@/app/cms/(authed)/youtube/competitors/_comparar/par-model', async (orig) => ({ ...(await orig<Record<string, unknown>>()), LIMITE_IGUAL: 1.2 }))
    const { definicoesDaTabela: simulada } = await import('@/app/cms/(authed)/youtube/competitors/_comparar/definicoes')
    const texto = simulada({ conjunto: { tipo: 'geral' }, fora: [], comprimidas: [] }).map(i => i.frase).join(' ')
    expect(texto).toContain('Diferença menor que 20% é “praticamente igual”')
    expect(texto).not.toContain('10%')
  })

  it('definicoes.ts não tem \'use client\' nem importa react', () => {
    const fonte = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_comparar/definicoes.ts'), 'utf8')
    expect(fonte).not.toMatch(/^\s*['"]use client['"]/m)
    expect(fonte).not.toMatch(/^import .*from ['"]react['"]/m)
  })

  it('par sem "fora" e sem escalas comprimidas: a lista não tem item vazio nem o item "Ficaram de fora"', () => {
    const conjunto: Conjunto = { tipo: 'geral' }
    const itens = definicoesDaTabela({ conjunto, fora: [], comprimidas: [] })
    expect(itens.map(i => i.termo)).toEqual(['Os lados:', 'Régua:', 'Barras finas:', 'Relação:', 'Dias desde o último vídeo:', 'Não medido'])
    for (const i of itens) { expect(i.termo.length).toBeGreaterThan(0); expect(i.frase.length).toBeGreaterThan(0) }
    expect(itens.find(i => i.termo === 'Régua:')!.frase).toContain('Escala linear em todas as réguas.')
    const com = definicoesDaTabela({ conjunto, fora: ['Trocas em 30 dias'], comprimidas: ['Inscritos'] })
    expect(com.map(i => i.termo).at(-1)).toBe('Ficaram de fora')
    expect(com.at(-1)!.frase).toBe('porque nenhum dos dois tem o dado: trocas em 30 dias.')
    expect(com.find(i => i.termo === 'Régua:')!.frase).toContain('Escala comprimida em inscritos, para o maior canal não apagar os pequenos; as demais, em escala linear.')
  })

  it('os separadores dos dois itens especiais: "Não medido" leva " (hachura): " e "Ficaram de fora" leva um espaço', () => {
    const itens = definicoesDaTabela({ conjunto: { tipo: 'geral' }, fora: ['A'], comprimidas: [] })
    expect(itens.find(i => i.termo === 'Não medido')!.depois).toBe(' (hachura): ')
    expect(itens.find(i => i.termo === 'Ficaram de fora')!.depois).toBe(' ')
    expect(itens.find(i => i.termo === 'Os lados:')!.depois).toBe(' ')
  })
})
