// apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes.ts
'use server'
import { revalidatePath } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteAdminScope, siteAdminOnlyMessage } from '@/lib/cms/auth-guards'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { FRASE_NAO_LEU_O_MES, fraseDaFalha, type Operacao, type RetornoDaAcao } from '@/lib/youtube/observatorio/arquivo-mensal/frases-saida'
import { ChamadaSaida, PRAZO_TOTAL_MS, TABELAS_DA_SAIDA, executarLiberar, executarSaida, executarTrazer, lerEstadoDoMes, type RespostaSaida } from '@/lib/youtube/observatorio/arquivo-mensal/saida'

type Retorno = RetornoDaAcao
const PAGINA = '/cms/youtube/competitors'
const naoLeu = (_op: Operacao): string => FRASE_NAO_LEU_O_MES   // leitura do estado, não escrita (Logan U3)

/** O guarda no TOPO (antes do cliente de serviço), UMA vez só (Yannis M-2); o id de quem age vem da sessão, nunca do formulário. */
async function quem(acao: string): Promise<{ site: string; por: string } | { negado: Retorno }> {
  const { siteId } = await getSiteContext()
  const s = await requireSiteAdminScope(siteId)
  if (!s.ok) return { negado: { ok: false, error: siteAdminOnlyMessage(acao) } }
  return { site: siteId, por: s.user.id }
}
function fechar(r: RespostaSaida, op: Operacao): Retorno {
  // a `causa` (e `restantes`, quando vier) chega à tela: ela monta a frase por ação; o `error` é o mesmo texto, para quem só lê o erro
  if (r.tipo === 'falhou') return { ok: false, error: fraseDaFalha(r.causa, op, r.restantes), causa: r.causa, ...(r.restantes === undefined ? {} : { restantes: r.restantes }) }
  if (r.tipo === 'ok') revalidatePath(PAGINA, 'layout')
  return { ok: true, resposta: r }
}
async function tirarOuSimular(tabela: string, mes: string, simular: boolean): Promise<Retorno> {
  const ate = Date.now() + PRAZO_TOTAL_MS   // o relógio único da ação, antes de qualquer ida à rede
  const q = await quem('esconder um mês das telas')
  if ('negado' in q) return q.negado
  const p = ChamadaSaida.safeParse({ tabela, mes })
  if (!p.success) return { ok: false, error: naoLeu('tirar') }
  const sb = getSupabaseServiceClient()
  const est = await lerEstadoDoMes(sb, q.site, p.data.tabela, p.data.mes, q.por)
  // m-8: segundo clique num mês que já saiu das telas (ou foi descartado) não é "não foi possível ler": é o estado real
  if (est && est.estado === 'destacado') return { ok: true, resposta: { tipo: 'recusado', codigo: 'ja_destacado', faltam: [] } }
  if (est && est.estado === 'descartado') return { ok: true, resposta: { tipo: 'recusado', codigo: 'ja_descartado', faltam: [] } }
  if (!est || est.estado !== 'online') return { ok: false, error: naoLeu('tirar') }
  const r = await executarSaida(sb, { site: q.site, tabela: p.data.tabela, mes: p.data.mes, por: q.por, simular, doisPassos: est.dois_passos, ate })
  const classe = TABELAS_DA_SAIDA[p.data.tabela]
  if (simular && r.tipo === 'simulado' && classe !== 'ensaio') {
    // contar a simulação vista nunca derruba a resposta da simulação
    await Promise.resolve(sb.rpc('obs_archive_switch_sim_seen', { p_site: q.site, p_class: classe, p_by: q.por }).abortSignal(AbortSignal.timeout(3_000))).catch(() => undefined)
  }
  return fechar(r, 'tirar')
}
export async function simularSaida(tabela: string, mes: string): Promise<Retorno> { return tirarOuSimular(tabela, mes, true) }
export async function tirarMes(tabela: string, mes: string): Promise<Retorno> { return tirarOuSimular(tabela, mes, false) }

export async function liberarEspaco(tabela: string, mes: string): Promise<Retorno> {
  const ate = Date.now() + PRAZO_TOTAL_MS
  const q = await quem('apagar um mês do banco')
  if ('negado' in q) return q.negado
  const p = ChamadaSaida.safeParse({ tabela, mes })
  if (!p.success) return { ok: false, error: naoLeu('liberar') }
  return fechar(await executarLiberar(getSupabaseServiceClient(), { site: q.site, tabela: p.data.tabela, mes: p.data.mes, por: q.por, simular: false, ate }), 'liberar')
}
export async function trazerDeVolta(tabela: string, mes: string): Promise<Retorno> {
  const ate = Date.now() + PRAZO_TOTAL_MS
  const q = await quem('mostrar um mês de novo')
  if ('negado' in q) return q.negado
  const p = ChamadaSaida.safeParse({ tabela, mes })
  if (!p.success) return { ok: false, error: naoLeu('trazer') }
  return fechar(await executarTrazer(getSupabaseServiceClient(), { site: q.site, tabela: p.data.tabela, mes: p.data.mes, por: q.por, ate }), 'trazer')
}
