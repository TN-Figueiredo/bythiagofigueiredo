'use server'

import { isCertainShort } from '@/lib/youtube/short-classifier'
import * as Sentry from '@sentry/nextjs'
import { revalidatePath, revalidateTag } from 'next/cache'
import { put } from '@vercel/blob'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireEditUser } from '@/lib/youtube/ab-lab-acesso'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { denyUnlessSiteAdmin } from '@/lib/cms/auth-guards'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/types/database.types'
import { z } from 'zod'
import { refTrocaValida } from '@/lib/youtube/ab-referencia'
import { AB_TEST_CONFIG_DEFAULTS, VARIANT_LABELS } from '@/lib/youtube/ab-types'
import type {
  AbTestCreateInput,
  AbTestVariantRow,
  AbTestSiteSettings,
  TestType,
  CreateTextVariantInput,
  VariantMetadata,
} from '@/lib/youtube/ab-types'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { channelAccountIdForVideo } from '@/lib/youtube/channel-account'
import { preflightTokenCheck } from '@/lib/youtube/ab-preflight'
import { setThumbnail, fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { resolveVideoChannel } from '@/lib/youtube/ab-video-context'
import { getVariantForCycle, getNextVariantIndex } from '@/lib/youtube/ab-rotation'
import { captureOriginalMetadata, updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { TestTypeSchema, DESCRICAO_FORA_DO_TESTE, pedeDescricao } from '@/lib/youtube/ab-schemas'
import { getChannelTier } from '@/lib/youtube/scoring'
import { scoreForPrompt } from '@/lib/youtube/prompt-scoring'
import type { AbBriefingData } from '@/lib/youtube/prompt-types'
import { guardarOriginalMaior, dhashOuNulo } from '@/lib/youtube/ab-variant-dhash'
import { guardaDoPonto } from '@/lib/youtube/teste-youtube/nativo/aplicar-guarda'
import { startAbTestInternal } from '@/lib/youtube/ab-start'
import type { CodigoRecusaNativa } from '@/lib/youtube/teste-youtube/nativo/aplicar-guarda'
import { retomarTeste, recusaTipoForaDeUso } from '@/lib/youtube/ab-resume'
import { reivindicarRotacao, aplicarRotacao, motivoVarianteSemConteudo, avisarRotacaoSemConteudo } from '@/lib/youtube/ab-rotate-claim'
import { settleOnAir, ORIGINAL, TETO_MS } from '@/lib/youtube/ab-settle'
import type { OpcoesSaida, ResultadoSaida } from '@/lib/youtube/ab-settle'
import {
  MSG_EM_ANDAMENTO, MSG_JA_ENCERRADO, MSG_PEDIDO_INVALIDO, MSG_SEM_PERMISSAO_VARIANTE, seqVistoSchema, MSG_VARIANTE_DA_VEZ, recusaDeSessao, traduzirSaida, varianteOriginalId,
} from '@/lib/youtube/ab-acao-saida'
import type { OpcaoEncerrar, ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { destinoDosCampos, dispensarCampos, tentarAgora } from '@/lib/youtube/ab-restore-acoes'
import type { CampoNome } from '@/lib/youtube/ab-restore'
import { getVideoTestHistory as _getVideoTestHistory, getLearnings } from './queries'

/** Guarda a maior cópia da original no Blob (P4a): url, dHash como o YouTube serve e dimensões. */
async function preserveOriginalThumbnail(youtubeId: string) {
  return guardarOriginalMaior(youtubeId, crypto.randomUUID())
}

export async function getVideoTestHistory(
  ...args: Parameters<typeof _getVideoTestHistory>
): ReturnType<typeof _getVideoTestHistory> {
  return _getVideoTestHistory(...args)
}

export type { OpcaoEncerrar, ResultadoAcaoSaida }

/** Frase provisória da exceção inesperada em settleOnAir (T17: Logan fecha). */
const MSG_FALHA_SAIDA = 'Não foi possível concluir agora. Recarregue a página e confira o estado do teste.'

function invalidarTelasDoAbLab(): void {
  revalidateTag('youtube', { expire: 0 })
  revalidatePath('/cms/youtube/ab-lab')
}

/**
 * Traduz o resultado de settleOnAir e, se saiu do ar, invalida as telas. Uma exceção (settleOnAir relança o erro
 * desconhecido por desenho) vira `resultado: 'erro'` + Sentry, em vez de derrubar a tela no error boundary;
 * revalida porque o estado pode ter mudado.
 */
async function concluirSaida(saida: Promise<ResultadoSaida>): Promise<ResultadoAcaoSaida> {
  let r: ResultadoSaida
  try {
    r = await saida
  } catch (e) {
    Sentry.captureException(e, { tags: { area: 'ab-acao-saida' } })
    invalidarTelasDoAbLab()
    return { ok: false, resultado: 'erro', error: MSG_FALHA_SAIDA }
  }
  const out = traduzirSaida(r)
  if (out.ok && out.resultado === 'feito') invalidarTelasDoAbLab()
  return out
}

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}

const UUID_REF = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ReferenciaSchema = z.object({
  refVideoId: z.string().regex(UUID_REF).nullable(),
  refTroca: z.string().nullable(),
  tipo: z.enum(['thumbnail', 'title']),
})

/** Só os três campos; qualquer coisa fora do formato descarta a referência (o teste nasce sem ela). */
function referenciaValida(r: unknown): { refVideoId: string | null; refTroca: string | null; tipo: 'thumbnail' | 'title' } | null {
  const p = ReferenciaSchema.safeParse(r)
  if (!p.success) return null
  return { refVideoId: p.data.refVideoId, refTroca: refTrocaValida(p.data.refTroca), tipo: p.data.tipo }
}

// ---------------------------------------------------------------------------
// createAbTest
// ---------------------------------------------------------------------------

export async function createAbTest(
  input: AbTestCreateInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  if (pedeDescricao({ test_type: input.test_type })) {
    return { ok: false, error: DESCRICAO_FORA_DO_TESTE.message }
  }

  if (input.site_id !== siteId) {
    return { ok: false, error: 'site_id mismatch' }
  }

  const supabase = getSupabaseServiceClient()

  // Fetch video
  const { data: video, error: videoError } = await supabase
    .from('youtube_videos')
    .select('id, youtube_video_id, duration_seconds, thumbnail_hq_url')
    .eq('id', input.youtube_video_id)
    .eq('site_id', siteId)
    .single()

  if (videoError || !video) {
    return { ok: false, error: 'Não achamos este vídeo. Recarregue a página e tente de novo.' }
  }

  // Reject Shorts
  if (isCertainShort(video.duration_seconds ?? 0)) {
    return { ok: false, error: 'O A/B Lab não testa Shorts (vídeos de até 60 s). Escolha outro vídeo.' }
  }

  if (!video.thumbnail_hq_url) {
    return { ok: false, error: 'O Lab ainda não tem a thumbnail deste vídeo. Vá em Vídeos, use "Sincronizar agora" e tente de novo.' }
  }

  // Check for existing active/draft/paused/queued test on the same video
  const { data: existing } = await supabase
    .from('ab_tests')
    .select('id')
    .eq('youtube_video_id', input.youtube_video_id)
    .eq('site_id', siteId)
    .in('status', ['draft', 'active', 'paused', 'queued'])
    .limit(1)
    .maybeSingle()

  if (existing) {
    return { ok: false, error: 'Este vídeo já tem um teste (em andamento, pausado, na fila ou em rascunho). Termine ou cancele esse antes de criar outro.' }
  }

  // Merge config with defaults
  let referencia = input.referencia === undefined ? null : referenciaValida(input.referencia)
  if (referencia?.refVideoId) {
    // O servidor não confia no uuid do cliente: o vídeo tem de existir neste site (1 leitura por chave primária).
    const { data: refVideo, error: refErr } = await supabase
      .from('competitor_videos')
      .select('id, competitor_channels!inner(site_id)')
      .eq('id', referencia.refVideoId)
      .eq('competitor_channels.site_id', siteId)
      .maybeSingle()
    if (refErr) {
      // Falha transitória não faz perder dado: grava como veio.
      Sentry.captureMessage('createAbTest: falha ao conferir o vídeo da referência', { level: 'warning', extra: { siteId, code: refErr.code } })
    } else if (!refVideo) {
      referencia = { refVideoId: null, refTroca: null, tipo: referencia.tipo }
    }
  }
  // `referencia` do cliente dentro de `config` nunca entra: só a validada acima.
  const { referencia: _referenciaDoCliente, ...configDoCliente } = (input.config ?? {}) as Record<string, unknown>
  const config = {
    ...AB_TEST_CONFIG_DEFAULTS,
    ...configDoCliente,
    ...(referencia ? { referencia } : {}),
  }

  // Capture original metadata for title/desc/combo tests
  let originalTitle: string | null = null
  const testType: TestType = input.test_type ?? 'thumbnail'

  // Teste de thumbnail não entra aqui: o original vem de `youtube_videos` (acima).
  if (testType !== 'thumbnail') {
    let captured = false
    try {
      // O token é o do canal DONO do vídeo. Sem conta, `ensureFreshToken` pegava
      // "a conexão conectada por último": com outro canal reconectado depois, os
      // originais de um vídeo não listado voltavam vazios e o teste nascia sem ter
      // o que restaurar.
      const channelAccountId = await channelAccountIdForVideo(supabase, siteId, input.youtube_video_id)
      if (!channelAccountId) throw new Error(`Video ${input.youtube_video_id} has no channel`)
      const { accessToken } = await ensureFreshToken(siteId, 'youtube', channelAccountId)
      const { data: ytVideo } = await supabase
        .from('youtube_videos')
        .select('youtube_video_id')
        .eq('id', input.youtube_video_id)
        .single()

      if (ytVideo) {
        const meta = await captureOriginalMetadata(ytVideo.youtube_video_id, accessToken)
        if (meta) {
          originalTitle = meta.title
          captured = true
        }
      }
    } catch (err) {
      // Sem originais a reversão (pause/end/revert) não teria o que restaurar:
      // o teste não é criado. Fica registrado para diagnóstico.
      Sentry.captureException(err, {
        tags: { area: 'ab-lab', action: 'createAbTest' },
        extra: { stage: 'capture-original-metadata', videoId: input.youtube_video_id },
      })
    }
    if (!captured) {
      return {
        ok: false,
        error:
          "Could not read the video's current title. Reconnect this channel's YouTube access and try again.",
      }
    }
  }

  // O blob da thumbnail original só é gravado agora que a criação vai acontecer: nenhuma
  // recusa acima (teste já existe, originais não capturados) deixa blob órfão.
  let immutableOriginalUrl: string | null = video.thumbnail_hq_url ?? null
  let originalDhash: string | null = null
  let originalDimensions: string | null = null
  if (video.thumbnail_hq_url && /\.(ytimg|ggpht|googleusercontent)\.com/.test(video.thumbnail_hq_url)) {
    try {
      const guardada = await preserveOriginalThumbnail(video.youtube_video_id)
      immutableOriginalUrl = guardada.url
      originalDhash = guardada.dhash
      originalDimensions = `${guardada.largura}x${guardada.altura}`
    } catch {
      return { ok: false, error: 'Falha ao salvar thumbnail original. Tente novamente.' }
    }
  }

  // Insert test
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .insert({
      site_id: siteId,
      youtube_video_id: input.youtube_video_id,
      name: input.name,
      status: 'draft',
      config,
      original_thumbnail_url: immutableOriginalUrl,
      test_type: testType,
      original_title: originalTitle,
    })
    .select('id')
    .single()

  if (testError || !test) {
    return { ok: false, error: testError?.message ?? 'Failed to create test' }
  }

  // Insert original variant
  const { error: variantError } = await supabase.from('ab_test_variants').insert({
    test_id: test.id,
    label: 'original',
    is_original: true,
    blob_url: immutableOriginalUrl,
    thumbnail_dhash: originalDhash,
    dimensions: originalDimensions,
    blob_key: null,
    sort_order: 0,
  })

  if (variantError) {
    // Roll back the test row on variant insert failure
    await supabase.from('ab_tests').delete().eq('id', test.id)
    return { ok: false, error: variantError.message }
  }

  revalidateTag('youtube', { expire: 0 })
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true, id: test.id }
}

// ---------------------------------------------------------------------------
// updateAbTestType
// ---------------------------------------------------------------------------

export async function updateAbTestType(
  testId: string,
  newType: TestType,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  if (!TestTypeSchema.safeParse(newType).success) {
    return {
      ok: false,
      error: pedeDescricao({ test_type: newType }) ? DESCRICAO_FORA_DO_TESTE.message : 'Tipo de teste desconhecido',
    }
  }

  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id, status')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (!test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Only draft tests can change type' }

  const { error } = await supabase
    .from('ab_tests')
    .update({ test_type: newType })
    .eq('id', testId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// uploadVariant
// ---------------------------------------------------------------------------

export async function uploadVariant(
  testId: string,
  formData: FormData,
): Promise<{ ok: boolean; variantId?: string; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  // Load test and assert draft status + site scope
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, status')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (testError || !test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Variants can only be added to draft tests' }

  // Get file from FormData
  const file = formData.get('file')
  if (!file || !(file instanceof File)) return { ok: false, error: 'No file provided' }

  // Validate type and size
  const allowedTypes = ['image/jpeg', 'image/png']
  if (!allowedTypes.includes(file.type)) {
    return { ok: false, error: 'File must be JPEG or PNG (YouTube does not accept WebP)' }
  }
  const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
  if (file.size > MAX_SIZE) {
    return { ok: false, error: 'File must be 2 MB or smaller' }
  }

  // Count existing non-original variants
  const { data: existingVariants, error: countError } = await supabase
    .from('ab_test_variants')
    .select('id, label')
    .eq('test_id', testId)
    .eq('is_original', false)

  if (countError) return { ok: false, error: countError.message }

  if ((existingVariants?.length ?? 0) >= 3) {
    return { ok: false, error: 'Maximum of 3 non-original variants allowed' }
  }

  // Determine next label
  const usedLabels = new Set((existingVariants ?? []).map(v => v.label))
  const label = VARIANT_LABELS.find(l => !usedLabels.has(l))
  if (!label) return { ok: false, error: 'No available variant label slot' }

  // Determine extension
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const ext = extMap[file.type] ?? 'jpg'

  // Upload to Vercel Blob
  const buffer = Buffer.from(await file.arrayBuffer())
  const blobPath = `ab-test/${testId}/${label}.${ext}`
  const blob = await put(blobPath, buffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType: file.type,
  })
  const thumbnailDhash = await dhashOuNulo(buffer, `uploadVariant:${testId}`)

  // Insert variant row
  const sortOrder = 1 + (existingVariants?.length ?? 0)
  const { data: variant, error: insertError } = await supabase
    .from('ab_test_variants')
    .insert({
      test_id: testId,
      label,
      is_original: false,
      blob_url: blob.url,
      blob_key: blob.pathname,
      thumbnail_dhash: thumbnailDhash,
      file_size_bytes: file.size,
      sort_order: sortOrder,
      title_text: formData.get('title_text') as string | null ?? null,
    })
    .select('id')
    .single()

  if (insertError || !variant) {
    try {
      const { del } = await import('@vercel/blob')
      await del(blob.url)
    } catch {}
    return { ok: false, error: insertError?.message ?? 'Failed to insert variant' }
  }

  revalidateTag('youtube', { expire: 0 })
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true, variantId: variant.id }
}

