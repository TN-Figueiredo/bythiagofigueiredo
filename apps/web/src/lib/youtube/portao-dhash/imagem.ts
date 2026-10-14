import sharp from 'sharp'
import { dhashOf, hamming } from '@/lib/youtube/thumb-fingerprint'
import { Recusa } from './regras'

export type Variante = 'maxresdefault' | 'sddefault' | 'hqdefault'
const ORDEM: readonly Variante[] = ['maxresdefault', 'sddefault', 'hqdefault']

export const urlDaVariante = (video: string, v: Variante) => `https://i.ytimg.com/vi/${encodeURIComponent(video)}/${v}.jpg`

/** null = a imagem não existe (404 ou resposta que não é imagem). Rede ou 5xx lança: "não sei" não é "não existe". */
export async function baixar(url: string, f: typeof fetch): Promise<Buffer | null> {
  const res = await f(url, { signal: AbortSignal.timeout(15_000) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  if (!(res.headers.get('content-type') ?? '').startsWith('image/')) return null
  const b = Buffer.from(await res.arrayBuffer())
  return b.length > 0 ? b : null
}

export async function maiorCopia(video: string, f: typeof fetch): Promise<{ variante: Variante; bytes: Buffer; largura: number; altura: number }> {
  for (const variante of ORDEM) {
    const bytes = await baixar(urlDaVariante(video, variante), f)
    if (!bytes) continue
    const m = await sharp(bytes).metadata()
    return { variante, bytes, largura: m.width ?? 0, altura: m.height ?? 0 }
  }
  throw new Recusa(`nenhuma cópia pública da thumbnail de ${video}: nada foi escrito`)
}

/** Spec 3.4: como o YouTube monta a hqdefault (480×360, faixas pretas). A P4a decide onde a versão definitiva mora. */
export async function hqdefaultLike(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes).resize(480, 360, { fit: 'contain', background: '#000' }).jpeg().toBuffer()
}

export const dhashComoHq = async (bytes: Buffer): Promise<string> => dhashOf(await hqdefaultLike(bytes))

/** O negativo da original em 1280×720: inverte quase todos os bits do dHash. */
export async function gerarImagemTeste(maior: Buffer): Promise<Buffer> {
  return sharp(maior).resize(1280, 720, { fit: 'contain', background: '#000' }).negate({ alpha: false }).jpeg({ quality: 90 }).toBuffer()
}

/** (iv) do portão: distância par a par, só arquivos locais. */
export async function distancias(imagens: Buffer[], nomes: string[]): Promise<string[]> {
  const h = await Promise.all(imagens.map(dhashComoHq))
  const linhas: string[] = []
  for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) linhas.push(`${nomes[i]} × ${nomes[j]}: ${hamming(h[i]!, h[j]!)}`)
  return linhas
}
