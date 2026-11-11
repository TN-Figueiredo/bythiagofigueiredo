// @vitest-environment node
/** A5 F3 T12: a IA aprende a pedir tabela e gráfico (DESCRICAO, INSTRUCOES, COMO_LER_TABELA, frase de LGPD na tabela privada). */
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: () => undefined, captureException: () => undefined }))
import { DESCRICAO, INSTRUCOES, ITENS_DE_INSTRUCAO, instrucoesDe, NOME_DA_FERRAMENTA } from '@/lib/pipeline/mcp/observatorio/servidor'
import { CAMPOS_DA_ACAO, EXEMPLO_DA_ACAO } from '@/lib/youtube/observatorio/acesso-ia/exemplos'
import { ACOES, ENTRADA } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import * as F from '@/lib/youtube/observatorio/contexto-ia/frases'
import { blocoDaTabela, csvDaTabela, novaLegenda } from '@/lib/youtube/observatorio/contexto-ia/tabela-csv'
import type { Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'

const LGPD = 'esta planilha leva dado privado do seu canal: revogar a chave não apaga o que já foi baixado'
const todas = new Set(ITENS_DE_INSTRUCAO.map((i) => i.fatia))

describe('F3: DESCRICAO e exemplos', () => {
  it('pede saida "tabela" e cita o gráfico sugerido; cabe em 2.000', () => {
    expect(DESCRICAO).toContain('saida "tabela"')
    expect(DESCRICAO).toContain('gráfico sugerido')
    expect(DESCRICAO).toContain('linha, barra, pizza ou nenhum')
    expect(DESCRICAO.length).toBeLessThanOrEqual(2_000)
  })
  it('exemplos de listar_canais e serie levam saida tabela; o exemplo da serie não leva canal_ids', () => {
    expect(EXEMPLO_DA_ACAO.listar_canais).toContain('"saida":"tabela"')
    expect(EXEMPLO_DA_ACAO.serie).toContain('"saida":"tabela"')
    expect(DESCRICAO).toContain(`- ${EXEMPLO_DA_ACAO.serie}`)
    expect(EXEMPLO_DA_ACAO.serie).not.toContain('canal_ids')
  })
  it('todo campo dos exemplos existe em CAMPOS_DA_ACAO da própria ação', () => {
    for (const a of ACOES) for (const k of Object.keys(JSON.parse(EXEMPLO_DA_ACAO[a]) as object).filter((k) => k !== 'acao')) expect(CAMPOS_DA_ACAO[a], `${a}.${k}`).toContain(k)
  })
})

describe('F3: INSTRUCOES', () => {
  const doItem = ITENS_DE_INSTRUCAO.filter((i) => i.fatia === 'A5')
  it('há um item da fatia A5 e ele pede saida "tabela", o gráfico sugerido e a regra do mês', () => {
    expect(doItem).toHaveLength(1)
    expect(INSTRUCOES).toContain('saida "tabela"')
    expect(INSTRUCOES).toContain('gráfico sugerido')
    expect(INSTRUCOES).toContain('nunca zero')
    expect(INSTRUCOES).toContain('mês não é medido')
  })
  it('com todos os itens cabe em 1.200 e a numeração é contígua', () => {
    const t = instrucoesDe(new Set(todas))
    expect(t.length).toBeLessThanOrEqual(1_200)
    expect(t.split('\n').filter((l) => /^\d+\. /.test(l)).map((l) => Number(l.split('.')[0]))).toEqual(ITENS_DE_INSTRUCAO.map((_, i) => i + 1))
  })
  it('sem a fatia A5 o item some e a numeração continua contígua', () => {
    const sem = new Set(todas); sem.delete('A5')
    const t = instrucoesDe(sem)
    expect(t).not.toContain('saida "tabela"')
    expect(t.split('\n').filter((l) => /^\d+\. /.test(l)).map((l) => Number(l.split('.')[0]))).toEqual(ITENS_DE_INSTRUCAO.slice(0, -1).map((_, i) => i + 1))
  })
  it('o campo saida (uma palavra só, fora da varredura de snake_case do A7d T5) existe no esquema', () => {
    const campos = new Set<string>(ENTRADA.options.flatMap((o) => Object.keys(o.shape)))
    expect(campos.has('saida')).toBe(true)
  })
})

describe('F3: COMO_LER_TABELA e a frase de LGPD', () => {
  const rot = (t: string) => ({ papel: 'rotulo', texto: t }) as never
  const num = (x: number) => ({ papel: 'numero', estado: 'medido', x }) as never
  const tab = (privada: boolean): Tabela => ({ id: 't', titulo: 'Canais', colunas: ['Canal', 'Inscritos'], chaves: ['canal', 'inscritos'], linhas: [[rot('Ana'), num(15230)]], tipo: 'lista', nomeNoCorte: 'Canais', privada })
  it('COMO_LER_TABELA manda citar as duas bases', () => {
    expect(F.COMO_LER_TABELA).toContain('não compare bases diferentes sem citar as duas')
  })
  it('a frase de LGPD está na constante e só na tabela privada', () => {
    expect(F.TABELA_PRIVADA_LGPD).toBe(LGPD)
    const pub = csvDaTabela(tab(false), novaLegenda())!
    const priv = csvDaTabela(tab(true), novaLegenda())!
    expect(blocoDaTabela(pub, pub.linhas)).not.toContain(LGPD)
    expect(blocoDaTabela(priv, priv.linhas)).toContain(LGPD)
    expect(F.COMO_LER_TABELA).not.toContain('revogar a chave')
  })
})
