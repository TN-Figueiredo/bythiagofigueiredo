// Coleta dos canais próprios — entrada única dos passos novos do cron sync-analytics-metrics.
// Ordem do spec: metadados → 1A → o que o cron já faz → 1C. A parte antiga mora na rota, então a
// rota chama rodarColeta duas vezes: fase 'antes' (metadados, 1A) e fase 'depois' (1C, critérios).
// Nada aqui chama recordCronSuccess/recordCronFailure: os passos só acumulam falhas[], e rodarColeta
// nunca lança — a parte antiga da rota roda de qualquer jeito.
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describeCronCause } from '@/lib/cron/failure-note'
import { registrarTentativa } from './attempts'
import { TETOS_MS, restante, type Relogio } from './clock'
import { criterioJobsEmErro, criterioMetadados, criterioOrcamento, criteriosRelatorios } from './criteria'
import { ontemPt } from './day-pt'
import { passoJobs, type JobsResumo } from './jobs-step'
import { passoMetadados } from './meta-step'
import { passoRelatorios } from './reports-step'
import { conferirBanco, pushUnico } from './schema'
import type { AttemptKind, ColetaChannel, ColetaResult, StepCtx, Tentativa } from './types'

/** Desligar um passo é um commit de uma linha (runbook, "Desligar um passo ou um tipo"). Não há variável de ambiente. */
export const PASSOS_LIGADOS = { metadados: true, jobs: true, relatorios: true } as const

/** O que o passo de metadados devolve e o critério de metadados precisa (`resumo.metadados` da fase 'antes'). */
export interface MetadadosAntes {
  day_pt: string
  /** Chave ausente = desconhecido (a leitura do passo falhou), nunca zero. */
  dias_sem_meta: Record<string, number>
}

export interface ColetaCtx {
  supabase: SupabaseClient
  relogio: Relogio
  fase: 'antes' | 'depois'
  /**
   * Só na fase 'depois': o `resumo.metadados` que a fase 'antes' devolveu. Sem ele (ou se o passo
   * falhou/foi pulado), todo canal conta como "desconhecido" no critério de metadados.
   */
  metadadosAntes?: MetadadosAntes
}

function ehMetadadosAntes(x: unknown): x is MetadadosAntes {
  if (typeof x !== 'object' || x === null) return false
  const m = x as Record<string, unknown>
  return typeof m.day_pt === 'string' && typeof m.dias_sem_meta === 'object' && m.dias_sem_meta !== null
}

export async function rodarColeta(ctx: ColetaCtx): Promise<ColetaResult> {
  const falhas: string[] = []
  const resumo: Record<string, unknown> = {}
  try {
    const r = await executar(ctx, falhas, resumo)
    // Os passos empurram direto em ctx.falhas: garante a regra "sem duplicatas" também para eles.
    r.falhas = [...new Set(r.falhas)]
    return r
  } catch (e) {
    // Rede de segurança: nada daqui pode derrubar a parte antiga da rota.
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'coleta' } })
    pushUnico(falhas, `coleta: ${describeCronCause(e)}`)
    return { falhas: [...new Set(falhas)], resumo }
  }
}

