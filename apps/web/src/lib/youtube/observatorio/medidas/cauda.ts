import { DAY, spDateOf } from '../time'
import { MEASURE_RULES } from './regras'
import { medido, naoMedido, type Medida } from './tipos'
import { viewsNoInstante, type Leitura, type ValorM1 } from './m1'

/** M9: quanto das views do vídeo veio depois dos 30 dias, e se ainda rende. Puro. */
export function caudaDoVideo(e: {
  v30: Medida<ValorM1>; viewsHoje: number | null; idadeDias: number; leituras?: Leitura[]; agoraMs: number
}): { cauda: Medida<number>; aindaRende: Medida<number> } {
  const falha = (m: Medida<never>) => ({ cauda: m, aindaRende: m })
  if (e.idadeDias < MEASURE_RULES.tail.minAgeDays) return falha(naoMedido('idade_menor_que_90'))
  if (e.v30.estado !== 'medido') return falha(naoMedido('sem_v30'))
  if (e.viewsHoje === null || !Number.isFinite(e.viewsHoje)) return falha(naoMedido('sem_leitura'))
  const v30 = e.v30.valor.views
  const hoje = e.viewsHoje
  const janela = { de: spDateOf(e.agoraMs - MEASURE_RULES.tail.stillDays * DAY), ate: spDateOf(e.agoraMs), dias: MEASURE_RULES.tail.stillDays }

  let cauda: Medida<number>
  if (hoje === 0) cauda = naoMedido('base_zero')
  else if (hoje < v30) cauda = naoMedido('contagem_recuou')
  else cauda = medido((hoje - v30) / hoje, 1, { de: null, ate: spDateOf(e.agoraMs), dias: e.idadeDias })

  let aindaRende: Medida<number>
  if (v30 === 0) aindaRende = naoMedido('base_zero')
  else if (!e.leituras) aindaRende = naoMedido('serie_nao_pedida')
  else {
    const ponta = viewsNoInstante(e.leituras, e.agoraMs - MEASURE_RULES.tail.stillDays * DAY, { maxGapHoras: MEASURE_RULES.weeklyGapHours })
    if (!('medido' in ponta)) aindaRende = naoMedido('serie_diaria_incompleta')
    else if (hoje < ponta.medido.views) aindaRende = naoMedido('contagem_recuou')
    else aindaRende = medido((hoje - ponta.medido.views) / v30, 1, janela)
  }
  return { cauda, aindaRende }
}
