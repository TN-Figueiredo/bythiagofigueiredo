import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { emParalelo } from '@/lib/util/em-paralelo'
import { createNotification } from '@/lib/notifications/create'
import { getSiteOwners, logSemDestinatario } from '@/lib/notifications/get-site-owners'
import { DHASH_MAX_SAME, hamming, probeThumb } from '@/lib/youtube/thumb-fingerprint'
import { dhashDasVariantes } from '@/lib/youtube/ab-variant-dhash'
import { ORIGINAL, settleOnAir } from '@/lib/youtube/ab-settle'
import type { ResultadoSaida } from '@/lib/youtube/ab-settle'
import { avisarRestauracao } from '@/lib/youtube/ab-restore-avisos'
import { converterInterrompido, paraRestoreStatus } from '@/lib/youtube/ab-restore'
import type { CampoNome, RestoreStatus } from '@/lib/youtube/ab-restore'
import { DRIFT_STATUS_NOTE } from '@/lib/youtube/ab-types'

/**
 * Corte para NOVAS sondas; a rota tem 60 s (`maxDuration`). Conta: 60 - 40 (pior teste: HEAD 10 s + GET 15 s da sonda
 * + 15 s do Blob da variante, em série dentro de um teste) - 5 (`recordCron` e resposta) = 15 s. Além do corte, os
 * `fetch` da sonda e do Blob param em `inicio + FIM_DAS_LEITURAS_MS`, para o `recordCron` sempre rodar.
 */
export const ORCAMENTO_VIGIA_MS = 15_000
export const FIM_DAS_LEITURAS_MS = 50_000
/**
 * F-D3: com `prazo = inicio + 55 s`, uma saída iniciada aos 15 s da rota ainda tem 40 s (>= 25 s da escrita + latência).
 * Depois disso o drift detectado vira `adiados` (o próximo vigia, 10 h depois, tenta de novo) em vez de começar uma
 * escrita que o prazo cortaria no meio.
 */
export const NAO_INICIA_SETTLE_DEPOIS_MS = 15_000
export const PRAZO_DA_ROTA_MS = 55_000
export const LIMITE_PADRAO = 4
const CICLO_MINIMO_MS = 3 * 3_600_000 // o CDN do YouTube precisa de tempo para propagar a thumbnail enviada

export interface ResultadoDrift {
  verificados: number
  pausados: number
  pausadosPorTesteYoutube: number // pausa convertida pela guarda do teste do YouTube: sem aviso de drift
  falhas: number
  adiados: number
  interrompidos: number
  semDestinatario: boolean
}

export interface RelogioDoVigia { agora: () => number; inicio: number }

/** Portas só para teste; em produção valem os padrões. */
export interface PortasDoVigia { settle?: typeof settleOnAir; semInterrompidos?: boolean /* a rota já converteu antes das fases (P4b Y-6) */ }

interface TesteAtivo { id: string; site_id: string; test_type: string; youtube_video_id: string; restore_seq: number }
interface Ciclo { test_id: string; variant_id: string; started_at: string }
interface VarianteLinha { id: string; blob_url: string | null; thumbnail_dhash: string | null }
interface TesteInterrompido { id: string; site_id: string; name: string; restore_seq: number; restore_status: unknown }

const CAMPOS: CampoNome[] = ['title', 'thumbnail']

function ler<T>(r: { data: unknown; error: { message: string } | null }, contexto: string): T[] {
  if (r.error) throw new Error(`ab-watchdog: ${contexto}: ${r.error.message}`)
  return (r.data ?? []) as T[]
}

