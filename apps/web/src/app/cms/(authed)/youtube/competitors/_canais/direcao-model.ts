// A5 · E5a, Tarefa 5: a célula de Direção da lista de Canais e o resumo das quatro casas. Puro: o relógio e os dados entram por parâmetro.
import type { ExtrasDoCanal } from '@/lib/youtube/observatorio/medidas-telas/ler-extras-dos-canais'
import type { Medida, MotivoNaoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import type { ValorDirecaoCanal } from '@/lib/youtube/observatorio/medidas/direcao'
import { pctDosGanhos, direcaoExibida, posicaoNaRegua, type SimboloDeDirecao } from '@/lib/youtube/observatorio/medidas-telas/direcao-exibida'
import { avisoDeContagem } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { FRASES, classeDoMotivo } from '@/lib/youtube/observatorio/medidas-telas/frases'

export type CelulaDeDirecao =
  | {
    tipo: 'medido'; pct: number; simbolo: SimboloDeDirecao; texto: string; ganhoRecente: number; ganhoAnterior: number
    foraDaEscala: 'acima' | 'abaixo' | null; fracao: number; avisoDeContagem: { ate: string } | null
  }
  | { tipo: 'nao_medido'; motivo: MotivoNaoMedido; curta: string; longa: string; fechaEm?: string }
  | { tipo: 'nao_carregou'; motivo: MotivoNaoMedido }
  /** O canal próprio: o YouTube não dá o número, e ele fica fora das quatro casas e das contagens dos filtros. */
  | { tipo: 'canal_proprio'; curta: string; longa: string }

const dm = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
// TEXTO-A-REVISAR (Logan/Naksu): a frase do canal próprio é a do mockup 16 (S4); a longa repete a curta.
export const FRASE_CANAL_PROPRIO = 'o YouTube não dá esse número do seu canal'
// TEXTO-A-REVISAR (Logan/Naksu): a frase do canal sem vídeos é a do mockup 16.
export const FRASE_SEM_VIEWS = 'sem views nos 56 dias para comparar'

/**
 * `m3a` nulo = a medida não chegou (canal que não carregou, ou as medidas do site inteiro que falharam). `extras` nulo = os campos do canal
 * não foram lidos: a data de "saiu do YouTube" não é inventada.
 */
export function celulaDeDirecao(
  m3a: Medida<ValorDirecaoCanal> | null, extras: ExtrasDoCanal | null,
  o: { proprio?: boolean; semVideos?: boolean } = {},
): CelulaDeDirecao {
  if (o.proprio) return { tipo: 'canal_proprio', curta: `não medido: ${FRASE_CANAL_PROPRIO}`, longa: FRASE_CANAL_PROPRIO }
  if (m3a === null) return { tipo: 'nao_carregou', motivo: 'leitura_falhou' }
  if (extras?.missingSince) {
    const motivo: MotivoNaoMedido = m3a.estado === 'nao_medido' ? m3a.motivo : 'sem_registro_recente'
    return { tipo: 'nao_medido', motivo, curta: `saiu do YouTube em ${dm(extras.missingSince)}`, longa: FRASES[motivo]({}).longa }
  }
  if (m3a.estado === 'nao_medido') {
    if (classeDoMotivo(m3a.motivo) === 'nao_carregou') return { tipo: 'nao_carregou', motivo: m3a.motivo }
    const f = FRASES[m3a.motivo]({ desde: m3a.desde, fechaEm: m3a.fechaEm, n: m3a.n, minimo: m3a.minimo }, 'canais')
    const curta = o.semVideos && m3a.motivo === 'base_zero' ? FRASE_SEM_VIEWS : f.curta
    return { tipo: 'nao_medido', motivo: m3a.motivo, curta, longa: f.longa, ...(m3a.fechaEm ? { fechaEm: m3a.fechaEm } : {}) }
  }
  const { ganhoRecente, ganhoAnterior } = m3a.valor
  const pct = pctDosGanhos(ganhoRecente, ganhoAnterior)
  const x = direcaoExibida(pct / 100)
  const reg = posicaoNaRegua(pct, 50, (ganhoRecente - ganhoAnterior) / ganhoAnterior)
  return {
    tipo: 'medido', pct, simbolo: x.simbolo, texto: x.texto, ganhoRecente, ganhoAnterior,
    foraDaEscala: reg.foraDaEscala, fracao: reg.fracao, avisoDeContagem: avisoDeContagem(m3a.janela),
  }
}

/** Quatro casas sempre presentes. `null` = a direção não carregou em nenhum canal: a casa não mostra 0. */
export interface ResumoDeDirecao {
  sobe: number | null; estavel: number | null; desce: number | null; naoMedido: number | null; naoCarregou: number
  /** Quantos canais entram na conta (o canal próprio fica de fora) e quantos têm direção medida. */
  canais: number; medidos: number; frase: string
}

const pl = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`

export function resumoDeDirecao(celulas: readonly CelulaDeDirecao[]): ResumoDeDirecao {
  let sobe = 0, estavel = 0, desce = 0, naoMedido = 0, naoCarregou = 0
  for (const c of celulas) {
    if (c.tipo === 'canal_proprio') continue
    if (c.tipo === 'nao_carregou') naoCarregou++
    else if (c.tipo === 'nao_medido') naoMedido++
    else if (c.simbolo === 'sobe') sobe++
    else if (c.simbolo === 'desce') desce++
    else estavel++
  }
  const canais = sobe + estavel + desce + naoMedido + naoCarregou
  if (canais > 0 && naoCarregou === canais) {
    // TEXTO-A-REVISAR (Logan/Naksu)
    return { sobe: null, estavel: null, desce: null, naoMedido: null, naoCarregou, canais, medidos: 0, frase: `A direção não carregou em ${pl(naoCarregou, 'canal', 'canais')}.` }
  }
  const medidos = sobe + estavel + desce
  const partes: string[] = []
  if (medidos > 0) {
    partes.push([`${sobe} subindo`, `${estavel} sem mudança`, `${desce} descendo`].join(', '))
  }
  // TEXTO-A-REVISAR (Logan/Naksu): a frase do resumo de direção não está fixada letra por letra para todos os casos
  let frase = partes.join('')
  if (medidos < canais - naoCarregou && medidos > 0) frase += `. Direção medida em ${medidos} de ${canais} canais`
  else if (medidos === 0 && canais > 0) frase = `Direção ainda não medida em ${pl(naoMedido, 'canal', 'canais')}`
  if (naoCarregou > 0) frase += `${frase ? '; ' : ''}${naoCarregou === 1 ? '1 canal não carregou' : `${naoCarregou} canais não carregaram`}`
  return { sobe, estavel, desce, naoMedido, naoCarregou, canais, medidos, frase: frase ? frase + '.' : '' }
}