// ---------------------------------------------------------------------------
// deleteVariant
// ---------------------------------------------------------------------------

export async function deleteVariant(
  variantId: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  // Load variant
  const { data: variant, error: variantError } = await supabase
    .from('ab_test_variants')
    .select('id, test_id, is_original, blob_url')
    .eq('id', variantId)
    .single()

  if (variantError || !variant) return { ok: false, error: 'Variant not found' }
  if (variant.is_original) return { ok: false, error: 'Cannot delete the original variant' }

  // Load parent test (scoped to site for security)
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, status')
    .eq('id', variant.test_id)
    .eq('site_id', siteId)
    .single()

  if (testError || !test) return { ok: false, error: 'Parent test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Variants can only be deleted from draft tests' }

  // Delete blob if present
  if (variant.blob_url) {
    const { del } = await import('@vercel/blob')
    await del(variant.blob_url)
  }

  // Delete variant row
  const { error: deleteError } = await supabase
    .from('ab_test_variants')
    .delete()
    .eq('id', variantId)

  if (deleteError) return { ok: false, error: deleteError.message }

  revalidateTag('youtube', { expire: 0 })
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// cleanupDraftVariants — remove non-original variants from a draft test
// ---------------------------------------------------------------------------

export async function cleanupDraftVariants(
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, status')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (!test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Can only clean up draft tests' }

  const { data: variants } = await supabase
    .from('ab_test_variants')
    .select('id, blob_url')
    .eq('test_id', testId)
    .eq('is_original', false)

  if (variants && variants.length > 0) {
    const { del } = await import('@vercel/blob')
    for (const v of variants) {
      if (v.blob_url) await del(v.blob_url).catch(() => {})
    }
    await supabase
      .from('ab_test_variants')
      .delete()
      .eq('test_id', testId)
      .eq('is_original', false)
  }

  return { ok: true }
}

