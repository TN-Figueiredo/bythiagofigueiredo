// apps/web/src/lib/youtube/observatorio/arquivo-mensal/saida.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

/** As tabelas que saem por partição e a classe de cada uma (o espelho de obs_archive_policy, exit_mode = 'particao'; o banco confere de novo). */
export const TABELAS_DA_SAIDA = { competitor_video_hourly: 'horaria', competitor_video_daily: 'serie', competitor_video_early: 'serie', obs_archive_rehearsal: 'ensaio' } as const
export type TabelaDaSaida = keyof typeof TABELAS_DA_SAIDA
export const ChamadaSaida = z.object({ tabela: z.enum(Object.keys(TABELAS_DA_SAIDA) as [TabelaDaSaida, ...TabelaDaSaida[]]), mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/) })
export const CHAMADA_MS = 8_500
/**
 * Pela API (PostgREST) o service_role HERDA os 8 s do `authenticator` (statement_timeout e lock_timeout do login; medido no int e na produção, 28/10): o
 * `service_role` não ter limite próprio no catálogo não vale pela API. Por isso as quatro funções da chamada final (detach, reattach, discard, drop)
 * trazem `set statement_timeout = '30s'` na DEFINIÇÃO (m6.sql; o padrão provado da E9). O prazo do cliente fica acima dos 30 s: quem corta primeiro é o
 * banco, com rollback certo ("tempo_no_banco"); o abort do cliente só sobra para rede muda ("prazo": sem resposta, conferir antes de repetir).
 */
export const CHAMADA_FINAL_MS = 33_000
/** O teto da página é `maxDuration = 60` (arquivo/page.tsx). O relógio da ação nasce no começo dela e termina aqui, com 5 s para responder e revalidar. */
export const PRAZO_TOTAL_MS = 55_000
/** Conferência e chamada final dividem o PRAZO_TOTAL_MS: unidade nova só começa se, mesmo ela levando os 8,5 s inteiros, ainda sobrar a chamada final. */
const cabeFinal = (ate: number): boolean => ate - Date.now() >= CHAMADA_FINAL_MS
const cabeUnidade = (ate: number): boolean => ate - Date.now() >= CHAMADA_FINAL_MS + CHAMADA_MS

/** Códigos de recusa que as funções da saída devolvem no topo da resposta (m6.sql); a faixa `faltam` tem os próprios códigos (Tarefa 12). */
export const CODIGOS_DA_SAIDA = [
  'ocupado', 'ja_destacado', 'nao_destacado', 'ja_descartado', 'particao_ausente', 'tabela_invalida', 'sem_direito', 'gatilho_ausente', 'cedo_demais',
  'dois_passos_obrigatorios', 'esquema_divergente', 'esquema_mudou', 'fora_do_mes', 'orfa_inesperada', 'outro_site_na_particao', 'conteudo_mudou',
  'canal_sem_unidade', 'mudou_durante_a_leitura', 'registro_diverge',
] as const
export type CodigoDaSaida = (typeof CODIGOS_DA_SAIDA)[number]
const CODIGOS_CONHECIDOS: ReadonlySet<string> = new Set(CODIGOS_DA_SAIDA)
/** Código que a tela não conhece vira 'desconhecido' (nunca passa cru); a Tarefa 12 mostra esta frase para ele. */
export { FRASE_CODIGO_DESCONHECIDO } from './frases-saida'   // a frase mora no módulo puro (o componente cliente não importa este arquivo)

export type CausaDaFalha = 'somente_leitura' | 'prazo' | 'forma' | 'banco' | 'tempo_no_banco' | 'conferencia_parcial' | 'sem_tempo'

const Falta = z.object({ codigo: z.string() }).passthrough()
export type Falta = z.infer<typeof Falta>
/** Número que o PostgREST pode mandar como texto (bigint). Nulo continua nulo: sem `z.coerce`, que faria Number(null) = 0 (Phil I-3). */
const Numero = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)])
const Bruta = z.object({
  status: z.enum(['ok', 'simulado', 'recusado']), codigo: z.string().nullish(), faltam: z.array(Falta).nullish(),
  linhas: Numero.nullish(), bytes: Numero.nullish(), canais: z.number().nullish(), fracao_da_classe: Numero.nullish(),
  conteudo_mudou: z.boolean().nullish(), volta_fora_de_ordem: z.boolean().nullish(), protecao_faltam: z.array(z.string()).nullish(),
  liberar_a_partir: z.string().nullish(), descartado_em: z.string().nullish(),   // descartado_em é nulo justamente em particao_ausente (Phil I-2)
})
export type RespostaSaida =
  | { tipo: 'ok'; linhas: number | null; bytes: number | null; conteudoMudou?: boolean; voltaForaDeOrdem?: boolean; protecaoFaltam?: string[] }
  | { tipo: 'simulado'; linhas: number | null; bytes: number | null; canais: number; fracao: number; canalSemUnidade: boolean }
  | { tipo: 'recusado'; codigo: CodigoDaSaida | 'desconhecido' | null; faltam: Falta[]; liberarAPartir?: string; descartadoEm?: string }
  | { tipo: 'falhou'; causa: CausaDaFalha; restantes?: number }   // restantes: canais ainda sem conferir, quando a conferência parcial souber

