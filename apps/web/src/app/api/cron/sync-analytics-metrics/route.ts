import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken, NoActiveConnectionError, TokenRevokedError } from '@/lib/social/token-refresh'
import { classificarErroDeToken, marcarAutorizado, marcarReautorizar } from '@/lib/youtube/coleta/autorizacao'
import { ehPerdaDeAutorizacao, motivoDoGoogle } from '@/lib/youtube/coleta/google-erro'
import type { ColetaChannel, Tentativa } from '@/lib/youtube/coleta/types'
import { detectViral, getIsoWeek } from '@/lib/youtube/analytics-sync'
import { buildNotification } from '@/lib/youtube/notification-service'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { detectFatigue, filterFatigueCandidates } from '@/lib/youtube/ab-fatigue'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import { channelNote, describeCronCause, joinNotes, describeHttpCause } from '@/lib/cron/failure-note'
import { SYNC_WINDOW_DAYS } from '@/lib/youtube/analytics-window'
import { ehMetadadosAntes, rodarColeta, type MetadadosAntes } from '@/lib/youtube/coleta'
import { criarRelogio, FETCH_TIMEOUT_MS, restante, type Relogio } from '@/lib/youtube/coleta/clock'
import { conferirBanco, ehSchemaAusente, pushUnico } from '@/lib/youtube/coleta/schema'
import type { Json } from '@/types/database.types'
import * as Sentry from '@sentry/nextjs'

const YT_ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2/reports'

// dimensions=video + sort=-views means each row is one distinct video. A wider window pulls
// in more distinct videos than a 2-day window ever could, and 50 risked silently truncating
// the lower-ranked ones (no error, just missing rows). 200 covers channels with a few hundred
// videos in the window; if a channel exceeds that, the truncation check below flags it.
const MAX_RESULTS = 200

function channelLabel(channel: { name?: string | null; channel_id: string }): string {
  return channel.name ? `${channel.name} (${channel.channel_id})` : channel.channel_id
}

export const dynamic = 'force-dynamic'
// Relógio global da coleta: 270 s (lib/youtube/coleta/clock.ts). Os 30 s de folga são do veredito e da resposta.
export const maxDuration = 300

type Supabase = ReturnType<typeof getSupabaseServiceClient>

interface ChannelRow {
  id: string
  channel_id: string
  site_id: string
  subscriber_count: number | null
  name: string | null
  collection_status: string | null
}

interface ParteAntiga {
  synced: number
  errors: number
  emptyReports: number
  skippedNoConnection: number
  /** Canais pulados porque perderam a autorização do YouTube (collection_status = 'reautorizar'). */
  semAutorizacao: number
  notifications: number
  fatigueAlerts: number
  errorDetails: string[]
}

/** O canal da rota no formato que autorizacao.ts espera. `jaMarcado` = a fase 'antes' já o devolveu em reautorizar. */
function comoCanalDaColeta(c: ChannelRow, jaMarcado: boolean): ColetaChannel {
  return {
    id: c.id, channel_id: c.channel_id, site_id: c.site_id, name: c.name ?? c.channel_id, sync_enabled: true,
    collection_status: jaMarcado || c.collection_status === 'reautorizar' ? 'reautorizar' : 'ok',
    video_count: null,
  }
}

/**
 * O que o cron já fazia antes da coleta dos canais próprios: analytics por janela, marcos de
 * views, avisos e fadiga. O laço não foi refatorado; mudou só: (a) o fetch leva timeout de
 * min(15 s, o que resta do relógio global); (b) toda escrita, e toda leitura que decide alguma
 * coisa, confere `error` e registra em `falhas`; (c) não chama mais recordCron* — quem dá o
 * veredito é a última linha de GET.
 */