/** D12: só leitura da original guardada do rascunho; o assistente avisa, nunca bloqueia. Erro ou ambiguidade = ok:false. */
export async function lerDimensoesDaOriginal(
  testId: string,
): Promise<{ ok: true; dimensions: string | null; medida: boolean } | { ok: false }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }
  const supabase = getSupabaseServiceClient()
  const { data: test, error: eTeste } = await supabase
    .from('ab_tests').select('id').eq('id', testId).eq('site_id', siteId).maybeSingle()
  if (eTeste || !test) return { ok: false }
  const { data: originais, error: eVar } = await supabase
    .from('ab_test_variants').select('dimensions, thumbnail_dhash')
    .eq('test_id', testId).eq('is_original', true).limit(2)
  if (eVar || !originais || originais.length > 1) return { ok: false }
  const original = originais[0]
  return { ok: true, dimensions: original?.dimensions ?? null, medida: original?.thumbnail_dhash != null }
}

// ---------------------------------------------------------------------------
// pullPipelineThumbnails
// ---------------------------------------------------------------------------

export async function pullPipelineThumbnails(
  testId: string,
  pipelineId: string,
): Promise<{ ok: boolean; added?: number; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  // Load test (scoped to site)
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, status')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (testError || !test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Pipeline thumbnails can only be added to draft tests' }

  // Load pipeline entry (scoped to site)
  const { data: pipeline, error: pipelineError } = await supabase
    .from('content_pipeline')
    .select('id, social_config')
    .eq('id', pipelineId)
    .eq('site_id', siteId)
    .single()

  if (pipelineError || !pipeline) return { ok: false, error: 'Pipeline entry not found' }

  const socialConfig = pipeline.social_config as Record<string, unknown> | null
  const thumbnailAlternatives = (socialConfig?.thumbnail_alternatives ?? []) as string[]

  if (!Array.isArray(thumbnailAlternatives) || thumbnailAlternatives.length === 0) {
    return { ok: false, error: 'No thumbnail_alternatives found in pipeline social_config' }
  }

  // Count existing non-original variants
  const { data: existingVariants, error: countError } = await supabase
    .from('ab_test_variants')
    .select('id, label')
    .eq('test_id', testId)
    .eq('is_original', false)

  if (countError) return { ok: false, error: countError.message }

  const existingCount = existingVariants?.length ?? 0
  const usedLabels = new Set((existingVariants ?? []).map(v => v.label))
  const maxToAdd = 3 - existingCount

  if (maxToAdd <= 0) {
    return { ok: false, error: 'Maximum of 3 non-original variants already reached' }
  }

  const urlsToProcess = thumbnailAlternatives.slice(0, maxToAdd)
  let added = 0

  for (const url of urlsToProcess) {
    const label = VARIANT_LABELS.find(l => !usedLabels.has(l))
    if (!label) break

    try {
      // Fetch image with SSRF protection (uses fetchVariantImageBuffer allowlist)
      const { buffer, contentType } = await fetchVariantImageBuffer(url)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(contentType)) continue

      const extMap: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      }
      const ext = extMap[contentType] ?? 'jpg'

      const blobPath = `ab-test/${testId}/${label}.${ext}`
      const blob = await put(blobPath, buffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType,
      })
      const thumbnailDhash = await dhashOuNulo(buffer, `pullPipelineThumbnails:${testId}`)

      const sortOrder = 1 + existingCount + added
      const { error: insertError } = await supabase.from('ab_test_variants').insert({
        test_id: testId,
        label,
        is_original: false,
        blob_url: blob.url,
        blob_key: blob.pathname,
        thumbnail_dhash: thumbnailDhash,
        file_size_bytes: buffer.byteLength,
        sort_order: sortOrder,
      })

      if (!insertError) {
        usedLabels.add(label)
        added++
      }
    } catch {
      // Skip failed URLs — continue with remaining
      continue
    }
  }

  // Update ab_tests.source_pipeline_id
  await supabase
    .from('ab_tests')
    .update({ source_pipeline_id: pipelineId, updated_at: new Date().toISOString() })
    .eq('id', testId)

  revalidateTag('youtube', { expire: 0 })
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true, added }
}

