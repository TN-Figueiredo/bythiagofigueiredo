import { DAY } from '../time'
import { MEASURE_RULES } from './regras'
import { direcaoDe, variacoesDoCanal, type RetratoDoCanal } from './direcao'
import { medido, naoMedido, type Medida } from './tipos'

/** M8: o estado do canal. Puro. Precedência: fora do ar, pausado, parado, em queda, ativo. */
export type EstadoDoCanal = 'fora_do_ar' | 'pausado' | 'parado' | 'em_queda' | 'ativo'

export function estadoDoCanal(e: {
  missingSince: string | null
  ultimaPublicacaoMs: number | null
  intervaloMedianoDias: number | null
  retratos: readonly RetratoDoCanal[]
  hojeSP: string
  agoraMs: number
  collectionPausedAt: string | null
}): { estado: EstadoDoCanal; parado: Medida<{ dias: number; limite: number }>; queda: Medida<{ janelas: number[] }> } {
  const pausado = e.collectionPausedAt !== null
  let parado: Medida<{ dias: number; limite: number }>
  let queda: Medida<{ janelas: number[] }>
  if (pausado) {
    // Coleta parada de propósito: a falta de dado não diz nada sobre o canal.
    parado = naoMedido('coleta_pausada')
    queda = naoMedido('coleta_pausada')
  } else {
    if (e.ultimaPublicacaoMs === null) parado = naoMedido('sem_publicacao')
    else {
      const dias = Math.max(0, Math.floor((e.agoraMs - e.ultimaPublicacaoMs) / DAY))
      const limite = Math.max(MEASURE_RULES.stalled.floorDays, e.intervaloMedianoDias === null ? 0 : MEASURE_RULES.stalled.factor * e.intervaloMedianoDias)
      parado = medido({ dias, limite }, 1, { de: null, ate: null, dias })
    }
    const v = variacoesDoCanal(e.retratos, e.hojeSP, MEASURE_RULES.decline.windows)
    queda = v.estado === 'medido' ? medido({ janelas: v.valor.variacoes }, v.n, v.janela, v.notas) : v
  }
  const estaParado = parado.estado === 'medido' && parado.valor.dias > parado.valor.limite
  const emQueda = queda.estado === 'medido' && queda.valor.janelas.length > 0 && queda.valor.janelas.every(x => direcaoDe(x) === 'descendo')
  const estado: EstadoDoCanal = e.missingSince !== null ? 'fora_do_ar' : pausado ? 'pausado' : estaParado ? 'parado' : emQueda ? 'em_queda' : 'ativo'
  return { estado, parado, queda }
}
