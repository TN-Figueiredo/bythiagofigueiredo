import type { Observatory } from '@/lib/youtube/observatorio'
import type { ObsChange } from '@/lib/youtube/observatorio/changes'
import type { Fmt, ObsVideo } from '@/lib/youtube/observatorio/types'

/** Views por dia, absoluto OU por mil inscritos (spec 19.3): zero medido é "0"; positivo que arredondaria para 0,0 é "menos de 0,1"; abaixo de 10, uma casa; de 10 a 999, inteiro; milhar depois. A lista, o painel, o cabeçalho e a comparação usam só esta função (e a posição empata pelo texto que ela escreve). */
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

/** Só a troca de título e a de thumbnail contam como "troca" nos números do canal (a de descrição não: emenda 44.2, e o dono, 11/10, para a lista de Canais). */
export const contaComoTroca = (c: Pick<ObsChange, 'type'>): boolean => c.type === 'title' || c.type === 'thumb'

/** As trocas de título e thumbnail dos últimos 30 dias, da mais recente para a mais antiga. É a base de TODA contagem de trocas em 30 dias (lista, cabeçalho, comparação). */
export function trocasDe30(obs: Pick<Observatory, 'changesIn'>, channelId: string): ObsChange[] {
  return obs.changesIn({ days: 30, channel: channelId }).filter(contaComoTroca)
}

/** Trocas de título e thumbnail nos últimos 30 dias (a troca de descrição não conta: emenda 44.2). */
export function trocas30(obs: Pick<Observatory, 'changesIn'>, channelId: string): number {
  return trocasDe30(obs, channelId).length
}

/** "k de n": os longos de até 90 dias com 2× ou mais. null = nenhum longo com múltiplo, não há de quê contar (o zero medido é "0 de n"). */
export function acima2x(S: { pctOutliersN: number; outliers90: number }): { k: number; de: number } | null {
  return S.pctOutliersN === 0 ? null : { k: S.outliers90, de: S.pctOutliersN }
}
