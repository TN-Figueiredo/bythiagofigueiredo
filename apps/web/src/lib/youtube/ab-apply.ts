import { setThumbnail, fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { TestTypeSchema, DESCRICAO_FORA_DO_TESTE } from '@/lib/youtube/ab-schemas'
import type { AppliedMetadata, TestType } from '@/lib/youtube/ab-types'

export interface ApplyVariantInput {
  youtubeVideoId: string
  accessToken: string
  testType: TestType
  variant: {
    id?: string
    blob_url?: string | null
    title_text?: string | null
  }
  originalTitle?: string | null
}

export interface ApplyResult {
  ok: boolean
  appliedThumbnail: boolean
  appliedMetadata: boolean
  meta: AppliedMetadata
  error?: string
}

/**
 * Single source of truth for applying a variant to YouTube.
 * Handles thumbnail upload and/or title update. Never writes description.
 */
export async function applyVariantToYouTube(input: ApplyVariantInput): Promise<ApplyResult> {
  const {
    youtubeVideoId,
    accessToken,
    testType,
    variant,
    originalTitle,
  } = input

  // Tipo fora dos três (teste antigo de descrição): recusa, nunca "sucesso" sem escrever.
  if (!TestTypeSchema.safeParse(testType).success) {
    return {
      ok: false,
      appliedThumbnail: false,
      appliedMetadata: false,
      meta: {},
      error: (testType as string) === 'description' ? DESCRICAO_FORA_DO_TESTE.message : 'Tipo de teste desconhecido',
    }
  }

  let appliedThumbnail = false
  let appliedMetadata = false
  const meta: AppliedMetadata = {}

  try {
    // Thumbnail
    if ((testType === 'thumbnail' || testType === 'combo') && variant.blob_url) {
      const { buffer, contentType } = await fetchVariantImageBuffer(variant.blob_url)
      const result = await setThumbnail(youtubeVideoId, buffer, contentType, accessToken)
      appliedThumbnail = true
      meta.thumbnail_set = true

      if (result.highUrl) {
        meta.youtube_thumbnail_url = result.highUrl
      }
    }

    // Título (a descrição nunca é escrita pelo A/B)
    if (testType === 'title' || testType === 'combo') {
      const titleToSet = variant.title_text ?? originalTitle ?? null
      if (titleToSet) {
        await updateVideoMetadata(youtubeVideoId, titleToSet, accessToken)
        appliedMetadata = true
        meta.title_set = titleToSet
      }
    }

    return { ok: true, appliedThumbnail, appliedMetadata, meta }
  } catch (err) {
    return {
      ok: false,
      appliedThumbnail,
      appliedMetadata,
      meta,
      error: (err as Error).message,
    }
  }
}