export const EstadoDoMes = z.object({
  estado: z.enum(['online', 'destacado', 'descartado', 'invalido']), faltam: z.array(Falta), descartes: z.number().int(), dois_passos: z.boolean(),
  particao_ausente: z.boolean().nullish(), destacado_em: z.string().nullish(), liberar_a_partir: z.string().nullish(),
  protecao_faltam: z.array(z.string()).nullish(), descartado_em: z.string().nullish(), bytes_freed: Numero.nullish(),
})
export type EstadoDoMes = z.infer<typeof EstadoDoMes>
export const EstadoInterruptor = z.object({
  estado: z.enum(['nao_existe', 'nao_pode', 'desligado', 'ligado', 'desligou_sozinho', 'venceu']),
  armado_ate: z.string().optional(), desligado_em: z.string().nullable().optional(), motivo: z.string().optional(), mes: z.string().nullable().optional(),
  detalhe: z.record(z.unknown()).nullable().optional(), visto: z.boolean().optional(),
  descartes: z.number().int().optional(), simulacoes: z.number().int().optional(), simulacao_depois: z.boolean().optional(),
})
export type EstadoInterruptor = z.infer<typeof EstadoInterruptor>
export const MesEmTransito = z.object({ tabela: z.string(), mes: z.string(), destacado_em: z.string(), liberar_a_partir: z.string() })
export type MesEmTransito = z.infer<typeof MesEmTransito>

type Lido<T> = { valor: T } | { causa: CausaDaFalha }
const SQLSTATE = /^[0-9A-Z]{5}$/
/**
 * `muda`: a chamada pode ter mudado o banco. Depois dela, só um SQLSTATE (o banco respondeu e desfez) ou 57014 (o banco cancelou e desfez) prova que nada
 * mudou; rede caída, 502 do gateway sem SQLSTATE, exceção, abort e resposta fora da forma são `prazo` (sem resposta: conferir antes de repetir).
 * Numa leitura (`muda = false`) tudo isso é `banco`/`forma`: nada foi escrito no mês.
 */
async function chamar<T>(sb: SupabaseClient, fn: string, args: Record<string, unknown>, forma: z.ZodType<T, z.ZodTypeDef, unknown>, ms = CHAMADA_MS, muda = false): Promise<Lido<T>> {
  try {
    const { data, error } = await sb.rpc(fn, args).abortSignal(AbortSignal.timeout(ms))
    if (error) {
      const codigo = String(error.code ?? '')
      if (codigo === '25006') return { causa: 'somente_leitura' }
      if (codigo === '57014') return { causa: 'tempo_no_banco' }
      if (SQLSTATE.test(codigo) || codigo.startsWith('PGRST')) return { causa: 'banco' }
      return { causa: muda ? 'prazo' : 'banco' }
    }
    const p = forma.safeParse(data)
    return p.success ? { valor: p.data } : { causa: muda ? 'prazo' : 'forma' }
  } catch {
    return { causa: muda ? 'prazo' : 'banco' }
  }
}
function traduzir(b: z.infer<typeof Bruta>): RespostaSaida {
  if (b.status === 'ok') return { tipo: 'ok', linhas: b.linhas ?? null, bytes: b.bytes ?? null, conteudoMudou: b.conteudo_mudou ?? undefined, voltaForaDeOrdem: b.volta_fora_de_ordem ?? undefined, protecaoFaltam: b.protecao_faltam ?? undefined }
  if (b.status === 'simulado') return { tipo: 'simulado', linhas: b.linhas ?? null, bytes: b.bytes ?? null, canais: b.canais ?? 0, fracao: b.fracao_da_classe ?? 0, canalSemUnidade: b.codigo === 'canal_sem_unidade' }
  const codigo = b.codigo == null ? null : CODIGOS_CONHECIDOS.has(b.codigo) ? (b.codigo as CodigoDaSaida) : 'desconhecido'
  return { tipo: 'recusado', codigo, faltam: b.faltam ?? [], liberarAPartir: b.liberar_a_partir ?? undefined, descartadoEm: b.descartado_em ?? undefined }
}
const ouFalha = <T>(l: Lido<T>): T | RespostaSaida => ('valor' in l ? l.valor : { tipo: 'falhou', causa: l.causa })