// ---------------------------------------------------------------------------
// Lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the YouTube Data API video ID (youtube_video_id column on youtube_videos)
 * given the FK stored in ab_tests (which is the PK of youtube_videos).
 */
// ---------------------------------------------------------------------------
// startAbTest
// ---------------------------------------------------------------------------

export async function startAbTest(
  testId: string,
): Promise<{ ok: boolean; error?: string; codigo?: CodigoRecusaNativa; ate?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const result = await startAbTestInternal(testId, siteId)
  if (result.ok) {
    revalidateTag('youtube', { expire: 0 })
    revalidatePath('/cms/youtube/ab-lab')
  }
  return result
}

// ---------------------------------------------------------------------------
// pauseAbTest
// ---------------------------------------------------------------------------

/** `forcar` (opcional, só o "Trocar mesmo assim" da ficha): pula a pergunta do passo 0b depois de `precisa_confirmar`. */
export async function pauseAbTest(testId: string, seqVisto: number, forcar?: boolean): Promise<ResultadoAcaoSaida> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return recusaDeSessao(e)
  }
  const seq = seqVistoSchema.safeParse(seqVisto)
  if (!seq.success) return { ok: false, resultado: 'erro', error: MSG_PEDIDO_INVALIDO }
  return concluirSaida(settleOnAir(testId, { siteId, destino: ORIGINAL, motivo: 'pausa', humano: true, seqEsperado: seq.data, ...(forcar === true ? { forcar: true } : {}) }))
}

// ---------------------------------------------------------------------------
// acknowledgeAbTestDrift
// ---------------------------------------------------------------------------

export async function acknowledgeAbTestDrift(
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch (e) { return { ok: false, error: (e as Error).message } }

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('ab_tests')
    .update({ drift_acknowledged_at: new Date().toISOString(), status_note: null })
    .eq('id', testId)
    .eq('site_id', siteId)
    .eq('status', 'paused')

  if (error) return { ok: false, error: error.message }
  revalidateTag('youtube', { expire: 0 })
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// resumeAbTest
// ---------------------------------------------------------------------------

export async function resumeAbTest(testId: string, seqVisto: number): Promise<ResultadoAcaoSaida> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return recusaDeSessao(e)
  }
  const seq = seqVistoSchema.safeParse(seqVisto)
  if (!seq.success) return { ok: false, resultado: 'erro', error: MSG_PEDIDO_INVALIDO }
  // O corpo mora em lib/youtube/ab-resume.ts: as portas injetáveis (banco, relógio, token, leitura) não podem ser
  // parâmetro de uma server action (todo parâmetro vem da rede).
  const r = await retomarTeste(testId, siteId, {
    supabase: getSupabaseServiceClient(),
    agora: () => new Date(),
    token: async (sid, canal) => (await ensureFreshToken(sid, 'youtube', canal)).accessToken,
  }, seq.data)
  // A reivindicação já mexeu no teste (restore_seq, restore_status): qualquer desfecho depois dela invalida as telas.
  if (r.ok || r.resultado === 'erro' || r.resultado === 'em_andamento') invalidarTelasDoAbLab()
  return r
}

