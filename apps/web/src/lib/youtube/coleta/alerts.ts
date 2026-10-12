
// Avisos ao dono da classe "ação do dono" (spec, seções 1 e 9). `ops_alert_state` é carimbo de
// aviso, nunca contador. Aviso que não pode ser entregue é falha crítica.
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { claimAlert } from '@/lib/ops/alert-state'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { getSiteOwners, logSemDestinatario, SEM_DESTINATARIO } from '@/lib/notifications/get-site-owners'
import { conferirBanco, pushUnico } from './schema'
import type { ColetaChannel, StepCtx } from './types'

export type MotivoAviso = 'api_nao_ativada' | 'sem_acesso' | 'tipo_indisponivel' | 'reautorizar'
/** Os motivos que valem para o canal inteiro; `tipo_indisponivel` é o único que carrega um tipo de relatório. */
export type MotivoDoCanal = Exclude<MotivoAviso, 'tipo_indisponivel'>
type Ctx = Pick<StepCtx, 'supabase' | 'falhas'>

/** Motivos da Reporting API que ganham aviso de saída quando a chamada volta a passar. `reautorizar` tem saída própria (autorizacao.ts). */
const MOTIVOS_COM_SAIDA: readonly MotivoDoCanal[] = ['api_nao_ativada', 'sem_acesso']

/** Entrada e lembrete a cada 7 dias; `tipo_indisponivel` avisa uma vez por tipo. */
const JANELA: Record<MotivoAviso, string> = {
  api_nao_ativada: '7 days',
  sem_acesso: '7 days',
  tipo_indisponivel: '3650 days',
  reautorizar: '7 days',
}

const TITULO: Record<MotivoAviso | 'saida', string> = {
  api_nao_ativada: 'YouTube Reporting API não ativada',
  sem_acesso: 'YouTube recusou o acesso aos relatórios',
  tipo_indisponivel: 'Relatório do YouTube indisponível',
  reautorizar: 'Canal do YouTube perdeu a autorização',
  saida: 'Coleta do YouTube voltou ao normal',
}

/** `tipo_indisponivel` exige o tipo: sem ele a chave cairia no carimbo comum a todos os tipos (3650 dias) e calaria os demais. */
function exigirTipo(motivo: MotivoAviso, tipo: string | undefined): string {
  if (!tipo) throw new Error(`aviso ${motivo} exige o tipo de relatório`)
  return tipo
}

/** `tipo` só existe em `tipo_indisponivel` (e ali é obrigatório): um carimbo por tipo de relatório, para cada tipo avisar uma vez. */
export function chaveAviso(channelUuid: string, motivo: MotivoDoCanal): string
export function chaveAviso(channelUuid: string, motivo: 'tipo_indisponivel', tipo: string): string
export function chaveAviso(channelUuid: string, motivo: MotivoAviso, tipo?: string): string {
  return motivo === 'tipo_indisponivel'
    ? `sync-analytics:${channelUuid}:${motivo}:${exigirTipo(motivo, tipo)}`
    : `sync-analytics:${channelUuid}:${motivo}`
}

export function textoAviso(motivo: MotivoDoCanal | 'saida', nome: string): string
export function textoAviso(motivo: 'tipo_indisponivel', nome: string, tipo: string): string
export function textoAviso(motivo: MotivoAviso | 'saida', nome: string, tipo?: string): string {
  switch (motivo) {
    case 'api_nao_ativada':
      return 'A YouTube Reporting API não está ativada no projeto do Google. Impressões e CTR não estão sendo coletados.'
    case 'sem_acesso':
      return `O YouTube recusou o acesso aos relatórios do canal ${nome}. Impressões e CTR não estão sendo coletados.`
    case 'tipo_indisponivel':
      return `O YouTube não oferece o relatório ${exigirTipo(motivo, tipo)} para o canal ${nome}.`
    case 'reautorizar':
      return `O canal ${nome} perdeu a autorização do YouTube. A coleta parou. Reconecte o canal em Configurações.`
    case 'saida':
      return `A coleta do canal ${nome} voltou ao normal.`
  }
}

/** Leitura do carimbo que confere `error` (readAlertStamp o descarta). `null` = erro ou sem carimbo;
 *  o erro fica em `falhas`, então "não sei" nunca é lido como "sem carimbo". */
