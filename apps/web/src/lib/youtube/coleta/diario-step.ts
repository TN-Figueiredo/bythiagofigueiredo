// Passo `diario` (spec, seção 6, "Diário por vídeo" — lote L2). Uma chamada à Analytics API por vídeo, por dia.
// A janela sempre começa, no máximo, no último dia já gravado do vídeo: um vídeo que já teve linha só volta vazio
// se a API parou de responder — e é isso que o critério de "nenhum vídeo com diário ok" denuncia.
// Dia sem atividade não vem na resposta e não é gravado: sem linha = sem atividade ou não medido, nunca zero.
// Coluna que não veio fica FORA do payload: uma segunda execução nunca leva um campo de não nulo a nulo.
import * as Sentry from '@sentry/nextjs'
import { channelNote, describeCronCause } from '@/lib/cron/failure-note'
import { AnalyticsApiError, diarioDoVideo } from './analytics-diario'
import { marcarAutorizado, marcarReautorizar, obterToken } from './autorizacao'
import { contarPorResultado, registrarTentativa } from './attempts'
import { emParalelo, fetchComPrazo, PARALELO, restante, SemTempoError } from './clock'
import { addDays, dayPt } from './day-pt'
import { ehPerdaDeAutorizacao } from './google-erro'
import { metricVersion } from './metric-version'
import { conferirBanco, pushUnico } from './schema'
import type { ColetaChannel, StepCtx, StepResumo } from './types'

const DIA_MS = 86_400_000
const LIMITE_VIDEOS = 1000

export interface DiarioResumo extends StepResumo {
  /** "Hoje" no Pacífico: o fim da janela pedida. */
  ate: string
  /** Vídeos cuja resposta veio sem as métricas estendidas (a API recusou a lista completa). */
  estendidas_recusadas: number
}

interface VideoRow {
  id: string
  youtube_video_id: string
  channel_id: string
  site_id: string
  published_at: string
}

interface Ultimo {
  day_pt: string
  collected_at: string | null
}