/** Item 1 (32 D1): em_andamento há mais de 15 min vira falhou/'interrompido'. Só banco; roda sempre (F-D2). */
async function converterInterrompidos(supabase: SupabaseClient, agora: Date, r: ResultadoDrift): Promise<void> {
  const testes = ler<TesteInterrompido>(await supabase
    .from('ab_tests')
    .select('id, site_id, name, restore_seq, restore_status')
    .or('restore_status->title->>estado.eq.em_andamento,restore_status->thumbnail->>estado.eq.em_andamento'), 'interrompidos')
  for (const t of testes) {
    const rs = paraRestoreStatus(t.restore_status)
    if (!rs) { // o `.or()` achou pelo jsonb cru: ilegível com em_andamento nunca converte; não pode ficar mudo
      r.falhas++
      Sentry.captureMessage('ab-watchdog: restore_status ilegível', { extra: { testId: t.id } })
      continue
    }
    const novo: RestoreStatus = { ...rs }
    const convertidos: RestoreStatus = {}
    for (const campo of CAMPOS) {
      const atual = rs[campo]
      const convertido = atual ? converterInterrompido(atual, agora) : null
      if (convertido) { novo[campo] = convertido; convertidos[campo] = convertido }
    }
    if (Object.keys(convertidos).length === 0) continue // 14 min: não toca
    const seq = t.restore_seq + 1
    const claim = await supabase.from('ab_tests').update({ restore_seq: seq, restore_status: novo }).eq('id', t.id).eq('restore_seq', t.restore_seq).select('id')
    if (claim.error) throw new Error(`ab-watchdog: reivindicar ${t.id}: ${claim.error.message}`)
    if (((claim.data ?? []) as unknown[]).length === 0) continue // outro escritor andou: ele é o dono
    r.interrompidos++
    // Só os campos convertidos agora: um `falhou` antigo do outro campo já foi avisado no seq dele.
    const aviso = await avisarRestauracao(supabase, { id: t.id, site_id: t.site_id, name: t.name, restore_seq: seq }, convertidos)
      .catch((e: unknown) => { Sentry.captureException(e, { tags: { area: 'ab-watchdog' } }); return 'falha_de_envio' as const })
    if (aviso === 'sem_destinatario') r.semDestinatario = true
    if (aviso === 'falha_de_envio') r.falhas++
  }
}

async function avisarDrift(supabase: SupabaseClient, t: TesteAtivo, resultado: Extract<ResultadoSaida, { resultado: 'feito' }>, r: ResultadoDrift): Promise<void> {
  const owners = await getSiteOwners(supabase, t.site_id)
  if (owners.length === 0) { r.semDestinatario = true; logSemDestinatario('ab-watchdog:drift', t.site_id) }
  const naoVoltou = resultado.campos.thumbnail?.estado === 'falhou'
  for (const owner of owners) {
    const res = await createNotification({
      site_id: t.site_id,
      user_id: owner.userId,
      type: 'youtube.drift_detected',
      domain: 'youtube',
      priority: 1,
      title: DRIFT_STATUS_NOTE,
      message: naoVoltou
        ? 'O Lab pausou o teste porque a thumbnail foi trocada por fora e não conseguiu devolver a original: a variante pode continuar no ar. Troque a thumbnail no YouTube Studio e abra o teste para decidir.'
        : 'O Lab pausou o teste porque a thumbnail foi trocada por fora. Abra o teste para decidir: reconhecer a mudança e retomar, ou encerrar.',
      action_href: `/cms/youtube/ab-lab/${t.id}`,
      dedup_key: `drift-${t.id}-${new Date().toISOString().slice(0, 10)}`,
    })
    if (!res.success) { // suppressed com success é dedupe legítimo
      r.falhas++
      Sentry.captureMessage('ab-watchdog: aviso de drift não gravado', { extra: { testId: t.id, erro: res.error } })
    }
  }
}

