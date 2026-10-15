// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { motivoTexto, sentidoDaOrdem, semValorDoProprio, notaDoDivisor, FAIXA_SEM_POSICAO, ORDEM_POSICAO, ORDEM_EMPATE } from '@/app/cms/(authed)/youtube/competitors/_canais/posicao-model'

const { obs } = a3World()
const view = (p: Partial<CanaisParams> = {}) => buildCanaisView(obs, { niche: 'todos', limit: 75, ...p })

describe('textos à letra do mockup 17', () => {
  it('sentido da ordem', () => {
    expect(sentidoDaOrdem('growth', 'desc')).toBe('de quem mais ganhou a quem mais perdeu inscritos em 30 dias')
    expect(sentidoDaOrdem('growth', 'asc')).toBe('de quem mais perdeu a quem mais ganhou inscritos em 30 dias')
    expect(sentidoDaOrdem('direcao', 'desc')).toBe('de quem mais sobe a quem mais cai em views')
    expect(sentidoDaOrdem('direcao', 'asc')).toBe('de quem mais cai a quem mais sobe em views')
    expect(sentidoDaOrdem('subs', 'desc')).toBe('do maior ao menor número de inscritos')
    expect(sentidoDaOrdem('subs', 'asc')).toBe('do menor ao maior número de inscritos')
    expect(sentidoDaOrdem('vpd', 'desc')).toBe('do maior ao menor número de views por dia')
    expect(sentidoDaOrdem('vpd', 'asc')).toBe('do menor ao maior número de views por dia')
    expect(sentidoDaOrdem('active', 'desc')).toBeNull()
  })
  it('posição e empate', () => {
    expect(ORDEM_POSICAO).toBe('Posição: 1º é o maior valor, em qualquer sentido.')
    expect(ORDEM_EMPATE).toBe('Empate: mesmo valor na tela, mesma posição.')
  })
  it('faixa do canal próprio nas ordenações sem posição', () => {
    expect(FAIXA_SEM_POSICAO).toBe('A posição do seu canal em relação aos outros só existe em Inscritos e Views/dia, os números de tamanho e de alcance. Aqui, a coluna P numera os canais da lista.')
    expect(motivoTexto('ordenacao-sem-posicao')).toBe(FAIXA_SEM_POSICAO)
    expect(semValorDoProprio('growth')).toBe('Seu canal ainda não tem Crescimento medido.')
    expect(semValorDoProprio('direcao')).toBe('Seu canal ainda não tem Direção medida.')
    expect(semValorDoProprio('subs')).toBeNull()
  })
  it('notas do divisor', () => {
    expect(notaDoDivisor('growth')).toBe('Estes canais não têm Crescimento medido; o motivo está em cada linha. Sem número, não entram na numeração e nunca valem zero.')
    expect(notaDoDivisor('direcao')).toBe('Estes canais não têm Direção medida; o motivo está em cada linha. Sem número, não entram na numeração e nunca valem zero.')
    expect(notaDoDivisor('subs')).toBe('Estes canais escondem os inscritos.')
    expect(notaDoDivisor('vpd')).toBe('Estes canais ainda não têm views por dia medidas.')
    expect(notaDoDivisor('active')).toBeNull()
  })
  it('a vista entrega a linha de ordem e a faixa', () => {
    const v = view({ sort: 'growth' })
    expect(v.ordem.coluna).toBe('Crescimento')
    expect(v.ordem.sentido).toBe('de quem mais ganhou a quem mais perdeu inscritos em 30 dias')
    expect(v.faixaSemPosicao!.linha2).toBe(FAIXA_SEM_POSICAO)
    expect(view({ sort: 'subs' }).faixaSemPosicao).toBeNull()
  })
})