async function carimboExiste(ctx: Ctx, chave: string): Promise<'sim' | 'nao' | 'erro'> {
  let res: { data: unknown; error: { code?: string | null; message?: string | null } | null }
  try {
    res = await (ctx.supabase as SupabaseClient)
      .from('ops_alert_state')
      .select('last_at')
      .eq('key', chave)
      .maybeSingle()
  } catch {
    res = { data: null, error: { code: null, message: 'leitura lançou' } }
  }
  if (conferirBanco(res, 'ops_alert_state', ctx.falhas, 'ler') !== 'ok') return 'erro'
  return res.data ? 'sim' : 'nao'
}

/** Apaga o carimbo conferindo `error` (releaseAlert o descarta). */
async function apagarCarimbo(ctx: Ctx, chave: string): Promise<boolean> {
  let res: { error: { code?: string | null; message?: string | null } | null }
  try {
    res = await (ctx.supabase as SupabaseClient).from('ops_alert_state').delete().eq('key', chave)
  } catch {
    res = { error: { code: null, message: 'delete lançou' } }
  }
  return conferirBanco(res, 'ops_alert_state', ctx.falhas) === 'ok'
}

/** Entrega o aviso. Devolve false (e registra a falha crítica) quando ninguém foi avisado. */
async function entregar(ctx: Ctx, ch: ColetaChannel, motivo: MotivoAviso | 'saida', tipo?: string): Promise<boolean> {
  const nota = `aviso ${motivo}${tipo ? ` ${tipo}` : ''} (${ch.name})`
  try {
    const donos = await getSiteOwners(ctx.supabase, ch.site_id)
    if (donos.length === 0) {
      logSemDestinatario('sync-analytics-metrics', ch.site_id)
      pushUnico(ctx.falhas, `${nota}: ${SEM_DESTINATARIO}`)
      return false
    }
    const enviados = await fanOutToSiteAdmins({
      siteId: ch.site_id,
      domain: 'youtube',
      type: `youtube.coleta_${motivo}`,
      priority: 4,
      title: TITULO[motivo],
      message: motivo === 'tipo_indisponivel' ? textoAviso(motivo, ch.name, exigirTipo(motivo, tipo)) : textoAviso(motivo, ch.name),
      dedupKey: `coleta-${motivo}${tipo ? `-${tipo}` : ''}-${ch.id}-${new Date().toISOString().slice(0, 10)}`,
      actionHref: '/cms/youtube',
    })
    if (enviados === 0) {
      logSemDestinatario('sync-analytics-metrics', ch.site_id)
      pushUnico(ctx.falhas, `${nota}: ${SEM_DESTINATARIO}`)
      return false
    }
    return true
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', aviso: motivo } })
    pushUnico(ctx.falhas, `${nota}: falha no envio`)
    return false
  }
}

/** Entrada ou lembrete. Nunca lança. */
export async function avisarEntrada(ctx: Ctx, ch: ColetaChannel, motivo: MotivoDoCanal): Promise<void>
export async function avisarEntrada(ctx: Ctx, ch: ColetaChannel, motivo: 'tipo_indisponivel', tipo: string): Promise<void>
export async function avisarEntrada(ctx: Ctx, ch: ColetaChannel, motivo: MotivoAviso, tipo?: string): Promise<void> {
  let abriu: boolean
  let chave: string
  try {
    // Dentro do try: `exigirTipo` lança sem o tipo, e esta função nunca lança.
    chave = motivo === 'tipo_indisponivel' ? chaveAviso(ch.id, motivo, exigirTipo(motivo, tipo)) : chaveAviso(ch.id, motivo)
    abriu = await claimAlert(ctx.supabase, chave, JANELA[motivo])
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', aviso: motivo } })
    pushUnico(ctx.falhas, `aviso ${motivo} (${ch.name}): falha no envio`)
    return
  }
  if (!abriu) return
  const entregue = await entregar(ctx, ch, motivo, tipo)
  if (!entregue) await apagarCarimbo(ctx, chave)
}

/** Saída: só quando havia carimbo de entrada, e só libera o carimbo depois de entregar o aviso
 *  (sem entrega o carimbo fica e a próxima execução tenta de novo). Nunca lança. */
export async function avisarSaida(ctx: Ctx, ch: ColetaChannel, motivos: readonly MotivoDoCanal[] = MOTIVOS_COM_SAIDA): Promise<void> {
  try {
    const abertas: string[] = []
    for (const motivo of motivos) {
      const chave = chaveAviso(ch.id, motivo)
      if ((await carimboExiste(ctx, chave)) === 'sim') abertas.push(chave)
    }
    if (abertas.length === 0) return
    if (!(await entregar(ctx, ch, 'saida'))) return
    for (const chave of abertas) await apagarCarimbo(ctx, chave)
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', aviso: 'saida' } })
    pushUnico(ctx.falhas, `aviso saida (${ch.name}): falha no envio`)
  }
}
