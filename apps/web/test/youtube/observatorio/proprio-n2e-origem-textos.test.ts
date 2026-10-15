// E5b N2, consertos do Logan (15/10): a causa do "0 de N", o tempo verbal da data, o rodapé de vídeos fora e a célula de views do vídeo.
import { describe, it, expect } from 'vitest'
import { buildOrigem } from '@/app/cms/(authed)/youtube/competitors/_proprio/origem-model'
import type { EstadoConjunto, LinhaBasica } from '@/lib/youtube/observatorio/proprio/dimensoes-estado'
import { conjunto, dims, entrada, TIP7, type Dia } from './proprio-origem-fixture'

const semCobertura = (estado: EstadoConjunto, desde?: string) => {
  const lista = TIP7.map((d): [string, Dia] => [d, { base: 455, linhas: {} }])
  const c = conjunto<LinhaBasica>('trafego', lista, () => ({}), estado, desde)
  for (const v of c.videos) for (const d of v.dias) { d.coberto = false }
  return c
}
const faixa = (c: ReturnType<typeof semCobertura>, over = {}) => buildOrigem(entrada({ dimensoes: dims({ trafego: c }), ...over })).periodos[0]!.grupo

describe('Logan D2: o "0 de 7" sempre diz a causa', () => {
  it('data da coleta no passado: "começou em", nunca "começa em"', () => {
    const g = faixa(semCobertura({ tipo: 'nao_coletado' }, '2026-10-05'))
    expect(g.faixa!.dias.sub).toBe('de 7 · a coleta começou em 05/10; nenhum dia deste período chegou')
    expect(g.faixa!.dias.sub).not.toContain('começa em')
    expect(g.blocos.find(b => b.id === 'origem')!.frase).toBe('A coleta começou em 05/10, mas nenhum dia deste período chegou. Não é zero.')
  })
  it('data no futuro continua "começa em"', () => {
    const g = faixa(semCobertura({ tipo: 'nao_coletado' }, '2026-10-14'))
    expect(g.faixa!.dias.sub).toBe('de 7 · a coleta começa em 14/10')
  })
  it.each([
    [{ tipo: 'passo_desligado', comDados: false } as EstadoConjunto, 'de 7 · coleta desligada'],
    [{ tipo: 'coleta_em_erro', outcome: 'desconhecido', comDados: false } as EstadoConjunto, 'de 7 · a última busca falhou'],
    [{ tipo: 'coletado' } as EstadoConjunto, 'de 7 · nenhum dia com todos os vídeos'],
  ])('motivo %j: a legenda traz a causa', (estado, esperado) => {
    const g = faixa(semCobertura(estado))
    expect(g.faixa!.dias.valor).toBe('0')
    expect(g.faixa!.dias.sub).toBe(esperado)
    expect(g.faixa!.dias.sub).not.toMatch(/^de \d+$/)
  })
})

describe('Logan F3: a célula de views existe também na tela do vídeo', () => {
  it('o grupo do vídeo traz `views` rotulada e nenhuma célula de dias', () => {
    const g = buildOrigem(entrada({ tela: 'video', publicadoEm: '2020-01-01' })).periodos[0]!.grupo
    expect(g.views).toMatchObject({ rotulo: 'views no período' })
    expect(g.faixa).toBeUndefined()
  })
})

describe('Logan item 12: "vídeos fora desta conta" não se repete em bloco sem leitura', () => {
  it('bloco não medido não leva a linha de vídeos fora', () => {
    const g = faixa(semCobertura({ tipo: 'nao_coletado' }, '2026-10-05'))
    for (const b of g.blocos) expect(b.linhasDeContagem.join(' '), b.id).not.toContain('fora desta conta')
  })
})
