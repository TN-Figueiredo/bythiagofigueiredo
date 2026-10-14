// @vitest-environment node
/** E17 degrau 1, pendência F da revisão da onda 1: bandeira de privado em foco, citados, definições e avisos; "excluído não vaza folha privada". */
import { describe, expect, it } from 'vitest'
import { segmentar, type PacoteSerializado } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { MARCA_PRIVADO } from '@/lib/youtube/observatorio/contexto-ia/frases'
import type { PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { CONTEXTO, modeloComComentarios, modeloPrivadoIncluido } from './contexto-ia-fixture'
import { provarQueExcluidoNaoVaza } from './contexto-ia-paridade'

const texto = (p: PacoteSerializado): string => p.segmentos.map((s) => s.texto).join('\n')
const PRIV = { foco: 'cliques estimados do canal XPTO', citado: 'leitura privada do bloco XPTO', definicao: 'definição privada XPTO', aviso: 'aviso privado XPTO' }

/** O modelo incluído, com um item privado de cada espécie além da tabela privada. */
function incluidoComTudo(): PacoteModelo {
  const m = modeloPrivadoIncluido()
  return {
    ...m,
    foco: [...m.foco, { nome: 'Seu canal', oQueE: 'seu canal', detalhe: PRIV.foco, privado: true }],
    citados: [...m.citados, { rotulo: 'Leitura', texto: PRIV.citado, origem: 'pack.leitura', privado: true }],
    definicoes: [...m.definicoes, { medida: 'Impressões', frase: PRIV.definicao, limiares: [], privado: true }],
    avisosPrivados: [PRIV.aviso],
  }
}
/** O que um empacotador correto faz sem o direito: tira a tabela privada e tudo o que tem bandeira. */
function excluidoDe(m: PacoteModelo, motivo: 'sem_direito' | 'nao_conferido' | 'leitura_falhou' = 'sem_direito'): PacoteModelo {
  return {
    ...m,
    tabelas: m.tabelas.filter((t) => !t.privada),
    foco: m.foco.filter((f) => !f.privado), citados: m.citados.filter((b) => !b.privado), definicoes: m.definicoes.filter((d) => !d.privado), avisosPrivados: undefined,
    privado: { estado: 'excluido', motivo, itens: 'impressões por dia' },
  }
}

describe('bandeira de privado fora das tabelas', () => {
  it.each([
    ['foco', (m: PacoteModelo): PacoteModelo => ({ ...m, foco: [...m.foco, { nome: 'A', oQueE: 'seu canal', detalhe: PRIV.foco, privado: true }] })],
    ['bloco citado', (m: PacoteModelo): PacoteModelo => ({ ...m, citados: [...m.citados, { rotulo: 'L', texto: PRIV.citado, origem: 'x', privado: true }] })],
    ['definição', (m: PacoteModelo): PacoteModelo => ({ ...m, definicoes: [...m.definicoes, { medida: 'M', frase: PRIV.definicao, limiares: [], privado: true }] })],
    ['aviso', (m: PacoteModelo): PacoteModelo => ({ ...m, avisosPrivados: [PRIV.aviso] })],
  ])('%s privado com privado "excluido" ou "na" lança (defeito do empacotador)', (_nome, poe) => {
    const base = excluidoDe(incluidoComTudo())
    expect(() => segmentar(poe(base), CONTEXTO)).toThrow(/privado/)
    expect(() => segmentar(poe({ ...base, privado: { estado: 'na' } }), CONTEXTO)).toThrow(/privado/)
  })

  it('com o privado incluído, cada um leva a marca "(privado do canal)" e o texto está lá', () => {
    const t = texto(segmentar(incluidoComTudo(), CONTEXTO))
    for (const cadeia of Object.values(PRIV)) {
      const linha = t.split('\n').find((l) => l.includes(cadeia) || (cadeia === PRIV.citado && l.includes('Leitura')))
      expect(linha, cadeia).toBeTruthy()
    }
    expect(t.split('\n').filter((l) => l.includes(MARCA_PRIVADO)).length).toBeGreaterThanOrEqual(5) // tabela, foco, citado, definição, aviso
    expect(t).toContain(`- ${PRIV.aviso}${MARCA_PRIVADO}`)
    expect(t).toContain(`- Impressões${MARCA_PRIVADO}: ${PRIV.definicao}`)
  })

  it('sem nenhuma bandeira, o texto é o de antes (campo ausente não muda nada)', () => {
    const m = modeloPrivadoIncluido()
    expect(texto(segmentar(m, CONTEXTO))).not.toContain('XPTO')
    expect(() => segmentar({ ...m, avisosPrivados: [] }, CONTEXTO)).not.toThrow()
  })
})

describe('excluído não vaza folha privada', () => {
  it.each(['sem_direito', 'nao_conferido', 'leitura_falhou'] as const)('motivo %s: nenhuma cadeia privada do incluído está no texto nem no JSON', (motivo) => {
    const inc = incluidoComTudo()
    const exc = segmentar(excluidoDe(inc, motivo), CONTEXTO)
    provarQueExcluidoNaoVaza(inc, texto(exc), JSON.stringify(exc))
    // e o incluído tem as cadeias (a prova não é vazia)
    expect(texto(segmentar(inc, CONTEXTO))).toContain('5000')
  })

  it('o auxiliar acusa o vazamento: um item privado que o empacotador esqueceu de tirar aparece no texto e a prova lança', () => {
    const inc = incluidoComTudo()
    const exc = excluidoDe(inc)
    // vazamento por um canal sem bandeira: o mesmo texto privado em um aviso comum
    const vaza = segmentar({ ...exc, avisos: [...exc.avisos, PRIV.aviso] }, CONTEXTO)
    expect(() => provarQueExcluidoNaoVaza(inc, texto(vaza), JSON.stringify(vaza))).toThrow(/cadeia privada/)
  })

  it('modelo sem nenhuma cadeia privada útil: a prova lança em vez de passar em verde', () => {
    const m = modeloPrivadoIncluido(false)
    const semUteis: PacoteModelo = { ...m, tabelas: m.tabelas.map((t) => (t.privada ? { ...t, linhas: [] } : t)) }
    expect(() => provarQueExcluidoNaoVaza(semUteis, '', '')).toThrow(/não provaria nada/)
  })
})

describe('comentários têm a bandeira própria (estado), independente do privado', () => {
  it('comentários incluídos com privado "na" ou excluído não lançam: o direito do texto de comentário é outro (8.1.3)', () => {
    const c = modeloComComentarios('incluido')
    expect(() => segmentar(c, CONTEXTO)).not.toThrow()
    expect(() => segmentar({ ...c, privado: { estado: 'excluido', motivo: 'sem_direito', itens: 'x' } }, CONTEXTO)).not.toThrow()
  })
})
