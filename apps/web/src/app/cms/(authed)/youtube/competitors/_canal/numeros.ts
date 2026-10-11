import type { Observatory } from '@/lib/youtube/observatorio'
import type { Fmt, ObsVideo } from '@/lib/youtube/observatorio/types'

/** Views por dia (spec 19.3): zero medido é "0"; abaixo de 10, uma casa; de 10 a 999, inteiro; milhar depois. */
export function vpdText(v: number | null, num: (n: number) => string): string | null {
  if (v == null || v < 0) return null
  if (v === 0) return '0'
  if (v < 0.05) return 'menos de 0,1'
  const r1 = Math.round(v * 10) / 10
  if (r1 < 10) return r1.toFixed(1).replace('.', ',')
  return v < 1000 ? String(Math.round(v)) : num(v)
}

/**
 * Contas que o cabeçalho do canal e a comparação entre dois canais dividem: o mesmo canal mostra o mesmo número nas duas
 * telas. Cada uma devolve o número e a contagem que o sustenta; quem chama escolhe a frase e o que fazer sem dado.
 */
type V = Pick<ObsVideo, 'tracked' | 'fmt' | 'views' | 'dur'>

/** Duração em mm:ss, ou h:mm:ss a partir de uma hora. */
export function durText(sec: number): string {
  const s = Math.round(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  const p2 = (n: number) => (n < 10 ? '0' : '') + n
  return h ? `${h}:${p2(m)}:${p2(r)}` : `${p2(m)}:${p2(r)}`
}

/** Mediana de views dos vídeos acompanhados do formato; quem não tem contagem de views fica de fora (nunca entra como 0). */
export function viewsMediana(obs: Pick<Observatory, 'median'>, vids: readonly V[], f: Fmt): { median: number | null; n: number } {
  const xs = vids.filter(v => v.tracked && v.fmt === f).map(v => v.views).filter((x): x is number => x != null)
  return { median: obs.median(xs), n: xs.length }
}

/** Mediana de duração dos longos acompanhados; quem não tem duração guardada fica de fora. */
export function duracaoMediana(obs: Pick<Observatory, 'median'>, vids: readonly V[]): { median: number | null; n: number } {
  const xs = vids.filter(v => v.tracked && v.fmt === 'long').map(v => v.dur).filter((d): d is number => d != null)
  return { median: obs.median(xs), n: xs.length }
}

/** Trocas de título e thumbnail nos últimos 30 dias (a troca de descrição não conta: emenda 44.2). */
export function trocas30(obs: Pick<Observatory, 'changesIn'>, channelId: string): number {
  return obs.changesIn({ days: 30, channel: channelId }).filter(c => c.type === 'title' || c.type === 'thumb').length
}

/** "k de n": os longos de até 90 dias com 2× ou mais. null = nenhum longo com múltiplo, não há de quê contar (o zero medido é "0 de n"). */
export function acima2x(S: { pctOutliersN: number; outliers90: number }): { k: number; de: number } | null {
  return S.pctOutliersN === 0 ? null : { k: S.outliers90, de: S.pctOutliersN }
}
