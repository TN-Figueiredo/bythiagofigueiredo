/**
 * O vídeo do canal próprio (`ProprioVideoView`) tem os campos do alcance; o do concorrente não. Quem desenha o cartão, a linha da Lista e o menu
 * decide pelo DADO (e não por uma prop solta que pode ficar fora de sincronia com ele): um cartão de concorrente nunca ganha a coluna de impressões.
 * Mesma regra de `lista.ts` (`'imp' in v`). Só tipos: importável de componente cliente.
 */
import type { ChannelVideoView } from '../_canal/videos-model'
import type { ProprioVideoView } from './videos-model'

export function ehProprio(v: ChannelVideoView): v is ProprioVideoView {
  return 'imp' in v && 'cliquesMissing' in v
}
