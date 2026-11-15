// @vitest-environment node
/**
 * acessoir-16: a pizza da direção diz quantos canais foram medidos e pinta "direção não medida" à parte.
 * Empacotador e gerador de CSV REAIS; o modelo vem da fixture, com as quatro casas e o resumo trocados por números do caso.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { a3World } from './a3-fixture'
import { medidasDoOraculo } from './canais-e5a-fixture'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { buildRiView } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-model'
import { empacotarCanais, modeloDeCanais } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canais'
import { blocoDaTabela, csvDaTabela, novaLegenda } from '@/lib/youtube/observatorio/contexto-ia/tabela-csv'

type Casas = { sobe: number | null; estavel: number | null; desce: number | null; naoMedido: number | null; falhou?: number; data?: string | null }

function bloco(c: Casas) {
  const { obs } = a3World()
  const view = buildCanaisView(obs, { niche: 'todos', limit: 200, fmt: 'longos', medidas: medidasDoOraculo(obs) }, undefined)
  const ri = buildRiView(obs, { agoraMs: obs.NOW, niche: 'todos', fmt: 'long', meuCanalLembrado: null, retratosProprios: new Map() }).view
  const modelo = modeloDeCanais(view, ri)
  const n = [c.sobe, c.estavel, c.desce, c.naoMedido]
  modelo.resumo.casas = modelo.resumo.casas.map((x, i) => ({ ...x, n: n[i] ?? null, data: i === 3 ? (c.data === undefined ? 'fecha em 16/11' : c.data) : null }))
  modelo.resumo.direcao = { ...modelo.resumo.direcao, naoCarregou: c.falhou ?? 0 }
  const t = empacotarCanais(modelo, { acessoPorCanal: {}, negativa: null }).tabelas.find((x) => x.id === 'canais-resumo-direcao')!
  const csv = csvDaTabela(t, novaLegenda())!
  return { t, csv, texto: blocoDaTabela(csv, csv.linhas) }
}

describe('pizza da direção (acessoir-16)', () => {
  it('caso real 4 de 34: título com X de Y, frase própria, rótulo e nota na linha, sem "toda parte foi medida"', () => {
    const { t, csv, texto } = bloco({ sobe: 2, estavel: 1, desce: 1, naoMedido: 30 })
    expect(t.titulo).toBe('Direção dos canais em 28 dias: medida em 4 de 34, sem o seu canal')
    expect(texto).not.toContain('toda parte foi medida')
    expect(csv.grafico).toBe('pizza')
    expect(texto).toContain('Gráfico sugerido: pizza em fundo branco')
    expect(texto).toContain('título do gráfico = título desta tabela')
    expect(texto).toContain('Dos 34 canais, 4 têm direção medida: 2 subindo, 1 sem mudança, 1 descendo. Os outros 30 ainda não têm leitura suficiente; isso não quer dizer que estão parados.')
    // a frase-resumo vem logo abaixo do título, antes do dicionário
    expect(texto.indexOf('Dos 34 canais')).toBeLessThan(texto.indexOf('- canais: '))
    const ultima = csv.linhas[3]!
    expect(ultima.startsWith('direção não medida,30,')).toBe(true)
    expect(ultima).toContain('canais: canais cuja direção o painel não calculou')
    expect(ultima).toContain('não quer dizer parado nem sem mudança; a primeira medida sai em 16/11')
    expect(texto).not.toContain('\nnão medido,')
  })
  it('as chaves do CSV não mudam', () => {
    const { t, csv } = bloco({ sobe: 2, estavel: 1, desce: 1, naoMedido: 30 })
    expect(t.chaves).toEqual(['direcao', 'canais'])
    expect(csv.cabecalho).toBe('direcao,canais,motivos')
    expect(csv.linhas.map((l) => l.split(',')[0])).toEqual(['subindo', 'sem mudança', 'descendo', 'direção não medida'])
  })
  it('0 medidos: sem gráfico, sem "Os outros 0", título diz "nenhum dos N"', () => {
    const { t, csv, texto } = bloco({ sobe: 0, estavel: 0, desce: 0, naoMedido: 12 })
    expect(csv.grafico).toBe('nenhum')
    expect(texto).toContain('Gráfico sugerido: nenhum')
    expect(t.titulo).toBe('Direção dos canais em 28 dias: ainda não medida em nenhum dos 12, sem o seu canal')
    expect(texto).toContain('Nenhum dos 12 canais tem direção medida ainda; isso não quer dizer que estão parados.')
    expect(texto).not.toContain('Os outros')
  })
  it('todos medidos: a frase não traz "Os outros 0"; parte com 0 segue na tabela (a instrução manda não desenhar)', () => {
    const { texto, csv } = bloco({ sobe: 20, estavel: 20, desce: 10, naoMedido: 0 })
    expect(texto).not.toContain('Os outros')
    expect(texto).toContain('Dos 50 canais, 50 têm direção medida')
    expect(csv.linhas[3]!.startsWith('direção não medida,0,')).toBe(true)
    expect(texto).toContain('parte com 0 não é desenhada')
  })
  it('leitura falhou em K canais: aparece na frase, não no título, e fica fora do total', () => {
    const { t, texto } = bloco({ sobe: 2, estavel: 1, desce: 1, naoMedido: 42, falhou: 3 })
    expect(t.titulo).toBe('Direção dos canais em 28 dias: medida em 4 de 46, sem o seu canal')
    expect(t.titulo).not.toContain('falhou')
    expect(texto).toContain('A leitura falhou em 3 canais, fora desta conta.')
    expect(bloco({ sobe: 2, estavel: 1, desce: 1, naoMedido: 42, falhou: 1 }).texto).toContain('A leitura falhou em 1 canal, fora desta conta.')
  })
  it('sem data de fechamento a nota não promete a primeira medida', () => {
    expect(bloco({ sobe: 1, estavel: 0, desce: 0, naoMedido: 2, data: null }).csv.linhas[3]).not.toContain('primeira medida')
  })
})
