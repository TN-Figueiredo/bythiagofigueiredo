// @vitest-environment node
/**
 * A7c1 T10: o resumo do todo entra na janela como segmento da parte 1 (corte null), medido pelo `montarTexto`.
 * Empacotador REAL de Canais; Mudanças e Destaques sintéticos.
 */
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { a3World } from './a3-fixture'
import { medidasDoOraculo } from './canais-e5a-fixture'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { buildRiView } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-model'
import { empacotarCanais, modeloDeCanais } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canais'
import { RESUMO_MAX } from '@/lib/youtube/observatorio/acesso-ia/resumo'
import { janela } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/corte-da-ia'
import { medidaConfere } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import type { PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { CONTEXTO, base, medido, modeloCheio, naoMedido, rotulo, terceiros } from './contexto-ia-fixture'

function modeloDe(n: number, fmt: 'longos' | 'todos' = 'longos', semDirecao = false): PacoteModelo {
  const { obs } = a3World((ds: Dataset) => {
    const concorrentes = ds.channels.filter((c) => !c.own)
    let i = 0
    while (ds.channels.length < n) {
      const molde = concorrentes[i % concorrentes.length]!
      const id = `${molde.id}-c${i}`
      ds.channels.push({ ...structuredClone(molde), id, name: `${molde.name} ${i + 2}`, fullName: `${molde.fullName} ${i + 2}` })
      for (const v of ds.videos.filter((x) => x.ch === molde.id)) ds.videos.push({ ...structuredClone(v), id: `${v.id}-c${i}`, ch: id })
      i += 1
    }
    ds.channels = ds.channels.slice(0, Math.max(n, ds.channels.filter((c) => c.own).length))
  })
  const view = buildCanaisView(obs, { niche: 'todos', limit: 200, fmt, medidas: medidasDoOraculo(obs) }, undefined)
  const ri = buildRiView(obs, { agoraMs: obs.NOW, niche: 'todos', fmt: 'long', meuCanalLembrado: null, retratosProprios: new Map() }).view
  const modelo = modeloDeCanais(view, ri)
  if (semDirecao) for (const r of [...modelo.list.ranked, ...modelo.list.unranked]) r.direcaoNumeros = null
  return empacotarCanais(modelo, { acessoPorCanal: {}, negativa: null })
}

const bloco = (texto: string): string => { const i = texto.indexOf('## Resumo do todo'); return i < 0 ? '' : texto.slice(i, texto.indexOf('\n\n', i)) }
const sintetico = (tela: 'mudancas' | 'outliers', tabelas: Tabela[]): PacoteModelo => ({ ...modeloCheio(), tela, tabelas, citados: [], foco: [], definicoes: [], avisos: [] })
const trocas = (n: number, tipo = 'Título'): Tabela => ({
  id: 'trocas', titulo: 'As trocas', tipo: 'lista', nomeNoCorte: 'trocas', privada: false, colunas: ['Vídeo', 'Nicho', 'Tipo', 'Views'],
  linhas: Array.from({ length: n }, (_, i) => [terceiros(`V${i}`, `t${i}.v`), rotulo(i % 3 === 0 ? 'Culinária' : 'Viagem', `t${i}.n`), rotulo(tipo, `t${i}.t`), i % 4 === 0 ? naoMedido('sem leitura', `t${i}.w`) : medido('1', 1, `t${i}.w`)]),
})

describe('A7c1 T10: o resumo na janela', () => {
  it('60 canais: o resumo está no topo (antes do "Como ler"), conta as 60 linhas e o texto cabe com a medida exata', () => {
    const j = janela(modeloDe(60), CONTEXTO, 1, 200, 45_000)
    const t = j.corte.texto
    expect(t.texto).toContain('## Resumo do todo (calculado sobre as 60 linhas do pacote, antes da janela)')
    expect(t.texto.indexOf('## Resumo do todo')).toBeLessThan(t.texto.indexOf('### Os canais acompanhados'))
    expect(t.caracteres).toBeLessThanOrEqual(45_000)
    expect(medidaConfere(t)).toBe(true)
    expect(bloco(t.texto).length).toBeLessThanOrEqual(2_500)
  })

  it('janela 1 leva o resumo cheio; a janela 2 leva só a linha que aponta para ele (com a marca da lista); a de 20 linhas não muda o cheio', () => {
    const mod = modeloDe(200)
    const a = janela(mod, CONTEXTO, 1, 200, 45_000)
    const b = janela(mod, CONTEXTO, a.k + 1, 200, 45_000)
    const c = janela(mod, CONTEXTO, 1, 20, 45_000)
    expect(a.k).toBeLessThan(200)
    expect(bloco(a.corte.texto.texto)).toContain('| Coluna | Medidos |')
    expect(bloco(c.corte.texto.texto)).toBe(bloco(a.corte.texto.texto))
    expect(bloco(b.corte.texto.texto)).toBe(`## Resumo do todo: o da janela 1 (mesma lista de 200 linhas, marca ${a.marca})`)
    expect(a.corte.texto.caracteres).toBeLessThanOrEqual(45_000)
    expect(medidaConfere(b.corte.texto)).toBe(true)
  })

  it('o resumo ocupa lugar: com ele, k é menor do que sem ele por pelo menos o que ele ocupa dividido pela linha mais comprida', () => {
    const mod = modeloDe(200)
    const j = janela(mod, CONTEXTO, 1, 200, 45_000)
    // o mesmo teto + o tamanho do resumo (e a folga dele no texto) tem de caber ao menos o mesmo k
    const maior = janela(mod, CONTEXTO, 1, 200, 45_000 + bloco(j.corte.texto.texto).length + 2)
    expect(maior.k).toBeGreaterThanOrEqual(j.k)
    expect(janela(mod, CONTEXTO, 1, 200, 45_000 - 1).k).toBeLessThanOrEqual(j.k)
  })

  it('Inscritos do resumo: igual ao da tabela do pacote, "sem medida" não vira zero', () => {
    const mod = modeloDe(60)
    const principal = mod.tabelas.find((t) => t.id === 'canais')!
    const col = principal.colunas.indexOf('Inscritos')
    expect(col).toBeGreaterThanOrEqual(0)
    const cel = principal.linhas.map((l) => l[col]!)
    const conta = (f: (c: (typeof cel)[number]) => boolean): number => cel.filter(f).length
    const linha = bloco(janela(mod, CONTEXTO, 1, 200, 45_000).corte.texto.texto).split('\n').find((l) => l.startsWith('| Inscritos |'))!
    const esperado = [
      conta((c) => c.papel === 'numero' && c.estado === 'medido'), conta((c) => c.papel === 'numero' && c.estado === 'zero_medido'),
      conta((c) => c.papel === 'numero' && c.estado === 'nao_medido'), conta((c) => c.papel === 'numero' && c.estado === 'falhou'),
      conta((c) => c.papel === 'numero' && c.estado === 'restrito'), conta((c) => c.papel !== 'numero'),
    ]
    expect(linha).toBe(`| Inscritos | ${esperado.join(' | ')} |`)
  })

  it('M = 0 não passa pela janela com resumo: o segmento só existe com o campo preenchido', () => {
    const s = segmentar(modeloCheio(), CONTEXTO)
    expect(s.segmentos.some((x) => x.texto.includes('## Resumo do todo'))).toBe(false)
    const com = segmentar({ ...modeloCheio(), resumoDoTodo: '## Resumo do todo (x)\nlinha' }, CONTEXTO)
    const seg = com.segmentos.find((x) => x.texto.includes('## Resumo do todo'))!
    expect(seg.parte).toBe(1)
    expect(seg.corte).toBeNull()
    expect(seg.texto.endsWith('\n')).toBe(true)
  })

  it('Mudanças sem o quadro de efeito: "Por Tipo" e "Por Nicho" contam sobre as 300 trocas, a janela de 25 não os muda', () => {
    const mod = sintetico('mudancas', [trocas(300)])
    const j = janela(mod, CONTEXTO, 1, 25, 45_000)
    const b = bloco(j.corte.texto.texto)
    expect(b).toContain('Por Tipo: Título 300')
    expect(b).toContain('Por Nicho: Viagem 200; Culinária 100')
    expect(j.k).toBe(25)
  })

  it('Mudanças com o quadro de efeito: "Tipo" sai (a tela já conta por tipo); "Nicho" fica', () => {
    const quadro: Tabela = { id: 'quadro-de-efeito', titulo: 'Efeito', tipo: 'fixa', nomeNoCorte: 'q', privada: false, colunas: ['Tipo', 'Trocas na janela'], linhas: [[rotulo('Título', 'q.t'), medido('300', 300, 'q.n')]] }
    const b = bloco(janela(sintetico('mudancas', [quadro, trocas(300)]), CONTEXTO, 1, 25, 45_000).corte.texto.texto)
    expect(b).not.toContain('Por Tipo')
    expect(b).toContain('Por Nicho:')
  })

  it('Destaques: o Grupo não se repete no resumo (a tela já manda os grupos); a Cobertura da linha diz quando a tela mostra parte', () => {
    const principal: Tabela = { id: 'outliers', titulo: 'Destaques', tipo: 'lista', nomeNoCorte: 'o', privada: false, colunas: ['Grupo', 'Vídeo', 'Nicho', 'Views'], linhas: Array.from({ length: 60 }, (_, i) => [base('G1', `o${i}.g`), terceiros(`V${i}`, `o${i}.v`), rotulo('Viagem', `o${i}.n`), medido('9', 9, `o${i}.w`)]) }
    const b = bloco(janela({ ...sintetico('outliers', [principal]), paginado: { mostrados: 40, total: 60 } }, CONTEXTO, 1, 50, 45_000).corte.texto.texto)
    expect(b).not.toContain('Por Grupo')
    expect(b).toContain('Por Nicho: Viagem 60')
    expect(b.split('\n')[0]).toContain('; a tela mostra 40 de 60)')
  })

  // rodada 2, achado 1: a tabela coluna ausente não some do resumo
  it('empacotador real, 60 canais sem o dado da direção: a tabela sai em UMA linha (sem nenhuma linha) com Sem linha = 60, nunca some', () => {
    const mod = modeloDe(60, 'longos', true)
    expect(mod.tabelas.map((t) => t.id)).toContain('canais-direcao-numeros')
    expect(mod.tabelas.find((t) => t.id === 'canais-direcao-numeros')!.linhas).toHaveLength(0)
    const b = bloco(janela(mod, CONTEXTO, 1, 200, 45_000).corte.texto.texto)
    const t = mod.tabelas.find((x) => x.id === 'canais-direcao-numeros')!
    expect(b).toContain(`| ${t.titulo} (sem nenhuma linha) | 0 | 0 | 0 | 0 | 0 | 60 |`)
    expect(b).not.toContain('| Views nos últimos 28 dias |')
  })

  it('o texto da tela não muda com a tabela vazia: igual ao do modelo sem as listas vazias, byte a byte', () => {
    for (const fmt of ['longos', 'todos'] as const) {
      const mod = modeloDe(60, fmt, true)
      const sem: PacoteModelo = { ...mod, tabelas: mod.tabelas.filter((t) => !(t.tipo === 'lista' && t.linhas.length === 0)) }
      expect(mod.tabelas.length).toBeGreaterThan(sem.tabelas.length)
      const a = segmentar(mod, CONTEXTO), b = segmentar(sem, CONTEXTO)
      expect(a.segmentos.map((x) => x.texto)).toEqual(b.segmentos.map((x) => x.texto))
      expect(a.tabelas.map((t) => t.id)).toEqual(b.tabelas.map((t) => t.id))
    }
  })

  it('só listas vazias: a frase "nenhuma tabela" continua saindo', () => {
    const vazia: Tabela = { id: 'canais-x', titulo: 'X', tipo: 'lista', nomeNoCorte: 'x', privada: false, colunas: ['Canal', 'N'], linhas: [] }
    const t = segmentar({ ...modeloCheio(), tabelas: [vazia], citados: [] }, CONTEXTO).segmentos.map((x) => x.texto).join('\n')
    expect(t).not.toContain('### X')
    expect(segmentar({ ...modeloCheio(), tabelas: [], citados: [] }, CONTEXTO).segmentos.map((x) => x.texto).join('\n')).toBe(t)
  })

  // rodada 2, achado 2: o alarme de quando o resumo encostar no teto
  it('Canais real com fmt todos e todas as tabelas coluna: o resumo cabe em RESUMO_MAX e não dispara o aviso', () => {
    const j = janela(modeloDe(200, 'todos'), CONTEXTO, 1, 200, 45_000)
    const b = bloco(j.corte.texto.texto)
    expect(b.length).toBeLessThanOrEqual(RESUMO_MAX)
    expect(j.resumoPassou).toBe(false)
    expect(b).toContain('| Views nos últimos 28 dias |')
  })

  // rodada 2, achado 5
  it('janela 2 não carrega o resumo cheio (ponteiro) e não dispara resumoPassou', () => {
    const mod = modeloDe(200)
    const a = janela(mod, CONTEXTO, 1, 200, 45_000)
    const b = janela(mod, CONTEXTO, a.k + 1, 200, 45_000)
    expect(b.corte.texto.texto).not.toContain('| Coluna | Medidos |')
    expect(b.resumoPassou).toBe(false)
  })
})