// ---------------------------------------------------------------------------
// endAbTest
// ---------------------------------------------------------------------------

export async function endAbTest(testId: string, opcao: OpcaoEncerrar): Promise<ResultadoAcaoSaida> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return recusaDeSessao(e)
  }

  const seq = seqVistoSchema.safeParse(opcao.seqVisto)
  if (!seq.success) return { ok: false, resultado: 'erro', error: MSG_PEDIDO_INVALIDO }

  let destino: OpcoesSaida['destino'] = ORIGINAL
  if (opcao.destino === 'variante') {
    // O id da variante original equivale a "voltar ao original" e segue com a editora (17).
    // Qualquer outra deixa uma variante no canal: degrau "administrar o site".
    const originalId = await varianteOriginalId(testId, siteId)
    if (opcao.varianteId !== originalId) {
      if (await denyUnlessSiteAdmin(siteId, 'deixar uma variante no ar')) {
        return { ok: false, resultado: 'sem_permissao', error: MSG_SEM_PERMISSAO_VARIANTE }
      }
      destino = { tipo: 'variante', id: opcao.varianteId }
    }
  }
  const forcar = opcao.destino === 'variante' && opcao.forcar !== undefined ? { forcar: opcao.forcar } : {}
  return concluirSaida(settleOnAir(testId, { siteId, destino, motivo: 'encerrado', humano: true, seqEsperado: seq.data, ...forcar }))
}

// ---------------------------------------------------------------------------
// archiveAbTest
// ---------------------------------------------------------------------------

export async function archiveAbTest(
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { error: updateError } = await supabase
    .from('ab_tests')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', testId)
    .eq('site_id', siteId)
    .in('status', ['completed', 'draft'])

  if (updateError) return { ok: false, error: updateError.message }

  revalidateTag('youtube', { expire: 0 })
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}


// ---------------------------------------------------------------------------
// updateAbSiteSettings
// ---------------------------------------------------------------------------

export async function updateAbSiteSettings(
  newSettings: Partial<AbTestSiteSettings>,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: site } = await supabase
    .from('sites')
    .select('settings')
    .eq('id', siteId)
    .single()

  const currentSettings = (site?.settings as Record<string, unknown> | null) ?? {}
  const currentAbSettings = (currentSettings.ab_test as Partial<AbTestSiteSettings> | null) ?? {}

  const merged = { ...currentAbSettings, ...newSettings }

  const { error: updateError } = await supabase
    .from('sites')
    .update({
      settings: { ...currentSettings, ab_test: merged },
      updated_at: new Date().toISOString(),
    })
    .eq('id', siteId)

  if (updateError) return { ok: false, error: updateError.message }

  revalidateTag('youtube', { expire: 0 })
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// createTextVariant
// ---------------------------------------------------------------------------

export async function createTextVariant(
  input: CreateTextVariantInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id, status, test_type')
    .eq('id', input.test_id)
    .eq('site_id', siteId)
    .single()

  if (!test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Can only add variants to draft tests' }
  if (pedeDescricao({ test_type: test.test_type })) {
    return { ok: false, error: DESCRICAO_FORA_DO_TESTE.message }
  }
  if (test.test_type === 'thumbnail') {
    return { ok: false, error: 'Texto não pode ser adicionado a testes de thumbnail' }
  }

  const { count } = await supabase
    .from('ab_test_variants')
    .select('id', { count: 'exact', head: true })
    .eq('test_id', input.test_id)

  if ((count ?? 0) >= 4) return { ok: false, error: 'Maximum 4 variants per test' }

  const sortOrder = (count ?? 0)
  const label = input.label ?? VARIANT_LABELS[sortOrder - 1] ?? `v${sortOrder + 1}`

  const { data: variant, error } = await supabase
    .from('ab_test_variants')
    .insert({
      test_id: input.test_id,
      label,
      is_original: false,
      title_text: input.title_text ?? null,
      metadata: input.metadata ?? {},
      sort_order: sortOrder,
    })
    .select('id')
    .single()

  if (error || !variant) return { ok: false, error: error?.message ?? 'Insert failed' }

  revalidateTag('ab-tests', { expire: 0 })
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true, id: variant.id }
}

// ---------------------------------------------------------------------------
// updateTextVariant
// ---------------------------------------------------------------------------

export async function updateTextVariant(
  variantId: string,
  updates: { title_text?: string; metadata?: Partial<VariantMetadata> },
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: variant } = await supabase
    .from('ab_test_variants')
    .select('id, test_id')
    .eq('id', variantId)
    .single()

  if (!variant) return { ok: false, error: 'Variant not found' }

  const { data: test } = await supabase
    .from('ab_tests')
    .select('status, site_id')
    .eq('id', variant.test_id)
    .eq('site_id', siteId)
    .single()

  if (!test || test.status !== 'draft') {
    return { ok: false, error: 'Can only edit variants of draft tests' }
  }

  const { error } = await supabase
    .from('ab_test_variants')
    .update({ title_text: updates.title_text, metadata: updates.metadata })
    .eq('id', variantId)

  if (error) return { ok: false, error: error.message }

  revalidateTag('ab-tests', { expire: 0 })
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// forceRotate
// ---------------------------------------------------------------------------

