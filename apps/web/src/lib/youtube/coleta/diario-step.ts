// Passo `diario` (spec, seção 6, "Diário por vídeo" — lote L2; dieta da E6). Uma chamada à Analytics API por vídeo, por dia.
// O passo NÃO lê nem escreve `yt_own_video_daily` direto: lê a cobertura (`yt_own_video_coverage`, conjunto `base`) uma vez
// por canal e grava cada vídeo por `yt_own_daily_apply`, que numa só transação grava os dias com atividade, apaga o dia
// revisado para zero e estende a cobertura. Dia sem linha DENTRO da cobertura = zero medido; FORA dela = não medido.
// A janela de cada vídeo começa no menor entre `hoje − 10` e o último dia coberto (sem cobertura, na publicação): um vídeo
// que já foi coberto só volta vazio se a API parou de responder — e é o critério de cobertura que denuncia isso.
// Todos os dias devolvidos vão à função, zeros inclusive (quem decide "tem atividade" é só ela). Antes de chamá-la o passo
// confere o que veio: dia sem `views` numérico é falha do vídeo (a função não é chamada e a cobertura não avança); sem
// `engaged_views` em algum dia, só o conjunto `base` é gravado. Coluna que não veio fica FORA do payload.
// Função ou tabela de cobertura ausentes: `schema_ausente` e o passo para; nunca se grava pelo caminho antigo.
// A coluna `error` das tentativas recebe só o CÓDIGO (`motivoDoErro`), nunca o texto de uma exceção.
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { channelNote } from '@/lib/cron/failure-note'
import { AnalyticsApiError, diarioDoVideo, type DiaDoVideo } from './analytics-diario'
import { marcarAutorizado, marcarReautorizar, obterToken } from './autorizacao'
import { contarPorResultado, registrarTentativa } from './attempts'
import { emParalelo, fetchComPrazo, PARALELO, restante, SemTempoError } from './clock'
import { inicioDaJanela, lerCoberturaBase, type CoberturaDoVideo } from './cobertura'
import { addDays, dayPt } from './day-pt'
import { ehPerdaDeAutorizacao } from './google-erro'
import { metricVersion } from './metric-version'
import { motivoDoErro, textoDoMotivo } from './motivo'
import { conferirBanco, pushUnico } from './schema'
import type { ColetaChannel, StepCtx, StepResumo } from './types'

const DIA_MS = 86_400_000
const LIMITE_VIDEOS = 1000
/** Vídeo atrasado há mais que isto (cobertura anterior a `hoje − 8`) sai da nota do passo: o critério de cobertura o enxerga. */
const DIAS_DE_ATRASO_ANTIGO = 8

export interface DiarioResumo extends StepResumo {
  /** "Hoje" no Pacífico: o fim da janela pedida. */
  ate: string
  /** Vídeos cuja resposta veio sem as métricas estendidas (a API recusou a lista completa). */
  estendidas_recusadas: number
  /** Linhas apagadas pela função (dia revisado para zero pelo YouTube). */
  apagadas: number
  /** Intervalos de cobertura tocados pela função (soma do retorno). */
  intervalos: number
  /** Vídeos cuja resposta veio com dias sem `engaged_views`: só o conjunto `base` foi gravado. */
  estendidas_ausentes: number
  /** Vídeos que falharam (ou voltaram sem dias) com cobertura anterior a `hoje − 8`, ou sem cobertura e publicados há 8 dias ou mais. */
  atrasados_antigos: number
  /** Vídeos com mais de um intervalo `base` na cobertura (há buraco). Só informação. */
  com_buraco: number
}

interface VideoRow {
  id: string
  youtube_video_id: string
  channel_id: string
  site_id: string
  published_at: string
}

const retornoDaFuncao = z.object({
  dias: z.number().int().nonnegative(),
  atualizadas: z.number().int().nonnegative(),
  inseridas: z.number().int().nonnegative(),
  apagadas: z.number().int().nonnegative(),
  intervalos: z.number().int().nonnegative(),
})

const temNumero = (d: DiaDoVideo, coluna: 'views' | 'engaged_views'): boolean =>
  typeof d.valores[coluna] === 'number'

