// Fabrica o token de LEITURA nos testes pelos CAMINHOS REAIS (provarAcessoPrivado), com as guardas simuladas pelo `vi.mock` do próprio
// arquivo de teste. Não existe construtor de teste: o token só nasce depois da guarda.
import { vi } from 'vitest'
import { provarLeituraPrivada, type LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'

const USUARIO = 'u-teste'

/** Pelo caminho de quem EDITA: a guarda de edição simulada pelo teste aceita. Não consulta o banco. */
export async function leituraDe(siteId: string): Promise<LeituraPrivadaDoSite> {
  const l = await provarLeituraPrivada(siteId)
  if (!l) throw new Error('a guarda simulada do teste deveria deixar editar o site ' + siteId)
  return l
}

/**
 * Pelo caminho do DIREITO: a guarda de edição nega, a de leitura aceita e a função do banco responde `true`.
 * O arquivo de teste precisa mockar `@tn-figueiredo/auth-nextjs/server` (`requireSiteScope`) e `@/lib/supabase/service`
 * (`getSupabaseServiceClient`) como `vi.fn`. As respostas valem para UMA prova (`Once`): o mock volta ao que o teste configurou.
 */
export async function leituraPorDireitoDe(siteId: string): Promise<LeituraPrivadaDoSite> {
  const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
  const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
  vi.mocked(requireSiteScope)
    .mockImplementationOnce((async () => ({ ok: false, reason: 'insufficient_access' })) as never)
    .mockImplementationOnce((async () => ({ ok: true, user: { id: USUARIO } })) as never)
  vi.mocked(getSupabaseServiceClient).mockReturnValueOnce({ rpc: async () => ({ data: true, error: null }) } as never)
  const l = await provarLeituraPrivada(siteId)
  if (!l) throw new Error('a guarda simulada do teste deveria deixar ler o site ' + siteId)
  return l
}
