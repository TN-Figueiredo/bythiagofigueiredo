import * as Sentry from '@sentry/nextjs'
import { schemaTablesReady } from '@/lib/youtube/competitor-health'
import { fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'
import { devidosDoFechamento, devidosDoLembrete, diasDesdeOInicio, emEsperaDoLembrete, type LinhaAviso } from '@/lib/youtube/teste-youtube/nativo/avisos'
import { contarFalhasRecentes, enviarAvisosDoNicho, fraseDeFalhas, type ResultadoNicho } from '@/lib/youtube/observatorio/sinais/avisos'
import { DEFINICAO_AVISOS_PENDENTES } from '../definicoes'
import type { ContextoTarefa, ResultadoTarefa, Tarefa } from '../tipos'

const COLUNAS = 'id,site_id,youtube_video_id,estado,primeira_vista,confirmado_em,created_at,resposta_dono,lembrete_notificado_em,notificacao_falhou_em,notificacao_tentativas,updated_at'
const TENTATIVAS_MAX = 3
const BANCO_ATE_MS = 83_000
const LIMITE_LINHAS = 500

interface Linha extends LinhaAviso { site_id: string; youtube_video_id: string; notificacao_tentativas: number; updated_at: string }
type FanOut = typeof fanOutToSiteAdminsDetailed
export interface DepsAvisos { fanOut?: FanOut; nicho?: (sb: ContextoTarefa['sb'], agora: Date, semTempo: () => boolean) => Promise<ResultadoNicho> }

const semFeito = (estado: ResultadoTarefa['estado'], motivo: string): ResultadoTarefa => ({ estado, feitas: 0, deixadas: null, motivo })

/**
 * `avisos_pendentes`: lembrete do dia 14, fechamento `sem_resposta` e (F2) o outbox do nicho. A parte do nicho roda SEMPRE, depois da parte nativa e em `try/catch`
 * próprio: nenhuma saída antecipada da parte nativa a pula, e a falha dela não desfaz nem impede o lembrete do dia 14.
 */
export async function rodarAvisos(c: ContextoTarefa, deps: DepsAvisos = {}): Promise<ResultadoTarefa> {
  const nativo = await rodarNativo(c, deps)
  const agora = new Date(c.agora())
  let nicho: ResultadoNicho | null = null
  try {
    nicho = await (deps.nicho ?? ((sb, a, semTempo) => enviarAvisosDoNicho(sb, a, { semTempo })))(c.sb, agora, () => c.agora() >= c.t0 + BANCO_ATE_MS)
  } catch (e) {
    Sentry.captureMessage('avisos_pendentes: parte do nicho falhou: ' + (e instanceof Error ? e.name : typeof e), { level: 'warning', tags: { area: 'sinais-nicho' } })
  }
  let acao: string[] = []
  try {
    const frase = fraseDeFalhas(await contarFalhasRecentes(c.sb, agora))
    if (frase !== null) acao = [frase]
  } catch { /* sem a contagem não há frase; a falha do nicho já aparece no estado */ }
  const detalhe: Record<string, number> = {
    ...(nativo.detalhe ?? {}),
    nicho_enviados: nicho?.enviados ?? 0, nicho_resumidos: nicho?.resumidos ?? 0, nicho_falhas: nicho?.falhas ?? 0, nicho_sem_tempo: nicho?.sem_tempo ?? 0,
    nicho_adiados: nicho?.adiados ?? 0,
  }
  const base: ResultadoTarefa = { ...nativo, detalhe, ...(acao.length > 0 ? { extra: { acao } } : {}) }
  const nichoFalhou = nicho === null || nicho.falhas > 0
  // O erro do nicho não apaga o `sobrou` do nativo: o código combinado diz as duas coisas (o detalhe guarda os contadores de ambos).
  // Aviso que falhou mas ainda tem tentativa: `erro` já na 1ª, para a agenda reabrir a tarefa no disparo seguinte (senão ela fica verde até o dia seguinte).
  const nichoAdiado = nicho !== null && nicho.adiados > 0
  if (nichoAdiado && !nichoFalhou && nativo.estado !== 'erro') return { ...base, estado: 'erro', motivo: nativo.motivo === 'sobrou' ? 'sobrou_e_nicho_adiado' : 'nicho_adiado' }
  if (nichoFalhou && nativo.estado !== 'erro') return { ...base, estado: 'erro', motivo: nativo.motivo === 'sobrou' ? 'sobrou_e_nicho_falhou' : 'nicho_falhou' }
  // Prazo acabou antes de visitar todos os sites: nunca silencioso. Se o nativo já é parcial/erro, o motivo dele fica e o número está em `nicho_sem_tempo`.
  if (nicho !== null && nicho.sem_tempo > 0 && nativo.estado === 'ok') return { ...base, estado: 'parcial', motivo: 'nicho_sem_tempo' }
  return base
}

async function rodarNativo(c: ContextoTarefa, deps: DepsAvisos): Promise<ResultadoTarefa> {
  const fanOut = deps.fanOut ?? fanOutToSiteAdminsDetailed
  const sb = c.sb
  const falha = await schemaTablesReady(sb, [
    ['F1A-DADO', [['ab_native_tests', 'id,lembrete_notificado_em,resposta_dono,respondido_em,notificacao_tentativas,notificacao_falhou_em']]],
  ], { signal: AbortSignal.timeout(10_000) })
  if (falha !== null) return semFeito(falha.tipo === 'ausente' ? 'parcial' : 'erro', falha.tipo === 'ausente' ? 'schema_ausente' : 'schema_nao_conferido')

  const lido = await sb.from('ab_native_tests').select(COLUNAS)
    .not('confirmado_em', 'is', null).is('resposta_dono', null).in('estado', ['em_andamento', 'encerrado', 'sem_desfecho'])
    .or('estado.eq.em_andamento,and(lembrete_notificado_em.is.null,notificacao_falhou_em.is.null)')
    .order('created_at', { ascending: true }).limit(LIMITE_LINHAS)
  if (lido.error) return semFeito('parcial', 'leitura_falhou')
  const linhas = (lido.data ?? []) as Linha[]
  const agoraMs = c.agora()
  const agora = new Date(agoraMs)
  const porId = new Map(linhas.map((l) => [l.id, l]))
  const paraLembrar = devidosDoLembrete(linhas, agora)
  const paraFechar = devidosDoFechamento(linhas, agora)
  const noTeto = linhas.length >= LIMITE_LINHAS

  const n = { lembrados: 0, fechados: 0, lembrete_falhou: 0, lembrete_desistiu: 0, lembrete_nao_gravado: 0, lembrete_espera: emEsperaDoLembrete(linhas, agora), no_teto: noTeto ? 1 : 0, fechamento_falhou: 0, cas_perdido: 0, sem_tempo: 0 }
  const semTempo = (): boolean => c.agora() >= c.t0 + BANCO_ATE_MS

  for (const id of paraLembrar) {
    const l = porId.get(id)!
    if (semTempo()) { n.sem_tempo++; continue }
    let enviado = false
    try {
      const fan = await fanOut({
        siteId: l.site_id, domain: 'youtube', type: 'youtube.native_lembrete', priority: 3,
        title: `Faz ${diasDesdeOInicio(l, agora)} dias do teste no YouTube: qual versão ficou?`,
        message: 'Abra o A/B Lab e conte o que você viu no Studio.',
        dedupKey: `lembrete-nativo:${l.id}`, payload: { registro_id: l.id },
        actionHref: `/cms/youtube/ab-lab?video=${l.youtube_video_id}`,
        defaultChannels: ['email'],
      })
      enviado = fan.total > 0 && fan.errors.length === 0
    } catch (e) {
      Sentry.captureMessage('avisos_pendentes: fan-out lançou: ' + (e instanceof Error ? e.name : typeof e), { level: 'warning', tags: { area: 'ab-nativo' } })
    }
    if (enviado) {
      const r = await sb.from('ab_native_tests').update({ lembrete_notificado_em: agora.toISOString() })
        .eq('id', l.id).eq('site_id', l.site_id).is('lembrete_notificado_em', null).select('id')
      if (r.error) { n.lembrete_nao_gravado++; continue } // saiu, mas não gravou: o dedup segura o reenvio
      if ((r.data as unknown[] | null)?.length) n.lembrados++
      continue
    }
    const tentativas = (l.notificacao_tentativas ?? 0) + 1
    const desistiu = tentativas >= TENTATIVAS_MAX
    const r = await sb.from('ab_native_tests').update({ notificacao_tentativas: tentativas, ...(desistiu ? { notificacao_falhou_em: agora.toISOString() } : {}) })
      .eq('id', l.id).eq('site_id', l.site_id).is('lembrete_notificado_em', null).select('id')
    if (r.error) Sentry.captureMessage('avisos_pendentes: tentativa não gravada', { level: 'warning', tags: { area: 'ab-nativo' } })
    if (desistiu) {
      n.lembrete_desistiu++
      Sentry.captureMessage('avisos_pendentes: lembrete do dia 14 abandonado', { level: 'error', tags: { area: 'ab-nativo' }, extra: { registro_id: l.id } })
    }
    else n.lembrete_falhou++
  }

  for (const id of paraFechar) {
    const l = porId.get(id)!
    if (semTempo()) { n.sem_tempo++; continue }
    const iso = agora.toISOString()
    const r = await sb.from('ab_native_tests').update({
      estado: 'sem_desfecho', desfecho_estado: 'sem_dado', desfecho_motivo: 'sem_resposta', desfecho_em: iso, encerrado_em: iso, resposta_dono: 'sem_resposta',
    }).eq('id', l.id).eq('site_id', l.site_id).eq('updated_at', l.updated_at).eq('estado', 'em_andamento').is('resposta_dono', null).select('id')
    if (r.error) { n.fechamento_falhou++; continue }
    if (!(r.data as unknown[] | null)?.length) { n.cas_perdido++; continue }
    n.fechados++
    const e = await sb.from('notifications').update({ expired_at: iso })
      .eq('site_id', l.site_id).eq('domain', 'youtube').eq('dedup_key', `lembrete-nativo:${l.id}`).is('expired_at', null)
    if (e.error) Sentry.captureMessage('avisos_pendentes: expirar lembrete-nativo falhou', { level: 'warning', tags: { area: 'ab-nativo' } })
  }

  const detalhe: Record<string, number> = { ...n }
  const base = { feitas: n.lembrados + n.fechados, deixadas: n.sem_tempo, detalhe }
  if (n.lembrete_desistiu > 0) return { estado: 'erro', motivo: 'lembrete_desistiu', ...base }
  if (n.lembrete_falhou > 0) return { estado: 'parcial', motivo: 'lembrete_falhou', ...base }
  if (n.lembrete_nao_gravado > 0) return { estado: 'parcial', motivo: 'lembrete_nao_gravado', ...base }
  if (n.fechamento_falhou > 0) return { estado: 'parcial', motivo: 'fechamento_falhou', ...base }
  if (n.sem_tempo > 0 || noTeto) return { estado: 'parcial', motivo: 'sobrou', ...base }
  return { estado: 'ok', ...base }
}

/** `avisos_pendentes`: devida sempre (o que é devido sai da leitura a cada disparo); sem `ligaCom` (ver a definição). */
export const avisosPendentes: Tarefa = {
  ...DEFINICAO_AVISOS_PENDENTES,
  devidaPeloDado: () => true,
  rodar: (c) => rodarAvisos(c),
}
