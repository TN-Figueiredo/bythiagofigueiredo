// apps/web/src/lib/youtube/observatorio/arquivo-mensal/saida.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

/** As tabelas que saem por partição e a classe de cada uma (o espelho de obs_archive_policy, exit_mode = 'particao'; o banco confere de novo). */
export const TABELAS_DA_SAIDA = { competitor_video_hourly: 'horaria', competitor_video_daily: 'serie', competitor_video_early: 'serie', obs_archive_rehearsal: 'ensaio' } as const
export type TabelaDaSaida = keyof typeof TABELAS_DA_SAIDA
export const ChamadaSaida = z.object({ tabela: z.enum(Object.keys(TABELAS_DA_SAIDA) as [TabelaDaSaida, ...TabelaDaSaida[]]), mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/) })
export const CHAMADA_MS = 8_500
/** A chamada final (simulação ou ação) passa dos 8,5 s da leitura: a simulação inline da horária mediu 10,5 s (x4,05) e o teto da página é 60 s. Vai pelo cliente de serviço (sem statement_timeout), depois da conferência por canal. */
export const CHAMADA_FINAL_MS = 45_000

const Falta = z.object({ codigo: z.string() }).passthrough()
export type Falta = z.infer<typeof Falta>
const Bruta = z.object({
  status: z.enum(['ok', 'simulado', 'recusado']), codigo: z.string().nullable().optional(), faltam: z.array(Falta).optional(),
  linhas: z.coerce.number().optional(), bytes: z.coerce.number().optional(), canais: z.number().optional(), fracao_da_classe: z.coerce.number().optional(),
  conteudo_mudou: z.boolean().optional(), volta_fora_de_ordem: z.boolean().optional(), protecao_faltam: z.array(z.string()).optional(),
  liberar_a_partir: z.string().optional(), descartado_em: z.string().optional(),
})
export type RespostaSaida =
  | { tipo: 'ok'; linhas: number; bytes: number | null; conteudoMudou?: boolean; voltaForaDeOrdem?: boolean; protecaoFaltam?: string[] }
  | { tipo: 'simulado'; linhas: number; bytes: number | null; canais: number; fracao: number; canalSemUnidade: boolean }
  | { tipo: 'recusado'; codigo: string | null; faltam: Falta[]; liberarAPartir?: string; descartadoEm?: string }
  | { tipo: 'falhou'; causa: 'somente_leitura' | 'prazo' | 'forma' | 'banco' }