export async function forceRotate(testId: string): Promise<ResultadoAcaoSaida> {
  const prazo = Date.now() + TETO_MS // F-D3: ação humana, início + 55 s
  // Degrau "administrar o site": mexe no canal de verdade. No topo, antes de qualquer
  // service client; falha fechado.
  const denied = await denyUnlessSiteAdmin((await getSiteContext()).siteId, 'forçar a rotação de um teste A/B no canal')
  if (denied) return { ok: false, resultado: 'sem_permissao', error: denied.error }
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return recusaDeSessao(e)
  }

  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id, name, status, restore_seq, youtube_video_id, test_type, original_title, config, last_applied_variant_id, updated_at, variants:ab_test_variants!test_id(*)')
    .eq('id', testId)
    .eq('site_id', siteId)
    .eq('status', 'active')
    .single()

  if (!test) return { ok: false, resultado: 'erro', error: 'Test not found or not active' }
  const tipoRecusado = recusaTipoForaDeUso(test.test_type)
  if (tipoRecusado) return { ok: false, resultado: 'erro', error: tipoRecusado }

  // Guarda do teste do YouTube (F1a-dado): forçar a rotação escreve no vídeo; teste nativo em andamento recusa.
  const guarda = await guardaDoPonto(supabase, { siteId, testId, videoId: test.youtube_video_id as string, ponto: 'forcar' })
  if (!guarda.seguir) return { ok: false, resultado: 'erro', error: guarda.motivo }

  // Resolve channel for correct token
  const { data: video } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id, channel_id')
    .eq('id', test.youtube_video_id)
    .single()
  if (!video) return { ok: false, resultado: 'erro', error: 'Video not found' }

  // O canal dono do vídeo (filtro de site; erro de banco não vira "canal não identificado")
  const channelResolved = await resolveVideoChannel(supabase, siteId, test.youtube_video_id as string)
  if (!channelResolved.ok) return { ok: false, resultado: 'erro', error: channelResolved.error }

  // Pre-flight token check (validates token works against YouTube API)
  const preflight = await preflightTokenCheck(siteId, 'youtube', channelResolved.channelAccountId)
  if (!preflight.ok) {
    return { ok: false, resultado: 'erro', error: `Token inválido: ${preflight.reason}` }
  }
  const accessToken = preflight.accessToken

  // Count completed cycles BEFORE closing current (matches cron logic)
  const { count } = await supabase
    .from('ab_test_cycles')
    .select('id', { count: 'exact', head: true })
    .eq('test_id', testId)
    .not('ended_at', 'is', null)

  const nextCycle = (count ?? 0) + 1

  const variants = (test.variants as Array<{ id: string; sort_order: number; blob_url: string | null; is_original: boolean; title_text: string | null }>)
    .sort((a, b) => a.sort_order - b.sort_order)

  const config = test.config as Record<string, unknown> | null
  const pattern = (config?.rotation_pattern as 'abba' | 'round_robin' | 'random' | undefined) ?? 'abba'
  const nextIndex = getNextVariantIndex(pattern, variants.length, nextCycle)
  const nextVariant = variants[nextIndex]
  if (!nextVariant) return { ok: false, resultado: 'erro', error: MSG_VARIANTE_DA_VEZ }

  // Phil I-1: variante da vez sem arquivo no Blob / sem título não vai ao ar (antes de reivindicar).
  const semConteudo = motivoVarianteSemConteudo(((test.test_type as string) ?? 'thumbnail') as 'thumbnail' | 'title' | 'combo', nextVariant, test.original_title as string | null)
  if (semConteudo) {
    await avisarRotacaoSemConteudo({
      testId, siteId, testName: (test.name as string | null) ?? '', motivo: semConteudo, variantId: nextVariant.id,
    })
    return { ok: false, resultado: 'erro', error: `A rotação não foi feita: a variante da vez está ${semConteudo}. Abra o teste, corrija a variante e tente de novo.` }
  }

  // Reivindica a vez ANTES de escrever, como o cron; o marcador velho (queda anterior, mais antigo que
  // MARCADOR_VELHO_MS) é aceito exatamente (Y-D9). Zero linhas = outra rotação (marcador novo = em voo), pausa ou
  // encerramento chegou antes: não escreve.
  const seq = await reivindicarRotacao(
    supabase, testId, test.restore_seq as number, nextVariant.id, (test.last_applied_variant_id as string | null) ?? null,
  )
  if (seq === null) return { ok: false, resultado: 'em_andamento', error: MSG_EM_ANDAMENTO }

  const resultado = await aplicarRotacao(supabase, {
    testId,
    siteId,
    testName: (test.name as string | null) ?? '',
    seq,
    youtubeVideoId: video.youtube_video_id as string,
    accessToken,
    testType: ((test.test_type as string) ?? 'thumbnail') as 'thumbnail' | 'title' | 'combo',
    variante: nextVariant as AbTestVariantRow,
    originalTitle: test.original_title as string | null,
    cycleNumber: nextCycle,
    metaExtra: { trigger: 'manual' },
    prazo,
  })

  if (!resultado.ok) {
    if (resultado.motivo !== 'youtube') {
      if (resultado.motivo === 'perdeu_a_vez') return { ok: false, resultado: 'em_andamento', error: MSG_EM_ANDAMENTO }
      return { ok: false, resultado: 'erro', error: 'A rotação e uma pausa se cruzaram. Confira a thumbnail e o título do vídeo no YouTube.' }
    }
    // Sem escrita, limpa o marcador; com escrita parcial ele fica (sinal para o settleOnAir).
    if (!resultado.appliedThumbnail && !resultado.appliedMetadata) {
      await supabase.from('ab_tests').update({ last_applied_variant_id: null }).eq('id', testId).eq('restore_seq', seq)
    }
    return { ok: false, resultado: 'erro', error: resultado.erro.message }
  }

  revalidateTag('ab-tests', { expire: 0 })
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true, resultado: 'feito', campos: {} }
}

// ---------------------------------------------------------------------------
// revertWinner — volta ao original (janela de 7 dias), por settleOnAir
// ---------------------------------------------------------------------------
// retryRestore / dismissRestore (P4b): "Tentar agora" e "Já corrigi no YouTube"
// ---------------------------------------------------------------------------

const CamposSchema = z.array(z.enum(['title', 'thumbnail'])).min(1).max(2)

