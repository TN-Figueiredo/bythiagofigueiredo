import 'server-only'
import { arquivoNoChrome } from '../_chrome/arquivo-do-chrome'
import { sinalDoVerificador } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

/**
 * O batimento (ms) da conferência do B2 (conferir_b2), o programa que verifica. É o que separa "a verificação rodou depois da marca e não achou a mudança"
 * (marca refutada) de "a verificação não rodou" (marca atrasada). Usa o aviso leve que o chrome já lê (cache de 300 s).
 * `undefined` = aviso não lido ou desligado: não se sabe se foi verificado, e a tela fica neutra (nunca culpa a forja); `null` = lido e sem batimento.
 */
export async function forjaVerificouEm(siteId: string): Promise<number | null | undefined> {
  try {
    const arq = await arquivoNoChrome(siteId)
    return arq.aviso.ok ? sinalDoVerificador(arq.aviso.leve.casa) : undefined
  } catch {
    return undefined
  }
}
