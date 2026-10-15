import { setThumbnail, fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { TestTypeSchema, DESCRICAO_FORA_DO_TESTE } from '@/lib/youtube/ab-schemas'
import { paraErroGravado, YouTubeApiError } from '@/lib/youtube/youtube-api-error'
import type { ErroGravado } from '@/lib/youtube/ab-restore'
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
  /** Erro do YouTube/Blob, quando houve (Y-D1); `error` segue sendo a mensagem. */
  erroApi?: YouTubeApiError
  erroGravado?: ErroGravado
  /** `antesDeEscrever` devolveu false: outra ação reivindicou o teste; nada foi escrito depois disso. */
  perdeuAVez?: boolean
}

export interface OpcoesApply {
  /** Chamado antes de CADA escrita (thumbnail e título); false = parar sem escrever (Y-D8). */
  antesDeEscrever?: () => Promise<boolean>
}

/**
 * Single source of truth for applying a variant to YouTube.
 * Handles thumbnail upload and/or title update. Never writes description.
 */
export async function applyVariantToYouTube(input: ApplyVariantInput, opcoes?: OpcoesApply): Promise<ApplyResult> {
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
      if (opcoes?.antesDeEscrever && !(await opcoes.antesDeEscrever())) {
        return { ok: false, perdeuAVez: true, appliedThumbnail, appliedMetadata, meta }
      }
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
        if (opcoes?.antesDeEscrever && !(await opcoes.antesDeEscrever())) {
          return { ok: false, perdeuAVez: true, appliedThumbnail, appliedMetadata, meta }
        }
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
      erroApi: err instanceof YouTubeApiError ? err : undefined,
      erroGravado: paraErroGravado(err),
    }
  }
}
