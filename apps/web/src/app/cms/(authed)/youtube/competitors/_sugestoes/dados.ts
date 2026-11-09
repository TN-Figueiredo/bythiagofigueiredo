import 'server-only'
/**
 * F2 T8: a leitura do empacotador `sugestoes`. O site e o cliente vêm da GUARDA (editor do site, como a leitura sensível de `niche_signals`),
 * nunca de parâmetro da ação (Phil). Sem acesso devolve `null` ("não encontrado"). Fica fora de `_contexto-ia/` porque só `registrar-acesso.ts`
 * pode abrir o cliente de serviço naquela pasta (mesmo molde de `_saiu/dados.ts`).
 */
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ABRIDOR_DE_SESSAO, type Abridor } from '../_chrome/abridor'
import { acessoDoEditor } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { calculoLigadoNoAmbiente, listarSinaisDoNicho, type ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'

export async function abrirSugestoes(agora: Date, limite: number, abrir: Abridor = ABRIDOR_DE_SESSAO): Promise<ListaDeSinais | null> {
  if (abrir !== ABRIDOR_DE_SESSAO) {
    // Pela chave (E17 d2, M-2): o site é o da PROVA, que o abridor repassa a `extra`; sem guarda de sessão. O acesso privado é o da chave (`edita` sempre falso).
    const { extra } = await abrir.observatorio(async (siteId) => {
      const acesso = await abrir.acessoPrivado(siteId)
      return listarSinaisDoNicho(getSupabaseServiceClient(), siteId, agora, limite, calculoLigadoNoAmbiente(), { ...acesso, edita: false })
    })
    return extra
  }
  const { siteId } = await getSiteContext()
  const guarda = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!guarda.ok) return null
  return listarSinaisDoNicho(getSupabaseServiceClient(), siteId, agora, limite, calculoLigadoNoAmbiente(), await acessoDoEditor(siteId))
}
