// Passo de metadados (spec, seção 3). Desde o L1b captura pela Data API com o token do canal dono (privacy_status) e classifica Shorts.
// Grava o DIA FECHADO (ontem no Pacífico) para todo vídeo de todo canal. O que estava no ar em
// cada dia não volta: por isso o passo nunca desiste de gravar a linha por causa da thumbnail.
import * as Sentry from '@sentry/nextjs'
import { createHash } from 'node:crypto'
import { describeCronCause } from '@/lib/cron/failure-note'
import { classifyShort, needsShortProbe, newProbeBudget, probeShortsBatch } from '@/lib/youtube/short-classifier'
import { archiveThumb, DHASH_MAX_SAME, hamming, probeThumb, type ThumbProbe } from '@/lib/youtube/thumb-fingerprint'
import { calcularAbDoDia, type AbCycle, type AbDia, type AbTest } from './ab-seconds'
import { marcarAutorizado, marcarReautorizar, obterToken } from './autorizacao'
import { contarPorResultado, registrarTentativa } from './attempts'
import { comPrazo, emParalelo, fetchComPrazo, PARALELO, restante, SemTempoError } from './clock'
import { addDays, boundsAnalytics, boundsReporting, diffDias, ontemPt, utcDay } from './day-pt'
import { ehPerdaDeAutorizacao } from './google-erro'
import { conferirBanco, pushUnico } from './schema'
import type { StepCtx, StepResumo } from './types'
import { DataApiError, videosList, type VideoCapturado } from './videos-list'

export interface MetaResumo extends StepResumo {
  day_pt: string
  /** Por `youtube_channels.id`: dias entre a última linha gravada e o dia em gravação. */
  dias_sem_meta: Record<string, number>
  /** Linhas gravadas nesta execução sem `privacy_status` (sem token, falha de videos.list ou vídeo ausente dela). */
  sem_privacidade: number
  /** Linhas gravadas nesta execução cujo `is_short` ficou nulo (duração desconhecida ou sonda sem confirmação). */
  sem_is_short: number
}

interface VideoRow {
  id: string
  youtube_video_id: string
  channel_id: string
  site_id: string
  title: string | null
  description: string | null
  tags: string[] | null
  duration_seconds: number | null
  published_at: string
}

/** A linha de maior day_pt estritamente menor que o dia em gravação. */
interface Anterior {
  day_pt: string
  description_sha256: string | null
  tags_sha256: string | null
  thumbnail_dhash: string | null
  thumbnail_blob_url: string | null
  is_short: boolean | null
  duration_seconds: number | null
}

interface ThumbCaptura {
  ok: boolean
  motivo: string | null
  dhash: string | null
  sha256: string | null
  blobUrl: string | null
}

/** A captura pela Data API (token + videos.list de todos os canais) não come mais que isto do prazo do passo. */
export const TETO_CAPTURA_MS = 8_000

/** O PostgREST corta em 1000 linhas: bater nesse número é sinal de leitura truncada. */
const LIMITE_LEITURA = 1000

/** Quando ab_tests/ab_test_cycles não puderam ser lidos: a captura é gravada, o "valeu para o dia" fica nulo. */
const AB_ILEGIVEL: AbDia = {
  ab_test_id: null, ab_variant_id: null,
  seconds_on_air_analytics: null, seconds_other_analytics: null,
  seconds_on_air_reporting: null, seconds_other_reporting: null,
  title: null, thumbCopiaCaptura: false, motivoNulo: null,
}

const PRIVACIDADES: readonly string[] = ['public', 'unlisted', 'private']

/**
 * `is_short` sem rede. `null` = não se sabe ainda; `sonda: true` = só a sonda de /shorts decide (61 a 180 s sem #Shorts).
 * Um vídeo já confirmado num dia anterior, com a mesma duração, não é sondado de novo.
 */
