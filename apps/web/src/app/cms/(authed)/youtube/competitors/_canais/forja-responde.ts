import 'server-only'
import { arquivoNoChrome } from '../_chrome/arquivo-do-chrome'
import { casaDe } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'

/**
 * A casa (copiador e NAS) responde agora? É o que separa "a verificação rodou e não achou a mudança" (marca refutada) de "a verificação não rodou" (marca atrasada).
 * Usa o aviso leve que o chrome já lê (cache de 300 s). Qualquer dúvida (aviso não lido, desligado) = `false`: nunca se diz "refutado" sem saber que a forja olhou.
 */
export async function forjaResponde(siteId: string, agora: number): Promise<boolean> {
  try {
    const arq = await arquivoNoChrome(siteId)
    return arq.aviso.ok && casaDe(arq.aviso.leve.casa, [], agora).estado === 'responde'
  } catch {
    return false
  }
}
