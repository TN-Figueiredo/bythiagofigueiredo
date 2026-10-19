import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { dhashOf } from '@/lib/youtube/thumb-fingerprint'
import { IMAGEM_PADRAO_YT } from '@/lib/youtube/teste-youtube/imagem'
import type { LeituraWatch } from '@/lib/youtube/teste-youtube/tipos'

export type MiniaturaSondada = LeituraWatch['miniaturas'][number]

const HOST = 'i.ytimg.com'
const VARIANTE = 'hqdefault'

function etagValido(v: string | null): string | null {
  if (v === null || v === '' || v.length > 200) return null
  return v
}

/** GET (nunca HEAD) da hqdefault. Nunca lança: falha de rede devolve `http null` e o resto nulo. */
export async function sondarMiniatura(ytId: string, f: typeof fetch = fetch, timeoutMs = 5_000): Promise<MiniaturaSondada> {
  const url = `https://${HOST}/vi/${ytId}/${VARIANTE}.jpg`
  const vazio: MiniaturaSondada = { url, host: HOST, variante: VARIANTE, largura: null, altura: null, http: null, etag: null, sha16: null, dhash: null }
  try {
    const r = await f(url, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) })
    const base: MiniaturaSondada = { ...vazio, http: r.status, etag: etagValido(r.headers.get('etag')) }
    const bytes = Buffer.from(new Uint8Array(await r.arrayBuffer()))
    if (bytes.length === 0) return base
    const comHash: MiniaturaSondada = { ...base, sha16: createHash('sha256').update(bytes).digest('hex').slice(0, 16) }
    if (r.status !== 200) return comHash
    const dhash = await dhashOf(bytes)
    if (dhash === IMAGEM_PADRAO_YT) return comHash
    const meta = await sharp(bytes).metadata()
    if (!meta.width || !meta.height) return comHash
    return { ...comHash, largura: meta.width, altura: meta.height, dhash }
  } catch {
    return vazio
  }
}