export async function lerEstadoDoMes(sb: SupabaseClient, site: string, tabela: TabelaDaSaida, mes: string, por: string): Promise<EstadoDoMes | null> {
  const l = await chamar(sb, 'obs_archive_exit_check', { p_site: site, p_table: tabela, p_month: mes, p_by: por }, EstadoDoMes)
  return 'valor' in l && l.valor.estado !== 'invalido' ? l.valor : null
}
/** CP13: uma chamada curta por canal antes da chamada final; o portão aceita a conferência por 10 minutos. Conferência que não bate não para aqui: o portão recusa e dessela. */
const PARALELO = 4
export async function conferirCanais(sb: SupabaseClient, site: string, tabela: TabelaDaSaida, mes: string, ate: number = Date.now() + PRAZO_TOTAL_MS): Promise<{ ok: number; falhou: number } | { causa: CausaDaFalha }> {
  // p_only_stale: só os canais sem conferência de menos de 8 minutos (Phil M5); o portão aceita a conferência por 10.
  const canais = await chamar(sb, 'obs_archive_precheck_channels', { p_site: site, p_table: tabela, p_month: mes, p_only_stale: true }, z.array(z.string().uuid()))
  if (!('valor' in canais)) return canais
  // Em paralelo, no máximo 4 por vez: 75 chamadas em série passariam do maxDuration da página (Tarefa 6 mede). A primeira falha de leitura interrompe.
  // Relógio único (Phil I-4): unidade nova só começa se ainda couber a chamada final; o que ficou sem conferir é retomado no próximo clique (p_only_stale).
  const lista = canais.valor
  let proximo = 0, ok = 0, falhou = 0, parcial = false
  let erro: CausaDaFalha | null = null
  const trabalhador = async (): Promise<void> => {
    while (erro === null) {
      if (proximo >= lista.length) return
      if (!cabeUnidade(ate)) { parcial = true; return }
      const i = proximo++
      const r = await chamar(sb, 'obs_archive_precheck_unit', { p_site: site, p_table: tabela, p_month: mes, p_channel: lista[i]! }, z.object({ ok: z.boolean() }).passthrough())
      if (!('valor' in r)) { erro = r.causa; return }
      if (r.valor.ok) ok++; else falhou++
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALELO, lista.length) }, trabalhador))
  if (erro !== null) return { causa: erro }
  return parcial ? { causa: 'conferencia_parcial' } : { ok, falhou }
}
async function chamadaFinal(sb: SupabaseClient, fn: string, args: Record<string, unknown>, ate: number, muda: boolean): Promise<RespostaSaida> {
  if (!cabeFinal(ate)) return { tipo: 'falhou', causa: 'sem_tempo' }   // nada foi chamado
  const r = ouFalha(await chamar(sb, fn, args, Bruta, CHAMADA_FINAL_MS, muda))
  return 'tipo' in r ? r : traduzir(r)
}
export async function executarSaida(sb: SupabaseClient, a: { site: string; tabela: TabelaDaSaida; mes: string; por: string; simular: boolean; doisPassos: boolean; ate?: number }): Promise<RespostaSaida> {
  const ate = a.ate ?? Date.now() + PRAZO_TOTAL_MS
  const c = await conferirCanais(sb, a.site, a.tabela, a.mes, ate)
  if ('causa' in c) return { tipo: 'falhou', causa: c.causa }
  const fn = a.doisPassos ? 'obs_archive_detach_month' : 'obs_archive_drop_month'
  return chamadaFinal(sb, fn, { p_site: a.site, p_table: a.tabela, p_month: a.mes, p_by: a.por, p_mode: 'clique', p_dry_run: a.simular }, ate, !a.simular)
}
export async function executarLiberar(sb: SupabaseClient, a: { site: string; tabela: TabelaDaSaida; mes: string; por: string; simular: boolean; ate?: number }): Promise<RespostaSaida> {
  const ate = a.ate ?? Date.now() + PRAZO_TOTAL_MS
  const c = await conferirCanais(sb, a.site, a.tabela, a.mes, ate)
  if ('causa' in c) return { tipo: 'falhou', causa: c.causa }
  return chamadaFinal(sb, 'obs_archive_discard_month', { p_site: a.site, p_table: a.tabela, p_month: a.mes, p_by: a.por, p_mode: 'clique', p_dry_run: a.simular }, ate, !a.simular)
}
export async function executarTrazer(sb: SupabaseClient, a: { site: string; tabela: TabelaDaSaida; mes: string; por: string; ate?: number }): Promise<RespostaSaida> {
  return chamadaFinal(sb, 'obs_archive_reattach_month', { p_site: a.site, p_table: a.tabela, p_month: a.mes, p_by: a.por, p_dry_run: false }, a.ate ?? Date.now() + PRAZO_TOTAL_MS, true)
}
/** M6a: só os contadores (`obs_archive_switch_counts`). A peça 4 desta etapa conhece `nao_existe`, `nao_pode` e `null` (não lido). O estado completo é da Tarefa 11b [M6b]. */
export async function lerInterruptor(sb: SupabaseClient, site: string, classe: 'horaria' | 'serie'): Promise<EstadoInterruptor | null> {
  if (classe !== 'horaria' && classe !== 'serie') return { estado: 'nao_existe' }
  const l = await chamar(sb, 'obs_archive_switch_counts', { p_site: site, p_class: classe }, z.object({ descartes: z.number().int(), simulacoes: z.number().int() }), 3_000)
  return 'valor' in l ? { estado: 'nao_pode', descartes: l.valor.descartes, simulacoes: l.valor.simulacoes } : null
}
export async function lerEmTransito(sb: SupabaseClient, site: string): Promise<MesEmTransito[] | null> {
  const l = await chamar(sb, 'obs_archive_em_transito', { p_site: site }, z.array(MesEmTransito), 3_000)
  return 'valor' in l ? l.valor : null
}
