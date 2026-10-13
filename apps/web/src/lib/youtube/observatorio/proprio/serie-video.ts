// Série de views por dia de UM vídeo próprio, do diário (yt_own_video_daily). Puro, sem banco.
// Três estados por dia, como no gráfico de impressões: com views, zero medido (a linha existe com 0) e não medido (o dia não
// tem linha, ou a linha tem views nulas). Dia sem linha NUNCA vira zero. Só entram os dias a partir da publicação.
import { addDays, diffDias } from '@/lib/youtube/coleta/day-pt'
import type { DiarioCanal, DiaYt, Privado } from './tipos'
import { DIAS_DE_VIDA_MIN, inicioDoVideo, videoNovo } from './dias'
import { DIARIO_PARADO_DIAS } from './vpd'

export const JANELA_SERIE_DIAS = 28
/** Menos que isto de vida (hoje menos o dia da publicação) e o vídeo é novo: ainda não há dia fechado. O limite mora em `dias.ts` (um só para toda tela). */
export { DIAS_DE_VIDA_MIN }

export type EstadoDiaVideo = 'com-views' | 'zero-medido' | 'nao-medido'
export type EstadoSerie = 'ok' | 'video-novo' | 'sem-acesso' | 'leitura-falhou' | 'sem-diario' | 'sem-medida'

export interface DiaDaSerie {
  dia: DiaYt
  estado: EstadoDiaVideo
  /** null só no não medido */
  views: number | null
  /** é o dia da publicação do vídeo */
  publicacao: boolean
}

export interface SerieVideo {
  estado: EstadoSerie
  /** do mais antigo ao mais novo; vazio fora do estado ok/sem-medida */
  dias: DiaDaSerie[]
  janela: { de: DiaYt; ate: DiaYt } | null
  /** o último dia gravado do canal (a série termina nele) */
  ultimoDia: DiaYt | null
  /** o diário do canal parou há mais de DIARIO_PARADO_DIAS dias */
  parado: boolean
  /** dias com linha de views (com views ou zero medido) */
  diasMedidos: number
  diaPublicacao: DiaYt | null
}

const vazia = (estado: EstadoSerie, diaPublicacao: DiaYt | null, ultimoDia: DiaYt | null = null, parado = false): SerieVideo =>
  ({ estado, dias: [], janela: null, ultimoDia, parado, diasMedidos: 0, diaPublicacao })

/**
 * `publicadoEm` = o dia da publicação (null = desconhecido); `hoje` = o dia de hoje na zona do diário. A janela são os
 * 28 dias que terminam no último dia gravado do canal, cortados no dia da publicação (os dias antes dele não existem).
 */
export function serieDoVideo(d: Privado<DiarioCanal>, a: { ytId: string; publicadoEm: DiaYt | null; hoje: DiaYt }): SerieVideo {
  if (d.acesso === 'negado') return vazia('sem-acesso', a.publicadoEm)
  if (d.acesso === 'erro') return vazia('leitura-falhou', a.publicadoEm)
  const { ultimoDia } = d.dado
  if (ultimoDia == null) return vazia('sem-diario', a.publicadoEm)
  const parado = diffDias(ultimoDia, a.hoje) > DIARIO_PARADO_DIAS
  if (videoNovo(a.publicadoEm, a.hoje)) return vazia('video-novo', a.publicadoEm, ultimoDia, parado)
  const inicioJanela = addDays(ultimoDia, -(JANELA_SERIE_DIAS - 1))
  const de = inicioDoVideo(inicioJanela, a.publicadoEm)
  if (de > ultimoDia) return vazia('sem-medida', a.publicadoEm, ultimoDia, parado)
  const porDia = new Map<DiaYt, number | null>()
  for (const l of d.dado.linhas) if (l.ytId === a.ytId && l.dia >= de && l.dia <= ultimoDia) porDia.set(l.dia, l.views)
  const dias: DiaDaSerie[] = []
  let diasMedidos = 0
  for (let dia = de; dia <= ultimoDia; dia = addDays(dia, 1)) {
    const views = porDia.get(dia) ?? null
    if (views == null) dias.push({ dia, estado: 'nao-medido', views: null, publicacao: dia === a.publicadoEm })
    else { diasMedidos++; dias.push({ dia, estado: views === 0 ? 'zero-medido' : 'com-views', views, publicacao: dia === a.publicadoEm }) }
  }
  return { estado: diasMedidos === 0 ? 'sem-medida' : 'ok', dias, janela: { de, ate: ultimoDia }, ultimoDia, parado, diasMedidos, diaPublicacao: a.publicadoEm }
}
