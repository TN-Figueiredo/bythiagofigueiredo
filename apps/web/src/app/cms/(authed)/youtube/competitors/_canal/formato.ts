/**
 * Formatação de texto que a lista de vídeos e os modelos do canal próprio dividem. Folha: não importa nenhum modelo (H21: o modelo
 * das réguas importava a lista inteira de vídeos só por estas duas funções).
 */
import type { Fmt } from '@/lib/youtube/observatorio/fmt'

/** O espaço que não quebra linha: a única definição (a lista de canais e a de vídeos importam daqui). */
export const NB = '\u00A0'

/** Duração em mm:ss, ou h:mm:ss a partir de uma hora; nula continua nula. */
export function durText(sec: number | null): string | null {
  if (sec == null) return null
  const s = Math.round(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  const p2 = (n: number) => (n < 10 ? '0' : '') + n
  return h ? `${h}:${p2(m)}:${p2(r)}` : `${p2(m)}:${p2(r)}`
}

/** Troca o espaço antes de "mil"/"mi" no fim de um número já formatado por espaço sem quebra. */
export const nbMilMi = (s: string): string => s.replace(/ (mil|mi)$/, NB + '$1')

/** O número como o cartão e a faixa do vídeo o escrevem: o espaço antes de "mil"/"mi" não quebra linha. */
export const numNb = (F: Pick<Fmt, 'num'>, n: number | null): string => nbMilMi(F.num(n))
