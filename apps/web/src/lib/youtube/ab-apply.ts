import { setThumbnail, fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { TestTypeSchema, DESCRICAO_FORA_DO_TESTE } from '@/lib/youtube/ab-schemas'
import { paraErroGravado, YouTubeApiError } from '@/lib/youtube/youtube-api-error'
import type { ErroGravado } from '@/lib/youtube/ab-restore'
import type { AppliedMetadata, TestType } from '@/lib/youtube/ab-types'
import { MARGEM_ESCRITA_MS } from '@/lib/youtube/ab-settle'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Relê `restore_seq` antes de cada escrita (Y-D8): false = outra ação reivindicou o teste. */
export function antesDeEscreverPorSeq(supabase: SupabaseClient, testId: string, seq: number): () => Promise<boolean> {
  return async () => {
    const { data, error } = await supabase.from('ab_tests').select('restore_seq').eq('id', testId).single()
    if (error || !data) throw new Error(`ab-resume: releitura de restore_seq do teste ${testId}: ${error?.message ?? 'sem linha'}`)
    return (data as { restore_seq: number }).restore_seq === seq
  }
}

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
  /** O `prazo` não deixava mais tempo para a próxima escrita (F-D3): nada foi escrito depois disso. */
  tempoEsgotado?: boolean
}

export interface OpcoesApply {
  /** Chamado antes de CADA escrita (thumbnail e título); false = parar sem escrever (Y-D8). */
  antesDeEscrever?: () => Promise<boolean>
  /** Prazo absoluto (epoch ms). Antes de CADA escrita: `prazo - agora >= MARGEM_ESCRITA_MS`, senão para (F-D3). */
  prazo?: number
  agora?: () => number
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
  const semTempo = (): boolean =>
    opcoes?.prazo !== undefined && opcoes.prazo - (opcoes.agora ?? Date.now)() < MARGEM_ESCRITA_MS
  const tempoEsgotado = (): ApplyResult => ({
    ok: false, tempoEsgotado: true, appliedThumbnail, appliedMetadata, meta,
    error: 'tempo_esgotado', erroGravado: { motivo: 'tempo_esgotado' },
  })

  try {
    // Thumbnail
    if ((testType === 'thumbnail' || testType === 'combo') && variant.blob_url) {
      // Blob primeiro: a releitura do restore_seq fica colada na escrita (até 15 s de leitura do Blob antes).
      const { buffer, contentType } = await fetchVariantImageBuffer(variant.blob_url)
      if (semTempo()) return tempoEsgotado()
      if (opcoes?.antesDeEscrever && !(await opcoes.antesDeEscrever())) {
        return { ok: false, perdeuAVez: true, appliedThumbnail, appliedMetadata, meta }
      }
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
        if (semTempo()) return tempoEsgotado()
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