export async function passoDiario(ctx: StepCtx): Promise<DiarioResumo> {
  const hoje = dayPt(new Date())
  const resumo: DiarioResumo = { gravados: 0, tentativas: {}, pendentes: 0, ate: hoje, estendidas_recusadas: 0 }
  const fechar = (): DiarioResumo => {
    resumo.tentativas = contarPorResultado(ctx.tentativas, ['diario'])
    return resumo
  }
  const canais = ctx.channels.filter(c => c.sync_enabled)
  if (canais.length === 0) return fechar()
  const tCanal = (c: ColetaChannel) =>
    ({ site_id: c.site_id, scope_type: 'canal' as const, scope_id: c.id, kind: 'diario' as const, channel_id: c.id })

  // ── Vídeos ───────────────────────────────────────────────────────────────
  const lidos = await ctx.supabase
    .from('youtube_videos')
    .select('id, youtube_video_id, channel_id, site_id, published_at')
    .in('channel_id', canais.map(c => c.id))
    .not('published_at', 'is', null)
    .limit(LIMITE_VIDEOS)
  if (conferirBanco(lidos, 'youtube_videos', ctx.falhas, 'ler') !== 'ok') return fechar()
  const todos = (lidos.data ?? []) as VideoRow[]
  if (todos.length >= LIMITE_VIDEOS) {
    pushUnico(ctx.falhas, `diário: ${LIMITE_VIDEOS} vídeos lidos — a leitura pode estar truncada em ${LIMITE_VIDEOS}`)
  }
  const videosDe = (c: ColetaChannel) => todos.filter(x => x.channel_id === c.id)

  if (restante(ctx.deadline) <= 0) {
    for (const c of canais) await registrarTentativa(ctx, { ...tCanal(c), outcome: 'nao_alcancado_orcamento' })
    resumo.pendentes = todos.length
    return fechar()
  }

  const f = fetchComPrazo(ctx.deadline)

  for (let i = 0; i < canais.length; i++) {
    const c = canais[i]!
    const videos = videosDe(c)
    if (videos.length === 0) continue

    let token: string | null
    try {
      token = await obterToken(ctx, c, tCanal(c))
    } catch (e) {
      if (e instanceof SemTempoError) {
        for (const resto of canais.slice(i)) {
          await registrarTentativa(ctx, { ...tCanal(resto), outcome: 'nao_alcancado_orcamento' })
          resumo.pendentes += videosDe(resto).length
        }
        break
      }
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'diario' }, extra: { canal: c.channel_id } })
      pushUnico(ctx.falhas, `diário: ${channelNote(c.name, describeCronCause(e))}`)
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'erro_http', error: describeCronCause(e) })
      continue
    }
    if (token === null) continue

    // ── Último dia gravado de cada vídeo ───────────────────────────────────
    const ultimos = new Map<string, Ultimo>()
    const semLeitura = new Set<string>()
    let schemaAusente = false
    await emParalelo(videos, PARALELO, async (x) => {
      const r = await ctx.supabase
        .from('yt_own_video_daily')
        .select('day_pt, collected_at')
        .eq('youtube_video_id', x.youtube_video_id)
        .order('day_pt', { ascending: false })
        .limit(1)
        .maybeSingle()
      const leitura = conferirBanco(r, 'yt_own_video_daily', ctx.falhas, 'ler')
      if (leitura === 'schema_ausente') schemaAusente = true
      else if (leitura !== 'ok') semLeitura.add(x.youtube_video_id)
      else if (r.data) ultimos.set(x.youtube_video_id, r.data as Ultimo)
    })
    if (schemaAusente) {
      for (const k of canais) await registrarTentativa(ctx, { ...tCanal(k), outcome: 'schema_ausente' })
      return fechar()
    }

    // Quem nunca foi coletado primeiro; depois o coletado há mais tempo.
    const fila = [...videos].sort((a, b) => {
      const ua = ultimos.get(a.youtube_video_id)
      const ub = ultimos.get(b.youtube_video_id)
      if (!ua || !ub) return ua === ub ? 0 : !ua ? -1 : 1
      return (ua.collected_at ?? '') < (ub.collected_at ?? '') ? -1 : (ua.collected_at ?? '') > (ub.collected_at ?? '') ? 1 : 0
    })

    let negado = false
    let comErro = 0
    let primeiraCausa = ''
    let pendentesDoCanal = 0
    const estendidasAntes = resumo.estendidas_recusadas
    // Uma promessa por canal: quatro vídeos em paralelo não disparam quatro gravações.
    let autorizadoP: Promise<void> | null = null
    let reautorizarP: Promise<void> | null = null

    await emParalelo(fila, PARALELO, async (x) => {
      const base = { site_id: x.site_id, scope_type: 'video' as const, scope_id: x.youtube_video_id, kind: 'diario' as const, channel_id: c.id }
      if (negado) {
        await registrarTentativa(ctx, { ...base, outcome: 'sem_autorizacao' })
        return
      }
      if (restante(ctx.deadline) <= 0) {
        await registrarTentativa(ctx, { ...base, outcome: 'nao_alcancado_orcamento' })
        resumo.pendentes++
        pendentesDoCanal++
        return
      }
      if (semLeitura.has(x.youtube_video_id)) {
        await registrarTentativa(ctx, { ...base, outcome: 'erro_http', error: 'erro de banco' })
        comErro++
        primeiraCausa ||= 'erro de banco'
        return
      }
      try {
        const ultimo = ultimos.get(x.youtube_video_id)
        let inicio = ultimo
          ? (addDays(hoje, -10) < ultimo.day_pt ? addDays(hoje, -10) : ultimo.day_pt)
          : dayPt(new Date(x.published_at))
        if (inicio > hoje) inicio = hoje

        const r = await diarioDoVideo({ token, canalUc: c.channel_id, videoId: x.youtube_video_id, inicio, fim: hoje, f })
        autorizadoP ??= marcarAutorizado(ctx, c)
        await autorizadoP
        if (r.estendidas === 'recusadas') resumo.estendidas_recusadas++

        if (r.dias.length === 0) {
          const novo = Date.now() - Date.parse(x.published_at) < 3 * DIA_MS
          await registrarTentativa(ctx, { ...base, outcome: novo ? 'video_novo' : 'sem_dado_na_janela' })
          return
        }

        const agoraIso = new Date().toISOString()
        const linhas = r.dias.map(d => ({
          youtube_video_id: x.youtube_video_id,
          day_pt: d.day,
          site_id: x.site_id,
          video_id: x.id,
          channel_id: c.id,
          source: 'analytics_api',
          collected_at: agoraIso,
          metric_version: metricVersion(d.day),
          ...d.valores,
        }))
        // O PostgREST exige as mesmas chaves em todas as linhas de um upsert em lote.
        const grupos = new Map<string, typeof linhas>()
        for (const l of linhas) {
          const assinatura = Object.keys(l).sort().join(',')
          const g = grupos.get(assinatura)
          if (g) g.push(l)
          else grupos.set(assinatura, [l])
        }
        let resultado: 'ok' | 'schema_ausente' | 'erro' = 'ok'
        for (const grupo of grupos.values()) {
          const up = await ctx.supabase.from('yt_own_video_daily').upsert(grupo, { onConflict: 'youtube_video_id,day_pt' })
          const escrita = conferirBanco(up, 'yt_own_video_daily', ctx.falhas)
          if (escrita !== 'ok' && resultado !== 'schema_ausente') resultado = escrita
        }
        if (resultado === 'schema_ausente') {
          await registrarTentativa(ctx, { ...base, outcome: 'schema_ausente' })
        } else if (resultado === 'erro') {
          await registrarTentativa(ctx, { ...base, outcome: 'erro_http', error: 'erro de banco' })
          comErro++
          primeiraCausa ||= 'erro de banco'
        } else {
          await registrarTentativa(ctx, { ...base, outcome: 'ok' })
          resumo.gravados += linhas.length
        }
      } catch (e) {
        if (e instanceof SemTempoError) {
          await registrarTentativa(ctx, { ...base, outcome: 'nao_alcancado_orcamento' })
          resumo.pendentes++
          pendentesDoCanal++
        } else if (e instanceof AnalyticsApiError && ehPerdaDeAutorizacao(e.status, e.reason)) {
          negado = true
          reautorizarP ??= marcarReautorizar(ctx, c)
          await reautorizarP
          await registrarTentativa(ctx, { ...base, outcome: 'sem_autorizacao', http_status: e.status })
        } else if (e instanceof AnalyticsApiError) {
          const causa = e.reason ? `HTTP ${e.status} ${e.reason}` : `HTTP ${e.status}`
          await registrarTentativa(ctx, { ...base, outcome: 'erro_http', http_status: e.status, error: causa })
          comErro++
          primeiraCausa ||= causa
        } else {
          Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'diario' }, extra: { video: x.youtube_video_id } })
          const causa = describeCronCause(e)
          await registrarTentativa(ctx, { ...base, outcome: 'erro_http', error: causa })
          comErro++
          primeiraCausa ||= causa
        }
      }
    })

    if (comErro > 0) pushUnico(ctx.falhas, `diário: ${c.name}: ${comErro} de ${videos.length} vídeos com erro (${primeiraCausa})`)
    if (resumo.estendidas_recusadas > estendidasAntes) {
      pushUnico(ctx.falhas, `diário: ${c.name}: a Analytics API recusou as métricas estendidas`)
      Sentry.captureMessage('diário: a Analytics API recusou as métricas estendidas', { tags: { cron: 'sync-analytics-metrics', passo: 'diario' }, extra: { canal: c.channel_id } })
    }
    await registrarTentativa(ctx, {
      ...tCanal(c),
      outcome: negado ? 'sem_autorizacao' : pendentesDoCanal > 0 ? 'nao_alcancado_orcamento' : 'ok',
    })
  }

  return fechar()
}
