import 'server-only'
/**
 * A4 R4 T11: a leitura dos lugares com dados para `definicoes`. Fica fora de `_acesso-ia/` e `_contexto-ia/` porque só `registrar-acesso.ts` pode
 * abrir o cliente de serviço lá (mesmo molde de `_sugestoes/dados.ts`). O site vem da guarda (sessão) ou da prova da chave (`doSite`), nunca de parâmetro.
 */
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ABRIDOR_DE_SESSAO, type Abridor } from '../_chrome/abridor'
import { contagemPorLugar, estadoDoLugar, lerMapaDeLugares } from '@/lib/youtube/observatorio/lugar/leitura'
import { calculoLigadoNoAmbiente, lerEstadoDaAba } from '@/lib/youtube/observatorio/sinais/leitura'

/** `sem_sessao` e leitura que falha viram `falhou`; lugares nunca calculados (ou tarefa desligada) viram `sem_calculo`: nenhum dos dois é lista vazia muda. */
export type LugaresParaDefinicoes =
  | { estado: 'ok'; lugares: Array<{ slug: string; n: number }> }
  | { estado: 'sem_calculo' }
  | { estado: 'falhou' }

async function ler(siteId: string, agora: number): Promise<LugaresParaDefinicoes> {
  const db = getSupabaseServiceClient()
  const estadoDaAba = await lerEstadoDaAba(db, siteId, new Date(agora))
  const estado = estadoDoLugar(estadoDaAba, calculoLigadoNoAmbiente())
  if (estado === 'falhou') return { estado: 'falhou' }
  if (estado === 'nunca' || estado === 'desligado') return { estado: 'sem_calculo' }
  const mapa = await lerMapaDeLugares(db, siteId, estadoDaAba?.computado_em ?? null)
  return { estado: 'ok', lugares: contagemPorLugar(mapa) }
}

export async function lugaresParaDefinicoes(agora: number, abrir: Abridor = ABRIDOR_DE_SESSAO): Promise<LugaresParaDefinicoes> {
  try {
    if (abrir !== ABRIDOR_DE_SESSAO) {
      if (!abrir.doSite) return { estado: 'falhou' }
      return await abrir.doSite((siteId) => ler(siteId, agora))
    }
    const { siteId } = await getSiteContext()
    const guarda = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
    if (!guarda.ok) return { estado: 'falhou' }
    return await ler(siteId, agora)
  } catch { return { estado: 'falhou' } }
}
