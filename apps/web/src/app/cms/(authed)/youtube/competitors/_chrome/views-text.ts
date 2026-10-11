/**
 * O motivo de um vídeo sem contagem de views, dito igual em Canais e na página do canal ("sem contagem: <motivo>").
 * Pura: recebe o canal e o formatador de data.
 */
import type { ObsChannel } from '@/lib/youtube/observatorio/types'

export function viewsMissingText(c: ObsChannel, dmhm: (t: number) => string): string {
  const since = (t: number | null) => (t == null ? '' : ' desde ' + dmhm(t))
  const why = c.sync.state === 'erro' ? 'sincronização do canal com erro' + since(c.sync.errorSince ?? c.sync.last)
    : c.sync.state === 'atrasado' ? 'sincronização do canal atrasada' + since(c.sync.last) : 'sem registro diário ainda'
  return `sem contagem: ${why}`
}
