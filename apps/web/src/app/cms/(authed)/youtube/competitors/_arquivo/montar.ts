import 'server-only'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Observatory } from '@/lib/youtube/observatorio'
import { lerPagina } from '@/lib/youtube/observatorio/arquivo-mensal/pagina'
import { montarPagina, modeloDesligado, modeloNaoLido, type ModeloPagina } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { montarBloco, lerCanaisRemovidos, type LeituraBloco } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { lerCapacidades } from '@/lib/youtube/observatorio/arquivo-mensal/capacidades'
import { openObservatoryPage } from '../_chrome/page-data'
import { permissoesDoSite } from '../_chrome/permissoes'
import type { ForjaView } from '../_chrome/forja-view-model'

export type ArquivoMontado =
  | { acesso: 'so_le' }
  | { acesso: 'edita' | 'administra'; obs: Observatory; forja: ForjaView | null; meuCanalLembrado: string | null; modelo: ModeloPagina; bloco: LeituraBloco }

/** O servidor da página Arquivo. A guarda de acesso vem primeiro (openObservatoryPage); depois a de edição; só então o cliente de serviço. */
export async function montarArquivo(): Promise<ArquivoMontado> {
  const pagina = await openObservatoryPage(permissoesDoSite)
  const perm = pagina.extra
  if (!perm.podeEditar) return { acesso: 'so_le' }
  const base = { acesso: perm.canUnlock ? 'administra' : 'edita', obs: pagina.obs, forja: null, meuCanalLembrado: pagina.meuCanalLembrado } as const
  if (process.env.OBS_ARQUIVO !== 'on') return { ...base, modelo: modeloDesligado(), bloco: { ok: false } }
  const sb = getSupabaseServiceClient()
  const [lida, removidos] = await Promise.all([lerPagina(sb, pagina.siteId), lerCanaisRemovidos(sb, pagina.siteId)])
  const cap = lerCapacidades()
  if (!lida.ok) {
    // o bloco lido à parte continua à vista; sem a página não há "casa" nem relógio do banco: o relógio do conjunto serve só para a idade
    const modelo = modeloNaoLido(lida.porque)
    return { ...base, modelo, bloco: removidos.ok ? { ok: true, bloco: montarBloco(removidos.lista, { agora: pagina.now, casa: modelo.casa, cap }) } : { ok: false } }
  }
  // o grupo "Dado de teste" é de quem administra (D-M5-6): para quem só edita o modelo nem o leva
  const completo = montarPagina(lida.pagina, { arquivoLigado: true })
  const modelo = perm.canUnlock ? completo : { ...completo, teste: null }
  const bloco: LeituraBloco = removidos.ok ? { ok: true, bloco: montarBloco(removidos.lista, { agora: Date.parse(lida.pagina.lido_em), casa: modelo.casa, cap }) } : { ok: false }
  return { ...base, modelo, bloco }
}
