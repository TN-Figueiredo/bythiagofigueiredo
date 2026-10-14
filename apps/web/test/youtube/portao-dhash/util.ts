import sharp from 'sharp'

/** Imagem com gradiente (cor lisa dá dHash zero e não serve para teste). `semente` muda o desenho. */
export async function imagemSintetica(w: number, h: number, semente: number): Promise<Buffer> {
  const px = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = Math.floor(127 + 120 * Math.sin((x / w) * Math.PI * semente + (y / h) * Math.PI * ((semente % 3) + 1)))
    const i = (y * w + x) * 3
    px[i] = v; px[i + 1] = 255 - v; px[i + 2] = (v * semente) & 255
  }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 92 }).toBuffer()
}

export const respostaImagem = (b: Buffer) => new Response(new Uint8Array(b), { headers: { 'content-type': 'image/jpeg' } })

/** fetch falso por nome de variante (o trecho antes de ".jpg"); o que não estiver no mapa responde 404. */
export function fetchFalso(mapa: Record<string, Response | (() => Response)>): typeof fetch {
  return (async (url: string | URL) => {
    const nome = String(url).split('/').pop()!.replace('.jpg', '')
    const r = mapa[nome]
    if (!r) return new Response('', { status: 404 })
    return typeof r === 'function' ? r() : r.clone()
  }) as unknown as typeof fetch
}
