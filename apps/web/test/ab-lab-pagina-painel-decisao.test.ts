// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { painelDoAtivo, escolhaDe, rotuloDoBotao, avisoDaEscolha, mensagemDeFalha, mensagemDeFeito } from '@/lib/youtube/ab-lab-pagina/painel-decisao'
import { diaMesSp, dataCurtaSp } from '@/lib/youtube/ab-data-curta'
import { dataCurtaSp as reexp } from '@/app/cms/(authed)/youtube/ab-lab/_components/encerrar-props'
import { makeCardView } from './helpers/ab-fixtures'

const mk = (id: string, label: 'A' | 'B' | 'C', isOriginal: boolean) =>
  ({ id, label, color: '#000', thumbUrl: null, title: `t${label}`, isOriginal })
const cardABC = makeCardView({ id: 't1', variants: [mk('va', 'A', true), mk('vb', 'B', false), mk('vc', 'C', false)], videoTitle: 'Vídeo X', restoreSeq: 2 })
const e = { ctrs: {}, noArLetra: 'B', sugeridaId: null as string | null, regraV2: true, podeDeixarVariante: true }

const pComSugB = painelDoAtivo(cardABC, { ...e, sugeridaId: 'vb' })
const pAtivoNoArB = painelDoAtivo(cardABC, e)
const pAtivoNoArA = painelDoAtivo(cardABC, { ...e, noArLetra: 'A' })
const srv = { tipo: 'servidor' as const, error: 'x' }

describe('painelDoAtivo', () => {
  it('diaDeTeto vem do card (dia 4 de 14) e some quando o card não tem o dia', () => {
    expect(painelDoAtivo({ ...cardABC, diaV2: { dia: 3, teto: 14 } }, e).diaDeTeto).toBe('dia 4 de 14')
    expect(painelDoAtivo(cardABC, e).diaDeTeto).toBeUndefined()
  })
  it('todas escolhíveis; No ar na letra lida; sem sugerida nada marcado', () => {
    expect(pAtivoNoArB.opcoes.map(o => [o.letra, o.estado, o.noAr])).toEqual([['A', 'escolhivel', false], ['B', 'escolhivel', true], ['C', 'escolhivel', false]])
    expect(pAtivoNoArB.padrao).toBeNull()
    expect(rotuloDoBotao(pAtivoNoArB, null)).toBe('Escolha uma versão')
  })
  it('rótulo acompanha a escolha', () => {
    expect(rotuloDoBotao(pComSugB, 'vc')).toBe('Encerrar e deixar C no ar')
    expect(rotuloDoBotao(pComSugB, 'va')).toBe('Encerrar e manter A (original)')
    expect(pComSugB.padrao).toBe('vb')
  })
  it('aviso quando difere da sugerida', () => {
    expect(avisoDaEscolha(pComSugB, 'vc')).toBe('O teste indicou B. Escolher C encerra o teste agora e coloca C no ar.')
    expect(avisoDaEscolha(pComSugB, 'va')).toBe('O teste indicou B. Manter A encerra o teste agora, sem aplicar B.')
    expect(avisoDaEscolha(pComSugB, 'vb')).toBeNull()
  })
  it('sem permissão: só a original escolhível', () => {
    const p = painelDoAtivo(cardABC, { ...e, podeDeixarVariante: false })
    expect(p.opcoes.map(o => [o.letra, o.estado])).toEqual([['A', 'escolhivel'], ['B', 'sem_permissao'], ['C', 'sem_permissao']])
    expect(escolhaDe(p, 'vb')).toBeNull()
  })
  it('CTR nulo fica null, nunca 0', () => {
    expect(painelDoAtivo(cardABC, { ...e, ctrs: { va: null } }).opcoes[0]!.ctr).toBeNull()
    expect(painelDoAtivo(cardABC, { ...e, ctrs: { va: 0.05 } }).opcoes[0]!.ctr).toBe(0.05)
  })
  it('escolhaDe devolve encerrar', () => {
    expect(escolhaDe(pComSugB, 'va')).toEqual({ tipo: 'encerrar', varianteId: 'va', original: true })
    expect(escolhaDe(pComSugB, 'vc')).toEqual({ tipo: 'encerrar', varianteId: 'vc', original: false })
  })
})

describe('diaMesSp (ab-data-curta.ts)', () => {
  it('fronteira do fuso: 2026-10-27T02:30:00Z é 26/10 em São Paulo', () => { expect(diaMesSp('2026-10-27T02:30:00Z')).toBe('26/10') })
  it('nulo ou inválido devolve vazio', () => { expect(diaMesSp(null)).toBe(''); expect(diaMesSp('lixo')).toBe('') })
  it('encerrar-props reexporta a mesma função', () => { expect(reexp).toBe(dataCurtaSp) })
})

describe('mensagens', () => {
  it('falha no ativo', () => {
    expect(mensagemDeFalha(pAtivoNoArB, 'vc', srv)).toBe('Não consegui aplicar C. B continua no ar.')
    expect(mensagemDeFalha(pAtivoNoArA, 'vc', srv)).toBe('Não consegui aplicar C. A original continua no ar.')
    expect(mensagemDeFalha(pAtivoNoArB, 'va', srv)).toBe('Não consegui encerrar o teste. Ele continua rodando.')
  })
  it('rede', () => {
    expect(mensagemDeFalha(pAtivoNoArB, 'vc', { tipo: 'rede' })).toBe('A conexão caiu e não deu para confirmar se mudou. Confira o vídeo no YouTube antes de tentar de novo.')
  })
  it('feito', () => {
    expect(mensagemDeFeito(pComSugB, 'vb', '26/10')).toBe('Teste encerrado. B no ar desde 26/10.')
    expect(mensagemDeFeito(pComSugB, 'vc', '26/10')).toBe('Teste encerrado. C no ar desde 26/10. Você escolheu C; o teste indicava B.')
    expect(mensagemDeFeito(pComSugB, 'va', '26/10')).toBe('Teste encerrado. Você manteve A (original). O teste indicava B.')
  })
})
