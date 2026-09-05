import { setThumbnail, fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { resolveTemplates } from '@/lib/youtube/ab-templates'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { AppliedMetadata } from '@/lib/youtube/ab-types'

// CTR e impressoes nao existem em nenhuma API publica do YouTube. O campo
// 'impressions' aqui e views renomeado e 'ctr' e gravado como 0 fixo, entao
// a confianca bayesiana roda sobre ruido. Ate existir dado real (decisao do
// dono: aposentar o eixo, entrada manual do Studio, ou proxy renomeado), o
// vencedor e apenas sugerido — nunca aplicado sem confirmacao humana.
// Funcao (nao const de modulo) para reavaliar a env var a cada chamada —
// necessario tanto em runtime (Vercel pode reconfigurar sem redeploy via
// alguns setups) quanto em teste (vi.stubEnv so tem efeito em leituras
// feitas depois do stub).
export function isAutoApplyEnabled(): boolean {
  return process.env.AB_AUTO_APPLY_WINNER === 'true'
}

export interface ApplyVariantInput {
  youtubeVideoId: string
  accessToken: string
  testType: 'thumbnail' | 'title' | 'description' | 'combo'
  variant: {
    id?: string
    blob_url?: string | null
    title_text?: string | null
    description_text?: string | null
  }
  originalTitle?: string | null
  originalDescription?: string | null
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
 * Handles thumbnail upload and/or title/description metadata update
 * with tracked link template resolution.
 */
export async function applyVariantToYouTube(input: ApplyVariantInput): Promise<ApplyResult> {
  const {
    youtubeVideoId,
    accessToken,
    testType,
    variant,
    originalTitle,
    originalDescription,
  } = input

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

    // Metadata (title/description)
    if (testType === 'title' || testType === 'description' || testType === 'combo') {
      let titleToSet: string | null = null
      let descToSet: string | null = null

      if (testType === 'title' || testType === 'combo') {
        titleToSet = variant.title_text ?? originalTitle ?? null
      }

      if (testType === 'description' || testType === 'combo') {
        const rawDesc = variant.description_text ?? originalDescription ?? null
        if (rawDesc && variant.id) {
          const supabase = getSupabaseServiceClient()
          const { data: linkMappings } = await supabase
            .from('ab_test_tracked_links')
            .select('template_name, short_code')
            .eq('variant_id', variant.id)

          const linkMap: Record<string, string> = {}
          const shortDomain = process.env.LINKS_SHORT_DOMAIN ?? 'go.bythiagofigueiredo.com'
          for (const lm of linkMappings ?? []) {
            linkMap[lm.template_name] = `https://${shortDomain}/${lm.short_code}`
          }
          descToSet = resolveTemplates(rawDesc, linkMap)
          meta.links_resolved = linkMap
        } else if (rawDesc) {
          descToSet = rawDesc
        }
      }

      if (titleToSet || descToSet) {
        await updateVideoMetadata(youtubeVideoId, titleToSet, descToSet, accessToken)
        appliedMetadata = true
        meta.title_set = titleToSet
        meta.description_set = descToSet
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