function shortSemSonda(dur: number | null, titulo: string | null, ant: Anterior | null): { valor: boolean | null; sonda: boolean } {
  if (dur == null || dur === 0) return { valor: null, sonda: false }
  if (ant && ant.is_short !== null && ant.duration_seconds === dur) return { valor: ant.is_short, sonda: false }
  if (needsShortProbe(dur) && !(titulo?.includes('#Shorts') ?? false)) return { valor: null, sonda: true }
  const v = classifyShort({ durationSeconds: dur, title: titulo })
  return { valor: v.confirmed ? v.isShort : null, sonda: false }
}

const sha256 = (v: string | Buffer): string => createHash('sha256').update(v).digest('hex')
const somar = (m: Map<string, number>, k: string): void => { m.set(k, (m.get(k) ?? 0) + 1) }

async function carregarAb(
  ctx: StepCtx,
  videos: VideoRow[],
  inicioMs: number,
): Promise<{ ok: boolean; testes: Map<string, AbTest[]>; ciclos: AbCycle[] }> {
  const vazio = { ok: true, testes: new Map<string, AbTest[]>(), ciclos: [] as AbCycle[] }
  if (videos.length === 0) return vazio
  const t = await ctx.supabase
    .from('ab_tests')
    .select('id, youtube_video_id, status, paused_at, completed_at, original_title')
    .in('youtube_video_id', videos.map(v => v.id))
  if (conferirBanco(t, 'ab_tests', ctx.falhas, 'ler') !== 'ok') return { ...vazio, ok: false }
  // Leitura cortada em 1000: não dá para saber que teste ficou de fora. Nenhum vídeo ganha variante calculada
  // com dado parcial: todos caem em "A/B ilegível" (a captura é gravada, o que valeu para o dia fica de fora).
  if ((t.data ?? []).length >= LIMITE_LEITURA) {
    pushUnico(ctx.falhas, `metadados: testes de A/B lidos até o limite de ${LIMITE_LEITURA} — a leitura pode estar truncada`)
    return { ...vazio, ok: false }
  }
  const linhas = (t.data ?? []) as Array<AbTest & { youtube_video_id: string }>
  if (linhas.length === 0) return vazio
  // Todo ciclo aberto (inclusive os que começaram depois do dia: retomada e rotação posteriores decidem
  // as regras de nulo e a variante no ar na captura) e todo ciclo que terminou depois do começo do dia
  // (logo, que cobre o dia). Duas leituras disjuntas em vez de `or()`: ended_at nulo e ended_at > início.
  const ids = linhas.map(x => x.id)
  const abertos = await ctx.supabase
    .from('ab_test_cycles')
    .select('id, test_id, variant_id, started_at, ended_at, applied_metadata')
    .in('test_id', ids)
    .is('ended_at', null)
  if (conferirBanco(abertos, 'ab_test_cycles', ctx.falhas, 'ler') !== 'ok') return { ...vazio, ok: false }
  const fechados = await ctx.supabase
    .from('ab_test_cycles')
    .select('id, test_id, variant_id, started_at, ended_at, applied_metadata')
    .in('test_id', ids)
    .gt('ended_at', new Date(inicioMs).toISOString())
  if (conferirBanco(fechados, 'ab_test_cycles', ctx.falhas, 'ler') !== 'ok') return { ...vazio, ok: false }
  const ciclos = [...((abertos.data ?? []) as AbCycle[]), ...((fechados.data ?? []) as AbCycle[])]
  if ((abertos.data ?? []).length >= LIMITE_LEITURA || (fechados.data ?? []).length >= LIMITE_LEITURA) {
    pushUnico(ctx.falhas, `metadados: ciclos de A/B lidos até o limite de ${LIMITE_LEITURA} — a leitura pode estar truncada`)
    return { ...vazio, ok: false }
  }
  const testes = new Map<string, AbTest[]>()
  for (const l of linhas) testes.set(l.youtube_video_id, [...(testes.get(l.youtube_video_id) ?? []), l])
  return { ok: true, testes, ciclos }
}

