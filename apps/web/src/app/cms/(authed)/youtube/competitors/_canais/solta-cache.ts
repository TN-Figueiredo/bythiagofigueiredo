import { revalidatePath, revalidateTag } from 'next/cache'
import { arquivoTag } from '@/lib/youtube/observatorio/arquivo-mensal/aviso-leve'
import { invalidateObservatory } from '@/lib/youtube/observatorio/cache-tag'

/**
 * Depois de qualquer chamada que muda o arquivo (sucesso, falha ou exceção) o pacote em cache de 15 min não pode sobreviver: a lista leria a linha velha.
 * Fica fora de `actions.ts` (arquivo 'use server' só exporta função assíncrona) para as ações do canal removido reusarem sem cópia.
 */
export function soltarCache(siteId: string): void {
  invalidateObservatory(siteId)
  revalidatePath('/cms/youtube/competitors', 'layout')
  revalidateTag(arquivoTag(siteId), { expire: 0 })   // o aviso do arquivo (300 s) conta canais removidos e vermelhos: não pode ficar velho depois de um comando do dono (Phil r2 R2)
}
