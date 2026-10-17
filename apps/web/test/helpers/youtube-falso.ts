// YouTubeFalso: o único YouTube/Blob falso da P4a (T6; reaproveitado por T8, T9, T10).
// Fala só por `fetch`, então o código real (lerSnippet, escreverTitulo, setThumbnail, fetchVariantImageBuffer,
// probeThumb) roda inteiro. Registra cada chamada, recusa, atrasa e permite intervir antes/depois de uma escrita.
import sharp from 'sharp'

export type ChamadaFalsa = 'videos.list' | 'videos.update' | 'thumbnails.set' | 'blob' | 'hqdefault'
const ESCRITAS: readonly ChamadaFalsa[] = ['videos.update', 'thumbnails.set']

export interface RelogioFalso { avancar(ms: number): void }

/** Imagem cujo dHash (thumb-fingerprint.dhashOf) é exatamente `hex` (16 dígitos): 9x8 de cinza ampliado sem suavizar. */
export async function imagemComDhash(hex: string): Promise<Buffer> {
  const px = Buffer.alloc(9 * 8)
  for (let y = 0; y < 8; y++) {
    const bits = hex.slice(2 * y, 2 * y + 2).split('').map((d) => parseInt(d, 16).toString(2).padStart(4, '0')).join('')
    let v = 130
    px[y * 9] = v
    for (let x = 0; x < 8; x++) { v += bits[x] === '1' ? -12 : 12; px[y * 9 + x + 1] = v }
  }
  return sharp(px, { raw: { width: 9, height: 8, channels: 1 } }).resize(450, 360, { kernel: 'nearest' }).png().toBuffer()
}

export const H = { A: 'f0f0f0f0f0f0f0f0', B: '00ff00ff00ff00ff', C: 'aaaaaaaaaaaaaaaa' } as const

export interface OpcoesYouTubeFalso {
  videoId?: string
  titulo?: string
  descricao?: string
  categoria?: string
  thumb: Buffer
  videoApagado?: boolean
  blobs?: Record<string, Buffer>
  relogio?: RelogioFalso
  avancaPorChamada?: number // ms que o relógio anda a cada chamada (F-D3)
}

type Gancho = (chamada: ChamadaFalsa) => void | Promise<void>

export class YouTubeFalso {
  titulo: string
  thumb: Buffer
  readonly chamadas: ChamadaFalsa[] = []
  private readonly recusas = new Map<ChamadaFalsa, { status: number; reason: string; corpo: string }>()
  private readonly atrasos = new Map<ChamadaFalsa, number>()
  private antes: Gancho[] = []
  private depois: Gancho[] = []
  private titulosDaLeitura: string[] = []
  private ultimoPut: { id: string; snippet: Record<string, unknown> } | null = null
  readonly fetch: typeof fetch

  constructor(private readonly o: OpcoesYouTubeFalso) {
    this.titulo = o.titulo ?? 'Título'
    this.thumb = o.thumb
    this.fetch = ((input: RequestInfo | URL, init?: RequestInit) => this.tratar(String(input), init)) as typeof fetch
  }

  /** Cada leitura (videos.list) devolve o próximo título da lista; a última se repete (corrida entre dois inícios). */
  lerTitulos(lista: string[]): void { this.titulosDaLeitura = [...lista] }
  registrarBlob(url: string, bytes: Buffer): void { this.o.blobs = { ...this.o.blobs, [url]: bytes } }
  recusar(chamada: ChamadaFalsa, status: number, reason: string, opcoes: { corpo?: string } = {}): void {
    this.recusas.set(chamada, { status, reason, corpo: opcoes.corpo ?? 'corpo' })
  }
  /** >= 10 s equivale ao timeout da chamada (10 s no snippet/título): lança TimeoutError, como o AbortSignal. */
  atrasar(chamada: ChamadaFalsa, ms: number): void { this.atrasos.set(chamada, ms) }
  antesDeEscrever(g: Gancho): void { this.antes.push(g) }
  depoisDeEscrever(g: Gancho): void { this.depois.push(g) }
  escritas(): ChamadaFalsa[] { return this.chamadas.filter((c) => ESCRITAS.includes(c)) }
  corpoDoUltimoPut(): { id: string; snippet: Record<string, unknown> } {
    if (!this.ultimoPut) throw new Error('nenhum PUT')
    return this.ultimoPut
  }

  private classificar(url: string, metodo: string): ChamadaFalsa {
    if (url.startsWith('https://i.ytimg.com/vi/')) return 'hqdefault'
    if (url.includes('/upload/youtube/v3/thumbnails/set')) return 'thumbnails.set'
    if (url.includes('googleapis.com/youtube/v3/videos')) return metodo === 'PUT' ? 'videos.update' : 'videos.list'
    return 'blob'
  }

  private async tratar(url: string, init?: RequestInit): Promise<Response> {
    const metodo = init?.method ?? 'GET'
    const chamada = this.classificar(url, metodo)
    this.chamadas.push(chamada)
    if (this.o.avancaPorChamada) this.o.relogio?.avancar(this.o.avancaPorChamada)
    const atraso = this.atrasos.get(chamada)
    if (atraso !== undefined) {
      this.o.relogio?.avancar(atraso)
      if (atraso >= 10_000) throw new DOMException('timeout', 'TimeoutError')
    }
    const escrita = ESCRITAS.includes(chamada)
    if (escrita) for (const g of this.antes) await g(chamada)
    const recusa = this.recusas.get(chamada)
    if (recusa) {
      return new Response(JSON.stringify({ error: { errors: [{ reason: recusa.reason, message: recusa.corpo }] } }), { status: recusa.status })
    }
    const resposta = this.responder(chamada, url, metodo, init)
    if (escrita && resposta.ok) for (const g of this.depois) await g(chamada)
    return resposta
  }

  private responder(chamada: ChamadaFalsa, url: string, metodo: string, init?: RequestInit): Response {
    switch (chamada) {
      case 'hqdefault':
        return metodo === 'HEAD' ? new Response(null, { status: 200 }) : new Response(new Uint8Array(this.thumb), { headers: { 'content-type': 'image/png' } })
      case 'blob': {
        const b = this.o.blobs?.[url]
        return b ? new Response(new Uint8Array(b), { headers: { 'content-type': 'image/jpeg' } }) : new Response(null, { status: 404 })
      }
      case 'videos.list':
        if (this.o.videoApagado) return new Response(JSON.stringify({ items: [] }))
        return new Response(JSON.stringify({ items: [{ snippet: { title: this.titulosDaLeitura.length > 1 ? this.titulosDaLeitura.shift()! : (this.titulosDaLeitura[0] ?? this.titulo), description: this.o.descricao ?? 'Descrição', categoryId: this.o.categoria ?? '19' } }] }))
      case 'videos.update': {
        const corpo = JSON.parse(String(init?.body)) as { id: string; snippet: Record<string, unknown> }
        this.ultimoPut = corpo
        this.titulo = String(corpo.snippet.title)
        return new Response('{}')
      }
      case 'thumbnails.set':
        this.thumb = Buffer.from(init?.body as Buffer)
        return new Response(JSON.stringify({ items: [{ high: { url: 'https://i.ytimg.com/x.jpg' } }] }))
    }
  }
}
