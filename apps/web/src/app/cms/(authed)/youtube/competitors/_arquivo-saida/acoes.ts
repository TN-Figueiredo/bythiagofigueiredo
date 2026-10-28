// apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes.ts
'use server'
import { revalidatePath } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { denyUnlessSiteAdmin, requireSiteAdminScope, siteAdminOnlyMessage } from '@/lib/cms/auth-guards'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ChamadaSaida, TABELAS_DA_SAIDA, executarLiberar, executarSaida, executarTrazer, lerEstadoDoMes, type RespostaSaida } from '@/lib/youtube/observatorio/arquivo-mensal/saida'

type Retorno = { ok: boolean; error?: string; resposta?: RespostaSaida }
const NAO_LEU = 'Não foi possível ler o estado deste mês. Nada foi tirado.'
const SOMENTE_LEITURA = 'O banco passou do limite e está em modo somente leitura. Siga o passo de emergência.'
const SEM_RESPOSTA = 'Não foi possível confirmar se o mês saiu. Recarregue a página antes de tentar de novo.'
const PAGINA = '/cms/youtube/competitors'

/** O guarda no TOPO (antes do cliente de serviço) e o id de quem age vem da sessão, nunca do formulário. */
async function quem(acao: string): Promise<{ site: string; por: string } | { negado: Retorno }> {
  const { siteId } = await getSiteContext()
  const negado = await denyUnlessSiteAdmin(siteId, acao)
  if (negado) return { negado }
  const s = await requireSiteAdminScope(siteId)
  if (!s.ok) return { negado: { ok: false, error: siteAdminOnlyMessage(acao) } }
  return { site: siteId, por: s.user.id }
}
function fechar(r: RespostaSaida): Retorno {
  if (r.tipo === 'falhou') return { ok: false, error: r.causa === 'somente_leitura' ? SOMENTE_LEITURA : r.causa === 'prazo' ? SEM_RESPOSTA : NAO_LEU }
  if (r.tipo === 'ok') revalidatePath(PAGINA, 'layout')
  return { ok: true, resposta: r }
}
async function tirarOuSimular(tabela: string, mes: string, simular: boolean): Promise<Retorno> {
  const q = await quem('tirar um mês do banco online')
  if ('negado' in q) return q.negado
  const p = ChamadaSaida.safeParse({ tabela, mes })
  if (!p.success) return { ok: false, error: NAO_LEU }
  const sb = getSupabaseServiceClient()
  const est = await lerEstadoDoMes(sb, q.site, p.data.tabela, p.data.mes, q.por)
  // m-8: segundo clique num mês que já saiu das telas (ou foi descartado) não é "não foi possível ler": é o estado real
  if (est && est.estado === 'destacado') return { ok: true, resposta: { tipo: 'recusado', codigo: 'ja_destacado', faltam: [] } }
  if (est && est.estado === 'descartado') return { ok: true, resposta: { tipo: 'recusado', codigo: 'ja_descartado', faltam: [] } }
  if (!est || est.estado !== 'online') return { ok: false, error: NAO_LEU }
  const r = await executarSaida(sb, { site: q.site, tabela: p.data.tabela, mes: p.data.mes, por: q.por, simular, doisPassos: est.dois_passos })
  const classe = TABELAS_DA_SAIDA[p.data.tabela]
  if (simular && r.tipo === 'simulado' && classe !== 'ensaio') {
    // contar a simulação vista nunca derruba a resposta da simulação
    await Promise.resolve(sb.rpc('obs_archive_switch_sim_seen', { p_site: q.site, p_class: classe, p_by: q.por }).abortSignal(AbortSignal.timeout(3_000))).catch(() => undefined)
  }
  return fechar(r)
}
export async function simularSaida(tabela: string, mes: string): Promise<Retorno> { return tirarOuSimular(tabela, mes, true) }
export async function tirarMes(tabela: string, mes: string): Promise<Retorno> { return tirarOuSimular(tabela, mes, false) }

export async function liberarEspaco(tabela: string, mes: string): Promise<Retorno> {
  const q = await quem('liberar o espaço de um mês')
  if ('negado' in q) return q.negado
  const p = ChamadaSaida.safeParse({ tabela, mes })
  if (!p.success) return { ok: false, error: NAO_LEU }
  return fechar(await executarLiberar(getSupabaseServiceClient(), { site: q.site, tabela: p.data.tabela, mes: p.data.mes, por: q.por, simular: false }))
}
export async function trazerDeVolta(tabela: string, mes: string): Promise<Retorno> {
  const q = await quem('trazer um mês de volta ao banco online')
  if ('negado' in q) return q.negado
  const p = ChamadaSaida.safeParse({ tabela, mes })
  if (!p.success) return { ok: false, error: NAO_LEU }
  return fechar(await executarTrazer(getSupabaseServiceClient(), { site: q.site, tabela: p.data.tabela, mes: p.data.mes, por: q.por }))
}
