// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { painelDoAtivo, painelDoConcluido, escolhaDe, rotuloDoBotao, avisoDaEscolha, mensagemDeFalha, mensagemDeFeito } from '@/lib/youtube/ab-lab-pagina/painel-decisao'
import { diaMesSp, dataCurtaSp } from '@/lib/youtube/ab-data-curta'
import { dataCurtaSp as reexp } from '@/app/cms/(authed)/youtube/ab-lab/_components/encerrar-props'
import { makeCardView } from './helpers/ab-fixtures'
import type { TelaV2 } from '@/lib/youtube/ab-gravacao/tela-v2'

const mk = (id: string, label: 'A' | 'B' | 'C', isOriginal: boolean) =>
  ({ id, label, color: '#000', thumbUrl: null, title: `t${label}`, isOriginal })
const cardABC = makeCardView({ id: 't1', variants: [mk('va', 'A', true), mk('vb', 'B', false), mk('vc', 'C', false)], videoTitle: 'Vídeo X', restoreSeq: 2 })
const e = { ctrs: {}, noArLetra: 'B', sugeridaId: null as string | null, regraV2: true, podeDeixarVariante: true }
const agora = new Date('2026-10-26T15:00:00Z')

type Conc = Extract<TelaV2, { fase: 'concluido' }>
function tela(o: Partial<Conc>): Conc {
  return {
    fase: 'concluido', selo: { tipo: 'vence', provisorio: false, letra: 'B' }, frase: { principal: '', apoio: null }, prazo: null,
    noAr: { tipo: 'original' }, aplicar: null, voltar: false, aplicarDeNovo: null, bloqueio: null, n: null, pisos: null, tentarDeNovo: false, ...o,
  }
}
const ce = { ctrs: {}, sugeridaId: 'vb', revertExpiresAt: '2026-11-02T15:00:00Z', agora }
const pComSugB = painelDoAtivo(cardABC, { ...e, sugeridaId: 'vb' })
const pAtivoNoArB = painelDoAtivo(cardABC, e)
const pAtivoNoArA = painelDoAtivo(cardABC, { ...e, noArLetra: 'A' })
const pConc = painelDoConcluido(cardABC, tela({ aplicar: { variant_id: 'vb', letra: 'B' } }), ce)!
const pAplicado = painelDoConcluido(cardABC, tela({ noAr: { tipo: 'aplicada', letra: 'B', desfechoMudou: false }, voltar: true }), ce)!
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

describe('painelDoConcluido', () => {
  it('B sugerida não aplicada: só B escolhível; padrão B; botão Aplicar B', () => {
    expect(pConc.modo).toBe('concluido')
    expect(pConc.opcoes.map(o => [o.letra, o.estado])).toEqual([['A', 'em_breve'], ['B', 'escolhivel'], ['C', 'em_breve']])
    expect(pConc.padrao).toBe('vb')
    expect(rotuloDoBotao(pConc, 'vb')).toBe('Aplicar B ao vídeo')
    expect(escolhaDe(pConc, 'vb')).toEqual({ tipo: 'aplicar_sugerida', varianteId: 'vb' })
    expect(escolhaDe(pConc, 'va')).toBeNull()
  })
  it('B aplicada com prazo aberto: A escolhível, B no_ar_fixo, C em_breve; voltarAte 02/11', () => {
    expect(pAplicado.modo).toBe('aplicado')
    expect(pAplicado.opcoes.map(o => [o.letra, o.estado])).toEqual([['A', 'escolhivel'], ['B', 'no_ar_fixo'], ['C', 'em_breve']])
    expect(pAplicado.voltarAte).toBe('02/11')
    expect(pAplicado.padrao).toBe('va')
    expect(rotuloDoBotao(pAplicado, 'va')).toBe('Voltar à original')
    expect(escolhaDe(pAplicado, 'va')).toEqual({ tipo: 'voltar' })
  })
  it('prazo vencido há 1 s: painel nulo', () => {
    const t = tela({ noAr: { tipo: 'aplicada', letra: 'B', desfechoMudou: false }, voltar: true })
    expect(painelDoConcluido(cardABC, t, { ...ce, revertExpiresAt: new Date(agora.getTime() - 1000).toISOString() })).toBeNull()
    expect(painelDoConcluido(cardABC, t, { ...ce, revertExpiresAt: null })).toBeNull()
    expect(painelDoConcluido(cardABC, tela({ noAr: { tipo: 'aplicada', letra: 'B', desfechoMudou: false }, voltar: false }), ce)).toBeNull()
  })
  it('aplicarDeNovo: a sugerida volta a ser escolhível', () => {
    const p = painelDoConcluido(cardABC, tela({ noAr: { tipo: 'desfeita', letra: 'B', desfechoMudou: false }, aplicarDeNovo: { variant_id: 'vb', letra: 'B' } }), ce)!
    expect(p.opcoes.map(o => o.estado)).toEqual(['em_breve', 'escolhivel', 'em_breve'])
    expect(rotuloDoBotao(p, 'vb')).toBe('Aplicar B ao vídeo')
  })
  it('sem ação possível: nulo', () => {
    expect(painelDoConcluido(cardABC, tela({}), ce)).toBeNull()
  })
  it('nenhuma opção não sugerida é escolhível no concluído (exceto voltar à original)', () => {
    for (const p of [pConc, pAplicado]) {
      expect(p.opcoes.filter(o => o.estado === 'escolhivel' && !o.sugerida && !(p.modo === 'aplicado' && o.original))).toEqual([])
    }
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
  it('falha no concluído', () => {
    expect(mensagemDeFalha(pConc, 'vb', srv)).toBe('Não consegui aplicar B. A original continua no ar.')
    expect(mensagemDeFalha(pAplicado, 'va', srv)).toBe('Não consegui voltar à original. B continua no ar.')
  })
  it('rede', () => {
    expect(mensagemDeFalha(pConc, 'vb', { tipo: 'rede' })).toBe('A conexão caiu e não deu para confirmar se mudou. Confira o vídeo no YouTube antes de tentar de novo.')
  })
  it('feito', () => {
    expect(mensagemDeFeito(pComSugB, 'vb', '26/10')).toBe('Teste encerrado. B no ar desde 26/10.')
    expect(mensagemDeFeito(pComSugB, 'vc', '26/10')).toBe('Teste encerrado. C no ar desde 26/10. Você escolheu C; o teste indicava B.')
    expect(mensagemDeFeito(pComSugB, 'va', '26/10')).toBe('Teste encerrado. Você manteve A (original). O teste indicava B.')
    expect(mensagemDeFeito(pConc, 'vb', '26/10')).toBe('B no ar desde 26/10. Dá para voltar à original até 02/11.')
    expect(mensagemDeFeito(pAplicado, 'va', '26/10')).toBe('A original voltou ao ar.')
  })
})