/**
 * Exceção, dhash nulo ou arquivamento nulo: campos de thumbnail nulos e a URL repete a última.
 * Lança `SemTempoError` quando o prazo do passo acaba no meio da captura: quem chama grava a linha sem thumbnail.
 */
async function capturarThumb(ctx: StepCtx, v: VideoRow, ant: Anterior | null, f: typeof fetch): Promise<ThumbCaptura> {
  const repetida = ant?.thumbnail_blob_url ?? null
  const falha = (motivo: string): ThumbCaptura => ({ ok: false, motivo, dhash: null, sha256: null, blobUrl: repetida })
  let probe: ThumbProbe
  try {
    probe = await probeThumb(v.youtube_video_id, null, f)
  } catch (e) {
    if (e instanceof SemTempoError) throw e
    return falha(describeCronCause(e))
  }
  if (!probe.dhash || !probe.bytes) return falha('a thumbnail não baixou')
  const mudou = !ant?.thumbnail_dhash || !repetida || hamming(ant.thumbnail_dhash, probe.dhash) > DHASH_MAX_SAME
  let blobUrl = repetida
  if (mudou) {
    try {
      blobUrl = await comPrazo(archiveThumb(v.id, probe), ctx.deadline)
    } catch {
      blobUrl = null
    }
    // O prazo do passo acabou: não é falha de arquivamento, é orçamento (a linha sai sem thumbnail).
    if (!blobUrl && restante(ctx.deadline) <= 0) throw new SemTempoError()
    if (!blobUrl) return falha('o arquivamento da thumbnail falhou')
  }
  return { ok: true, motivo: null, dhash: probe.dhash, sha256: sha256(probe.bytes), blobUrl }
}