const MSG_NEGA_VARIANTE = 'tentar de novo ou dispensar a restauração de uma variante'

/** Permissão por destino do "Dispensar": nulo = pode; teste/campo ausente = `ja_encerrado` (nada a dispensar); variante exige administrar. */
async function recusaPorDestino(siteId: string, testId: string, campos: CampoNome[]): Promise<ResultadoAcaoSaida | null> {
  const destino = await destinoDosCampos(getSupabaseServiceClient(), testId, siteId, campos)
  if (destino === null) return { ok: false, resultado: 'ja_encerrado', error: MSG_JA_ENCERRADO }
  if (destino === 'variante' && (await denyUnlessSiteAdmin(siteId, MSG_NEGA_VARIANTE))) {
    return { ok: false, resultado: 'sem_permissao', error: MSG_SEM_PERMISSAO_VARIANTE }
  }
  return null
}

export async function retryRestore(testId: string, seqVisto: number): Promise<ResultadoAcaoSaida> {
  let siteId: string
  try {
    siteId = (await requireEditUser()).siteId
  } catch (e) {
    return recusaDeSessao(e)
  }
  const seq = seqVistoSchema.safeParse(seqVisto)
  if (!seq.success) return { ok: false, resultado: 'erro', error: MSG_PEDIDO_INVALIDO }

  // Y-A1: a permissão é decidida por novaTentativa sobre o destino do retrato que ela mesma reivindica (nunca por uma leitura à parte).
  const autorizar = async (destino: 'original' | 'variante'): Promise<boolean> =>
    destino === 'original' || !(await denyUnlessSiteAdmin(siteId, MSG_NEGA_VARIANTE))
  return concluirSaida(tentarAgora(getSupabaseServiceClient(), testId, siteId, seq.data, undefined, autorizar))
}

export async function dismissRestore(testId: string, campos: CampoNome[], seqVisto: number): Promise<ResultadoAcaoSaida> {
  let siteId: string
  let userId: string
  try {
    ;({ siteId, userId } = await requireEditUser())
  } catch (e) {
    return recusaDeSessao(e)
  }
  const seq = seqVistoSchema.safeParse(seqVisto)
  const lista = CamposSchema.safeParse(campos)
  if (!seq.success || !lista.success || new Set(lista.data).size !== lista.data.length) {
    return { ok: false, resultado: 'erro', error: MSG_PEDIDO_INVALIDO }
  }
  try {
    const recusa = await recusaPorDestino(siteId, testId, lista.data)
    if (recusa) return recusa
  } catch (e) {
    Sentry.captureException(e, { tags: { area: 'ab-acao-saida' } })
    return { ok: false, resultado: 'erro', error: MSG_FALHA_SAIDA }
  }
  let orgId: string | null = null
  try { orgId = (await getSiteContext()).orgId ?? null } catch { /* sem org: a linha de auditoria leva site_id */ }
  return concluirSaida(dispensarCampos(getSupabaseServiceClient(), testId, siteId, lista.data, seq.data, { userId, orgId }))
}


// ---------------------------------------------------------------------------

export async function revertWinner(testId: string, seqVisto: number): Promise<ResultadoAcaoSaida> {
  // Degrau "administrar o site": mexe no canal de verdade. No topo, antes de qualquer
  // service client; falha fechado.
  const siteIdDaTela = (await getSiteContext()).siteId
  const negado = await denyUnlessSiteAdmin(siteIdDaTela, 'reverter o vencedor de um teste A/B no canal')
  if (negado) return { ok: false, resultado: 'sem_permissao', error: negado.error }
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return recusaDeSessao(e)
  }
  const seq = seqVistoSchema.safeParse(seqVisto)
  if (!seq.success) return { ok: false, resultado: 'erro', error: MSG_PEDIDO_INVALIDO }
  return concluirSaida(settleOnAir(testId, { siteId, destino: ORIGINAL, motivo: 'reverter', humano: true, seqEsperado: seq.data }))
}

// ---------------------------------------------------------------------------
// fetchAbBriefingData
// ---------------------------------------------------------------------------

export async function fetchAbBriefingData(
  videoId: string,
  testId: string = '',
): Promise<{ ok: true; data: AbBriefingData } | { ok: false; error: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch {
    return { ok: false, error: 'Sem permissão' }
  }
  const supabase = getSupabaseServiceClient()

  const { data: video, error: videoError } = await supabase
    .from('youtube_videos')
    .select('id, youtube_video_id, title, thumbnail_url, ctr, avg_view_percentage, channel_id, last_analytics_sync_at')
    .eq('id', videoId)
    .eq('site_id', siteId)
    .single()

  if (videoError || !video) return { ok: false, error: 'Vídeo não encontrado' }

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('name, subscriber_count, locale')
    .eq('id', video.channel_id as string)
    .eq('site_id', siteId)
    .maybeSingle()

  const subscribers = (channel?.subscriber_count as number | null) ?? 0
  const tier = getChannelTier(subscribers)
  const locale = ((channel?.locale as string | null) === 'en' ? 'en' : 'pt') satisfies 'pt' | 'en'

  const ctr = (video.ctr as number | null)
  const avgViewPercentage = (video.avg_view_percentage as number | null)

  let score: number | null = null
  let grade: string | null = null
  if (ctr !== null && avgViewPercentage !== null) {
    const result = scoreForPrompt(ctr, avgViewPercentage)
    score = result.score
    grade = result.grade
  }

  // ab_tests.youtube_video_id is the INTERNAL youtube_videos.id uuid — not the
  // 11-char YouTube Data API id. Passing video.youtube_video_id here made
  // PostgREST reject the eq filter (400, invalid uuid) and the briefing's
  // test history was silently always empty.
  const testHistory = await _getVideoTestHistory(video.id as string)
  const historyForBriefing = testHistory
    .filter(t => t.status === 'completed')
    .map(t => ({
      test_type: t.test_type,
      winner_label: t.winner_label,
    }))

  const lastSyncedAt = (video.last_analytics_sync_at as string | null) ?? new Date().toISOString()
  const snapshotAgeHours = Math.round(((Date.now() - new Date(lastSyncedAt).getTime()) / 3_600_000) * 10) / 10

  // Fetch learnings from past tests
  let learnings: import('@/lib/youtube/prompt-types').AbBriefingData['learnings']
  try {
    const learningsData = await getLearnings(siteId)
    if (learningsData) {
      const winning = learningsData.tags
        .filter(t => !t.negative)
        .sort((a, b) => (a.avgLift === null ? 1 : 0) - (b.avgLift === null ? 1 : 0) || (b.avgLift ?? 0) - (a.avgLift ?? 0))
        .slice(0, 5)
        .map(t => ({ tag: t.tag, avgLift: t.avgLift, wins: t.wins, kind: t.kind as 'thumb' | 'title' | 'desc' }))
      const losing = learningsData.tags
        .filter(t => t.negative === true)
        .sort((a, b) => (a.avgLift === null ? 1 : 0) - (b.avgLift === null ? 1 : 0) || (a.avgLift ?? 0) - (b.avgLift ?? 0))
        .slice(0, 3)
        .map(t => ({ tag: t.tag, avgLift: t.avgLift, wins: t.wins, kind: t.kind as 'thumb' | 'title' | 'desc', negative: true as const }))
      if (winning.length > 0 || losing.length > 0) {
        learnings = { winning, losing }
      }
    }
  } catch {
    // Non-fatal
  }

  return {
    ok: true,
    data: {
      channel: {
        name: (channel?.name as string | null) ?? 'Canal',
        subscribers,
        tier,
      },
      locale,
      testId,
      video: {
        youtubeVideoId: video.youtube_video_id as string,
        title: video.title as string,
        thumbnailUrl: (video.thumbnail_url as string | null),
        ctr,
        avgViewPercentage,
        score,
        grade,
      },
      testHistory: historyForBriefing,
      snapshotAgeHours,
      ...(learnings ? { learnings } : {}),
    },
  }
}

