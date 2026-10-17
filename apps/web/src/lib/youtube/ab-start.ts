/**
 * Core "start a test" logic — NOT a server action.
 *
 * Security note: `'use server'` modules expose every export as an HTTP endpoint.
 * This file intentionally has NO `'use server'` directive so it can be called
 * safely from both the server action (actions.ts) and the cron job without
 * exposing internal functions to the network.
 */

import { TestTypeSchema, DESCRICAO_FORA_DO_TESTE, pedeDescricao } from './ab-schemas'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { channelAccountIdForVideo, CHANNEL_NOT_IDENTIFIED_MESSAGE } from '@/lib/youtube/channel-account'
import { applyVariantToYouTube, antesDeEscreverPorSeq } from '@/lib/youtube/ab-apply'
import { motivoVarianteSemConteudo } from '@/lib/youtube/ab-rotate-claim'
import { MARGEM_ESCRITA_MS, TETO_MS } from '@/lib/youtube/ab-settle'
import { fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'
import { MSG_EM_ANDAMENTO } from '@/lib/youtube/ab-acao-saida'
import { converterInterrompido, paraRestoreStatus } from '@/lib/youtube/ab-restore'
import type { CampoNome, RestoreStatus } from '@/lib/youtube/ab-restore'
import { avisarRestauracao } from '@/lib/youtube/ab-restore-avisos'
import { lerSnippet } from '@/lib/youtube/ab-metadata'
import { guardarOriginalMaior } from '@/lib/youtube/ab-variant-dhash'
import { DHASH_MAX_SAME, hamming, probeThumb } from '@/lib/youtube/thumb-fingerprint'
import { getVariantForCycle } from '@/lib/youtube/ab-rotation'
import type { AppliedMetadata, TestType } from '@/lib/youtube/ab-types'

// ---------------------------------------------------------------------------
// Internal helper — mirrors the one in actions.ts (kept separate to avoid
// importing from a 'use server' file, which would pull in Next.js server
// action machinery and potentially re-export network-accessible endpoints).
// ---------------------------------------------------------------------------

async function resolveYouTubeVideoId(
  supabase: SupabaseClient,
  internalVideoId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id')
    .eq('id', internalVideoId)
    .single()
  return (data?.youtube_video_id as string | null) ?? null
}

// ---------------------------------------------------------------------------
// Testes anteriores do mesmo vídeo (Y-5, emenda 46)
// ---------------------------------------------------------------------------

const CAMPOS_DO_VIDEO: CampoNome[] = ['title', 'thumbnail']
const FINAIS_QUE_DESISTEM = new Set(['falhou', 'pulado_sem_original', 'pulado_drift'])

/** Reivindica por restore_seq e grava `restore_status`; devolve o novo restore_seq, ou null se outro escritor ganhou. */
async function reivindicarRestoreStatus(supabase: SupabaseClient, testId: string, seq: number, rs: RestoreStatus): Promise<number | null> {
  const { data, error } = await supabase
    .from('ab_tests')
    .update({ restore_seq: seq + 1, restore_status: rs })
    .eq('id', testId)
    .eq('restore_seq', seq)
    .select('restore_seq')
  if (error) throw new Error(`ab-start: reivindicação do teste ${testId}: ${error.message}`)
  return (data as Array<{ restore_seq: number }> | null)?.[0]?.restore_seq ?? null
}

/**
 * Y-5 (a): (i) só em banco e sempre: campo `em_andamento` há mais de 15 min vira `falhou/interrompido` ANTES de
 * `desistiu`, para a linha do histórico existir (duas reivindicações = dois restore_seq = duas linhas); (ii) campos
 * `falhou`/`pulado_*` viram `desistiu/novo_teste` (`em` = agora, `escreveu` false, `attempts` mantido; F-P11) e o dono
 * recebe UM aviso por teste afetado. Campo já `desistiu` não é regravado (nova linha e novo aviso seriam ruído).
 * Nunca lança: a contabilidade de outro teste não pode impedir o início deste (o erro vai ao Sentry).
 */
async function resolverPendenciasDoVideo(
  supabase: SupabaseClient, siteId: string, testId: string, internalVideoId: string, agora: Date,
): Promise<void> {
  const { data } = await supabase
    .from('ab_tests')
    .select('id, site_id, name, restore_seq, restore_status')
    .eq('site_id', siteId)
    .eq('youtube_video_id', internalVideoId)
  type Outro = { id: string; site_id: string; name: string | null; restore_seq: number; restore_status: unknown }
  for (const outro of ((data ?? []) as Outro[]).filter((o) => o.id !== testId)) {
    try {
      let rs = paraRestoreStatus(outro.restore_status)
      if (!rs) continue
      let seq = outro.restore_seq

      const convertido: RestoreStatus = { ...rs }
      let converteu = false
      for (const c of CAMPOS_DO_VIDEO) {
        const campo = rs[c]
        const novo = campo ? converterInterrompido(campo, agora) : null
        if (novo) { convertido[c] = novo; converteu = true }
      }
      if (converteu) {
        const proximo = await reivindicarRestoreStatus(supabase, outro.id, seq, convertido)
        if (proximo === null) continue // outro escritor ganhou: não mexe
        seq = proximo
        rs = convertido
      }

      const desistido: RestoreStatus = { ...rs }
      let desistiu = false
      for (const c of CAMPOS_DO_VIDEO) {
        const campo = rs[c]
        if (!campo || !FINAIS_QUE_DESISTEM.has(campo.estado)) continue
        desistido[c] = { ...campo, estado: 'desistiu', motivo: 'novo_teste', em: agora.toISOString(), escreveu: false }
        desistiu = true
      }
      if (!desistiu) continue
      const proximo = await reivindicarRestoreStatus(supabase, outro.id, seq, desistido)
      if (proximo === null) continue
      await avisarRestauracao(supabase, { id: outro.id, site_id: outro.site_id, name: outro.name ?? '', restore_seq: proximo }, desistido)
    } catch (e) {
      Sentry.captureException(e, { tags: { area: 'ab-start' }, extra: { testId, outroTesteId: outro.id, context: 'pendencias-do-video' } })
    }
  }
}

// ---------------------------------------------------------------------------
// startAbTestInternal
// ---------------------------------------------------------------------------

/** Aviso ao dono: a thumbnail da variante ficou no ar e a volta ao original falhou. TEXTO-A-REVISAR (Logan, T17). */
async function avisarInicioParcial(siteId: string, testId: string, youtubeVideoId: string): Promise<void> {
  try {
    await fanOutToSiteAdminsDetailed({
      siteId,
      domain: 'youtube',
      type: 'youtube.ab_start_partial',
      priority: 1,
      title: 'A/B: confira a thumbnail do vídeo',
      message: `O teste não começou, mas a thumbnail da variante pode ter ficado no ar no vídeo ${youtubeVideoId}. Confira e troque pela original se precisar.`,
      dedupKey: `ab-start-partial:${testId}:${new Date().toISOString().slice(0, 10)}`,
      actionHref: `/cms/youtube/ab-lab/${testId}`,
      payload: { testId },
    })
  } catch (e) {
    Sentry.captureException(e, { tags: { area: 'ab-start' }, extra: { testId, context: 'aviso-inicio-parcial' } })
  }
}

/** Volta um teste reivindicado para `draft`, só se o restore_seq ainda é o nosso (nenhuma outra ação mexeu). */
async function voltarParaRascunho(supabase: SupabaseClient, testId: string, seq: number): Promise<void> {
  const { error } = await supabase
    .from('ab_tests')
    .update({ status: 'draft', started_at: null })
    .eq('id', testId)
    .eq('status', 'active')
    .eq('restore_seq', seq)
  if (error) Sentry.captureException(new Error(error.message), { tags: { area: 'ab-start' }, extra: { testId, context: 'voltar-a-rascunho' } })
}

interface VarianteInicio {
  id: string
  label: string
  is_original: boolean
  blob_url: string | null
  title_text: string | null
  thumbnail_dhash: string | null
  sort_order: number
}

export interface PortasInicio {
  supabase: SupabaseClient
  agora: () => Date
}

/**
 * Start an AB test given its ID and the site it belongs to.
 *
 * Callers are responsible for:
 * - Authentication / authorisation (the server action wraps this with requireEditAccess)
 * - Cache invalidation (revalidateTag) after a successful return
 *
 * Ordem (P4a, emendas 32 m, 46): (0) variante sem imagem recusa antes de qualquer escrita; (0b) pendências de outros
 * testes do vídeo; (1) reivindica `draft -> active` com `restore_seq + 1` (zero linhas = outro processo ganhou); (2) relê
 * título e thumbnail do YouTube e grava o que mudou como original; (3) escreve a 1ª variante, se não for a original;
 * (4) abre o ciclo 0 por `ab_resume_commit`. Qualquer falha depois de (1) volta o teste a `draft`.
 */
export async function startAbTestInternal(
  testId: string,
  siteId: string,
  portas: Partial<PortasInicio> = {},
): Promise<{ ok: boolean; error?: string }> {
  const supabase = portas.supabase ?? getSupabaseServiceClient()
  const agora = portas.agora ?? (() => new Date())
  const prazo = agora().getTime() + TETO_MS // F-D3: ação humana (e cron da fila), início + 55 s

  // 1. Fetch the test row and validate ownership + status.
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, site_id, status, youtube_video_id, test_type, restore_seq, restore_status, original_title')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (testError || !test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Only draft tests can be started' }
  if (pedeDescricao({ test_type: test.test_type })) return { ok: false, error: DESCRICAO_FORA_DO_TESTE.message }
  if (!TestTypeSchema.safeParse(test.test_type).success) return { ok: false, error: 'Tipo de teste desconhecido' }
  const testType = test.test_type as TestType

  // 2. Fetch variants.
  const { data: variants, error: variantsError } = await supabase
    .from('ab_test_variants')
    .select('id, label, is_original, blob_url, title_text, thumbnail_dhash, sort_order')
    .eq('test_id', testId)
    .order('sort_order', { ascending: true })

  if (variantsError) return { ok: false, error: variantsError.message }
  if (!variants || variants.length < 2) {
    return { ok: false, error: 'A test needs at least 2 variants (original + 1) to start' }
  }

  // (0) Variante de thumbnail sem imagem: recusa antes de qualquer escrita (P4a-I11).
  if (testType === 'thumbnail' || testType === 'combo') {
    const semImagem = (variants as VarianteInicio[]).find((v) => !v.is_original && !v.blob_url)
    if (semImagem) return { ok: false, error: `a variante ${semImagem.label} não tem imagem` }
  }

  // 3. Compute the first variant via rotation.
  const firstIndex = getVariantForCycle(variants.length, 0)
  if (firstIndex < 0 || firstIndex >= variants.length) {
    return { ok: false, error: 'Invalid variant rotation index' }
  }
  const firstVariant = variants[firstIndex] as VarianteInicio

  // Guarda de conteúdo (T9 R1): a 1ª variante, se vai ser escrita, precisa de cópia no Blob e de título.
  if (!firstVariant.is_original) {
    const semConteudo = motivoVarianteSemConteudo(testType, firstVariant, test.original_title as string | null)
    // TEXTO-A-REVISAR (Logan, T17)
    if (semConteudo) return { ok: false, error: `O teste não começou: a variante ${firstVariant.label} está ${semConteudo}. Abra o teste e confira as variantes.` }
  }

  // 4. Canal e token (só leitura): falha aqui não toca em nada.
  let accessToken: string
  let youtubeVideoId: string
  try {
    let channelAccountId: string | null
    try {
      channelAccountId = await channelAccountIdForVideo(supabase, siteId, test.youtube_video_id as string)
    } catch (resolveErr) {
      // Só a falha de ler o canal vira mensagem genérica (o detalhe, do banco, vai ao Sentry).
      Sentry.captureException(resolveErr, { tags: { area: 'ab-start' }, extra: { testId } })
      return { ok: false, error: 'Could not start the test: the YouTube channel could not be read. Try again.' }
    }
    if (!channelAccountId) {
      return { ok: false, error: CHANNEL_NOT_IDENTIFIED_MESSAGE }
    }
    ;({ accessToken } = await ensureFreshToken(siteId, 'youtube', channelAccountId))
    const ytId = await resolveYouTubeVideoId(supabase, test.youtube_video_id as string)
    if (!ytId) return { ok: false, error: 'YouTube video ID not found' }
    youtubeVideoId = ytId
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  // (0b) Pendências de outros testes do mesmo vídeo (só banco; roda sempre).
  await resolverPendenciasDoVideo(supabase, siteId, testId, test.youtube_video_id as string, agora())

  // (1) Reivindica draft -> active. `restore_status` nunca fica nulo depois da P4a (F-P3): o supabase-js não faz
  // `coalesce` em coluna, então grava o valor lido (ou {}) sob a guarda de restore_seq, que é equivalente.
  const lidoSeq = test.restore_seq as number
  const agoraIso = agora().toISOString()
  const { data: reivindicado, error: updateError } = await supabase
    .from('ab_tests')
    .update({
      status: 'active', started_at: agoraIso, paused_at: null, updated_at: agoraIso,
      restore_seq: lidoSeq + 1, restore_status: test.restore_status ?? {},
    })
    .eq('id', testId)
    .eq('status', 'draft')
    .eq('restore_seq', lidoSeq)
    .select('restore_seq')

  if (updateError) return { ok: false, error: updateError.message }
  const seq = (reivindicado as Array<{ restore_seq: number }> | null)?.[0]?.restore_seq
  if (seq === undefined) return { ok: false, error: 'Teste já iniciado por outro processo' }

  const desfazer = async (error: string): Promise<{ ok: false; error: string }> => {
    await voltarParaRascunho(supabase, testId, seq)
    return { ok: false, error }
  }

  // (2) Relê título e thumbnail no YouTube; o que mudou desde a criação vira o original.
  const comTitulo = testType === 'title' || testType === 'combo'
  const comThumb = testType === 'thumbnail' || testType === 'combo'
  const original = (variants as VarianteInicio[]).find((v) => v.is_original)
  const patchTeste: Record<string, unknown> = {}
  let guardada: Awaited<ReturnType<typeof guardarOriginalMaior>> | null = null
  try {
    if (comTitulo) {
      const snippet = await lerSnippet(youtubeVideoId, accessToken)
      if (!snippet) return await desfazer('Vídeo não encontrado no YouTube')
      if (snippet.title !== test.original_title) patchTeste.original_title = snippet.title
    }
    if (comThumb) {
      const sonda = await probeThumb(youtubeVideoId, null)
      if (!sonda.dhash) return await desfazer('Não foi possível ler a thumbnail atual do vídeo. Tente de novo.')
      const guardado = original?.thumbnail_dhash ?? null
      if (guardado === null || hamming(guardado, sonda.dhash) > DHASH_MAX_SAME) {
        guardada = await guardarOriginalMaior(youtubeVideoId, testId)
        patchTeste.original_thumbnail_url = guardada.url
      }
    }
  } catch (e) {
    return await desfazer((e as Error).message)
  }
  if (Object.keys(patchTeste).length > 0) {
    const { data: gravado, error: erroPatch } = await supabase
      .from('ab_tests').update(patchTeste).eq('id', testId).eq('restore_seq', seq).select('restore_seq')
    if (erroPatch) return await desfazer(erroPatch.message)
    if (!gravado || gravado.length === 0) return { ok: false, error: MSG_EM_ANDAMENTO }
  }
  if (guardada && original) {
    const { error: erroVariante } = await supabase
      .from('ab_test_variants')
      .update({ blob_url: guardada.url, thumbnail_dhash: guardada.dhash, dimensions: `${guardada.largura}x${guardada.altura}` })
      .eq('id', original.id)
    if (erroVariante) return await desfazer(erroVariante.message)
  }

  // (3) Escreve a 1ª variante, se não for a original.
  const cycle0Meta: AppliedMetadata = {}
  if (!firstVariant.is_original) {
    if (prazo - agora().getTime() < MARGEM_ESCRITA_MS) {
      // TEXTO-A-REVISAR (Logan, T17)
      return await desfazer('O YouTube demorou demais. Tente de novo.')
    }
    const opcoesApply = { antesDeEscrever: antesDeEscreverPorSeq(supabase, testId, seq), prazo, agora: () => agora().getTime() }
    const aplicado = await applyVariantToYouTube(
      {
        youtubeVideoId,
        accessToken,
        testType,
        variant: { id: firstVariant.id, blob_url: firstVariant.blob_url, title_text: firstVariant.title_text },
        originalTitle: (patchTeste.original_title as string | undefined) ?? (test.original_title as string | null),
      },
      opcoesApply,
    )
    if (aplicado.perdeuAVez) return { ok: false, error: MSG_EM_ANDAMENTO }
    if (!aplicado.ok && aplicado.appliedThumbnail && original) {
      // Combo: a thumbnail da variante entrou e o título não. Volta a thumbnail original antes de `desfazer`.
      const blobOriginal = guardada?.url ?? original.blob_url
      const volta = blobOriginal
        ? await applyVariantToYouTube(
            { youtubeVideoId, accessToken, testType: 'thumbnail', variant: { id: original.id, blob_url: blobOriginal, title_text: null }, originalTitle: null },
            opcoesApply,
          )
        : null
      if (!volta?.ok) {
        Sentry.captureMessage('ab-start: thumbnail da variante ficou no ar depois de falha no início', { level: 'error', extra: { testId } })
        await avisarInicioParcial(siteId, testId, youtubeVideoId)
      }
    }
    if (!aplicado.ok) {
      // TEXTO-A-REVISAR (Logan, T17)
      return await desfazer(aplicado.tempoEsgotado ? 'O YouTube demorou demais. Tente de novo.' : (aplicado.error ?? 'apply failed'))
    }
    Object.assign(cycle0Meta, aplicado.meta)
  } else {
    // Original stays on YouTube — snapshot current URL for drift baseline
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      Sentry.addBreadcrumb({
        category: 'ab-start',
        message: 'YOUTUBE_API_KEY not set — cycle 0 will have no drift baseline',
        level: 'warning',
      })
    }
    if (apiKey) {
      try {
        const ytRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${youtubeVideoId}&key=${apiKey}`,
          { signal: AbortSignal.timeout(10_000) },
        )
        if (ytRes.ok) {
          const ytData = await ytRes.json()
          const highUrl = ytData?.items?.[0]?.snippet?.thumbnails?.high?.url
          if (typeof highUrl === 'string') {
            cycle0Meta.youtube_thumbnail_url = highUrl
          }
        }
      } catch {
        // Non-fatal
      }
    }
  }

  // (4) Abre o ciclo 0 (mesma função de retomar, D12): nenhum teste `active` fica sem ciclo aberto.
  const { data: cicloId, error: cycleError } = await supabase.rpc('ab_resume_commit', {
    p_test_id: testId,
    p_seq: seq,
    p_de: 'active',
    p_variant_id: firstVariant.id,
    p_applied_metadata: Object.keys(cycle0Meta).length ? cycle0Meta : {},
  })
  if (cycleError) return await desfazer(cycleError.message)
  if (!cicloId) return { ok: false, error: MSG_EM_ANDAMENTO }

  return { ok: true }
}