export async function passoDiario(ctx: StepCtx): Promise<DiarioResumo> {
  const hoje = dayPt(new Date())
  const resumo: DiarioResumo = {
    gravados: 0, tentativas: {}, pendentes: 0, ate: hoje, estendidas_recusadas: 0,
    apagadas: 0, intervalos: 0, estendidas_ausentes: 0, atrasados_antigos: 0, com_buraco: 0,
  }
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

  let schemaAusenteNaEscrita = false
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
      const motivo = motivoDoErro(e)
      pushUnico(ctx.falhas, `diário: ${channelNote(c.name, textoDoMotivo(motivo))}`)
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'erro_http', error: motivo })
      continue
    }
    if (token === null) continue

    // ── Cobertura de cada vídeo (uma leitura por canal) ────────────────────
    const falhasAntes = ctx.falhas.length
    const lida = await lerCoberturaBase(ctx, c)
    if (lida === 'schema_ausente') {
      pushUnico(ctx.falhas, 'schema_ausente: yt_own_video_coverage')
      for (const k of canais.slice(i)) await registrarTentativa(ctx, { ...tCanal(k), outcome: 'schema_ausente' })
      return fechar()
    }
    if (lida === 'erro') {
      // O corte em 5.000 já anotou a sua própria nota; as outras leituras que falham ganham a nota genérica.
      if (ctx.falhas.length === falhasAntes) pushUnico(ctx.falhas, 'erro de banco ao ler yt_own_video_coverage')
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'erro_http', error: 'erro_de_banco' })
      continue
    }
    const cobertura: Map<string, CoberturaDoVideo> = lida
    resumo.com_buraco += videos.filter(x => (cobertura.get(x.youtube_video_id)?.intervalos ?? 0) > 1).length

    // Atrasado há muito tempo: o erro dele não entra na nota do passo (quem decide é o critério de cobertura).
    const limiteAntigo = addDays(hoje, -DIAS_DE_ATRASO_ANTIGO)
    const ehAntigo = (x: VideoRow): boolean => {
      const cob = cobertura.get(x.youtube_video_id)
      if (cob) return cob.ate < limiteAntigo
      const pub = Date.parse(x.published_at)
      return !Number.isNaN(pub) && dayPt(new Date(pub)) <= limiteAntigo
    }

    // Quem nunca foi coletado primeiro; depois o coletado há mais tempo.
    const fila = [...videos].sort((a, b) => {
      const ua = cobertura.get(a.youtube_video_id)
      const ub = cobertura.get(b.youtube_video_id)
      if (!ua || !ub) return ua === ub ? 0 : !ua ? -1 : 1
      return Date.parse(ua.coletadoEm) - Date.parse(ub.coletadoEm)
    })

    let negado = false
    let comErro = 0
    let primeiraCausa = ''
    let pendentesDoCanal = 0
    let ausentesDoCanal = 0
    const estendidasAntes = resumo.estendidas_recusadas
    // Uma promessa por canal: quatro vídeos em paralelo não disparam quatro gravações.
    let autorizadoP: Promise<void> | null = null
    let reautorizarP: Promise<void> | null = null

    await emParalelo(fila, PARALELO, async (x) => {
      const base = { site_id: x.site_id, scope_type: 'video' as const, scope_id: x.youtube_video_id, kind: 'diario' as const, channel_id: c.id }
      if (schemaAusenteNaEscrita) return
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
      // Falha do vídeo: conta na nota do canal, salvo se ele já está atrasado há muito tempo.
      const falhou = (motivo: string): void => {
        if (ehAntigo(x)) {
          resumo.atrasados_antigos++
          return
        }
        comErro++
        primeiraCausa ||= motivo
      }
      try {
        const inicio = inicioDaJanela({
          hoje, cobertoAte: cobertura.get(x.youtube_video_id)?.ate ?? null, publicadoEm: x.published_at,
        })

        const r = await diarioDoVideo({ token, canalUc: c.channel_id, videoId: x.youtube_video_id, inicio, fim: hoje, f })
        autorizadoP ??= marcarAutorizado(ctx, c)
        await autorizadoP
        if (r.estendidas === 'recusadas') resumo.estendidas_recusadas++

        if (r.dias.length === 0) {
          if (ehAntigo(x)) resumo.atrasados_antigos++
          const novo = Date.now() - Date.parse(x.published_at) < 3 * DIA_MS
          await registrarTentativa(ctx, { ...base, outcome: novo ? 'video_novo' : 'sem_dado_na_janela' })
          return
        }

        // Dia sem `views` numérico (célula nula ou coluna ausente) não pode virar "zero medido": a resposta inteira é
        // forma inesperada, a função não é chamada e a cobertura não avança.
        if (!r.dias.every(d => temNumero(d, 'views'))) throw new AnalyticsApiError(200, 'forma_inesperada')

        let sets: string[] = ['base']
        if (r.estendidas === 'ok') {
          if (r.dias.every(d => temNumero(d, 'engaged_views'))) sets = ['base', 'estendidas']
          else {
            resumo.estendidas_ausentes++
            ausentesDoCanal++
          }
        }

        const dias = r.dias.map(d => d.day)
        const res = await ctx.supabase.rpc('yt_own_daily_apply', {
          p_video: x.youtube_video_id,
          p_ids: { site_id: x.site_id, channel_id: c.id, video_id: x.id },
          p_rows: r.dias.map(d => ({ day_pt: d.day, metric_version: metricVersion(d.day), ...d.valores })),
          p_days_returned: dias,
          p_sets: sets,
        })
        const escrita = conferirBanco(res, 'yt_own_daily_apply', ctx.falhas)
        if (escrita === 'schema_ausente') {
          schemaAusenteNaEscrita = true
          await registrarTentativa(ctx, { ...base, outcome: 'schema_ausente' })
          return
        }
        const retorno = escrita === 'ok' ? retornoDaFuncao.safeParse(res.data) : null
        if (escrita !== 'ok' || !retorno?.success) {
          if (escrita === 'ok') {
            pushUnico(ctx.falhas, 'erro de banco ao gravar yt_own_daily_apply')
            Sentry.captureMessage('diário: yt_own_daily_apply devolveu uma forma inesperada', {
              tags: { cron: 'sync-analytics-metrics', passo: 'diario' }, extra: { video: x.youtube_video_id },
            })
          }
          // Erro nosso, sem resposta do YouTube: sem `http_status`, para nunca contar como "o YouTube não devolveu".
          await registrarTentativa(ctx, { ...base, outcome: 'erro_http', error: 'erro_de_banco' })
          falhou('erro_de_banco')
          return
        }
        const { inseridas, atualizadas, apagadas, intervalos } = retorno.data
        resumo.gravados += inseridas + atualizadas - apagadas
        resumo.apagadas += apagadas
        resumo.intervalos += intervalos
        await registrarTentativa(ctx, { ...base, outcome: 'ok' })
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
          const motivo = motivoDoErro(e)
          await registrarTentativa(ctx, { ...base, outcome: 'erro_http', http_status: e.status, error: motivo })
          falhou(motivo)
        } else {
          Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'diario' }, extra: { video: x.youtube_video_id } })
          const motivo = motivoDoErro(e)
          await registrarTentativa(ctx, { ...base, outcome: 'erro_http', error: motivo })
          falhou(motivo)
        }
      }
    })

    if (schemaAusenteNaEscrita) {
      // A migration sumiu no meio: o canal em curso e os seguintes não chamam mais a API.
      for (const k of canais.slice(i)) await registrarTentativa(ctx, { ...tCanal(k), outcome: 'schema_ausente' })
      return fechar()
    }
    if (comErro > 0) {
      pushUnico(ctx.falhas, `diário: ${c.name}: ${comErro} de ${videos.length} vídeos com erro (${textoDoMotivo(primeiraCausa)})`)
    }
    if (resumo.estendidas_recusadas > estendidasAntes) {
      pushUnico(ctx.falhas, `diário: ${c.name}: a Analytics API recusou as métricas estendidas`)
      Sentry.captureMessage('diário: a Analytics API recusou as métricas estendidas', { tags: { cron: 'sync-analytics-metrics', passo: 'diario' }, extra: { canal: c.channel_id } })
    }
    if (ausentesDoCanal > 0) {
      pushUnico(ctx.falhas, `diário: ${c.name}: estendidas ausentes na resposta de ${ausentesDoCanal} vídeo(s)`)
    }
    await registrarTentativa(ctx, {
      ...tCanal(c),
      outcome: negado ? 'sem_autorizacao' : pendentesDoCanal > 0 ? 'nao_alcancado_orcamento' : 'ok',
    })
  }

  return fechar()
}
