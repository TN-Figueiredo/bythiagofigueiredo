import { RULES } from '../rules'
import { MEASURE_RULES } from './regras'
import { medido, naoMedido, type Medida } from './tipos'

/**
 * M10: pico sem cauda. Leitura, não número: um indício. Nunca nota, nunca percentual, nunca a palavra "retenção".
 * O texto abaixo é o do spec (04, logo abaixo da tabela das medidas), letra por letra, e entra no corpo de toda tela que mostrar a leitura.
 */
export const TEXTO_OBRIGATORIO_M10 =
  'Indício, não medição. Este vídeo teve muitas views nos primeiros 30 dias, quase nenhuma depois, e pouca reação do público (curtidas e comentários). Isso costuma acontecer quando o YouTube para de recomendar um vídeo; essa é uma hipótese nossa sobre como a recomendação funciona, não um dado. O YouTube não mostra a ninguém de fora quanto tempo as pessoas assistiram ao vídeo de outro canal.'
export const NOME_INTERNO_M10 = 'pico_sem_cauda'

export interface EntradaPico {
  wasLive: boolean | null
  idadeDias: number
  v30: number | null
  cauda: number | null
  aindaRende: number | null
  reacao: { taxa: number; componente: 'os_dois' | 'so_curtidas' | 'so_comentarios' } | null
  canal: { nElegiveis: number; medianaV30: number | null; medianaCauda: number | null; medianaReacao: number | null }
}

export interface ValorPico {
  leitura: 'pico_sem_cauda' | 'nao_e_o_caso'
  condicoes: { muitasViewsCedo: boolean; quaseNadaDepois: boolean; poucaReacao: boolean }
  /** Os números usados: três do vídeo (e a taxa de reação) contra as três medianas do canal. */
  numeros: {
    v30: number; medianaV30: number
    cauda: number; medianaCauda: number; aindaRende: number
    reacao: number; medianaReacao: number
  }
}

export function picoSemCauda(e: EntradaPico): Medida<ValorPico> {
  const r = MEASURE_RULES.peak
  if (e.wasLive === true) return naoMedido('ao_vivo_ou_estreia')
  if (e.idadeDias < MEASURE_RULES.tail.minAgeDays) return naoMedido('idade_menor_que_90')
  if (e.v30 === null) return naoMedido('sem_v30')
  if (e.v30 < r.minV30) return naoMedido('poucas_views')
  if (e.canal.nElegiveis < RULES.medianMinN) return naoMedido('poucos_videos', { n: e.canal.nElegiveis, minimo: RULES.medianMinN })
  if (e.reacao === null) return naoMedido('sem_reacao_publica')
  const { medianaV30, medianaCauda, medianaReacao } = e.canal
  if (!medianaV30 || !medianaCauda || !medianaReacao) return naoMedido('base_zero')
  if (e.cauda === null || e.aindaRende === null) return naoMedido('serie_diaria_incompleta')

  const condicoes = {
    muitasViewsCedo: e.v30 >= RULES.outlierMin * medianaV30,
    quaseNadaDepois: e.cauda <= r.tailShare * medianaCauda && e.aindaRende <= r.stillMax,
    poucaReacao: e.reacao.taxa <= r.reactionShare * medianaReacao,
  }
  const todas = condicoes.muitasViewsCedo && condicoes.quaseNadaDepois && condicoes.poucaReacao
  return medido(
    {
      leitura: todas ? 'pico_sem_cauda' as const : 'nao_e_o_caso' as const,
      condicoes,
      numeros: { v30: e.v30, medianaV30, cauda: e.cauda, medianaCauda, aindaRende: e.aindaRende, reacao: e.reacao.taxa, medianaReacao },
    },
    e.canal.nElegiveis,
    { de: null, ate: null, dias: MEASURE_RULES.tail.minAgeDays },
  )
}
