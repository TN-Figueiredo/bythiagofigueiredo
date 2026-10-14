// Fabrica o token de LEITURA nos testes pelos CAMINHOS REAIS (provarAcessoPrivado), com as guardas simuladas pelo `vi.mock` do próprio
// arquivo de teste. Não existe construtor de teste: o token só nasce depois da guarda.
// Os dois auxiliares assumem que o teste mocka `@tn-figueiredo/auth-nextjs/server` (requireSiteScope) e `@/lib/supabase/service`
// de modo que `mode: 'edit'` e `mode: 'view'` respondam como cada auxiliar precisa: eles reconfiguram o mock, se ele for um vi.fn.
import { vi } from 'vitest'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { provarLeituraPrivada, type LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'

const USUARIO = 'u-teste'

/** Pelo caminho de quem EDITA: a guarda de edição aceita. Não consulta o banco. */
export async function leituraDe(siteId: string): Promise<LeituraPrivadaDoSite> {
  vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: USUARIO } } as never)
  const l = await provarLeituraPrivada(siteId)
  if (!l) throw new Error('a guarda simulada do teste deveria deixar editar o site ' + siteId)
  return l
}

/** Pelo caminho do DIREITO: a guarda de edição nega, a de leitura aceita e a função do banco responde `true`. */
export async function leituraPorDireitoDe(siteId: string): Promise<LeituraPrivadaDoSite> {
  vi.mocked(requireSiteScope).mockImplementation((async (o: { mode: string }) =>
    o.mode === 'edit' ? { ok: false, reason: 'insufficient_access' } : { ok: true, user: { id: USUARIO } }) as never)
  vi.mocked(getSupabaseServiceClient).mockReturnValue({ rpc: async () => ({ data: true, error: null }) } as never)
  const l = await provarLeituraPrivada(siteId)
  if (!l) throw new Error('a guarda simulada do teste deveria deixar ler o site ' + siteId)
  return l
}
