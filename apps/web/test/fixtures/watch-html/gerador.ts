// @vitest-environment node
// Gerador determinístico de leituras (A11), compartilhado pelo teste do expansor (T7) e pela integração (T10).
import type { ResultadoLeitor } from '@/lib/youtube/watch/leitor'
import { RENDERERS_TITULO, leituraWatchSchema, type LeituraWatch } from '@/lib/youtube/teste-youtube/tipos'
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ID = 'qIg9a7vqcNo'
const HEX = '0123456789abcdef'

function hex16(rng: () => number): string {
  let s = ''
  for (let i = 0; i < 16; i++) s += HEX[Math.floor(rng() * 16)]
  return s
}
const pick = <T,>(rng: () => number, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!

export function gerar(rng: () => number, n: number): ResultadoLeitor[] {
  const out: ResultadoLeitor[] = []
  for (let i = 0; i < n; i++) {
    const comErro = rng() < 0.2
    const base = Date.UTC(2026, 9, 1) + Math.floor(rng() * 1e9)
    const textoA = `Título ${Math.floor(rng() * 1000)}`
    const modo = comErro ? 'erro' : pick(rng, ['igual', 'divergente', 'vazio', 'parcial'] as const)
    const titulosExibidos = RENDERERS_TITULO.map((renderer, j) => {
      let texto: string | null = null
      if (modo === 'igual') texto = textoA
      else if (modo === 'divergente') texto = j === 1 ? `${textoA} (b)` : textoA
      else if (modo === 'parcial') texto = j === 0 ? null : textoA
      return { renderer, texto }
    })
    const temTexto = titulosExibidos.some(t => t.texto !== null)
    const oficial = !comErro && rng() < 0.7
    const comMiniatura = !comErro && rng() < 0.5
    const dh = comMiniatura && rng() < 0.7
    const leitura: LeituraWatch = {
      youtubeVideoId: ID,
      lidaEm: new Date(base).toISOString(),
      rodadaId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      origemRede: pick(rng, ['vercel', 'forja', 'mac-casa'] as const),
      idioma: comErro ? null : temTexto || rng() < 0.5 ? pick(rng, ['pt-BR', 'es-419', 'en', 'pt-PT'] as const) : null,
      erro: comErro ? pick(rng, ['timeout', 'http_429', 'consentimento'] as const) : null,
      tituloOficial: oficial ? textoA : null,
      titulo_oficial_fonte: oficial ? pick(rng, ['videoDetails', 'og_title'] as const) : null,
      rendicoesSqp: rng() < 0.5 ? Math.floor(rng() * 20) : null,
      titulosExibidos,
      miniaturas: comMiniatura ? [{
        url: `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`, host: 'i.ytimg.com', variante: 'hqdefault',
        largura: dh ? 480 : null, altura: dh ? 360 : null, http: dh ? 200 : pick(rng, [404, null] as const),
        etag: rng() < 0.5 ? `W/"${Math.floor(rng() * 1e6)}"` : null, sha16: rng() < 0.5 ? hex16(rng) : null, dhash: dh ? hex16(rng) : null,
      }] : [],
    }
    // leitura sem título e sem erro precisa idioma só quando há título; o gerador já respeita isso
    const ok = leituraWatchSchema.safeParse(leitura)
    if (!ok.success) throw new Error(`gerador produziu leitura inválida: ${ok.error.message}`)
    out.push({ leitura: ok.data, http: comErro ? pick(rng, [429, 302, null] as const) : 200, jogadorBloqueado: !comErro && rng() < 0.2 })
  }
  return out
}