// ---------------------------------------------------------------------------
// fetchLibraryEntries — for LibraryPickerDialog
// ---------------------------------------------------------------------------

interface ILibraryEntry {
  id: string
  blob_url: string
  title: string | null
  tags: string[]
  lift_at_win: number | null
  source_type: string
  thumbnail_longevity: Array<{ checkpoint_days: number; status: string; change_percent: number | null }>
}

export async function fetchLibraryEntries(): Promise<ILibraryEntry[]> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return [] }

  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('thumbnail_library')
    .select('id, blob_url, title, tags, lift_at_win, source_type, thumbnail_longevity(checkpoint_days, status, change_percent)')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(50)

  return (data ?? []) as ILibraryEntry[]
}

// ---------------------------------------------------------------------------
// fetchAbTestVariants — CMS session-authenticated variant polling
// ---------------------------------------------------------------------------

export async function fetchAbTestVariants(
  testId: string,
): Promise<Array<{
  label: string
  is_original: boolean
  title_text: string | null
  metadata: Record<string, unknown> | null
}>> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (!test) return []

  const { data: variants } = await supabase
    .from('ab_test_variants')
    .select('label, is_original, title_text, metadata')
    .eq('test_id', testId)
    .order('sort_order', { ascending: true })

  return (variants ?? []).map(v => ({
    label: v.label as string,
    is_original: v.is_original as boolean,
    title_text: v.title_text as string | null,
    metadata: v.metadata as Record<string, unknown> | null,
  }))
}

// ---------------------------------------------------------------------------
// batchStartTests — create draft tests for multiple suggested videos
// ---------------------------------------------------------------------------

export async function batchStartTests(
  videoIds: string[],
): Promise<{ ok: boolean; created: number; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, created: 0, error: (e as Error).message }
  }

  if (videoIds.length < 2 || videoIds.length > 5) {
    return { ok: false, created: 0, error: 'Select 2-5 videos' }
  }

  const supabase = getSupabaseServiceClient()

  // Validate all videos are eligible (no active/draft/paused test)
  const { data: existingTests } = await supabase
    .from('ab_tests')
    .select('youtube_video_id')
    .eq('site_id', siteId)
    .in('status', ['draft', 'active', 'paused', 'queued'])
    .in('youtube_video_id', videoIds)

  const ineligible = new Set((existingTests ?? []).map(t => t.youtube_video_id))
  const eligible = videoIds.filter(id => !ineligible.has(id))

  if (eligible.length === 0) {
    return { ok: false, created: 0, error: 'All videos already have active tests' }
  }

  let created = 0

  for (const videoId of eligible) {
    const { data: video } = await supabase
      .from('youtube_videos')
      .select('id, youtube_video_id, title, thumbnail_hq_url')
      .eq('id', videoId)
      .eq('site_id', siteId)
      .single()

    if (!video) continue

    let batchImmutableUrl: string | null = video.thumbnail_hq_url ?? null
    let batchDhash: string | null = null
    let batchDimensions: string | null = null
    if (video.thumbnail_hq_url && /\.(ytimg|ggpht|googleusercontent)\.com/.test(video.thumbnail_hq_url)) {
      try {
        const guardada = await preserveOriginalThumbnail(video.youtube_video_id)
        batchImmutableUrl = guardada.url
        batchDhash = guardada.dhash
        batchDimensions = `${guardada.largura}x${guardada.altura}`
      } catch {
        continue
      }
    }

    const { data: test } = await supabase
      .from('ab_tests')
      .insert({
        site_id: siteId,
        youtube_video_id: videoId,
        name: `Batch: ${video.title?.slice(0, 40)}`,
        status: 'draft',
        test_type: 'thumbnail',
        original_thumbnail_url: batchImmutableUrl,
        config: {},
      })
      .select('id')
      .single()

    if (test) {
      await supabase.from('ab_test_variants').insert({
        test_id: test.id,
        label: 'original',
        is_original: true,
        blob_url: batchImmutableUrl,
        thumbnail_dhash: batchDhash,
        dimensions: batchDimensions,
        blob_key: null,
        sort_order: 0,
      })
      created++
    }
  }

  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true, created }
}
