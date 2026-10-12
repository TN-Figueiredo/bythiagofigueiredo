// O dado privado do canal próprio como os modelos das telas o recebem: um parâmetro a mais, nunca série dentro do motor (D2).
// Puro (sem servidor, sem banco): os modelos só importam o tipo daqui. Parâmetro ausente = o dado não foi lido: o canal
// próprio fica sem número, com a frase de "a coleta diária ainda não gravou este canal" (nunca um número, nunca zero).
import type { Observatory } from '@/lib/youtube/observatorio'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'
import type { VpdCanal } from '@/lib/youtube/observatorio/proprio/vpd'

export interface ExtrasProprio {
  /** Views por dia de cada canal próprio do site (id do canal → resultado, com o motivo quando não há número). */
  vpd: ReadonlyMap<string, VpdCanal>
  /** 'AAAA-MM-DD' → "dd/mm". */
  dm: (d: DiaYt) => string
}

/** O dia do YouTube como "dd/mm". */
export const dmDia = (d: DiaYt): string => d.slice(8, 10) + '/' + d.slice(5, 7)

/** O canal que o mapa não traz vale como "não lido". */
export const SEM_LEITURA: VpdCanal = { valor: null, motivo: 'sem-diario', n: 0, janela: null, ultimoDia: null }

/** Os ytIds dos longos acompanhados de um canal, na ordem do motor (mais novo primeiro): a base das views por dia. Puro: o servidor e os modelos usam esta. */
export function longosAcompanhados(obs: Pick<Observatory, 'videos'>, canalId: string): string[] {
  return obs.videos
    .filter(v => v.ch === canalId && v.tracked && v.fmt === 'long')
    .sort((a, b) => b.pub - a.pub || (a.ytId < b.ytId ? -1 : 1))
    .map(v => v.ytId)
}
