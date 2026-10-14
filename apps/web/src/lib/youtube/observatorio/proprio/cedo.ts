// "Ainda cedo" (plano E5b, Tarefa 13; lote 1, tela A). Puro: o dia de hoje entra por parâmetro (o dia do YouTube, `dayPt`).
// Regra de conta do LEIAME do lote 1: idade = dias de calendário da publicação até hoje. Dias que faltam = 6 - idade.
// Sem relatório de alcance não se afirma "todos com 0": o resultado é `nao-medido`.
import { addDays, diffDias } from '@/lib/youtube/coleta/day-pt'
import { DIAS_DE_VIDA_MIN, type DiaAlcance } from './dias'
import type { DiaYt } from './tipos'

/** A faixa tem 7 casas: do dia da publicação (dia 1) ao dia 7 (publicação + 6). */
export const CASAS = 7
/** Idade a partir da qual o gráfico volta (o dia 7 é a idade 6). */
const IDADE_DO_GRAFICO = CASAS - 1

export interface Casa {
  dia: DiaYt
  estado: 'zero-medido' | 'com-impressoes' | 'dia-nao-chegou' | 'ainda-nao-existe'
  /** as impressões do dia quando medido (0 é medida); nulo nas outras casas */
  valor: number | null
}

export type EstadoCedo =
  | { tipo: 'video-novo'; casas: Casa[]; dia7: DiaYt; faltam: number }
  | { tipo: 'ainda-cedo'; casas: Casa[]; dia7: DiaYt; faltam: number; diasMedidos: number }
  | { tipo: 'grafico'; soZeros: boolean; diasMedidos: number }
  | { tipo: 'nao-medido' }

export function estadoCedo(p: { publicadoEm: DiaYt | null; hojePt: DiaYt; dias: readonly DiaAlcance[] }): EstadoCedo {
  const { publicadoEm, hojePt } = p
  if (publicadoEm == null) return { tipo: 'nao-medido' }
  const idade = diffDias(publicadoEm, hojePt)
  if (idade < 0) return { tipo: 'nao-medido' }
  // só os dias que existem para o vídeo: da publicação até hoje
  const doVideo = new Map<DiaYt, DiaAlcance>()
  for (const x of p.dias) if (x.dia >= publicadoEm && x.dia <= hojePt) doVideo.set(x.dia, x)
  const medidos = [...doVideo.values()].filter(x => x.situacao !== 'nao-medido' && x.imp != null)
  const diasMedidos = medidos.length
  const dia7 = addDays(publicadoEm, CASAS - 1)
  const faltam = Math.max(0, IDADE_DO_GRAFICO - idade)
  const casas = (): Casa[] => Array.from({ length: CASAS }, (_, i): Casa => {
    const dia = addDays(publicadoEm, i)
    if (dia > hojePt) return { dia, estado: 'ainda-nao-existe', valor: null }
    const x = doVideo.get(dia)
    if (x == null || x.situacao === 'nao-medido' || x.imp == null) return { dia, estado: 'dia-nao-chegou', valor: null }
    return { dia, estado: x.imp === 0 ? 'zero-medido' : 'com-impressoes', valor: x.imp }
  })

  if (idade < DIAS_DE_VIDA_MIN) return { tipo: 'video-novo', casas: casas(), dia7, faltam }
  if (diasMedidos === 0) return { tipo: 'nao-medido' }
  const soZeros = medidos.every(x => x.imp === 0)
  if (idade < IDADE_DO_GRAFICO && soZeros) return { tipo: 'ainda-cedo', casas: casas(), dia7, faltam, diasMedidos }
  return { tipo: 'grafico', soZeros, diasMedidos }
}
