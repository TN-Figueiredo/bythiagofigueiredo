// Fixtures das telas de medidas da página do canal (E5a, Tarefas 15 a 18). Só dado: nenhuma regra mora aqui.
import type { MedidasDoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { ValorAcerto } from '@/lib/youtube/observatorio/medidas/acerto'
import type { ValorDirecaoCanal } from '@/lib/youtube/observatorio/medidas/direcao'
import type { ValorRitmo } from '@/lib/youtube/observatorio/medidas/ritmo'
import type { EstadoDoCanal } from '@/lib/youtube/observatorio/medidas/estado-canal'
import { medido, naoMedido, type Medida, type Nota } from '@/lib/youtube/observatorio/medidas/tipos'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'

export const HOJE = '2026-10-17'
export const AGORA = Date.parse('2026-10-17T15:00:00Z')
export const J = { de: null, ate: null, dias: 28 }

export function m3a(recente: number, anterior: number, janela = J): Medida<ValorDirecaoCanal> {
  const variacao = recente / anterior - 1
  const direcao = variacao >= 0.1 ? 'subindo' : variacao <= -0.1 ? 'descendo' : 'estavel'
  return medido({ variacao, direcao, ganhoRecente: recente, ganhoAnterior: anterior } as unknown as ValorDirecaoCanal, 56, janela)
}
export function acerto(k: number, total: number, fracassos = 0): Medida<ValorAcerto> {
  return medido({ acertos: k, fracassos, total, pctAcerto: total >= 10 ? k / total : null, pctFracasso: total >= 10 ? fracassos / total : null }, total, J)
}
export function ritmo(porSemana: number, comPub: number, o: { semanas?: number; dias?: number; notas?: Nota[] } = {}): Medida<ValorRitmo> {
  const semanas = o.semanas ?? 13, dias = o.dias ?? 91
  return medido({ porSemana, intervaloMedianoDias: 4, semanasComPublicacao: comPub, semanas, semanasContadas: dias / 7, dias, maiorBuracoDias: 20 }, 13, J, o.notas ?? [])
}
export function m8(estado: EstadoDoCanal, extra: { dias?: number; limite?: number; ultimaEm?: number; queda?: number[] } = {}): MedidasDoCanal['m8'] {
  return {
    estado: medido(estado, 1, J),
    parado: medido({ dias: extra.dias ?? 3, limite: extra.limite ?? 28, ultimaEm: extra.ultimaEm ?? AGORA - 3 * 86_400_000 }, 1, J),
    queda: extra.queda ? medido({ janelas: extra.queda }, 4, J) : naoMedido('pouco_registro'),
  } as MedidasDoCanal['m8']
}

export function medidasFalsas(o: {
  m3a?: Medida<ValorDirecaoCanal>; m8?: MedidasDoCanal['m8']
  m4?: Medida<ValorAcerto>; m6?: Medida<ValorRitmo>
}): MedidasDoCanal {
  const fmt = { m4: o.m4 ?? acerto(3, 20), m6: o.m6 ?? ritmo(1.7, 11) }
  return {
    m3a: o.m3a ?? m3a(118, 100),
    m8: o.m8 ?? m8('ativo'),
    porFormato: { long: { ...fmt, m3b: naoMedido('poucos_videos'), m3c: naoMedido('poucos_videos') }, short: fmt },
    porVideo: new Map(),
    falhas: [],
  } as unknown as MedidasDoCanal
}

export function videoLido(id: string, o: Partial<VideoLido> = {}): VideoLido {
  return {
    id, videoId: id, publishedAt: '2026-10-01T12:00:00Z', liveActualStartAt: null, liveBroadcastContent: null, wasLive: false, isShort: false,
    durationSeconds: 600, viewCount: 1000, likeCount: 10, commentCount: 1, likesHidden: false, commentsDisabled: false, viewsHidden: false,
    discoveredAt: '2026-10-01T13:00:00Z', missingSince: null, seriesTier: 'diaria', lastCheckedAt: null, ...o,
  }
}