export async function passoMetadados(ctx: StepCtx): Promise<MetaResumo> {
  const agora = new Date()
  const day = ontemPt(agora)
  const A = boundsAnalytics(day)
  const R = boundsReporting(day)
  const resumo: MetaResumo = { gravados: 0, tentativas: {}, pendentes: 0, day_pt: day, dias_sem_meta: {}, sem_privacidade: 0, sem_is_short: 0 }
  const fechar = (): MetaResumo => {
    resumo.tentativas = contarPorResultado(ctx.tentativas, ['meta', 'thumbnail'])
    return resumo
  }
  const canais = ctx.channels
  if (canais.length === 0) return fechar()
  const canalPorId = new Map(canais.map(c => [c.id, c]))

  const lidos = await ctx.supabase
    .from('youtube_videos')
    .select('id, youtube_video_id, channel_id, site_id, title, description, tags, duration_seconds, published_at')
    .in('channel_id', canais.map(c => c.id))
    .lt('published_at', new Date(A.end).toISOString())
  if (conferirBanco(lidos, 'youtube_videos', ctx.falhas, 'ler') !== 'ok') return fechar()
  const videos = (lidos.data ?? []) as VideoRow[]
  if (videos.length >= LIMITE_LEITURA) {
    pushUnico(ctx.falhas, `metadados: ${videos.length} vídeos lidos — a leitura pode estar truncada em ${LIMITE_LEITURA}`)
  }

  // Passo que recebe 0 s: uma tentativa por canal e uma por vídeo, para o critério reconhecer.
  if (restante(ctx.deadline) <= 0) {
    for (const c of canais) {
      await registrarTentativa(ctx, { site_id: c.site_id, scope_type: 'canal', scope_id: c.id, kind: 'meta', outcome: 'nao_alcancado_orcamento', channel_id: c.id })
    }
    for (const v of videos) {
      await registrarTentativa(ctx, { site_id: v.site_id, scope_type: 'video', scope_id: v.youtube_video_id, kind: 'meta', outcome: 'nao_alcancado_orcamento', channel_id: v.channel_id })
    }
    resumo.pendentes = videos.length
    return fechar()
  }

  // Captura pela Data API, com o token do canal dono. Sem token, sem tempo ou com falha: a linha do dia sai do
  // mesmo jeito, com os campos de youtube_videos e sem privacy_status.
  const f = fetchComPrazo(ctx.deadline)
  // Prazo próprio da captura: ela roda em série antes das linhas e não pode consumir o prazo do passo.
  // O spread é raso: `falhas` e `tentativas` continuam sendo os mesmos arrays.
  const prazoCaptura = Math.min(ctx.deadline, Date.now() + TETO_CAPTURA_MS)
  const ctxCaptura: StepCtx = { ...ctx, deadline: prazoCaptura }
  const fCaptura = fetchComPrazo(prazoCaptura)
  const captura = new Map<string, VideoCapturado>()
  /** `youtube_channels.id` cuja videos.list respondeu: só para esses "ausente da resposta" quer dizer alguma coisa. */
  const respondeu = new Set<string>()
  for (const c of canais) {
    const doCanal = videos.filter(v => v.channel_id === c.id)
    if (doCanal.length === 0) continue
    const tCanal = { site_id: c.site_id, scope_type: 'canal' as const, scope_id: c.id, kind: 'meta' as const, channel_id: c.id }
    try {
      const token = await obterToken(ctxCaptura, c, tCanal)
      if (token === null) continue
      const lidosApi = await videosList(token, doCanal.map(v => v.youtube_video_id), fCaptura)
      for (const [id, v] of lidosApi) captura.set(id, v)
      respondeu.add(c.id)
      // Falha em verde: uma resposta sem nenhum dos vídeos do canal não é "alguns ausentes", é dado que não veio.
      if (!doCanal.some(v => lidosApi.has(v.youtube_video_id))) {
        pushUnico(ctx.falhas, `metadados: ${c.name}: videos.list não devolveu nenhum dos ${doCanal.length} vídeos`)
      }
      await marcarAutorizado(ctx, c)
      await registrarTentativa(ctx, { ...tCanal, outcome: 'ok' })
    } catch (e) {
      if (e instanceof SemTempoError) {
        await registrarTentativa(ctx, { ...tCanal, outcome: 'nao_alcancado_orcamento' })
        continue
      }
      if (e instanceof DataApiError && ehPerdaDeAutorizacao(e.status, e.reason)) {
        await marcarReautorizar(ctx, c)
        await registrarTentativa(ctx, { ...tCanal, outcome: 'sem_autorizacao', http_status: e.status })
        continue
      }
      const causa = e instanceof DataApiError ? (e.reason ? `HTTP ${e.status} ${e.reason}` : `HTTP ${e.status}`) : describeCronCause(e)
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'metadados' }, extra: { canal: c.channel_id } })
      pushUnico(ctx.falhas, `metadados: ${c.name}: videos.list falhou (${causa})`)
      await registrarTentativa(ctx, { ...tCanal, outcome: 'erro_http', http_status: e instanceof DataApiError ? e.status : null, error: causa })
    }
  }

  // dias_sem_meta: por canal, ANTES de gravar o dia. Sem linha anterior vale 0.
  for (const c of canais) {
    const ult = await ctx.supabase
      .from('yt_own_video_meta_daily')
      .select('day_pt')
      .eq('channel_id', c.id)
      .lt('day_pt', day)
      .order('day_pt', { ascending: false })
      .limit(1)
      .maybeSingle()
    const leitura = conferirBanco(ult, 'yt_own_video_meta_daily', ctx.falhas, 'ler')
    if (leitura === 'schema_ausente') {
      for (const x of canais) {
        await registrarTentativa(ctx, { site_id: x.site_id, scope_type: 'canal', scope_id: x.id, kind: 'meta', outcome: 'schema_ausente', channel_id: x.id })
      }
      return fechar()
    }
    const ultimo = leitura === 'ok' ? ((ult.data as { day_pt: string } | null)?.day_pt ?? null) : null
    // Leitura que falhou = desconhecido: a chave do canal fica AUSENTE (0 significaria "sem atraso").
    if (leitura !== 'ok') continue
    const dias = ultimo ? Math.max(0, diffDias(ultimo, day) - 1) : 0
    resumo.dias_sem_meta[c.id] = dias
    if (dias > 0) pushUnico(ctx.falhas, `metadados: ${c.name} ficou ${dias} dia(s) sem linha antes de ${day}`)
  }

  // Linha anterior de cada vídeo: decide a ordem, o que mudou e a URL a repetir.
  // Leitura que falha NÃO vira "sem linha anterior": o vídeo é pulado (gravá-lo como primeiro dia
  // reescreveria o texto e arquivaria a thumbnail de novo, e a falha ficaria invisível).
  const anteriores = new Map<string, Anterior | null>()
  const semLeitura = new Set<string>()
  await emParalelo(videos, PARALELO, async (v) => {
    try {
      const r = await ctx.supabase
        .from('yt_own_video_meta_daily')
        .select('day_pt, description_sha256, tags_sha256, thumbnail_dhash, thumbnail_blob_url, is_short, duration_seconds')
        .eq('youtube_video_id', v.youtube_video_id)
        .lt('day_pt', day)
        .order('day_pt', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (conferirBanco(r, 'yt_own_video_meta_daily', ctx.falhas, 'ler') !== 'ok') {
        semLeitura.add(v.youtube_video_id)
        return
      }
      anteriores.set(v.youtube_video_id, (r.data as Anterior | null) ?? null)
    } catch {
      pushUnico(ctx.falhas, 'erro de banco ao ler yt_own_video_meta_daily')
      semLeitura.add(v.youtube_video_id)
    }
  })

  // Vídeos que JÁ têm linha neste dia (segunda execução). Numa captura que falha, repetir a URL do dia
  // anterior sobre uma linha que já tem a imagem nova deixaria impressão e URL de imagens diferentes.
  // Leitura que falha (ou cortada em 1000) toma o lado seguro: o canal inteiro conta como "já tem linha".
  const jaTemLinha = new Set<string>()
  const diaIlegivel = new Set<string>()
  for (const c of canais) {
    const r = await ctx.supabase
      .from('yt_own_video_meta_daily')
      .select('youtube_video_id')
      .eq('channel_id', c.id)
      .eq('day_pt', day)
    if (conferirBanco(r, 'yt_own_video_meta_daily', ctx.falhas, 'ler') !== 'ok') { diaIlegivel.add(c.id); continue }
    const linhasDoDia = (r.data ?? []) as Array<{ youtube_video_id: string }>
    if (linhasDoDia.length >= LIMITE_LEITURA) { diaIlegivel.add(c.id); continue }
    for (const l of linhasDoDia) jaTemLinha.add(l.youtube_video_id)
  }

  const ab = await carregarAb(ctx, videos, Math.min(A.start, R.start))

  const fila = [...videos].sort((a, b) =>
    (anteriores.get(a.youtube_video_id)?.day_pt ?? '').localeCompare(anteriores.get(b.youtube_video_id)?.day_pt ?? ''))
  /** Vídeos cuja linha foi gravada nesta execução e que só a sonda de /shorts classifica. */
  const filaSonda = new Map<string, { dur: number; titulo: string | null }>()
  /** Fora do critério de thumbnail de hoje: privado, ou ausente de uma videos.list que respondeu. */
  const foraDoCriterio = new Map<string, number>()
  const gravadosPorCanal = new Map<string, number>()
  const naoAlcancados = new Map<string, number>()
  const thumbFalhas = new Map<string, number>()
  const capturedAt = agora.toISOString()

  await emParalelo(fila, PARALELO, async (v) => {
    const base = { site_id: v.site_id, scope_type: 'video' as const, scope_id: v.youtube_video_id, channel_id: v.channel_id }
    try {
      if (restante(ctx.deadline) <= 0) {
        await registrarTentativa(ctx, { ...base, kind: 'meta', outcome: 'nao_alcancado_orcamento' })
        somar(naoAlcancados, v.channel_id)
        resumo.pendentes++
        return
      }
      if (semLeitura.has(v.youtube_video_id)) {
        await registrarTentativa(ctx, { ...base, kind: 'meta', outcome: 'erro_http', error: 'erro de banco' })
        return
      }
      const ant = anteriores.get(v.youtube_video_id) ?? null
      const cap = captura.get(v.youtube_video_id) ?? null
      const ausente = !cap && respondeu.has(v.channel_id)
      const titulo = cap?.title ?? v.title
      const descricao = cap?.description ?? v.description
      const tags = cap ? cap.tags : v.tags
      const duracao = cap?.durationSeconds ?? v.duration_seconds
      const privacidadeBruta = cap?.privacyStatus ?? null
      const privacidade = privacidadeBruta !== null && PRIVACIDADES.includes(privacidadeBruta) ? privacidadeBruta : null
      if (privacidadeBruta !== null && privacidade === null) {
        pushUnico(ctx.falhas, `metadados: privacy_status desconhecido "${privacidadeBruta.slice(0, 40)}"`)
      }
      const short = shortSemSonda(duracao, titulo, ant)
      const foraThumb = ausente || privacidade === 'private'
      if (foraThumb) somar(foraDoCriterio, v.channel_id)

      // Seção 3 do spec: falha de thumbnail nunca impede a linha. Vale também para o prazo que acaba no meio da
      // captura: título e A/B vêm só do banco e já são conhecidos, e a linha deste dia não volta. Ela é gravada sem
      // os campos de thumbnail (como numa captura que falhou) e o resto da fila cai em `nao_alcancado_orcamento`.
      let thumb: ThumbCaptura
      let thumbSemTempo = false
      try {
        thumb = await capturarThumb(ctx, v, ant, f)
      } catch (e) {
        if (!(e instanceof SemTempoError)) throw e
        thumbSemTempo = true
        thumb = { ok: false, motivo: null, dhash: null, sha256: null, blobUrl: ant?.thumbnail_blob_url ?? null }
      }
      await registrarTentativa(ctx, {
        ...base,
        kind: 'thumbnail',
        outcome: thumb.ok ? 'ok' : thumbSemTempo ? 'nao_alcancado_orcamento' : 'erro_http',
        error: thumb.motivo,
      })
      // Sem tempo não é thumbnail que falhou: fica fora do critério "metade ou mais por 2 dias".
      if (!thumb.ok && !thumbSemTempo && !foraThumb) somar(thumbFalhas, v.channel_id)

      const testes = ab.testes.get(v.id) ?? []
      const idsDosTestes = new Set(testes.map(t => t.id))
      const abDia = ab.ok
        ? calcularAbDoDia({
            day,
            tests: testes,
            cycles: ab.ciclos.filter(c => idsDosTestes.has(c.test_id)),
            capturedAt: agora.getTime(),
            titleAtCapture: titulo,
          })
        : AB_ILEGIVEL

      // Descrição nula = não sabemos: hash nulo, sem texto. Nunca o hash de uma string vazia inventada.
      const descHash = descricao === null ? null : sha256(descricao)
      const tagsHash = sha256(JSON.stringify(tags ?? []))
      // Captura que falhou numa execução em que o dia já tem linha: os campos vindos da API na 1ª execução ficam
      // fora do payload (youtube_videos é mais velho que a API e rebaixaria a linha).
      const diaJaTemLinha = diaIlegivel.has(v.channel_id) || jaTemLinha.has(v.youtube_video_id)
      const preservar = !cap && diaJaTemLinha
      const linha: Record<string, unknown> = {
        site_id: v.site_id,
        youtube_video_id: v.youtube_video_id,
        day_pt: day,
        video_id: v.id,
        channel_id: v.channel_id,
        captured_at: capturedAt,
      }
      if (!preservar) {
        linha.title_at_capture = titulo
        linha.description_sha256 = descHash
        linha.tags_sha256 = tagsHash
      }
      // Nulo, nunca zero.
      if (!preservar && duracao !== null && duracao > 0) linha.duration_seconds = duracao
      // Segunda execução no mesmo dia: o que a primeira capturou não pode voltar a nulo porque esta falhou.
      // Thumbnail que não foi capturada e A/B que não foi lido ficam FORA do payload (no primeiro dia = nulo).
      if (thumb.ok) {
        linha.thumbnail_dhash = thumb.dhash
        linha.thumbnail_sha256_at_capture = thumb.sha256
      }
      if (ab.ok) {
        if (!(preservar && abDia.ab_test_id === null)) linha.title = abDia.title
        linha.ab_test_id = abDia.ab_test_id
        linha.ab_variant_id = abDia.ab_variant_id
        linha.seconds_on_air_analytics = abDia.seconds_on_air_analytics
        linha.seconds_other_analytics = abDia.seconds_other_analytics
        linha.seconds_on_air_reporting = abDia.seconds_on_air_reporting
        linha.seconds_other_reporting = abDia.seconds_other_reporting
        if (thumb.ok) linha.thumbnail_sha256 = abDia.thumbCopiaCaptura ? thumb.sha256 : null
      }
      // Estas três chaves nunca passam de não nulo a nulo: quando não há valor, ficam fora do payload.
      if (!preservar && descricao !== null && (!ant || ant.description_sha256 !== descHash)) linha.description_text = descricao
      if (!preservar && (!ant || ant.tags_sha256 !== tagsHash)) linha.tags = tags ?? []
      // Captura que falhou só repete a URL do dia anterior se o dia ainda não tem linha deste vídeo.
      if (thumb.blobUrl && (thumb.ok || !diaJaTemLinha)) linha.thumbnail_blob_url = thumb.blobUrl

      // Nunca de não nulo a nulo: sem valor, a chave fica fora do payload (uma segunda execução não apaga a primeira).
      if (privacidade !== null) linha.privacy_status = privacidade
      if (short.valor !== null) linha.is_short = short.valor

      const up = await ctx.supabase.from('yt_own_video_meta_daily').upsert(linha, { onConflict: 'youtube_video_id,day_pt' })
      const escrita = conferirBanco(up, 'yt_own_video_meta_daily', ctx.falhas)
      await registrarTentativa(ctx, {
        ...base,
        kind: 'meta',
        outcome: escrita === 'ok' ? (ausente ? 'erro_http' : 'ok') : escrita === 'schema_ausente' ? 'schema_ausente' : 'erro_http',
        error: escrita === 'ok' ? (ausente ? 'ausente de videos.list' : null) : 'erro de banco',
      })
      if (escrita === 'ok') {
        resumo.gravados++
        somar(gravadosPorCanal, v.channel_id)
        if (privacidade === null) resumo.sem_privacidade++
        if (short.sonda && duracao !== null) filaSonda.set(v.youtube_video_id, { dur: duracao, titulo })
        else if (short.valor === null) resumo.sem_is_short++
      }
    } catch (e) {
      if (e instanceof SemTempoError) {
        // Rede de segurança: a captura da thumbnail já trata o prazo e grava a linha. Se o prazo estourar em outro
        // ponto do item, não é erro de rede, é orçamento.
        await registrarTentativa(ctx, { ...base, kind: 'meta', outcome: 'nao_alcancado_orcamento' })
        somar(naoAlcancados, v.channel_id)
        resumo.pendentes++
        return
      }
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'metadados' }, extra: { video: v.youtube_video_id } })
      pushUnico(ctx.falhas, `metadados: ${canalPorId.get(v.channel_id)?.name ?? v.channel_id}: ${describeCronCause(e)}`)
      await registrarTentativa(ctx, { ...base, kind: 'meta', outcome: 'erro_http', error: describeCronCause(e) })
    }
  })

  // Sonda de Shorts (61 a 180 s), só depois de todas as linhas gravadas: o que estava no ar não volta, a
  // classificação sim. Sem confirmação, is_short fica nulo e o vídeo é sondado de novo no dia seguinte.
  if (filaSonda.size > 0) {
    let sondas = new Map<string, 'short' | 'normal' | 'inconclusive'>()
    if (restante(ctx.deadline) > 0) {
      try {
        sondas = await probeShortsBatch([...filaSonda.keys()], newProbeBudget(), f, () => restante(ctx.deadline) <= 0)
      } catch (e) {
        Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'metadados' } })
      }
    }
    for (const [id, info] of filaSonda) {
      const veredito = classifyShort({ durationSeconds: info.dur, title: info.titulo, probe: sondas.get(id) ?? null })
      if (!veredito.confirmed) { resumo.sem_is_short++; continue }
      const up = await ctx.supabase
        .from('yt_own_video_meta_daily')
        .update({ is_short: veredito.isShort })
        .eq('youtube_video_id', id)
        .eq('day_pt', day)
      if (conferirBanco(up, 'yt_own_video_meta_daily', ctx.falhas) !== 'ok') resumo.sem_is_short++
    }
  }

  // Critérios da seção 9 que valem para este passo.
  for (const c of canais) {
    const esperados = videos.filter(v => v.channel_id === c.id).length
    if (esperados === 0) continue
    const devidos = esperados - (naoAlcancados.get(c.id) ?? 0)
    const cont = await ctx.supabase
      .from('yt_own_video_meta_daily')
      .select('youtube_video_id', { count: 'exact', head: true })
      .eq('channel_id', c.id)
      .eq('day_pt', day)
    // Contagem ilegível: a falha já entrou em falhas; cai no que este passo gravou, nunca em zero.
    const comLinha = conferirBanco(cont, 'yt_own_video_meta_daily', ctx.falhas, 'ler') === 'ok'
      ? (cont.count ?? 0)
      : (gravadosPorCanal.get(c.id) ?? 0)
    if (comLinha < devidos) pushUnico(ctx.falhas, `metadados: ${c.name} tem ${comLinha} de ${devidos} vídeos com linha em ${day}`)

    const falhasHoje = thumbFalhas.get(c.id) ?? 0
    const contamHoje = devidos - (foraDoCriterio.get(c.id) ?? 0)
    if (contamHoje > 0 && falhasHoje * 2 >= contamHoje) {
      const ontem = await ctx.supabase
        .from('yt_own_collection_attempts')
        .select('outcome')
        .eq('kind', 'thumbnail')
        .eq('channel_id', c.id)
        .eq('attempt_day', addDays(utcDay(agora), -1))
      if (conferirBanco(ontem, 'yt_own_collection_attempts', ctx.falhas, 'ler') !== 'ok') continue
      // Tentativa que ficou sem tempo ontem não é thumbnail que falhou nem que deu certo: sai da conta.
      const linhas = ((ontem.data ?? []) as Array<{ outcome: string }>).filter(l => l.outcome !== 'nao_alcancado_orcamento')
      const ruins = linhas.filter(l => l.outcome !== 'ok').length
      if (linhas.length > 0 && ruins * 2 >= linhas.length) {
        pushUnico(ctx.falhas, `metadados: thumbnail falhou em metade ou mais dos vídeos de ${c.name} por 2 dias`)
      }
    }
  }

  return fechar()
}
