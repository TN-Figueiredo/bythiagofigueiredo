// apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes.ts
'use server'
import { revalidatePath } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteAdminScope, siteAdminOnlyMessage } from '@/lib/cms/auth-guards'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ChamadaSaida, PRAZO_TOTAL_MS, TABELAS_DA_SAIDA, executarLiberar, executarSaida, executarTrazer, lerEstadoDoMes, type RespostaSaida } from '@/lib/youtube/observatorio/arquivo-mensal/saida'

type Retorno = { ok: boolean; error?: string; resposta?: RespostaSaida }
/** O verbo e a incerteza de cada ação: a frase de "sem resposta" manda conferir a coisa que o dono pediu (Yannis I-2). */
type Verbo = { feito: string; incerta: string }
const TIRAR: Verbo = { feito: 'tirado', incerta: 'se o mês saiu' }
const LIBERAR: Verbo = { feito: 'liberado', incerta: 'se o espaço foi liberado' }
const TRAZER: Verbo = { feito: 'trazido', incerta: 'se o mês voltou ao banco online' }
const SOMENTE_LEITURA = 'O banco passou do limite e está em modo somente leitura. Siga o passo de emergência.'
const PAGINA = '/cms/youtube/competitors'
const naoLeu = (v: Verbo): string => `Não foi possível ler o estado deste mês. Nada foi ${v.feito}.`
const semResposta = (v: Verbo): string => `Não foi possível confirmar ${v.incerta}. Recarregue a página antes de tentar de novo.`
const FRASES: Record<Exclude<Extract<RespostaSaida, { tipo: 'falhou' }>['causa'], 'somente_leitura'>, (v: Verbo) => string> = {
  prazo: semResposta,   // depois da chamada que muda: rede caída, 502, abort, resposta fora da forma
  banco: naoLeu, forma: naoLeu,
  tempo_no_banco: v => `O banco não terminou a tempo. Nada foi ${v.feito}; tente de novo em alguns minutos.`,   // 57014: o banco cancelou e desfez
  conferencia_parcial: v => `A conferência dos canais passou do tempo desta página. Nada foi ${v.feito}; clique de novo para continuar de onde parou.`,
  sem_tempo: v => `Faltou tempo nesta página para chamar o banco. Nada foi ${v.feito}; clique de novo.`,
}

/** O guarda no TOPO (antes do cliente de serviço), UMA vez só (Yannis M-2); o id de quem age vem da sessão, nunca do formulário. */
async function quem(acao: string): Promise<{ site: string; por: string } | { negado: Retorno }> {
  const { siteId } = await getSiteContext()
  const s = await requireSiteAdminScope(siteId)
  if (!s.ok) return { negado: { ok: false, error: siteAdminOnlyMessage(acao) } }
  return { site: siteId, por: s.user.id }
}
function fechar(r: RespostaSaida, v: Verbo): Retorno {
  if (r.tipo === 'falhou') return { ok: false, error: r.causa === 'somente_leitura' ? SOMENTE_LEITURA : FRASES[r.causa](v) }
  if (r.tipo === 'ok') revalidatePath(PAGINA, 'layout')
  return { ok: true, resposta: r }
}
async function tirarOuSimular(tabela: string, mes: string, simular: boolean): Promise<Retorno> {
  const ate = Date.now() + PRAZO_TOTAL_MS   // o relógio único da ação, antes de qualquer ida à rede
  const q = await quem('tirar um mês do banco online')
  if ('negado' in q) return q.negado
  const p = ChamadaSaida.safeParse({ tabela, mes })
  if (!p.success) return { ok: false, error: naoLeu(TIRAR) }
  const sb = getSupabaseServiceClient()
  const est = await lerEstadoDoMes(sb, q.site, p.data.tabela, p.data.mes, q.por)
  // m-8: segundo clique num mês que já saiu das telas (ou foi descartado) não é "não foi possível ler": é o estado real
  if (est && est.estado === 'destacado') return { ok: true, resposta: { tipo: 'recusado', codigo: 'ja_destacado', faltam: [] } }
  if (est && est.estado === 'descartado') return { ok: true, resposta: { tipo: 'recusado', codigo: 'ja_descartado', faltam: [] } }
  if (!est || est.estado !== 'online') return { ok: false, error: naoLeu(TIRAR) }
  const r = await executarSaida(sb, { site: q.site, tabela: p.data.tabela, mes: p.data.mes, por: q.por, simular, doisPassos: est.dois_passos, ate })
  const classe = TABELAS_DA_SAIDA[p.data.tabela]
  if (simular && r.tipo === 'simulado' && classe !== 'ensaio') {
    // contar a simulação vista nunca derruba a resposta da simulação
    await Promise.resolve(sb.rpc('obs_archive_switch_sim_seen', { p_site: q.site, p_class: classe, p_by: q.por }).abortSignal(AbortSignal.timeout(3_000))).catch(() => undefined)
  }
  return fechar(r, TIRAR)
}
export async function simularSaida(tabela: string, mes: string): Promise<Retorno> { return tirarOuSimular(tabela, mes, true) }
export async function tirarMes(tabela: string, mes: string): Promise<Retorno> { return tirarOuSimular(tabela, mes, false) }

export async function liberarEspaco(tabela: string, mes: string): Promise<Retorno> {
  const ate = Date.now() + PRAZO_TOTAL_MS
  const q = await quem('liberar o espaço de um mês')
  if ('negado' in q) return q.negado
  const p = ChamadaSaida.safeParse({ tabela, mes })
  if (!p.success) return { ok: false, error: naoLeu(LIBERAR) }
  return fechar(await executarLiberar(getSupabaseServiceClient(), { site: q.site, tabela: p.data.tabela, mes: p.data.mes, por: q.por, simular: false, ate }), LIBERAR)
}
export async function trazerDeVolta(tabela: string, mes: string): Promise<Retorno> {
  const ate = Date.now() + PRAZO_TOTAL_MS
  const q = await quem('trazer um mês de volta ao banco online')
  if ('negado' in q) return q.negado
  const p = ChamadaSaida.safeParse({ tabela, mes })
  if (!p.success) return { ok: false, error: naoLeu(TRAZER) }
  return fechar(await executarTrazer(getSupabaseServiceClient(), { site: q.site, tabela: p.data.tabela, mes: p.data.mes, por: q.por, ate }), TRAZER)
}
