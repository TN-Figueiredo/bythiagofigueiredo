// A5 · E17 degrau 1, Tarefa 9: o registro do botão "Perguntar a uma IA" em `obs_ai_access_log` (origem `botao`, sem `key_id`).
// O ÚNICO arquivo de `contexto-ia/` que não é puro: cria o cliente de serviço aqui, só aqui, e nunca lança.
// `params` é montado por quem chama a partir de uma lista fechada (a ação); a pergunta, a consulta crua e títulos nunca chegam aqui.
// O prazo corta a CHAMADA (`abortSignal`), não só a espera: o `insert` não segue vivo depois de a ação já ter respondido `registro_falhou`.
// O código `tempo` é decidido por `sinal.aborted`, não pelo formato do erro que o cliente devolve numa chamada abortada (não medido).
import 'server-only'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { TelaId } from './tipos'

export type ParamsDoRegistro = Record<string, string | number | boolean | string[]>

export interface LinhaDoBotao {
  siteId: string
  userId: string
  tela: TelaId
  params: ParamsDoRegistro
  incluiuPrivado: boolean
  caracteres: number
}

const PRAZO_PADRAO_MS = 5_000

export async function registrarAcesso(
  l: LinhaDoBotao,
  opcoes?: { prazoMs?: number },
): Promise<{ ok: true } | { ok: false; code: string }> {
  const sinal = AbortSignal.timeout(opcoes?.prazoMs ?? PRAZO_PADRAO_MS)
  try {
    const { error } = await getSupabaseServiceClient()
      .from('obs_ai_access_log')
      .insert({
        site_id: l.siteId,
        user_id: l.userId,
        origin: 'botao',
        action: `pacote:${l.tela}`,
        params: { ...l.params, ambiente: process.env.VERCEL_ENV ?? 'local' },
        included_private: l.incluiuPrivado,
        output_chars: l.caracteres,
        result: 'ok',
      })
      .abortSignal(sinal)
    if (!error) return { ok: true }
    if (sinal.aborted) return { ok: false, code: 'tempo' }
    const code = (error as { code?: unknown }).code
    return { ok: false, code: typeof code === 'string' && code !== '' ? code : 'desconhecido' }
  } catch {
    return { ok: false, code: sinal.aborted ? 'tempo' : 'excecao' }
  }
}
