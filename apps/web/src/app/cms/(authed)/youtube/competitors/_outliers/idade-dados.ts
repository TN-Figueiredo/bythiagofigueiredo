/**
 * E5a T8: do conjunto das medidas do site (`carregarMedidasDoSite`) aos dados que o modelo de Outliers lê (`DadosDeIdade`). Puro: sem consulta nem relógio.
 * Canal que não carregou não entra em `m1`: o vídeo dele fica "não carregou" na tela, nunca "não medido" e nunca zero.
 */
import type { MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import type { DadosDeIdade, EntradaDeIdade } from './view-model'

export function dadosDeIdade(m: MedidasDoSite, hojeSP: string): EntradaDeIdade {
  const canais = [...m.porCanal.values()]
  // nenhum canal carregou: a leitura inteira falhou (as duas opções ficam desligadas e o aviso oferece tentar de novo)
  if (canais.length > 0 && canais.every(c => 'naoCarregou' in c)) return 'erro'
  const m1: Map<string, DadosDeIdade['m1'] extends ReadonlyMap<string, infer V> ? V : never> = new Map()
  const foraDoNormal: Map<string, { long: number; short: number }> = new Map()
  for (const [canalId, c] of m.porCanal) {
    if ('naoCarregou' in c) continue
    for (const [videoId, v] of c.porVideo) m1.set(videoId, { 7: v.m1[7], 30: v.m1[30] })
    const nota = (f: 'long' | 'short'): number => c.porFormato[f].m1[7].notas.reduce((n, x) => (x.tipo === 'ao_vivo_fora' ? n + x.n : n), 0)
    foraDoNormal.set(canalId, { long: nota('long'), short: nota('short') })
  }
  return { hojeSP, m1, videos: m.videos ?? new Map(), foraDoNormal }
}