export const EstadoDoMes = z.object({
  estado: z.enum(['online', 'destacado', 'descartado', 'invalido']), faltam: z.array(Falta), descartes: z.number().int(), dois_passos: z.boolean(),
  particao_ausente: z.boolean().optional(), destacado_em: z.string().optional(), liberar_a_partir: z.string().optional(),
  protecao_faltam: z.array(z.string()).optional(), descartado_em: z.string().optional(), bytes_freed: z.coerce.number().nullable().optional(),
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

type Lido<T> = { valor: T } | { causa: 'somente_leitura' | 'prazo' | 'forma' | 'banco' }
async function chamar<T>(sb: SupabaseClient, fn: string, args: Record<string, unknown>, forma: z.ZodType<T>, ms = CHAMADA_MS): Promise<Lido<T>> {
  try {
    const { data, error } = await sb.rpc(fn, args).abortSignal(AbortSignal.timeout(ms))
    if (error) {
      if (error.code === '25006') return { causa: 'somente_leitura' }
      return { causa: /abort/i.test(String(error.message ?? '')) ? 'prazo' : 'banco' }
    }
    const p = forma.safeParse(data)
    return p.success ? { valor: p.data } : { causa: 'forma' }
  } catch (err) {
    return { causa: /abort|timeout/i.test(String((err as Error)?.message ?? '')) ? 'prazo' : 'banco' }
  }
}
function traduzir(b: z.infer<typeof Bruta>): RespostaSaida {
  if (b.status === 'ok') return { tipo: 'ok', linhas: b.linhas ?? 0, bytes: b.bytes ?? null, conteudoMudou: b.conteudo_mudou, voltaForaDeOrdem: b.volta_fora_de_ordem, protecaoFaltam: b.protecao_faltam }
  if (b.status === 'simulado') return { tipo: 'simulado', linhas: b.linhas ?? 0, bytes: b.bytes ?? null, canais: b.canais ?? 0, fracao: b.fracao_da_classe ?? 0, canalSemUnidade: b.codigo === 'canal_sem_unidade' }
  return { tipo: 'recusado', codigo: b.codigo ?? null, faltam: b.faltam ?? [], liberarAPartir: b.liberar_a_partir, descartadoEm: b.descartado_em }
}
const ouFalha = <T>(l: Lido<T>): T | RespostaSaida => ('valor' in l ? l.valor : { tipo: 'falhou', causa: l.causa })

export async function lerEstadoDoMes(sb: SupabaseClient, site: string, tabela: TabelaDaSaida, mes: string, por: string): Promise<EstadoDoMes | null> {
  const l = await chamar(sb, 'obs_archive_exit_check', { p_site: site, p_table: tabela, p_month: mes, p_by: por }, EstadoDoMes)
  return 'valor' in l && l.valor.estado !== 'invalido' ? l.valor : null
}
/** CP13: uma chamada curta por canal antes da chamada final; o portão aceita a conferência por 10 minutos. Conferência que não bate não para aqui: o portão recusa e dessela. */
const PARALELO = 4
export async function conferirCanais(sb: SupabaseClient, site: string, tabela: TabelaDaSaida, mes: string): Promise<{ ok: number; falhou: number } | { causa: 'somente_leitura' | 'prazo' | 'forma' | 'banco' }> {
  // p_only_stale: só os canais sem conferência de menos de 8 minutos (Phil M5); o portão aceita a conferência por 10.
  const canais = await chamar(sb, 'obs_archive_precheck_channels', { p_site: site, p_table: tabela, p_month: mes, p_only_stale: true }, z.array(z.string().uuid()))
  if (!('valor' in canais)) return canais
  // Em paralelo, no máximo 4 por vez: 75 chamadas em série passariam do maxDuration da página (Tarefa 6 mede). A primeira falha de leitura interrompe.
  const lista = canais.valor
  let proximo = 0, ok = 0, falhou = 0
  let erro: 'somente_leitura' | 'prazo' | 'forma' | 'banco' | null = null
  const trabalhador = async (): Promise<void> => {
    while (erro === null) {
      const i = proximo++
      if (i >= lista.length) return
      const r = await chamar(sb, 'obs_archive_precheck_unit', { p_site: site, p_table: tabela, p_month: mes, p_channel: lista[i]! }, z.object({ ok: z.boolean() }).passthrough())
      if (!('valor' in r)) { erro = r.causa; return }
      if (r.valor.ok) ok++; else falhou++
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALELO, lista.length) }, trabalhador))
  return erro !== null ? { causa: erro } : { ok, falhou }
}
export async function executarSaida(sb: SupabaseClient, a: { site: string; tabela: TabelaDaSaida; mes: string; por: string; simular: boolean; doisPassos: boolean }): Promise<RespostaSaida> {
  const c = await conferirCanais(sb, a.site, a.tabela, a.mes)
  if ('causa' in c) return { tipo: 'falhou', causa: c.causa }
  const fn = a.doisPassos ? 'obs_archive_detach_month' : 'obs_archive_drop_month'
  const r = ouFalha(await chamar(sb, fn, { p_site: a.site, p_table: a.tabela, p_month: a.mes, p_by: a.por, p_mode: 'clique', p_dry_run: a.simular }, Bruta, CHAMADA_FINAL_MS))
  return 'tipo' in r ? r : traduzir(r)
}
export async function executarLiberar(sb: SupabaseClient, a: { site: string; tabela: TabelaDaSaida; mes: string; por: string; simular: boolean }): Promise<RespostaSaida> {
  const c = await conferirCanais(sb, a.site, a.tabela, a.mes)
  if ('causa' in c) return { tipo: 'falhou', causa: c.causa }
  const r = ouFalha(await chamar(sb, 'obs_archive_discard_month', { p_site: a.site, p_table: a.tabela, p_month: a.mes, p_by: a.por, p_mode: 'clique', p_dry_run: a.simular }, Bruta, CHAMADA_FINAL_MS))
  return 'tipo' in r ? r : traduzir(r)
}
export async function executarTrazer(sb: SupabaseClient, a: { site: string; tabela: TabelaDaSaida; mes: string; por: string }): Promise<RespostaSaida> {
  const r = ouFalha(await chamar(sb, 'obs_archive_reattach_month', { p_site: a.site, p_table: a.tabela, p_month: a.mes, p_by: a.por, p_dry_run: false }, Bruta, CHAMADA_FINAL_MS))
  return 'tipo' in r ? r : traduzir(r)
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