/** Item 2 (3.3): compara a imagem no ar (dHash da hqdefault) com a da variante do ciclo aberto. */
async function detectarDrift(
  supabase: SupabaseClient, relogio: RelogioDoVigia, f: typeof fetch, limite: number, portas: PortasDoVigia, r: ResultadoDrift,
): Promise<void> {
  const testes = ler<TesteAtivo>(await supabase
    .from('ab_tests')
    .select('id, site_id, test_type, youtube_video_id, restore_seq')
    .eq('status', 'active')
    .in('test_type', ['thumbnail', 'combo'])
    .is('last_applied_variant_id', null), 'testes ativos') // Y-D13: marcador não nulo = rotação em voo ou queda
  if (testes.length === 0) return

  const [ciclosR, videosR] = await Promise.all([
    supabase.from('ab_test_cycles').select('test_id, variant_id, started_at').in('test_id', testes.map((t) => t.id)).is('ended_at', null),
    supabase.from('youtube_videos').select('id, youtube_video_id').in('id', [...new Set(testes.map((t) => t.youtube_video_id))]),
  ])
  const ciclos = new Map(ler<Ciclo>(ciclosR, 'ciclos abertos').map((c) => [c.test_id, c]))
  const videos = new Map(ler<{ id: string; youtube_video_id: string }>(videosR, 'vídeos').map((v) => [v.id, v.youtube_video_id]))
  const variantIds = [...new Set([...ciclos.values()].map((c) => c.variant_id))]
  const variantes = variantIds.length
    ? new Map(ler<VarianteLinha>(await supabase.from('ab_test_variants').select('id, blob_url, thumbnail_dhash').in('id', variantIds), 'variantes').map((v) => [v.id, v]))
    : new Map<string, VarianteLinha>()
  const settle = portas.settle ?? settleOnAir
  // Só a sonda e o Blob: o settle tem o `prazo` dele. Sem isso uma leitura lenta passa dos 60 s e some do cron_health.
  const fLeitura: typeof fetch = (u, i) => {
    const limite = AbortSignal.timeout(Math.max(0, relogio.inicio + FIM_DAS_LEITURAS_MS - relogio.agora()))
    return f(u, { ...i, signal: i?.signal ? AbortSignal.any([i.signal, limite]) : limite })
  }

  const verificar = async (t: TesteAtivo): Promise<void> => {
    const ciclo = ciclos.get(t.id)
    const youtubeId = videos.get(t.youtube_video_id)
    if (!ciclo || !youtubeId) { // ativo com marcador nulo e sem ciclo aberto/sem vídeo: estado que não deveria existir
      r.falhas++
      Sentry.captureMessage('ab-watchdog: teste ativo sem ciclo aberto/sem vídeo', { extra: { testId: t.id, temCiclo: !!ciclo, temVideo: !!youtubeId } })
      return
    }
    if (relogio.agora() - new Date(ciclo.started_at).getTime() < CICLO_MINIMO_MS) return
    try {
      const variante = variantes.get(ciclo.variant_id)
      const [probe, bases] = await Promise.all([ // falha da sonda nunca é "sem drift"
        probeThumb(youtubeId, null, fLeitura),
        variante ? dhashDasVariantes(supabase, [variante], fLeitura) : Promise.resolve(undefined),
      ])
      const base = variante ? bases?.get(variante.id) : undefined
      if (!probe.dhash || base?.tipo !== 'ok') { r.falhas++; return }
      r.verificados++
      if (hamming(probe.dhash, base.dhash) <= DHASH_MAX_SAME) return
      if (relogio.agora() - relogio.inicio > NAO_INICIA_SETTLE_DEPOIS_MS) { r.adiados++; return }
      const saida = await settle(t.id, {
        siteId: t.site_id, destino: ORIGINAL, motivo: 'drift', seqEsperado: t.restore_seq, prazo: relogio.inicio + PRAZO_DA_ROTA_MS,
      }, { supabase, fetch: f })
      if (saida.resultado !== 'feito') return // seq mudou ou já encerrado: não pausa, sem falha
      if (saida.pausadoPorTesteYoutube) { r.pausadosPorTesteYoutube++; return } // o aviso de drift diria "retome", e retomar é recusado enquanto o teste do YouTube durar
      r.pausados++
      if (saida.aviso === 'sem_destinatario') r.semDestinatario = true
      if (saida.aviso === 'falha_de_envio') r.falhas++
      await avisarDrift(supabase, t, saida, r)
    } catch (e) {
      r.falhas++
      Sentry.captureException(e, { tags: { area: 'ab-watchdog', fase: 'drift' }, extra: { testId: t.id } })
    }
  }

  const { adiados } = await emParalelo(testes, limite, verificar, () => relogio.agora() - relogio.inicio >= ORCAMENTO_VIGIA_MS)
  r.adiados += adiados
}

/** Conversão do `em_andamento` interrompido com o catch próprio: um defeito aqui não pode deixar o teste ativo sem a checagem de drift. */
export async function converterInterrompidosDoVigia(supabase: SupabaseClient, relogio: RelogioDoVigia, r: ResultadoDrift): Promise<void> {
  try {
    await converterInterrompidos(supabase, new Date(relogio.agora()), r)
  } catch (e) {
    r.falhas++
    Sentry.captureException(e, { tags: { area: 'ab-watchdog', fase: 'interrompidos' } })
  }
}

export async function faseDriftEInterrompidos(
  supabase: SupabaseClient,
  relogio: RelogioDoVigia,
  f: typeof fetch = fetch,
  limite: number = LIMITE_PADRAO,
  portas: PortasDoVigia = {},
): Promise<ResultadoDrift> {
  const r: ResultadoDrift = { verificados: 0, pausados: 0, pausadosPorTesteYoutube: 0, falhas: 0, adiados: 0, interrompidos: 0, semDestinatario: false }
  if (!portas.semInterrompidos) await converterInterrompidosDoVigia(supabase, relogio, r)
  try {
    await detectarDrift(supabase, relogio, f, limite, portas, r)
  } catch (e) { // erro de leitura não pode apagar o que a conversão já gravou da resposta
    r.falhas++
    Sentry.captureException(e, { tags: { area: 'ab-watchdog', fase: 'drift' } })
  }
  return r
}