async function executar(ctx: ColetaCtx, falhas: string[], resumo: Record<string, unknown>): Promise<ColetaResult> {
  // Leitura própria, sem filtro: o passo de metadados cobre todos os canais; jobs e relatórios filtram
  // sync_enabled em código. (L1a: ainda não existe collection_status.)
  let lidos: { data: unknown; error: { code?: string | null; message?: string | null } | null }
  try {
    lidos = await ctx.supabase.from('youtube_channels').select('id, channel_id, site_id, name, sync_enabled')
  } catch (e) {
    lidos = { data: null, error: { code: null, message: describeCronCause(e) } }
  }
  if (conferirBanco(lidos, 'youtube_channels', falhas, 'ler') !== 'ok') {
    Sentry.captureMessage('sync-analytics-metrics: a coleta não leu os canais', { level: 'error', tags: { cron: 'sync-analytics-metrics' } })
    return { falhas, resumo }
  }
  const channels = (lidos.data ?? []) as ColetaChannel[]
  const tentativas: Tentativa[] = []
  const base = { supabase: ctx.supabase, channels, falhas, tentativas }

  const falhou = (nome: string, e: unknown): void => {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: nome } })
    pushUnico(falhas, `${nome}: ${describeCronCause(e)}`)
  }

  /** Roda um passo com o seu teto. Sem tempo: não roda, registra `nao_alcancado_orcamento` por canal e devolve o resumo disso. */
  const passo = async <R>(
    nome: string,
    tetoMs: number,
    kind: AttemptKind,
    servidos: ColetaChannel[],
    fn: (c: StepCtx) => Promise<R>,
  ): Promise<R | Record<string, unknown> | undefined> => {
    try {
      const deadline = ctx.relogio.prazo(tetoMs)
      if (restante(deadline) <= 0) {
        for (const c of servidos) {
          await registrarTentativa(base, { site_id: c.site_id, scope_type: 'canal', scope_id: c.id, kind, outcome: 'nao_alcancado_orcamento', channel_id: c.id })
        }
        return { gravados: 0, tentativas: { nao_alcancado_orcamento: servidos.length }, pendentes: servidos.length, sem_tempo: true }
      }
      return await fn({ ...base, deadline })
    } catch (e) {
      falhou(nome, e)
      return undefined
    }
  }

  const ativos = channels.filter(c => c.sync_enabled)

  if (ctx.fase === 'antes') {
    if (PASSOS_LIGADOS.metadados) {
      const r = await passo('metadados', TETOS_MS.metadados, 'meta', channels, passoMetadados)
      if (r) resumo.metadados = r
    }
    if (PASSOS_LIGADOS.jobs) {
      const r = await passo('jobs', TETOS_MS.jobs, 'sondagem', ativos, passoJobs)
      if (r) resumo.jobs = r
      // O critério lê só o banco (limitado): roda mesmo que o passo tenha falhado ou ficado sem tempo.
      try {
        await criterioJobsEmErro({ supabase: ctx.supabase, falhas, channels })
      } catch (e) {
        falhou('jobs', e)
      }
    }
    resumo.acao_do_dono = (resumo.jobs as Partial<JobsResumo> | undefined)?.acao_do_dono ?? []
    return { falhas, resumo }
  }

  if (PASSOS_LIGADOS.relatorios) {
    const r = await passo('relatorios', TETOS_MS.relatorios, 'relatorio', ativos, passoRelatorios)
    let rel: Record<string, unknown> | undefined = r ? { ...r } : undefined
    try {
      const c = await criteriosRelatorios({ supabase: ctx.supabase, falhas, channels })
      rel = { ...(rel ?? {}), perdidos: c.perdidos, atrasados: c.atrasados }
      resumo.perdidos = c.perdidos
      resumo.atrasados = c.atrasados
      if (c.acao_do_dono) resumo.acao_do_dono = c.acao_do_dono
    } catch (e) {
      falhou('relatorios', e)
    }
    if (rel) resumo.relatorios = rel
  }

  if (PASSOS_LIGADOS.metadados) {
    // Sem o resultado do 'antes', o dia é o de ontem no Pacífico e dias_sem_meta vai vazio: todo canal "desconhecido".
    const meta: MetadadosAntes = ehMetadadosAntes(ctx.metadadosAntes)
      ? ctx.metadadosAntes
      : { day_pt: ontemPt(new Date()), dias_sem_meta: {} }
    try {
      const m = await criterioMetadados({ supabase: ctx.supabase, falhas, channels }, meta)
      resumo.desconhecido = m.desconhecido
    } catch (e) {
      falhou('metadados', e)
    }
  }

  try {
    await criterioOrcamento({ supabase: ctx.supabase, falhas }, ['meta', 'thumbnail', 'sondagem', 'relatorio'])
  } catch (e) {
    falhou('orçamento', e)
  }
  return { falhas, resumo }
}
