import * as Sentry from '@sentry/nextjs'
import sharp from 'sharp'
import { put } from '@vercel/blob'
import type { SupabaseClient } from '@supabase/supabase-js'
import { biggerCopy, dhashOf, hqdefaultLike, probeThumb, thumbUrl } from '@/lib/youtube/thumb-fingerprint'
import { fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { YouTubeApiError } from '@/lib/youtube/youtube-api-error'

export type DhashDaVariante =
  | { tipo: 'ok'; dhash: string }
  | { tipo: 'sem_base'; motivo: 'blob_404' | 'ilegivel' | 'sem_blob_url' }
  | { tipo: 'falha'; erro: YouTubeApiError }

/** dHash dos bytes como o YouTube os serviria (hqdefaultLike + dhashOf). Lança se o sharp não lê. */
export async function dhashDosBytes(bytes: Buffer): Promise<string> {
  return dhashOf(await hqdefaultLike(bytes))
}

/** Melhor esforço para o envio da imagem: erro do cálculo vira nulo + Sentry, nunca bloqueia. */
export async function dhashOuNulo(bytes: Buffer, contexto: string): Promise<string | null> {
  try {
    return await dhashDosBytes(bytes)
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'ab-lab', action: 'thumbnail_dhash' }, extra: { contexto } })
    return null
  }
}

/** Lê o arquivo da variante no Blob (cota 0) e devolve o dHash. 404 = sem base; rede/5xx = falha. */
export async function dhashDoArquivo(blobUrl: string | null, f: typeof fetch = fetch): Promise<DhashDaVariante> {
  if (!blobUrl) return { tipo: 'sem_base', motivo: 'sem_blob_url' }
  let buffer: Buffer
  try {
    buffer = (await fetchVariantImageBuffer(blobUrl, f)).buffer
  } catch (e) {
    if (e instanceof YouTubeApiError) {
      if (e.status === 404) return { tipo: 'sem_base', motivo: 'blob_404' }
      return { tipo: 'falha', erro: e }
    }
    return { tipo: 'sem_base', motivo: 'ilegivel' } // host fora da allowlist ou URL inválida
  }
  try {
    return { tipo: 'ok', dhash: await dhashDosBytes(buffer) }
  } catch {
    return { tipo: 'sem_base', motivo: 'ilegivel' }
  }
}

export async function dhashDasVariantes(
  supabase: SupabaseClient,
  variantes: Array<{ id: string; blob_url: string | null; thumbnail_dhash: string | null }>,
  f: typeof fetch = fetch,
): Promise<Map<string, DhashDaVariante>> {
  const out = new Map<string, DhashDaVariante>()
  const pendentes = variantes.filter((v) => {
    if (v.thumbnail_dhash) {
      out.set(v.id, { tipo: 'ok', dhash: v.thumbnail_dhash })
      return false
    }
    return true
  })
  const medidas = await Promise.all(pendentes.map(async (v) => ({ v, r: await dhashDoArquivo(v.blob_url, f) })))
  await Promise.all(medidas.map(async ({ v, r }) => {
    out.set(v.id, r)
    if (r.tipo !== 'ok' || !v.blob_url) return
    // F-P7: só preenche se ainda for nulo E a cópia medida ainda for a atual.
    const { error } = await supabase
      .from('ab_test_variants')
      .update({ thumbnail_dhash: r.dhash })
      .eq('id', v.id)
      .is('thumbnail_dhash', null)
      .eq('blob_url', v.blob_url)
    if (error) Sentry.captureMessage('thumbnail_dhash não gravado', { extra: { variantId: v.id, message: error.message } })
  }))
  return out
}

/** Guarda a maior cópia da original (1280×720, senão 640×480, senão a hqdefault) e devolve url, dHash e dimensões. */
export async function guardarOriginalMaior(
  youtubeId: string,
  testOuVideoUuid: string,
  f: typeof fetch = fetch,
): Promise<{ url: string; dhash: string; largura: number; altura: number }> {
  const bytes = (await biggerCopy(thumbUrl(youtubeId), f)) ?? (await probeThumb(youtubeId, null, f)).bytes
  if (!bytes) throw new Error('thumbnail original indisponível')
  const meta = await sharp(bytes).metadata()
  const dhash = await dhashDosBytes(bytes)
  const blob = await put(`ab-originals/${testOuVideoUuid}.jpg`, bytes, {
    access: 'public', contentType: 'image/jpeg', addRandomSuffix: true,
  })
  return { url: blob.url, dhash, largura: meta.width ?? 0, altura: meta.height ?? 0 }
}