async function parteAntiga(
  supabase: Supabase,
  channels: ChannelRow[],
  relogio: Relogio,
  falhas: string[],
  reautorizar: Set<string>,
): Promise<ParteAntiga> {
  let synced = 0
  let errors = 0
  let emptyReports = 0
  let semAutorizacao = 0
  // As tentativas de autorizacao.ts ficam nesta lista descartável: a parte antiga não registra tentativas.
  const aut = { supabase, falhas, tentativas: [] as Tentativa[] }
  /** Marca (se ainda não estava), conta e segue: perder a autorização é ação do dono, não erro do cron. */
  const perdeuAutorizacao = async (channel: ChannelRow): Promise<void> => {
    if (!reautorizar.has(channel.id)) {
      await marcarReautorizar(aut, comoCanalDaColeta(channel, false))
      reautorizar.add(channel.id)
    }
    semAutorizacao++
  }
  // Canal cadastrado mas sem conexão OAuth viva (recém-cadastrado, ou conexão revogada): é
  // estado legítimo, não falha. Pula, conta e avisa o dono; os demais canais seguem.
  const skippedNoConnection: Array<{ channelId: string; siteId: string; label: string }> = []
  const errorDetails: string[] = []
  const notifications: Array<{ siteId: string; payload: ReturnType<typeof buildNotification> }> = []
  const processedVideos: Array<{ id: string; published_at: string | null; view_count: number }> = []

  for (const channel of channels) {
    try {
      const { accessToken } = await ensureFreshToken(channel.site_id, 'youtube', channel.channel_id)

      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - SYNC_WINDOW_DAYS)

      const endStr = end.toISOString().split('T')[0]!
      const startStr = start.toISOString().split('T')[0]!

      const url = new URL(YT_ANALYTICS_BASE)
      url.searchParams.set('ids', `channel==${channel.channel_id}`)
      url.searchParams.set('startDate', startStr)
      url.searchParams.set('endDate', endStr)
      // impressions/impressionClickThroughRate are NOT available in YouTube Analytics API v2
      // — the API returns "Unknown identifier". Per-video impression data is only available
      // through YouTube Studio (internal). We sync what's available: views, watch time, engagement.
      url.searchParams.set('metrics', 'views,estimatedMinutesWatched,averageViewDuration,likes,comments,shares,subscribersGained')
      url.searchParams.set('dimensions', 'video')
      url.searchParams.set('sort', '-views')
      url.searchParams.set('maxResults', String(MAX_RESULTS))

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        // Sem relógio sobrando o sinal já nasce vencido: o canal vira erro ("request timed out"), não fica pendurado.
        signal: AbortSignal.timeout(Math.min(FETCH_TIMEOUT_MS, restante(relogio.fim))),
      })

      if (!res.ok) {
        // 401, ou 403 por permissão insuficiente: o canal perdeu a autorização. O corpo só é lido para o `reason`.
        const reason = res.status === 403 ? await motivoDoGoogle(res) : null
        if (ehPerdaDeAutorizacao(res.status, reason)) {
          await perdeuAutorizacao(channel)
          continue
        }
        Sentry.captureMessage(`sync-analytics-metrics failed for channel ${channel.channel_id}: ${res.status}`)
        // O corpo do Google não é lido nem gravado: a nota leva só o status.
        errorDetails.push(channelNote(channelLabel(channel), describeHttpCause(res.status)))
        // Entra em falhas[] na hora: se algo lançar mais adiante, o detalhe deste canal não se perde.
        pushUnico(falhas, errorDetails[errorDetails.length - 1]!)
        errors++
        continue
      }

      await marcarAutorizado(aut, comoCanalDaColeta(channel, reautorizar.has(channel.id)))
      reautorizar.delete(channel.id)

      const report = await res.json() as { rows?: (string | number)[][] }

      if (report.rows?.length === MAX_RESULTS) {
        Sentry.captureMessage(
          `sync-analytics-metrics: channel ${channel.channel_id} hit maxResults=${MAX_RESULTS} — report may be truncated`,
        )
      }

      // A report with zero rows is NOT a sync — it means no video had reportable activity in
      // the window (or, before SYNC_WINDOW_DAYS was widened, that the window was too tight).
      // Counting it as `synced` is exactly what let this cron report errors:0 every day while
      // youtube_video_analytics stayed empty, with no signal anywhere that it was wrong.
      if (!report.rows?.length) { emptyReports++; continue }

      const videosLidos = await supabase
        .from('youtube_videos')
        .select('id, youtube_video_id, title, view_count, view_count_yesterday, view_count_delta_today, published_at')
        .eq('channel_id', channel.id)
      // Leitura que falhou não é "canal sem vídeos": sem isto o canal contava como sincronizado sem gravar nada.
      if (conferirBanco(videosLidos, 'youtube_videos', falhas, 'ler') !== 'ok') continue
      const videos = videosLidos.data

      const videoMap = new Map((videos ?? []).map(v => [v.youtube_video_id, v]))

      const channelTotalDelta = (videos ?? []).reduce((s, v) => s + (v.view_count_delta_today ?? 0), 0)
      const channelAvg48h = (videos ?? []).length > 0
        ? (channelTotalDelta + (videos ?? []).reduce((s, v) => s + (v.view_count_yesterday ?? 0), 0)) / (videos ?? []).length
        : 0

      const today = new Date().toISOString().split('T')[0]!

      for (const row of report.rows) {
        const videoExternalId = String(row[0])
        const dbVideo = videoMap.get(videoExternalId)
        if (!dbVideo) continue

        const views = Number(row[1])
        const avgDuration = Number(row[3])
        const likes = Number(row[4])
        const comments = Number(row[5])
        const shares = Number(row[6])
        const subsGained = Number(row[7])

        const previousPeriod = dbVideo.view_count_delta_today ?? 0

        const gravouVideo = await supabase.from('youtube_videos').update({
          avg_view_duration_seconds: avgDuration,
          view_count_delta_today: views,
          view_count_yesterday: previousPeriod,
          last_analytics_sync_at: new Date().toISOString(),
        }).eq('id', dbVideo.id)
        conferirBanco(gravouVideo, 'youtube_videos', falhas)

        const gravouAnalytics = await supabase.from('youtube_video_analytics').upsert({
          youtube_video_id: dbVideo.id,
          site_id: channel.site_id,
          date: today,
          views,
          avg_view_duration_seconds: avgDuration,
          likes,
          comments,
          shares,
          subscribers_gained: subsGained,
        }, { onConflict: 'youtube_video_id,date' })
        conferirBanco(gravouAnalytics, 'youtube_video_analytics', falhas)

        if (detectViral(views, previousPeriod, channelAvg48h)) {
          notifications.push({
            siteId: channel.site_id,
            payload: buildNotification({
              type: 'trending_viral',
              videoId: dbVideo.id,
              videoTitle: dbVideo.title ?? 'Video',
              views48h: views + previousPeriod,
              channelAvg48h,
              weekIso: getIsoWeek(new Date()),
            }),
          })
        }

        processedVideos.push({
          id: dbVideo.id,
          published_at: dbVideo.published_at ?? null,
          view_count: dbVideo.view_count ?? 0,
        })
      }

      synced++
    } catch (e) {
      if (e instanceof TokenRevokedError || e instanceof NoActiveConnectionError) {
        // Canal que a fase 'antes' já marcou: nem relê as conexões.
        // Token revogado é reautorizar sem ler nada; só "sem conexão" precisa do classificador (conexão revogada antes).
        const classe = reautorizar.has(channel.id) || e instanceof TokenRevokedError
          ? 'reautorizar'
          : await classificarErroDeToken(aut, comoCanalDaColeta(channel, false), e)
        if (classe === 'reautorizar') {
          await perdeuAutorizacao(channel)
          continue
        }
        if (classe === 'sem_conexao') {
          skippedNoConnection.push({ channelId: channel.channel_id, siteId: channel.site_id, label: channelLabel(channel) })
          continue
        }
        // 'outro' (a leitura das conexões falhou): cai no erro genérico abaixo.
      }
      Sentry.captureException(e, { extra: { channelId: channel.channel_id } })
      errorDetails.push(channelNote(channelLabel(channel), describeCronCause(e)))
      pushUnico(falhas, errorDetails[errorDetails.length - 1]!)
      errors++
    }
  }

  // Milestone view snapshots — capture view_count at key ages
  const milestones = [
    { column: 'views_at_24h', minAge: 24, maxAge: 48 },
    { column: 'views_at_48h', minAge: 48, maxAge: 72 },
    { column: 'views_at_7d', minAge: 168, maxAge: 192 },
    { column: 'views_at_30d', minAge: 720, maxAge: 744 },
  ] as const

  for (const video of processedVideos) {
    if (!video.published_at) continue
    const ageHours = (Date.now() - new Date(video.published_at).getTime()) / 3_600_000

    for (const ms of milestones) {
      if (ageHours >= ms.minAge && ageHours < ms.maxAge) {
        const marcoLido = await supabase
          .from('youtube_video_analytics')
          .select(ms.column)
          .eq('youtube_video_id', video.id)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (conferirBanco(marcoLido, 'youtube_video_analytics', falhas, 'ler') !== 'ok') continue
        const existing = marcoLido.data

        if (existing && !(existing as Record<string, unknown>)[ms.column]) {
          const today = new Date().toISOString().slice(0, 10)
          const gravouMarco = await supabase
            .from('youtube_video_analytics')
            .update({ [ms.column]: video.view_count })
            .eq('youtube_video_id', video.id)
            .eq('date', today)
          conferirBanco(gravouMarco, 'youtube_video_analytics', falhas)
        }
      }
    }
  }

  for (const { siteId, payload } of notifications) {
    // Aviso que não saiu é falha visível, e não derruba os marcos já gravados nem a fadiga.
    try {
      await fanOutToSiteAdmins({
        siteId,
        domain: 'youtube',
        type: `youtube.${payload.type}`,
        priority: payload.priority,
        title: payload.title,
        message: payload.message,
        dedupKey: payload.dedup_key,
        payload: {
          ...(payload.video_id ? { videoId: payload.video_id } : {}),
        },
        suggestedAction: payload.suggested_action,
        actionHref: payload.action_href,
      })
    } catch (e) {
      Sentry.captureException(e)
      pushUnico(falhas, `aviso de vídeo em alta: ${describeCronCause(e)}`)
    }
  }

  // O pulo precisa ser VISTO: um aviso por site e por dia (dedup), não um alarme de cron.
  const skippedBySite = new Map<string, string[]>()
  for (const k of skippedNoConnection) {
    skippedBySite.set(k.siteId, [...(skippedBySite.get(k.siteId) ?? []), k.label])
  }
  for (const [siteId, channelIds] of skippedBySite) {
    try {
      await fanOutToSiteAdmins({
        siteId,
        domain: 'youtube',
        type: 'youtube.channel_skipped_no_connection',
        priority: 2,
        title: 'Canal do YouTube sem conexão',
        message: `${channelIds.length} canal(is) sem conexão OAuth ficaram de fora da sincronização de analytics: ${channelIds.join(', ')}. Conecte o acesso do canal em /cms/youtube.`,
        dedupKey: `channel-skipped-no-connection-${siteId}-${new Date().toISOString().slice(0, 10)}`,
        actionHref: '/cms/youtube',
      })
    } catch (e) {
      Sentry.captureException(e)
      pushUnico(falhas, `aviso de canal sem conexão: ${describeCronCause(e)}`)
    }
  }

  // Phase 3: Fatigue detection (once per site, after all channels processed)
  let fatigueAlerts = 0
  const siteIds = [...new Set(channels.map(c => c.site_id))]

  for (const siteId of siteIds) {
    try {
      // Leitura que falhou não é "nada a fazer": sem os vídeos não há candidatos, e sem os testes
      // A/B todo vídeo em teste viraria candidato. Nos dois casos o site fica de fora e vira falha.
      const videosDoSite = await supabase
        .from('youtube_videos')
        .select('id, published_at, view_count')
        .eq('site_id', siteId)
        .not('published_at', 'is', null)
      if (conferirBanco(videosDoSite, 'youtube_videos', falhas, 'ler') !== 'ok') continue
      const allVideos = videosDoSite.data

      const testesAtivos = await supabase
        .from('ab_tests')
        .select('youtube_video_id')
        .eq('site_id', siteId)
        .in('status', ['active', 'draft', 'paused', 'queued'])
      if (conferirBanco(testesAtivos, 'ab_tests', falhas, 'ler') !== 'ok') continue
      const activeTestVideos = testesAtivos.data

      const activeVideoIds = new Set((activeTestVideos ?? []).map(t => t.youtube_video_id))
      const candidates = filterFatigueCandidates(allVideos ?? [], activeVideoIds)

      for (const candidate of candidates) {
        const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
        const metricasLidas = await supabase
          .from('youtube_video_analytics')
          .select('date, views')
          .eq('youtube_video_id', candidate.id)
          .gte('date', sixtyDaysAgo)
          .order('date', { ascending: true })
        if (conferirBanco(metricasLidas, 'youtube_video_analytics', falhas, 'ler') !== 'ok') continue
        const metrics = metricasLidas.data

        if (!metrics?.length) continue

        const result = detectFatigue(
          metrics.map(m => ({ date: m.date as string, views: (m.views as number | null) ?? 0 })),
          candidate.published_at,
        )

        if (result?.isFatigued) {
          const alertaLido = await supabase
            .from('youtube_fatigue_alerts')
            .select('id')
            .eq('video_id', candidate.id)
            .eq('status', 'pending')
            .limit(1)
            .maybeSingle()
          // Sem saber se já há alerta pendente, não insere: leitura falha não é "não existe".
          if (conferirBanco(alertaLido, 'youtube_fatigue_alerts', falhas, 'ler') !== 'ok') continue
          const existing = alertaLido.data

          if (!existing) {
            const gravouAlerta = await supabase.from('youtube_fatigue_alerts').insert({
              video_id: candidate.id,
              site_id: siteId,
              z_score: result.zScore,
              expected_ctr: result.expectedViews,
              actual_ctr: result.actualViews,
            })
            if (conferirBanco(gravouAlerta, 'youtube_fatigue_alerts', falhas) === 'ok') fatigueAlerts++
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e)
      pushUnico(falhas, `fadiga: ${describeCronCause(e)}`)
    }
  }

  return {
    synced,
    errors,
    emptyReports,
    skippedNoConnection: skippedNoConnection.length,
    semAutorizacao,
    notifications: notifications.length,
    fatigueAlerts,
    errorDetails,
  }
}

/**
 * Uma fase dos passos novos. `rodarColeta` promete não lançar; se lançar (ou devolver algo fora do
 * contrato), vira item de falhas[] e a rota segue — nada aqui derruba a parte antiga nem o veredito.
 */
async function coletar(
  supabase: Supabase,
  relogio: Relogio,
  fase: 'antes' | 'depois',
  falhas: string[],
  metadadosAntes?: MetadadosAntes,
): Promise<Record<string, unknown>> {
  try {
    const r = await rodarColeta({ supabase, relogio, fase, ...(metadadosAntes && { metadadosAntes }) })
    for (const f of r.falhas) pushUnico(falhas, f)
    return r.resumo ?? {}
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', fase } })
    pushUnico(falhas, `coleta (${fase}): ${describeCronCause(e)}`)
    return {}
  }
}

/**
 * `resumo.metadados` da fase 'antes' para a fase 'depois'. O que não passa no guarda de
 * `rodarColeta` (passo pulado, sem `day_pt`) vai como `undefined`: lá dentro o efeito é o mesmo,
 * todo canal conta como "desconhecido", nunca como zero.
 */
function comoMetadadosAntes(x: unknown): MetadadosAntes | undefined {
  return ehMetadadosAntes(x) ? x : undefined
}

/** Tira `acao_do_dono` do resumo de uma fase: ele sai num campo próprio da resposta, nunca em falhas[]. */
function separarAcaoDoDono(resumo: Record<string, unknown>): { resto: Record<string, unknown>; acao: unknown[] } {
  const { acao_do_dono: acao, ...resto } = resumo
  return { resto, acao: Array.isArray(acao) ? acao : [] }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Um relógio só para o pedido inteiro: é o mesmo objeto nas duas fases da coleta e na parte antiga.
  const relogio = criarRelogio()
  const supabase = getSupabaseServiceClient()

  // A parte antiga e os passos novos só ACUMULAM falhas (sem duplicatas); o veredito é um só, no fim.
  // Ordem do spec: metadados → 1A → o que o cron já fazia → 1C.
  const falhas: string[] = []

  let lista: ChannelRow[] = []
  let channelsError: { code?: string | null; message?: string | null } | null
  const comColuna = await supabase
    .from('youtube_channels')
    .select('id, channel_id, site_id, subscriber_count, name, collection_status')
    .eq('sync_enabled', true)
  channelsError = comColuna.error
  if (!comColuna.error) {
    lista = comColuna.data ?? []
  } else if (ehSchemaAusente(comColuna.error)) {
    // Código no ar sem a migration do L1b: `collection_status` não existe. Relê sem ela e SEGUE (a parte antiga e a
    // linha de metadados do dia não podem parar por isso); todo canal conta como `ok` e a falha vai ao veredito.
    const semColuna = await supabase
      .from('youtube_channels')
      .select('id, channel_id, site_id, subscriber_count, name')
      .eq('sync_enabled', true)
    channelsError = semColuna.error
    if (!semColuna.error) {
      lista = (semColuna.data ?? []).map(c => ({ ...c, collection_status: 'ok' }))
      pushUnico(falhas, 'schema_ausente: youtube_channels')
    }
  }

  // A dropped query error used to fall through to `channels === null` →
  // `channels.length === 0` → recordCronSuccess + HTTP 200 — the system
  // ASSERTING it's healthy about a DB error it never looked at. Distinguish
  // "the query failed" from "the query genuinely returned zero rows".
  // É o único registro fora do veredito: nenhum passo rodou.
  if (channelsError) {
    Sentry.captureMessage(`sync-analytics-metrics: channels query failed: ${channelsError.message}`)
    // O texto do Postgres fica só no Sentry (acima); a nota gravada e a resposta são legíveis e sem ele.
    await recordCronFailure('sync-analytics-metrics', 'database error listing the YouTube channels')
    return NextResponse.json({ error: 'channels query failed' }, { status: 500 })
  }

  const coletaAntes = await coletar(supabase, relogio, 'antes', falhas)

  // Com a leitura da rota vazia a parte antiga não tem o que fazer, mas a coleta roda igual: ela lê
  // todos os canais por conta própria (o passo de metadados não depende de sync_enabled).
  const jaReautorizar = new Set<string>(
    Array.isArray(coletaAntes.reautorizar) ? coletaAntes.reautorizar.filter((x): x is string => typeof x === 'string') : [],
  )
  let antiga: ParteAntiga | null = null
  let msExistente = 0
  if (lista.length > 0) {
    const inicio = Date.now()
    try {
      antiga = await parteAntiga(supabase, lista, relogio, falhas, jaReautorizar)
      const comConexao = lista.length - antiga.skippedNoConnection - antiga.semAutorizacao
      // Os detalhes por canal (errorDetails) já entraram em falhas[] dentro do laço.
      if (antiga.errors === 0 && comConexao > 0 && antiga.emptyReports === comConexao) {
        // Every channel came back with zero rows for the window. One channel alone doing this is
        // legitimate (e.g. a brand-new channel with nothing published yet), but ALL of them at
        // once — with no HTTP error — is the same silent-failure shape this fix closes: a scope
        // loss, a window regression, or an API contract change that a naive errors:0 check would
        // never catch. Do not call this success.
        pushUnico(falhas, `all ${comConexao} channel(s) returned an empty analytics report for the ${SYNC_WINDOW_DAYS}-day window`)
      }
    } catch (e) {
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', fase: 'existente' } })
      pushUnico(falhas, `parte existente: ${describeCronCause(e)}`)
    }
    msExistente = Date.now() - inicio
  }

  const coletaDepois = await coletar(supabase, relogio, 'depois', falhas, comoMetadadosAntes(coletaAntes.metadados))

  const antes = separarAcaoDoDono(coletaAntes)
  const depois = separarAcaoDoDono(coletaDepois)
  // Os tempos das duas fases num objeto só (a fase 'depois' sobrescreveria a chave `ms` da 'antes').
  const comoMs = (x: unknown): Record<string, number> =>
    typeof x === 'object' && x !== null ? Object.fromEntries(Object.entries(x).filter((e): e is [string, number] => typeof e[1] === 'number')) : {}
  const msPassos = { ...comoMs(coletaAntes.ms), ...comoMs(coletaDepois.ms) }
  // União das duas fases: 'antes' traz os estados dos jobs, 'depois' os dos critérios de relatório.
  const acaoDoDono = [...new Set([...antes.acao, ...depois.acao])].filter((x): x is string => typeof x === 'string')
  const resumoColeta = { ...antes.resto, ...depois.resto, ms: msPassos }

  // A execução fica gravada: o resumo (tempos por passo, ação do dono, perdidos, vazios) só existia nesta resposta,
  // que ninguém guarda. Vem ANTES do veredito para a falha da própria gravação aparecer nele.
  try {
    // `resumo` e `ms_passos` são Json no banco; o resumo é só dados, então a ida e volta por JSON é segura.
    const resumoJson: Json = JSON.parse(JSON.stringify(resumoColeta))
    const msPassosJson: Json = JSON.parse(JSON.stringify(msPassos))
    const gravou = await supabase.from('yt_own_collection_runs').insert({
      ms_total: relogio.decorrido(),
      ms_existente: msExistente,
      ms_passos: msPassosJson,
      falhas,
      acao_do_dono: acaoDoDono,
      resumo: resumoJson,
    })
    if (conferirBanco(gravou, 'yt_own_collection_runs', falhas) === 'ok') {
      const limpou = await supabase
        .from('yt_own_collection_runs')
        .delete()
        .lt('ran_at', new Date(Date.now() - 90 * 86_400_000).toISOString())
      conferirBanco(limpou, 'yt_own_collection_runs', falhas)
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', fase: 'execucao' } })
    pushUnico(falhas, `registro da execução: ${describeCronCause(e)}`)
  }

  // Montados DEPOIS da gravação: uma falha dela também aparece na resposta.
  const extras = {
    ms_existente: msExistente,
    coleta: resumoColeta,
    acao_do_dono: acaoDoDono,
    ...(falhas.length > 0 && { falhas }),
  }
  const corpo = lista.length === 0
    ? { status: 'no_channels', ...extras }
    : {
        synced: antiga?.synced ?? 0,
        errors: antiga?.errors ?? 0,
        emptyReports: antiga?.emptyReports ?? 0,
        skipped_no_connection: antiga?.skippedNoConnection ?? 0,
        sem_autorizacao: antiga?.semAutorizacao ?? 0,
        notifications: antiga?.notifications ?? 0,
        fatigueAlerts: antiga?.fatigueAlerts ?? 0,
        ...(antiga && antiga.errorDetails.length > 0 && { errorDetails: antiga.errorDetails }),
        ...extras,
      }

  // Veredito único: nenhum passo chama recordCron* por conta própria.
  if (falhas.length > 0) {
    await recordCronFailure('sync-analytics-metrics', joinNotes(falhas))
  } else {
    await recordCronSuccess('sync-analytics-metrics')
  }
  return NextResponse.json(corpo)
}
